import registry from '../rules/regional-versions.json' with { type: 'json' };
import {
  resolveEffectiveRule, resolveFullPeriodRule, taxYearPeriod, validateEffectivePeriods
} from './statutory-context.mjs';

const currencies={US:'USD',CA:'CAD',GB:'GBP'};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;

export function validateRegionalRegistry(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.versions)||!data.versions.length||data.versions.length>1000)throw Error('Invalid regional registry');
 const ids=new Set();
 for(const r of data.versions){
  const country=r.jurisdiction?.split('-')[0];
  if(!Object.hasOwn(currencies,country)||!new RegExp('^'+country+'-[A-Z0-9]{2,12}$').test(r.jurisdiction)||r.component!=='regional-income-tax'||r.currency!==currencies[country]||typeof r.taxYear!=='string'||!/^\d{4}$/.test(r.taxYear)||+r.taxYear<2000||+r.taxYear>2100||typeof r.name!=='string'||!r.name||typeof r.version!=='string'||!r.version||ids.has(r.version)||!date(r.effectiveFrom)||!date(r.effectiveUntil)||r.effectiveFrom>=r.effectiveUntil||r.status!=='preview'||r.legalStatus!=='unverified')throw Error('Invalid or unauthorized regional rule');
  const period=taxYearPeriod(r.jurisdiction,r.taxYear);
  if(r.effectiveFrom<period.start||r.effectiveUntil>period.end)throw Error('Regional effective period falls outside its tax year');
  ids.add(r.version);
  if(!Array.isArray(r.bounds)||!Array.isArray(r.rates)||r.rates.length!==r.bounds.length+1||r.bounds.some((n,i)=>!Number.isSafeInteger(n)||n<=0||n>1e9||(i>0&&n<=r.bounds[i-1]))||r.rates.some(n=>!Number.isSafeInteger(n)||n<0||n>10000))throw Error('Invalid regional schedule');
  if(country==='GB'){const a=r.allowance;if(!a||Object.keys(a).length!==3||!Number.isSafeInteger(a.base)||a.base<0||a.base>1e9||!Number.isSafeInteger(a.taperStart)||a.taperStart<0||a.taperStart>1e9||!Number.isSafeInteger(a.taperDivisor)||a.taperDivisor<1||a.taperDivisor>100)throw Error('Invalid allowance');}else if(r.allowance!==null)throw Error('Unexpected allowance');
  if(!Array.isArray(r.sourceUrls)||!r.sourceUrls.length||r.sourceUrls.some(s=>{try{const u=new URL(s);return u.protocol!=='https:'||u.username||u.password;}catch{return true;}}))throw Error('Invalid source URL');
 }
 validateEffectivePeriods(data.versions);
 return data;
}
const deepFreeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(deepFreeze);Object.freeze(o);}return o;};
const baseline=deepFreeze(validateRegionalRegistry(registry));
export function regionalRules(){return baseline.versions;}

export function resolveRegionalRule({country,region,taxYear},data=baseline){
 if(typeof country!=='string'||typeof region!=='string'||typeof taxYear!=='string')throw new TypeError('Invalid regional rule request');
 const source=data===baseline?baseline:validateRegionalRegistry(data);
 const jurisdiction=country+'-'+region,period=taxYearPeriod(jurisdiction,taxYear);
 const rows=source.versions.filter(r=>r.taxYear===taxYear);
 return resolveFullPeriodRule({versions:rows},{
  jurisdiction,component:'regional-income-tax',periodStart:period.start,periodEnd:period.end
 });
}

export function resolveRegionalRuleAt({country,region,asOf,taxpayer={}},data=baseline){
 const source=data===baseline?baseline:validateRegionalRegistry(data);
 return resolveEffectiveRule({versions:source.versions},{
  jurisdiction:country+'-'+region,component:'regional-income-tax',asOf,taxpayer
 });
}
