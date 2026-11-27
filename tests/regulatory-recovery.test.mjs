import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {assertRecoverySequenceFloor} from '../engine/rule-publisher.mjs';
const migration=n=>readFileSync(new URL('../migrations/'+n,import.meta.url),'utf8');
function setup(db){db.exec(migration('001-regulatory-snapshots.sql'));db.exec(migration('002-regulatory-version-ledger.sql'));}
function activate(db,sequence,versions){const envelope=JSON.stringify({payload:{regional:{versions},indiaSalary:{versions:[]},payroll:{versions:[]}}});db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,state='active' WHERE id=1").run(sequence,String(sequence).padStart(64,'0'),envelope);}
test('historical version cannot be reused after disappearing from active snapshot',()=>{const db=new DatabaseSync(':memory:');try{setup(db);activate(db,1,[{version:'v1',rate:100}]);activate(db,2,[{version:'v2',rate:200}]);assert.throws(()=>activate(db,3,[{version:'v1',rate:999}]),/immutable historical version changed/);assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,2);assert.equal(db.prepare('SELECT count(*) n FROM regulatory_events').get().n,2);activate(db,3,[{version:'v1',rate:100}]);assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,2);assert.throws(()=>db.exec("DELETE FROM regulatory_version_ledger"),/immutable version ledger/);assert.throws(()=>db.exec("UPDATE regulatory_snapshots SET digest='bad'"),/immutable snapshot archive/);}finally{db.close();}});
test('database backup restore preserves audit history and rejects replay',()=>{const dir=mkdtempSync(join(tmpdir(),'taxpulse-recovery-'));let source,restore;try{source=new DatabaseSync(join(dir,'source.db'));setup(source);activate(source,1,[{version:'v1',rate:100}]);activate(source,2,[{version:'v2',rate:200}]);source.exec("VACUUM INTO '"+join(dir,'restore.db').replaceAll("'","''")+"'");restore=new DatabaseSync(join(dir,'restore.db'));assert.equal(Object.values(restore.prepare('PRAGMA integrity_check').get())[0],'ok');assert.deepEqual(restore.prepare('SELECT * FROM regulatory_head').get(),source.prepare('SELECT * FROM regulatory_head').get());assert.deepEqual(restore.prepare('SELECT * FROM regulatory_version_ledger ORDER BY version').all(),source.prepare('SELECT * FROM regulatory_version_ledger ORDER BY version').all());assert.throws(()=>activate(restore,3,[{version:'v1',rate:200}]),/immutable historical version changed/);assert.throws(()=>activate(restore,2,[{version:'v3',rate:300}]),/non-monotonic sequence/);}finally{restore?.close();source?.close();rmSync(dir,{recursive:true,force:true});}});

test('D1-compatible ledger migration backfills existing consistent archives and is idempotent',()=>{const db=new DatabaseSync(':memory:');try{db.exec(migration('001-regulatory-snapshots.sql'));activate(db,1,[{version:'v1',rate:100}]);activate(db,2,[{version:'v1',rate:100},{version:'v2',rate:200}]);db.exec(migration('002-regulatory-version-ledger.sql'));db.exec(migration('002-regulatory-version-ledger.sql'));assert.deepEqual(db.prepare('SELECT version,first_sequence FROM regulatory_version_ledger ORDER BY version').all().map(r=>[r.version,r.first_sequence]),[['v1',1],['v2',2]]);assert.throws(()=>activate(db,3,[{version:'v1',rate:999}]),/immutable historical version changed/);}finally{db.close();}});
test('conflicting existing archive fails migration without accepting an arbitrary version',()=>{const db=new DatabaseSync(':memory:');try{db.exec(migration('001-regulatory-snapshots.sql'));activate(db,1,[{version:'v1',rate:100}]);activate(db,2,[{version:'v1',rate:200}]);assert.throws(()=>db.exec(migration('002-regulatory-version-ledger.sql')),/immutable version ledger/);assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,0);}finally{db.close();}});

