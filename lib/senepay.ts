import crypto from 'crypto';

const SENEPAY_BASE_URL = 'https://api.sene-pay.com';

export interface CheckoutSessionParams {
  amount: number;
  currency: string;
  orderReference: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  country?: string;
  metadata?: Record<string, any>;
  expiresInMinutes?: number;
}

export interface CheckoutSessionResponse {
  sessionToken: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  orderReference: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Initiates a Sene-Pay Checkout Session
 */
export async function createCheckoutSession(
  params: CheckoutSessionParams
): Promise<CheckoutSessionResponse> {
  const apiKey = process.env.SENEPAY_API_KEY;
  const apiSecret = process.env.SENEPAY_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Sene-Pay API Key or Secret is missing in environment variables.');
  }

  const response = await fetch(`${SENEPAY_BASE_URL}/api/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'X-Api-Secret': apiSecret,
    },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || `Sene-Pay error (status ${response.status})`);
  }

  return data as CheckoutSessionResponse;
}

/**
 * Verifies Sene-Pay Webhook signature using HMAC-SHA256
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.SENEPAY_WEBHOOK_SECRET;
  if (!secret || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // Use timingSafeEqual to avoid timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return signature === expected;
  }
}
