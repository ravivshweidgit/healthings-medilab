import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountShare } from './ShareApiService';

const APPROVED_KEY = 'healthings:approved_shares_cache';

export async function loadCachedApprovedShares(): Promise<AccountShare[]> {
  const raw = await AsyncStorage.getItem(APPROVED_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AccountShare[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCachedApprovedShares(shares: AccountShare[]): Promise<void> {
  await AsyncStorage.setItem(APPROVED_KEY, JSON.stringify(shares));
}

export async function clearCachedApprovedShares(): Promise<void> {
  await AsyncStorage.removeItem(APPROVED_KEY);
}
