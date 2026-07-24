/**
 * Required sign-in — email OTP before dashboard.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  checkApiHealth,
  requestOtp,
  verifyOtp,
  type AuthUser,
  type UserRole,
} from '../services/AuthApiService';
import { cardShadow } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

const BRAND_LOGO = require('../../assets/brand-logo.png');
const BRAND_LOGO_DARK = require('../../assets/brand-logo-dark.png');
const OTP_PENDING_KEY = 'healthings_otp_pending';

type Props = {
  onSignedIn: (user: AuthUser) => void;
};

type Step = 'email' | 'code';

export function LoginScreen({ onSignedIn }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    void checkApiHealth().then(setApiOk);
    void (async () => {
      const pending = await AsyncStorage.getItem(OTP_PENDING_KEY);
      if (pending) {
        setEmail(pending);
        setStep('code');
      }
    })();
  }, []);

  const scrollToInputs = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      scrollToInputs,
    );
    return () => sub.remove();
  }, [scrollToInputs]);

  useEffect(() => {
    if (step === 'code') {
      scrollToInputs();
    }
  }, [step, scrollToInputs]);

  const handleSendCode = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setBusy(true);
    try {
      await requestOtp(trimmed, role);
      await AsyncStorage.setItem(OTP_PENDING_KEY, trimmed);
      setStep('code');
      setCode('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send code');
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
      const user = await verifyOtp(trimmedEmail, trimmedCode);
      await AsyncStorage.removeItem(OTP_PENDING_KEY);
      onSignedIn(user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setBusy(false);
    }
  }, [code, email, onSignedIn]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={isDark ? BRAND_LOGO_DARK : BRAND_LOGO}
            style={[styles.logo, step === 'code' && styles.logoCompact]}
            resizeMode="contain"
            accessibilityLabel="HEALTHINGS.AI"
          />

          <View style={[styles.card, cardShadow]}>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>
              Free registration · email + one-time code · no password
            </Text>

            {apiOk === false ? (
              <Text style={styles.warnText}>
                Cannot reach the API server — check your connection and try again.
              </Text>
            ) : null}

            {step === 'email' ? (
              <>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={scrollToInputs}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                />
                <Text style={styles.roleLabel}>I am a</Text>
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
                      Mentor / clinic
                    </Text>
                  </Pressable>
                </View>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  style={[styles.primaryBtn, (!email.trim() || busy) && styles.btnDisabled]}
                  onPress={handleSendCode}
                  disabled={!email.trim() || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send code</Text>
                  )}
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.codeHint}>
                  Code sent to {email.trim()}. Check inbox and spam — or server logs if SMTP
                  is not enabled yet.
                </Text>
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  onFocus={scrollToInputs}
                  placeholder="123456"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!busy}
                  autoFocus
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Pressable
                  style={[styles.primaryBtn, (code.length !== 6 || busy) && styles.btnDisabled]}
                  onPress={handleVerify}
                  disabled={code.length !== 6 || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & continue</Text>
                  )}
                </Pressable>
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => {
                    void AsyncStorage.removeItem(OTP_PENDING_KEY);
                    setStep('email');
                    setCode('');
                    setError(null);
                  }}
                  disabled={busy}
                >
                  <Text style={styles.secondaryBtnText}>Change email</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logo: {
    width: '100%',
    height: 120,
    marginBottom: 24,
  },
  logoCompact: {
    height: 64,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: c.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  warnText: {
    fontSize: 13,
    color: '#b45309',
  },
  roleLabel: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: c.textPrimary,
    backgroundColor: c.background,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.gridLine,
  },
  roleChipOn: {
    backgroundColor: c.accentGreen,
    borderColor: c.accentGreen,
  },
  roleChipText: {
    fontSize: 14,
    color: c.textSecondary,
  },
  roleChipTextOn: {
    color: '#fff',
    fontWeight: '600',
  },
  codeHint: {
    fontSize: 14,
    color: c.textSecondary,
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: c.accentGreen,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: c.accentBlue,
    fontSize: 15,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 13,
    color: '#c0392b',
  },
});
