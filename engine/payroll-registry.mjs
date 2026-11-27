import data from '../rules/payroll-versions.json' with { type: 'json' };
import {
  resolveEffectiveRule, resolveFullPeriodRule, taxYearPeriod, validateEffectivePeriods
} from './statutory-context.mjs';

const schema={
 'US:oasdi':['annualWageBase','employeeRateBasisPoints'],
 'US:medicare':['employeeRateBasisPoints','additionalRateBasisPoints','additionalThreshold'],
 'GB:ni':['monthlyLower','monthlyUpper','mainRateBasisPoints','upperRateBasisPoints'],
 'CA:cpp-ei':['cppExemption','cppCeiling','cpp2Ceiling','cppRateBasisPoints','cpp2RateBasisPoints','cppEnhancedRateBasisPoints','eiCeiling','eiRateBasisPoints'],
 'AU:medicare-levy':['fullRateBasisPoints','minimumSupportedIncome'],
 'IN:epf':['employeeRateBasisPoints','maximumSupportedWage'],
 'SG:cpf':['ordinaryWageCeiling','minimumExclusiveWage','ageRates']
};
const ageBands=['55-or-under','56-60','61-65','66-70','over-70'];
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;

export function validatePayrollRegistry(registry){
 if(registry?.schemaVersion!==1||!Array.isArray(registry.versions)||!registry.versions.length||registry.versions.length>250)throw Error('Invalid payroll registry');
 const ids=new Set();
 for(const r of registry.versions){
  const key=r.jurisdiction+':'+r.component,year=r.taxYear;
  if(!Object.hasOwn(schema,key)||typeof year!=='string'||!/^\d{4}$/.test(year)||+year<2000||+year>2100||typeof r.version!=='string'||!r.version||ids.has(r.version)||!['preview'].includes(r.status)||r.legalStatus!=='unverified'||!exact(r.parameters,schema[key]))throw Error('Invalid payroll rule');
  const period=taxYearPeriod(r.jurisdiction,year);
  if(typeof r.effectiveFrom!=='string'||typeof r.effectiveUntil!=='string'||r.effectiveFrom<period.start||r.effectiveUntil>period.end||r.effectiveFrom>=r.effectiveUntil)throw Error('Invalid payroll effective period');
  ids.add(r.version);
  const p=r.parameters;
  for(const [k,v] of Object.entries(p)){if(k==='ageRates'){if(!exact(v,ageBands)||Object.values(v).some(a=>!Array.isArray(a)||a.length!==2||!a.every(n=>integer(n,10000))||a[0]>a[1]))throw Error('Invalid CPF age rates');}else if(!integer(v,k.endsWith('BasisPoints')?10000:1e9))throw Error('Invalid payroll value');}
  if(key==='CA:cpp-ei'&&(p.cppExemption>=p.cppCeiling||p.cppCeiling>=p.cpp2Ceiling||p.cppEnhancedRateBasisPoints>p.cppRateBasisPoints)||key==='GB:ni'&&p.monthlyLower>=p.monthlyUpper||key==='SG:cpf'&&p.minimumExclusiveWage>=p.ordinaryWageCeiling)throw Error('Inconsistent payroll thresholds');
  if(!Array.isArray(r.sourceUrls)||!r.sourceUrls.length||r.sourceUrls.some(v=>{try{const u=new URL(v);return u.protocol!=='https:'||u.username||u.password;}catch{return true;}}))throw Error('Invalid sources');
 }
 validateEffectivePeriods(registry.versions);
 return registry;
}
function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
const baseline=freeze(validatePayrollRegistry(data));
export function payrollRules(){return baseline.versions;}

/** Resolve a payroll rule for a particular effective date. */
export function resolvePayrollRuleAt(jurisdiction,component,asOf,registry=baseline,taxpayer={}){
 const source=registry===baseline?baseline:validatePayrollRegistry(registry);
 return resolveEffectiveRule({versions:source.versions},{jurisdiction,component,asOf,taxpayer});
}

/** Annual payroll models require one rule to cover the complete tax year. */
export function resolvePayrollRule(jurisdiction,component,taxYear,registry=baseline,taxpayer={}){
 const source=registry===baseline?baseline:validatePayrollRegistry(registry);
 const period=taxYearPeriod(jurisdiction,taxYear);
 const rows=source.versions.filter(r=>r.taxYear===taxYear);
 return resolveFullPeriodRule({versions:rows},{
  jurisdiction,component,periodStart:period.start,periodEnd:period.end,taxpayer
 });
}
