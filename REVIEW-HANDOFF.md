# Independent review and release handoff

Status: engineering preparation only. No reviewer appointed or approval recorded. Do not use real financial information in preview.

## Statutory review
Download the review packet from the dedicated GitHub Actions workflow or run `node scripts/prepare-review-packet.mjs independent-review-packet.json` from a clean checkout. It inventories all eight countries × seven required modules, source and fixture file hashes, and backend gaps. This is an inventory of existing evidence, not an approval record. A reviewer must check the actual original statutes, effective dates, eligibility, exclusions, rounding, dependent calculations and independently computed expected results. The current release gate requires all 56 scopes; a narrower initial release would require explicit founder approval and an independently reviewed gate redesign. Never bypass the gate by renaming preview modules.

## Key custody and staged publication
Follow REGULATORY-PUBLISHER-RUNBOOK.md. Founder designates trusted publisher and independent reviewer. Each generates their own offline Ed25519 key in a new private directory using the repository key generator. Keep private.pem out of chat, GitHub, Workers, logs and artifacts. Exchange only public.json and actual signed attestations. Verify exact engine fingerprint, matching trusted identities, sequence, expiry, statutory evidence and independent signatures. Enroll only after the actual review is complete. The preview database is empty, so binding it now would deliberately block calculations.

## Independent security assessment
Provide the assessor with the exact source packet, CI logs, deployed revision and rollback version. Scope browser-only processing, CSP and origin checks, encrypted backup format and key derivation, hostile import and document parsing, prototype pollution, bounded searches, Worker bindings, dependency integrity, D1 transaction and immutable archive enforcement, revocation and replay, credential scope, monitoring, backups and restore. The assessor should produce findings by severity, reproduction evidence and remediation retest. No external assessor is appointed by this file. Avoid destructive restore or active scanning on the shared live preview; use an authorized isolated copy.

## Physical device and accessibility acceptance
On a real low-end Android device and an iOS device where available, record model, OS, browser, viewport, connectivity and exact preview revision; use only synthetic numbers. Verify all six workspaces, text zoom 200%, keyboard/switch and screen reader labels, focus order, result announcements, error recovery, offline blocking, slow-network navigation, encrypted profile export/import, and report download. Measure cold start and interaction timings with local developer tools where possible. Document pass/fail and reproduction steps; fix defects and repeat. Chromium viewport/CPU emulation is not physical-device or WCAG certification.

## Founder-controlled production authorization
Do not generate actual release signatures or enroll keys until the underlying release scope and independent approvals are complete. Freeze the exact artifact, verify its digest and commit, pin distinct founder/reviewer keys outside contributor-controlled inputs, then use the offline release-signing workflow. An independent reviewer must approve the exact artifact. Current production manifest remains preview-only and no production deploy workflow is enabled.
