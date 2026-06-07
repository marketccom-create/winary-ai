// WINARY AI — Real API client (calls Next.js API Routes → Supabase)
import { BOTS, enrichBot } from './data';
import type { BotPaymentConfig, Announcement } from './data';

// ─── Auth token helper ────────────────────────────────────────────────────────
function getToken(): string {
  if (typeof window === 'undefined') return '';
  // Token stored by Zustand persist in localStorage under 'winary-auth'
  try {
    const raw = localStorage.getItem('winary-auth');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || '';
  } catch {
    return '';
  }
}

function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options?.headers || {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erreur serveur');
  return json as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function apiLogin(phone: string, password: string) {
  return apiFetch<{ user: any; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
}

export async function apiRegister(data: {
  phone: string;
  password: string;
  referralCode: string;
  captchaAnswer: string;
  captchaToken: string;
  firstName: string;
  lastName: string;
}) {
  return apiFetch<{ user: any; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone: data.phone,
      password: data.password,
      referralCode: data.referralCode,
      firstName: data.firstName,
      lastName: data.lastName,
    }),
  });
}

export async function apiChangePassword(oldPassword: string, newPassword: string) {
  return apiFetch<{ success: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// ─── Announcements ────────────────────────────────────────────────────────────
export async function apiGetAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/api/announcements');
}

// ─── Bots ─────────────────────────────────────────────────────────────────────
export async function apiGetBots() {
  const { bots } = await apiFetch<{ bots: any[] }>('/api/bots');
  return bots;
}

export async function apiGetBotPaymentConfigs(): Promise<BotPaymentConfig[]> {
  const { configs } = await apiFetch<{ configs: any[] }>('/api/bots');
  return configs.map((c: any) => ({
    botId: c.bot_id,
    botName: c.bot_name,
    ssdCodeMTN: c.ssd_code_mtn,
    ssdCodeMoov: c.ssd_code_moov,
    merchantPhoneMTN: c.merchant_phone_mtn,
    merchantPhoneMoov: c.merchant_phone_moov,
  }));
}

// ─── Purchases ────────────────────────────────────────────────────────────────
export async function apiGetMyPurchases(_userId: string) {
  const { purchases } = await apiFetch<{ purchases: any[] }>('/api/purchases');
  return purchases.map(normalizePurchase);
}

export async function apiPurchaseBot(
  _userId: string,
  botId: string,
  operator: 'MTN' | 'MOOV',
  txReference: string
) {
  const { purchase } = await apiFetch<{ purchase: any }>('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({ botId, operator, txReference }),
  });
  return { purchase: normalizePurchase(purchase), newBalanceCents: 0 };
}

export async function apiStartWork(_userId: string, purchaseId: string) {
  return apiFetch<{ nextAllowedAt: string; lastWorkedAt: string }>(
    `/api/purchases/${purchaseId}/start`,
    { method: 'POST' }
  );
}

export async function apiClaimWork(_userId: string, purchaseId: string) {
  return apiFetch<{ earnedCents: number; newBalanceCents: number }>(
    `/api/purchases/${purchaseId}/claim`,
    { method: 'POST' }
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function apiGetTransactions(_userId: string) {
  const { transactions } = await apiFetch<{ transactions: any[] }>('/api/transactions');
  return transactions;
}

export async function apiWithdraw(
  _userId: string,
  amountCents: number,
  provider: string,
  phone: string
) {
  return apiFetch<{ transaction: any; newBalanceCents: number }>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify({ amountCents, provider, phone }),
  });
}

export async function apiDeposit(provider: string) {
  // Still static — fetch from bot_payment_configs would be overkill for deposit
  const settings: Record<string, { ssdCode: string; phone: string }> = {
    mtn: { ssdCode: '*880*1*MONTANT*CODE#', phone: process.env.NEXT_PUBLIC_MERCHANT_MTN || '+22997000000' },
    moov: { ssdCode: '*155*1*MONTANT*CODE#', phone: process.env.NEXT_PUBLIC_MERCHANT_MOOV || '+22995000000' },
  };
  return settings[provider] || settings.mtn;
}

