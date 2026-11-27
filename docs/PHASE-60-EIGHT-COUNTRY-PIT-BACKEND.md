# Eight-country PIT, salary-remainder and capital-gains backend scope

Status: preview-only, sample-only and unverified. This is not a complete gross-to-net salary engine or filing calculation.

## API coverage

The legacy `countryCalculate` backend now has a personal-income-tax path for all eight configured countries:

| Country | Input basis | Scope boundary |
|---|---|---|
| India | Gross salary and pre-tax deductions | Ordinary salary example; resident flag controls the scoped Section 87A example |
| United States | Gross salary and pre-tax deductions | Simplified federal ordinary income; filing status selection |
| United Kingdom | Gross salary and pre-tax deductions | Simplified ordinary income only |
| Germany | User-established taxable income | Individual or eligible joint assessment |
| UAE | Salary income | Ordinary employee wages only; no personal income tax |
| Canada | Taxable income and net income | Full-year resident; federal tax only |
| Australia | Taxable income | Resident example; modeled LITO |
| Singapore | Taxable income | Resident YA 2026 assessment on 2025 income |

The catalog exposes `pitInputBasis` so API consumers cannot assume every jurisdiction accepts gross salary. Germany, Canada, Australia and Singapore require a user-established taxable-income amount; the API does not derive all deductions or residency status. UAE requires the ordinary employee-wages-only flag.

## Scoped salary-remainder API

The legacy `countryCalculate` endpoint also exposes `module: "payroll"` for all eight countries by reusing the existing salary-remainder engine. The API requires `region`, `pay` and `scopeConfirmed: true`; pay units and assumptions are jurisdiction-specific:

| Country | Region | Pay basis | Additional required inputs |
|---|---|---|---|
| India | `IN` | Annual gross INR | `epfMonthlyWage`, `professionalTaxAnnual` |
| United States | `TX` | Annual gross USD | None |
| United Kingdom | `RUK` or `SCT` | Monthly gross GBP | None |
| Germany | `DE` | Monthly gross EUR | `annualTaxableIncome`, `healthSupplementRate` |
| UAE | `AE` | Monthly gross AED | `monthlyBasicSalary` |
| Canada | `AB` | Annual gross CAD | None |
| Australia | `AU` | Annual gross AUD | None |
| Singapore | `SG` | Monthly ordinary SGD wages | None |

These are narrow, assumption-bound salary-remainder scenarios. They do not provide payroll runs, pay-period withholding instructions, employer payroll, benefits administration, statutory filing or complete payslips. Germany requires a user-established annual taxable-income amount; UAE models the stated expatriate employee ILOE premium; India requires a user-confirmed EPF wage and professional-tax amount. Output remains sample-only and unverified.

## Scoped capital-gains API

The legacy `countryCalculate` endpoint exposes `module: "capgains"` for all eight countries by routing to the existing date-bound calculators:

| Country | Input contract | Output boundary |
|---|---|---|
| India | Acquisition/disposal dates, proceeds, adjusted basis, eligible losses, other taxable income and asset type | Selected resident-individual listed-equity, property or crypto disposal calculation |
| United States | Acquisition/disposal dates, proceeds, adjusted basis, eligible losses, other taxable income and filing status | Selected ordinary/preferential federal rate comparison for one investment lot |
| United Kingdom | Acquisition/disposal dates, proceeds, adjusted basis, eligible losses and other taxable income | Selected individual annual-exempt-amount and basic-rate calculation |
| Australia | Proceeds, cost base, eligible losses, other taxable income and acquisition/disposal dates | FY 2026–27 resident 50% discount-eligible gain and modeled incremental income tax |
| Canada | Confirmed net gain and calendar-2026 transaction date | One-half inclusion component only; no tax calculation |
| Germany | Confirmed net gain and calendar-2026 transaction date | Ordinary private-share 25% tariff component only |
| Singapore | Confirmed net gain and calendar-2026 transaction date | Zero local tax only for caller-confirmed personal investment shares, not trading |
| UAE | Confirmed net gain and calendar-2026 transaction date | Personal-investment-income exclusion component for a natural person only |

