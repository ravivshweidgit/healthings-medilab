/**
 * Guided setup: Samsung Health writes steps → Health Connect → Healthings reads.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { WellnessColors } from '../theme/wellness';
import { openSamsungHealthApp } from '../services/healthAppLinks';
import { healthConnectService, openHealthConnectSettings } from '../services/HealthConnectService';

type Props = {
  onPermissionGranted?: () => void;
};

export function HealthConnectStepsGuide({ onPermissionGranted }: Props) {
  const [stepsAllowed, setStepsAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const ok = await healthConnectService.hasStepsReadPermission();
    setStepsAllowed(ok);
    return ok;
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleAllowRead = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const ok = await healthConnectService.requestStepsPermission();
      setStepsAllowed(ok);
      if (ok) {
        setNote('Healthings can read steps from Health Connect.');
        onPermissionGranted?.();
      } else {
        setNote('Permission not granted — tap Open Health Connect and allow Steps for Healthings.');
      }
    } finally {
      setBusy(false);
    }
  }, [onPermissionGranted]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Activity from phone steps</Text>
      <Text style={styles.lead}>
        Two apps must be set up — most people only do the second and wonder why steps are zero.
      </Text>
      <Text style={styles.step}>1. Samsung Health → share Steps with Health Connect</Text>
      <Pressable style={styles.btn} onPress={() => void openSamsungHealthApp()}>
        <Text style={styles.btnText}>Open Samsung Health</Text>
      </Pressable>
      <Text style={styles.stepHint}>
        In Samsung Health: menu → Settings → Health Connect → allow Steps (wording may vary).
      </Text>

      <Text style={styles.step}>2. Health Connect → let Healthings read Steps</Text>
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
          <Text style={styles.btnText}>Allow Healthings to read steps</Text>
        )}
      </Pressable>

      {stepsAllowed === true ? (
        <Text style={styles.ok}>✓ Healthings has Steps permission</Text>
      ) : stepsAllowed === false ? (
        <Text style={styles.warn}>Steps permission not granted yet</Text>
      ) : null}
      {note ? <Text style={styles.note}>{note}</Text> : null}
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
