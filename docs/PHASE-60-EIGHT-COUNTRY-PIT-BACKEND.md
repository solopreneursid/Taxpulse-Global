# Eight-country personal-income-tax backend scope

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

## Release boundary

All results remain `sampleOnly: true` and `taxRulesVerified: false`. The country manifest remains unverified and production-disabled. Payroll, capital gains, VAT/GST, corporate tax, property tax and treaty-relief modules remain disabled in the legacy backend. The 56-scope release gate is unchanged and still blocks production.

Independent statutory review must validate source law, effective periods, eligibility, reliefs, rounding and independently computed fixtures before any scope can be marked verified.
