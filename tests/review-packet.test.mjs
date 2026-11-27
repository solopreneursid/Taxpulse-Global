import test from 'node:test';import assert from 'node:assert/strict';import {prepareReviewPacket} from '../scripts/prepare-review-packet.mjs';
test('review packet inventories all 56 scopes without manufacturing approvals',()=>{
 const p=prepareReviewPacket();assert.equal(p.releaseMode,'preview');assert.equal(p.reviewStatus,'pending');assert.equal(p.scopes.length,56);
 assert.equal(new Set(p.scopes.map(x=>x.country+'/'+x.module)).size,56);
 assert.ok(p.scopes.every(x=>!x.productionEnabled&&!x.manifestVerified&&x.recordedEvidenceCount===0));
 assert.ok(p.inventory.length>40);assert.ok(p.inventory.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));const paths=new Set(p.inventory.map(x=>x.path));assert.ok(paths.has('REGULATORY-UPDATE-PIPELINE.md'));assert.ok(paths.has('REGULATORY-COLLECTOR-ENROLLMENT.md'));
 assert.match(p.releaseGate,/not authorized/);assert.match(p.commit,/^[a-f0-9]{40}$/);
});

test('review inventory distinguishes scoped preview components from missing modules and never grants approval',()=>{const p=prepareReviewPacket();assert.equal(p.scopes.filter(s=>s.scopedPreviewStatus==='scoped-example').length,56);assert.equal(p.scopes.filter(s=>s.scopedPreviewStatus==='not-implemented').length,0);assert.ok(p.scopes.every(s=>s.remainingEngineering.length>0&&s.independentReview==='not established by this packet'));});

test('inventory explicitly separates analogous components and leaves all approvals pending',()=>{const p=prepareReviewPacket();assert.deepEqual(p.scopes.filter(x=>x.coverageKind==='analogous-component').map(x=>x.country+'/'+x.module).sort(),['AE/property','US/vat']);assert.equal(p.scopes.filter(x=>x.coverageKind==='tax-component').length,54);assert.ok(p.scopes.every(x=>!x.productionEnabled&&!x.manifestVerified&&x.recordedEvidenceCount===0));});
