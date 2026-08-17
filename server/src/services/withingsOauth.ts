/**
 * Withings token exchange on the server so the client secret never ships in the APK.
 * Do not log code, refresh_token, or the secret.
 */

import { config } from '../config.js';

const WITHINGS_TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
const WITHINGS_TIMEOUT_MS = 15_000;

export class WithingsNotConfiguredError extends Error {
  constructor() {
    super('Withings OAuth is not configured on the server');
    this.name = 'WithingsNotConfiguredError';
  }
}

export class WithingsTokenError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'WithingsTokenError';
    this.status = status;
  }
}

export type WithingsOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userid?: string;
  scope?: string;
  tokenType?: string;
};

type WithingsTokenResponseBody = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  userid?: number | string;
  scope?: string;
  token_type?: string;
};

type WithingsOAuthJson = {
  status: number;
  body?: WithingsTokenResponseBody;
  error?: string;
};

export async function exchangeWithingsToken(
  input:
    | { grantType: 'authorization_code'; code: string }
    | { grantType: 'refresh_token'; refreshToken: string },
): Promise<WithingsOAuthTokens> {
  const clientId = config.WITHINGS_CLIENT_ID.trim();
  const clientSecret = config.WITHINGS_CLIENT_SECRET.trim();
  const redirectUri = config.WITHINGS_CALLBACK_URL.trim();
  if (!clientId || !clientSecret) throw new WithingsNotConfiguredError();

  const form = new URLSearchParams({
    action: 'requesttoken',
    grant_type: input.grantType,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (input.grantType === 'authorization_code') {
    form.set('code', input.code.trim());
    form.set('redirect_uri', redirectUri);
  } else {
    form.set('refresh_token', input.refreshToken.trim());
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WITHINGS_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(WITHINGS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: ac.signal,
    });
  } catch (err) {
    throw new WithingsTokenError(
      err instanceof Error ? err.message : 'Withings token request failed',
      502,
    );
  } finally {
    clearTimeout(timer);
  }

  const json = (await res.json()) as WithingsOAuthJson;
  if (json.status !== 0 || !json.body) {
    throw new WithingsTokenError(
      json.error ?? `Withings token request failed (status ${json.status})`,
      400,
    );
  }
  return mapTokenBody(json.body);
}

function mapTokenBody(body: WithingsTokenResponseBody): WithingsOAuthTokens {
  const expiresInSec = Number(body.expires_in ?? 10_800);
  const expiresAt = new Date(Date.now() + Math.max(60, expiresInSec) * 1000).toISOString();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt,
    userid: body.userid != null ? String(body.userid) : undefined,
    scope: body.scope,
    tokenType: body.token_type,
  };
}
