/**
 * Thin strip when Withings watch is off: allow phone health (HC / Apple Health) + help link.
 * Brand recipes (Garmin, Samsung, …) live on the help site — not in-app.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import {
  healthConnectService,
  openHealthConnectPlayStore,
  openHealthConnectSettings,
} from '../services/HealthConnectService';
import { healthKitService } from '../services/HealthKitService';
import {
  formatHealthConnectDiagnostics,
  gatherHealthConnectDiagnostics,
  persistHealthConnectDiagnostics,
} from '../services/healthConnectDiagnostics';

const HELP_URL = 'https://healthings.ai/en/help/phone-health-activity.html';

type GrantedLine = {
  steps: boolean;
  exercise: boolean;
  activeCal: boolean;
  heartRate: boolean;
  glucose: boolean;
};

type Props = {
  /** After Allow succeeds — shallow phone-health sync (~2 days). */
  onPermissionGranted?: () => void;
  /** Normal (false) or deep (true) phone-health sync — same idea as Withings. */
  onSync?: (deep: boolean) => void;
};

function tick(ok: boolean): string {
  return ok ? '✓' : '✗';
}

export function PhoneHealthActivityStrip({ onPermissionGranted, onSync }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isIos = Platform.OS === 'ios';
  const storeName = isIos ? 'Apple Health' : 'Health Connect';
  const [granted, setGranted] = useState<GrantedLine | null>(null);
  const [withingsHcStatus, setWithingsHcStatus] = useState<string | null>(null);
  const [withingsHcOn, setWithingsHcOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (isIos) {
      const [ok, withingsStatus] = await Promise.all([
        healthKitService.hasActivityReadPermission(),
        healthKitService.detectWithingsAppleHealthWriteStatus(),
      ]);
      setGranted({
        steps: ok,
        exercise: false,
        activeCal: ok,
        heartRate: ok,
        glucose: false,
      });
      setWithingsHcStatus(withingsStatus.label);
      setWithingsHcOn(withingsStatus.inferred === 'likely_on');
      return ok;
    }
    const [perms, withingsStatus] = await Promise.all([
      healthConnectService.listGrantedPermissions(),
      healthConnectService.detectWithingsHcWriteStatus(),
    ]);
    const line: GrantedLine = {
      steps: perms.some((p) => p.accessType === 'read' && p.recordType === 'Steps'),
      exercise: perms.some((p) => p.accessType === 'read' && p.recordType === 'ExerciseSession'),
      activeCal: perms.some((p) => p.accessType === 'read' && p.recordType === 'ActiveCaloriesBurned'),
      heartRate: perms.some((p) => p.accessType === 'read' && p.recordType === 'HeartRate'),
      glucose: perms.some((p) => p.accessType === 'read' && p.recordType === 'BloodGlucose'),
    };
    setGranted(line);
    setWithingsHcStatus(withingsStatus.label);
    setWithingsHcOn(withingsStatus.inferred === 'likely_on');
    return line.steps;
  }, [isIos]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleAllowRead = useCallback(async () => {
    setBusy(true);
    try {
      if (isIos) {
        const ok = await healthKitService.requestActivityPermissions();
        await refreshStatus();
        if (ok) {
          Alert.alert('Apple Health', 'Steps and heart rate access is on. Syncing…');
          onPermissionGranted?.();
        } else {
          const msg =
            'Permission not granted — open Settings → Health → Data Access → Healthings and allow Steps and Heart Rate.';
          Alert.alert('Apple Health', msg, [
            { text: 'Close', style: 'cancel' },
            { text: 'Open Health', onPress: () => void Linking.openURL('x-apple-health://') },
          ]);
        }
        return;
      }

      // Direct user tap — required for Android Health Connect permission sheet.
      const detail = await healthConnectService.requestActivityPermissionsWithDetail();
      await refreshStatus();
      if (detail.ok) {
        Alert.alert('Health Connect', detail.message);
        onPermissionGranted?.();
        return;
      }
      const buttons: Array<{ text: string; style?: 'cancel'; onPress?: () => void }> = [
        { text: 'Close', style: 'cancel' },
      ];
      if (detail.installOrUpdate) {
        buttons.push({
          text: 'Play Store',
          onPress: () => void openHealthConnectPlayStore(),
        });
      }
      if (detail.openSettings || !detail.installOrUpdate) {
        buttons.push({
          text: 'Open Health Connect',
          onPress: () => openHealthConnectSettings(),
        });
      }
      Alert.alert('Health Connect', detail.message, buttons);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not request permissions.';
      await refreshStatus();
      Alert.alert('Health Connect', msg, [
        { text: 'Close', style: 'cancel' },
        { text: 'Open Health Connect', onPress: () => openHealthConnectSettings() },
      ]);
    } finally {
      setBusy(false);
    }
  }, [isIos, onPermissionGranted, refreshStatus]);

  const handleDeepSync = useCallback(async () => {
    setSyncBusy(true);
    try {
      onSync?.(true);
    } finally {
      setSyncBusy(false);
    }
  }, [onSync]);

  const handleOpenSettings = useCallback(() => {
    if (isIos) {
      void Linking.openURL('x-apple-health://').catch(() => {
        void Linking.openURL('App-Prefs:HEALTH');
      });
      return;
    }
    openHealthConnectSettings();
  }, [isIos]);

  const handleDiagnostics = useCallback(async () => {
    if (isIos) {
      Alert.alert(
        'Apple Health',
        'Use Settings → Health → Data Access & Devices → Healthings to confirm Steps and Heart Rate are on. Help: healthings.ai/en/help/phone-health-activity.html',
      );
      return;
    }
    setDiagBusy(true);
    try {
      const diag = await gatherHealthConnectDiagnostics();
      await persistHealthConnectDiagnostics(diag);
      await refreshStatus();
      Alert.alert('Health Connect diagnostics', formatHealthConnectDiagnostics(diag), [
        { text: 'Close' },
      ]);
    } catch {
      Alert.alert('Health Connect diagnostics', 'Could not read Health Connect right now.');
    } finally {
      setDiagBusy(false);
    }
  }, [isIos, refreshStatus]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity from {storeName}</Text>
      <Text style={styles.lead}>
        Watch Off → Healthings reads steps/HR from {storeName} (read only). Allow access asks for
        read permissions, then syncs recent days. Use Deep sync for ~31 days. If the permission sheet
        does not appear, Open {storeName} → App permissions → Healthings → Steps.
      </Text>

      <Text style={styles.advisory}>
        Healthings does not recommend letting the Withings app write to {storeName}. Withings in
        Healthings is cloud/API only — Withings→{storeName} write can double-count steps with
        Samsung or Garmin.
      </Text>

      {withingsHcStatus ? (
        <Text style={withingsHcOn ? styles.warnStrong : styles.statusOk}>{withingsHcStatus}</Text>
      ) : null}

      {granted ? (
        <Text style={styles.permLine}>
          {`Healthings reads now: Steps ${tick(granted.steps)}  Exercise ${tick(granted.exercise)}  Active cal ${tick(granted.activeCal)}  HR ${tick(granted.heartRate)}`}
        </Text>
      ) : null}

      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void handleAllowRead()}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Allow Healthings to read activity from ${storeName}`}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Allow access (permission sheet)</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.btnSecondary}
        onPress={() => {
          handleOpenSettings();
          setTimeout(() => void refreshStatus(), 2500);
        }}
      >
        <Text style={styles.btnSecondaryText}>Open {storeName} (manual)</Text>
      </Pressable>

      <Pressable
        style={[styles.btnSecondary, syncBusy && styles.btnDisabled]}
        onPress={() => void handleDeepSync()}
        disabled={syncBusy || busy}
        accessibilityRole="button"
        accessibilityLabel={`Deep sync activity from ${storeName}`}
      >
        {syncBusy ? (
          <ActivityIndicator color={colors.accentBlue} size="small" />
        ) : (
          <Text style={styles.btnSecondaryText}>Deep sync (~31 days)</Text>
        )}
      </Pressable>

      <Pressable style={styles.linkBtn} onPress={() => void Linking.openURL(HELP_URL)} hitSlop={8}>
        <Text style={styles.linkText}>How to get steps &amp; heart rate into {storeName}</Text>
      </Pressable>

      <Pressable
        style={styles.troubleBtn}
        onPress={() => void handleDiagnostics()}
        disabled={diagBusy}
        hitSlop={8}
      >
        {diagBusy ? (
          <ActivityIndicator color={colors.textSecondary} size="small" />
        ) : (
          <Text style={styles.troubleText}>Troubleshoot (full permission + data check)</Text>
        )}
      </Pressable>
    </View>
  );
}

/** @deprecated Use PhoneHealthActivityStrip */
export const HealthConnectStepsGuide = PhoneHealthActivityStrip;

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.noticeSoftBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.noticeSoftBorder,
      padding: 14,
      marginBottom: 14,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 6,
    },
    lead: {
      fontSize: 12,
      lineHeight: 18,
      color: c.textSecondary,
      marginBottom: 8,
    },
    advisory: {
      fontSize: 12,
      lineHeight: 17,
      color: c.textSecondary,
      marginBottom: 8,
    },
    warnStrong: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      color: '#8A5A00',
      backgroundColor: '#FFF6E0',
      borderRadius: 8,
      padding: 10,
      marginBottom: 10,
    },
    statusOk: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      color: '#2E7D5A',
      marginBottom: 10,
    },
    permLine: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '600',
      color: c.textPrimary,
      marginBottom: 10,
    },
    btn: {
      backgroundColor: '#2E7D5A',
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 6,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnSecondary: {
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      marginBottom: 6,
      borderWidth: 1,
      borderColor: c.accentBlue,
      backgroundColor: c.surface,
    },
    btnSecondaryText: { color: c.accentBlue, fontWeight: '700', fontSize: 14 },
    linkBtn: { paddingVertical: 6, marginBottom: 4 },
    linkText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.accentBlue,
      textAlign: 'center',
    },
    troubleBtn: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 4 },
    troubleText: { fontSize: 11, color: c.textSecondary, fontWeight: '600' },
  });
