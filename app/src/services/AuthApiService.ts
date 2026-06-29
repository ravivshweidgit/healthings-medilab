import { CONFIG } from '../config/env';
import { clearAuthTokens, loadAuthTokens, saveAuthTokens } from './AuthTokenStore';

export type UserRole = 'patient' | 'mentor';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
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

async function authFetch(
  path: string,
  init: RequestInit = {},
  opts?: { accessToken?: string | null; retryOn401?: boolean },
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const accessToken = opts?.accessToken ?? (await loadAuthTokens()).accessToken;
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (res.status === 401 && opts?.retryOn401 !== false) {
    const refreshed = await refreshAuthSession();
    if (refreshed) {
      return authFetch(path, init, { accessToken: refreshed.accessToken, retryOn401: false });
    }
  }
  return res;
}

export async function requestOtp(email: string, role: UserRole = 'patient'): Promise<void> {
  const res = await fetch(`${apiBase()}/v1/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
  });
  if (!res.ok) {
    throw new AuthApiError(await parseError(res), res.status);
  }
}

export async function verifyOtp(email: string, code: string): Promise<AuthUser> {
  const res = await fetch(`${apiBase()}/v1/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() }),
  });
  if (!res.ok) {
    throw new AuthApiError(await parseError(res), res.status);
  }
  const data = (await res.json()) as VerifyResponse;
  await saveAuthTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function refreshAuthSession(): Promise<{ accessToken: string; user: AuthUser } | null> {
  const { refreshToken } = await loadAuthTokens();
  if (!refreshToken) return null;

  const res = await fetch(`${apiBase()}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearAuthTokens();
    return null;
  }

  const data = (await res.json()) as RefreshResponse;
  await saveAuthTokens(data.accessToken, data.refreshToken);

  const meRes = await authFetch('/v1/me', {}, { accessToken: data.accessToken, retryOn401: false });
  if (!meRes.ok) {
    await clearAuthTokens();
    return null;
  }
  const me = (await meRes.json()) as { user: AuthUser };
  return { accessToken: data.accessToken, user: me.user };
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await authFetch('/v1/me');
  if (!res.ok) {
    if (res.status === 401) await clearAuthTokens();
    return null;
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function restoreAuthSession(): Promise<AuthUser | null> {
  const { accessToken, refreshToken } = await loadAuthTokens();
  if (!accessToken && !refreshToken) return null;

  const user = await fetchCurrentUser();
  if (user) return user;

  const refreshed = await refreshAuthSession();
  return refreshed?.user ?? null;
}

export async function logoutAuth(): Promise<void> {
  try {
    await authFetch('/v1/auth/logout', { method: 'POST' }, { retryOn401: false });
  } catch {
    /* offline logout still clears local tokens */
  }
  await clearAuthTokens();
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}/health`, { method: 'GET' });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}
