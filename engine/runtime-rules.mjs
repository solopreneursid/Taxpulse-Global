import {payrollRules,resolvePayrollRule} from './payroll-registry.mjs';
import {verifyStatutoryReview} from './statutory-review.mjs';
import {verifyRuleSnapshot} from './rule-snapshot.mjs';
import {resolveRegionalRule,regionalRules} from './regional-registry.mjs';
import {resolveIndiaSalaryRule} from './india-salary-registry.mjs';
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export async function loadRuntimeRules(env,engineFingerprint,{now=new Date()}={}){
 const baseline={state:'bundled-preview',engineFingerprint,context:{},taxRulesVerified:false};
 if(!env?.RULE_DB&&!env?.RULE_SNAPSHOTS&&!env?.RULE_PUBLIC_KEY&&!env?.RULE_MIN_SEQUENCE&&!env?.RULE_REVIEW_PUBLIC_KEY&&!env?.RULE_REVIEWER_ID)return baseline;
 try{
  // Only the transactional archive can establish an independently approved head.
  if(!env.RULE_DB||env.RULE_SNAPSHOTS||typeof env.RULE_PUBLIC_KEY!=='string'||typeof env.RULE_REVIEW_PUBLIC_KEY!=='string'||typeof env.RULE_REVIEWER_ID!=='string'||typeof env.RULE_MIN_SEQUENCE!=='string'||!/^\d+$/.test(env.RULE_MIN_SEQUENCE))throw Error('Incomplete runtime configuration');
  const minimum=Number(env.RULE_MIN_SEQUENCE);if(!Number.isSafeInteger(minimum)||minimum<1)throw Error('Invalid sequence floor');
  const head=await env.RULE_DB.prepare('SELECT sequence,digest,envelope,state,review_record FROM regulatory_head WHERE id=1').first();
  if(!head||head.state!=='active'||!Number.isSafeInteger(head.sequence)||head.sequence<minimum)throw Error('No active transactional rule head');
  const raw=head.envelope;
  if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>300000)throw Error('Missing or oversized signed snapshot');
  if(typeof head.review_record!=='string'||new TextEncoder().encode(head.review_record).byteLength>8192)throw Error('Missing or oversized review record');
  const record=JSON.parse(head.review_record),envelope=JSON.parse(raw);
  if(!record||Object.keys(record).length!==3||record.publisherPublicKeyHex!==env.RULE_PUBLIC_KEY||record.reviewerPublicKeyHex!==env.RULE_REVIEW_PUBLIC_KEY)throw Error('Review trust mismatch');
  await verifyStatutoryReview(envelope,record.review,{publicKeyHex:env.RULE_PUBLIC_KEY,reviewerPublicKeyHex:env.RULE_REVIEW_PUBLIC_KEY,reviewerId:env.RULE_REVIEWER_ID,now});
  // Bundled preview data is not a previously signed historical snapshot.
  const previous=null;
  const s=await verifyRuleSnapshot(envelope,{publicKeyHex:env.RULE_PUBLIC_KEY,engineFingerprint,minimumSequence:minimum-1,previous,now});
  if(head.sequence!==s.sequence||head.digest!==s.digest)throw Error('Rule head mismatch');
  // Existing connected tools must all resolve the currently advertised periods.
  for(const r of regionalRules()){const [country,region]=r.jurisdiction.split('-');resolveRegionalRule({country,region,taxYear:r.taxYear},s.regional);}
  resolveIndiaSalaryRule('2026',s.indiaSalary);for(const r of payrollRules())resolvePayrollRule(r.jurisdiction,r.component,r.taxYear,s.payroll);
  const fingerprint=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(engineFingerprint+':'+s.digest)));
  return {state:'signed-preview',engineFingerprint:fingerprint,sequence:s.sequence,digest:s.digest,expiresAt:s.expiresAt,context:{regional:s.regional,indiaSalary:s.indiaSalary,payroll:s.payroll,national:s.national},taxRulesVerified:false};
 }catch{return {state:'blocked',engineFingerprint,context:{},taxRulesVerified:false};}
}
