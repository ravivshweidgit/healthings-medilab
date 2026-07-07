/**
 * Open Samsung Health / Health Connect for step-sync setup (Android).
 */

import { Alert, Linking, Platform } from 'react-native';

const SAMSUNG_HEALTH_PACKAGE = 'com.sec.android.app.shealth';

/** Launch Samsung Health so user can enable Steps → Health Connect. */
export async function openSamsungHealthApp(): Promise<void> {
  if (Platform.OS !== 'android') {
    Alert.alert('Steps', 'On Android, open Samsung Health and allow Steps to sync with Health Connect.');
    return;
  }
  const attempts = [
    `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${SAMSUNG_HEALTH_PACKAGE};end`,
    'samsunghealth://',
    'shealth://',
  ];
  for (const url of attempts) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
      /* try next */
    }
  }
  Alert.alert(
    'Samsung Health',
    'Open Samsung Health from your app drawer → Settings (☰) → Health Connect → turn on Steps sync.',
  );
}
