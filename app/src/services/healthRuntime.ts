import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Where glucose/steps metrics come from at runtime. */
export type HealthDataSource = 'health-connect' | 'demo-expo-go' | 'demo-non-android';

/**
 * Health Connect native APIs are not available inside the Expo Go store client.
 * Use a dev build (`expo run:android` / EAS) for real Samsung Health / CareSens data.
 */
export function getHealthDataSource(): HealthDataSource {
  if (Platform.OS !== 'android') {
    return 'demo-non-android';
  }
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'demo-expo-go';
  }
  return 'health-connect';
}
