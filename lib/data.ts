// Shared financial logic & types for WINARY AI

export const BOTS = [
  { id: 'gam-1', name: 'Gam 1', level: 1, priceCents: 400000,   imageUrl: '/bots/robot.png' },
  { id: 'gam-2', name: 'Gam 2', level: 2, priceCents: 1000000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-3', name: 'Gam 3', level: 3, priceCents: 3000000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-4', name: 'Gam 4', level: 4, priceCents: 8000000,  imageUrl: '/bots/robot.png' },
  { id: 'gam-5', name: 'Gam 5', level: 5, priceCents: 20000000, imageUrl: '/bots/robot.png' },
  { id: 'gam-6', name: 'Gam 6', level: 6, priceCents: 60000000, imageUrl: '/bots/robot.png' },
];

// Promotion Gam 4 Config
export const GAM_4_PROMO = {
  botId: 'gam-4',
  normalPriceCents: 8000000, // 80 000 XOF
  promoPriceCents: 5000000,  // 50 000 XOF
  startTime: '2026-07-23T08:00:00+02:00',
  endTime: '2026-07-24T08:00:00+02:00',
};

export function getBotPromo(botId: string, now: Date = new Date()) {
  if (botId !== GAM_4_PROMO.botId) return null;

  const startMs = new Date(GAM_4_PROMO.startTime).getTime();
  const endMs = new Date(GAM_4_PROMO.endTime).getTime();
  const currentMs = now.getTime();

  if (currentMs < startMs) {
    return {
      status: 'UPCOMING' as const,
      startTime: GAM_4_PROMO.startTime,
      endTime: GAM_4_PROMO.endTime,
      startsInMs: Math.max(0, startMs - currentMs),
      endsInMs: Math.max(0, endMs - currentMs),
      normalPriceCents: GAM_4_PROMO.normalPriceCents,
      promoPriceCents: GAM_4_PROMO.promoPriceCents,
    };
  } else if (currentMs >= startMs && currentMs < endMs) {
    return {
      status: 'ACTIVE' as const,
      startTime: GAM_4_PROMO.startTime,
      endTime: GAM_4_PROMO.endTime,
      endsInMs: Math.max(0, endMs - currentMs),
      normalPriceCents: GAM_4_PROMO.normalPriceCents,
      promoPriceCents: GAM_4_PROMO.promoPriceCents,
    };
  } else {
    return {
      status: 'EXPIRED' as const,
      startTime: GAM_4_PROMO.startTime,
      endTime: GAM_4_PROMO.endTime,
      normalPriceCents: GAM_4_PROMO.normalPriceCents,
      promoPriceCents: GAM_4_PROMO.promoPriceCents,
    };
  }
}

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

export function enrichBot(bot: typeof BOTS[0], now: Date = new Date()) {
  const promo = getBotPromo(bot.id, now);
  const isPromoActive = promo?.status === 'ACTIVE';
  const effectivePriceCents = isPromoActive ? promo.promoPriceCents : bot.priceCents;

  return {
    ...bot,
    priceCents: effectivePriceCents,
    originalPriceCents: isPromoActive ? promo.normalPriceCents : (promo ? promo.normalPriceCents : undefined),
    isPromo: isPromoActive,
    promoStatus: promo?.status || null,
    promoEndsAt: promo?.status === 'ACTIVE' ? promo.endTime : null,
    promoStartsAt: promo?.status === 'UPCOMING' ? promo.startTime : null,
    promoRemainingMs: promo?.status === 'ACTIVE' ? promo.endsInMs : (promo?.status === 'UPCOMING' ? promo.startsInMs : 0),
    dailyRevenueCents: dailyRevenueCents(effectivePriceCents),
    workRevenueCents: workRevenueCents(effectivePriceCents),
    totalRevenueCents: totalRevenueCents(effectivePriceCents),
    referralCommissionCents: referralCommissionCents(effectivePriceCents),
  };
}

// Types
export type Bot = typeof BOTS[0] & {
  dailyRevenueCents: number;
  workRevenueCents: number;
  totalRevenueCents: number;
  referralCommissionCents: number;
  originalPriceCents?: number;
  isPromo?: boolean;
  promoStatus?: 'UPCOMING' | 'ACTIVE' | 'EXPIRED' | null;
  promoEndsAt?: string | null;
  promoStartsAt?: string | null;
  promoRemainingMs?: number;
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
  firstName?: string;
  lastName?: string;
};

// Per-bot SSD payment config for Winpay (set by admin per tariff and operator)
export type BotPaymentConfig = {
  botId: string;
  botName: string;
  ssdCodeMTN: string;
  ssdCodeMoov: string;
  ssdCodeOrange?: string;
  ssdCodeWave?: string;
  merchantPhoneMTN: string;
  merchantPhoneMoov: string;
  merchantPhoneOrange?: string;
  merchantPhoneWave?: string;
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

// Supported countries for phone registration/login
export const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', prefix: '+229', flag: '🇧🇯', operators: ['MTN', 'MOOV'] },
  { code: 'TG', name: 'Togo', prefix: '+228', flag: '🇹🇬', operators: ['FLOOZ', 'TMONEY'] },
  { code: 'SN', name: 'Sénégal', prefix: '+221', flag: '🇸🇳', operators: ['ORANGE', 'WAVE'] },
  { code: 'BF', name: 'Burkina Faso', prefix: '+226', flag: '🇧🇫', operators: ['MOOV', 'ORANGE', 'WAVE'] },
  { code: 'ML', name: 'Mali', prefix: '+223', flag: '🇲🇱', operators: ['MOOV', 'ORANGE', 'MALI'] },
  { code: 'CI', name: "Côte d'Ivoire", prefix: '+225', flag: '🇨🇮', operators: ['MOOV', 'MTN', 'WAVE'] },
  { code: 'GN', name: 'Guinée', prefix: '+224', flag: '🇬🇳', operators: ['ORANGE', 'MTN', 'WAVE'] },
  { code: 'NE', name: 'Niger', prefix: '+227', flag: '🇳🇪', operators: ['MOOV', 'AIRTEL', 'ORANGE'] },
  { code: 'CG', name: 'Congo', prefix: '+242', flag: '🇨🇬', operators: ['MTN', 'AIRTEL'] },
  { code: 'GA', name: 'Gabon', prefix: '+241', flag: '🇬🇦', operators: ['MOOV', 'AIRTEL'] },
  { code: 'TD', name: 'Tchad', prefix: '+235', flag: '🇹🇩', operators: ['MOOV', 'AIRTEL'] },
] as const;

export type Country = typeof COUNTRIES[number];

// Detect country from a full phone number
export function detectCountryFromPhone(phone: string): Country {
  for (const country of COUNTRIES) {
    if (phone.startsWith(country.prefix)) return country;
  }
  return COUNTRIES[0]; // Default to Bénin
}

