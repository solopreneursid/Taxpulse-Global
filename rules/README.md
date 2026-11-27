# Prototype tax-rule fixtures

All eight JSON files preserve original prototype data. IN, US and GB were directly embedded in the original; DE, AE, CA, AU and SG were synthesized by the original frontend fallback. None are legally verified. Only the first three are enabled in the sample country API; the five synthesized fixtures remain excluded pending official-source review. Do not treat source URLs as proof of correctness or automatically activate these files in production.


## Effective-dated registries

The regional, payroll, India ordinary-salary, and national/investment registries carry explicit half-open effective periods. The national/investment 2026 assessment set records the jurisdiction-specific period boundaries for the supported model: calendar-year, UK tax-year, India financial-year, Australia financial-year, and Singapore YA 2026 (2025 income).

All these records remain `preview` and `unverified`. Effective dates establish which dataset applies; they do not establish that a rate, threshold, eligibility condition, or legal interpretation is correct. Annual calculation entry points reject a rule set that does not cover the complete assessment period. Mid-period changes require a separately reviewed proration model and must not be silently annualized.
