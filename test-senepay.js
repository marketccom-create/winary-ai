const apiKey = 'pk_live_bfad9d752d7cbc19de15e8febf701d93d3e5289b1995a49d';
const apiSecret = 'sk_live_e23396962cc602bfc2ec4723f5e9392b4c1b7c780beae778';

async function testSenePay() {
  console.log('Testing SenePay Checkout Session creation...');
  const payload = {
    amount: 1000,
    currency: 'XOF',
    orderReference: `TEST_${Date.now()}`,
    description: 'Test de connexion SenePay',
    returnUrl: 'https://winary-ai.vercel.app/payment/success',
    cancelUrl: 'https://winary-ai.vercel.app/payment/cancel',
    webhookUrl: 'https://winary-ai.vercel.app/api/webhooks/senepay'
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

    if (res.ok) {
      console.log('\n✅ TEST SÉNEPAY RÉUSSI ! La clé fonctionne parfaitement.');
      console.log('Checkout URL générée :', data.checkoutUrl || data.url || data.sessionToken);
    } else {
      console.log('\n❌ ÉCHEC DU TEST SÉNEPAY :', data.message || data.error);
    }
  } catch (err) {
    console.error('Erreur réseau ou d execution :', err);
  }
}

testSenePay();
