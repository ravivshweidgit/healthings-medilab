import {
  HEALTHINGS_API_URL as HEALTHINGS_API_URL_ENV,
  NODE_ENV,
  WITHINGS_CALLBACK_URL as WITHINGS_CALLBACK_URL_ENV,
  WITHINGS_CLIENT_ID,
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
  healthingsApiUrl: (HEALTHINGS_API_URL_ENV ?? '').trim() || 'https://api.healthings.ai',
  withingsClientId: WITHINGS_CLIENT_ID ?? '',
  /** Same string as `WITHINGS_CALLBACK_URL` — used for authorize2, token exchange, and `openAuthSessionAsync`. */
  withingsCallbackUrl: WITHINGS_CALLBACK_URL,
} as const;
