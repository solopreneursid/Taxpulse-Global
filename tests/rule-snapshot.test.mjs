import {nationalEvidenceRules} from '../engine/national-registry.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {snapshotBytes,verifyRuleSnapshot} from '../engine/rule-snapshot.mjs';
import {statutoryReviewPayload} from '../engine/statutory-review.mjs';
import {loadRuntimeRules} from '../engine/runtime-rules.mjs';
import {createReceipt,verifyReceipt} from '../engine/proof.mjs';
import {calculateRegionalTax,compareIndiaRegimes,calculateSalaryRemainder} from '../engine/taxable-income.mjs';
const national=JSON.parse(readFileSync(new URL('../rules/national-investment-2026.json',import.meta.url)));
const nationalEvidence=await nationalEvidenceRules(national);
const payroll=JSON.parse(readFileSync(new URL('../rules/payroll-versions.json',import.meta.url)));
const regional=JSON.parse(readFileSync(new URL('../rules/regional-versions.json',import.meta.url)));
const indiaSalary=JSON.parse(readFileSync(new URL('../rules/india-salary-versions.json',import.meta.url)));
const hex=b=>Buffer.from(b).toString('hex');
const engineFingerprint='a'.repeat(64),now=new Date('2026-11-25T12:00:00.000Z');
const keys=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const publicKeyHex=hex(await webcrypto.subtle.exportKey('raw',keys.publicKey));
function payload(){return {schemaVersion:2,sequence:1,engineFingerprint,issuedAt:'2026-11-25T00:00:00.000Z',expiresAt:'2026-11-30T00:00:00.000Z',mode:'preview',regional:structuredClone(regional),indiaSalary:structuredClone(indiaSalary),payroll:structuredClone(payroll),national:structuredClone(national),evidence:[...regional.versions,...indiaSalary.versions,...payroll.versions,...nationalEvidence].map(r=>({version:r.version,sourceUrl:r.sourceUrls[0],sourceDigest:'b'.repeat(64),reviewedAt:'2026-11-24T00:00:00.000Z',fixtureDigest:'c'.repeat(64)}))};}
async function sign(p){const bytes=snapshotBytes(p);return {payload:p,digest:hex(await webcrypto.subtle.digest('SHA-256',bytes)),signature:hex(await webcrypto.subtle.sign('Ed25519',keys.privateKey,bytes))};}
const options={publicKeyHex,engineFingerprint,now};
const reviewerKeys=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const reviewerPublicKeyHex=hex(await webcrypto.subtle.exportKey('raw',reviewerKeys.publicKey)),reviewerId='synthetic-runtime-reviewer';
async function runtimeEnv(envelope){
 const payload=statutoryReviewPayload(envelope,reviewerId,now.toISOString());
 const review={payload,signature:hex(await webcrypto.subtle.sign('Ed25519',reviewerKeys.privateKey,snapshotBytes(payload)))};
 const row={sequence:envelope.payload.sequence,digest:envelope.digest,envelope:JSON.stringify(envelope),state:'active',review_record:JSON.stringify({review,publisherPublicKeyHex:publicKeyHex,reviewerPublicKeyHex})};
 return {RULE_DB:{prepare:()=>({first:async()=>row})},RULE_PUBLIC_KEY:publicKeyHex,RULE_REVIEW_PUBLIC_KEY:reviewerPublicKeyHex,RULE_REVIEWER_ID:reviewerId,RULE_MIN_SEQUENCE:'1'};
}
test('signed snapshot drives actual calculation without code changes',async()=>{const p=payload();const il=p.regional.versions.find(r=>r.jurisdiction==='US-IL');il.rates=[500];const envelope=await sign(p),snapshot=await verifyRuleSnapshot(envelope,options);assert.equal(calculateRegionalTax({country:'US',region:'IL',taxYear:'2026',income:100000,scopeConfirmed:true},snapshot.regional).regionalTax,5000);assert.equal(snapshot.taxRulesVerified,false);});
test('tampering, replay, missing evidence, invalid schema and expired signature rejected',async()=>{const e=await sign(payload());await assert.rejects(verifyRuleSnapshot(e,{...options,minimumSequence:1}));await assert.rejects(verifyRuleSnapshot(e,{...options,now:new Date('2026-12-01T00:00:00Z')}));await assert.rejects(verifyRuleSnapshot(e,{...options,engineFingerprint:'d'.repeat(64)}));const tampered=structuredClone(e);tampered.payload.regional.versions[0].rates[0]=1;await assert.rejects(verifyRuleSnapshot(tampered,options));const p=payload();p.evidence.pop();await assert.rejects(verifyRuleSnapshot(await sign(p),options));const q=payload();q.mode='production';await assert.rejects(verifyRuleSnapshot(await sign(q),options));});

