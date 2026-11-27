import baseline from '../rules/national-investment-2026.json' with {type:'json'};
import {resolveEffectiveRule,validateEffectivePeriods} from './statutory-context.mjs';

const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const safe=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0&&v<=max;

function checkShape(value,model,path=''){
 if(path==='effectivePeriods'){if(!Array.isArray(value))throw Error('Invalid effective periods');return;}
 if(typeof model==='number'){if(!safe(value,path.startsWith('national.DE.')?Number.MAX_SAFE_INTEGER:/rate/i.test(path)?10000:1e9))throw Error('Invalid parameter '+path);return;}
 if(typeof model==='string'){if(value!==model)throw Error('Incompatible metadata '+path);return;}
 if(Array.isArray(model)){if(!Array.isArray(value)||value.length!==model.length)throw Error('Unsupported schedule structure '+path);for(let i=0;i<model.length;i++)checkShape(value[i],model[i],path+'.'+i);return;}
 if(!exact(value,Object.keys(model)))throw Error('Unsupported fields '+path);
 for(const k of Object.keys(model))checkShape(value[k],model[k],path?path+'.'+k:k);
}

const increasing=a=>a.every((v,i)=>v>0&&(i===0||v>a[i-1]));
function effectivePeriod(country,year){
 const y=Number(year),next=String(y+1).padStart(4,'0');
 const start=country==='SG'?String(y-1).padStart(4,'0')+'-01-01':
  country==='GB'?year+'-04-06':country==='IN'?year+'-04-01':
  country==='AU'?year+'-07-01':year+'-01-01';
 const end=country==='SG'?year+'-01-01':
  country==='GB'?next+'-04-06':country==='IN'?next+'-04-01':
  country==='AU'?next+'-07-01':next+'-01-01';
 return {start,end};
}

export function validateNationalRegistry(data){
 checkShape(data,baseline);
 const n=data.national,i=data.investment;
 for(const c of ['CA','AU','SG'])if(!increasing(n[c].bounds)||n[c].rates.length!==n[c].bounds.length+1)throw Error('Invalid brackets');
 for(const f of Object.values(n.US.filing))if(!increasing(f.bounds)||f.zero>=f.top||f.bounds.length+1!==n.US.ordinaryRates.length)throw Error('Invalid US filing schedule');
 if(!increasing(n.DE.limits)||n.DE.linearDivisor===0||n.DE.quadraticDivisor===0||n.CA.creditPhaseStart>=n.CA.creditPhaseEnd||n.CA.creditReduction>n.CA.basicPersonalAmount||n.AU.offsetFirstLimit>=n.AU.offsetSecondLimit||i.IN.minimumOtherIncome>i.IN.maximumCombinedIncome||i.IN.propertyHoldingYears<1||i.IN.equityHoldingYears<1||i.US.holdingYears<1)throw Error('Inconsistent national parameters');
 if(n.AE.employeeWagesRate!==0)throw Error('UAE scope must be reviewed before changing zero-wage-tax method');

 const expected=new Map();
 for(const country of Object.keys(n))expected.set(country+':national-assessment',{country,component:'national-assessment'});
 for(const country of Object.keys(i))expected.set(country+':investment-assessment',{country,component:'investment-assessment'});
 if(!Array.isArray(data.effectivePeriods)||data.effectivePeriods.length!==expected.size)throw Error('Missing national rule periods');
 validateEffectivePeriods(data.effectivePeriods);
 const seen=new Set();
 for(const row of data.effectivePeriods){
  if(!exact(row,['jurisdiction','component','taxYear','version','effectiveFrom','effectiveUntil','status','legalStatus'])||
     row.taxYear!==data.taxYear||row.status!=='preview'||row.legalStatus!=='unverified')throw Error('Invalid national rule version metadata');
  const key=row.jurisdiction+':'+row.component,known=expected.get(key);
  if(!known||seen.has(key))throw Error('Unexpected or duplicate national rule period');
  const period=effectivePeriod(known.country,data.taxYear);
  if(row.effectiveFrom!==period.start||row.effectiveUntil!==period.end)throw Error('National rule period does not match the assessment year');
  if(!Array.isArray(data.sources[row.jurisdiction])||!data.sources[row.jurisdiction].length)throw Error('Missing national source evidence');
  seen.add(key);
 }
 if(seen.size!==expected.size)throw Error('Incomplete national rule version coverage');
 return data;
}

function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
const data=freeze(validateNationalRegistry(baseline));

export function resolveNationalRule(country,component,taxYear,asOf,registry=data){
 const source=registry===data?data:validateNationalRegistry(registry);
 if(taxYear!==source.taxYear)throw RangeError('Unsupported national assessment year');
 const rule=resolveEffectiveRule({versions:source.effectivePeriods},{jurisdiction:country,component,asOf});
 if(rule.taxYear!==taxYear)throw RangeError('National rule tax year mismatch');
 const key=component==='national-assessment'?'national':component==='investment-assessment'?'investment':null;
 if(!key||!Object.hasOwn(source[key],country))throw RangeError('Unsupported national rule component');
 return Object.freeze({...rule,parameters:source[key][country],sourceUrls:source.sources[country]});
}

export function nationalRules(year,registry=data,country=null,component='national-assessment'){
 const source=registry===data?data:validateNationalRegistry(registry);
 if(year!==source.taxYear)throw RangeError('Unsupported national assessment year');
 if(country!==null){
  const period=effectivePeriod(country,year);
  resolveNationalRule(country,component,year,period.start,source);
 }
 return source;
}

// Evidence rows bind stable version IDs to the source URLs and parameter payload
// included in the signed snapshot. Reviewer fixtures remain a separate attestation.
export async function nationalEvidenceRules(registry){
 validateNationalRegistry(registry);
 const rows=[];
 for(const [table,component] of [['national','national-assessment'],['investment','investment-assessment']]){
  for(const country of Object.keys(registry[table])){
   const period=registry.effectivePeriods.find(r=>r.jurisdiction===country&&r.component===component&&r.taxYear===registry.taxYear);
   if(!period)throw Error('Missing effective-dated national rule');
   rows.push({version:period.version,jurisdiction:country,taxYear:registry.taxYear,component,sourceUrls:registry.sources[country],effectiveFrom:period.effectiveFrom,effectiveUntil:period.effectiveUntil});
  }
 }
 return rows;
}
