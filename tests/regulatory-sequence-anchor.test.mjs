import test from 'node:test';
import assert from 'node:assert/strict';
import {RegulatorySequenceAnchor,createRegulatorySequenceAnchor} from '../engine/regulatory-sequence-anchor.mjs';

class MemoryStorage{
 constructor(){this.values=new Map();}
 async get(key){return this.values.get(key);}
 async put(key,value){this.values.set(key,structuredClone(value));}
}
class MemoryState{
 constructor(){this.storage=new MemoryStorage();}
 async blockConcurrencyWhile(fn){return fn();}
}
const request=(path,method='GET',body)=>new Request('https://anchor.test'+path,{method,headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
const digest=n=>String(n).padStart(64,'0');

test('Durable Object sequence anchor initializes empty and advances monotonically',async()=>{
 const state=new MemoryState(),anchor=new RegulatorySequenceAnchor(state,{});
 let response=await anchor.fetch(request('/state'));
 assert.deepEqual(await response.json(),{schemaVersion:1,sequence:0,digest:null,state:'empty'});
 response=await anchor.fetch(request('/advance','POST',{sequence:1,digest:digest(1),expectedSequence:0,state:'active'}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{schemaVersion:1,sequence:1,digest:digest(1),state:'active'});
 response=await anchor.fetch(request('/advance','POST',{sequence:2,digest:null,expectedSequence:1,state:'blocked'}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{schemaVersion:1,sequence:2,digest:null,state:'blocked'});
 response=await anchor.fetch(request('/advance','POST',{sequence:3,digest:digest(3),expectedSequence:2,state:'active'}));
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{schemaVersion:1,sequence:3,digest:digest(3),state:'active'});
});

test('Durable Object anchor rejects stale, conflicting, malformed and concurrent advances',async()=>{
 const anchor=new RegulatorySequenceAnchor(new MemoryState(),{});
 let response=await anchor.fetch(request('/advance','POST',{sequence:1,digest:digest(1),expectedSequence:0,state:'active'}));
 assert.equal(response.status,200);
 response=await anchor.fetch(request('/advance','POST',{sequence:1,digest:digest(1),expectedSequence:0,state:'active'}));
 assert.equal(response.status,409);
 response=await anchor.fetch(request('/advance','POST',{sequence:2,digest:digest(2),expectedSequence:0,state:'active'}));
 assert.equal(response.status,409);
 response=await anchor.fetch(request('/advance','POST',{sequence:2,digest:'bad',expectedSequence:1,state:'active'}));
 assert.equal(response.status,400);
 response=await anchor.fetch(request('/advance','POST',{sequence:2,digest:digest(2),expectedSequence:1,state:'unknown'}));
 assert.equal(response.status,400);
 response=await anchor.fetch(request('/state','POST'));
 assert.equal(response.status,405);
});

test('binding client uses one named Durable Object and fails closed on non-2xx',async()=>{
 const calls=[];
 const stub={async fetch(url,init){calls.push({url,init});if(new URL(url).pathname==='/state')return Response.json({schemaVersion:1,sequence:4,digest:digest(4),state:'active'});return Response.json({schemaVersion:1,sequence:5,digest:digest(5),state:'active'});}};
 const namespace={idFromName(name){assert.equal(name,'taxpulse-regulatory-head-v1');return 'id';},get(id){assert.equal(id,'id');return stub;}};
 const client=createRegulatorySequenceAnchor(namespace);
 assert.equal((await client.getState()).sequence,4);
 assert.equal((await client.advance({sequence:5,digest:digest(5),expectedSequence:4,state:'active'})).sequence,5);
 assert.equal(calls.length,2);
 assert.throws(()=>createRegulatorySequenceAnchor(null),/binding required/);
});

test('KV sequence-floor mirror is best-effort and never authoritative',async()=>{
 const state=new MemoryState();let mirrored=null;
 const anchor=new RegulatorySequenceAnchor(state,{RULE_SEQUENCE_FLOOR:{async put(key,value){mirrored={key,value};}}});
 const response=await anchor.fetch(request('/advance','POST',{sequence:1,digest:digest(1),expectedSequence:0,state:'active'}));
 assert.equal(response.status,200);
 assert.deepEqual(mirrored,{key:'taxpulse:regulatory-sequence-floor',value:'1'});
 const failing=new RegulatorySequenceAnchor(new MemoryState(),{RULE_SEQUENCE_FLOOR:{async put(){throw Error('KV unavailable');}}});
 const second=await failing.fetch(request('/advance','POST',{sequence:1,digest:digest(1),expectedSequence:0,state:'active'}));
 assert.equal(second.status,200);
 assert.equal((await failing.fetch(request('/state'))).status,200);
});
