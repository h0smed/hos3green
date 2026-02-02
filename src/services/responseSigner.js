/**
 * Response Signing Service
 * Signs API responses with HMAC to prevent tampering
 */

const crypto = require('crypto');

const ALGORITHM = 'sha256';
const SIGNATURE_VERSION = 'v1';

/**
 * Sign a response payload with HMAC
 * @param {Object} payload - The response data to sign
 * @returns {Object} Signed response with signature metadata
 */
function signResponse(payload) {
  const signingKey = process.env.RESPONSE_SIGNING_KEY;
  
  if (!signingKey) {
    console.error('RESPONSE_SIGNING_KEY not configured');
    throw new Error('Server configuration error');
  }

  // Create canonical string for signing
  const timestamp = Date.now();
  const payloadString = JSON.stringify(payload);
  const canonicalString = `${SIGNATURE_VERSION}:${timestamp}:${payloadString}`;
  
  // Generate HMAC signature
  const signature = crypto
    .createHmac(ALGORITHM, signingKey)
    .update(canonicalString)
    .digest('base64');

  return {
    data: payload,
    signature: {
      version: SIGNATURE_VERSION,
      algorithm: ALGORITHM,
      timestamp,
      value: signature,
    },
  };
}

/**
 * Verify a signed response (for testing purposes)
 * @param {Object} signedResponse - The signed response
 * @returns {boolean}
 */
function verifyResponse(signedResponse) {
  try {
    const signingKey = process.env.RESPONSE_SIGNING_KEY;
    
    if (!signingKey) {
      return false;
    }

    const { data, signature } = signedResponse;
    const payloadString = JSON.stringify(data);
    const canonicalString = `${signature.version}:${signature.timestamp}:${payloadString}`;
    
    const expectedSignature = crypto
      .createHmac(signature.algorithm || ALGORITHM, signingKey)
      .update(canonicalString)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature.value),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

module.exports = {
  signResponse,
  verifyResponse,
};