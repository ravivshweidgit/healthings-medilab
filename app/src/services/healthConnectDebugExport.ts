/**
 * Optional HC sync debug export to Download/healthings/hc-sync-latest.json.
 * Disabled in production UI — re-enable by wiring saveHealthConnectSyncDebug() back into
 * useHealthData.refetch when HC_SYNC_DEBUG_ENABLED is true.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/** Set true temporarily when diagnosing HC read/chart issues — see file header in useHealthData hook. */
export const HC_SYNC_DEBUG_ENABLED = false;

const DEBUG_DIR_URI_KEY = 'healthings:debugDownloadsDirUri';
const APP_DEBUG_DIR = `${FileSystem.documentDirectory ?? ''}healthings-debug/`;
const ANDROID_DOWNLOADS_HEALTHINGS = '/storage/emulated/0/Download/healthings';

export type HealthConnectSyncDebugReport = {
  exportedAt: string;
  platform: string;
  query: {
    startTime: string;
    endTime: string;
  };
  grantedPermissions: unknown;
  rawRecordCount: number;
  rawPageToken: string | null;
  firstRawRecords: unknown[];
  parsedGlucoseTotal: number;
  parsedGlucoseSample: Array<{ timestamp: string; value: number }>;
  parsedNonZeroCount: number;
  chartGlucoseCount: number;
  cgmSessionStarts: unknown;
  cgmStatSummary: string | null;
  syncError: string | null;
  savedPaths: string[];
  saveNotes: string[];
};

function timestampForFilename(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

async function writeTextFile(path: string, json: string): Promise<void> {
  const parent = path.slice(0, path.lastIndexOf('/') + 1);
  if (parent.length > 1) {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(path, json, { encoding: 'utf8' });
}

async function writeViaSafDirectory(directoryUri: string, filename: string, json: string): Promise<string> {
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    directoryUri,
    filename,
    'application/json',
  );
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });
  return fileUri;
}

async function tryWritePublicDownloads(json: string, filename: string): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const path = `${ANDROID_DOWNLOADS_HEALTHINGS}/${filename}`;
    await writeTextFile(path, json);
    return path;
  } catch {
    return null;
  }
}

async function tryWriteCachedSaf(json: string, filename: string): Promise<string | null> {
  try {
    const directoryUri = await AsyncStorage.getItem(DEBUG_DIR_URI_KEY);
    if (!directoryUri) return null;
    return await writeViaSafDirectory(directoryUri, filename, json);
  } catch {
    return null;
  }
}

/** Write JSON to app debug dir + Download/healthings when writable (shared debug sink). */
export async function writeJsonToHealthingsDebugDir(
  filename: string,
  data: unknown,
): Promise<{ savedPaths: string[]; saveNotes: string[] }> {
  const savedPaths: string[] = [];
  const saveNotes: string[] = [];
  const json = JSON.stringify(data, null, 2);

  try {
    await FileSystem.makeDirectoryAsync(APP_DEBUG_DIR, { intermediates: true });
    const appPath = `${APP_DEBUG_DIR}${filename}`;
    await FileSystem.writeAsStringAsync(appPath, json, { encoding: 'utf8' });
    savedPaths.push(appPath);
    saveNotes.push('App folder (always written)');
  } catch (err) {
    saveNotes.push(`App folder write failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const publicPath = await tryWritePublicDownloads(json, filename);
  if (publicPath) {
    savedPaths.push(publicPath);
    saveNotes.push('Public Downloads/healthings');
  } else {
    saveNotes.push('Public Downloads/healthings not writable (Android scoped storage)');
  }

  const safPath = await tryWriteCachedSaf(json, filename);
  if (safPath) {
    savedPaths.push(safPath);
    saveNotes.push('Saved via previously chosen Downloads folder');
  }

  return { savedPaths, saveNotes };
}

/** Persist HC sync debug JSON for sharing (Downloads/healthings when possible). */
export async function saveHealthConnectSyncDebug(
  report: Omit<HealthConnectSyncDebugReport, 'savedPaths' | 'saveNotes'>,
): Promise<HealthConnectSyncDebugReport> {
  const savedPaths: string[] = [];
  const saveNotes: string[] = [];
  const json = JSON.stringify({ ...report, savedPaths: [], saveNotes: [] }, null, 2);
  const latestName = 'hc-sync-latest.json';
  const stampedName = `hc-sync-${timestampForFilename(report.exportedAt)}.json`;

  try {
    await FileSystem.makeDirectoryAsync(APP_DEBUG_DIR, { intermediates: true });
    const appLatest = `${APP_DEBUG_DIR}${latestName}`;
    await FileSystem.writeAsStringAsync(appLatest, json, { encoding: 'utf8' });
    savedPaths.push(appLatest);
    saveNotes.push('App folder (always written)');
  } catch (err) {
    saveNotes.push(`App folder write failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const publicPath = await tryWritePublicDownloads(json, latestName);
  if (publicPath) {
    savedPaths.push(publicPath);
    saveNotes.push('Public Downloads/healthings');
  } else {
    saveNotes.push('Public Downloads/healthings not writable (Android scoped storage)');
  }

  const safPath = await tryWriteCachedSaf(json, latestName);
  if (safPath) {
    savedPaths.push(safPath);
    saveNotes.push('Saved via previously chosen Downloads folder');
  }

  try {
    await writeTextFile(`${APP_DEBUG_DIR}${stampedName}`, json);
  } catch {
    // Non-fatal: latest copy is enough.
  }

  return { ...report, savedPaths, saveNotes };
}

/** One-time folder pick so future syncs can write to Downloads/healthings. */
export async function pickDebugDownloadsFolder(): Promise<string | null> {
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await AsyncStorage.setItem(DEBUG_DIR_URI_KEY, perm.directoryUri);
  return perm.directoryUri;
}

export function formatDebugExportMessage(report: HealthConnectSyncDebugReport): string {
  const counts =
    `HC records: ${report.rawRecordCount}, parsed>0: ${report.parsedNonZeroCount}, chart: ${report.chartGlucoseCount}`;
  if (report.savedPaths.length === 0) {
    return `${counts}. Debug save failed — tap "Save debug to Downloads" below.`;
  }
  const publicPath = report.savedPaths.find((p) => p.includes('Download'));
  if (publicPath) {
    return `${counts}. Debug saved: Download/healthings/hc-sync-latest.json`;
  }
  return `${counts}. Debug saved in app folder — use "Save debug to Downloads" to copy to Download/healthings.`;
}
