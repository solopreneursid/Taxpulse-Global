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

const min = (a,b) => a<b?a:b;
const max = (a,b) => a>b?a:b;
const SOURCES = Object.freeze({
 DE:Object.freeze([
  'https://www.deutsche-rentenversicherung.de/DRV/DE/Experten/Zahlen-und-Fakten/Werte-der-Rentenversicherung/werte-der-rentenversicherung',
  'https://www.deutsche-rentenversicherung.de/DRV/DE/Ueber-uns-und-Presse/Presse/Meldungen/2025/25-10-08-bundeskabinett-sv-rechengroessen-vo-2026',
  'https://www.bundesgesundheitsministerium.de/beitraege',
  'https://www.bundesgesundheitsministerium.de/themen/pflege/online-ratgeber-pflege/die-pflegeversicherung/finanzierung'
 ]),
 AE:Object.freeze([
  'https://gpssa.gov.ae/pages/en/media-center/news/gpssa-reviews-most-prominent-features-federal-law-no-57-2023',
  'https://www.gpssa.gov.ae/pages/en/media-center/news/gpssa-insureds-contribution-payment-may-be-extended-15th-day-each-month',
  'https://gpssa.gov.ae/pages/en/media-center/news/gpssas-newly-published-federal-law-no-57-2023-now-available-website'
 ]),
 AU:Object.freeze([
  'https://www.ato.gov.au/rates/key-superannuation-rates-and-thresholds/?anchor=Superguarantee',
  'https://www.ato.gov.au/businesses-and-organisations/super-for-employers/paying-super-on-payday/what-payments-are-qualifying-earnings/maximum-contributions-base'
 ])
});
const preview=(country,currency,component,period,warnings)=>({
 country,currency,component,period,taxYear:'2026',sampleOnly:true,taxRulesVerified:false,
 sourceUrls:[...SOURCES[country]],warnings
});
export function calculateGermanEmployerSocialInsurance(input) {
 const keys=['country','taxYear','monthlyCoveredWage','healthSupplementRate','scopeConfirmed'];
 if(!exact(input,keys)||input.country!=='DE'||input.taxYear!=='2026'||input.scopeConfirmed!==true)
  throw new TypeError('Confirm ordinary German statutory insurance outside Saxony for one full month in 2026');
 const wage=minor(input.monthlyCoveredWage),supplement=minor(input.healthSupplementRate);
 if(wage<250000n||wage>10000000n||supplement>1000n)throw new RangeError('Unsupported wage or insurer supplemental rate');
 const pensionBase=min(wage,845000n),healthBase=min(wage,581250n);
 const pension=applyBasisPoints(pensionBase,930),unemployment=applyBasisPoints(pensionBase,130);
 const health=(healthBase*(1460n+supplement)+10000n)/20000n;
 const care=applyBasisPoints(healthBase,180);
 return {...preview('DE','EUR','employer-social-insurance','calendar 2026, full monthly period',[
  'Ordinary single employee, age 23–64, outside Saxony, full month, no reduced health rate or special insurance category. All entered wages are caller-confirmed contribution wages for all four branches.',
  'Excludes accident insurance, U1/U2 levies, insolvency levy, private insurance, special wage categories, contribution-base determinations and filing. Not a complete employer cost.'
 ]),monthlyCoveredWage:output(wage),pensionContributionBase:output(pensionBase),healthContributionBase:output(healthBase),
 pension:output(pension),unemployment:output(unemployment),health:output(health),longTermCare:output(care),
 totalEmployerContribution:output(pension+unemployment+health+care)};
}
export function calculateUaeFederalPension(input) {
 const keys=['country','taxYear','monthlyContributionSalary','scopeConfirmed'];
 if(!exact(input,keys)||input.country!=='AE'||input.taxYear!=='2026'||input.scopeConfirmed!==true)
  throw new TypeError('Confirm federal Law 57/2023 GPSSA private-sector eligibility and contribution-account salary');
 const salary=minor(input.monthlyContributionSalary);
 if(salary<300000n||salary>7000000n)throw new RangeError('Confirmed contribution salary must be AED 3,000–70,000');
 const employee=applyBasisPoints(salary,1100), grossEmployer=applyBasisPoints(salary,1500);
 const government=salary<2000000n?applyBasisPoints(salary,250):0n;
 const employer=grossEmployer-government;
 return {...preview('AE','AED','federal-private-sector-pension','calendar 2026, monthly',[
  'Only a full month for an eligible Emirati private-sector employee confirmed subject to GPSSA Federal Law 57/2023. The contribution-account salary is supplied, not calculated from gross salary.',
  'Excludes the older federal scheme, separate Abu Dhabi and Sharjah schemes, GCC nationals, expatriates, unpaid leave, proration, registration, penalties and filing.'
 ]),monthlyContributionSalary:output(salary),employeeContribution:output(employee),
 employerContributionBeforeSupport:output(grossEmployer),governmentSupport:output(government),
 employerContribution:output(employer),totalContribution:output(employee+grossEmployer)};
}
export function calculateAustraliaPaydaySuper(input) {
 const keys=['country','taxYear','priorYearToDateQualifyingEarnings','currentPayQualifyingEarnings','scopeConfirmed'];
 if(!exact(input,keys)||input.country!=='AU'||input.taxYear!=='2026'||input.scopeConfirmed!==true)
  throw new TypeError('Confirm ordinary mainland Australian eligible employee, FY 2026–27, one employer');
 const prior=minor(input.priorYearToDateQualifyingEarnings), current=minor(input.currentPayQualifyingEarnings);
 const cap=27083000n, eligible=min(current,max(0n,cap-prior));
 return {...preview('AU','AUD','payday-super-guarantee','1 July 2026 to 30 June 2027',[
  'Caller-confirmed qualifying earnings for one eligible employee and one employer; prior year-to-date earnings exclude the current payday. General 12% rate, annual maximum contribution base.',
  'Excludes Norfolk Island, opt-out certificates, awards or agreements requiring additional super, refunds, contribution deadlines, reporting and penalties.'
 ]),annualContributionBase:output(cap),priorYearToDateQualifyingEarnings:output(prior),
 currentPayQualifyingEarnings:output(current),currentPaySubjectToSuper:output(eligible),
 employerSuperGuarantee:output(applyBasisPoints(eligible,1200)),
 yearToDateQualifyingEarningsForCap:output(min(cap,prior+current))};
}
