import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const migration=name=>readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8');
function reviewRecord(sequence,digest){
 return JSON.stringify({
  review:{payload:{snapshotDigest:digest,sequence},signature:'a'.repeat(128)},
  publisherPublicKeyHex:'b'.repeat(64),
  reviewerPublicKeyHex:'c'.repeat(64)
 });
}
function activate(db,sequence,regional,payroll=[],nationalPeriods=[]){
 const digest=String(sequence).padStart(64,'0');
 const envelope=JSON.stringify({payload:{
  regional:{versions:regional},indiaSalary:{versions:[]},payroll:{versions:payroll},
  national:{effectivePeriods:nationalPeriods,national:{},investment:{},sources:{}}
 }});
 db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,state='active',review_record=? WHERE id=1")
  .run(sequence,digest,envelope,reviewRecord(sequence,digest));
}
function database(){
 const db=new DatabaseSync(':memory:');
 for(const file of [
  '001-regulatory-snapshots.sql','002-regulatory-version-ledger.sql',
  '003-regulatory-unique-versions.sql','004-regulatory-review-archive.sql',
  '005-regulatory-national-version-ledger.sql'
 ])db.exec(migration(file));
 return db;
}

test('database rejects duplicate and missing version IDs atomically',()=>{
 const db=database();
 try{
  activate(db,1,[{version:'v1',rate:100}]);
  for(const [regional,payroll,nationalPeriods] of [
   [[{version:'v2',rate:200},{version:'v2',rate:300}],[],[]],
   [[{version:'v2',rate:200}],[{version:'v2',rate:200}],[]],
   [[{rate:200}],[],[]],
   [[{version:'v2',rate:200}],[],[{version:'v2'}]],
   [[],[],[{version:'v2'},{version:'v2'}]]
  ]){
   assert.throws(()=>activate(db,2,regional,payroll,nationalPeriods),/duplicate or missing snapshot version/);
   assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,1);
   for(const table of ['regulatory_events','regulatory_snapshots','regulatory_version_ledger'])
    assert.equal(db.prepare('SELECT count(*) AS n FROM '+table).get().n,1);
  }
  activate(db,2,[{version:'v2',rate:200}],[{version:'v3',rate:300}]);
  assert.equal(db.prepare('SELECT count(*) AS n FROM regulatory_version_ledger').get().n,3);
 }finally{db.close();}
});

test('archive and version ledger are append-only and require reviewer evidence',()=>{
 const db=database();
 try{
  activate(db,1,[{version:'v1',rate:100}]);
  assert.throws(()=>db.prepare("UPDATE regulatory_version_ledger SET definition='{}' WHERE version='v1'").run(),/immutable version ledger/);
  assert.throws(()=>db.prepare("DELETE FROM regulatory_version_ledger WHERE version='v1'").run(),/immutable version ledger/);
  assert.throws(()=>db.prepare("UPDATE regulatory_snapshots SET envelope='{}' WHERE sequence=1").run(),/immutable snapshot archive/);
  assert.throws(()=>db.prepare("DELETE FROM regulatory_snapshots WHERE sequence=1").run(),/immutable snapshot archive/);
  assert.throws(()=>db.prepare("UPDATE regulatory_head SET sequence=1 WHERE id=1").run(),/non-monotonic sequence/);
  const digest='2'.repeat(64),envelope=JSON.stringify({payload:{regional:{versions:[]},indiaSalary:{versions:[]},payroll:{versions:[]},national:{effectivePeriods:[],national:{},investment:{},sources:{}}}});
  assert.throws(()=>db.prepare("UPDATE regulatory_head SET sequence=2,digest=?,envelope=?,state='active',review_record=NULL WHERE id=1").run(digest,envelope),/missing or mismatched regulatory review record/);
  assert.throws(()=>activate(db,2,[{version:'v1',rate:999}]),/immutable historical version changed/);
  assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,1);
 }finally{db.close();}
});

test('national ledger migration can be reapplied without rewriting existing definitions',()=>{
 const db=database();
 try{
  activate(db,1,[{version:'v1',rate:100}]);
  assert.doesNotThrow(()=>db.exec(migration('005-regulatory-national-version-ledger.sql')));
  assert.equal(db.prepare('SELECT count(*) AS n FROM regulatory_version_ledger').get().n,1);
  assert.throws(()=>db.prepare("UPDATE regulatory_version_ledger SET definition='changed' WHERE version='v1'").run(),/immutable version ledger/);
 }finally{db.close();}
});
