// Script de test SenePay - utilise les variables d'environnement
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.SENEPAY_API_KEY;
const apiSecret = process.env.SENEPAY_API_SECRET;

async function testSenePay() {
  if (!apiKey || !apiSecret) {
    console.error('Clefs SenePay introuvables dans .env.local');
    return;
  }
  console.log('Testing SenePay Checkout Session creation...');
  const payload = {
    amount: 1000,
    currency: 'XOF',
    orderReference: `TEST_${Date.now()}`,
    description: 'Test de connexion SenePay',
    returnUrl: 'https://winary.live/home',
    cancelUrl: 'https://winary.live/home',
    webhookUrl: 'https://winary.live/api/webhooks/senepay'
  };

  try {
    const res = await fetch('https://api.sene-pay.com/api/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
      },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    console.log('HTTP Status:', status);
    const data = await res.json();
    console.log('Response body:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erreur :', err);
  }
}

testSenePay();
