import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {
 initializeSequenceAnchor,
 readSequenceAnchor,
 advanceSequenceAnchor,
 mirrorSequenceFloor,
 createRegulatorySequenceAnchor,
 SEQUENCE_FLOOR_MIRROR_KEY
} from '../engine/regulatory-sequence-anchor.mjs';

function sqlAdapter(db){
 return {
  exec(sql,...params){
   const statement=db.prepare(sql);
   if(/^\s*(?:CREATE|INSERT|DELETE|REPLACE|ALTER|DROP)\b/i.test(sql)||(/^\s*UPDATE\b/i.test(sql)&&!/\bRETURNING\b/i.test(sql))){
    statement.run(...params);
    return {toArray:()=>[],one(){throw Error('No row returned');}};
   }
   const rows=statement.all(...params);
   return {
    toArray:()=>rows,
    one(){
     if(rows.length!==1)throw Error('Expected exactly one row, got '+rows.length);
     return rows[0];
    }
   };
  }
 };
}
const digest=n=>n.toString(16).padStart(64,'0');

test('SQLite sequence anchor initializes with a canonical empty state',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const sql=sqlAdapter(db);
  assert.deepEqual(initializeSequenceAnchor(sql),{schemaVersion:1,sequence:0,digest:null,state:'empty'});
  assert.deepEqual(readSequenceAnchor(sql),{schemaVersion:1,sequence:0,digest:null,state:'empty'});
 }finally{db.close();}
});

test('sequence anchor advances monotonically with an atomic compare-and-set',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const sql=sqlAdapter(db);initializeSequenceAnchor(sql);
  const first=advanceSequenceAnchor(sql,{sequence:1,digest:digest(1),expectedSequence:0,state:'active'});
  assert.equal(first.conflict,false);
  assert.deepEqual(first.state,{schemaVersion:1,sequence:1,digest:digest(1),state:'active'});
  const stale=advanceSequenceAnchor(sql,{sequence:2,digest:digest(2),expectedSequence:0,state:'active'});
  assert.equal(stale.conflict,true);
  assert.deepEqual(stale.state,first.state);
  const blocked=advanceSequenceAnchor(sql,{sequence:2,digest:null,expectedSequence:1,state:'blocked'});
  assert.equal(blocked.conflict,false);
  assert.deepEqual(blocked.state,{schemaVersion:1,sequence:2,digest:null,state:'blocked'});
 }finally{db.close();}
});

test('sequence anchor rejects invalid digests, invalid states and non-monotonic advances',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const sql=sqlAdapter(db);initializeSequenceAnchor(sql);
  assert.throws(()=>advanceSequenceAnchor(sql,{sequence:1,digest:'not-a-digest',expectedSequence:0,state:'active'}),/Invalid external sequence advance/);
  assert.throws(()=>advanceSequenceAnchor(sql,{sequence:1,digest:null,expectedSequence:0,state:'active'}),/Invalid external sequence advance/);
  assert.throws(()=>advanceSequenceAnchor(sql,{sequence:0,digest:null,expectedSequence:0,state:'blocked'}),/Invalid external sequence advance/);
  assert.throws(()=>advanceSequenceAnchor(sql,{sequence:1,digest:null,expectedSequence:0,state:'unknown'}),/Invalid external sequence advance/);
 }finally{db.close();}
});

test('KV mirror is best-effort and cannot override the SQLite anchor',async()=>{
 let mirrored=null;
 const kv={async put(key,value){mirrored={key,value};}};
 assert.equal(await mirrorSequenceFloor(kv,7),true);
 assert.deepEqual(mirrored,{key:SEQUENCE_FLOOR_MIRROR_KEY,value:'7'});
 assert.equal(await mirrorSequenceFloor({async put(){throw Error('KV unavailable');}},8),false);
 assert.equal(await mirrorSequenceFloor(null,9),false);
});

test('RPC client uses Durable Object methods and validates returned state',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
  const sql=sqlAdapter(db);initializeSequenceAnchor(sql);
  const stub={
   getState:()=>readSequenceAnchor(sql),
   advance(input){
    const result=advanceSequenceAnchor(sql,input);
    if(result.conflict)throw Error('sequence_anchor_conflict');
    return result.state;
   }
  };
  const namespace={idFromName(name){assert.equal(name,'taxpulse-regulatory-head-v1');return 'anchor-id';},get(id){assert.equal(id,'anchor-id');return stub;}};
  const client=createRegulatorySequenceAnchor(namespace);
  assert.deepEqual(await client.getState(),{schemaVersion:1,sequence:0,digest:null,state:'empty'});
  assert.deepEqual(await client.advance({sequence:1,digest:digest(1),expectedSequence:0,state:'active'}),{schemaVersion:1,sequence:1,digest:digest(1),state:'active'});
  await assert.rejects(client.advance({sequence:2,digest:digest(2),expectedSequence:0,state:'active'}),/sequence_anchor_conflict/);
 }finally{db.close();}
});
