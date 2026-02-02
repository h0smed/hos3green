# Hos3Green API Contract

## Base URL
```
Production: https://api.hos3green.example.com/api
Development: http://localhost:3000/api
```

## Authentication
This API does not use traditional authentication. Instead, it relies on:
- Google Play Integrity tokens for device verification
- HMAC-signed responses for integrity
- Rate limiting for abuse prevention

## Endpoints

### 1. Verify Play Integrity Token

**Endpoint:** `POST /integrity/verify`

**Description:** Verifies a Play Integrity token and returns the device's integrity level.

#### Request

**Headers:**
```
Content-Type: application/json
X-Request-ID: <optional-uuid>
```

**Body:**
```json
{
  "integrityToken": "<base64-encoded-play-integrity-token>",
  "nonce": "<original-nonce-string-min-16-chars>",
  "requestId": "<optional-client-request-id>"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| integrityToken | string | Yes | The token obtained from Play Integrity API |
| nonce | string | Yes | The original nonce used to request the token (16-500 chars) |
| requestId | string | No | Client-generated request ID for tracking |

#### Response

**Success (200 OK):**
```json
{
  "data": {
    "success": true,
    "level": "STRONG_INTEGRITY",
    "description": "Device has hardware-backed attestation, locked bootloader, and official Android build",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "verdicts": {
      "meetsStrongIntegrity": true,
      "meetsBasicIntegrity": true,
      "meetsDeviceIntegrity": true
    }
  },
  "signature": {
    "version": "v1",
    "algorithm": "sha256",
    "timestamp": 1705314600000,
    "value": "<base64-hmac-signature>"
  }
}
```

**Integrity Levels:**
| Level | Description |
|-------|-------------|
| `STRONG_INTEGRITY` | Hardware-backed attestation, locked bootloader, official Android build |
| `BASIC_INTEGRITY` | CTS passed, no obvious system compromise |
| `UNTRUSTED` | Rooted, custom ROM, emulator, or tampered environment |
| `UNABLE_TO_VERIFY` | Verification failed due to error or network issues |

**Error (400 Bad Request):**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": ["integrityToken is required and must be a string"]
}
```

**Error (429 Too Many Requests):**
```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

### 2. Get Integrity Level Information

**Endpoint:** `GET /integrity/levels`

**Description:** Returns information about all integrity levels and their meanings.

#### Request

**Headers:**
```
Accept: application/json
```

#### Response

**Success (200 OK):**
```json
{
  "levels": {
    "STRONG_INTEGRITY": {
      "name": "Strong Integrity",
      "description": "Device has hardware-backed attestation, locked bootloader, and official Android build.",
      "indicators": [
        "Hardware-backed key attestation",
        "Bootloader is locked",
        "Official Android build from OEM",
        "Passes all CTS tests"
      ]
    },
    "BASIC_INTEGRITY": {
      "name": "Basic Integrity",
      "description": "Device has passed CTS (Compatibility Test Suite) with no obvious system compromise.",
      "indicators": [
        "Passes basic CTS tests",
        "No obvious signs of rooting",
        "No known tampering detected"
      ]
    },
    "UNTRUSTED": {
      "name": "Untrusted",
      "description": "Device appears to be rooted, running a custom ROM, emulator, or has been tampered with.",
      "indicators": [
        "Root access detected",
        "Custom ROM installed",
        "Running in emulator",
        "System files modified"
      ]
    },
    "UNABLE_TO_VERIFY": {
      "name": "Unable to Verify",
      "description": "Unable to determine device integrity status due to verification failure or network issues.",
      "indicators": [
        "Verification failed",
        "Network error",
        "API error",
        "Invalid token"
      ]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 3. Health Check

**Endpoint:** `GET /health`

**Description:** Returns server health status.

#### Response

**Success (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Response Signing

All verification responses are signed with HMAC-SHA256 to prevent tampering.

### Verification Algorithm

```kotlin
fun verifyResponseSignature(response: SignedResponse, signingKey: String): Boolean {
    val payloadString = Json.encodeToString(response.data)
    val canonicalString = "${response.signature.version}:${response.signature.timestamp}:${payloadString}"
    
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(signingKey.toByteArray(), "HmacSHA256"))
    val expectedSignature = Base64.encodeToString(mac.doFinal(canonicalString.toByteArray()), Base64.NO_WRAP)
    
    return MessageDigest.isEqual(
        response.signature.value.toByteArray(),
        expectedSignature.toByteArray()
    )
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NONCE_MISMATCH` | 400 | Token nonce doesn't match expected value |
| `INVALID_PACKAGE` | 400 | Package name not in allowlist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests from this client |
| `VERIFICATION_ERROR` | 500 | Play Integrity API verification failed |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Rate Limiting

- **Limit:** 10 requests per minute per IP address
- **Window:** 60 seconds
- **Headers:** Standard RateLimit headers are included in responses

---

## Security Considerations

1. **HTTPS Only:** All API communications must use HTTPS in production
2. **Token Expiry:** Play Integrity tokens should be used immediately after generation
3. **Nonce Uniqueness:** Each nonce should be cryptographically random and used only once
4. **Response Verification:** Client should verify response signatures before trusting results
5. **No PII Storage:** Server does not store IP addresses, device identifiers, or tokens