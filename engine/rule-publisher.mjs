import {verifyStatutoryReview} from './statutory-review.mjs';
import {nationalEvidenceRules} from './national-registry.mjs';
import {verifyRuleSnapshot,snapshotBytes} from './rule-snapshot.mjs';
import {calculateRegionalTax,compareIndiaRegimes,calculateSalaryRemainder,calculateEmployeeContributions,assessTaxableIncome,calculateCapitalGain} from './taxable-income.mjs';
import {regionalRules,resolveRegionalRule} from './regional-registry.mjs';
import {resolveIndiaSalaryRule} from './india-salary-registry.mjs';
import {payrollRules,resolvePayrollRule} from './payroll-registry.mjs';
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async v=>hex(await crypto.subtle.digest('SHA-256',snapshotBytes(v)));
export async function readRuleHead(db){const head=await db.prepare('SELECT sequence,digest,envelope,state FROM regulatory_head WHERE id=1').first();if(!head||!Number.isSafeInteger(head.sequence)||head.sequence<0)throw Error('Missing regulatory head');return head;}
export function verifyCoverage(s){for(const r of regionalRules()){const [country,region]=r.jurisdiction.split('-');resolveRegionalRule({country,region,taxYear:r.taxYear},s.regional);}resolveIndiaSalaryRule('2026',s.indiaSalary);for(const r of payrollRules())resolvePayrollRule(r.jurisdiction,r.component,r.taxYear,s.payroll);}
const methods={
 'regional-tax':(i,c)=>calculateRegionalTax(i,c.regional),
 'india-salary':(i,c)=>compareIndiaRegimes(i,c.indiaSalary),
 'salary-remainder':calculateSalaryRemainder,
 'employee-contributions':calculateEmployeeContributions,
 'taxable-income':assessTaxableIncome,
 'capital-gain':calculateCapitalGain
};
export async function verifyPublicationFixtures(snapshot,evidence,fixtures){
 if(!Array.isArray(fixtures)||fixtures.length>1000)throw Error('Invalid fixtures');
 const ctx={regional:snapshot.regional,indiaSalary:snapshot.indiaSalary,payroll:snapshot.payroll,national:snapshot.national};
 const rules=[...snapshot.regional.versions,...snapshot.indiaSalary.versions,...snapshot.payroll.versions,...await nationalEvidenceRules(snapshot.national)];
 for(const e of evidence){
  const rule=rules.find(r=>r.version===e.version);
  const rows=fixtures.filter(f=>f.version===e.version);
  if(!rule)throw Error('Unknown fixture rule');
  if(rows.length<2||new Set(rows.map(f=>f.id)).size!==rows.length||await hash(rows)!==e.fixtureDigest)throw Error('Missing independent fixture evidence: '+e.version);
  for(const f of rows){if(!Object.hasOwn(methods,f.method)||typeof f.id!=='string'||!Array.isArray(f.path)||!f.path.length||f.path.some(k=>typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))||typeof f.expected!=='number'||!Number.isFinite(f.expected))throw Error('Invalid fixture');
   const i=f.input;if(!i||i.taxYear!==rule.taxYear||i.country!==rule.jurisdiction.split('-')[0])throw Error('Fixture jurisdiction or period mismatch');
   if(rule.component==='salary-assessment'&&f.method!=='salary-remainder'||rule.component==='national-assessment'&&f.method!==(rule.jurisdiction==='US'?'salary-remainder':'taxable-income')||rule.component==='investment-assessment'&&f.method!=='capital-gain'||rule.component==='regional-income-tax'&&(f.method!=='regional-tax'||i.country+'-'+i.region!==rule.jurisdiction)||rule.component==='ordinary-salary'&&f.method!=='india-salary'||['oasdi','medicare','ni'].includes(rule.component)&&f.method!=='salary-remainder'||['cpp-ei','medicare-levy','epf','cpf'].includes(rule.component)&&f.method!=='employee-contributions')throw Error('Fixture does not exercise rule component');
   const result=methods[f.method](i,ctx);
   const actual=f.path.reduce((o,k)=>o&&Object.hasOwn(o,k)?o[k]:undefined,result);
   if(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual-f.expected)>.005)throw Error('Fixture mismatch: '+f.id);
  }
 }
}
export async function publishSnapshot(db,envelope,fixtures,{publicKeyHex,engineFingerprint,review,reviewerPublicKeyHex,reviewerId,now=new Date(),sequenceFloorStore=null}){
 await verifyStatutoryReview(envelope,review,{publicKeyHex,reviewerPublicKeyHex,reviewerId,now});
 const head=await readRuleHead(db);
 const previous=head.envelope?JSON.parse(head.envelope).payload:null;
 const snapshot=await verifyRuleSnapshot(envelope,{publicKeyHex,engineFingerprint,minimumSequence:head.sequence,previous,now});
 verifyCoverage(snapshot);
 await verifyPublicationFixtures(snapshot,envelope.payload.evidence,fixtures);
 if(sequenceFloorStore){
  const raw=await sequenceFloorStore.get('taxpulse:regulatory-sequence-floor','text');
  if(raw===null||!/^(0|[1-9]\d*)$/.test(raw))throw Error('Durable regulatory sequence floor is not initialized');
  const floor=Number(raw);
  if(!Number.isSafeInteger(floor)||head.sequence>floor||snapshot.sequence<=floor)throw Error('Snapshot does not advance the durable regulatory sequence floor');
  // Advance the independent floor before touching D1. A failed D1 write leaves
  // the system fail-closed and requires a new higher-sequence approval.
  await sequenceFloorStore.put('taxpulse:regulatory-sequence-floor',String(snapshot.sequence));
 }
 const result=await db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,review_record=?,state='active' WHERE id=1 AND sequence=?").bind(snapshot.sequence,snapshot.digest,new TextDecoder().decode(snapshotBytes(envelope)),new TextDecoder().decode(snapshotBytes({review,publisherPublicKeyHex:publicKeyHex,reviewerPublicKeyHex})),head.sequence).run();
 if(result.meta?.changes!==1)throw Error('Concurrent publication; retry with fresh head');
 return {sequence:snapshot.sequence,digest:snapshot.digest,state:'active',taxRulesVerified:false};
}
// Emergency block retains the previous envelope and advances the sequence.
// Recovery requires a newly signed snapshot, never a replay of an older pointer.
export async function blockSnapshot(db,expectedSequence,sequenceFloorStore=null){
 if(!Number.isSafeInteger(expectedSequence)||expectedSequence<1)throw Error('Invalid sequence');
 if(sequenceFloorStore){
  const raw=await sequenceFloorStore.get('taxpulse:regulatory-sequence-floor','text');
  if(raw===null||!/^(0|[1-9]\d*)$/.test(raw))throw Error('Durable regulatory sequence floor is not initialized');
  const floor=Number(raw);
  if(!Number.isSafeInteger(floor)||expectedSequence>floor)throw Error('Database sequence exceeds durable recovery floor');
  if(expectedSequence+1>floor)await sequenceFloorStore.put('taxpulse:regulatory-sequence-floor',String(expectedSequence+1));
 }
 const r=await db.prepare("UPDATE regulatory_head SET sequence=sequence+1,state='blocked' WHERE id=1 AND sequence=? AND state='active'").bind(expectedSequence).run();
 if(r.meta?.changes!==1)throw Error('Concurrent update or no active snapshot');
 return {sequence:expectedSequence+1,state:'blocked'};
}
