import crypto from 'crypto';

// eSewa ePay Configuration
// Using the stable test endpoint
const ESEWA_CONFIG = {
  test: {
    // ePay v2 form endpoint
    url: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form',
    verifyUrl: 'https://rc.esewa.com.np/api/epay/transaction/status/',
  },
  production: {
    url: 'https://epay.esewa.com.np/api/epay/main/v2/form',
    verifyUrl: 'https://esewa.com.np/api/epay/transaction/status/',
  },
};

const getConfig = () => {
  const env = process.env.ESEWA_ENVIRONMENT || 'test';
  return ESEWA_CONFIG[env];
};

// Generate HMAC SHA256 signature for eSewa
export const generateEsewaSignature = (message) => {
  const secretKey = process.env.ESEWA_SECRET_KEY;
  console.log('Generating signature for message:', message);
  console.log('Using secret key:', secretKey);
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(message);
  const signature = hmac.digest('base64');
  console.log('Generated signature:', signature);
  return signature;
};

// Create payment payload for eSewa
export const createEsewaPayment = ({
  amount,
  taxAmount = 0,
  productServiceCharge = 0,
  productDeliveryCharge = 0,
  transactionUuid,
  successUrl,
  failureUrl,
}) => {
  const totalAmount = amount + taxAmount + productServiceCharge + productDeliveryCharge;
  const merchantId = process.env.ESEWA_MERCHANT_ID;

  // Message format for signature: total_amount,transaction_uuid,product_code
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${merchantId}`;
  const signature = generateEsewaSignature(message);

  return {
    amount: amount.toString(),
    tax_amount: taxAmount.toString(),
    product_service_charge: productServiceCharge.toString(),
    product_delivery_charge: productDeliveryCharge.toString(),
    total_amount: totalAmount.toString(),
    transaction_uuid: transactionUuid,
    product_code: merchantId,
    success_url: successUrl,
    failure_url: failureUrl,
    signed_field_names: 'total_amount,transaction_uuid,product_code',
    signature,
  };
};

// Get eSewa payment URL
export const getEsewaPaymentUrl = () => {
  return getConfig().url;
};

// Verify eSewa payment
export const verifyEsewaPayment = async (transactionUuid, totalAmount) => {
  const config = getConfig();
  const merchantId = process.env.ESEWA_MERCHANT_ID;

  try {
    const response = await fetch(
      `${config.verifyUrl}?product_code=${merchantId}&total_amount=${totalAmount}&transaction_uuid=${transactionUuid}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('eSewa verification error:', error);
    throw error;
  }
};

// Decode eSewa response (base64 encoded)
export const decodeEsewaResponse = (encodedData) => {
  try {
    const decoded = Buffer.from(encodedData, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Error decoding eSewa response:', error);
    return null;
  }
};

// Verify signature from eSewa callback
export const verifyEsewaSignature = (data, receivedSignature) => {
  const { total_amount, transaction_uuid, product_code } = data;
  const message = `total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code}`;
  const calculatedSignature = generateEsewaSignature(message);
  return calculatedSignature === receivedSignature;
};

export default {
  createEsewaPayment,
  getEsewaPaymentUrl,
  verifyEsewaPayment,
  decodeEsewaResponse,
  verifyEsewaSignature,
  generateEsewaSignature,
};
