/**
 * Integrity Verification Routes
 * Handles Play Integrity token verification requests
 */

const express = require('express');
const router = express.Router();
const { verifyPlayIntegrityToken, INTEGRITY_LEVEL } = require('../services/playIntegrity');
const { signResponse } = require('../services/responseSigner');
const crypto = require('crypto');

// Request validation middleware
const validateRequest = (req, res, next) => {
  const { integrityToken, nonce, requestId } = req.body;
  
  const errors = [];
  
  if (!integrityToken || typeof integrityToken !== 'string') {
    errors.push('integrityToken is required and must be a string');
  }
  
  if (!nonce || typeof nonce !== 'string') {
    errors.push('nonce is required and must be a string');
  }
  
  if (nonce && (nonce.length < 16 || nonce.length > 500)) {
    errors.push('nonce must be between 16 and 500 characters');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    });
  }
  
  next();
};

/**
 * POST /api/integrity/verify
 * Verify Play Integrity token
 * 
 * Request Body:
 * {
 *   "integrityToken": "<base64-encoded-token>",
 *   "nonce": "<original-nonce-string>",
 *   "requestId": "<optional-client-request-id>"
 * }
 * 
 * Response Body (signed):
 * {
 *   "data": {
 *     "success": true,
 *     "level": "STRONG_INTEGRITY" | "BASIC_INTEGRITY" | "UNTRUSTED" | "UNABLE_TO_VERIFY",
 *     "description": "...",
 *     "timestamp": "...",
 *     "requestId": "..."
 *   },
 *   "signature": {
 *     "version": "v1",
 *     "algorithm": "sha256",
 *     "timestamp": 1234567890,
 *     "value": "<base64-signature>"
 *   }
 * }
 */
router.post('/verify', validateRequest, async (req, res, next) => {
  try {
    const { integrityToken, nonce, requestId } = req.body;
    
    // Generate unique request ID if not provided
    const responseRequestId = requestId || crypto.randomUUID();
    
    // Verify the Play Integrity token
    const verificationResult = await verifyPlayIntegrityToken(integrityToken, nonce);
    
    // Build response payload
    const payload = {
      success: verificationResult.success,
      level: verificationResult.level,
      description: verificationResult.description,
      timestamp: new Date().toISOString(),
      requestId: responseRequestId,
    };
    
    // Add verdict details for successful verifications (sanitized)
    if (verificationResult.success && verificationResult.verdicts) {
      payload.verdicts = {
        meetsStrongIntegrity: verificationResult.verdicts.meetsStrongIntegrity,
        meetsBasicIntegrity: verificationResult.verdicts.meetsBasicIntegrity,
        meetsDeviceIntegrity: verificationResult.verdicts.meetsDeviceIntegrity,
      };
    }
    
    // Add error details for failed verifications
    if (!verificationResult.success && verificationResult.error) {
      payload.error = verificationResult.error;
      payload.errorCode = verificationResult.code;
    }
    
    // Sign the response
    const signedResponse = signResponse(payload);
    
    // Set cache control headers to prevent caching
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    
    res.json(signedResponse);
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/integrity/levels
 * Get information about integrity levels (public endpoint)
 */
router.get('/levels', (req, res) => {
  const levels = {
    [INTEGRITY_LEVEL.STRONG]: {
      name: 'Strong Integrity',
      description: 'Device has hardware-backed attestation, locked bootloader, and official Android build.',
      indicators: [
        'Hardware-backed key attestation',
        'Bootloader is locked',
        'Official Android build from OEM',
        'Passes all CTS tests',
      ],
    },
    [INTEGRITY_LEVEL.BASIC]: {
      name: 'Basic Integrity',
      description: 'Device has passed CTS (Compatibility Test Suite) with no obvious system compromise.',
      indicators: [
        'Passes basic CTS tests',
        'No obvious signs of rooting',
        'No known tampering detected',
      ],
    },
    [INTEGRITY_LEVEL.UNTRUSTED]: {
      name: 'Untrusted',
      description: 'Device appears to be rooted, running a custom ROM, emulator, or has been tampered with.',
      indicators: [
        'Root access detected',
        'Custom ROM installed',
        'Running in emulator',
        'System files modified',
      ],
    },
    [INTEGRITY_LEVEL.UNKNOWN]: {
      name: 'Unable to Verify',
      description: 'Unable to determine device integrity status due to verification failure or network issues.',
      indicators: [
        'Verification failed',
        'Network error',
        'API error',
        'Invalid token',
      ],
    },
  };
  
  res.json({
    levels,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;