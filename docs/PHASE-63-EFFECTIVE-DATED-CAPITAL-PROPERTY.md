# Phase 63 — effective-dated capital gains and property components

Status: engineering preview only. No statutory approval or production activation.

## Australian CGT discount

The FY 2026–27 individual discount example now requires both acquisition and disposal dates. The engine validates that the CGT event occurs within FY 2026–27 and that the disposal date is after the 12-month anniversary, with the acquisition day and CGT-event day excluded as described by the ATO. The earliest eligible disposal date is returned. It still requires an Australian-resident individual throughout ownership, one ordinary discount-eligible asset, established cost base and eligible capital losses already applied. It estimates incremental ordinary income tax including the modeled low-income tax offset; Medicare, other concessions, special assets, foreign-resident treatment, indexation and post-1 July 2027 reforms are excluded.

## Other capital-gain components

The Canada, Germany, Singapore and UAE personal investment gain component now requires a calendar-2026 disposal date. It remains a confirmed-net-gain component: it does not calculate cost base, proceeds, losses, residence or capital-versus-income classification. Canada reports the one-half inclusion amount only. Germany applies the ordinary 25% section 32d component to an already established taxable gain and excludes solidarity surcharge and church tax. Singapore and UAE return only the scoped zero local tax component where the user confirms capital/personal investment treatment.

## Property transfer components

- England and Northern Ireland residential SDLT requires a calendar-2026 transaction date; the ordinary and first-time buyer examples use rates effective from 1 April 2025.
- Singapore BSD requires a calendar-2026 transaction date; the residential/non-residential schedules are effective from 15 February 2023.
- Selected transfer-charge examples require a transaction date. NSW is restricted to FY 2026–27 (1 July 2026 through 30 June 2027); Ontario, Berlin, Delhi, New York State and Dubai examples are restricted to calendar 2026.
- The result returns the transaction date and the applicable period/effective date where established.

## Verification boundaries

All calculations remain sample-only and taxRulesVerified=false. Date validation does not establish tax residence, legal ownership, tax classification, valuation, concessions, relief, eligibility or filing treatment. The existing independent review and 56-scope statutory release gate remain unchanged.
