# Security hardening — encrypted records and integrity receipts

Status: engineering controls; independent security assessment remains pending.

## Encrypted record envelope

The browser-only record vault uses PBKDF2-HMAC-SHA-256 with 600,000 iterations to derive an AES-256-GCM key. Each record uses a fresh 16-byte salt and 12-byte IV. Authenticated additional data binds the envelope version and algorithm identifiers. Plain JSON records are limited to 1 MB. Decryption accepts only the exact version-1 envelope schema and returns a generic unlock error for authentication/decryption failures.

## Receipt integrity

Unsigned integrity receipts accept plain JSON object payloads only. Verification fails closed for malformed envelopes, unexpected fields, missing payloads, invalid digests and serialization/size errors. The receipt continues to declare signed=false, independentlyVerified=false and taxRulesVerified=false. SHA-256 proves integrity against accidental or subsequent modification; it does not prove authorship, statutory correctness or filing eligibility.

## Verification boundaries

Tests cover tampering, wrong passphrases, invalid parameters, extra envelope fields, non-record payloads and malformed receipts. These are engineering regression checks, not a penetration test, independent security assessment, cryptographic audit or proof of device-level key protection. No secrets, signing keys, production configuration or deployment are changed.
