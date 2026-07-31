import { NextResponse } from 'next/server';
import { createCheckoutSession } from '@/lib/senepay';

export async function GET(req: Request) {
  try {
    const session = await createCheckoutSession({
      amount: 500,
      currency: 'XOF',
      orderReference: `TEST_ENV_${Date.now()}`,
      description: 'Test de validation de clé SenePay API',
      returnUrl: 'https://winary.live/home',
      cancelUrl: 'https://winary.live/home',
      webhookUrl: 'https://winary.live/api/webhooks/senepay',
      metadata: { test: true },
    });

    return NextResponse.json({
      success: true,
      message: 'La clé API SenePay fonctionne parfaitement !',
      session,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Erreur lors du test SenePay',
      },
      { status: 500 }
    );
  }
}
