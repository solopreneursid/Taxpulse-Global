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

The recovery regression now includes a local SQLite backup/restore with migrations 001–004, reviewer-record preservation, blocked-head recovery and replay/duplicate/version-tampering rejection. Synthetic records are structural fixtures, not valid reviewer signatures. A separately authorized D1 Time Travel restore drill is still required; never restore the live preview database for a test.

## 2026-11-27 isolated provider drill
See data/d1-recovery-drill-2026-11-27.json: all four migrations applied to a disposable D1 database; Time Travel restored the saved archive after advancing the head to blocked sequence 2. Review record, event and version ledger survived; trigger rejections and integrity checks verified. Disposable database deleted and existing preview head unchanged. A restore rolls back the database sequence, so the independently pinned runtime floor and new higher-sequence approval must be enforced during real recovery. No live restore or production approval.

## Next preview increment
The planning archive is input-only and device-local; it accepts at most ten salary profiles and thirty planning scenarios, with strict schema and recalculation checks, authenticated encryption, and an explicit capture/restore operation. It does not certify a tax model or permit real-data use in the unverified preview. Synthetic key rotation tests enforce new distinct keys and an external sequence floor after recovery; no live keys enrolled. Dashboard reconciliation combines fresh edge and signed intake observations without promoting rates. Malformed KV data is treated as unavailable.

## Scoped coverage and additional source observations
The review packet now distinguishes the actual narrow preview examples in rules/scoped-coverage.json from missing module coverage, independently of the legacy API catalog. It never grants approval or changes the manifest. The supplemental source workflow probes 38 targeted official pages daily on main and on relevant PRs, retaining reachability and content digests in read-only artifacts. The separate primary 30-source daily workflow uses its dedicated Ed25519 collector key; signed evidence delivery and KV read-back were verified in workflow run 45755972060. This collector key can submit review-only observations to the isolated preview intake; it cannot sign statutory rule snapshots, approve calculations or authorize production. It compares each successful main observation with the preceding successful scheduled/manual artifact when available; the first run after an unavailable/expired artifact establishes a new baseline. This separate collector does not alter the 30-source signed intake contract and does not establish drift or statutory accuracy. Sources inaccessible to the collector require manual review; do not circumvent access restrictions.

## Coverage checkpoint — 27 November 2026
All 56 inventory entries now have a narrow preview example or an explicitly marked analogous component. US state sales tax is not federal VAT; Dubai registration fees are not property tax. Those two entries cannot substitute for statutory approval. The remaining engineering descriptions in every row of rules/scoped-coverage.json must be addressed or the launch scope explicitly narrowed and the release gate independently redesigned and approved. No country is approved. The supplemental collector covers 38 targeted sources on a daily schedule; it records reachability and content-hash changes against the prior successful main observation artifact when available. Hash changes are review signals, not proof of statutory drift, and the collector remains separate from the 30-source signed monitoring contract.

## Correctness review follow-up
Reserve runway reports a time-zero breach when liquid savings are below the protected floor. Saving or loading a salary profile invalidates any asynchronous transfer generation, preventing an older import from replacing a newer selection. Decision examples with source URLs display explicit preliminary official-source references locally; no fetch is made unless the user chooses a link. These engineering fixes are not statutory approval.

## Supplemental change detection
Scheduled and manually dispatched main-branch supplemental jobs now retrieve the preceding successful main observation artifact using read-only Actions permissions. No PR artifact is used as a baseline. Changed content and pending review survive outages when the prior artifact is available; URL changes establish a new baseline. Expired/missing observations are explicitly marked baseline unavailable. Hash changes are review signals, not proof that a statutory rule changed. This path requires a successful successive main run to demonstrate real historical comparison; the regression fixtures exercise the logic now.

