import test from 'node:test';
import assert from 'node:assert/strict';
import {runScheduledPublication} from '../engine/scheduled-publication.mjs';

function anchorNamespace(initial){
 let value=structuredClone(initial);
 const stub={async fetch(url,init={}){
  const path=new URL(url).pathname;
  if(path==='/state'&&init.method==='GET')return Response.json(value);
  if(path==='/advance'&&init.method==='POST'){
   const input=JSON.parse(init.body);
   if(input.expectedSequence!==value.sequence||input.sequence<=value.sequence)
    return Response.json({error:'sequence_anchor_conflict',state:value},{status:409});
   value={schemaVersion:1,sequence:input.sequence,digest:input.digest,state:input.state};
   return Response.json(value);
  }
  return Response.json({error:'not_found'},{status:404});
 }};
 return {
  idFromName(name){assert.equal(name,'taxpulse-regulatory-head-v1');return 'anchor-id';},
  get(id){assert.equal(id,'anchor-id');return stub;},
  state:()=>structuredClone(value)
 };
}

function database(initial){
 const head=structuredClone(initial);
 return {
  head,
  prepare(sql){
   if(sql.startsWith('SELECT'))return {async first(){return structuredClone(head);}};
   if(sql.includes("SET sequence=?,state='blocked'")){
    return {
     bind(sequence,expected,state){
      return {
       async run(){
        if(head.sequence!==expected||head.state!==state)return {meta:{changes:0}};
        head.sequence=sequence;
        head.state='blocked';
        return {meta:{changes:1}};
       }
      };
     }
    };
   }
   if(sql.includes("SET sequence=?,digest=?,envelope=?,review_record=?,state='active'")){
    return {
     bind(sequence,digest,envelope,reviewRecord,expected){
      return {
       async run(){
        if(head.sequence!==expected)return {meta:{changes:0}};
        Object.assign(head,{sequence,digest,envelope,review_record:reviewRecord,state:'active'});
        return {meta:{changes:1}};
       }
      };
     }
    };
   }
   throw Error('Unexpected SQL in test: '+sql);
  }
 };
}

const digest=n=>String(n).padStart(64,'0');
const secrets={
 RULE_PUBLIC_KEY:'a'.repeat(64),
 RULE_REVIEW_PUBLIC_KEY:'b'.repeat(64),
 RULE_REVIEWER_ID:'test-reviewer'
};
const env=(db,namespace,pending=null)=>({
 ...secrets,
 RULE_DB:db,
 REGULATORY_SEQUENCE_ANCHOR:namespace,
 RULE_INBOX:{
  async get(key,type){
   assert.equal(key,'pending-preview');
   assert.equal(type,'text');
   return pending;
  }
 }
});

test('publisher does not publish when the D1 head and external anchor are both empty',async()=>{
 const db=database({sequence:0,digest:null,envelope:null,state:'empty'});
 const ns=anchorNamespace({schemaVersion:1,sequence:0,digest:null,state:'empty'});
 const result=await runScheduledPublication(env(db,ns),'f'.repeat(64));
 assert.equal(result.state,'no_candidate');
 assert.equal(db.head.sequence,0);
});

test('publisher blocks a restored active D1 head before accepting a new sequence',async()=>{
 const db=database({sequence:1,digest:digest(1),envelope:'{}',state:'active'});
 const ns=anchorNamespace({schemaVersion:1,sequence:2,digest:digest(2),state:'active'});
 const result=await runScheduledPublication(env(db,ns),'f'.repeat(64));
 assert.equal(result.state,'rollback_detected');
 assert.equal(result.databaseSequence,1);
 assert.equal(result.externalSequenceFloor,2);
 assert.equal(result.blockedSequence,3);
 assert.equal(db.head.sequence,3);
 assert.equal(db.head.state,'blocked');
 assert.deepEqual(ns.state(),{schemaVersion:1,sequence:3,digest:null,state:'blocked'});
});

test('publisher fails closed when the D1 head digest differs at the same sequence',async()=>{
 const db=database({sequence:2,digest:digest(2),envelope:'{}',state:'active'});
 const ns=anchorNamespace({schemaVersion:1,sequence:2,digest:digest(3),state:'active'});
 await assert.rejects(runScheduledPublication(env(db,ns),'f'.repeat(64)),/digest does not match/);
});

test('publisher fails closed when the external anchor is behind D1',async()=>{
 const db=database({sequence:3,digest:digest(3),envelope:'{}',state:'active'});
 const ns=anchorNamespace({schemaVersion:1,sequence:2,digest:digest(2),state:'active'});
 await assert.rejects(runScheduledPublication(env(db,ns),'f'.repeat(64)),/exceeds external sequence anchor/);
});

test('publisher requires a new signed candidate above a blocked external floor',async()=>{
 const db=database({sequence:3,digest:null,envelope:null,state:'blocked'});
 const ns=anchorNamespace({schemaVersion:1,sequence:3,digest:null,state:'blocked'});
 const result=await runScheduledPublication(env(db,ns),'f'.repeat(64));
 assert.equal(result.state,'sequence_floor_recovery_required');
});

test('publisher rejects missing Durable Object binding',async()=>{
 const db=database({sequence:0,digest:null,envelope:null,state:'empty'});
 await assert.rejects(runScheduledPublication({...env(db,null),REGULATORY_SEQUENCE_ANCHOR:null},'f'.repeat(64)),/Incomplete publisher configuration/);
});
