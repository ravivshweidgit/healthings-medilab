import { authFetch } from './AuthApiService';

export type SyncLookbackMode = '90d' | 'full';

export type SyncSummary = {
  generatedAt: string;
  lookbackDays: number;
  lookbackMode: SyncLookbackMode;
  dayRange: { from: string; to: string };
  includes: string[];
};

export type PublicSyncBlob = {
  id: string;
  patientId: string;
  version: number;
  byteSize: number;
  payloadHash: string;
  summary: SyncSummary;
  createdAt: string;
};

export type SyncUpdateRequest = {
  id: string;
  patientId: string;
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  requestedAt: string;
};

class SyncApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SyncApiError';
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    /* ignore */
  }
  return `Request failed (${res.status})`;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new SyncApiError(await parseError(res), res.status);
  }
  return (await res.json()) as T;
}

export async function uploadSyncPayload(
  payloadGzipBase64: string,
  summary: SyncSummary,
): Promise<PublicSyncBlob> {
  const res = await authFetch('/v1/sync/upload', {
    method: 'POST',
    body: JSON.stringify({ payloadGzipBase64, summary }),
  });
  const data = await parseJson<{ blob: PublicSyncBlob }>(res);
  return data.blob;
}

export async function fetchMyLatestSyncMeta(): Promise<PublicSyncBlob | null> {
  const res = await authFetch('/v1/sync/mine');
  const data = await parseJson<{ blob: PublicSyncBlob | null }>(res);
  return data.blob;
}

export async function fetchSyncUpdateRequests(): Promise<SyncUpdateRequest[]> {
  const res = await authFetch('/v1/sync/requests');
  const data = await parseJson<{ requests: SyncUpdateRequest[] }>(res);
  return data.requests;
}