## Release readiness report
The independent review-packet artifact now contains production-readiness-report.json. The 56 preview entries (54 tax components and two analogous charges) remain separate from backend catalog presence. The legacy API now exposes 32 sample-only backend entries: PIT, scoped employee salary remainder, capital-gains components and property transfer/registration components for each of the eight countries. The payroll label does not imply payroll processing, withholding instructions, employer payroll or a complete payslip. Capital-gains results range from selected disposal tax estimates to gain-inclusion or zero-tax classification components; they are not complete capital-gains returns. Property results cover selected transfer-tax or registration-fee examples only, not complete closing costs or relief. Three backend module types remain absent: indirect tax, corporate tax and treaty relief. All calculations remain unverified. Catalog presence itself does not establish coverage or accuracy. Every one of the 56 statutory scopes still requires independently established evidence. The release gate remains unchanged. Founder must choose whether to retain the comprehensive eight-country/seven-module backend requirement or authorize a separately reviewed narrower release design before any production approval. No live production activation is part of this report.


## Financial Twin stress-scenario increment
The planning engine now includes a bounded cash-flow stress scenario. It compares a constant monthly baseline with a time-limited income reduction and expense increase, tracks the first protected-reserve breach, months below reserve, first negative balance and reserve recovery after the shock. The scenario is included in the encrypted planning archive and consolidated report. It uses user-supplied after-tax cash flow and does not forecast probability, taxes, credit, inflation, returns or emergency reimbursements. This is engineering functionality, not financial advice or statutory verification.


## Preview D1 migration 005 — 27 November 2026
Migration 005 has been applied to the isolated `taxpulse-regulatory-preview` database after confirming migrations 001–004, empty sequence-0 head, and zero archived snapshots/events/version rows. The publisher Worker remains unscheduled; the preview calculator Worker has no D1 binding. The national-version uniqueness, immutability and ledger-recording triggers were verified after application. No signed rule package, key enrollment or production change occurred. Evidence: `data/d1-migration-005-preview-2026-11-27.json`. D1 denied PRAGMA access to the connector query surface, so integrity_check and foreign_key_check were not claimed; the isolated provider restore drill remains separately documented.


## Hosted preview release checkpoint — 27 November 2026
The dedicated preview Worker `hqventures-taxpulse-integrated-preview` is deployed at version 36, deployment `0aed0de8-820b-4c28-b39d-fb9fc997518b`, revision `c2b40b7d8f3a63631f8dee6dabe11b70d31140c189dec030bec2be5a0c828415`. Hosted verification run `45967899164` passed exact static-byte parity for 43 public assets and all 44 tool routes at 320, 390 and 1440 pixel Chromium viewports. It also checked security headers, noindex, request isolation, browser errors and a synthetic business calculation. This is hosted Chromium verification, not physical Android/iOS testing, screen-reader acceptance or WCAG certification. See `data/preview-boundary-observation.json`.

The 56-scope statutory inventory contains 54 narrow tax-component examples and two analogues only: US state sales tax for the non-applicable federal VAT category, and Dubai property registration fees for property tax. Neither analogue satisfies statutory approval. All 56 scopes remain independently unapproved.

The 30-source read-only regulatory probe recorded five candidate observation groups (17 candidate subscopes, including 13 Canadian federal/provincial income-tax band candidates), two UK income-tax sources requiring manual review, and two inaccessible official pages (Manipur professional tax and Quebec income-tax rates). No rule was changed or activated. See `data/regulatory-source-observation-2026-11-27.json` and the source-probe artifact from workflow run `45967502147`.

Migration 005 is applied to the empty `taxpulse-regulatory-preview` D1 database. The publisher Worker remains unscheduled; the calculator preview Worker remains KV-only. No signing keys are enrolled, no rules are published, no production system was changed, and monetization remains disabled.

## Scoped tax component expansion — 27 November 2026

The preview now contains a separate versioned 2026 business-tax registry with 12 indirect-tax jurisdiction components and four corporate-tax components. It adds date-resolved standard VAT/GST/HST and Texas state-only sales tax, tax-inclusive/exclusive price arithmetic, US/Canada/Germany/Singapore corporate components, and reuses the payroll registry for the US employer FICA calculation. The one-item treaty-credit tool now delegates to a bounded four-limit arithmetic module.

The browser preview build includes these modules and their rule registry in the engine fingerprint and static asset revision. The standard indirect-tax tool requires a transaction date and explicit confirmation of seller registration, domestic place of supply, standard-rate classification and absence of reliefs. The existing tool pages for company tax, US employer FICA and treaty credit delegate to the new shared components where their scope matches; other country-specific examples retain their narrower existing implementations.

