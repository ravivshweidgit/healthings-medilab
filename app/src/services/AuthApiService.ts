import { CONFIG } from '../config/env';
import { clearCachedApprovedShares } from './ShareCacheService';
import {
  clearAuthTokens,
  loadAuthTokens,
  loadCachedAuthUser,
  saveAuthTokens,
  saveCachedAuthUser,
} from './AuthTokenStore';
import { fetchWithTimeout, isAbortError } from './fetchWithTimeout';

export type UserRole = 'patient' | 'mentor';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  /** Mentor/clinic label — patients do not set this. */
  displayName?: string | null;
  /** Patient first name for clinic findability (be-27). */
  firstName?: string | null;
  /** Patient last name for clinic findability (be-27). */
  lastName?: string | null;
  /** Patient's own read-only view at healthings.ai/account. Absent on users cached before it existed. */
  webViewEnabled?: boolean;
  createdAt: string;
};

type VerifyResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

/** Keep boot / offline restore snappy — iOS airplane mode can hang fetch forever without this. */
const AUTH_FETCH_TIMEOUT_MS = 8_000;

function apiBase(): string {
  return CONFIG.healthingsApiUrl.replace(/\/$/, '');
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (body?.error === 'Not Found') {
      return 'API route not found — check HEALTHINGS_API_URL uses https://api.healthings.ai';
    }
    if (body?.error) return body.error;
    if (body?.message) return body.message;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

let refreshInFlight: Promise<{ accessToken: string; user: AuthUser } | null> | null = null;

async function refreshAuthSessionSingleFlight(): Promise<{ accessToken: string; user: AuthUser } | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAuthSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function authFetch(
  path: string,
  init: RequestInit = {},
  opts?: { accessToken?: string | null; retryOn401?: boolean; timeoutMs?: number },
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = opts?.accessToken ?? (await loadAuthTokens()).accessToken;
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetchWithTimeout(
    `${apiBase()}${path}`,
    { ...init, headers },
    opts?.timeoutMs ?? AUTH_FETCH_TIMEOUT_MS,
  );
  if (res.status === 401 && opts?.retryOn401 !== false) {
    const refreshed = await refreshAuthSessionSingleFlight();
    if (refreshed) {
      return authFetch(path, init, {
        accessToken: refreshed.accessToken,
        retryOn401: false,
        timeoutMs: opts?.timeoutMs,
      });
    }
  }
  return res;
}

export async function requestOtp(email: string, role: UserRole = 'patient'): Promise<void> {
  const res = await fetchWithTimeout(
    `${apiBase()}/v1/auth/otp/request`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
    },
    AUTH_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new AuthApiError(await parseError(res), res.status);
  }
}

export async function verifyOtp(email: string, code: string): Promise<AuthUser> {
  const res = await fetchWithTimeout(
    `${apiBase()}/v1/auth/otp/verify`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
    },
    AUTH_FETCH_TIMEOUT_MS,
  );
  if (!res.ok) {
    throw new AuthApiError(await parseError(res), res.status);
  }
  const data = (await res.json()) as VerifyResponse;
  await saveAuthTokens(data.accessToken, data.refreshToken);
  await saveCachedAuthUser(data.user);
  return data.user;
}

