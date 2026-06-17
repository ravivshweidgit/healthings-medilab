import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { mergeCgmSessionStarts, mergeGlucoseTimePoints, type CachedHealthMetrics } from './healthMetricsCache';
import { loadWithingsTokens, saveWithingsTokens, type WithingsOAuthTokens } from './WithingsApiService';

const BACKUP_APP = 'healthings-medilab';
const BACKUP_VERSION = 1;
const FOOD_DAY_INDEX_KEY = 'food_log_days';
const CGM_KEY = 'healthings:lastMetrics';

const EXCLUDED_ASYNC_KEYS = new Set<string>([
  'healthings:unhandledErrorLog',
  'healthings:debugDownloadsDirUri',
  'healthings:persistedHealth',
  'last_day_close_date',
  'coach_last_weigh_in_at',
  'coach_last_workout_start_ms',
]);

type LocalBackupPayload = {
  version: 1;
  app: 'healthings-medilab';
  exportedAt: string;
  asyncStorage: Record<string, string>;
  withingsTokens: WithingsOAuthTokens | null;
};

export type LocalBackupImportResult = {
  keysRestored: number;
  mealsAdded: number;
  chatMessagesAdded: number;
  glucosePointsMerged: number;
  tokensRestored: boolean;
};

type ChatMessage = { role: string; text: string; sentAt: string };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isFoodDayKey(key: string): boolean {
  return /^food_log_\d{4}-\d{2}-\d{2}$/.test(key);
}

function isChatHistoryKey(key: string): boolean {
  return /^chat_history_\d{4}-\d{2}-\d{2}(?:_(doctor|nutritionist|coach))?$/.test(key);
}

function mergeFoodDay(existingRaw: string | null, incomingRaw: string): { raw: string; mealsAdded: number } {
  const existing = existingRaw ? (JSON.parse(existingRaw) as Array<{ id: string; timestamp: number }>) : [];
  const incoming = JSON.parse(incomingRaw) as Array<{ id: string; timestamp: number }>;
  const map = new Map<string, { id: string; timestamp: number }>();
  for (const row of existing) map.set(row.id, row);
  let added = 0;
  for (const row of incoming) {
    if (!map.has(row.id)) added += 1;
    map.set(row.id, row);
  }
  const merged = [...map.values()].sort((a, b) => a.timestamp - b.timestamp);
  return { raw: JSON.stringify(merged), mealsAdded: added };
}

function mergeChatHistory(existingRaw: string | null, incomingRaw: string): { raw: string; added: number } {
  const existing = existingRaw ? (JSON.parse(existingRaw) as ChatMessage[]) : [];
  const incoming = JSON.parse(incomingRaw) as ChatMessage[];
  const keyOf = (m: ChatMessage) => `${m.sentAt}|${m.role}|${m.text}`;
  const map = new Map<string, ChatMessage>();
  for (const m of existing) map.set(keyOf(m), m);
  let added = 0;
  for (const m of incoming) {
    const k = keyOf(m);
    if (!map.has(k)) added += 1;
    map.set(k, m);
  }
  const merged = [...map.values()].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  return { raw: JSON.stringify(merged), added };
}

function mergeCgm(existingRaw: string | null, incomingRaw: string): { raw: string; glucoseAdded: number } {
  const existing = existingRaw ? (JSON.parse(existingRaw) as CachedHealthMetrics) : { glucose: [] };
  const incoming = JSON.parse(incomingRaw) as CachedHealthMetrics;
  const mergedGlucose = mergeGlucoseTimePoints([existing.glucose ?? [], incoming.glucose ?? []]);
  const glucoseAdded = Math.max(0, mergedGlucose.length - (existing.glucose?.length ?? 0));
  const merged: CachedHealthMetrics = {
    ...(existing ?? {}),
    ...(incoming ?? {}),
    glucose: mergedGlucose,
    cgmSessionStarts: mergeCgmSessionStarts(existing.cgmSessionStarts, incoming.cgmSessionStarts),
  };
  return { raw: JSON.stringify(merged), glucoseAdded };
}

function validateBackupPayload(raw: string): LocalBackupPayload {
  const payload = JSON.parse(raw) as Partial<LocalBackupPayload>;
  if (payload.version !== BACKUP_VERSION || payload.app !== BACKUP_APP || !payload.asyncStorage) {
    throw new Error('Invalid backup file format.');
  }
  return payload as LocalBackupPayload;
}

async function refreshFoodDayIndex(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const dayKeys = allKeys
    .filter((k) => isFoodDayKey(k))
    .map((k) => k.replace('food_log_', ''))
    .sort();
  await AsyncStorage.setItem(FOOD_DAY_INDEX_KEY, JSON.stringify(dayKeys));
}

export async function exportLocalBackup(): Promise<void> {
  const allKeys = await AsyncStorage.getAllKeys();
  const exportKeys = allKeys.filter((k) => !EXCLUDED_ASYNC_KEYS.has(k));
  const pairs = await AsyncStorage.multiGet(exportKeys);
  const asyncStorage: Record<string, string> = {};
  for (const [key, value] of pairs) {
    if (value != null) asyncStorage[key] = value;
  }

  const payload: LocalBackupPayload = {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    asyncStorage,
    withingsTokens: await loadWithingsTokens(),
  };

  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return;

  const filename = `healthings-backup_${todayKey()}.json`;
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    'application/json',
  );
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), { encoding: 'utf8' });
}

export async function importLocalBackup(): Promise<LocalBackupImportResult> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (pick.canceled) {
    return { keysRestored: 0, mealsAdded: 0, chatMessagesAdded: 0, glucosePointsMerged: 0, tokensRestored: false };
  }

  const raw = await FileSystem.readAsStringAsync(pick.assets[0].uri, { encoding: 'utf8' });
  const payload = validateBackupPayload(raw);

  let keysRestored = 0;
  let mealsAdded = 0;
  let chatMessagesAdded = 0;
  let glucosePointsMerged = 0;

  for (const [key, incomingRaw] of Object.entries(payload.asyncStorage)) {
    if (EXCLUDED_ASYNC_KEYS.has(key)) continue;

    const existingRaw = await AsyncStorage.getItem(key);

    if (isFoodDayKey(key)) {
      const merged = mergeFoodDay(existingRaw, incomingRaw);
      await AsyncStorage.setItem(key, merged.raw);
      mealsAdded += merged.mealsAdded;
      keysRestored += 1;
      continue;
    }

    if (isChatHistoryKey(key)) {
      const merged = mergeChatHistory(existingRaw, incomingRaw);
      await AsyncStorage.setItem(key, merged.raw);
      chatMessagesAdded += merged.added;
      keysRestored += 1;
      continue;
    }

    if (key === CGM_KEY) {
      const merged = mergeCgm(existingRaw, incomingRaw);
      await AsyncStorage.setItem(key, merged.raw);
      glucosePointsMerged += merged.glucoseAdded;
      keysRestored += 1;
      continue;
    }

    // Generic restore/overwrite for all remaining keys.
    await AsyncStorage.setItem(key, incomingRaw);
    keysRestored += 1;
  }

  await refreshFoodDayIndex();

  let tokensRestored = false;
  if (payload.withingsTokens) {
    await saveWithingsTokens(payload.withingsTokens);
    tokensRestored = true;
  }

  return { keysRestored, mealsAdded, chatMessagesAdded, glucosePointsMerged, tokensRestored };
}
