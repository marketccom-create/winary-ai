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

import { useAuthStore } from './store';

async function apiFetch<T>(url: string, options?: RequestInit, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...authHeaders(), ...(options?.headers || {}) },
      });

      let json: any = {};
      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const text = await res.text();
        if (text.includes('upstream connect error') || text.includes('timeout') || res.status === 504 || res.status === 502) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw new Error('Connexion réseau temporairement lente. Veuillez réessayer.');
        }
        json = { error: text };
      }

      if (!res.ok) {
        if (res.status === 401) {
          if (!url.includes('/api/auth/login')) {
            useAuthStore.getState().logout();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
        }
        if ((res.status === 502 || res.status === 504 || res.status === 503) && attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw new Error(json.error || `Erreur serveur (${res.status})`);
      }

      return json as T;
    } catch (err: any) {
      if (attempt < retries && (err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('timeout') || err.message.includes('upstream'))) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(err.message || 'Problème de connexion réseau. Veuillez réessayer.');
    }
  }
  throw new Error('Le serveur met trop de temps à répondre. Veuillez réessayer dans un instant.');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function apiGetProfile() {
  return apiFetch<{ user: any }>('/api/auth/me');
}

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

export async function apiGetBotPaymentConfigs(): Promise<{
  configs: BotPaymentConfig[];
  isWinpayActive: boolean;
  isSenepayActive: boolean;
  isWinpay2Active: boolean;
  winpay2WhatsappPhone: string;
  isWinpayOneActive: boolean;
  winpayOneSlackWebhookUrl: string;
}> {
  const { configs, isWinpayActive, isSenepayActive, isWinpay2Active, winpay2WhatsappPhone, isWinpayOneActive, winpayOneSlackWebhookUrl } = await apiFetch<{
    configs: any[];
    isWinpayActive?: boolean;
    isSenepayActive?: boolean;
    isWinpay2Active?: boolean;
    winpay2WhatsappPhone?: string;
    isWinpayOneActive?: boolean;
    winpayOneSlackWebhookUrl?: string;
  }>('/api/bots');

  const mappedConfigs = (configs || []).map((c: any) => ({
    botId: c.bot_id,
    botName: c.bot_name,
    ssdCodeMTN: c.ssd_code_mtn || '',
    ssdCodeMoov: c.ssd_code_moov || '',
    ssdCodeOrange: c.ssd_code_orange || '',
    ssdCodeWave: c.ssd_code_wave || '',
    merchantPhoneMTN: c.merchant_phone_mtn || '',
    merchantPhoneMoov: c.merchant_phone_moov || '',
    merchantPhoneOrange: c.merchant_phone_orange || '',
    merchantPhoneWave: c.merchant_phone_wave || '',
  }));
  return {
    configs: mappedConfigs,
    isWinpayActive: isWinpayActive ?? true,
    isSenepayActive: isSenepayActive ?? false,
    isWinpay2Active: isWinpay2Active ?? true,
    winpay2WhatsappPhone: winpay2WhatsappPhone || '+1 (709) 506-4087',
    isWinpayOneActive: isWinpayOneActive ?? true,
    winpayOneSlackWebhookUrl: '',
  };
}

export interface SsdPaymentMethod {
  id: string;
  country_name: string;
  country_code: string;
  country_prefix: string;
  country_flag: string;
  operator_id: string;
  operator_name: string;
  icon: string;
  merchant_phone: string;
  merchant_name?: string;
  deposit_instructions?: string;
  ssd_code_template: string;
  payment_mode?: 'USSD' | 'MANUAL_DEPOSIT' | 'BOTH';
  requires_sms_paste?: boolean;
  is_active: boolean;
  display_order: number;
}

export async function apiGetActiveSsdMethods(): Promise<SsdPaymentMethod[]> {
  try {
    const data = await apiFetch<SsdPaymentMethod[]>('/api/ssd-methods');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('apiGetActiveSsdMethods error:', err);
    return [];
  }
}

export async function apiAdminGetSsdMethods(): Promise<SsdPaymentMethod[]> {
  try {
    const data = await apiFetch<SsdPaymentMethod[]>('/api/admin/ssd-methods');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('apiAdminGetSsdMethods error:', err);
    return [];
  }
}