export async function refreshAuthSession(): Promise<{ accessToken: string; user: AuthUser } | null> {
  const { refreshToken } = await loadAuthTokens();
  if (!refreshToken) return null;

  try {
    const res = await fetchWithTimeout(
      `${apiBase()}/v1/auth/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      },
      AUTH_FETCH_TIMEOUT_MS,
    );
    if (!res.ok) {
      // Only clear on auth rejection — keep tokens when offline / 5xx.
      if (res.status === 401 || res.status === 403) {
        await clearAuthTokens();
      }
      return null;
    }

    const data = (await res.json()) as RefreshResponse;
    await saveAuthTokens(data.accessToken, data.refreshToken);

    const meRes = await authFetch('/v1/me', {}, { accessToken: data.accessToken, retryOn401: false });
    if (!meRes.ok) {
      if (meRes.status === 401 || meRes.status === 403) {
        await clearAuthTokens();
      }
      return null;
    }
    const me = (await meRes.json()) as { user: AuthUser };
    await saveCachedAuthUser(me.user);
    return { accessToken: data.accessToken, user: me.user };
  } catch (err) {
    // Network / abort — keep tokens for offline use.
    if (__DEV__) {
      console.warn('[auth] refresh failed', isAbortError(err) ? 'timeout' : err);
    }
    return null;
  }
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await authFetch('/v1/me');
    if (!res.ok) {
      if (res.status === 401) await clearAuthTokens();
      return null;
    }
    const data = (await res.json()) as { user: AuthUser };
    await saveCachedAuthUser(data.user);
    return data.user;
  } catch (err) {
    if (__DEV__) {
      console.warn('[auth] /me failed', isAbortError(err) ? 'timeout' : err);
    }
    return null;
  }
}

/**
 * Turn the patient's own read-only web view on or off.
 *
 * Off also deletes the server copy when no clinic still reads it — the server
 * runs the purge, so this is the whole client side of withdrawing.
 */
export async function setWebViewEnabled(enabled: boolean): Promise<AuthUser> {
  const res = await authFetch('/v1/account/web-view', {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || 'Could not update your web view');
  }
  const data = (await res.json()) as { user: AuthUser };
  await saveCachedAuthUser(data.user);
  return data.user;
}

/** Persist patient first/last name (be-27). Empty string clears that field. */
export async function updatePatientNames(
  firstName: string,
  lastName: string,
): Promise<AuthUser> {
  const payload = { firstName, lastName };
  const res = await authFetch('/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      details?: { fieldErrors?: Record<string, string[] | undefined> };
    };
    // Pre-be-27 API required displayName only — Zod returns "Invalid request".
    const fieldErrors = body.details?.fieldErrors ?? {};
    const looksLikeOldApi =
      body.error === 'Invalid request' &&
      (Object.prototype.hasOwnProperty.call(fieldErrors, 'displayName') ||
        !Object.keys(fieldErrors).length);
    if (looksLikeOldApi) {
      throw new Error(
        'Server is still on the old API — deploy be-27 (git pull, build, migrate, restart) then try again.',
      );
    }
    throw new Error(body.error || 'Could not save your name');
  }
  const data = (await res.json()) as { user: AuthUser };
  await saveCachedAuthUser(data.user);
  return data.user;
}

/**
 * Decode access JWT claims without verifying (offline boot UI only).
 * Server tokens include sub / email / role.
 */
function userFromAccessToken(accessToken: string | null): AuthUser | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = globalThis.atob(b64 + pad);
    const payload = JSON.parse(json) as { sub?: string; email?: string; role?: string };
    if (!payload.sub || !payload.email) return null;
    if (payload.role !== 'patient' && payload.role !== 'mentor') return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      createdAt: '',
    };
  } catch {
    return null;
  }
}

/**
 * Restore session on launch. Online: /me or refresh.
 * Offline / hung network: cached user + tokens (iOS airplane mode).
 */
export async function restoreAuthSession(): Promise<AuthUser | null> {
  const { accessToken, refreshToken } = await loadAuthTokens();
  if (!accessToken && !refreshToken) return null;

  const user = await fetchCurrentUser();
  if (user) return user;

  const refreshed = await refreshAuthSessionSingleFlight();
  if (refreshed?.user) return refreshed.user;

  // Offline fallback — do not wipe tokens.
  if (accessToken || refreshToken) {
    const cached = await loadCachedAuthUser();
    if (cached) return cached;
    return userFromAccessToken(accessToken);
  }
  return null;
}

export async function logoutAuth(): Promise<void> {
  try {
    // Settle prepaid usage while access token is still valid (be-33).
    const { flushOnLogout } = await import('./UsageQueueService');
    await flushOnLogout();
  } catch {
    /* non-fatal */
  }
  try {
    await authFetch('/v1/auth/logout', { method: 'POST' }, { retryOn401: false });
  } catch {
    /* offline logout still clears local tokens */
  }
  await clearAuthTokens();
  await clearCachedApprovedShares();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${apiBase()}/health`, { method: 'GET' }, AUTH_FETCH_TIMEOUT_MS);
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}