// ─── Referrals ────────────────────────────────────────────────────────────────
export async function apiGetReferrals(_userId: string) {
  return apiFetch<{ code: string; referees: any[]; totalCommissionCents: number }>(
    '/api/referrals'
  );
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export async function apiAdminGetStats() {
  return apiFetch<any>('/api/admin/stats');
}

export async function apiAdminGetUsers() {
  return apiFetch<any[]>('/api/admin/users');
}

export async function apiAdminGetUserDetails(userId: string) {
  return apiFetch<any>(`/api/admin/users/${userId}/details`);
}

export async function apiAdminUpdateUser(
  userId: string,
  patch: { status?: string; balanceCents?: number }
) {
  return apiFetch<{ success: boolean }>('/api/admin/users', {
    method: 'PATCH',
    body: JSON.stringify({ userId, ...patch }),
  });
}

export async function apiAdminGetAnnouncements(): Promise<Announcement[]> {
  return apiFetch<Announcement[]>('/api/admin/announcements');
}

export async function apiAdminUpdateAnnouncement(data: Partial<Announcement>) {
  if (data.id) {
    // Update existing
    return apiFetch<Announcement>('/api/admin/announcements', {
      method: 'PUT',
      body: JSON.stringify({
        id: data.id,
        title: data.title,
        content: data.content,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        imageUrl: (data as any).imageUrl,
        headerColor: (data as any).headerColor,
        isActive: data.isActive,
      }),
    });
  } else {
    // Create new
    return apiFetch<Announcement>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        content: data.content,
        ctaLabel: data.ctaLabel,
        ctaUrl: data.ctaUrl,
        imageUrl: (data as any).imageUrl,
        headerColor: (data as any).headerColor,
        isActive: data.isActive,
      }),
    });
  }
}

export async function apiAdminDeleteAnnouncement(id: string) {
  return apiFetch<{ success: boolean }>(`/api/admin/announcements?id=${id}`, {
    method: 'DELETE',
  });
}

export async function apiAdminGetPendingPurchases() {
  return apiFetch<any[]>('/api/admin/purchases');
}

export async function apiAdminApprovePurchase(purchaseId: string) {
  return apiFetch<{ success: boolean }>('/api/admin/purchases', {
    method: 'POST',
    body: JSON.stringify({ purchaseId, action: 'approve' }),
  });
}

export async function apiAdminRejectPurchase(purchaseId: string, reason: string) {
  return apiFetch<{ success: boolean }>('/api/admin/purchases', {
    method: 'POST',
    body: JSON.stringify({ purchaseId, action: 'reject', reason }),
  });
}

export async function apiAdminGetPendingWithdrawals() {
  return apiFetch<any[]>('/api/admin/withdrawals');
}

export async function apiAdminApproveWithdrawal(transactionId: string) {
  return apiFetch<{ success: boolean }>('/api/admin/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ transactionId, action: 'approve' }),
  });
}

export async function apiAdminRejectWithdrawal(transactionId: string, reason: string) {
  return apiFetch<{ success: boolean }>('/api/admin/withdrawals', {
    method: 'POST',
    body: JSON.stringify({ transactionId, action: 'reject', reason }),
  });
}

export async function apiAdminUpdateBotPaymentConfigs(configs: BotPaymentConfig[]) {
  return apiFetch<{ success: boolean }>('/api/admin/bots', {
    method: 'PUT',
    body: JSON.stringify(configs),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function isAdminPhone(phone: string): boolean {
  return phone === '+22901010101'; // Fallback — is_admin is in JWT
}

function normalizePurchase(p: any) {
  return {
    ...p,
    purchasedAt: p.purchasedAt ? new Date(p.purchasedAt) : new Date(),
    expiresAt: p.expiresAt ? new Date(p.expiresAt) : new Date(),
    lastWorkedAt: p.lastWorkedAt ? new Date(p.lastWorkedAt) : null,
    nextAllowedAt: p.nextAllowedAt ? new Date(p.nextAllowedAt) : null,
  };
}
