# Phase 61 — Financial Twin monthly stress-path visibility

Status: local preview planning feature; not financial advice.

## Scenario model

The cash-flow stress scenario compares a constant monthly baseline with a bounded shock defined by:
- income reduction percentage;
- expense increase percentage;
- shock start month and duration;
- initial liquid savings and protected reserve;
- a 1–600 month planning horizon.

The stress and baseline paths are calculated using integer minor-unit arithmetic. The scenario reports ending and minimum liquid savings, first reserve breach, months below reserve, first negative balance and reserve recovery after the shock.

## Month-by-month comparison

Both baseline and stressed month-end paths are returned for the first 24 months only. The workspace renders a comparison table with monthly net cash flow, closing liquid savings, shock-active status and reserve/negative-balance status. When the horizon exceeds 24 months, the table explicitly states that it shows only the first 24 months; aggregate metrics continue to cover the full horizon.

The encrypted planning archive stores validated inputs and recomputes outputs locally. It does not persist an unbounded 600-month schedule.

## Limitations

This is a deterministic sensitivity model using user-entered after-tax income and total expenses. It does not recalculate tax, model intra-month payment timing, inflation, interest, investment returns, borrowing, credit access, insurance, reimbursements or event probability. Expenses should include debt payments to avoid double counting. A reserve breach is a planning signal, not a solvency or lending assessment.

All results remain sample-only. No production release or statutory approval is implied.
