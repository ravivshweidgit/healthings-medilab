import { authFetch } from './AuthApiService';

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

export function clinicDisplayLabel(share: Pick<AccountShare, 'mentorDisplayName' | 'mentorEmail'>): string {
  return share.mentorDisplayName?.trim() || share.mentorEmail;
}