test('runtime loads signed preview with a pinned context and rejects invalid configurations',async()=>{const p=payload();const il=p.regional.versions.find(r=>r.jurisdiction==='US-IL');il.version='US-IL-synthetic-2';il.rates=[500];p.evidence.find(e=>e.version==='US-IL-2026-regional-v1').version=il.version;const e=await sign(p);const env=await runtimeEnv(e);const r=await loadRuntimeRules(env,engineFingerprint,{now});assert.equal(r.state,'signed-preview');assert.notEqual(r.engineFingerprint,engineFingerprint);const input={country:'US',region:'IL',taxYear:'2026',income:100000,scopeConfirmed:true};assert.equal(calculateRegionalTax(input,r.context.regional).regionalTax,5000);const receipt=await createReceipt({kind:'regional-tax',input,engineFingerprint:r.engineFingerprint},r.context);assert.equal((await verifyReceipt(receipt,r.engineFingerprint,r.context)).reproduced,true);assert.equal((await verifyReceipt(receipt,engineFingerprint)).reproduced,false);assert.equal((await loadRuntimeRules({...env,RULE_MIN_SEQUENCE:'2'},engineFingerprint,{now})).state,'blocked');assert.equal((await loadRuntimeRules({},engineFingerprint,{now})).state,'bundled-preview');assert.equal((await loadRuntimeRules({RULE_PUBLIC_KEY:publicKeyHex},engineFingerprint,{now})).state,'blocked');});

test('signed national update changes assessment, salary and receipt together',async()=>{const p=payload();p.national.national.AU.rates[1]=1400;const updated=await nationalEvidenceRules(p.national);p.evidence=p.evidence.filter(e=>!nationalEvidence.some(r=>r.version===e.version));p.evidence.push(...updated.map(r=>({version:r.version,sourceUrl:r.sourceUrls[0],sourceDigest:'b'.repeat(64),reviewedAt:'2026-11-24T00:00:00.000Z',fixtureDigest:'c'.repeat(64)})));const e=await sign(p);const r=await loadRuntimeRules(await runtimeEnv(e),engineFingerprint,{now});assert.equal(r.state,'signed-preview');const input={country:'AU',taxYear:'2026',taxableIncome:100000,residentEligible:true};const receipt=await createReceipt({kind:'taxable-income',input,engineFingerprint:r.engineFingerprint},r.context);assert.equal(receipt.payload.result.incomeTax,20252);assert.equal((await verifyReceipt(receipt,r.engineFingerprint,r.context)).reproduced,true);});

test('runtime rejects publisher-only and tampered, revoked or missing independent review',async()=>{const e=await sign(payload());const env=await runtimeEnv(e);const row=await env.RULE_DB.prepare('').first();const original=row.review_record;assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'signed-preview');for(const config of [{...env,RULE_REVIEW_PUBLIC_KEY:publicKeyHex},{...env,RULE_REVIEW_PUBLIC_KEY:'d'.repeat(64)},{...env,RULE_REVIEWER_ID:'other-reviewer'},{...env,RULE_REVIEW_PUBLIC_KEY:undefined},{RULE_SNAPSHOTS:{get:async()=>JSON.stringify(e)},RULE_PUBLIC_KEY:publicKeyHex,RULE_MIN_SEQUENCE:'1'},{RULE_REVIEWER_ID:reviewerId}])assert.equal((await loadRuntimeRules(config,engineFingerprint,{now})).state,'blocked');row.review_record=null;assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'blocked');const bad=JSON.parse(original);bad.review.signature='0'.repeat(128);row.review_record=JSON.stringify(bad);assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'blocked');row.review_record=original;assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'signed-preview');});

