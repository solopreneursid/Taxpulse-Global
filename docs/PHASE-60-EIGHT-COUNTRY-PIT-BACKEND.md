# Eight-country personal-income-tax and scoped salary-remainder backend

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

## Release boundary

All results remain `sampleOnly: true` and `taxRulesVerified: false`. The country manifest remains unverified and production-disabled. The backend exposes PIT plus a scoped salary-remainder calculation for all eight countries. Capital gains, indirect tax, corporate tax, property tax and treaty-relief modules remain unavailable in the legacy country API. The 56-scope release gate is unchanged and still blocks production.

Independent statutory review must validate source law, effective periods, eligibility, reliefs, rounding and independently computed fixtures before any scope can be marked verified.
