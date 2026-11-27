import { applyBasisPoints, toMinorUnits } from './statutory-context.mjs';
import { resolvePayrollRule } from './payroll-registry.mjs';

const MAX_MINOR = 100_000_000_000n;
const exact = (value,keys) => value && typeof value === 'object' &&
  !Array.isArray(value) && Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value,key));
const output = value => Number(value) / 100;
function minor(value) {
  let result;
  try {
    if (typeof value !== 'number' && typeof value !== 'string') throw new TypeError();
    result = toMinorUnits(value,2);
  } catch (error) {
    throw new RangeError('Covered wages must be a non-negative amount with at most two decimals',{cause:error});
  }
  if (result > MAX_MINOR) throw new RangeError('Covered wages exceed the supported amount');
  return result;
}

/** Employer FICA for one employee and one employer in calendar year 2026. */
export function calculateUsEmployerFica(input,ruleContext={}) {
  const keys = ['country','taxYear','coveredWages','singleEmployer','scopeConfirmed'];
  if (!exact(input,keys) || input.country !== 'US' || input.taxYear !== '2026' ||
      input.singleEmployer !== true || input.scopeConfirmed !== true) {
    throw new TypeError('Confirm one US employee, one employer and calendar year 2026');
  }
  const wages = minor(input.coveredWages);
  const oasdi = resolvePayrollRule('US','oasdi',input.taxYear,ruleContext.payroll).parameters;
  const medicare = resolvePayrollRule('US','medicare',input.taxYear,ruleContext.payroll).parameters;
  const socialSecurityWages = wages < BigInt(oasdi.annualWageBase) * 100n
    ? wages : BigInt(oasdi.annualWageBase) * 100n;
  const socialSecurity = applyBasisPoints(socialSecurityWages,oasdi.employeeRateBasisPoints);
  const medicareTax = applyBasisPoints(wages,medicare.employeeRateBasisPoints);
  const total = socialSecurity + medicareTax;
  const sources = [
    ...resolvePayrollRule('US','oasdi',input.taxYear,ruleContext.payroll).sourceUrls,
    ...resolvePayrollRule('US','medicare',input.taxYear,ruleContext.payroll).sourceUrls
  ];
  return {
    country:'US',
    taxYear:'2026',
    currency:'USD',
    inputBasis:'single-employee-covered-wages',
    coveredWages:output(wages),
    socialSecurityWageBase:Number(oasdi.annualWageBase),
    socialSecurityEmployerTax:output(socialSecurity),
    medicareEmployerTax:output(medicareTax),
    employerFicaTotal:output(total),
    employeeAdditionalMedicareEmployerMatch:0,
    sampleOnly:true,
    taxRulesVerified:false,
    ruleIds:['US-2026-oasdi-preview-v1','US-2026-medicare-preview-v1'],
    sourceUrls:[...new Set(sources)],
    warnings:[
      'Employer share only: 6.2% Social Security up to the annual wage base and 1.45% Medicare on all covered wages.',
      'No employer match applies to Additional Medicare Tax. Excludes FUTA, state unemployment, special wage classes, tips, household/election-worker thresholds, third-party sick pay, payroll-period rounding and multi-employer aggregation.',
      'The result is an annual aggregate estimate for one employee and one employer, not a payroll deposit or filing amount.'
    ]
  };
}
