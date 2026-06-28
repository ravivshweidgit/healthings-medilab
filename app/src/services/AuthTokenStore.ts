import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Android SecureStore keys may only use [a-zA-Z0-9._-]. */
const ACCESS_KEY = 'healthings_access_token';
const REFRESH_KEY = 'healthings_refresh_token';

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function loadAuthTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [accessToken, refreshToken] = await Promise.all([secureGet(ACCESS_KEY), secureGet(REFRESH_KEY)]);
  return { accessToken, refreshToken };
}

export async function saveAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([secureSet(ACCESS_KEY, accessToken), secureSet(REFRESH_KEY, refreshToken)]);
}

export async function clearAuthTokens(): Promise<void> {
  await Promise.all([secureDelete(ACCESS_KEY), secureDelete(REFRESH_KEY)]);
}
