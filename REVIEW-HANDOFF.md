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
The review packet now distinguishes the actual narrow preview examples in rules/scoped-coverage.json from missing module coverage, independently of the legacy API catalog. It never grants approval or changes the manifest. The supplemental source workflow probes 18 targeted official pages on a weekly schedule and relevant PRs, retaining reachability and content digests in read-only artifacts. This separate collector does not alter the 30-source signed intake contract and does not establish drift or statutory accuracy. Sources inaccessible to the collector require manual review; do not circumvent access restrictions.

## Coverage checkpoint — 27 November 2026
All 56 inventory entries now have a narrow preview example or an explicitly marked analogous component. US state sales tax is not federal VAT; Dubai registration fees are not property tax. Those two entries cannot substitute for statutory approval. The remaining engineering descriptions in every row of rules/scoped-coverage.json must be addressed or the launch scope explicitly narrowed and the release gate independently redesigned and approved. No country is approved. The supplemental collector is extended to 38 targeted sources; it records baseline observations, not change detection, and remains separate from the 30-source signed monitoring contract.

## Correctness review follow-up
Reserve runway reports a time-zero breach when liquid savings are below the protected floor. Saving or loading a salary profile invalidates any asynchronous transfer generation, preventing an older import from replacing a newer selection. Decision examples with source URLs display explicit preliminary official-source references locally; no fetch is made unless the user chooses a link. These engineering fixes are not statutory approval.

## Supplemental change detection
Scheduled and manually dispatched main-branch supplemental jobs now retrieve the preceding successful main observation artifact using read-only Actions permissions. No PR artifact is used as a baseline. Changed content and pending review survive outages when the prior artifact is available; URL changes establish a new baseline. Expired/missing observations are explicitly marked baseline unavailable. Hash changes are review signals, not proof that a statutory rule changed. This path requires a successful successive main run to demonstrate real historical comparison; the regression fixtures exercise the logic now.
