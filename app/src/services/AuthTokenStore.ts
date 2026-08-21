import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter, Platform } from 'react-native';
import type { AuthUser } from './AuthApiService';

/** Android SecureStore keys may only use [a-zA-Z0-9._-]. */
const ACCESS_KEY = 'healthings_access_token';
const REFRESH_KEY = 'healthings_refresh_token';
/** Last successful /me user — offline boot when API unreachable. */
const CACHED_USER_KEY = 'healthings_auth_user_v1';
/** Survives token wipe so Sign in can prefill after a real session expiry. */
const LAST_SIGN_IN_EMAIL_KEY = 'healthings_last_email';

/** Fired after tokens + cached user are wiped (401 / logout). Dashboard must close Quick Start. */
export const AUTH_CLEARED_EVENT = 'healthings:authCleared';

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

export async function persistLastSignInEmail(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed.includes('@')) return;
  await AsyncStorage.setItem(LAST_SIGN_IN_EMAIL_KEY, trimmed);
}

export async function loadLastSignInEmail(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(LAST_SIGN_IN_EMAIL_KEY);
  const trimmed = raw?.trim() ?? '';
  return trimmed.includes('@') ? trimmed : null;
}

function emailFromAccessToken(accessToken: string | null): string | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const payload = JSON.parse(globalThis.atob(b64 + pad)) as { email?: string };
    const email = String(payload.email ?? '').trim().toLowerCase();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

export async function clearAuthTokens(reason = 'unspecified'): Promise<void> {
  const cached = await loadCachedAuthUser();
  const { accessToken } = await loadAuthTokens();
  const email = cached?.email ?? emailFromAccessToken(accessToken);
  if (email) await persistLastSignInEmail(email);
  await Promise.all([
    secureDelete(ACCESS_KEY),
    secureDelete(REFRESH_KEY),
    AsyncStorage.removeItem(CACHED_USER_KEY),
  ]);
  DeviceEventEmitter.emit(AUTH_CLEARED_EVENT);
  void import('./AppDailyLogService')
    .then(({ appLog }) => {
      appLog('WARN', 'auth', { tokens_cleared: 1, reason: String(reason).slice(0, 48) });
    })
    .catch(() => undefined);
}

export async function hasAuthSession(): Promise<boolean> {
  const { accessToken, refreshToken } = await loadAuthTokens();
  return Boolean(accessToken || refreshToken);
}

export async function saveCachedAuthUser(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
  if (user.email) await persistLastSignInEmail(user.email);
}

export async function loadCachedAuthUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.id || !parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}
