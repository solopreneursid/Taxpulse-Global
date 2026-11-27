import data from '../rules/business-tax-2026.json' with { type: 'json' };
import { applyBasisPoints, roundRatio, toMinorUnits } from './statutory-context.mjs';

const MAX_MINOR = 100_000_000_000n;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOSTS = Object.freeze({
  IN: ['incometax.gov.in','incometaxindia.gov.in'],
  GB: ['gov.uk'],
  DE: ['gesetze-im-internet.de'],
  AU: ['ato.gov.au'],
  SG: ['iras.gov.sg'],
  AE: ['tax.gov.ae'],
  CA: ['canada.ca'],
  US: ['irs.gov', 'comptroller.texas.gov']
});
const CURRENCIES = Object.freeze({
  IN:'INR',GB:'GBP',DE:'EUR',AU:'AUD',SG:'SGD',AE:'AED',CA:'CAD',US:'USD'
});
const INDIRECT_KEYS = [
  'jurisdiction','country','taxType','version','taxYear','effectiveFrom',
  'effectiveUntil','currency','rateBasisPoints','scope','sourceUrls'
];
const CORPORATE_KEYS = [
  'jurisdiction','country','taxType','version','taxYear','effectiveFrom',
  'effectiveUntil','currency','rateBasisPoints','smallBusinessRateBasisPoints',
  'mainRateThreshold','zeroRateThreshold','partialExemptionTiers','startupExemptionTiers','scope','sourceUrls'
];
const own = (value,key) => Object.hasOwn(value,key);
const exact = (value,keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => own(value,key));
const validDate = value => typeof value === 'string' && DATE.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value + 'T00:00:00.000Z').toISOString().slice(0,10) === value;
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};
function officialSource(url,country) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password &&
      HOSTS[country].some(host =>
        parsed.hostname === host || parsed.hostname.endsWith('.' + host));
  } catch {
    return false;
  }
}
function validateMetadata(row,dataYear) {
  if (!row || typeof row !== 'object' || Array.isArray(row) ||
      typeof row.jurisdiction !== 'string' || !/^[A-Z]{2}(?:-[A-Z]{2,3})?$/.test(row.jurisdiction) ||
      !['IN','US','GB','DE','CA','AU','SG','AE'].includes(row.country) ||
      typeof row.taxType !== 'string' || !row.taxType ||
      typeof row.version !== 'string' || !row.version ||
      row.taxYear !== dataYear ||
      !validDate(row.effectiveFrom) || !validDate(row.effectiveUntil) ||
      row.effectiveFrom >= row.effectiveUntil ||
      typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency) ||
      row.currency !== CURRENCIES[row.country] ||
      !Number.isSafeInteger(row.rateBasisPoints) || row.rateBasisPoints < 0 ||
      row.rateBasisPoints > 10000 ||
      typeof row.scope !== 'string' || row.scope.trim().length < 20 ||
      !Array.isArray(row.sourceUrls) || row.sourceUrls.length < 1 ||
      row.sourceUrls.some(url => !officialSource(url,row.country))) {
    throw new TypeError('Invalid business tax rule metadata');
  }
}
function validateTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length !== 2) {
    throw new TypeError('Invalid corporate exemption tiers');
  }
  for (const tier of tiers) {
    if (!exact(tier,['limit','exemptionRateBasisPoints']) ||
        !Number.isSafeInteger(tier.limit) || tier.limit <= 0 ||
        !Number.isSafeInteger(tier.exemptionRateBasisPoints) ||
        tier.exemptionRateBasisPoints < 0 || tier.exemptionRateBasisPoints > 10000) {
      throw new TypeError('Invalid corporate exemption tier');
    }
  }
}
function validateNoOverlaps(rows,label) {
  const versions = new Set();
  const groups = new Map();
  for (const row of rows) {
    if (versions.has(row.version)) throw new RangeError('Duplicate business tax version');
    versions.add(row.version);
    const groupKey = row.jurisdiction + ':' + row.taxType;
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey,group);
  }
  for (const group of groups.values()) {
    group.sort((a,b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    for (let index=1; index<group.length; index++) {
      if (group[index].effectiveFrom < group[index-1].effectiveUntil) {
        throw new RangeError('Overlapping ' + label + ' effective periods');
      }
    }
  }
}
export function validateBusinessTaxRules(registry) {
  if (!exact(registry,['schemaVersion','taxYear','status','indirectTax','corporateTax']) ||
      registry.schemaVersion !== 1 || registry.taxYear !== '2026' ||
      registry.status !== 'preview' || !Array.isArray(registry.indirectTax) ||
      !Array.isArray(registry.corporateTax) ||
      registry.indirectTax.length < 1 || registry.corporateTax.length < 1) {
    throw new TypeError('Invalid business tax registry');
  }
  for (const row of registry.indirectTax) {
    if (!exact(row,INDIRECT_KEYS)) throw new TypeError('Unsupported indirect tax rule fields');
    validateMetadata(row,registry.taxYear);
    if (!['VAT','GST','HST','STATE_SALES_TAX'].includes(row.taxType)) {
      throw new TypeError('Unsupported indirect tax type');
    }
    if (row.country === 'CA' && !row.jurisdiction.startsWith('CA-') ||
        row.country === 'US' && row.jurisdiction !== 'US-TX' ||
        ['GB','DE','AU','SG','AE'].includes(row.country) && row.jurisdiction !== row.country) {
      throw new TypeError('Indirect tax jurisdiction does not match country');
    }
  }
  for (const row of registry.corporateTax) {
    if (!exact(row,CORPORATE_KEYS)) throw new TypeError('Unsupported corporate tax rule fields');
    validateMetadata(row,registry.taxYear);
    if (row.jurisdiction !== row.country ||
        row.smallBusinessRateBasisPoints !== null &&
          (!Number.isSafeInteger(row.smallBusinessRateBasisPoints) ||
           row.smallBusinessRateBasisPoints < 0 || row.smallBusinessRateBasisPoints > 10000 ||
           row.smallBusinessRateBasisPoints > row.rateBasisPoints) ||
        row.mainRateThreshold !== null && (!Number.isSafeInteger(row.mainRateThreshold) || row.mainRateThreshold < 0) ||
        row.zeroRateThreshold !== null && (!Number.isSafeInteger(row.zeroRateThreshold) || row.zeroRateThreshold < 0)) {
      throw new TypeError('Invalid corporate tax rates');
    }
    const singapore = row.country === 'SG';
    if (singapore) {
      validateTiers(row.partialExemptionTiers);
      validateTiers(row.startupExemptionTiers);
    } else if (row.partialExemptionTiers !== null || row.startupExemptionTiers !== null) {
      throw new TypeError('Unexpected corporate exemption tiers');
    }
    if (row.country === 'CA' && row.smallBusinessRateBasisPoints === null ||
        row.country !== 'CA' && row.smallBusinessRateBasisPoints !== null) {
      throw new TypeError('Missing or unexpected small-business rate');
    }
  }
  validateNoOverlaps(registry.indirectTax,'indirect tax');
  validateNoOverlaps(registry.corporateTax,'corporate tax');
  return registry;
}
const baseline = deepFreeze(validateBusinessTaxRules(data));
function minor(value,label) {
  let result;
  try {
    if (typeof value !== 'number' && typeof value !== 'string') throw new TypeError();
    result = toMinorUnits(value,2);
  } catch (error) {
    throw new RangeError(label + ' must be a non-negative amount with at most two decimals',{cause:error});
  }
  if (result > MAX_MINOR) throw new RangeError(label + ' exceeds the supported amount');
  return result;
}
const output = value => Number(value) / 100;
function selectIndirectRule({country,jurisdiction,transactionDate}) {
  const matches = baseline.indirectTax.filter(rule =>
    rule.country === country && rule.jurisdiction === jurisdiction &&
    rule.effectiveFrom <= transactionDate && transactionDate < rule.effectiveUntil);
  if (matches.length !== 1) {
    throw new RangeError(matches.length ? 'Ambiguous indirect tax rule' : 'No standard-rate rule for jurisdiction and date');
  }
  return matches[0];
}
function selectCorporateRule(country) {
  const matches = baseline.corporateTax.filter(rule =>
    rule.country === country && rule.taxYear === '2026');
  if (matches.length !== 1) {
    throw new RangeError(matches.length ? 'Ambiguous corporate tax rule' : 'Unsupported corporate tax jurisdiction');
  }
  return matches[0];
}

/** Calculate one explicitly confirmed standard-rated supply; this is not a filing engine. */
export function calculateIndirectTax(input) {
  const keys = [
    'country','jurisdiction','taxYear','transactionDate','amount','mode',
    'sellerRegistered','standardRatedSupply','scopeConfirmed'
  ];
  if (!exact(input,keys) || input.taxYear !== '2026' ||
      !validDate(input.transactionDate) ||
      input.transactionDate < '2026-01-01' || input.transactionDate >= '2027-01-01' ||
      !['exclusive','inclusive'].includes(input.mode) ||
      input.sellerRegistered !== true || input.standardRatedSupply !== true ||
      input.scopeConfirmed !== true) {
    throw new TypeError('Confirm a 2026 registered seller and standard-rated supply');
  }
  const rule = selectIndirectRule(input);
  const entered = minor(input.amount,'Supply amount');
  const rate = BigInt(rule.rateBasisPoints);
  let taxable, tax, gross;
  if (input.mode === 'exclusive') {
    taxable = entered;
    tax = applyBasisPoints(taxable,rule.rateBasisPoints);
    gross = taxable + tax;
  } else {
    gross = entered;
    tax = roundRatio(gross * rate,10000n + rate);
    taxable = gross - tax;
  }
  return {
    country: rule.country,
    jurisdiction: rule.jurisdiction,
    taxYear: rule.taxYear,
    transactionDate: input.transactionDate,
    taxType: rule.taxType,
    currency: rule.currency,
    rateBasisPoints: rule.rateBasisPoints,
    rate: rule.rateBasisPoints / 10000,
    mode: input.mode,
    inputAmount: output(entered),
    taxableAmount: output(taxable),
    taxAmount: output(tax),
    grossAmount: output(gross),
    ruleId: rule.version,
    effectiveFrom: rule.effectiveFrom,
    effectiveUntil: rule.effectiveUntil,
    sourceUrls: [...rule.sourceUrls],
    sampleOnly: true,
    taxRulesVerified: false,
    warnings: [
      rule.scope,
      'The engine does not determine taxability, registration, place of supply, customer status, exemptions, zero-rating, input-tax recovery, local surcharges or return treatment. Amount-level rounding may differ from invoice or jurisdiction-specific rounding.'
    ]
  };
}
function exemptionAmount(profit,tiers) {
  let remaining = profit;
  let exempt = 0n;
  for (const tier of tiers) {
    const width = BigInt(tier.limit) * 100n;
    const slice = remaining < width ? remaining : width;
    exempt += applyBasisPoints(slice,tier.exemptionRateBasisPoints);
    remaining -= slice;
    if (remaining === 0n) break;
  }
  return exempt;
}

/** Calculate a narrow corporate tax component on already determined taxable profit. */
export function calculateCorporateTaxComponent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Expected corporate tax input');
  }
  const common = ['country','taxYear','taxableProfit','scopeConfirmed'];
  const country = input.country;
  const keys = country === 'CA'
    ? [...common,'eligibleSmallBusinessProfit','smallBusinessEligibilityConfirmed']
    : country === 'SG'
      ? [...common,'reliefScheme','reliefEligibilityConfirmed']
      : country === 'IN'
        ? [...common,'taxRegime','regimeEligibilityConfirmed']
        : country === 'GB'
          ? [...common,'mainRateEligibilityConfirmed','associatedCompanies','ringFenceProfits']
          : country === 'AU'
            ? [...common,'aggregatedTurnoverBelow50m','passiveIncomeAtOrBelow80Percent']
            : country === 'AE'
              ? [...common,'qualifyingFreeZoneIncome','pillarTwoInScope']
              : common;
  if (!exact(input,keys) || input.taxYear !== '2026' || input.scopeConfirmed !== true) {
    throw new TypeError('Unsupported corporate tax input');
  }
  const rule = selectCorporateRule(country);
  const profit = minor(input.taxableProfit,'Taxable profit');
  let tax, exempt = 0n, components = [], warnings = [rule.scope];
  if (country === 'CA') {
    if (typeof input.smallBusinessEligibilityConfirmed !== 'boolean') {
      throw new TypeError('Confirm small-business eligibility explicitly');
    }
    const eligible = minor(input.eligibleSmallBusinessProfit,'Eligible small-business profit');
    if (eligible > profit || eligible > 0n && input.smallBusinessEligibilityConfirmed !== true) {
      throw new RangeError('Eligible small-business profit must be confirmed and cannot exceed taxable profit');
    }
    const general = profit - eligible;
    const generalTax = applyBasisPoints(general,rule.rateBasisPoints);
    const smallBusinessTax = applyBasisPoints(eligible,rule.smallBusinessRateBasisPoints);
    tax = generalTax + smallBusinessTax;
    components = [
      {name:'Federal general-rate component',taxableProfit:output(general),rateBasisPoints:rule.rateBasisPoints,tax:output(generalTax)},
      {name:'Federal small-business component',taxableProfit:output(eligible),rateBasisPoints:rule.smallBusinessRateBasisPoints,tax:output(smallBusinessTax)}
    ];
    warnings.push('The caller supplies the already established eligible small-business profit. The engine does not determine CCPC status, associated corporations, business-limit allocation, passive-income reduction or provincial tax.');
  } else if (country === 'SG') {
    if (!['none','partial','startup'].includes(input.reliefScheme) ||
        typeof input.reliefEligibilityConfirmed !== 'boolean' ||
        input.reliefScheme !== 'none' && input.reliefEligibilityConfirmed !== true) {
      throw new TypeError('Select and confirm the Singapore exemption scheme');
    }
    const tiers = input.reliefScheme === 'partial' ? rule.partialExemptionTiers :
      input.reliefScheme === 'startup' ? rule.startupExemptionTiers : [];
    exempt = exemptionAmount(profit,tiers);
    const afterExemption = profit - exempt;
    tax = applyBasisPoints(afterExemption,rule.rateBasisPoints);
    components = [
      {name:'Chargeable profit before exemption',amount:output(profit)},
      {name:'Exempt amount',amount:output(exempt)},
      {name:'Chargeable profit after exemption',amount:output(afterExemption)},
      {name:'Corporate income tax before YA 2026 rebate',rateBasisPoints:rule.rateBasisPoints,tax:output(tax)}
    ];
    warnings.push('The caller must establish the full YA 2026 exemption eligibility and chargeable-income basis. The calculation excludes the YA 2026 corporate tax rebate and cash grant, group relief, special incentives and all other adjustments.');
  } else if (country === 'IN') {
    if (input.taxRegime !== '115BAA' || input.regimeEligibilityConfirmed !== true) {
      throw new TypeError('Confirm eligibility for the Section 115BAA regime');
    }
    tax = applyBasisPoints(profit,rule.rateBasisPoints);
    components = [{name:'Section 115BAA base income-tax component',taxableProfit:output(profit),rateBasisPoints:rule.rateBasisPoints,tax:output(tax)}];
    warnings.push('The caller confirms Section 115BAA eligibility and election. The 22% base rate excludes the 10% surcharge and 4% health and education cess, and does not determine deduction/MAT eligibility.');
  } else if (country === 'GB') {
    if (input.mainRateEligibilityConfirmed !== true || input.associatedCompanies !== 1 ||
        input.ringFenceProfits !== false || profit <= BigInt(rule.mainRateThreshold) * 100n) {
      throw new TypeError('Only the non-ring-fence main-rate case above the single-company threshold is supported');
    }
    tax = applyBasisPoints(profit,rule.rateBasisPoints);
    components = [{name:'UK Corporation Tax main-rate component',taxableProfit:output(profit),rateBasisPoints:rule.rateBasisPoints,threshold:rule.mainRateThreshold,tax:output(tax)}];
    warnings.push('Main-rate-only case. The caller confirms one associated company and non-ring-fence profits above the £250,000 threshold. Small-profits rate, marginal relief, short periods and associated-company threshold reductions are not modeled.');
  } else if (country === 'AU') {
    if (input.aggregatedTurnoverBelow50m !== true || input.passiveIncomeAtOrBelow80Percent !== true) {
      throw new TypeError('Confirm both Australian base-rate-entity eligibility tests');
    }
    tax = applyBasisPoints(profit,rule.rateBasisPoints);
    components = [{name:'Australian base-rate-entity company tax component',taxableProfit:output(profit),rateBasisPoints:rule.rateBasisPoints,tax:output(tax)}];
    warnings.push('The caller confirms aggregated turnover below AUD 50 million and base-rate-entity passive income at or below 80%. The 25% component excludes franking credits and all other company tax adjustments.');
  } else if (country === 'AE') {
    if (input.qualifyingFreeZoneIncome !== false || input.pillarTwoInScope !== false) {
      throw new TypeError('Only non-qualifying-free-zone income outside Pillar Two scope is supported');
    }
    const threshold = BigInt(rule.zeroRateThreshold) * 100n;
    const taxableAboveThreshold = profit > threshold ? profit - threshold : 0n;
    tax = applyBasisPoints(taxableAboveThreshold,rule.rateBasisPoints);
    components = [
      {name:'UAE 0% threshold component',taxableProfit:output(profit > threshold ? threshold : profit),rateBasisPoints:0,tax:0},
      {name:'UAE 9% standard-rate component',taxableProfit:output(taxableAboveThreshold),rateBasisPoints:rule.rateBasisPoints,tax:output(tax)}
    ];
    warnings.push('The caller confirms a non-qualifying-free-zone juridical person outside the large-multinational Pillar Two rules. The 0% threshold and 9% standard-rate component exclude free-zone qualifying income and other exemptions.');
  } else {
    tax = applyBasisPoints(profit,rule.rateBasisPoints);
    components = [{name:rule.taxType,taxableProfit:output(profit),rateBasisPoints:rule.rateBasisPoints,tax:output(tax)}];
  }
  return {
    country,
    taxYear:rule.taxYear,
    currency:rule.currency,
    taxableProfit:output(profit),
    exemptAmount:output(exempt),
    taxableProfitAfterExemption:output(profit-exempt),
    taxComponents:components,
    corporateIncomeTaxComponent:output(tax),
    ruleId:rule.version,
    effectiveFrom:rule.effectiveFrom,
    effectiveUntil:rule.effectiveUntil,
    sourceUrls:[...rule.sourceUrls],
    sampleOnly:true,
    taxRulesVerified:false,
    warnings:[...warnings,'This is a component calculation on user-established taxable profit, not a corporate tax return, final liability or statutory approval.']
  };
}
