/**
 * Store / download destinations for the companion apps Gear points at.
 * Same listings as website/scripts/downloads-locale-content.mjs (verified 2026-08-21).
 *
 * Withings and CareSens Air live in the stores. xDrip+ is the CareSens
 * integration Healthings hosts — that tap goes to our help page, which has the
 * APK and the wiring steps. A raw APK URL from in-app Linking is a download
 * with no next step.
 */

import { Platform } from 'react-native';
import { helpUrl } from '../i18n/helpUrls';

const WITHINGS = {
  android: 'https://play.google.com/store/apps/details?id=com.withings.wiscale2',
  ios: 'https://apps.apple.com/app/id542701020',
};

const CARESENS = {
  android: 'https://play.google.com/store/apps/details?id=com.isens.csair',
  ios: 'https://apps.apple.com/app/id1605701892',
};

function storeUrl(pair: { android: string; ios: string }): string {
  return Platform.OS === 'ios' ? pair.ios : pair.android;
}

export function withingsStoreUrl(): string {
  return storeUrl(WITHINGS);
}

export function caresensStoreUrl(): string {
  return storeUrl(CARESENS);
}

export function xdripHealthingsUrl(langCode?: string | null): string {
  return helpUrl(langCode ?? 'en', 'xdrip-caresens');
}
