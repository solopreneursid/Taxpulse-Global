import {statutoryReviewPayload} from '../engine/statutory-review.mjs';
import {nationalEvidenceRules} from '../engine/national-registry.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {snapshotBytes} from '../engine/rule-snapshot.mjs';
import {publishSnapshot,blockSnapshot} from '../engine/rule-publisher.mjs';
import {runScheduledPublication} from '../engine/scheduled-publication.mjs';
import {RegulatorySequenceAnchor} from '../engine/regulatory-sequence-anchor.mjs';
import {loadRuntimeRules} from '../engine/runtime-rules.mjs';
const read=p=>JSON.parse(readFileSync(new URL('../rules/'+p,import.meta.url)));
const regional=read('regional-versions.json'),indiaSalary=read('india-salary-versions.json'),payroll=read('payroll-versions.json');
const national=read('national-investment-2026.json');
const nationalEvidence=await nationalEvidenceRules(national);
const now=new Date('2026-11-25T12:00:00.000Z'),engineFingerprint='a'.repeat(64);
const hex=b=>Buffer.from(b).toString('hex');
const digest=async p=>hex(await crypto.subtle.digest('SHA-256',snapshotBytes(p)));
function createAnchor(initial={schemaVersion:1,sequence:0,digest:null,state:'empty'},mirror=null){
 const storage={value:structuredClone(initial),async get(key){return key==='anchor'?structuredClone(this.value):undefined;},async put(key,value){if(key!=='anchor')throw Error('Unexpected anchor storage key');this.value=structuredClone(value);}};
 const state={storage,async blockConcurrencyWhile(fn){return fn();}};
 const instance=new RegulatorySequenceAnchor(state,{RULE_SEQUENCE_FLOOR:mirror});
 const stub={fetch:(url,init={})=>instance.fetch(new Request(url,init))};
 const binding={idFromName(name){assert.equal(name,'taxpulse-regulatory-head-v1');return 'sequence-anchor-test';},get(id){assert.equal(id,'sequence-anchor-test');return stub;}};
 const client={
  async getState(){const r=await stub.fetch('https://anchor.test/state');if(!r.ok)throw Error('anchor read failed');return r.json();},
  async advance(input){const r=await stub.fetch('https://anchor.test/advance',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const value=await r.json();if(!r.ok)throw Error(value.error);return value;}
 };
 return {binding,client,state:()=>structuredClone(storage.value)};
}
const key=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const publicKeyHex=hex(await crypto.subtle.exportKey('raw',key.publicKey)),options={publicKeyHex,engineFingerprint,now};
const reviewer=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
const reviewerPublicKeyHex=hex(await crypto.subtle.exportKey('raw',reviewer.publicKey)),reviewerId='synthetic-test-reviewer';
async function approvedPack(sequence){const packData=await pack(sequence);const payload=statutoryReviewPayload(packData.envelope,reviewerId,now.toISOString());return {...packData,review:{payload,signature:hex(await crypto.subtle.sign('Ed25519',reviewer.privateKey,snapshotBytes(payload)))}};}
function migrate(db){for(const file of ['001-regulatory-snapshots.sql','002-regulatory-version-ledger.sql','003-regulatory-unique-versions.sql','004-regulatory-review-archive.sql','005-regulatory-national-version-ledger.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));}
const approvedOptions=(packData,sequenceAnchor)=>({...options,sequenceAnchor,review:packData.review,reviewerPublicKeyHex,reviewerId});
function dbAdapter(db){return {prepare(sql){const s=db.prepare(sql);let args=[];return {bind(...a){args=a;return this;},async first(){return s.get(...args);},async run(){return {meta:{changes:Number(s.run(...args).changes)}};}};}};}
async function pack(sequence){
 const p={schemaVersion:2,sequence,engineFingerprint,issuedAt:'2026-11-25T00:00:00.000Z',expiresAt:'2026-11-30T00:00:00.000Z',mode:'preview',regional:structuredClone(regional),indiaSalary:structuredClone(indiaSalary),payroll:structuredClone(payroll),national:structuredClone(national),evidence:[]};
 const fixtures=[];
 const add=(r,method,input,path,expected)=>fixtures.push({version:r.version,id:r.version+'-'+fixtures.length,method,input,path,expected});
 for(const r of p.regional.versions){const [country,region]=r.jurisdiction.split('-');for(const income of [0,1000])add(r,'regional-tax',{country,region,taxYear:'2026',income,scopeConfirmed:true},['regionalTax'],country==='GB'?0:income*r.rates[0]/10000);}
 for(const r of p.indiaSalary.versions)for(const grossSalary of [0,1000000])add(r,'india-salary',{country:'IN',taxYear:'2026',grossSalary,residentIndividual:true,ageGroup:'under-60',ordinarySalaryOnly:true,oldEligibleDeductions:0,newEligibleDeductions:0},['newRegime','incomeTax'],0);
 for(const r of p.payroll.versions){
  const country=r.jurisdiction;
  if(['oasdi','medicare','ni'].includes(r.component)){
   const gb=country==='GB';for(const pay of gb?[1000,2000]:[100000,200000])add(r,'salary-remainder',{country,region:gb?'RUK':'TX',taxYear:'2026',pay,scopeConfirmed:true},['contributions',r.component==='medicare'?'1':'0','amount'],r.component==='oasdi'?(pay===100000?6200:11439):r.component==='medicare'?pay*.0145:pay===1000?0:913.92);
  }else{
   const values={CA:[[0,0],[3500,57.05]],AU:[[100000,2000],[110000,2200]],IN:[[10000,1200],[15000,1800]],SG:[[1000,200],[2000,400]]}[country];
   for(const [income,expected] of values)add(r,'employee-contributions',{country,taxYear:'2026',income,scopeConfirmed:true,...(country==='SG'?{ageBand:'55-or-under'}:{})},['totalEmployeeContribution'],expected);
  }
 }
 const nationalEvidence=await nationalEvidenceRules(p.national);
 for(const r of nationalEvidence){
  const country=r.jurisdiction;
  if(r.component==='salary-assessment'){
   for(const [pay,expected] of [[3000,156],[4000,459]])add(r,'salary-remainder',{country:'SG',region:'SG',taxYear:'2026',pay,scopeConfirmed:true},['incomeTax'],expected);
  }else if(r.component==='national-assessment'){
   if(country==='US'){for(const [pay,expected] of [[16100,0],[26100,1000]])add(r,'salary-remainder',{country,region:'TX',taxYear:'2026',pay,scopeConfirmed:true},['incomeTax'],expected);}
   else if(country==='AE'){for(const salaryIncome of [1000,100000])add(r,'taxable-income',{country,taxYear:'2026',salaryIncome,employeeWagesOnly:true},['incomeTax'],0);}
   else {const rows={AU:[[100000,20520],[110000,23520]],CA:[[10000,0],[20000,496.72]],SG:[[10000,0],[30000,200]],DE:[[1000,0],[12348,0]]}[country];for(const [taxableIncome,expected] of rows)add(r,'taxable-income',{country,taxYear:'2026',taxableIncome,...(country==='DE'?{assessment:'individual'}:country==='CA'?{netIncome:taxableIncome,fullYearResident:true}:{residentEligible:true})},['incomeTax'],expected);}
  }else{for(const saleProceeds of [1000,10000]){const input={country,taxYear:'2026',acquired:'2020-01-01',disposed:'2026-05-01',saleProceeds,adjustedBasis:0,eligibleLosses:0,otherTaxableIncome:country==='IN'?1500000:0,scopeConfirmed:true,...(country==='US'?{filingStatus:'single'}:country==='IN'?{assetType:'listed-equity'}:{})};add(r,'capital-gain',input,['estimatedGainTax'],country==='GB'?Math.max(0,saleProceeds-3000)*.18:0);}}
 }
 for(const r of [...p.regional.versions,...p.indiaSalary.versions,...p.payroll.versions,...nationalEvidence])p.evidence.push({version:r.version,sourceUrl:r.sourceUrls[0],sourceDigest:'b'.repeat(64),reviewedAt:'2026-11-24T00:00:00.000Z',fixtureDigest:await digest(fixtures.filter(f=>f.version===r.version))});
 return {envelope:{payload:p,digest:await digest(p),signature:hex(await crypto.subtle.sign('Ed25519',key.privateKey,snapshotBytes(p)))},fixtures};
}
test('atomic publication, fixture rejection, replay, emergency block and forward recovery',async()=>{
 const sqlite=new DatabaseSync(':memory:');try{
 migrate(sqlite);const db=dbAdapter(sqlite),anchor=createAnchor();
 const one=await approvedPack(1),bad=structuredClone(one.fixtures);bad[0].expected=1;
 await assert.rejects(publishSnapshot(db,one.envelope,one.fixtures,{...options,sequenceAnchor:anchor.client}));
 await assert.rejects(publishSnapshot(db,one.envelope,bad,approvedOptions(one,anchor.client)));
 assert.equal(sqlite.prepare('SELECT sequence FROM regulatory_head').get().sequence,0);

 assert.equal((await publishSnapshot(db,one.envelope,one.fixtures,approvedOptions(one,anchor.client))).state,'active');
 const expectedLedger=regional.versions.length+indiaSalary.versions.length+payroll.versions.length+nationalEvidence.length;
 assert.equal(sqlite.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,expectedLedger);
 const nationalLedger=sqlite.prepare('SELECT definition FROM regulatory_version_ledger WHERE version=?').get('AU-2026-national-assessment-v1');
 const nationalDefinition=JSON.parse(nationalLedger.definition);
 assert.equal(nationalDefinition.period.effectiveFrom,'2026-07-01');
 assert.deepEqual(nationalDefinition.parameters.rates,national.national.AU.rates);
 const mutated=await pack(2);
 mutated.envelope.payload.national.national.AU.rates[1]+=100;
 assert.throws(()=>sqlite.prepare('INSERT INTO regulatory_snapshots(sequence,digest,envelope,published_at,review_record) VALUES(?,?,?,?,?)').run(2,'d'.repeat(64),JSON.stringify(mutated.envelope),now.toISOString(),null),/immutable historical version changed/);
 const env={RULE_DB:db,RULE_PUBLIC_KEY:publicKeyHex,RULE_REVIEW_PUBLIC_KEY:reviewerPublicKeyHex,RULE_REVIEWER_ID:reviewerId,RULE_MIN_SEQUENCE:'1'};
 assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'signed-preview');
 await assert.rejects(publishSnapshot(db,one.envelope,one.fixtures,approvedOptions(one,anchor.client)));
 await blockSnapshot(db,1,anchor.client);assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).state,'blocked');
 const three=await approvedPack(3);await publishSnapshot(db,three.envelope,three.fixtures,approvedOptions(three,anchor.client));
 assert.equal((await loadRuntimeRules(env,engineFingerprint,{now})).sequence,3);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM regulatory_snapshots').get().n,2);
 assert.equal(sqlite.prepare('SELECT count(*) n FROM regulatory_events').get().n,3);
 const archived=sqlite.prepare('SELECT sequence,review_record FROM regulatory_snapshots ORDER BY sequence').all();
 assert.deepEqual(archived.map(row=>JSON.parse(row.review_record)),[one,three].map(p=>({review:p.review,publisherPublicKeyHex:publicKeyHex,reviewerPublicKeyHex})));
 assert.throws(()=>sqlite.exec("UPDATE regulatory_snapshots SET review_record=NULL"),/immutable snapshot archive/);
 }finally{sqlite.close();}
});

test('scheduled publisher requires independent approval, rejects tampering and retains active head',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 try{
  migrate(sqlite);const db=dbAdapter(sqlite);let pending=null,floorValue='0';
  const floorStore={async put(key,value){if(key!=='taxpulse:regulatory-sequence-floor')throw Error('Unexpected floor key');floorValue=value;}};
  const anchor=createAnchor(undefined,floorStore);
  const env={RULE_DB:db,RULE_PUBLIC_KEY:publicKeyHex,RULE_REVIEW_PUBLIC_KEY:reviewerPublicKeyHex,RULE_REVIEWER_ID:reviewerId,
   RULE_INBOX:{async get(){return pending;}},REGULATORY_SEQUENCE_ANCHOR:anchor.binding,RULE_SEQUENCE_FLOOR:floorStore};
  await assert.rejects(runScheduledPublication({...env,RULE_REVIEW_PUBLIC_KEY:publicKeyHex},engineFingerprint,{now}));
  await assert.rejects(runScheduledPublication({...env,REGULATORY_SEQUENCE_ANCHOR:undefined},engineFingerprint,{now}),/Incomplete publisher configuration/);
  assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).state,'no_candidate');
  pending=JSON.stringify(await pack(1));await assert.rejects(runScheduledPublication(env,engineFingerprint,{now}));
  assert.equal(sqlite.prepare('SELECT sequence FROM regulatory_head').get().sequence,0);
  pending=JSON.stringify(await approvedPack(1));
  assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).state,'active');
  assert.equal(floorValue,'1');
  assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).state,'already_processed');
  const two=await approvedPack(2);two.envelope.signature='0'.repeat(128);pending=JSON.stringify(two);
  await assert.rejects(runScheduledPublication(env,engineFingerprint,{now}));
  const wrongReview=await approvedPack(2);wrongReview.review.payload.reviewerId='wrong-reviewer';pending=JSON.stringify(wrongReview);
  await assert.rejects(runScheduledPublication(env,engineFingerprint,{now}));
  const replay=await approvedPack(2);replay.review=(await approvedPack(1)).review;pending=JSON.stringify(replay);
  await assert.rejects(runScheduledPublication(env,engineFingerprint,{now}));
  assert.equal(sqlite.prepare('SELECT sequence FROM regulatory_head').get().sequence,1);
  pending=JSON.stringify(await approvedPack(2));
  assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).sequence,2);
  assert.equal(floorValue,'2');
 }finally{sqlite.close();}
});

