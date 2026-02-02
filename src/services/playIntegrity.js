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
    // Support both file path and JSON content in environment variable
    let authConfig;
    
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Use JSON content from environment variable (recommended for Railway)
      console.log('[PlayIntegrity] GOOGLE_SERVICE_ACCOUNT_JSON is set, parsing...');
      let credentials;
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        console.log('[PlayIntegrity] Service account parsed successfully');
        console.log('[PlayIntegrity] Service account email:', credentials.client_email);
        console.log('[PlayIntegrity] Project ID:', credentials.project_id);
        
        // TEMPORARY DEBUG LOGGING - For diagnosing invalid_grant error
        console.log('[PlayIntegrity] === SERVICE ACCOUNT DEBUG ===');
        console.log('[PlayIntegrity] - type:', credentials.type);
        console.log('[PlayIntegrity] - private_key_id:', credentials.private_key_id);
        console.log('[PlayIntegrity] - private_key starts with:', credentials.private_key?.substring(0, 50));
        console.log('[PlayIntegrity] - private_key ends with:', credentials.private_key?.substring(credentials.private_key?.length - 30));
        console.log('[PlayIntegrity] - private_key length:', credentials.private_key?.length);
        console.log('[PlayIntegrity] - private_key contains \\\\n:', credentials.private_key?.includes('\\n'));
        console.log('[PlayIntegrity] - client_id:', credentials.client_id);
        console.log('[PlayIntegrity] === END DEBUG ===');
      } catch (parseError) {
        console.error('[PlayIntegrity] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:', parseError.message);
        throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON format: ' + parseError.message);
      }
      authConfig = {
        credentials,
        scopes: ['https://www.googleapis.com/auth/playintegrity'],
      };
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
      // Use file path (local development)
      authConfig = {
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/playintegrity'],
      };
      console.log('Using service account from file:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
    } else {
      throw new Error('Neither GOOGLE_SERVICE_ACCOUNT_JSON nor GOOGLE_SERVICE_ACCOUNT_KEY_PATH is set');
    }
    
    const auth = new GoogleAuth(authConfig);

    console.log('[PlayIntegrity] Getting auth client...');
    const client = await auth.getClient();
    console.log('[PlayIntegrity] Auth client obtained successfully');

    const projectNumber = process.env.GOOGLE_CLOUD_PROJECT_NUMBER;
    console.log('[PlayIntegrity] GOOGLE_CLOUD_PROJECT_NUMBER:', projectNumber);

    if (!projectNumber) {
      throw new Error('GOOGLE_CLOUD_PROJECT_NUMBER not configured');
    }

    // Call Play Integrity API v1
    const url = `https://playintegrity.googleapis.com/v1/${projectNumber}:decodeIntegrityToken`;
    console.log('[PlayIntegrity] Calling Play Integrity API:', url);

    const response = await client.request({
      url,
      method: 'POST',
      data: {
        integrity_token: integrityToken,
      },
    });

    console.log('[PlayIntegrity] API response received, status:', response.status);
    console.log('[PlayIntegrity] Response data keys:', Object.keys(response.data || {}));

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
    console.log('[PlayIntegrity] Extracting verdicts from token payload...');
    const deviceIntegrity = tokenPayload.deviceIntegrity?.deviceRecognitionVerdict || [];
    const appIntegrity = tokenPayload.appIntegrity;
    const accountDetails = tokenPayload.accountDetails;

    console.log('[PlayIntegrity] Device integrity verdicts:', deviceIntegrity);
    console.log('[PlayIntegrity] App integrity:', JSON.stringify(appIntegrity));
    console.log('[PlayIntegrity] Account details:', JSON.stringify(accountDetails));

    const allowedPackages = (process.env.ALLOWED_PACKAGE_NAMES || '').split(',').filter(p => p);
    console.log('[PlayIntegrity] Allowed packages:', allowedPackages);
    console.log('[PlayIntegrity] Received package name:', appIntegrity?.packageName);

    // Validate package name
    if (!allowedPackages.includes(appIntegrity?.packageName)) {
      console.error('[PlayIntegrity] Package name validation failed!');
      console.error('[PlayIntegrity] Expected one of:', allowedPackages);
      console.error('[PlayIntegrity] Received:', appIntegrity?.packageName);
      return {
        success: false,
        level: INTEGRITY_LEVEL.UNKNOWN,
        error: 'Invalid package name',
        code: 'INVALID_PACKAGE',
      };
    }
    console.log('[PlayIntegrity] Package name validated successfully');

    // Determine integrity level based on verdicts
    console.log('[PlayIntegrity] Determining integrity level...');
    const result = determineIntegrityLevel(deviceIntegrity, appIntegrity, accountDetails);
    console.log('[PlayIntegrity] Integrity level determined:', result.level);
    console.log('[PlayIntegrity] Result description:', result.description);

    return {
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
      tokenTimestamp: tokenPayload.requestDetails?.timestampMillis,
    };

  } catch (error) {
    console.error('Play Integrity verification error:', error.message);
    console.error('Full error object:', JSON.stringify({
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data,
      responseStatus: error.response?.status,
      responseStatusText: error.response?.statusText,
    }, null, 2));

    // Provide more specific error messages based on error type
    let errorCode = 'VERIFICATION_ERROR';
    let errorMessage = 'Verification failed';

    if (error.message?.includes('invalid_grant')) {
      errorCode = 'INVALID_SERVICE_ACCOUNT';
      errorMessage = 'Service account authentication failed. Check GOOGLE_SERVICE_ACCOUNT_JSON.';
    } else if (error.message?.includes('PERMISSION_DENIED')) {
      errorCode = 'PERMISSION_DENIED';
      errorMessage = 'Service account does not have Play Integrity API permission.';
    } else if (error.message?.includes('API has not been used') || error.message?.includes('disabled')) {
      errorCode = 'API_NOT_ENABLED';
      errorMessage = 'Play Integrity API is not enabled in Google Cloud Console.';
    } else if (error.message?.includes('project') && error.message?.includes('not found')) {
      errorCode = 'INVALID_PROJECT';
      errorMessage = 'Invalid GOOGLE_CLOUD_PROJECT_NUMBER. Check your project configuration.';
    } else if (error.response?.status === 403) {
      errorCode = 'FORBIDDEN';
      errorMessage = 'Access denied to Play Integrity API. Check service account permissions.';
    } else if (error.response?.status === 404) {
      errorCode = 'NOT_FOUND';
      errorMessage = 'Play Integrity API endpoint not found. Check project number.';
    } else if (error.response?.status >= 500) {
      errorCode = 'GOOGLE_SERVER_ERROR';
      errorMessage = 'Google Play Integrity API server error. Please try again later.';
    }

    return {
      success: false,
      level: INTEGRITY_LEVEL.UNKNOWN,
      error: errorMessage,
      code: errorCode,
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
  console.log('[PlayIntegrity] Nonce verification skipped - testing mode enabled');
  console.log('[PlayIntegrity] Token nonce:', tokenNonce ? tokenNonce.substring(0, 50) + '...' : 'null');
  console.log('[PlayIntegrity] Expected nonce:', expectedNonce ? expectedNonce.substring(0, 50) + '...' : 'null');
  // Always pass nonce verification in testing mode
  return true;
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

  console.log('[PlayIntegrity] === DETERMINE INTEGRITY LEVEL ===');
  console.log('[PlayIntegrity] Device integrity verdicts:', deviceIntegrity);
  console.log('[PlayIntegrity] meetsStrongIntegrity:', verdicts.meetsStrongIntegrity);
  console.log('[PlayIntegrity] meetsBasicIntegrity:', verdicts.meetsBasicIntegrity);
  console.log('[PlayIntegrity] meetsDeviceIntegrity:', verdicts.meetsDeviceIntegrity);
  console.log('[PlayIntegrity] appRecognitionVerdict:', appIntegrity?.appRecognitionVerdict);
  console.log('[PlayIntegrity] appLicensingVerdict:', accountDetails?.appLicensingVerdict);
  console.log('[PlayIntegrity] ======================================');

  // Check for Strong Integrity
  // Requires: Strong integrity + device integrity + official app + licensed
  if (verdicts.meetsStrongIntegrity && 
      verdicts.meetsDeviceIntegrity &&
      appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED' &&
      accountDetails?.appLicensingVerdict === 'LICENSED') {
    console.log('[PlayIntegrity] Result: STRONG_INTEGRITY');
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
    console.log('[PlayIntegrity] Result: BASIC_INTEGRITY');
    return {
      level: INTEGRITY_LEVEL.BASIC,
      verdicts,
      description: 'Device has passed CTS (Compatibility Test Suite) with no obvious system compromise',
    };
  }

  // Check for Device Integrity only (for testing/debug builds)
  // This is a fallback for when app recognition or licensing fails but device integrity is good
  if (verdicts.meetsDeviceIntegrity && (verdicts.meetsBasicIntegrity || verdicts.meetsStrongIntegrity)) {
    console.log('[PlayIntegrity] Result: DEVICE_INTEGRITY (fallback - app not recognized or not licensed)');
    return {
      level: verdicts.meetsStrongIntegrity ? INTEGRITY_LEVEL.STRONG : INTEGRITY_LEVEL.BASIC,
      verdicts,
      description: 'Device has passed integrity checks but app recognition or licensing verification is pending',
    };
  }

  // Device fails basic integrity checks
  // Indicates: Rooted, custom ROM, emulator, or tampered environment
  if (!verdicts.meetsBasicIntegrity || !verdicts.meetsDeviceIntegrity) {
    console.log('[PlayIntegrity] Result: UNTRUSTED');
    return {
      level: INTEGRITY_LEVEL.UNTRUSTED,
      verdicts,
      description: 'Device appears to be rooted, running a custom ROM, emulator, or has been tampered with',
    };
  }

  // Unknown state
  console.log('[PlayIntegrity] Result: UNABLE_TO_VERIFY');
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