import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { loadAuthTokens } from './AuthTokenStore';

const BIOMETRIC_ENABLED_KEY = 'healthings_biometric_unlock';
const BIOMETRIC_PROMPT_SHOWN_KEY = 'healthings_biometric_prompt_shown';

export async function canUseBiometricUnlock(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) return false;
  return LocalAuthentication.isEnrolledAsync();
}

export async function biometricUnlockLabel(): Promise<string> {
  if (Platform.OS === 'ios') {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Touch ID';
    }
  }
  return 'Fingerprint';
}

export async function isBiometricUnlockEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)) === 'true';
}

export async function setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function wasBiometricPromptShown(): Promise<boolean> {
  return (await AsyncStorage.getItem(BIOMETRIC_PROMPT_SHOWN_KEY)) === 'true';
}

export async function markBiometricPromptShown(): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_PROMPT_SHOWN_KEY, 'true');
}

export async function needsBiometricUnlockOnLaunch(): Promise<boolean> {
  if (!(await isBiometricUnlockEnabled())) return false;
  const { accessToken, refreshToken } = await loadAuthTokens();
  return !!(accessToken || refreshToken);
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const label = await biometricUnlockLabel();
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: `Unlock Healthings with ${label}`,
    cancelLabel: 'Use email instead',
    disableDeviceFallback: false,
  });
  return result.success;
}
