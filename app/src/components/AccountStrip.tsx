/**
 * Signed-in account — email, role, biometric unlock, sign out.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { WellnessColors } from '../theme/wellness';

type Props = {
  user: AuthUser;
  expanded: boolean;
  onToggleExpand: () => void;
  onSignedOut: () => void;
};

export function AccountStrip({ user, expanded, onToggleExpand, onSignedOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Fingerprint');

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
  }, [expanded]);

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
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>👤</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Account</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {user.email}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

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
                trackColor={{ false: WellnessColors.gridLine, true: WellnessColors.accentGreen }}
                thumbColor="#fff"
              />
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

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
  },
  headerSub: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
  },
  body: {
    marginTop: 12,
    gap: 8,
  },
  signedInLine: {
    fontSize: 15,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
  },
  roleLine: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
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
    color: WellnessColors.textPrimary,
  },
  biometricHint: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    alignSelf: 'flex-start',
    backgroundColor: WellnessColors.textSecondary,
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
});
