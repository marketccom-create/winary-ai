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

// Extract reference & validate full copy-pasted SMS or standalone transaction reference (with strict price & ID verification)
export function extractAndValidateReference(
  operator: string,
  input: string,
  expectedPriceCents?: number
): { isValid: boolean; extractedRef?: string; reason?: string } {
  const cleaned = input.trim();

  // 1. Mandatory check: Must not be empty
  if (!cleaned || cleaned.length < 8) {
    return {
      isValid: false,
      reason: "Le message SMS ou la référence est obligatoire et doit être valide (minimum 8 caractères)."
    };
  }

  // 2. Strict Price Check (if expectedPriceCents is provided)
  if (expectedPriceCents && expectedPriceCents > 0) {
    const expectedAmount = Math.round(expectedPriceCents / 100);
    // Patterns to look for in SMS: 4000F, 4000 F, 4 000F, 4.000F, or exact number 4000
    const amountRegex = new RegExp(`\\b${expectedAmount}\\s*(F|XOF|FCFA)?\\b`, 'i');
    
    // Formatted price with space/dot (ex: 4 000 or 4.000)
    const formattedStr = expectedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '[\\s\\.]?');
    const formattedAmountRegex = new RegExp(`\\b${formattedStr}\\s*(F|XOF|FCFA)?\\b`, 'i');

    const hasPriceMatch = amountRegex.test(cleaned) || formattedAmountRegex.test(cleaned);

    if (!hasPriceMatch) {
      return {
        isValid: false,
        reason: `Le montant indiqué dans votre SMS ne correspond pas au prix du bot (${expectedAmount.toLocaleString('fr-FR')} FCFA).`
      };
    }
  }

  // 3. Search for ID:xxx or Ref:xxx or Txn:xxx
  let extractedRef = '';
  const idMatch = cleaned.match(/ID\s*:\s*([A-Za-z0-9]+)/i) ||
                  cleaned.match(/Ref\s*:\s*([A-Za-z0-9]+)/i) ||
                  cleaned.match(/Txn\s*:\s*([A-Za-z0-9]+)/i);

  if (idMatch && idMatch[1]) {
    extractedRef = idMatch[1];
  } else {
    // Search for standalone numeric sequence of 9 to 16 digits
    const numMatch = cleaned.match(/\b\d{9,16}\b/);
    if (numMatch) {
      extractedRef = numMatch[0];
    } else if (cleaned.length >= 8 && cleaned.length <= 32 && !cleaned.includes(' ')) {
      extractedRef = cleaned;
    }
  }

  if (!extractedRef || extractedRef.length < 8) {
    return {
      isValid: false,
      reason: "Aucun identifiant ou référence de transaction valide (minimum 8 caractères) n'a été trouvé dans le message SMS."
    };
  }

  const op = operator.toUpperCase();

  // 4. Operator Specific Strict Validation
  if (op === 'MTN') {
    const isSmsFormat = /Paiement|Frais|Solde|ID:|Ref:|ONAFRIQ/i.test(cleaned);
    const mtnRefRegex = /^\d{9,16}$/;

    if (isSmsFormat && (idMatch || mtnRefRegex.test(extractedRef))) {
      return { isValid: true, extractedRef };
    }

    if (mtnRefRegex.test(cleaned)) {
      return { isValid: true, extractedRef: cleaned };
    }

    return {
      isValid: false,
      reason: "Format de SMS MTN MoMo invalide (veuillez coller le message SMS de confirmation officiel reçu de MTN)."
    };
  }

  if (op === 'MOOV') {
    const isSmsFormat = /Paiement|Transfert|Frais|Solde|Ref:|ID:|Txn/i.test(cleaned);
    const moovRefRegex = /^[A-Za-z0-9\.\_\-]{8,24}$/;

    if (isSmsFormat && extractedRef.length >= 8) {
      return { isValid: true, extractedRef };
    }

    if (moovRefRegex.test(cleaned)) {
      return { isValid: true, extractedRef: cleaned };
    }

    return {
      isValid: false,
      reason: "Format de SMS Moov Money invalide (veuillez coller le message SMS de confirmation officiel reçu de Moov)."
    };
  }

  return { isValid: true, extractedRef };
}

export function validateTransactionReference(operator: string, ref: string, expectedPriceCents?: number): { isValid: boolean; reason?: string } {
  const result = extractAndValidateReference(operator, ref, expectedPriceCents);
  return { isValid: result.isValid, reason: result.reason };
}

