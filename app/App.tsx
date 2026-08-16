import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, DeviceEventEmitter, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  authenticateWithBiometric,
  biometricUnlockLabel,
  canUseBiometricUnlock,
  markBiometricPromptShown,
  needsBiometricUnlockOnLaunch,
  setBiometricUnlockEnabled,
  wasBiometricPromptShown,
} from './src/services/BiometricUnlockService';
import { refreshAuthSession, restoreAuthSession, type AuthUser } from './src/services/AuthApiService';
import { AUTH_CLEARED_EVENT } from './src/services/AuthTokenStore';
import {
  CLINIC_SYNC_POLL_MS,
  fulfillPendingClinicSyncRequests,
} from './src/services/ClinicSyncService';
import { flushUsageQueueIfDue } from './src/services/UsageQueueService';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

/** Silent refresh on foreground — slides the 30-day refresh token without OTP. */
const SESSION_KEEPALIVE_MIN_MS = 6 * 60 * 60 * 1000;

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const { colors, isDark } = useTheme();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (await needsBiometricUnlockOnLaunch()) {
          const ok = await authenticateWithBiometric();
          if (!ok) {
            if (!cancelled) setUser(null);
            return;
          }
        }

        const restored = await restoreAuthSession();
        if (!cancelled) setUser(restored);
      } catch (err) {
        if (__DEV__) console.warn('[boot] restore failed', err);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const offerBiometricUnlock = useCallback(async () => {
    if (!(await canUseBiometricUnlock()) || (await wasBiometricPromptShown())) return;

    await markBiometricPromptShown();
    const label = await biometricUnlockLabel();
    Alert.alert(
      `Unlock with ${label}?`,
      `Use ${label.toLowerCase()} to open Healthings next time. Change anytime in Account.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            void (async () => {
              const ok = await authenticateWithBiometric();
              if (ok) await setBiometricUnlockEnabled(true);
            })();
          },
        },
      ],
    );
  }, []);

  const handleSignedIn = useCallback(
    (signedInUser: AuthUser) => {
      if (signedInUser.role !== 'patient') {
        setUser(null);
        return;
      }
      setUser(signedInUser);
      void offerBiometricUnlock();
    },
    [offerBiometricUnlock],
  );

  const handleSignedOut = useCallback(() => {
    setUser(null);
  }, []);

  // Tokens wiped after failed refresh (401/403) — leave dashboard and show login.
  // Without this, in-memory `user` stays set and AI/clinic calls fail with generic errors.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_CLEARED_EVENT, () => {
      setUser(null);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'patient') return;

    let lastKeepaliveAt = 0;
    const keepaliveSession = () => {
      const now = Date.now();
      if (now - lastKeepaliveAt < SESSION_KEEPALIVE_MIN_MS) return;
      lastKeepaliveAt = now;
      // Rotates refresh → new 30-day expiry. Network blips do not wipe tokens.
      void refreshAuthSession();
    };

    void fulfillPendingClinicSyncRequests();
    void flushUsageQueueIfDue();
    keepaliveSession();

    const onActive = (state: string) => {
      if (state === 'active') {
        void fulfillPendingClinicSyncRequests();
        void flushUsageQueueIfDue();
        keepaliveSession();
      }
    };
    const appStateSub = AppState.addEventListener('change', onActive);
    const pollTimer = setInterval(() => {
      void fulfillPendingClinicSyncRequests();
    }, CLINIC_SYNC_POLL_MS);

    return () => {
      appStateSub.remove();
      clearInterval(pollTimer);
    };
  }, [user]);

  return (
    <>
      {booting ? (
        <View style={[styles.boot, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.accentGreen} />
        </View>
      ) : user ? (
        <DashboardScreen user={user} onSignedOut={handleSignedOut} />
      ) : (
        <LoginScreen onSignedIn={handleSignedIn} />
      )}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
