/**
 * Android: raise SwipeRefreshLayout pull distance (default ~64dp is too twitchy).
 * iOS RefreshControl has no equivalent API — leave system threshold.
 */
import { NativeModules, Platform } from 'react-native';

const DEFAULT_TRIGGER_DIP = 150;

type HealthingsSwipeRefreshNative = {
  setTriggerDistanceDip?: (dip: number) => void;
};

export function applyPullRefreshTriggerDistance(dip: number = DEFAULT_TRIGGER_DIP): void {
  if (Platform.OS !== 'android') return;
  const mod = NativeModules.HealthingsSwipeRefresh as HealthingsSwipeRefreshNative | undefined;
  mod?.setTriggerDistanceDip?.(dip);
}
