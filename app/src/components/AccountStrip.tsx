/**
 * Healthings account — email OTP sign-in (optional; app works offline without it).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  checkApiHealth,
  logoutAuth,
  requestOtp,
  restoreAuthSession,
  verifyOtp,
  type AuthUser,
  type UserRole,
} from '../services/AuthApiService';
import { WellnessColors } from '../theme/wellness';

type Props = {
  expanded: boolean;
  onToggleExpand: () => void;
  onAuthChanged?: (user: AuthUser | null) => void;
};

type Step = 'signed-out' | 'code-sent' | 'signed-in';

export function AccountStrip({ expanded, onToggleExpand, onAuthChanged }: Props) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [step, setStep] = useState<Step>('signed-out');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const applyUser = useCallback(
    (next: AuthUser | null) => {
      setUser(next);
      setStep(next ? 'signed-in' : 'signed-out');
      onAuthChanged?.(next);
    },
    [onAuthChanged],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [restored, healthy] = await Promise.all([restoreAuthSession(), checkApiHealth()]);
      if (cancelled) return;
      setApiOk(healthy);
      if (restored) {
        applyUser(restored);
        setEmail(restored.email);
      }
      setBooting(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const headerSub = booting
    ? 'Checking…'
    : user
      ? user.email
      : 'Optional — sign in to sync later';

  const handleSendCode = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      await requestOtp(trimmed, role);
      setStep('code-sent');
      setCode('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not send code';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [email, role]);

  const handleVerify = useCallback(async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();
    if (!trimmedEmail || trimmedCode.length !== 6) return;
    setError(null);
    setBusy(true);
    try {
      const next = await verifyOtp(trimmedEmail, trimmedCode);
      applyUser(next);
      setCode('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid code';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [applyUser, code, email]);

  const handleLogout = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await logoutAuth();
      applyUser(null);
      setStep('signed-out');
      setCode('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Logout failed';
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [applyUser]);

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.headerRow} onPress={onToggleExpand}>
        <Text style={styles.headerIcon}>👤</Text>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Account</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {headerSub}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '⌃' : '›'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {booting ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={WellnessColors.accentGreen} />
            </View>
          ) : user ? (
            <View>
              <Text style={styles.signedInLine}>{user.email}</Text>
              <Text style={styles.roleLine}>Role: {user.role}</Text>
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
          ) : (
            <View>
              <Text style={styles.hint}>
                Email + one-time code. No password. You can skip and keep using the app locally.
              </Text>
              {apiOk === false ? (
                <Text style={styles.warnText}>Cannot reach server — check connection and try again.</Text>
              ) : null}
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={WellnessColors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy && step !== 'code-sent'}
              />
              {step === 'signed-out' && (
                <View style={styles.roleRow}>
                  <Pressable
                    style={[styles.roleChip, role === 'patient' && styles.roleChipOn]}
                    onPress={() => setRole('patient')}
                  >
                    <Text style={[styles.roleChipText, role === 'patient' && styles.roleChipTextOn]}>
                      Patient
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleChip, role === 'mentor' && styles.roleChipOn]}
                    onPress={() => setRole('mentor')}
                  >
                    <Text style={[styles.roleChipText, role === 'mentor' && styles.roleChipTextOn]}>
                      Mentor
                    </Text>
                  </Pressable>
                </View>
              )}
              {step === 'code-sent' && (
                <>
                  <Text style={styles.codeHint}>Enter the 6-digit code from your email.</Text>
                  <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor={WellnessColors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!busy}
                  />
                </>
              )}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.btnsRow}>
                {step === 'signed-out' ? (
                  <Pressable
                    style={[styles.primaryBtn, (!email.trim() || busy) && styles.btnDisabled]}
                    onPress={handleSendCode}
                    disabled={!email.trim() || busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send code</Text>
                    )}
                  </Pressable>
                ) : (
                  <Pressable
                    style={[styles.primaryBtn, (code.length !== 6 || busy) && styles.btnDisabled]}
                    onPress={handleVerify}
                    disabled={code.length !== 6 || busy}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Verify & sign in</Text>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    if (step === 'code-sent') {
                      setStep('signed-out');
                      setCode('');
                      setError(null);
                    } else {
                      onToggleExpand();
                    }
                  }}
                  disabled={busy}
                >
                  <Text style={styles.secondaryBtnText}>
                    {step === 'code-sent' ? 'Change email' : 'Skip for now'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
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
  hint: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    lineHeight: 18,
  },
  warnText: {
    fontSize: 13,
    color: '#b45309',
  },
  input: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: WellnessColors.textPrimary,
    backgroundColor: '#fff',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  roleChipOn: {
    backgroundColor: WellnessColors.accentGreen,
    borderColor: WellnessColors.accentGreen,
  },
  roleChipText: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
  roleChipTextOn: {
    color: '#fff',
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
  },
  btnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: WellnessColors.accentGreen,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: WellnessColors.accentBlue,
    fontSize: 14,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  signedInLine: {
    fontSize: 15,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
  },
  roleLine: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    marginTop: 4,
    marginBottom: 10,
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
  errorText: {
    fontSize: 13,
    color: '#c0392b',
  },
  loadingWrap: {
    paddingVertical: 12,
    alignItems: 'center',
  },
});
