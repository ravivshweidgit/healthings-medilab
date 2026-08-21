import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../config/env';
import { authFetch } from './AuthApiService';
import { fetchWithTimeout } from './fetchWithTimeout';

export type ShareStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type AccountShare = {
  id: string;
  patientId: string | null;
  patientEmail: string;
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  status: ShareStatus;
  initiatedBy: 'patient' | 'mentor';
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type AiSponsorship = {
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  patientId: string;
  patientEmail: string;
  expiresAt: string;
  active: boolean;
};

export type WalletView = {
  balanceTokens: number;
  ownBalanceTokens: number | null;
  sponsored: boolean;
  sponsoredBy: string | null;
  sponsorshipExpiresAt: string | null;
  sponsorshipActive: boolean;
  autoReload: boolean;
  paymentMethodOnFile: boolean;
  tokenPackSize: number;
  /** Present after be-34 — optional for older API responses. */
  billingLive?: boolean;
  delinquentSince?: string | null;
  chargeAttempts?: number;
  coveragePaused?: boolean;
  nextRetryAt?: string | null;
};

class ShareApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ShareApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error === 'Unauthorized') {
      return 'Session expired — sign out and sign in again';
    }
    if (body?.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new ShareApiError(await parseError(res), res.status);
  }
  return (await res.json()) as T;
}

/** Offline / old-API fallback — live value comes from GET /v1/public/app-config. */
export const FALLBACK_CLINIC_SHARE_EMAIL = 'habushamichal@gmail.com';
const CLINIC_SHARE_EMAIL_KEY = 'healthings:clinicShareEmail';

export function isHealthingsClinicShare(
  share: Pick<AccountShare, 'mentorEmail'>,
  clinicEmail: string,
): boolean {
  const want = clinicEmail.trim().toLowerCase();
  if (!want.includes('@')) return false;
  return share.mentorEmail.trim().toLowerCase() === want;
}

export async function fetchClinicShareEmail(): Promise<string> {
  try {
    const base = CONFIG.healthingsApiUrl.replace(/\/$/, '');
    const res = await fetchWithTimeout(`${base}/v1/public/app-config`, {}, 8000);
    if (res.ok) {
      const data = (await res.json()) as { clinicShareEmail?: string | null };
      const email = String(data.clinicShareEmail ?? '').trim().toLowerCase();
      if (email.includes('@')) {
        await AsyncStorage.setItem(CLINIC_SHARE_EMAIL_KEY, email);
        return email;
      }
    }
  } catch {
    /* offline — use cache / fallback */
  }
  try {
    const cached = (await AsyncStorage.getItem(CLINIC_SHARE_EMAIL_KEY))?.trim().toLowerCase();
    if (cached?.includes('@')) return cached;
  } catch {
    /* ignore */
  }
  return FALLBACK_CLINIC_SHARE_EMAIL;
}

export async function requestClinicLink(mentorEmail: string): Promise<AccountShare> {
  const res = await authFetch('/v1/shares/request', {
    method: 'POST',
    body: JSON.stringify({ mentorEmail: mentorEmail.trim().toLowerCase() }),
  });
  const data = await parseJson<{ share: AccountShare }>(res);
  return data.share;
}

export async function listShares(status?: ShareStatus): Promise<AccountShare[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await authFetch(`/v1/shares${q}`);
  const data = await parseJson<{ shares: AccountShare[] }>(res);
  return data.shares;
}

export async function listPendingSharesForMe(): Promise<AccountShare[]> {
  const res = await authFetch('/v1/shares/pending-for-me');
  const data = await parseJson<{ shares: AccountShare[] }>(res);
  return data.shares;
}

export async function approveShare(shareId: string): Promise<AccountShare> {
  const res = await authFetch(`/v1/shares/${shareId}/approve`, { method: 'POST' });
  const data = await parseJson<{ share: AccountShare }>(res);
  return data.share;
}

export async function rejectShare(shareId: string): Promise<AccountShare> {
  const res = await authFetch(`/v1/shares/${shareId}/reject`, { method: 'POST' });
  const data = await parseJson<{ share: AccountShare }>(res);
  return data.share;
}

export async function revokeShare(shareId: string): Promise<AccountShare> {
  const res = await authFetch(`/v1/shares/${shareId}/revoke`, { method: 'POST' });
  const data = await parseJson<{ share: AccountShare }>(res);
  return data.share;
}

/** Read-only: mentor who sponsors this patient's AI (if any). */
export async function getMySponsorship(): Promise<AiSponsorship | null> {
  const res = await authFetch('/v1/sponsorships');
  const data = await parseJson<{ sponsorship: AiSponsorship | null }>(res);
  return data.sponsorship;
}

export async function fetchWallet(): Promise<WalletView> {
  const res = await authFetch('/v1/wallet');
  const data = await parseJson<{ wallet: WalletView }>(res);
  return data.wallet;
}

/** Alpha / manual pack grant (zero-charge invoice on server). Flush local usage first. */
export async function addTokenPack(tokens?: number): Promise<{ balanceTokens: number; added: number }> {
  const { flushBeforeBuyPack, adoptWalletCredits } = await import('./UsageQueueService');
  await flushBeforeBuyPack();
  const res = await authFetch('/v1/wallet/add-pack', {
    method: 'POST',
    body: JSON.stringify(tokens != null ? { tokens } : {}),
  });
  const data = await parseJson<{ balanceTokens: number; added: number }>(res);
  // Re-read payer-aware wallet (sponsorship) after grant.
  try {
    const wallet = await fetchWallet();
    await adoptWalletCredits(wallet);
  } catch {
    await adoptWalletCredits({ balanceTokens: data.balanceTokens, sponsored: false });
  }
  return data;
}

export function clinicDisplayLabel(share: Pick<AccountShare, 'mentorDisplayName' | 'mentorEmail'>): string {
  return share.mentorDisplayName?.trim() || share.mentorEmail;
}
