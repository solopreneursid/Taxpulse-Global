# TaxPulse 2.0 release checklist
- Exact commit regression and browser checks, including route reload/back and keyboard navigation, 320/390/1440px.
- Dependency audit; inspect external assets, CSP, no-index, input bounds and failure states.
- Independent statutory source review by scope, including India September 2026 EPFO change, and documented fixtures.
- Confirm actual deployed staging revision, check hosted routes and record rollback version.
- Confirm reference snapshot provenance, date, license and independent review before enabling any default data.
- Test real low-end mobile performance and usability; no unsupported WCAG or latency claims.
- Production authorization by founder and existing fail-closed gate. Do not merge or publish without approval.
- Ads, affiliate links and persistent personal data remain disabled until separate review.

## Cryptographic release authorization (not yet enrolled)
The production CLI now also requires two distinct trusted Ed25519 public keys and a signed authorization for the exact Git commit, JSON manifest digest and SHA-256 digest of the actual deployment artifact. Approval expires within seven days. The protected deployment environment must provide TAXPULSE_FOUNDER_PUBLIC_KEY, TAXPULSE_RELEASE_REVIEWER_PUBLIC_KEY, TAXPULSE_RELEASE_APPROVAL (JSON file path), and TAXPULSE_RELEASE_ARTIFACT (artifact file path). Approval payload fields and canonical signing bytes are defined by engine/release-authorization.mjs. The deployment process must deploy only the artifact that was checked, and pin the trust keys outside contributor-controlled source or input. No production deploy workflow or key enrollment is authorized by this change. The manifest remains preview-only. Synthetic test keys are never valid release credentials.

### Offline approval workflow
Use `node scripts/release-approval.mjs prepare MANIFEST ARTIFACT COMMIT OUTPUT` to prepare a 24-hour approval for the exact release. Each designated signer independently reviews the same manifest, artifact and commit, then runs the tool's `sign` command with their own offline private key and independently pinned role public key. Exchange only the resulting signed JSON files, never private keys. Use `assemble` with both signatures and pinned public keys to produce the gate's approval JSON. Running the script without arguments prints exact usage. The script rejects preview manifests, changed artifacts, expired payloads, mismatched keys and duplicate signers. Generating or assembling an approval does not deploy anything and cannot substitute for actual statutory review.

## Outstanding founder-controlled release gates
Run `node scripts/production-readiness-report.mjs` for a read-only manifest and backend coverage inventory. This report is not the production gate or an independent assessment. No private key, token, or customer data is read or emitted.
- Qualified independent reviewers must approve exact country/module scopes against official sources and signed fixtures.
- Founder and independent reviewer generate and retain distinct offline keys; only public keys are enrolled.
- Independent security assessor reviews deployed boundaries, browser storage, recovery and key revocation.
- Physical low-end mobile usability and accessibility testing remains necessary; no WCAG conformance claim.
- Freeze the actual artifact and approve its digest via the dual-signature release workflow. Production remains blocked until the actual gate succeeds.

## Independent review packet
See REVIEW-HANDOFF.md. Generate the 56-scope hashed inventory with `node scripts/prepare-review-packet.mjs independent-review-packet.json` or the read-only independent review handoff workflow. Do not treat this artifact as statutory evidence or a signed release authorization.

## Source and hosted verification separation
Source CI runs regression, dependency audit, local Chromium and reproducible build. The separate hosted workflow is mandatory after every preview deployment and exact pin update; it checks the locally reproduced revision, hashes every public static asset (including service worker), and runs hosted browser tests. This avoids races between old pins and deployments; source CI alone is not evidence of hosted success. No dynamic runtime bytes or private server modules are certified by the static asset check.

## Recovery and commercial rollout boundaries
CI exercises an isolated backup and restore with the complete review archive schema. D1 provider-level restore remains untested. No SEO indexing, advertisements, affiliate placement, customer data or paid APIs may be enabled while the preview manifest is unverified. See docs/PHASE-59-66-EXECUTION.md for the sequencing and acceptance criteria.

Each successful source CI generates preview-build-evidence.json containing the exact commit, revision, engine fingerprint and SHA-256 hashes for the Worker static-import closure. Compare the actual downloaded Worker module bytes with this evidence before declaring a preview release verified. The independent hosted gate additionally checks the served public assets. Neither evidence artifact is an independent statutory approval or production signature.

The isolated D1 provider-level restore drill has now passed (data/d1-recovery-drill-2026-11-27.json). It uses synthetic data only; test actual production recovery procedures, independent sequence floors, key rotation and recovery objectives before release.

## Automated accessibility and performance regression
Local Chromium checks 320/390/1440 widths, labelled controls, skip navigation, route and report focus, no external browser requests, initial decoded payload/resource ceilings, and 200% root text enlargement for representative workspaces and calculators. CI archives local-accessibility-performance.json. These are limited regression checks, not WCAG certification, network performance targets or physical-device acceptance.
