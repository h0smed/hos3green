# Hos3Green Security Rationale

## Security Model Overview

Hos3Green implements a **zero-trust client** security model where all integrity decisions are made server-side. The client is considered untrusted and can only request verification; it cannot determine its own integrity status.

## Core Security Principles

### 1. Zero-Trust Client Architecture

**Rationale:** Android devices can be rooted, emulated, or modified. Any code running on the device can be tampered with, bypassed, or spoofed.

**Implementation:**
- Client generates nonce and requests Play Integrity token
- Client transmits token to server without interpretation
- Server verifies token using Google's Play Integrity API
- Server returns signed verdict; client displays result but cannot modify it

**Benefits:**
- Root detection cannot be bypassed by modifying client code
- Integrity verdicts cannot be spoofed
- Server-signed responses prevent man-in-the-middle tampering

### 2. Server-Side Verification Only

**Rationale:** Google Play Integrity tokens are JWT-like structures that require Google service account credentials to verify. These credentials must never be exposed in client code.

**Implementation:**
- Service account JSON stored securely on server
- Server makes authenticated requests to `playintegrity.googleapis.com`
- Token signature, timestamp, and nonce validated server-side

**Benefits:**
- Service account credentials remain secure
- Token validation logic cannot be reverse-engineered
- Rate limiting and abuse detection possible

### 3. Nonce-Based Replay Protection

**Rationale:** Without nonce validation, an attacker could capture a valid token and replay it indefinitely to bypass verification.

**Implementation:**
- Client generates cryptographically secure random nonce (min 16 bytes)
- Nonce included in Play Integrity token request
- Server verifies nonce from decoded token matches expected value
- Timing-safe comparison prevents timing attacks

**Benefits:**
- Tokens cannot be replayed
- Each verification request is unique
- Prevents replay attacks using captured tokens

### 4. Response Signing

**Rationale:** Without response signing, a man-in-the-middle attacker could modify the integrity verdict before it reaches the client.

**Implementation:**
- Server signs all verification responses with HMAC-SHA256
- Signature includes version, timestamp, and payload
- Client verifies signature before displaying result

**Benefits:**
- Prevents MITM tampering of verdicts
- Timestamp prevents replay of old responses
- Version allows algorithm upgrades

### 5. Certificate Pinning

**Rationale:** Standard TLS relies on certificate authorities (CAs). If a CA is compromised, an attacker could issue valid certificates for the API domain.

**Implementation:**
- Client pins the server's certificate or public key hash
- Connection fails if certificate doesn't match pinned hash
- Implemented in OkHttp certificate pinner

**Benefits:**
- Prevents CA compromise attacks
- Detects fraudulent certificates
- Forces connection to legitimate server only

### 6. Stateless Verification

**Rationale:** Storing tokens or device identifiers creates a privacy risk and attack surface for data breaches.

**Implementation:**
- No database storage of verification requests
- Tokens processed and discarded immediately
- No logging of IP addresses or device identifiers
- Rate limiting uses in-memory store only

**Benefits:**
- No sensitive data to breach
- GDPR/privacy compliant by design
- Horizontal scaling without shared state

### 7. Minimal Permissions

**Rationale:** Every permission requested by an app increases attack surface and privacy concerns.

**Implementation:**
- Only `INTERNET` permission required for API communication
- No access to device identifiers (IMEI, MAC address)
- No access to contacts, location, or storage
- Local checks use public APIs only

**Benefits:**
- Reduced attack surface
- User privacy protection
- Transparent permission model

### 8. Defense in Depth

**Rationale:** No single security measure is perfect. Multiple overlapping controls provide redundancy.

**Implementation:**
- Play Integrity API (primary)
- Local root detection (secondary)
- Suspicious app scanning (informational)
- Response signature verification (client-side)
- Certificate pinning (transport)

**Benefits:**
- Compromise of one control doesn't break security
- Multiple opportunities to detect tampering
- Layered security model

## Threat Model

### Threats Addressed

| Threat | Mitigation |
|--------|------------|
| Root detection bypass | Server-side verification only |
| Token replay attacks | Nonce validation with timing-safe comparison |
| MITM verdict tampering | Response signing with HMAC-SHA256 |
| Rogue CA certificate | Certificate pinning in client |
| Service account theft | Credentials only on server |
| API abuse | Rate limiting per IP |
| Data breach | No storage of tokens or identifiers |
| Client code modification | Zero-trust model; server makes all decisions |

### Threats NOT Addressed

| Threat | Reason |
|--------|--------|
| Server compromise | Requires infrastructure security |
| Google Play Integrity bypass | Requires Google's security |
| Device hardware attacks | Out of scope for software solution |
| Social engineering | Requires user education |

## Privacy Considerations

### Data Not Collected
- IP addresses
- Device identifiers (IMEI, MAC, Android ID)
- Integrity verdict history
- User accounts or profiles
- Geolocation data

### Data Processed Temporarily
- Play Integrity tokens (verified and discarded)
- Nonce values (verified and discarded)
- Request timestamps (used for rate limiting only)

### Data Retained
- None. The system is completely stateless.

## Compliance

### GDPR
- No personal data collection
- Right to erasure: no data stored to erase
- Data portability: no data stored to port
- Lawful basis: legitimate interest in security

### Google Play Policy
- Play Integrity API used correctly
- No circumvention of security measures
- Transparent about device checking

## Security Checklist

- [x] Server-side verification only
- [x] Cryptographically secure nonce generation
- [x] Nonce replay protection
- [x] Response signing with HMAC
- [x] Certificate pinning
- [x] Rate limiting
- [x] HTTPS enforcement
- [x] No sensitive data storage
- [x] Minimal permissions
- [x] Input validation
- [x] Error handling without information leakage
- [x] Timing-safe comparisons

## Incident Response

### If Server Compromised
1. Revoke Google service account credentials immediately
2. Rotate response signing keys
3. Invalidate TLS certificates
4. Review access logs

### If Client Bypass Discovered
1. Server-side verification prevents client bypass
2. Update Play Integrity API integration if needed
3. Deploy app update with enhanced checks

## Future Security Enhancements

1. **Hardware Attestation:** Use KeyStore attestation for additional verification
2. **Device Binding:** Bind tokens to device-specific keys
3. **Behavioral Analysis:** Detect anomalies in verification patterns
4. **App Attestation:** Verify app binary integrity
5. **SafetyNet Fallback:** Legacy support for older devices