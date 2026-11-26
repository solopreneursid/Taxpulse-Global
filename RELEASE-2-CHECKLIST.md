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
