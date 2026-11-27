# Phase 67 — Self-verification inventory and sequence-floor provisioning

Status: engineering inventory and preview infrastructure change. Production remains disabled.

## Statutory evidence inventory

The canonical 56-row country/module inventory remains `rules/scoped-coverage.json`. The new `scripts/verification-audit.mjs` turns that inventory into a deterministic audit report and fails on missing, duplicate, or incorrectly classified scopes. It reports:

- Eight jurisdictions and seven required modules.
- Scoped examples versus unimplemented scopes.
- Country/module evidence records and independent-approval counts.
- Backend catalog support and disabled legacy modules.
- Payroll registry jurisdictions and missing jurisdictions.
- The current production-gate blocker.

The audit is intentionally fail-closed. It does not upgrade any status, infer an independent reviewer, or activate rules.

Run with `node scripts/verification-audit.mjs`; validate with `node --test tests/verification-audit.test.mjs`.

## Payroll coverage

The current payroll registry contains preview components for IN, US, GB, CA, AU and SG. DE and AE are absent from that registry. This does not mean those jurisdictions have no tax or social contribution obligations; it means TaxPulse does not yet have a supported, validated payroll component for them. All current entries remain legally unverified and the eight-country payroll requirement is not complete.

Do not fill the missing jurisdictions with guessed rates or repurpose personal-income-tax calculations as payroll calculations. Add each component only with dated official sources, correct employee/employer treatment, contribution ceilings and floors, eligibility rules, payroll-period rounding, regression vectors and explicit exclusions.

## Cloudflare sequence floor

On 2026-11-27, the preview D1 head was queried directly and confirmed empty at sequence 0. The isolated KV namespace `taxpulse-regulatory-sequence-floor` was created, seeded with `taxpulse:regulatory-sequence-floor = 0`, and bound to the preview publisher as `RULE_SEQUENCE_FLOOR`. Existing `RULE_DB` and `RULE_INBOX` bindings were preserved and read back after the update.

Evidence is recorded in `data/sequence-floor-provisioning-2026-11-27.json`.

The repository's current publisher implementation uses a SQLite-backed Cloudflare Durable Object (`REGULATORY_SEQUENCE_ANCHOR`) as the authoritative monotonic sequence anchor. The KV namespace is only a non-authoritative diagnostic mirror; KV eventual consistency is not accepted as the anti-rollback authority. The `RULE_SEQUENCE_FLOOR` mirror binding and the authoritative `REGULATORY_SEQUENCE_ANCHOR` Durable Object binding are deployed and read-back verified on publisher version `2bb4151f-9d06-4ff2-8b0d-3e87994900ef` (100% traffic). The SQLite class migration tag is `phase67-sequence-anchor-v1`. The publisher schedule remains disabled. No signed rule package exists, no publisher/reviewer key is enrolled, and no rule was published. The preview calculator Worker was not changed.

## Cloudflare D1 provider restoration

A real Time Travel restore was executed against the preview D1 database. A bookmark was recorded, a uniquely named temporary probe table was created and populated, and the database was restored to the bookmark. Read-back confirmed the probe table was absent, the regulatory head remained sequence 0/state `empty`, and all three migration-005 integrity triggers remained present. Evidence is in `data/d1-provider-restore-drill-2026-11-27.json`. An SQL export also completed, but its signed download URL could not be fetched from the connector execution environment, so a separate-database SQL import was not claimed.

## Verification boundaries

- Automated CI is not independent statutory review.
- A source URL or content digest is provenance metadata, not proof that the applicable legal rule was interpreted correctly.
- Internal security tests are not an independent penetration test or certification.
- Browser emulation is not physical Android/iOS acceptance.
- Local SQLite backup/restore tests are not Cloudflare D1 provider-level restoration evidence.
- Production artifact signing and production authorization remain founder-controlled.
