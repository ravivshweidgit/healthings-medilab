/**
 * Open Samsung Health / Health Connect for step-sync setup (Android).
 */

import { Alert, Linking, Platform } from 'react-native';

const SAMSUNG_HEALTH_PACKAGE = 'com.sec.android.app.shealth';
const GARMIN_CONNECT_PACKAGE = 'com.garmin.android.apps.connectmobile';

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

/** Launch Garmin Connect so user can enable Health Connect sharing. */
export async function openGarminConnectApp(): Promise<void> {
  if (Platform.OS !== 'android') {
    Alert.alert('Garmin Connect', 'On Android, open Garmin Connect and allow sharing with Health Connect.');
    return;
  }
  const attempts = [
    `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${GARMIN_CONNECT_PACKAGE};end`,
    'garminconnect://',
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
    'Garmin Connect',
    'Open Garmin Connect from your app drawer → Settings → Health Connect → enable activities, steps, and calories.',
  );
}
