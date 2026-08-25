/**
 * Dashboard expand/collapse state — an external store subscribed one key at a time.
 *
 * These flags used to be `useState` in DashboardScreen. Because that component is the
 * root of the dashboard tree, every header tap re-rendered all ~4.7k lines of it plus
 * every strip underneath, so the collapse had to wait on a full reconcile before it
 * could paint. Holding the flags outside React lets a tap notify only the strip that
 * owns the key.
 *
 * Cross-strip coordination (nav accordion, "open Your setup" links, the cascade that
 * closes nested strips when Profile & Settings closes) still works because the store is
 * shared — it is only the *subscription* that is per key.
 */

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DashExpandKey =
  | 'trend'
  | 'settingsCard'
  | 'profile'
  | 'language'
  | 'units'
  | 'appearance'
  | 'gear'
  | 'mentor'
  | 'rules'
  | 'macro'
  | 'account'
  | 'clinic'
  | 'reports'
  | 'backup'
  | 'help';

/** Closing the Profile & Settings group card closes everything nested inside it. */
const NESTED_IN_SETTINGS_CARD: DashExpandKey[] = [
  'profile',
  'language',
  'units',
  'appearance',
  'gear',
  'mentor',
  'rules',
  'macro',
  'account',
  'clinic',
  'reports',
  'backup',
];

/** Same AsyncStorage keys the screen used before — existing prefs must survive. */
const STORAGE_KEYS: Partial<Record<DashExpandKey, string>> = {
  trend: 'dash_trend_chart_expanded',
  settingsCard: 'dash_settings_card_expanded',
  language: 'dash_language_expanded',
  units: 'dash_units_expanded',
  appearance: 'dash_appearance_expanded',
  gear: 'dash_gear_expanded',
};

const PERSIST_DEBOUNCE_MS = 400;

const expandedByKey = new Map<DashExpandKey, boolean>();
const listenersByKey = new Map<DashExpandKey, Set<() => void>>();
const subscribeByKey = new Map<DashExpandKey, (onChange: () => void) => () => void>();
const toggleByKey = new Map<DashExpandKey, () => void>();

let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const pendingWrites = new Set<DashExpandKey>();

export function isDashExpanded(key: DashExpandKey): boolean {
  return expandedByKey.get(key) === true;
}

function notify(key: DashExpandKey): void {
  const listeners = listenersByKey.get(key);
  if (!listeners) return;
  for (const onChange of listeners) onChange();
}

function queuePersist(key: DashExpandKey): void {
  if (!hydrated || !STORAGE_KEYS[key]) return;
  pendingWrites.add(key);
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const pairs: [string, string][] = [];
    for (const pending of pendingWrites) {
      const storageKey = STORAGE_KEYS[pending];
      if (storageKey) pairs.push([storageKey, isDashExpanded(pending) ? 'true' : 'false']);
    }
    pendingWrites.clear();
    if (pairs.length > 0) void AsyncStorage.multiSet(pairs);
  }, PERSIST_DEBOUNCE_MS);
}

/** Writes the value without notifying; returns whether anything changed. */
function assign(key: DashExpandKey, value: boolean): boolean {
  if (isDashExpanded(key) === value) return false;
  expandedByKey.set(key, value);
  queuePersist(key);
  return true;
}

export function setDashExpanded(key: DashExpandKey, value: boolean): void {
  const changed = assign(key, value);
  if (key === 'settingsCard' && !value) {
    for (const nested of NESTED_IN_SETTINGS_CARD) {
      if (assign(nested, false)) notify(nested);
    }
  }
  if (changed) notify(key);
}

export function toggleDashExpanded(key: DashExpandKey): void {
  setDashExpanded(key, !isDashExpanded(key));
}

/** Stable per-key toggle — a fresh closure would defeat memo on the bound strip. */
export function dashToggler(key: DashExpandKey): () => void {
  let toggle = toggleByKey.get(key);
  if (!toggle) {
    toggle = () => toggleDashExpanded(key);
    toggleByKey.set(key, toggle);
  }
  return toggle;
}

function subscriberFor(key: DashExpandKey): (onChange: () => void) => () => void {
  let subscribe = subscribeByKey.get(key);
  if (!subscribe) {
    subscribe = (onChange: () => void) => {
      let listeners = listenersByKey.get(key);
      if (!listeners) {
        listeners = new Set();
        listenersByKey.set(key, listeners);
      }
      listeners.add(onChange);
      return () => {
        listeners?.delete(onChange);
      };
    };
    subscribeByKey.set(key, subscribe);
  }
  return subscribe;
}

export function useDashExpanded(key: DashExpandKey): boolean {
  return useSyncExternalStore(subscriberFor(key), () => isDashExpanded(key));
}

/**
 * Reset to all-collapsed, then apply persisted values. Called once when the dashboard
 * mounts, so a sign-out / sign-in starts clean like the old component state did.
 */
export async function hydrateDashExpand(): Promise<void> {
  const entries = Object.entries(STORAGE_KEYS) as [DashExpandKey, string][];
  let rows: readonly [string, string | null][] = [];
  try {
    rows = await AsyncStorage.multiGet(entries.map(([, storageKey]) => storageKey));
  } catch {
    rows = [];
  }

  const previous = new Map(expandedByKey);
  expandedByKey.clear();
  entries.forEach(([key], i) => {
    if (rows[i]?.[1] === 'true') expandedByKey.set(key, true);
  });
  hydrated = true;

  const touched = new Set<DashExpandKey>([...previous.keys(), ...expandedByKey.keys()]);
  for (const key of touched) {
    if ((previous.get(key) === true) !== isDashExpanded(key)) notify(key);
  }
}