test('independent sequence anchor detects restored D1 rollback and requires a fresh higher approved snapshot',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'taxpulse-sequence-floor-'));let source,restored;
 try{
  source=new DatabaseSync(join(dir,'source.db'));migrate(source);const sourceDb=dbAdapter(source);
  let pending=null,floorValue='0';
  const floorStore={async put(key,value){if(key!=='taxpulse:regulatory-sequence-floor')throw Error('Unexpected floor key');floorValue=value;}};
  const anchor=createAnchor(undefined,floorStore);
  const env={RULE_DB:sourceDb,RULE_PUBLIC_KEY:publicKeyHex,RULE_REVIEW_PUBLIC_KEY:reviewerPublicKeyHex,RULE_REVIEWER_ID:reviewerId,
   RULE_INBOX:{async get(){return pending;}},REGULATORY_SEQUENCE_ANCHOR:anchor.binding,RULE_SEQUENCE_FLOOR:floorStore};
  pending=JSON.stringify(await approvedPack(1));assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).sequence,1);assert.equal(floorValue,'1');
  const backup=join(dir,'before-restore.db');source.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
  pending=JSON.stringify(await approvedPack(2));assert.equal((await runScheduledPublication(env,engineFingerprint,{now})).sequence,2);assert.equal(floorValue,'2');
  restored=new DatabaseSync(backup);const restoredEnv={...env,RULE_DB:dbAdapter(restored)};
  pending=JSON.stringify(await approvedPack(3));
  const detected=await runScheduledPublication(restoredEnv,engineFingerprint,{now});
  assert.deepEqual(detected,{state:'rollback_detected',databaseSequence:1,externalSequenceFloor:2,blockedSequence:3});
  const blocked=restored.prepare('SELECT sequence,state FROM regulatory_head').get();
  assert.equal(blocked.sequence,3);assert.equal(blocked.state,'blocked');assert.equal(floorValue,'3');
  pending=JSON.stringify(await approvedPack(4));
  const recovered=await runScheduledPublication(restoredEnv,engineFingerprint,{now});
  assert.equal(recovered.sequence,4);assert.equal(floorValue,'4');
  const recoveredHead=restored.prepare('SELECT sequence,state FROM regulatory_head').get();
  assert.equal(recoveredHead.sequence,4);assert.equal(recoveredHead.state,'active');
  assert.equal(restored.prepare('SELECT count(*) n FROM regulatory_snapshots').get().n,2);
  assert.equal(restored.prepare('SELECT count(*) n FROM regulatory_events').get().n,3);
 }finally{restored?.close();source?.close();rmSync(dir,{recursive:true,force:true});}
});
