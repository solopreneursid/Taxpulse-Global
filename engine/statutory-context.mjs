const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MINOR = 9007199254740991n;
const SCALAR = value => value === null || typeof value === 'string' ||
  typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value);

function validDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(label + ' must be a plain object');
  }
}

function validateEligibility(eligibility) {
  if (eligibility === undefined) return;
  assertRecord(eligibility, 'Rule eligibility');
  for (const [key, expected] of Object.entries(eligibility)) {
    if (!key || !key.trim()) throw new TypeError('Eligibility keys must be non-empty');
    if (SCALAR(expected)) continue;
    assertRecord(expected, 'Eligibility condition');
    const keys = Object.keys(expected);
    if (keys.length === 1 && keys[0] === 'oneOf') {
      if (!Array.isArray(expected.oneOf) || expected.oneOf.length < 1 ||
          expected.oneOf.length > 100 || !expected.oneOf.every(SCALAR) ||
          new Set(expected.oneOf.map(v => typeof v + ':' + String(v))).size !== expected.oneOf.length) {
        throw new TypeError('Invalid eligibility oneOf condition');
      }
      continue;
    }
    if (keys.length < 1 || keys.some(k => k !== 'min' && k !== 'max') ||
        keys.some(k => typeof expected[k] !== 'number' || !Number.isFinite(expected[k])) ||
        Object.hasOwn(expected, 'min') && Object.hasOwn(expected, 'max') &&
          expected.min > expected.max) {
      throw new TypeError('Invalid numeric eligibility range');
    }
  }
}

function eligibilityKey(value) {
  if (value === undefined) return '{}';
  const sort = input => {
    if (Array.isArray(input)) return input.map(sort);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])]));
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

function matchesEligibility(rule, taxpayer) {
  const eligibility = rule.eligibility ?? {};
  for (const [key, expected] of Object.entries(eligibility)) {
    if (!Object.hasOwn(taxpayer, key)) return false;
    const actual = taxpayer[key];
    if (expected && typeof expected === 'object') {
      if (Object.hasOwn(expected, 'oneOf')) {
        if (!expected.oneOf.includes(actual)) return false;
      } else {
        if (typeof actual !== 'number' ||
            Object.hasOwn(expected, 'min') && actual < expected.min ||
            Object.hasOwn(expected, 'max') && actual > expected.max) return false;
      }
    } else if (actual !== expected) return false;
  }
  return true;
}

function validateRule(rule) {
  assertRecord(rule, 'Rule');
  if (typeof rule.jurisdiction !== 'string' || !rule.jurisdiction.trim() ||
      typeof rule.component !== 'string' || !rule.component.trim() ||
      typeof rule.version !== 'string' || !rule.version.trim() ||
      !validDate(rule.effectiveFrom) || !validDate(rule.effectiveUntil) ||
      rule.effectiveFrom >= rule.effectiveUntil) {
    throw new TypeError('Invalid effective-dated rule metadata');
  }
  validateEligibility(rule.eligibility);
}

/**
 * Validate rule identity and period integrity. Different eligibility tracks may
 * overlap; resolution rejects them if more than one track matches a taxpayer.
 */
export function validateEffectivePeriods(rules) {
  if (!Array.isArray(rules) || rules.length > 10000) {
    throw new TypeError('Rules must be a bounded array');
  }
  const ids = new Set();
  const groups = new Map();
  for (const rule of rules) {
    validateRule(rule);
    if (ids.has(rule.version)) throw new RangeError('Duplicate statutory rule version');
    ids.add(rule.version);
    const key = rule.jurisdiction + ':' + rule.component + ':' + eligibilityKey(rule.eligibility);
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let i = 1; i < group.length; i++) {
      if (group[i].effectiveFrom < group[i - 1].effectiveUntil) {
        throw new RangeError('Overlapping effective periods for one eligibility track');
      }
    }
  }
  return rules;
}

/**
 * Resolve one rule for an exact jurisdiction/component and an as-of date.
 * Effective periods are half-open: [effectiveFrom, effectiveUntil).
 */
export function resolveEffectiveRule(registry, {
  jurisdiction, component, asOf, taxpayer = {}
}) {
  assertRecord(registry, 'Registry');
  assertRecord(taxpayer, 'Taxpayer context');
  if (typeof jurisdiction !== 'string' || !jurisdiction.trim() ||
      typeof component !== 'string' || !component.trim() || !validDate(asOf)) {
    throw new TypeError('A jurisdiction, component and valid ISO as-of date are required');
  }
  validateEffectivePeriods(registry.versions);
  const matches = registry.versions.filter(rule =>
    rule.jurisdiction === jurisdiction &&
    rule.component === component &&
    rule.effectiveFrom <= asOf && asOf < rule.effectiveUntil &&
    matchesEligibility(rule, taxpayer)
  );
  if (matches.length === 0) {
    throw new RangeError('No eligible statutory rule for the requested date and taxpayer');
  }
  if (matches.length !== 1) {
    throw new RangeError('Ambiguous statutory rules: overlapping eligible rules');
  }
  return matches[0];
}

/**
 * Resolve a single rule that covers an entire annual assessment period.
 * Any mid-period transition or gap is rejected until a prorated model exists.
 */
