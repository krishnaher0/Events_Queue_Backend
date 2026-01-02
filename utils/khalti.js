// Khalti ePayment Configuration (KPG-2 Web Checkout)
const KHALTI_CONFIG = {
  test: {
    url: 'https://dev.khalti.com/api/v2/epayment/initiate/',
    lookupUrl: 'https://dev.khalti.com/api/v2/epayment/lookup/',
    paymentUrl: 'https://test-pay.khalti.com/', // Redirect URL base
  },
  production: {
    url: 'https://khalti.com/api/v2/epayment/initiate/',
    lookupUrl: 'https://khalti.com/api/v2/epayment/lookup/',
    paymentUrl: 'https://pay.khalti.com/',
  },
};

const getConfig = () => {
  const env = process.env.KHALTI_ENVIRONMENT || 'test';
  return KHALTI_CONFIG[env];
};

// Get authorization header
const getAuthHeader = () => {
  const secretKey = process.env.KHALTI_SECRET_KEY;
  return {
    'Authorization': `Key ${secretKey}`,
    'Content-Type': 'application/json',
  };
};

// Initiate Khalti payment
export const initiateKhaltiPayment = async ({
  returnUrl,
  websiteUrl,
  amount, // Amount in paisa (1 NPR = 100 paisa)
  purchaseOrderId,
  purchaseOrderName,
  customerInfo = {},
  amountBreakdown = [],
  productDetails = [],
  merchantExtra = '',
}) => {
  const config = getConfig();

  const payload = {
    return_url: returnUrl,
    website_url: websiteUrl,
    amount: amount, // Must be in paisa
    purchase_order_id: purchaseOrderId,
    purchase_order_name: purchaseOrderName,
  };

  // Add optional fields if provided
  if (customerInfo && Object.keys(customerInfo).length > 0) {
    payload.customer_info = customerInfo;
  }

  if (amountBreakdown && amountBreakdown.length > 0) {
    payload.amount_breakdown = amountBreakdown;
  }

  if (productDetails && productDetails.length > 0) {
    payload.product_details = productDetails;
  }

  if (merchantExtra) {
    payload.merchant_extra = merchantExtra;
  }

  console.log('Khalti Payment Initiation Payload:', JSON.stringify(payload, null, 2));
  console.log('Khalti API URL:', config.url);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('Khalti Initiation Response:', data);

    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Failed to initiate Khalti payment');
    }

    return data;
  } catch (error) {
    console.error('Khalti payment initiation error:', error);
    throw error;
  }
};

// Verify/Lookup Khalti payment
export const verifyKhaltiPayment = async (pidx) => {
  const config = getConfig();

  console.log('Verifying Khalti payment with pidx:', pidx);

  try {
    const response = await fetch(config.lookupUrl, {
      method: 'POST',
      headers: getAuthHeader(),
      body: JSON.stringify({ pidx }),
    });

    const data = await response.json();
    console.log('Khalti Lookup Response:', data);

    if (!response.ok) {
      throw new Error(data.detail || data.message || 'Failed to verify Khalti payment');
    }

    return data;
  } catch (error) {
    console.error('Khalti verification error:', error);
    throw error;
  }
};

// Get Khalti payment URL (for redirect)
export const getKhaltiPaymentUrl = () => {
  return getConfig().paymentUrl;
};

// Check if payment is completed
export const isKhaltiPaymentComplete = (lookupResponse) => {
  return lookupResponse.status === 'Completed';
};

export default {
  initiateKhaltiPayment,
  verifyKhaltiPayment,
  getKhaltiPaymentUrl,
  isKhaltiPaymentComplete,
};
