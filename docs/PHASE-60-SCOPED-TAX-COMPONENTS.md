# Phase 60 — scoped statutory component expansion

Status: engineering preview only. All calculations remain unverified and production-disabled.

## 2026 indirect-tax components

The versioned registry adds standard-rate amount calculations for:

- United Kingdom VAT
- Germany VAT
- Australia GST
- Singapore GST
- UAE VAT
- Canada GST/HST in Alberta, Ontario, Nova Scotia, New Brunswick, Newfoundland and Labrador, and Prince Edward Island
- Texas state sales tax (state component only)

The calculator supports tax-exclusive and tax-inclusive amounts, uses integer minor-unit arithmetic, resolves a rule by jurisdiction and transaction date, and returns the exact rule version and official source URL.

It does not determine registration, place of supply, product classification, taxable/exempt/zero-rated status, local surtaxes, input-tax recovery, or filing treatment. It deliberately excludes India GST until effective-dated classification and notification coverage is independently reviewed. Texas local sales taxes are excluded; Canadian PST/QST is excluded.

## Corporate income-tax components

The preview adds:

- US regular federal C-corporation rate component (21%)
- Canada federal Part I general (15%) and caller-confirmed small-business (9%) components
- Germany Körperschaftsteuer component (15%)
- Singapore YA 2026 17% component with separately confirmed partial or start-up exemption schedules

The caller must supply taxable profit after independently established adjustments. The engine does not determine legal entity status, taxable profit, associated-company limits, startup qualification, provincial/municipal tax, incentives, or credits. Singapore YA 2026 rebate and cash grant are excluded; output is before those reductions.

## Payroll and treaty arithmetic

A separate US employer FICA component now calculates the employer's 6.2% Social Security share up to the 2026 wage base and 1.45% Medicare share on all covered wages. It does not add an employer match for Additional Medicare Tax. FUTA, SUTA and payroll-period detail remain excluded.

A generic one-item foreign-tax-credit arithmetic component takes independently established income and four limitation amounts. It floors the proportional domestic-tax cap to minor units and applies the lowest cap. It does not establish treaty entitlement, residence, source, eligible foreign tax or filing position.

## Verification

The tests use synthetic amounts and independently transcribed official rates. They demonstrate arithmetic, validation, effective-period selection and documented exclusions only. They are not independent statutory review, complete statutory coverage, or authorization to reactivate legacy API modules. The 56-scope release gate and production manifest remain unchanged.
