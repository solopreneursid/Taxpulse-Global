import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRegulatorySummary} from '../engine/regulatory-dashboard.mjs';
const now=new Date('2026-11-27T05:00:00Z'),config=[{id:'one',jurisdiction:'IN',topics:['pit'],url:'https://www.incometax.gov.in/'},{id:'two',jurisdiction:'GB',topics:['pit'],url:'https://www.gov.uk/income-tax-rates'}];
const row=(s,status='baseline')=>({...s,status,checkedAt:now.toISOString(),sha256:'a'.repeat(64)});
const report=sources=>({mode:'review_only',automaticRuleChanges:false,checkedAt:now.toISOString(),sources});
const proof={kind:'collector-ed25519',reportDigest:'b'.repeat(64)};
const env=(edge,independent)=>({REGULATORY_STATE:{get:async key=>key==='latest'?edge:independent}});
test('dashboard combines fresh independently delivered observations without approving them',async()=>{
 const edge=report([row(config[0]),row(config[1],'fetch_failed')]),independent={...report([row(config[0],'fetch_failed'),row(config[1])]),collectorProof:proof};
 const r=await loadRegulatorySummary(config,env(edge,independent),now);
 assert.equal(r.reconciliation.reachable,2);assert.equal(r.sources[1].reconciliationStatus,'independent_only');assert.equal(r.taxRulesVerified,false);assert.equal(r.reconciliation.automaticRuleChanges,false);
 const unsigned=await loadRegulatorySummary(config,env(edge,{...independent,collectorProof:null}),now);assert.equal(unsigned.reconciliation.reachable,1);
 const stale=await loadRegulatorySummary(config,env(edge,{...independent,checkedAt:'2026-11-24T00:00:00Z'}),now);assert.equal(stale.reconciliation.reachable,1);
 const malformed=await loadRegulatorySummary(config,env(edge,{...independent,automaticRuleChanges:true}),now);assert.equal(malformed.reconciliation,null);
});

test('malformed edge state fails safely and does not hide valid independent observations',async()=>{
 const independent={...report([row(config[0]),row(config[1])]),collectorProof:proof};
 const r=await loadRegulatorySummary(config,env({mode:'review_only',automaticRuleChanges:false,checkedAt:now.toISOString(),sources:{}},independent),now);
 assert.equal(r.stale,true);assert.equal(r.reconciliation.reachable,2);assert.ok(r.sources.every(s=>s.status==='not_checked'&&s.reconciliationStatus==='independent_only'));
 const absent=await loadRegulatorySummary(config,{REGULATORY_STATE:{get:async()=>{throw Error('KV unavailable');}}},now);assert.equal(absent.reconciliation.reachable,0);assert.equal(absent.taxRulesVerified,false);
});
