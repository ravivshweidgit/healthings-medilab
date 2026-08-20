/**
 * App identity for clinic / support (platform + marketing version + native build).
 * Sent on every authFetch as X-Healthings-* headers.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

export type ClientPlatform = 'android' | 'ios' | 'web' | 'unknown';

export type ClientIdentity = {
  platform: ClientPlatform;
  /** Marketing version, e.g. 1.2.40 */
  appVersion: string;
  /** Native build: Android versionCode / iOS CFBundleVersion, e.g. 69 */
  build: string;
};

function platform(): ClientPlatform {
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export function getClientIdentity(): ClientIdentity {
  const expo = Constants.expoConfig;
  const appVersion =
    Constants.nativeApplicationVersion?.trim() ||
    expo?.version?.trim() ||
    '0';
  const build =
    Constants.nativeBuildVersion?.trim() ||
    (Platform.OS === 'android'
      ? String(expo?.android?.versionCode ?? '')
      : String(expo?.ios?.buildNumber ?? '')) ||
    '0';
  return {
    platform: platform(),
    appVersion: appVersion || '0',
    build: build || '0',
  };
}

/** Headers attached to authenticated API calls. */
export function clientIdentityHeaders(): Record<string, string> {
  const id = getClientIdentity();
  return {
    'X-Healthings-Platform': id.platform,
    'X-Healthings-App-Version': id.appVersion,
    'X-Healthings-Build': id.build,
  };
}
