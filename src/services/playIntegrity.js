/**
 * Google Play Integrity API Service
 * Handles token verification and integrity verdict extraction
 */

const { GoogleAuth } = require('google-auth-library');
const crypto = require('crypto');

// Integrity level constants
const INTEGRITY_LEVEL = {
  STRONG: 'STRONG_INTEGRITY',
  BASIC: 'BASIC_INTEGRITY',
  UNTRUSTED: 'UNTRUSTED',
  UNKNOWN: 'UNABLE_TO_VERIFY',
};

// Verdict labels from Play Integrity API
const VERDICT_LABELS = {
  MEETS_STRONG_INTEGRITY: 'MEETS_STRONG_INTEGRITY',
  MEETS_BASIC_INTEGRITY: 'MEETS_BASIC_INTEGRITY',
  MEETS_DEVICE_INTEGRITY: 'MEETS_DEVICE_INTEGRITY',
};

/**
 * Verify Play Integrity token with Google Play Integrity API
 * @param {string} integrityToken - The token from Play Integrity API
 * @param {string} nonce - The original nonce used to request the token
 * @returns {Promise<Object>} Verification result
 */
async function verifyPlayIntegrityToken(integrityToken, nonce) {
  try {
    // Initialize Google Auth with service account
    const auth = new GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/playintegrity'],
    });

    const client = await auth.getClient();
    const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;

    if (!projectNumber) {
      throw new Error('GOOGLE_CLOUD_PROJECT_NUMBER not configured');
    }

    // Call Play Integrity API v1
    const url = `https://playintegrity.googleapis.com/v1/${projectNumber}:decodeIntegrityToken`;
    
    const response = await client.request({
      url,
      method: 'POST',
      data: {
        integrity_token: integrityToken,
      },
    });

    const tokenPayload = response.data.tokenPayloadExternal;

    // Verify nonce matches (replay protection)
    if (!verifyNonce(tokenPayload.requestDetails?.nonce, nonce)) {
      return {
        success: false,
        level: INTEGRITY_LEVEL.UNKNOWN,
        error: 'Nonce mismatch - possible replay attack',
        code: 'NONCE_MISMATCH',
      };
    }

    // Extract verdicts
    const deviceIntegrity = tokenPayload.deviceIntegrity?.deviceRecognitionVerdict || [];
    const appIntegrity = tokenPayload.appIntegrity;
    const accountDetails = tokenPayload.accountDetails;

    // Validate package name
    const allowedPackages = (process.env.ALLOWED_PACKAGE_NAMES || '').split(',');
    if (!allowedPackages.includes(appIntegrity?.packageName)) {
      return {
        success: false,
        level: INTEGRITY_LEVEL.UNKNOWN,
        error: 'Invalid package name',
        code: 'INVALID_PACKAGE',
      };
    }

    // Determine integrity level based on verdicts
    const result = determineIntegrityLevel(deviceIntegrity, appIntegrity, accountDetails);
    
    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
      tokenTimestamp: tokenPayload.requestDetails?.timestampMillis,
    };

  } catch (error) {
    console.error('Play Integrity verification error:', error.message);
    
    return {
      success: false,
      level: INTEGRITY_LEVEL.UNKNOWN,
      error: 'Verification failed',
      code: 'VERIFICATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}

/**
 * Verify that the nonce from the token matches the expected nonce
 * @param {string} tokenNonce - Base64 encoded nonce from token
 * @param {string} expectedNonce - The original nonce string
 * @returns {boolean}
 */
function verifyNonce(tokenNonce, expectedNonce) {
  if (!tokenNonce || !expectedNonce) {
    return false;
  }
  
  try {
    // Decode base64 nonce from token
    const decodedTokenNonce = Buffer.from(tokenNonce, 'base64').toString('utf-8');
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(decodedTokenNonce),
      Buffer.from(expectedNonce)
    );
  } catch (error) {
    console.error('Nonce verification error:', error.message);
    return false;
  }
}

/**
 * Determine the integrity level based on Play Integrity verdicts
 * @param {Array} deviceIntegrity - Device recognition verdicts
 * @param {Object} appIntegrity - App integrity details
 * @param {Object} accountDetails - Account licensing details
 * @returns {Object}
 */
function determineIntegrityLevel(deviceIntegrity, appIntegrity, accountDetails) {
  const verdicts = {
    meetsStrongIntegrity: deviceIntegrity.includes(VERDICT_LABELS.MEETS_STRONG_INTEGRITY),
    meetsBasicIntegrity: deviceIntegrity.includes(VERDICT_LABELS.MEETS_BASIC_INTEGRITY),
    meetsDeviceIntegrity: deviceIntegrity.includes(VERDICT_LABELS.MEETS_DEVICE_INTEGRITY),
    appRecognitionVerdict: appIntegrity?.appRecognitionVerdict,
    licensingVerdict: accountDetails?.appLicensingVerdict,
  };

  // Check for Strong Integrity
  // Requires: Strong integrity + device integrity + official app + licensed
  if (verdicts.meetsStrongIntegrity && 
      verdicts.meetsDeviceIntegrity &&
      appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED' &&
      accountDetails?.appLicensingVerdict === 'LICENSED') {
    return {
      level: INTEGRITY_LEVEL.STRONG,
      verdicts,
      description: 'Device has hardware-backed attestation, locked bootloader, and official Android build',
    };
  }

  // Check for Basic Integrity
  // Requires: Basic integrity + device integrity + official app
  if (verdicts.meetsBasicIntegrity && 
      verdicts.meetsDeviceIntegrity &&
      appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED') {
    return {
      level: INTEGRITY_LEVEL.BASIC,
      verdicts,
      description: 'Device has passed CTS (Compatibility Test Suite) with no obvious system compromise',
    };
  }

  // Device fails basic integrity checks
  // Indicates: Rooted, custom ROM, emulator, or tampered environment
  if (!verdicts.meetsBasicIntegrity || !verdicts.meetsDeviceIntegrity) {
    return {
      level: INTEGRITY_LEVEL.UNTRUSTED,
      verdicts,
      description: 'Device appears to be rooted, running a custom ROM, emulator, or has been tampered with',
    };
  }

  // Unknown state
  return {
    level: INTEGRITY_LEVEL.UNKNOWN,
    verdicts,
    description: 'Unable to determine device integrity status',
  };
}

module.exports = {
  verifyPlayIntegrityToken,
  INTEGRITY_LEVEL,
  VERDICT_LABELS,
};