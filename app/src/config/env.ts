import {
  AWS_ENDPOINT,
  AWS_REGION,
  DYNAMODB_TABLE,
  NODE_ENV,
  STORAGE_STRATEGY,
  WITHINGS_CALLBACK_URL as WITHINGS_CALLBACK_URL_ENV,
  WITHINGS_CLIENT_ID,
  WITHINGS_CLIENT_SECRET,
} from '@env';

/**
 * Fixed OAuth redirect for dev client + Withings (matches `scheme` in app.json + `/oauth`).
 * Not `AuthSession.makeRedirectUri()` / not Expo Go `exp://`.
 */
export const WITHINGS_OAUTH_REDIRECT_URI = 'healthings-medilab://oauth' as const;

/**
 * Must match the Callback URL in the Withings portal. Keep `WITHINGS_CALLBACK_URL=healthings-medilab://oauth` in `.env`.
 */
export const WITHINGS_CALLBACK_URL = (
  (WITHINGS_CALLBACK_URL_ENV ?? '').trim() || WITHINGS_OAUTH_REDIRECT_URI
) as string;

export const CONFIG = {
  nodeEnv: NODE_ENV ?? 'development',
  storageStrategy: STORAGE_STRATEGY ?? 'local',
  awsEndpoint: AWS_ENDPOINT ?? '',
  awsRegion: AWS_REGION ?? 'us-east-1',
  dynamodbTable: DYNAMODB_TABLE ?? 'HealthMetricsDev',
  withingsClientId: WITHINGS_CLIENT_ID ?? '',
  withingsClientSecret: WITHINGS_CLIENT_SECRET ?? '',
  /** Same string as `WITHINGS_CALLBACK_URL` — used for authorize2, token exchange, and `openAuthSessionAsync`. */
  withingsCallbackUrl: WITHINGS_CALLBACK_URL,
} as const;

export function isCloudEnabled(): boolean {
  return CONFIG.storageStrategy === 'cloud';
}