export async function apiAdminCreateSsdMethod(payload: Partial<SsdPaymentMethod>): Promise<SsdPaymentMethod> {
  return await apiFetch<SsdPaymentMethod>('/api/admin/ssd-methods', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiAdminUpdateSsdMethod(id: string, updates: Partial<SsdPaymentMethod>): Promise<SsdPaymentMethod> {
  return await apiFetch<SsdPaymentMethod>('/api/admin/ssd-methods', {
    method: 'PUT',
    body: JSON.stringify({ id, ...updates }),
  });
}

export async function apiAdminDeleteSsdMethod(id: string): Promise<{ success: boolean }> {
  return await apiFetch<{ success: boolean }>(`/api/admin/ssd-methods?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function apiAdminGetBotPaymentConfigs() {
  const rawRows = await apiFetch<any[]>('/api/admin/bots');
  return rawRows || [];
}

export async function apiGetMyPurchases(_userId: string) {
  try {
    const res = await apiFetch<{ purchases?: any[] }>('/api/purchases');
    const purchases = Array.isArray(res?.purchases) ? res.purchases : [];
    return purchases.map(normalizePurchase).filter(Boolean);
  } catch (err) {
    console.error('apiGetMyPurchases error:', err);
    return [];
  }
}

export async function apiPurchaseBot(
  _userId: string,
  botId: string,
  operator: string,
  txReference: string
) {
  const data = await apiFetch<{ purchase: any; checkoutUrl?: string; newBalanceCents?: number }>('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({ botId, operator, txReference }),
  });
  return {
    purchase: normalizePurchase(data.purchase),
    checkoutUrl: data.checkoutUrl,
    newBalanceCents: data.newBalanceCents ?? 0,
  };
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

export async function apiGetTransactions(_userId: string) {
  try {
    const res = await apiFetch<{ transactions?: any[] }>('/api/transactions');
    const transactions = Array.isArray(res?.transactions) ? res.transactions : [];
    return transactions;
  } catch (err) {
    console.error('apiGetTransactions error:', err);
    return [];
  }
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

export async function apiInitiateDeposit(amount: number) {
  return apiFetch<{ checkoutUrl: string; sessionToken: string }>('/api/transactions/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
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
  patch: { status?: string; balanceCents?: number; aiSupportEnabled?: boolean | null }
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

export async function apiAdminGetAllPurchases() {
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

export async function apiAdminRejectAllPurchases() {
  return apiFetch<{ success: boolean; count: number; protected: number }>('/api/admin/purchases', {
    method: 'DELETE',
  });
}

export async function apiAdminRevokePurchase(purchaseId: string) {
  return apiFetch<{ success: boolean }>(`/api/admin/purchases/${purchaseId}/revoke`, {
    method: 'DELETE',
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

export async function apiAdminDeleteWithdrawal(transactionId: string) {
  return apiFetch<{ success: boolean }>('/api/admin/withdrawals', {
    method: 'DELETE',
    body: JSON.stringify({ transactionId }),
  });
}


export async function apiAdminUpdateBotPaymentConfigs(
  configs: BotPaymentConfig[],
  isWinpayActive?: boolean,
  isSenepayActive?: boolean,
  isWinpay2Active?: boolean,
  winpay2WhatsappPhone?: string,
  isWinpayOneActive?: boolean,
  winpayOneSlackWebhookUrl?: string,
  winpayOneDiscordWebhookUrl?: string,
  winpayOneWhatsappPhone1?: string,
  winpayOneWhatsappApiKey1?: string,
  winpayOneWhatsappPhone2?: string,
  winpayOneWhatsappApiKey2?: string,
  winpayOneWhatsappPhone3?: string,
  winpayOneWhatsappApiKey3?: string,
  telegramBotToken?: string,
  telegramChatId?: string
) {
  return apiFetch<{ success: boolean }>('/api/admin/bots', {
    method: 'PUT',
    body: JSON.stringify({
      configs,
      isWinpayActive,
      isSenepayActive,
      isWinpay2Active,
      winpay2WhatsappPhone,
      isWinpayOneActive,
      winpayOneSlackWebhookUrl,
      winpayOneDiscordWebhookUrl,
      winpayOneWhatsappPhone1,
      winpayOneWhatsappApiKey1,
      winpayOneWhatsappPhone2,
      winpayOneWhatsappApiKey2,
      winpayOneWhatsappPhone3,
      winpayOneWhatsappApiKey3,
      telegramBotToken,
      telegramChatId,
    }),
  });
}

export async function apiAdminGrantBot(userId: string, botId: string, reason: string) {
  return apiFetch<{ success: boolean, purchase: any }>(`/api/admin/users/${userId}/grant-bot`, {
    method: 'POST',
    body: JSON.stringify({ botId, reason }),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizePurchase(p: any) {
  if (!p || typeof p !== 'object') return null;
  return {
    ...p,
    purchasedAt: p.purchasedAt ? new Date(p.purchasedAt) : new Date(),
    expiresAt: p.expiresAt ? new Date(p.expiresAt) : new Date(),
    lastWorkedAt: p.lastWorkedAt ? new Date(p.lastWorkedAt) : null,
    nextAllowedAt: p.nextAllowedAt ? new Date(p.nextAllowedAt) : null,
  };
}

// ─── Chat ──────────────────────────────────────────────────────────────────
export async function apiGetUnreadChatCount() {
  const data = await apiFetch<{ count: number }>('/api/chat/unread');
  return data.count;
}

export async function apiGetChatMessages() {
  return apiFetch<{ messages: any[] }>('/api/chat');
}

export async function apiSendChatMessage(content: string) {
  return apiFetch<{ message: any }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function apiAdminGetChatConversations() {
  return apiFetch<{ conversations: any[] }>('/api/admin/chat');
}

export async function apiAdminGetChatMessages(userId: string) {
  return apiFetch<{ messages: any[] }>(`/api/admin/chat/${userId}`);
}

export async function apiAdminSendChatMessage(userId: string, content: string) {
  return apiFetch<{ message: any }>(`/api/admin/chat/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function apiAdminEditChatMessage(messageId: string, content: string) {
  return apiFetch<{ message: any }>(`/api/admin/chat/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
}

export async function apiAdminDeleteChatMessage(messageId: string) {
  return apiFetch<{ success: boolean }>(`/api/admin/chat/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function apiAdminBroadcastMessage(title: string, message: string) {
  return apiFetch<{ success: boolean; recipientCount: number; message: string }>('/api/admin/broadcast', {
    method: 'POST',
    body: JSON.stringify({ title, message }),
  });
}

// ─── AI Settings ──────────────────────────────────────────────────────────────
export async function apiAdminGetAiSettings() {
  return apiFetch<any>('/api/admin/ai-settings');
}

export async function apiAdminUpdateAiSettings(data: { knowledge_base: string; is_active: boolean; last_error?: string | null }) {
  return apiFetch<any>('/api/admin/ai-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
