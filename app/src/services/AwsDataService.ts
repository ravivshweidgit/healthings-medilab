import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActivityZone } from '../logic/MetabolicLogic';
import type { TimePoint } from './HealthConnectService';

export type HealthPersistPayload = {
  syncedAt: string;
  glucose: TimePoint[];
  steps: TimePoint[];
  heartRate: TimePoint[];
  efficiencyScore: number;
  insight: string;
  activityZones: ActivityZone[];
};

const PERSIST_STORAGE_KEY = 'healthings:persistedHealth';

/** Local snapshot only — Dynamo/AWS is not part of the product. */
class LocalHealthPersistService {
  async persistData(healthData: HealthPersistPayload): Promise<void> {
    await AsyncStorage.setItem(PERSIST_STORAGE_KEY, JSON.stringify(healthData));
  }
}

export const awsDataService = new LocalHealthPersistService();
