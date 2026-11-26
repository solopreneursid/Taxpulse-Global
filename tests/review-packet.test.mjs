import test from 'node:test';import assert from 'node:assert/strict';import {prepareReviewPacket} from '../scripts/prepare-review-packet.mjs';
test('review packet inventories all 56 scopes without manufacturing approvals',()=>{
 const p=prepareReviewPacket();assert.equal(p.releaseMode,'preview');assert.equal(p.reviewStatus,'pending');assert.equal(p.scopes.length,56);
 assert.equal(new Set(p.scopes.map(x=>x.country+'/'+x.module)).size,56);
 assert.ok(p.scopes.every(x=>!x.productionEnabled&&!x.manifestVerified&&x.recordedEvidenceCount===0));
 assert.ok(p.inventory.length>40);assert.ok(p.inventory.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
 assert.match(p.releaseGate,/not authorized/);assert.match(p.commit,/^[a-f0-9]{40}$/);
});