test('all five migrations survive isolated backup and restore with review archive and blocked head',()=>{
 const dir=mkdtempSync(join(tmpdir(),'taxpulse-reviewed-recovery-'));let source,restored;
 try{
  source=new DatabaseSync(join(dir,'original.db'));source.exec('PRAGMA foreign_keys=ON');
  setup(source);source.exec(migration('003-regulatory-unique-versions.sql'));source.exec(migration('004-regulatory-review-archive.sql'));source.exec(migration('005-regulatory-national-version-ledger.sql'));
  // Synthetic structural fixtures only, not cryptographically valid statutory approvals.
  const publish=(db,sequence,versions,reviewSequence=sequence)=>{
   const digest=String(sequence).padStart(64,'0');
   const envelope=JSON.stringify({payload:{regional:{versions},indiaSalary:{versions:[]},payroll:{versions:[]}}});
   const review=JSON.stringify({publisherPublicKeyHex:'a'.repeat(64),reviewerPublicKeyHex:'b'.repeat(64),review:{payload:{snapshotDigest:digest,sequence:reviewSequence},signature:'c'.repeat(128)}});
   return db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,state='active',review_record=? WHERE id=1").run(sequence,digest,envelope,review);
  };
  publish(source,1,[{version:'v1',rate:100}]);publish(source,2,[{version:'v2',rate:200}]);
  source.exec("UPDATE regulatory_head SET sequence=3,state='blocked',digest=NULL,envelope=NULL,review_record=NULL WHERE id=1");
  const backup=join(dir,'backup.db');source.exec("VACUUM INTO '"+backup.replaceAll("'","''")+"'");
  restored=new DatabaseSync(backup);restored.exec('PRAGMA foreign_keys=ON');
  assert.equal(Object.values(restored.prepare('PRAGMA integrity_check').get())[0],'ok');assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);
  for(const table of ['regulatory_head','regulatory_snapshots','regulatory_events','regulatory_version_ledger'])assert.deepEqual(restored.prepare('SELECT * FROM '+table+' ORDER BY 1').all(),source.prepare('SELECT * FROM '+table+' ORDER BY 1').all());
  assert.equal(restored.prepare('SELECT state FROM regulatory_head').get().state,'blocked');
  assert.throws(()=>publish(restored,2,[{version:'v3',rate:300}]),/non-monotonic sequence/);
  assert.throws(()=>publish(restored,4,[{version:'v1',rate:999}]),/immutable historical version changed/);
  assert.throws(()=>publish(restored,4,[{version:'v3',rate:300},{version:'v3',rate:300}]),/duplicate or missing snapshot version/);
  assert.throws(()=>publish(restored,4,[{version:'v3',rate:300}],3),/missing or mismatched regulatory review record/);
  assert.throws(()=>restored.exec("UPDATE regulatory_snapshots SET review_record=NULL"),/immutable snapshot archive/);
  assert.equal(restored.prepare('SELECT sequence FROM regulatory_head').get().sequence,3);
  publish(restored,4,[{version:'v3',rate:300}]);assert.equal(restored.prepare('SELECT sequence FROM regulatory_head').get().sequence,4);
  assert.equal(source.prepare('SELECT sequence FROM regulatory_head').get().sequence,3);
 }finally{restored?.close();source?.close();rmSync(dir,{recursive:true,force:true});}
});

test('external durable sequence floor rejects replay after D1 restore rollback',()=>{
 const head={sequence:1,state:'active'};
 const anchor={schemaVersion:1,sequence:2,digest:'a'.repeat(64),state:'active'};
 assert.throws(()=>assertRecoverySequenceFloor(head,anchor,2),/exceed the D1 head and external recovery floor/);
 const fresh=assertRecoverySequenceFloor(head,anchor,3);
 assert.equal(fresh.minimumSequence,2);assert.equal(fresh.recoveryRequired,true);
});
test('publisher fails closed if the external anchor is behind D1',()=>{
 assert.throws(()=>assertRecoverySequenceFloor(
  {sequence:3,state:'active'},
  {schemaVersion:1,sequence:2,digest:'b'.repeat(64),state:'active'},
  4
 ),/anchor is behind D1/);
});
test('blocked external anchor requires a fresh sequence above the block floor',()=>{
 const head={sequence:4,state:'blocked'};
 const anchor={schemaVersion:1,sequence:4,digest:null,state:'blocked'};
 assert.throws(()=>assertRecoverySequenceFloor(head,anchor,4),/exceed the D1 head and external recovery floor/);
 const next=assertRecoverySequenceFloor(head,anchor,5);
 assert.equal(next.minimumSequence,4);assert.equal(next.recoveryRequired,true);
});
test('normal publication still requires strictly increasing D1 and external sequences',()=>{
 const head={sequence:7,state:'active'};
 const anchor={schemaVersion:1,sequence:7,digest:'c'.repeat(64),state:'active'};
 assert.throws(()=>assertRecoverySequenceFloor(head,anchor,7),/exceed the D1 head and external recovery floor/);
 const next=assertRecoverySequenceFloor(head,anchor,8);
 assert.equal(next.minimumSequence,7);assert.equal(next.recoveryRequired,false);
});
test('empty anchor accepts only a sequence above the empty D1 head',()=>{
 const head={sequence:0,state:'empty'};
 const anchor={schemaVersion:1,sequence:0,digest:null,state:'empty'};
 assert.throws(()=>assertRecoverySequenceFloor(head,anchor,0),/exceed the D1 head and external recovery floor/);
 assert.deepEqual(assertRecoverySequenceFloor(head,anchor,1),{minimumSequence:0,recoveryRequired:false});
});