test('synthetic key rotation and restored-head rollback require new trusted keys and higher sequence',async()=>{
 const old=await sign(payload()),oldEnv=await runtimeEnv(old);
 const newPublisher=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']),newReviewer=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const newPublisherHex=hex(await webcrypto.subtle.exportKey('raw',newPublisher.publicKey)),newReviewerHex=hex(await webcrypto.subtle.exportKey('raw',newReviewer.publicKey));
 const next={...oldEnv,RULE_PUBLIC_KEY:newPublisherHex,RULE_REVIEW_PUBLIC_KEY:newReviewerHex,RULE_MIN_SEQUENCE:'3'};
 assert.equal((await loadRuntimeRules(next,engineFingerprint,{now})).state,'blocked');
 const p={...payload(),sequence:3},bytes=snapshotBytes(p);
 const envelope={payload:p,digest:hex(await webcrypto.subtle.digest('SHA-256',bytes)),signature:hex(await webcrypto.subtle.sign('Ed25519',newPublisher.privateKey,bytes))};
 const approval=statutoryReviewPayload(envelope,reviewerId,now.toISOString());
 const review={payload:approval,signature:hex(await webcrypto.subtle.sign('Ed25519',newReviewer.privateKey,snapshotBytes(approval)))};
 const row={sequence:3,digest:envelope.digest,envelope:JSON.stringify(envelope),state:'active',review_record:JSON.stringify({review,publisherPublicKeyHex:newPublisherHex,reviewerPublicKeyHex:newReviewerHex})};
 const rotated={...next,RULE_DB:{prepare:()=>({first:async()=>row})}};
 assert.equal((await loadRuntimeRules(rotated,engineFingerprint,{now})).state,'signed-preview');
 assert.equal((await loadRuntimeRules({...rotated,RULE_PUBLIC_KEY:publicKeyHex},engineFingerprint,{now})).state,'blocked');
 assert.equal((await loadRuntimeRules({...rotated,RULE_REVIEW_PUBLIC_KEY:reviewerPublicKeyHex},engineFingerprint,{now})).state,'blocked');
 assert.equal((await loadRuntimeRules({...rotated,RULE_DB:oldEnv.RULE_DB},engineFingerprint,{now})).state,'blocked');
 assert.equal((await loadRuntimeRules({...rotated,RULE_MIN_SEQUENCE:'4'},engineFingerprint,{now})).state,'blocked');
});

test('national rule version IDs bind immutable parameter payloads',async()=>{
 const first=payload(),previous=await verifyRuleSnapshot(await sign(first),options);
 const changed=payload();changed.sequence=2;changed.national.national.AU.rates[1]=1400;
 await assert.rejects(
  verifyRuleSnapshot(await sign(changed),{...options,previous}),
  /Immutable national rule version changed/
 );
});
test('started national rule periods cannot be replaced under a new version ID',async()=>{
 const first=payload(),previous=await verifyRuleSnapshot(await sign(first),options);
 const changed=payload();changed.sequence=2;
 const row=changed.national.effectivePeriods.find(r=>r.jurisdiction==='AU'&&r.component==='national-assessment');
 const oldVersion=row.version;row.version='AU-2026-national-assessment-v2';
 changed.evidence=changed.evidence.map(e=>e.version===oldVersion?{...e,version:row.version}:e);
 await assert.rejects(
  verifyRuleSnapshot(await sign(changed),{...options,previous}),
  /Started national rule version cannot be replaced/
 );
});
test('started regional, payroll and salary versions cannot disappear from signed snapshots',async()=>{
 const first=payload(),previous=await verifyRuleSnapshot(await sign(first),options);
 const changed=payload();changed.sequence=2;
 const row=changed.regional.versions.find(r=>r.jurisdiction==='US-IL');
 const oldVersion=row.version;row.version='US-IL-2026-regional-v2';
 changed.evidence=changed.evidence.map(e=>e.version===oldVersion?{...e,version:row.version}:e);
 await assert.rejects(
  verifyRuleSnapshot(await sign(changed),{...options,previous}),
  /Started or historical version cannot be replaced/
 );
});