The API requires `scopeConfirmed: true` for each jurisdiction. Country-specific asset classification, holding periods, loss treatment, residency and income assumptions remain explicit. Canada returns an inclusion amount rather than a tax liability. Singapore and UAE zero-tax outputs depend on caller-confirmed investment classification; the engine does not infer that a disposal is not trading or business activity. All results remain sample-only and unverified.

## Scoped property transfer API

The legacy `countryCalculate` endpoint exposes `module: "property"` for all eight countries:

| Country | Input contract | Component boundary |
|---|---|---|
| India | Taxable consideration, transaction date and purchaser category male/female | Delhi sole-purchaser ordinary sale-deed stamp/transfer duty |
| United States | Taxable consideration and transaction date | New York State residential conveyance outside NYC, below USD 1 million |
| United Kingdom | Whole-pound consideration, ordinary/first-time buyer scope and transaction date | England/Northern Ireland residential SDLT only |
| Germany | Taxable consideration and transaction date | Berlin ordinary direct acquisition transfer-tax component |
| UAE | Taxable consideration and transaction date | Dubai 4% sale registration fee; this is a fee, not a tax |
| Canada | Taxable consideration and transaction date | Ontario single-family residence provincial LTT component |
| Australia | Taxable consideration and transaction date | NSW ordinary non-residential transfer duty for FY 2026–27 |
| Singapore | Purchase price, market value, property type and transaction date | Pure residential/non-residential buyer's stamp duty only |

Every route requires `scopeConfirmed: true`. The model excludes other states/provinces, cities, additional-property surcharges, non-resident charges, mixed-use transactions, most reliefs, leasehold/linked transactions, valuation disputes, legal fees and other closing costs. Singapore excludes ABSD and SSD. Dubai output is a registration fee. Results remain sample-only and unverified.

## Scoped treaty-credit API

The legacy `countryCalculate` endpoint exposes `module: "dtaa"` for eight modeled bilateral treaty pairs, all using a single income item and caller-established limits:

| Residence-country API | Modeled treaty pair and input basis | Scope boundary |
|---|---|---|
| India | India–UK; foreign tax paid, treaty-permitted tax, worldwide/foreign income, domestic tax and domestic tax attributable to the item | India-side Article 24(2) one-item credit component, historical FY 2025–26 / AY 2026–27 |
| United States | US–UK; foreign tax paid, treaty-permitted tax, worldwide/foreign income, domestic tax and domestic tax attributable to the item | US-side Article 24 one-item general-category credit component, calendar 2026 |
| United Kingdom | UK–India; foreign tax paid, treaty cap and UK tax with/without the item | UK-side Article 24 credit cap for one ordinary Indian-source income item, UK tax year 2025–26 |
| Canada | Canada–UK; foreign tax paid, treaty cap, domestic limit and available domestic tax | Canadian resident individual, one ordinary non-business item, historical 2025 scope |
| Australia | Australia–UK; foreign tax paid, treaty cap, domestic limit and available domestic tax | Australian resident individual FITO/treaty cap component, FY 2025–26 historical scope |
| Germany | Germany–UK; foreign tax paid, treaty cap, domestic limit and available domestic tax | German resident individual, one eligible UK directors-fee item |
| Singapore | Singapore–UK; foreign tax paid, treaty cap, domestic limit and available domestic tax | Singapore resident company, one UK-source taxable item |
| UAE | UAE–UK; foreign tax paid, treaty cap, domestic limit and available domestic tax | UAE juridical person subject to corporate tax, one UK-source taxable item |

The engine does not infer treaty eligibility, residence, beneficial ownership, income sourcing, income characterization, foreign tax conversion, carryovers, exemptions or the final domestic limitation. Treaty caps and attributable domestic tax must already be established by the caller. Singapore and UAE components have entity-specific scope; they are not individual tax-credit estimates. All results remain sample-only and unverified.

