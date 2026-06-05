// Shared financial logic & types for WINARY AI

export const BOTS = [
  { id: 'gam-1', name: 'Gam 1', level: 1, priceCents: 400000,   imageUrl: '/bots/robot.png' },
  { id: 'gam-2', name: 'Gam 2', level: 2, priceCents: 1000000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-3', name: 'Gam 3', level: 3, priceCents: 3000000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-4', name: 'Gam 4', level: 4, priceCents: 8500000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-5', name: 'Gam 5', level: 5, priceCents: 20000000, imageUrl: '/bots/robot.png' },
  { id: 'gam-6', name: 'Gam 6', level: 6, priceCents: 60000000, imageUrl: '/bots/robot.png' },
];

// Financial constants
export const VALIDITY_DAYS = 45;
export const WORK_COOLDOWN_HOURS = 8;
export const DAILY_REVENUE_RATE = 0.30;
export const WORK_SESSIONS_PER_DAY = 3;
export const REFERRAL_RATE = 0.35;
export const MIN_WITHDRAWAL_CENTS = 300000; // 3 000 XOF
export const WELCOME_BONUS_CENTS = 100000;  // 1 000 XOF — donné à l'inscription uniquement

// Financial calculations
export function dailyRevenueCents(priceCents: number): number {
  return Math.floor(priceCents * DAILY_REVENUE_RATE);
}
export function workRevenueCents(priceCents: number): number {
  return Math.floor(dailyRevenueCents(priceCents) / WORK_SESSIONS_PER_DAY);
}
export function totalRevenueCents(priceCents: number): number {
  return dailyRevenueCents(priceCents) * VALIDITY_DAYS;
}
export function referralCommissionCents(priceCents: number): number {
  return Math.floor(priceCents * REFERRAL_RATE);
}

// Format XOF currency
export function formatXOF(cents: number): string {
  const xof = Math.floor(cents / 100);
  return new Intl.NumberFormat('fr-BJ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(xof) + ' XOF';
}

// Format countdown
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

export function enrichBot(bot: typeof BOTS[0]) {
  return {
    ...bot,
    dailyRevenueCents: dailyRevenueCents(bot.priceCents),
    workRevenueCents: workRevenueCents(bot.priceCents),
    totalRevenueCents: totalRevenueCents(bot.priceCents),
    referralCommissionCents: referralCommissionCents(bot.priceCents),
  };
}

// Types
export type Bot = typeof BOTS[0] & {
  dailyRevenueCents: number;
  workRevenueCents: number;
  totalRevenueCents: number;
  referralCommissionCents: number;
};

export type UserPurchase = {
  id: string;
  botId: string;
  botName: string;
  pricePaidCents: number;
  purchasedAt: Date;
  expiresAt: Date;
  lastWorkedAt: Date | null;
  nextAllowedAt: Date | null;
  totalEarnedCents: number;
  workCount: number;
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
  operator?: 'MTN' | 'MOOV';
  txReference?: string;
  userId?: string;
};

export type Transaction = {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'BOT_PURCHASE' | 'WORK_EARNING' | 'REFERRAL_BONUS' | 'WELCOME_BONUS' | 'ADMIN_ADJUSTMENT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amountCents: number;
  description: string;
  createdAt: Date;
  operator?: 'MTN' | 'MOOV';
  txReference?: string;
  userId?: string;
};

export type Referee = {
  id: string;
  phone: string;
  botName: string;
  commissionCents: number;
  date: Date;
};

export type User = {
  id: string;
  phone: string;
  referralCode: string;
  balanceCents: number;
  createdAt: Date;
};

// Per-bot SSD payment config (set by admin)
export type BotPaymentConfig = {
  botId: string;
  botName: string;
  ssdCodeMTN: string;
  ssdCodeMoov: string;
  merchantPhoneMTN: string;
  merchantPhoneMoov: string;
};

// Announcement (popup) — multiple supported
export type Announcement = {
  id: string;
  title: string;
  content: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl?: string;    // Optional banner image URL
  headerColor?: string; // Optional CSS gradient or solid color for the header
  isActive: boolean;
  createdAt: Date;
};
