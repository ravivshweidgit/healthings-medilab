/**
 * Guided setup: watch apps write activity → Health Connect → Healthings reads.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WellnessColors } from '../theme/wellness';
import { openGarminConnectApp, openSamsungHealthApp } from '../services/healthAppLinks';
import { healthConnectService, openHealthConnectSettings } from '../services/HealthConnectService';
import {
  formatHealthConnectDiagnostics,
  gatherHealthConnectDiagnostics,
  persistHealthConnectDiagnostics,
} from '../services/healthConnectDiagnostics';

type Props = {
  onPermissionGranted?: () => void;
};

export function HealthConnectStepsGuide({ onPermissionGranted }: Props) {
  const [activityAllowed, setActivityAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const ok = await healthConnectService.hasActivityReadPermission();
    setActivityAllowed(ok);
    return ok;
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleAllowRead = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const ok = await healthConnectService.requestActivityPermissions();
      setActivityAllowed(ok);
      if (ok) {
        setNote('Healthings can read workouts, calories, and heart rate from Health Connect.');
        onPermissionGranted?.();
      } else {
        setNote(
          'Permission not granted — tap Open Health Connect and allow Exercise, Active calories, Steps, and Heart rate for Healthings.',
        );
      }
    } finally {
      setBusy(false);
    }
  }, [onPermissionGranted]);

  const handleDiagnostics = useCallback(async () => {
    setDiagBusy(true);
    try {
      const diag = await gatherHealthConnectDiagnostics();
      await persistHealthConnectDiagnostics(diag);
      Alert.alert('Health Connect diagnostics', formatHealthConnectDiagnostics(diag), [
        { text: 'Close' },
      ]);
    } catch {
      Alert.alert('Health Connect diagnostics', 'Could not read Health Connect right now.');
    } finally {
      setDiagBusy(false);
    }
  }, []);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity from Health Connect</Text>
      <Text style={styles.lead}>
        Your watch app must share with Health Connect first — then Healthings can read named workouts,
        active calories, and heart rate (Garmin, Samsung, Pixel, etc.).
      </Text>

      <Text style={styles.step}>1a. Garmin Connect → share with Health Connect</Text>
      <Pressable style={styles.btn} onPress={() => void openGarminConnectApp()}>
        <Text style={styles.btnText}>Open Garmin Connect</Text>
      </Pressable>
      <Text style={styles.stepHint}>
        In Garmin Connect: Settings → Health Connect → enable activities, steps, calories, and heart rate.
      </Text>

      <Text style={styles.step}>1b. Samsung Health → share Steps with Health Connect (Samsung phones)</Text>
      <Pressable style={styles.btnSecondary} onPress={() => void openSamsungHealthApp()}>
        <Text style={styles.btnSecondaryText}>Open Samsung Health</Text>
      </Pressable>
      <Text style={styles.stepHint}>
        In Samsung Health: menu → Settings → Health Connect → allow Steps and workouts.
      </Text>

      <Text style={styles.step}>2. Health Connect → let Healthings read activity</Text>
      <Pressable style={styles.btnSecondary} onPress={() => openHealthConnectSettings()}>
        <Text style={styles.btnSecondaryText}>Open Health Connect</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, busy && styles.btnDisabled]}
        onPress={() => void handleAllowRead()}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>Allow Healthings to read activity</Text>
        )}
      </Pressable>

      {activityAllowed === true ? (
        <Text style={styles.ok}>✓ Healthings has activity permissions</Text>
      ) : activityAllowed === false ? (
        <Text style={styles.warn}>Activity permissions not granted yet</Text>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}

      <Text style={styles.step}>Troubleshooting</Text>
      <Pressable
        style={[styles.btnSecondary, diagBusy && styles.btnDisabled]}
        onPress={() => void handleDiagnostics()}
        disabled={diagBusy}
      >
        {diagBusy ? (
          <ActivityIndicator color={WellnessColors.accentBlue} size="small" />
        ) : (
          <Text style={styles.btnSecondaryText}>Run activity diagnostics</Text>
        )}
      </Pressable>
      <Text style={styles.stepHint}>
        Shows what Healthings reads from Health Connect (permissions, record counts, last 7 days of
        steps / active calories). Screenshot it for support — it is also saved to your cloud backup.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    padding: 14,
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 6,
  },
  lead: {
    fontSize: 12,
    lineHeight: 18,
    color: WellnessColors.textSecondary,
    marginBottom: 10,
  },
  step: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 8,
    marginBottom: 6,
  },
  stepHint: {
    fontSize: 11,
    lineHeight: 16,
    color: WellnessColors.textSecondary,
    marginBottom: 4,
  },
  btn: {
    backgroundColor: '#2E7D5A',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnSecondary: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: WellnessColors.accentBlue,
    backgroundColor: WellnessColors.surface,
  },
  btnSecondaryText: { color: WellnessColors.accentBlue, fontWeight: '700', fontSize: 14 },
  ok: { fontSize: 12, color: '#2E7D5A', fontWeight: '600', marginTop: 10 },
  warn: { fontSize: 12, color: WellnessColors.textSecondary, marginTop: 10 },
  note: { fontSize: 12, lineHeight: 17, color: WellnessColors.textPrimary, marginTop: 6 },
});