## Scoped indirect-tax API

The legacy `countryCalculate` endpoint exposes `module: "vat"` as an indirect-tax family. It does not imply that every country has a VAT:

| Country | Input contract | Component boundary |
|---|---|---|
| India | HSN 2523 cement classification, exclusive/inclusive price basis and amount | Historical 18% IGST notification example effective 22 September 2025 only; not a general 2026 GST calculator |
| United States | Exclusive taxable amount | Texas 6.25% state sales-tax component only; local tax excluded; no federal VAT |
| United Kingdom | Amount, exclusive/inclusive mode, transaction date, registered seller and standard-rated supply confirmation | Standard-rated domestic VAT only |
| Germany | Same registered-seller and standard-rated-supply inputs | Standard-rated domestic VAT only |
| Australia | Same registered-seller and standard-rated-supply inputs | Standard-rated domestic GST only |
| Singapore | Same registered-seller and standard-rated-supply inputs | Standard-rated local GST only |
| UAE | Same registered-seller and standard-rated-supply inputs | Standard-rated domestic VAT only |
| Canada | Province AB/ON/NS/NB/NL/PE, amount, mode, transaction date and seller/supply confirmations | Selected provincial GST/HST component only |

The engine does not determine taxability, product/service classification, registration thresholds, place of supply, customer status, exemptions, zero-rating, reverse charge, imports, input-tax recovery, local surcharges or return treatment. The India example is tied to HSN 2523 and the cited 2025 notification; the US example is state-only Texas sales tax, not VAT. All results remain sample-only and unverified.

## Scoped corporate-tax API

The legacy `countryCalculate` endpoint exposes `module: "corporate"` for all eight countries by routing to the existing effective-dated corporate tax registry:

| Country | Input contract | Component boundary |
|---|---|---|
| India | Taxable profit, Section 115BAA election and caller eligibility confirmation | 22% base income-tax component only; excludes 10% surcharge and 4% health/education cess |
| United States | Taxable profit | Regular federal C-corporation 21% component only |
| United Kingdom | Taxable profit above GBP 250,000, one associated company, non-ring-fence confirmation | 25% main-rate component only; no small-profits rate or marginal relief |
| Germany | Taxable profit | 15% Körperschaftsteuer only; excludes solidarity surcharge and municipal trade tax |
| UAE | Taxable profit, non-qualifying-free-zone and outside-Pillar-Two confirmations | 0% up to AED 375,000 and 9% above |
| Canada | Taxable profit and caller-confirmed eligible small-business allocation | Federal Part I 15% general / 9% small-business component only |
| Australia | Taxable profit, aggregated turnover below AUD 50 million and passive income at or below 80% | 25% base-rate-entity component only |
| Singapore | Taxable profit and caller-confirmed none/partial/start-up exemption scheme | YA 2026 17% component before corporate tax rebate/cash grant |

All results are calculated on user-established taxable profit. The engine does not determine tax adjustments, deductions, loss utilization, eligibility evidence, group relief, transfer pricing, special incentives, state/provincial taxes or the final return liability. The caller-provided eligibility flags are not independent verification. All outputs remain sample-only and unverified.

## Release boundary

All results remain `sampleOnly: true` and `taxRulesVerified: false`. The country manifest remains unverified and production-disabled. The backend catalog now exposes all seven module families across all eight countries (56 entries). This does not establish complete statutory coverage: the calculation components remain scoped, sample-only and taxRulesVerified=false. Every one of the 56 statutory scopes still requires independent source review, independently computed test fixtures and reviewer evidence. Trusted publisher/reviewer keys remain unenrolled, the independent security assessment remains pending, and production authorization remains blocked. The 56-scope release gate is unchanged and still blocks production.

Independent statutory review must validate source law, effective periods, eligibility, reliefs, rounding and independently computed fixtures before any scope can be marked verified.