export function resolveFullPeriodRule(registry, {
  jurisdiction, component, periodStart, periodEnd, taxpayer = {}
}) {
  assertRecord(registry, 'Registry');
  assertRecord(taxpayer, 'Taxpayer context');
  if (!validDate(periodStart) || !validDate(periodEnd) || periodStart >= periodEnd ||
      typeof jurisdiction !== 'string' || !jurisdiction.trim() ||
      typeof component !== 'string' || !component.trim()) {
    throw new TypeError('A jurisdiction, component and valid half-open period are required');
  }
  validateEffectivePeriods(registry.versions);
  const candidates = registry.versions.filter(rule =>
    rule.jurisdiction === jurisdiction &&
    rule.component === component &&
    rule.effectiveFrom < periodEnd && periodStart < rule.effectiveUntil &&
    matchesEligibility(rule, taxpayer)
  );
  if (candidates.length !== 1 ||
      candidates[0].effectiveFrom > periodStart ||
      candidates[0].effectiveUntil < periodEnd) {
    throw new RangeError('No unique statutory rule covers the full assessment period');
  }
  return candidates[0];
}

/** Derive common tax-year periods; jurisdiction registries may override explicitly. */
export function taxYearPeriod(jurisdiction, taxYear) {
  if (typeof jurisdiction !== 'string' || typeof taxYear !== 'string' ||
      !/^\d{4}$/.test(taxYear) || Number(taxYear) < 2000 || Number(taxYear) > 2100) {
    throw new TypeError('Invalid jurisdiction or tax year');
  }
  const country = jurisdiction.split('-')[0];
  const start = country === 'GB' ? taxYear + '-04-06' :
    country === 'IN' ? taxYear + '-04-01' :
    country === 'AU' ? taxYear + '-07-01' : taxYear + '-01-01';
  const next = String(Number(taxYear) + 1).padStart(4, '0');
  const end = country === 'GB' ? next + '-04-06' :
    country === 'IN' ? next + '-04-01' :
    country === 'AU' ? next + '-07-01' : next + '-01-01';
  return Object.freeze({ start, end });
}

/** Parse a non-negative decimal amount into integer minor units. */
export function parseMinorUnits(value, currencyScale = 2) {
  if (!Number.isInteger(currencyScale) || currencyScale < 0 || currencyScale > 6) {
    throw new RangeError('Currency scale must be an integer from 0 to 6');
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.(\d+))?$/.test(value)) {
    throw new TypeError('Amount must be a non-negative decimal string');
  }
  const [, whole, fraction = ''] = value.match(/^(0|[1-9]\d*)(?:\.(\d+))?$/);
  if (fraction.length > currencyScale) {
    throw new RangeError('Amount exceeds the currency minor-unit precision');
  }
  const scale = 10n ** BigInt(currencyScale);
  const minor = BigInt(whole) * scale +
    BigInt((fraction + '0'.repeat(currencyScale)).slice(0, currencyScale) || '0');
  if (minor > MAX_MINOR) throw new RangeError('Amount exceeds the supported safe integer range');
  return minor;
}

/** Convert a finite numeric API amount through its canonical decimal representation. */
export function toMinorUnits(value, currencyScale = 2) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid monetary amount');
    value = value.toString();
  }
  return parseMinorUnits(value, currencyScale);
}

/** Format integer minor units as a canonical decimal string. */
export function formatMinorUnits(value, currencyScale = 2) {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_MINOR ||
      !Number.isInteger(currencyScale) || currencyScale < 0 || currencyScale > 6) {
    throw new RangeError('Invalid minor-unit amount or currency scale');
  }
  if (currencyScale === 0) return value.toString();
  const scale = 10n ** BigInt(currencyScale);
  return (value / scale).toString() + '.' +
    (value % scale).toString().padStart(currencyScale, '0');
}

/** Divide non-negative integers and round half up. */
export function roundRatio(numerator, denominator) {
  if (typeof numerator !== 'bigint' || numerator < 0n ||
      typeof denominator !== 'bigint' || denominator <= 0n) {
    throw new RangeError('Invalid integer ratio');
  }
  return (numerator + denominator / 2n) / denominator;
}

/** Apply a non-negative basis-point rate with round-half-up at the minor-unit boundary. */
export function applyBasisPoints(amountMinor, basisPoints) {
  if (typeof amountMinor !== 'bigint' || amountMinor < 0n || amountMinor > MAX_MINOR ||
      !Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 100000) {
    throw new RangeError('Invalid amount or basis-point rate');
  }
  const rounded = roundRatio(amountMinor * BigInt(basisPoints), 10000n);
  if (rounded > MAX_MINOR) {
    throw new RangeError('Calculated amount exceeds the supported safe integer range');
  }
  return rounded;
}

/** Convert a decimal rate to a fixed integer scale without binary-float multiplication. */
export function decimalRateUnits(value, precision = 9) {
  if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
    throw new RangeError('Invalid rate precision');
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid rate');
    value = value.toString();
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.(\d+))?$/.test(value)) {
    throw new TypeError('Rate must be a non-negative decimal');
  }
  const [, whole, fraction = ''] = value.match(/^(0|[1-9]\d*)(?:\.(\d+))?$/);
  if (fraction.length > precision) throw new RangeError('Rate precision exceeds supported scale');
  return BigInt(whole) * 10n ** BigInt(precision) +
    BigInt((fraction + '0'.repeat(precision)).slice(0, precision) || '0');
}
