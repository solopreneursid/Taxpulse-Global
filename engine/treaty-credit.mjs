import { toMinorUnits } from './statutory-context.mjs';

const MAX_MINOR = 100_000_000_000n;
const exact = (value,keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value,key));
const output = value => Number(value) / 100;
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

/**
 * Apply four independently established one-item foreign-tax-credit limits.
 * The proportional domestic-tax limit is floored to the currency minor unit.
 * No treaty eligibility, source, residence or entitlement is inferred.
 */
export function calculateTreatyCreditComponent(input) {
  const keys = [
    'currency','worldwideIncome','foreignSourceIncome','domesticTaxOnWorldwideIncome',
    'foreignTaxPaid','treatyLimit','taxOnForeignItem','scopeConfirmed'
  ];
  if (!exact(input,keys) || typeof input.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(input.currency) || input.scopeConfirmed !== true) {
    throw new TypeError('Supply a currency, one-item credit limits and explicit scope confirmation');
  }
  const worldwideIncome = minor(input.worldwideIncome,'Worldwide income');
  const foreignSourceIncome = minor(input.foreignSourceIncome,'Foreign-source income');
  const domesticTax = minor(input.domesticTaxOnWorldwideIncome,'Domestic tax');
  const foreignTaxPaid = minor(input.foreignTaxPaid,'Foreign tax paid');
  const treatyLimit = minor(input.treatyLimit,'Treaty limit');
  const itemTax = minor(input.taxOnForeignItem,'Tax on foreign item');
  if (foreignSourceIncome > worldwideIncome ||
      worldwideIncome === 0n && foreignSourceIncome > 0n) {
    throw new RangeError('Foreign-source income cannot exceed positive worldwide income');
  }
  const proportionalLimit = worldwideIncome === 0n
    ? 0n : domesticTax * foreignSourceIncome / worldwideIncome;
  const allowed = [
    foreignTaxPaid,
    treatyLimit,
    proportionalLimit,
    itemTax
  ].reduce((minimum,value) => value < minimum ? value : minimum);
  return {
    currency:input.currency,
    worldwideIncome:output(worldwideIncome),
    foreignSourceIncome:output(foreignSourceIncome),
    domesticTaxOnWorldwideIncome:output(domesticTax),
    foreignTaxPaid:output(foreignTaxPaid),
    treatyLimit:output(treatyLimit),
    taxOnForeignItem:output(itemTax),
    proportionalDomesticTaxLimit:output(proportionalLimit),
    allowedCredit:output(allowed),
    unusedForeignTax:output(foreignTaxPaid-allowed),
    sampleOnly:true,
    taxRulesVerified:false,
    warnings:[
      'Arithmetic-only single-item limitation. All income, tax, treaty and paid-tax amounts must already be independently established in the same currency.',
      'Does not determine treaty entitlement, tax residence, source, foreign-tax eligibility, relief choice, carryovers, tax-sparing credits, multiple income items or filing treatment.'
    ]
  };
}
