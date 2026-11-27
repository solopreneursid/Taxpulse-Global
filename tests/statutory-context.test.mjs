import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBasisPoints, decimalRateUnits, formatMinorUnits, parseMinorUnits, resolveFullPeriodRule,
  resolveEffectiveRule, taxYearPeriod, toMinorUnits, validateEffectivePeriods
} from '../engine/statutory-context.mjs';

const rules = [
  { jurisdiction: 'IN', component: 'personal-income-tax', version: 'IN-PIT-2025', effectiveFrom: '2025-04-01', effectiveUntil: '2026-04-01', eligibility: { residency: 'resident', taxpayerType: { oneOf: ['individual', 'senior'] } } },
  { jurisdiction: 'IN', component: 'personal-income-tax', version: 'IN-PIT-2026', effectiveFrom: '2026-04-01', effectiveUntil: '2027-04-01', eligibility: { residency: 'resident', taxpayerType: { oneOf: ['individual', 'senior'] } } }
];

test('effective-dated resolver selects the rule at the exact boundary', () => {
  validateEffectivePeriods(rules);
  assert.equal(resolveEffectiveRule({ versions: rules }, {
    jurisdiction: 'IN', component: 'personal-income-tax', asOf: '2026-03-31',
    taxpayer: { residency: 'resident', taxpayerType: 'individual' }
  }).version, 'IN-PIT-2025');
  assert.equal(resolveEffectiveRule({ versions: rules }, {
    jurisdiction: 'IN', component: 'personal-income-tax', asOf: '2026-04-01',
    taxpayer: { residency: 'resident', taxpayerType: 'senior' }
  }).version, 'IN-PIT-2026');
});

test('eligibility mismatch and missing periods fail closed', () => {
  assert.throws(() => resolveEffectiveRule({ versions: rules }, {
    jurisdiction: 'IN', component: 'personal-income-tax', asOf: '2026-04-01',
    taxpayer: { residency: 'non-resident', taxpayerType: 'individual' }
  }), /No eligible statutory rule/);
  assert.throws(() => resolveEffectiveRule({ versions: rules }, {
    jurisdiction: 'IN', component: 'personal-income-tax', asOf: '2027-04-01',
    taxpayer: { residency: 'resident', taxpayerType: 'individual' }
  }), /No eligible statutory rule/);
});

test('overlapping effective periods are rejected instead of relying on row order', () => {
  assert.throws(() => validateEffectivePeriods([
    ...rules,
    { ...rules[1], version: 'IN-PIT-OVERLAP', effectiveFrom: '2026-03-01' }
  ]), /Overlapping effective periods/);
});

test('money parsing and formatting use integer minor units', () => {
  assert.equal(parseMinorUnits('123456789.01'), 12345678901n);
  assert.equal(formatMinorUnits(12345678901n), '123456789.01');
  assert.equal(parseMinorUnits('94.14', 2), 9414n);
  assert.equal(formatMinorUnits(9414n, 0), '9414');
  assert.throws(() => parseMinorUnits('1.001'), /precision/);
  assert.throws(() => parseMinorUnits('01.00'), /decimal string/);
});

test('basis-point arithmetic rounds half up exactly in minor units', () => {
  assert.equal(applyBasisPoints(10001n, 500), 500n);
  assert.equal(applyBasisPoints(10000n, 500), 500n);
  assert.equal(applyBasisPoints(1n, 5000), 1n);
  assert.equal(applyBasisPoints(1n, 4999), 0n);
});

test('full-period resolution rejects a mid-year statutory transition', () => {
  const split = [
    { jurisdiction: 'US', component: 'payroll', version: 'US-PAY-2026-A', effectiveFrom: '2026-01-01', effectiveUntil: '2026-07-01' },
    { jurisdiction: 'US', component: 'payroll', version: 'US-PAY-2026-B', effectiveFrom: '2026-07-01', effectiveUntil: '2027-01-01' }
  ];
  assert.equal(resolveEffectiveRule({ versions: split }, {
    jurisdiction: 'US', component: 'payroll', asOf: '2026-07-01'
  }).version, 'US-PAY-2026-B');
  assert.throws(() => resolveFullPeriodRule({ versions: split }, {
    jurisdiction: 'US', component: 'payroll', periodStart: '2026-01-01', periodEnd: '2027-01-01'
  }), /full assessment period/);
});

test('eligibility conditions are validated and require explicit taxpayer context', () => {
  const registry = { versions: [
    { jurisdiction: 'IN', component: 'rebate', version: 'resident-v1', effectiveFrom: '2026-04-01', effectiveUntil: '2027-04-01', eligibility: { residency: 'resident', age: { min: 60 } } },
    { jurisdiction: 'IN', component: 'rebate', version: 'nonresident-v1', effectiveFrom: '2026-04-01', effectiveUntil: '2027-04-01', eligibility: { residency: 'nonresident' } }
  ] };
  assert.equal(resolveEffectiveRule(registry, {
    jurisdiction: 'IN', component: 'rebate', asOf: '2026-04-01',
    taxpayer: { residency: 'resident', age: 62 }
  }).version, 'resident-v1');
  assert.equal(resolveEffectiveRule(registry, {
    jurisdiction: 'IN', component: 'rebate', asOf: '2026-04-01',
    taxpayer: { residency: 'nonresident' }
  }).version, 'nonresident-v1');
  assert.throws(() => resolveEffectiveRule(registry, {
    jurisdiction: 'IN', component: 'rebate', asOf: '2026-04-01',
    taxpayer: { residency: 'resident', age: 59 }
  }), /No eligible statutory rule/);
  assert.throws(() => validateEffectivePeriods([{ ...registry.versions[0], eligibility: { age: { min: '60' } } }]), /eligibility range/);
});

test('numeric money inputs use canonical decimal strings and tax-year periods are jurisdictional', () => {
  assert.equal(toMinorUnits(123.45), 12345n);
  assert.equal(toMinorUnits('0.10'), 10n);
  assert.equal(decimalRateUnits(0.125, 4), 1250n);
  assert.deepEqual(taxYearPeriod('GB-SCT', '2026'), { start: '2026-04-06', end: '2027-04-06' });
  assert.deepEqual(taxYearPeriod('IN', '2026'), { start: '2026-04-01', end: '2027-04-01' });
  assert.deepEqual(taxYearPeriod('AU', '2026'), { start: '2026-07-01', end: '2027-07-01' });
});
