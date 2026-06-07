/**
 * Capture unhandled JS errors / promise rejections to Download/healthings/unhandled-errors-latest.json
 * for field diagnosis (e.g. mystery HC permission toast).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { writeJsonToHealthingsDebugDir } from './healthConnectDebugExport';

const LOG_STORAGE_KEY = 'healthings:unhandledErrorLog';
const LOG_FILENAME = 'unhandled-errors-latest.json';
const MAX_ENTRIES = 40;

export type UnhandledErrorEntry = {
  at: string;
  kind: 'global_js_error' | 'unhandled_promise_rejection';
  message: string;
  stack: string | null;
  name: string | null;
  isFatal?: boolean;
};

type UnhandledErrorLogFile = {
  updatedAt: string;
  platform: string;
  entries: UnhandledErrorEntry[];
};

function normalizeError(error: unknown): { message: string; stack: string | null; name: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message || String(error),
      stack: error.stack ?? null,
      name: error.name ?? 'Error',
    };
  }
  if (typeof error === 'string') {
    return { message: error, stack: null, name: 'Error' };
  }
  try {
    return { message: JSON.stringify(error), stack: null, name: null };
  } catch {
    return { message: String(error), stack: null, name: null };
  }
}

let persistChain: Promise<void> = Promise.resolve();
let lastLoggedKey = '';
let lastLoggedAt = 0;

async function persistEntry(entry: UnhandledErrorEntry): Promise<void> {
  const dedupeKey = `${entry.kind}:${entry.message}`;
  const now = Date.now();
  if (dedupeKey === lastLoggedKey && now - lastLoggedAt < 5000) return;
  lastLoggedKey = dedupeKey;
  lastLoggedAt = now;

  persistChain = persistChain.then(async () => {
    let entries: UnhandledErrorEntry[] = [];
    try {
      const raw = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      entries = raw ? (JSON.parse(raw) as UnhandledErrorEntry[]) : [];
    } catch {
      entries = [];
    }

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
      entries = entries.slice(-MAX_ENTRIES);
    }
    await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(entries));

    const payload: UnhandledErrorLogFile = {
      updatedAt: new Date().toISOString(),
      platform: Platform.OS,
      entries,
    };
    const { savedPaths } = await writeJsonToHealthingsDebugDir(LOG_FILENAME, payload);

    console.warn(
      `[Healthings] ${entry.kind}: ${entry.message}`,
      savedPaths.find((p) => p.includes('Download')) ?? savedPaths[0] ?? 'app folder only',
    );
  });

  await persistChain;
}

async function logUnhandledError(
  kind: UnhandledErrorEntry['kind'],
  error: unknown,
  isFatal?: boolean,
): Promise<void> {
  const normalized = normalizeError(error);
  await persistEntry({
    at: new Date().toISOString(),
    kind,
    ...normalized,
    isFatal,
  });
}

type HermesRejectionTracker = {
  allRejections?: boolean;
  onUnhandled?: (id: number, rejection: unknown) => void;
  onHandled?: (id: number) => void;
};

declare global {
  // Hermes-only; absent on JSC.
  var HermesInternal:
    | {
        hasPromise?: () => boolean;
        enablePromiseRejectionTracker?: (options: HermesRejectionTracker) => void;
      }
    | undefined;

  var ErrorUtils:
    | {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      }
    | undefined;
}

/** Install once at app entry — logs to Download/healthings/unhandled-errors-latest.json on Android when writable. */
export function installUnhandledErrorLogging(): void {
  const prevHandler = global.ErrorUtils?.getGlobalHandler?.();
  global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
    void logUnhandledError('global_js_error', error, isFatal);
    prevHandler?.(error, isFatal);
  });

  const hermes = global.HermesInternal;
  if (hermes?.hasPromise?.() && hermes.enablePromiseRejectionTracker) {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id, rejection) => {
        void logUnhandledError('unhandled_promise_rejection', rejection);
      },
    });
  }
}
