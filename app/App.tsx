import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, AppState, StyleSheet, View } from 'react-native';
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
import { restoreAuthSession, type AuthUser } from './src/services/AuthApiService';
import {
  CLINIC_SYNC_POLL_MS,
  fulfillPendingClinicSyncRequests,
} from './src/services/ClinicSyncService';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WellnessColors } from './src/theme/wellness';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
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
      setUser(signedInUser);
      void offerBiometricUnlock();
    },
    [offerBiometricUnlock],
  );

  const handleSignedOut = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'patient') return;

    void fulfillPendingClinicSyncRequests();

    const onActive = (state: string) => {
      if (state === 'active') void fulfillPendingClinicSyncRequests();
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
    <SafeAreaProvider>
      {booting ? (
        <View style={styles.boot}>
          <ActivityIndicator size="large" color={WellnessColors.accentGreen} />
        </View>
      ) : user ? (
        <DashboardScreen user={user} onSignedOut={handleSignedOut} />
      ) : (
        <LoginScreen onSignedIn={handleSignedIn} />
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WellnessColors.background,
  },
});
