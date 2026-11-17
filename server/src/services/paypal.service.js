const PAYPAL_API_BASE =
  process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtiene un access token de PayPal OAuth v2 usando Client Credentials
 */
export async function getPayPalAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de PayPal (CLIENT_ID / CLIENT_SECRET) no configuradas');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error obteniendo token de PayPal (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}

/**
 * Crea una orden en PayPal Orders API v2
 */
export async function createPayPalOrder({ orderId, amount, currency = 'USD' }) {
  const accessToken = await getPayPalAccessToken();

  const formattedAmount = Number(amount).toFixed(2);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: orderId.toString(),
        custom_id: orderId.toString(),
        description: `Pedido LibroYa #${orderId}`,
        amount: {
          currency_code: currency,
          value: formattedAmount,
        },
      },
    ],
  };

  const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error_description || 'Error creando orden en PayPal');
  }

  return data;
}

/**
 * Captura el pago de una orden previamente aprobada en PayPal
 */
export async function capturePayPalOrder(providerOrderId) {
  const accessToken = await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_API_BASE}/v2/checkout/orders/${providerOrderId}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message ||
        data.details?.[0]?.description ||
        data.error_description ||
        'Error capturando el pago en PayPal'
    );
  }

  return data;
}

