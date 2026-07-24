/**
 * Signed-in account — email, role, biometric unlock, sign out.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { logoutAuth, type AuthUser } from '../services/AuthApiService';
import {
  authenticateWithBiometric,
  biometricUnlockLabel,
  canUseBiometricUnlock,
  isBiometricUnlockEnabled,
  setBiometricUnlockEnabled,
} from '../services/BiometricUnlockService';
import {
  CloudBackupBlockedError,
  fetchCloudBackupStatus,
  purgeCloudBackup,
  restoreCloudBackup,
  uploadCloudBackup,
  type CloudBackupStatus,
} from '../services/CloudBackupService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import type { UserLanguage } from '../services/TargetService';

type Props = {
  user: AuthUser;
  expanded: boolean;
  onToggleExpand: () => void;
  onSignedOut: () => void;
  onDataRestored?: () => void | Promise<void>;
  lang?: UserLanguage | null;
};

export function AccountStrip({
  user,
  expanded,
  onToggleExpand,
  onSignedOut,
  onDataRestored,
  lang,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudBackupStatus | null>(null);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);

  const isPatient = user.role === 'patient';

  const refreshCloudStatus = useCallback(async () => {
    if (!isPatient) return;
    try {
      const status = await fetchCloudBackupStatus();
      setCloudStatus(status);
    } catch (e: unknown) {
      setCloudMessage(e instanceof Error ? e.message : 'Could not load cloud backup status.');
    }
  }, [isPatient]);

  useEffect(() => {
    if (!expanded) return;
    void (async () => {
      const [available, enabled, label] = await Promise.all([
        canUseBiometricUnlock(),
        isBiometricUnlockEnabled(),
        biometricUnlockLabel(),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setBiometricLabel(label);
    })();
    if (isPatient) void refreshCloudStatus();
  }, [expanded, isPatient, refreshCloudStatus]);

  const handleBiometricToggle = useCallback(async (next: boolean) => {
    setError(null);
    if (next) {
      const ok = await authenticateWithBiometric();
      if (!ok) return;
      await setBiometricUnlockEnabled(true);
      setBiometricEnabled(true);
      return;
    }
    await setBiometricUnlockEnabled(false);
    setBiometricEnabled(false);
  }, []);

  const applyUploadResult = useCallback(
    (uploaded: { exportedAt: string; byteSize: number; fingerprint?: CloudBackupStatus['fingerprint'] }) => {
      setCloudStatus((prev) => ({
        enabled: true,
        hasBackup: true,
        exportedAt: uploaded.exportedAt,
        byteSize: uploaded.byteSize,
        fingerprint: uploaded.fingerprint ?? null,
        hasPrevious: prev?.hasPrevious ?? false,
      }));
    },
    [],
  );

  const handleRestoreCloud = useCallback(() => {
    Alert.alert(
      'Restore from cloud?',
      'Merge cloud backup into this phone. Newer local meals and chat may combine with cloud data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            void (async () => {
              setCloudBusy(true);
              setCloudMessage(null);
              try {
                const result = await restoreCloudBackup();
                await onDataRestored?.();
                const summary = `Restored ${result.keysRestored} keys • +${result.mealsAdded} meals • +${result.chatMessagesAdded} chat`;
                setCloudMessage(summary);
                Alert.alert('Cloud restore', summary);
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Restore failed.';
                setCloudMessage(msg);
                Alert.alert('Cloud restore', msg);
              } finally {
                setCloudBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [onDataRestored]);

  const runUploadWithGuard = useCallback(
    async (force = false) => {
      setCloudBusy(true);
      setCloudMessage(null);
      try {
        const uploaded = await uploadCloudBackup({ force });
        applyUploadResult(uploaded);
        setCloudMessage(force ? 'Cloud backup replaced.' : 'Cloud backup saved.');
        void refreshCloudStatus();
      } catch (e: unknown) {
        if (e instanceof CloudBackupBlockedError) {
          Alert.alert('Cloud backup blocked', e.message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore from cloud', onPress: () => handleRestoreCloud() },
            {
              text: 'Force replace',
              style: 'destructive',
              onPress: () => {
                void runUploadWithGuard(true);
              },
            },
          ]);
          setCloudMessage(e.message);
        } else {
          setCloudMessage(e instanceof Error ? e.message : 'Upload failed.');
        }
      } finally {
        setCloudBusy(false);
      }
    },
    [applyUploadResult, refreshCloudStatus, handleRestoreCloud],
  );

  const handleCloudToggle = useCallback((next: boolean) => {
    setCloudMessage(null);
    if (next) {
      Alert.alert(
        'Cloud backup',
        'Upload a copy of your app data to Healthings servers for restore if you lose your phone. Backs up about once a day while enabled. Withings login is not included — re-link on a new device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: () => void runUploadWithGuard(false),
          },
        ],
      );
      return;
    }
    Alert.alert(
      'Turn off cloud backup?',
      'This deletes your server copy (including the previous version). Data on this phone stays unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete server copy',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCloudBusy(true);
              try {
                await purgeCloudBackup();
                setCloudStatus({
                  enabled: false,
                  hasBackup: false,
                  exportedAt: null,
                  byteSize: null,
                  fingerprint: null,
                  hasPrevious: false,
                });
                setCloudMessage('Server backup removed.');
              } catch (e: unknown) {
                setCloudMessage(e instanceof Error ? e.message : 'Could not remove backup.');
              } finally {
                setCloudBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, [runUploadWithGuard]);

  const handleCloudBackupNow = useCallback(async () => {
    await runUploadWithGuard(false);
  }, [runUploadWithGuard]);

  const handleLogout = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await logoutAuth();
      onSignedOut();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign out failed');
    } finally {
      setBusy(false);
    }
  }, [onSignedOut]);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.account}
        subtitle={user.email}
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse account"
        expandLabel="Expand account"
      />

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.signedInLine}>{user.email}</Text>
          <Text style={styles.roleLine}>
            {user.role === 'mentor' ? 'Mentor / clinic' : 'Patient'}
          </Text>

          {biometricAvailable ? (
            <View style={styles.biometricRow}>
              <View style={styles.biometricText}>
                <Text style={styles.biometricTitle}>Unlock with {biometricLabel}</Text>
                <Text style={styles.biometricHint}>Required when opening the app</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={(next) => void handleBiometricToggle(next)}
                trackColor={{ false: colors.gridLine, true: colors.accentGreen }}
                thumbColor="#fff"
              />
            </View>
          ) : null}

          {isPatient ? (
            <View style={styles.cloudBlock}>
              <View style={styles.biometricRow}>
                <View style={styles.biometricText}>
                  <Text style={styles.biometricTitle}>Cloud backup</Text>
                  <Text style={styles.biometricHint}>
                    Optional server copy for restore. Off deletes the server copy only. Auto-backs up about once a day while on.
                  </Text>
                </View>
                <Switch
                  value={cloudStatus?.enabled ?? false}
                  onValueChange={(next) => void handleCloudToggle(next)}
                  disabled={cloudBusy}
                  trackColor={{ false: colors.gridLine, true: colors.accentGreen }}
                  thumbColor="#fff"
                />
              </View>
              {cloudStatus?.hasBackup && cloudStatus.exportedAt ? (
                <Text style={styles.cloudMeta}>
                  Last backup: {new Date(cloudStatus.exportedAt).toLocaleString()}
                  {cloudStatus.byteSize != null
                    ? ` · ${(cloudStatus.byteSize / (1024 * 1024)).toFixed(1)} MB`
                    : ''}
                  {cloudStatus.hasPrevious ? ' · previous kept' : ''}
                </Text>
              ) : null}
              {cloudStatus?.enabled ? (
                <Pressable
                  style={[styles.cloudBtn, cloudBusy && styles.btnDisabled]}
                  disabled={cloudBusy}
                  onPress={() => void handleCloudBackupNow()}
                >
                  <Text style={styles.cloudBtnText}>Back up now</Text>
                </Pressable>
              ) : null}
              {cloudStatus?.hasBackup ? (
                <Pressable
                  style={[styles.cloudBtnOutline, cloudBusy && styles.btnDisabled]}
                  disabled={cloudBusy}
                  onPress={() => void handleRestoreCloud()}
                >
                  <Text style={styles.cloudBtnOutlineText}>Restore from cloud</Text>
                </Pressable>
              ) : null}
              {cloudBusy ? <ActivityIndicator color={colors.accentBlue} /> : null}
              {cloudMessage ? <Text style={styles.cloudMessage}>{cloudMessage}</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={[styles.logoutBtn, busy && styles.btnDisabled]}
            onPress={handleLogout}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.logoutBtnText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    body: {
      marginTop: 4,
      gap: 8,
      paddingHorizontal: 4,
    },
    signedInLine: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textPrimary,
    },
    roleLine: {
      fontSize: 13,
      color: c.textSecondary,
      marginBottom: 4,
    },
    biometricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      marginBottom: 4,
    },
    biometricText: {
      flex: 1,
    },
    biometricTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textPrimary,
    },
    biometricHint: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    logoutBtn: {
      alignSelf: 'flex-start',
      backgroundColor: c.textSecondary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    logoutBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    errorText: {
      fontSize: 13,
      color: '#c0392b',
    },
    cloudBlock: {
      marginTop: 4,
      marginBottom: 8,
      gap: 8,
    },
    cloudMeta: {
      fontSize: 12,
      color: c.textSecondary,
    },
    cloudBtn: {
      alignSelf: 'flex-start',
      backgroundColor: c.accentBlue,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    cloudBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 13,
    },
    cloudBtnOutline: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.accentBlue,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    cloudBtnOutlineText: {
      color: c.accentBlue,
      fontWeight: '600',
      fontSize: 13,
    },
    cloudMessage: {
      fontSize: 12,
      color: c.textSecondary,
      lineHeight: 17,
    },
  });
