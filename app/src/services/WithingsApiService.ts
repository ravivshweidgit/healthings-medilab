/**
 * Withings OAuth2 + Body Scan API — scaffold only (no live credentials in repo).
 */

import { CONFIG } from '../config/env';

export type BodyScanMetrics = {
  visceralFatIndex: number;
  vascularAgeYears: number;
  muscleMassKg: number;
  measuredAt: string;
};

export type WithingsOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

/** Placeholder: redirect user to Withings OAuth authorize URL. */
export function buildAuthorizationUrl(_clientId: string, _redirectUri: string, _state: string): string {
  return 'https://account.withings.com/oauth2_user/authorize';
}

/** Placeholder: exchange authorization code for tokens. */
export async function exchangeCodeForTokens(
  _code: string,
  _clientId: string,
  _clientSecret: string,
  _redirectUri: string
): Promise<WithingsOAuthTokens> {
  throw new Error('Withings OAuth not configured.');
}

/** Placeholder: refresh access token. */
export async function refreshAccessToken(_refreshToken: string): Promise<WithingsOAuthTokens> {
  throw new Error('Withings OAuth not configured.');
}

const MOCK_BODY_SCAN: BodyScanMetrics = {
  visceralFatIndex: 8.2,
  vascularAgeYears: 47,
  muscleMassKg: 68.5,
  measuredAt: new Date().toISOString(),
};

export async function fetchWithingsData(): Promise<BodyScanMetrics> {
  if (CONFIG.nodeEnv === 'development') {
    return { ...MOCK_BODY_SCAN, measuredAt: new Date().toISOString() };
  }
  throw new Error('Withings API integration not implemented for production.');
}