This does not complete any of the 56 statutory scopes. India GST, local US sales taxes, Canadian PST/QST, full corporate liabilities, tax classification, full place-of-supply logic, statutory eligibility and filing treatment remain incomplete. The corporate components are before selected rebates/reliefs where noted. The new registry is not part of a trusted signed production package, all outputs remain sample-only and taxRulesVerified=false, and the release gate, manifest and production deployment remain unchanged. Independent review is still required.

## Effective-dated capital gains and property tools — 27 November 2026

The Australian FY 2026–27 CGT discount example now requires acquisition and disposal dates and enforces the ATO 12-month ownership test with acquisition and CGT-event days excluded. The disposal must fall within FY 2026–27; the earliest eligible disposal date is included in the result warning. Canada, Germany, Singapore and UAE confirmed-net-gain components require a calendar-2026 disposal date.

UK residential SDLT and Singapore BSD now require calendar-2026 transaction dates and return the effective date of their current schedules. The selected Berlin, Ontario, Delhi, New York State, NSW and Dubai transfer-charge examples also require a transaction date; NSW is restricted to FY 2026–27, while the others are calendar-2026 examples.

These changes add date validation and clearer evidence metadata, not statutory completeness. All results remain sample-only and taxRulesVerified=false. Cost-base, loss, eligibility, valuation, residency, surcharge, exemption, place-of-supply and filing determinations remain excluded where stated. No release gate, signed rules, production manifest, D1 state or production deployment was changed.

## Financial Twin stress-path transparency — 27 November 2026

The deterministic cash-flow stress scenario now returns a month-by-month baseline and stressed path for the first 24 months, alongside full-horizon summary metrics (1–600 months). The preview renders an accessible comparison table with baseline/stress net cash flow, closing liquid savings, shock-active months and reserve/negative-balance status. Longer horizons are explicitly marked as truncated in the table; summary metrics still cover the complete selected horizon.

The scenario remains a sensitivity calculation using user-entered after-tax monthly income and total expenses. It does not recalculate tax, model intra-month timing, inflation, interest, investment returns, borrowing, credit access, insurance, reimbursement or event probability. The additional path is derived output; the encrypted planning archive continues to store validated scenario inputs and recalculates outputs locally. No production or release-gate change.

## Authentication and privileged-action boundary

The public calculator preview has no user-account or server-side financial-profile authentication service. Personal financial profiles and planning archives remain browser-local and encrypted; the preview does not upload those records. This avoids introducing an account/session database and a new sensitive-data attack surface. Privileged production release authority is separate: GitHub/Cloudflare account access plus offline founder and independent-reviewer Ed25519 authorization bound to the exact commit, manifest and artifact digest. Trusted release keys are not enrolled and production remains unauthorized. Any future server-side account or data-sync feature requires a separate threat model and explicit approval.

## Encrypted record and integrity-envelope hardening — 27 November 2026

The local encrypted-record foundation now accepts only plain JSON record objects and exact version-1 envelopes. PBKDF2-HMAC-SHA-256 remains at 600,000 iterations; AES-256-GCM uses a fresh 16-byte salt, 12-byte IV and authenticated algorithm/version metadata. Envelopes with extra fields, malformed hex or unsupported parameters fail closed. Decryption errors remain generic.

Unsigned receipt integrity verification now returns false for malformed receipts, missing/non-object payloads, extra fields, invalid digests and serialization/size failures. Receipt flags remain signed=false, independentlyVerified=false and taxRulesVerified=false. The release-signing regression suite also verifies that replacing either trusted founder or reviewer public key invalidates a prior approval. This is not an independent cryptographic audit or security assessment. No keys, secrets, release manifest, production configuration or deployment were changed.

## Founder and independent-review actions
1. Appoint qualified independent reviewers for the 56 country/module scopes, including an explicit decision on the two analogous/non-applicable cases.
2. Appoint an independent security assessor and approve an isolated test scope.
3. After actual statutory review, enroll separate founder publisher and independent reviewer Ed25519 public keys. Keep private keys offline; do not send them through ChatGPT or commit them.
4. Complete physical Android/iOS, assistive-technology and accessibility acceptance using synthetic values only.
