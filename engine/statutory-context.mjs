const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MINOR = 9007199254740991n;

function validDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(label + ' must be an object');
  }
}

function matchesEligibility(rule, taxpayer) {
  const eligibility = rule.eligibility ?? {};
  for (const [key, expected] of Object.entries(eligibility)) {
    const actual = taxpayer[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, 'oneOf')) {
        if (!Array.isArray(expected.oneOf) || !expected.oneOf.includes(actual)) return false;
      } else {
        if (Object.hasOwn(expected, 'min') && !(typeof actual === 'number' && actual >= expected.min)) return false;
        if (Object.hasOwn(expected, 'max') && !(typeof actual === 'number' && actual <= expected.max)) return false;
      }
    } else if (actual !== expected) return false;
  }
  return true;
}

/**
 * Resolve one rule for an exact jurisdiction/component and an as-of date.
 * Effective periods are half-open: [effectiveFrom, effectiveUntil).
 * Multiple matching rules are rejected rather than resolved by array order.
 */
export function resolveEffectiveRule(registry, { jurisdiction, component, asOf, taxpayer = {} }) {
  assertRecord(registry, 'Registry');
  assertRecord(taxpayer, 'Taxpayer context');
  if (typeof jurisdiction !== 'string' || !jurisdiction.trim() ||
      typeof component !== 'string' || !component.trim() || !validDate(asOf)) {
    throw new TypeError('A jurisdiction, component and valid ISO as-of date are required');
  }
  if (!Array.isArray(registry.versions) || registry.versions.length > 10000) {
    throw new TypeError('Registry versions must be a bounded array');
  }

  const matches = registry.versions.filter(rule => {
    assertRecord(rule, 'Rule');
    if (typeof rule.jurisdiction !== 'string' || typeof rule.component !== 'string' ||
        typeof rule.version !== 'string' || !rule.version ||
        !validDate(rule.effectiveFrom) || !validDate(rule.effectiveUntil) ||
        rule.effectiveFrom >= rule.effectiveUntil) {
      throw new TypeError('Invalid effective-dated rule metadata');
    }
    return rule.jurisdiction === jurisdiction &&
      rule.component === component &&
      rule.effectiveFrom <= asOf && asOf < rule.effectiveUntil &&
      matchesEligibility(rule, taxpayer);
  });

  if (matches.length === 0) throw new RangeError('No eligible statutory rule for the requested date and taxpayer');
  if (matches.length !== 1) throw new RangeError('Ambiguous statutory rules: overlapping eligible rules');
  return matches[0];
}

/** Parse a non-negative decimal amount into integer minor units without binary-float conversion. */
export function parseMinorUnits(value, currencyScale = 2) {
  if (!Number.isInteger(currencyScale) || currencyScale < 0 || currencyScale > 6) {
    throw new RangeError('Currency scale must be an integer from 0 to 6');
  }
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(?:\.(\d+))?$/.test(value)) {
    throw new TypeError('Amount must be a non-negative decimal string');
  }
  const [, whole, fraction = ''] = value.match(/^(0|[1-9]\d*)(?:\.(\d+))?$/);
  if (fraction.length > currencyScale) throw new RangeError('Amount exceeds the currency minor-unit precision');
  const scale = 10n ** BigInt(currencyScale);
  const minor = BigInt(whole) * scale + BigInt((fraction + '0'.repeat(currencyScale)).slice(0, currencyScale) || '0');
  if (minor > MAX_MINOR) throw new RangeError('Amount exceeds the supported safe integer range');
  return minor;
}

/** Format integer minor units as a canonical decimal string. */
export function formatMinorUnits(value, currencyScale = 2) {
  if (typeof value !== 'bigint' || value < 0n || value > MAX_MINOR ||
      !Number.isInteger(currencyScale) || currencyScale < 0 || currencyScale > 6) {
    throw new RangeError('Invalid minor-unit amount or currency scale');
  }
  if (currencyScale === 0) return value.toString();
  const scale = 10n ** BigInt(currencyScale);
  return (value / scale).toString() + '.' + (value % scale).toString().padStart(currencyScale, '0');
}

/** Apply a non-negative basis-point rate with round-half-up at the minor-unit boundary. */
export function applyBasisPoints(amountMinor, basisPoints) {
  if (typeof amountMinor !== 'bigint' || amountMinor < 0n || amountMinor > MAX_MINOR ||
      !Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 100000) {
    throw new RangeError('Invalid amount or basis-point rate');
  }
  const rounded = (amountMinor * BigInt(basisPoints) + 5000n) / 10000n;
  if (rounded > MAX_MINOR) throw new RangeError('Calculated amount exceeds the supported safe integer range');
  return rounded;
}

export function validateEffectivePeriods(rules) {
  if (!Array.isArray(rules) || rules.length > 10000) throw new TypeError('Rules must be a bounded array');
  const groups = new Map();
  for (const rule of rules) {
    assertRecord(rule, 'Rule');
    if (typeof rule.jurisdiction !== 'string' || typeof rule.component !== 'string' ||
        typeof rule.version !== 'string' || !rule.version ||
        !validDate(rule.effectiveFrom) || !validDate(rule.effectiveUntil) ||
        rule.effectiveFrom >= rule.effectiveUntil) throw new TypeError('Invalid effective period');
    const eligibilityKey = JSON.stringify(rule.eligibility ?? {});
    const key = rule.jurisdiction + ':' + rule.component + ':' + eligibilityKey;
    const group = groups.get(key) ?? [];
    group.push(rule);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let i = 1; i < group.length; i++) {
      if (group[i].effectiveFrom < group[i - 1].effectiveUntil) {
        throw new RangeError('Overlapping effective periods for one jurisdiction/component');
      }
    }
  }
  return rules;
}
