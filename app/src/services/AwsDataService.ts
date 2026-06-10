import AsyncStorage from '@react-native-async-storage/async-storage';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { CONFIG, isCloudEnabled } from '../config/env';
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

function isLocalStackEndpoint(): boolean {
  const ep = CONFIG.awsEndpoint.toLowerCase();
  return ep.includes('localhost') || ep.includes('127.0.0.1');
}

function createDynamoClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: CONFIG.awsRegion,
    endpoint: CONFIG.awsEndpoint || undefined,
    credentials: isLocalStackEndpoint()
      ? { accessKeyId: 'test', secretAccessKey: 'test' }
      : undefined,
  });
}

class AwsDataService {
  async persistData(healthData: HealthPersistPayload): Promise<void> {
    if (!isCloudEnabled()) {
      console.info('Dev Mode: Skipping AWS, saving to AsyncStorage');
      await AsyncStorage.setItem(PERSIST_STORAGE_KEY, JSON.stringify(healthData));
      return;
    }

    const client = createDynamoClient();

    try {
      const item = marshall({
        id: 'latest',
        syncedAt: healthData.syncedAt,
        efficiencyScore: healthData.efficiencyScore,
        insight: healthData.insight,
        payload: JSON.stringify(healthData),
      });

      await client.send(
        new PutItemCommand({
          TableName: CONFIG.dynamodbTable,
          Item: item,
        })
      );
    } catch (err) {
      console.warn('[AwsDataService] DynamoDB PutItem failed (non-fatal):', err);
    }
  }
}

export const awsDataService = new AwsDataService();
