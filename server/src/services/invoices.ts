import { query } from '../db/pool.js';

export type InvoiceStatus = 'comped_alpha' | 'paid' | 'failed' | 'pending';
export type InvoiceProvider = 'none' | 'simulated' | 'stripe' | 'manual';

export type Invoice = {
  id: string;
  number: string;
  description: string;
  tokens: number;
  amountCents: number;
  chargedCents: number;
  currency: string;
  status: InvoiceStatus;
  provider: InvoiceProvider;
  providerRef: string | null;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  description: string;
  tokens: number;
  amount_cents: number;
  charged_cents: number;
  currency: string;
  status: InvoiceStatus;
  provider: InvoiceProvider;
  provider_ref: string | null;
  created_at: Date;
};

function toView(r: InvoiceRow): Invoice {
  return {
    id: r.id,
    number: r.number,
    description: r.description,
    tokens: r.tokens,
    amountCents: r.amount_cents,
    chargedCents: r.charged_cents,
    currency: r.currency,
    status: r.status,
    provider: r.provider,
    providerRef: r.provider_ref,
    createdAt: r.created_at.toISOString(),
  };
}

async function nextInvoiceNumber(): Promise<string> {
  const { rows } = await query<{ n: string }>(`SELECT nextval('invoice_number_seq') AS n`);
  const seq = String(rows[0].n).padStart(6, '0');
  return `HT-${new Date().getUTCFullYear()}-${seq}`;
}

export async function createInvoice(params: {
  userId: string;
  description: string;
  tokens: number;
  amountCents: number;
  chargedCents: number;
  currency: string;
  status: InvoiceStatus;
  provider: InvoiceProvider;
  providerRef?: string | null;
}): Promise<Invoice> {
  const number = await nextInvoiceNumber();
  const { rows } = await query<InvoiceRow>(
    `INSERT INTO invoices
       (user_id, number, description, tokens, amount_cents, charged_cents,
        currency, status, provider, provider_ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, number, description, tokens, amount_cents, charged_cents,
               currency, status, provider, provider_ref, created_at`,
    [
      params.userId,
      number,
      params.description,
      params.tokens,
      params.amountCents,
      params.chargedCents,
      params.currency,
      params.status,
      params.provider,
      params.providerRef ?? null,
    ],
  );
  return toView(rows[0]);
}

export async function listInvoicesForUser(userId: string, limit = 50): Promise<Invoice[]> {
  const { rows } = await query<InvoiceRow>(
    `SELECT id, number, description, tokens, amount_cents, charged_cents,
            currency, status, provider, provider_ref, created_at
     FROM invoices
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map(toView);
}
