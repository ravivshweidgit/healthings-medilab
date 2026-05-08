import {
  AWS_ENDPOINT,
  AWS_REGION,
  DYNAMODB_TABLE,
  NODE_ENV,
  STORAGE_STRATEGY,
} from '@env';

export const CONFIG = {
  nodeEnv: NODE_ENV ?? 'development',
  storageStrategy: STORAGE_STRATEGY ?? 'local',
  awsEndpoint: AWS_ENDPOINT ?? '',
  awsRegion: AWS_REGION ?? 'us-east-1',
  dynamodbTable: DYNAMODB_TABLE ?? 'HealthMetricsDev',
} as const;

export function isCloudEnabled(): boolean {
  return CONFIG.storageStrategy === 'cloud';
}
