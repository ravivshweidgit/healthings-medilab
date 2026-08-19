/**
 * Signed-in account — email, role, biometric unlock, sign out.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  confirmTotpEnroll,
  disableTotp,
  emailTotpBarcode,
  fetchCurrentUser,
  logoutAuth,
  setWebViewEnabled,
  type AuthUser,
} from '../services/AuthApiService';
import {
  resetWebViewPushThrottle,
  shareSnapshotIfAnyConsumer,
  shareSnapshotNow,
} from '../services/ClinicSyncService';
import { fetchMyLatestSyncMeta, type PublicSyncBlob } from '../services/SyncApiService';
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
import { countLocalFoodLogDays } from '../services/LocalBackupService';
import { shareTodayAppLog } from '../services/AppDailyLogService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { DashboardCollapseHeader } from './DashboardCollapseHeader';
import type { UserLanguage } from '../services/TargetService';

/** Same page as privacy.html#deletion — OTP step-up lives there, not in the app. */
const ACCOUNT_DELETE_URL = 'https://healthings.ai/account/';

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
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const profileTitles = getProfileSettingsStripCopy(lang?.code);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudBackupStatus | null>(null);
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const [webViewOn, setWebViewOn] = useState(user.webViewEnabled === true);
  const [webViewBusy, setWebViewBusy] = useState(false);
  const [webViewSync, setWebViewSync] = useState<PublicSyncBlob | null>(null);
  const [webViewMessage, setWebViewMessage] = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(user.totpEnabled === true);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpMessage, setTotpMessage] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpAwaitingConfirm, setTotpAwaitingConfirm] = useState(false);

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

  // The flag can be changed from another device or from the web page, so the
  // cached user is a starting value only — the server is asked on every expand.
  const refreshWebViewStatus = useCallback(async () => {
    if (!isPatient) return;
    const [me, sync] = await Promise.all([
      fetchCurrentUser().catch(() => null),
      fetchMyLatestSyncMeta().catch(() => null),
    ]);
    if (me) {
      setWebViewOn(me.webViewEnabled === true);
      setTotpEnabled(me.totpEnabled === true);
    }
    setWebViewSync(sync);
  }, [isPatient]);

  useEffect(() => {
    if (isPatient) void refreshCloudStatus();
  }, [isPatient, refreshCloudStatus]);

  useEffect(() => {
    if (!expanded) return;
    void (async () => {
      const [available, enabled, label, me] = await Promise.all([
        canUseBiometricUnlock(),
        isBiometricUnlockEnabled(),
        biometricUnlockLabel(),
        fetchCurrentUser().catch(() => null),
      ]);
      setBiometricAvailable(available);
      setBiometricEnabled(enabled);
      setBiometricLabel(label);
      if (me) setTotpEnabled(me.totpEnabled === true);
    })();
    if (isPatient) void refreshWebViewStatus();
  }, [expanded, isPatient, refreshWebViewStatus]);

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

  const handleSendSnapshotNow = useCallback(async () => {
    setWebViewBusy(true);
    setWebViewMessage(null);
    try {
      await shareSnapshotNow();
      await refreshWebViewStatus();
      setWebViewMessage('Snapshot sent — refresh healthings.ai/account to see it.');
    } catch (e: unknown) {
      setWebViewMessage(e instanceof Error ? e.message : 'Could not send snapshot.');
    } finally {
      setWebViewBusy(false);
    }
  }, [refreshWebViewStatus]);

  const handleWebViewToggle = useCallback(
    (next: boolean) => {
      setWebViewMessage(null);
      const apply = async (enabled: boolean) => {
        setWebViewBusy(true);
        try {
          const updated = await setWebViewEnabled(enabled);
          setWebViewOn(updated.webViewEnabled === true);
          if (enabled) {
            // Upload straight away: the page has no way to ask for a snapshot,
            // so without this it would sit on "waiting for your phone".
            resetWebViewPushThrottle();
            await shareSnapshotIfAnyConsumer();
            setWebViewMessage('On — open healthings.ai/account and sign in with your email.');
          } else {
            setWebViewMessage(null);
          }
          await refreshWebViewStatus();
        } catch (e: unknown) {
          setWebViewMessage(e instanceof Error ? e.message : 'Could not update your web view.');
        } finally {
          setWebViewBusy(false);
        }
      };

      if (next) {
        Alert.alert(
          'My web view',
          'Send a snapshot to Healthings servers so you can read your own data at healthings.ai/account. Sign in there with this email. Turn it off any time and we delete the copy.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Turn on', onPress: () => void apply(true) },
          ],
        );
        return;
      }
      Alert.alert(
        'Turn off my web view?',
        'Your web page stops working. We delete the server copy unless a clinic you linked still reads it. Data on this phone stays unchanged.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Turn off', style: 'destructive', onPress: () => void apply(false) },
        ],
      );
    },
    [refreshWebViewStatus],
  );

  const handleCloudToggle = useCallback((next: boolean) => {
    setCloudMessage(null);
    if (next) {
      void (async () => {
        const mealDays = await countLocalFoodLogDays();
        const emptyWarn =
          mealDays === 0
            ? ' This phone has no meals. If you just switched phones, restore from cloud or tap Back up now on the old phone first — do not upload an empty copy.'
            : '';
        Alert.alert(
          'Cloud backup',
          `Upload a copy of your app data to Healthings servers for restore if you lose your phone. Backs up about once a day while enabled. Withings login is not included — re-link on a new device.${emptyWarn}`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: mealDays === 0 ? 'Enable anyway' : 'Enable',
              onPress: () => void runUploadWithGuard(false),
            },
          ],
        );
      })();
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

  const handleEmailTotpBarcode = useCallback(async () => {
    setTotpMessage(null);
    setTotpBusy(true);
    try {
      await emailTotpBarcode();
      setTotpAwaitingConfirm(true);
      setTotpCode('');
      setTotpMessage('Barcode emailed. Scan it, then enter a 6-digit code here.');
    } catch (e: unknown) {
      setTotpMessage(e instanceof Error ? e.message : 'Could not email the barcode.');
    } finally {
      setTotpBusy(false);
    }
  }, []);

  const handleConfirmTotp = useCallback(async () => {
    if (totpCode.trim().length !== 6) return;
    setTotpMessage(null);
    setTotpBusy(true);
    try {
      const me = await confirmTotpEnroll(totpCode);
      setTotpEnabled(me.totpEnabled === true);
      setTotpAwaitingConfirm(false);
      setTotpCode('');
      setTotpMessage('Authenticator is on. Sign-in accepts that code or email OTP.');
    } catch (e: unknown) {
      setTotpMessage(e instanceof Error ? e.message : 'Invalid authenticator code.');
    } finally {
      setTotpBusy(false);
    }
  }, [totpCode]);

  const handleRemoveTotp = useCallback(() => {
    Alert.alert(
      'Remove Authenticator?',
      'Sign-in will use email codes only until you add it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setTotpBusy(true);
              setTotpMessage(null);
              try {
                const me = await disableTotp();
                setTotpEnabled(me.totpEnabled === true);
                setTotpAwaitingConfirm(false);
                setTotpCode('');
                setTotpMessage('Authenticator removed.');
              } catch (e: unknown) {
                setTotpMessage(e instanceof Error ? e.message : 'Could not remove authenticator.');
              } finally {
                setTotpBusy(false);
              }
            })();
          },
        },
      ],
    );
  }, []);

  // Deletion is on the web (OTP to the account email). Opening the browser is the
  // whole app side — embedding a second flow here would drift from privacy.html
  // and from /account/. Offered to both roles: clinics have accounts too.
  const handleOpenDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'Opens healthings.ai/account in your browser. Sign in with this email, then choose Delete my account — we email a confirmation code first. Your phone data stays until you uninstall.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open website',
          style: 'destructive',
          onPress: () => {
            void Linking.openURL(ACCOUNT_DELETE_URL).catch(() => {
              Alert.alert('Could not open', 'Open healthings.ai/account in a browser and sign in.');
            });
          },
        },
      ],
    );
  }, []);

  return (
    <View style={styles.wrap}>
      <DashboardCollapseHeader
        title={profileTitles.account}
        subtitle={
          cloudStatus?.hasBackup
            ? `${user.email} · Restore from cloud available`
            : user.email
        }
        expanded={expanded}
        onToggle={onToggleExpand}
        titleRtl={lang?.code === 'he' || lang?.code === 'ar'}
        collapseLabel="Collapse account"
        expandLabel="Expand account"
        perfTag="AccountStrip"
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

          <View style={styles.cloudBlock}>
            <Text style={styles.biometricTitle}>Google Authenticator</Text>
            <Text style={styles.biometricHint}>
              Optional. We email a barcode to scan. After you confirm, sign-in accepts that
              6-digit code or the email OTP.
            </Text>
            {totpEnabled ? (
              <Text style={styles.cloudMeta}>On — email OTP still works</Text>
            ) : null}
            {!totpEnabled ? (
              <Pressable
                style={[styles.cloudBtn, totpBusy && styles.btnDisabled]}
                disabled={totpBusy}
                onPress={() => void handleEmailTotpBarcode()}
              >
                <Text style={styles.cloudBtnText}>Email barcode</Text>
              </Pressable>
            ) : null}
            {totpAwaitingConfirm && !totpEnabled ? (
              <>
                <TextInput
                  style={styles.totpInput}
                  value={totpCode}
                  onChangeText={setTotpCode}
                  placeholder="123456"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!totpBusy}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
                <Pressable
                  style={[styles.cloudBtn, (totpCode.length !== 6 || totpBusy) && styles.btnDisabled]}
                  disabled={totpCode.length !== 6 || totpBusy}
                  onPress={() => void handleConfirmTotp()}
                >
                  <Text style={styles.cloudBtnText}>Confirm code</Text>
                </Pressable>
              </>
            ) : null}
            {totpEnabled ? (
              <Pressable
                style={[styles.cloudBtnOutline, totpBusy && styles.btnDisabled]}
                disabled={totpBusy}
                onPress={handleRemoveTotp}
              >
                <Text style={styles.cloudBtnOutlineText}>Remove Authenticator</Text>
              </Pressable>
            ) : null}
            {totpBusy ? <ActivityIndicator color={colors.accentBlue} /> : null}
            {totpMessage ? <Text style={styles.cloudMessage}>{totpMessage}</Text> : null}
          </View>

          {isPatient ? (
            <View style={styles.cloudBlock}>
              <View style={styles.biometricRow}>
                <View style={styles.biometricText}>
                  <Text style={styles.biometricTitle}>Cloud backup</Text>
                  <Text style={styles.biometricHint}>
                    Optional auto-upload. Restore stays available whenever a server copy exists — you do not need this on. Off deletes the server copy only.
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
              {cloudStatus?.hasBackup ? (
                <Pressable
                  style={[styles.cloudBtn, cloudBusy && styles.btnDisabled]}
                  disabled={cloudBusy}
                  onPress={() => void handleRestoreCloud()}
                >
                  <Text style={styles.cloudBtnText}>Restore from cloud</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.cloudBtnOutline, cloudBusy && styles.btnDisabled]}
                disabled={cloudBusy}
                onPress={() => void handleCloudBackupNow()}
              >
                <Text style={styles.cloudBtnOutlineText}>Back up now</Text>
              </Pressable>
              {cloudBusy ? <ActivityIndicator color={colors.accentBlue} /> : null}
              {cloudMessage ? <Text style={styles.cloudMessage}>{cloudMessage}</Text> : null}
            </View>
          ) : null}

          {isPatient ? (
            <View style={styles.cloudBlock}>
              <View style={styles.biometricRow}>
                <View style={styles.biometricText}>
                  <Text style={styles.biometricTitle}>My web view</Text>
                  <Text style={styles.biometricHint}>
                    Read your own data at healthings.ai/account. Sends the same snapshot a clinic
                    would see. Off deletes the server copy unless a clinic still reads it.
                  </Text>
                </View>
                <Switch
                  value={webViewOn}
                  onValueChange={(next) => handleWebViewToggle(next)}
                  disabled={webViewBusy}
                  trackColor={{ false: colors.gridLine, true: colors.accentGreen }}
                  thumbColor="#fff"
                />
              </View>
              {webViewOn && webViewSync ? (
                <Text style={styles.cloudMeta}>
                  Last sent: {new Date(webViewSync.createdAt).toLocaleString()} (v
                  {webViewSync.version})
                </Text>
              ) : null}
              {webViewOn ? (
                <Pressable
                  style={[styles.cloudBtn, webViewBusy && styles.btnDisabled]}
                  disabled={webViewBusy}
                  onPress={() => void handleSendSnapshotNow()}
                >
                  <Text style={styles.cloudBtnText}>Send snapshot now</Text>
                </Pressable>
              ) : null}
              {webViewBusy ? <ActivityIndicator color={colors.accentBlue} /> : null}
              {webViewMessage ? <Text style={styles.cloudMessage}>{webViewMessage}</Text> : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Pressable
            style={[styles.cloudBtnOutline, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => {
              void shareTodayAppLog().catch((e: unknown) => {
                Alert.alert(
                  'App log',
                  e instanceof Error ? e.message : 'Could not share today\'s log.',
                );
              });
            }}
          >
            <Text style={styles.cloudBtnOutlineText}>Share app log (today)</Text>
          </Pressable>
          <Pressable
            style={[styles.logoutBtn, busy && styles.btnDisabled]}
            onPress={handleLogout}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={isDark ? colors.textSecondary : '#fff'} size="small" />
            ) : (
              <Text style={styles.logoutBtnText}>Sign out</Text>
            )}
          </Pressable>
          <Pressable
            style={styles.deleteLink}
            onPress={handleOpenDeleteAccount}
            accessibilityRole="link"
            accessibilityLabel="Delete account on the website"
            hitSlop={8}
          >
            <Text style={styles.deleteLinkText}>Delete account</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
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
      backgroundColor: isDark ? c.background : c.textSecondary,
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? c.gridLine : 'transparent',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    logoutBtnText: {
      color: isDark ? c.textSecondary : '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    deleteLink: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    deleteLinkText: {
      fontSize: 13,
      color: '#c0392b',
      textDecorationLine: 'underline',
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
      backgroundColor: isDark ? c.background : c.accentBlue,
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? c.accentBlue : 'transparent',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
    },
    cloudBtnText: {
      color: isDark ? c.accentBlue : '#fff',
      fontWeight: '600',
      fontSize: 13,
    },
    cloudBtnOutline: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: c.accentBlue,
      backgroundColor: isDark ? c.background : undefined,
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
    totpInput: {
      borderWidth: 1.5,
      borderColor: c.gridLine,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      color: c.textPrimary,
      backgroundColor: isDark ? c.background : c.surface,
    },
  });
