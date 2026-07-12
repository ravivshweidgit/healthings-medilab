import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Where glucose/steps metrics come from at runtime. */
export type HealthDataSource =
  | 'health-connect'
  | 'healthkit'
  | 'demo-expo-go'
  | 'demo-non-android';

/**
 * Health Connect = Android; HealthKit = iOS release builds.
 * Expo Go cannot use either native health API.
 */
export function getHealthDataSource(): HealthDataSource {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return Platform.OS === 'android' ? 'demo-expo-go' : 'demo-non-android';
  }
  if (Platform.OS === 'ios') {
    return 'healthkit';
  }
  if (Platform.OS === 'android') {
    return 'health-connect';
  }
  return 'demo-non-android';
}

export function isLiveCgmDataSource(source: HealthDataSource): boolean {
  return source === 'health-connect' || source === 'healthkit';
}
