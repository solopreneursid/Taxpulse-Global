import test from 'node:test';
import assert from 'node:assert/strict';
import {productionReadinessReport} from '../scripts/production-readiness-report.mjs';
test('readiness report distinguishes all 56 preview entries from three legacy API catalog entries and no approvals',()=>{
 const p=productionReadinessReport();
 assert.equal(p.requiredScopes,56);assert.equal(p.scopedPreviewExamples,56);assert.equal(p.analogousComponents,2);assert.equal(p.legacyBackendCatalogScopes,3);
 assert.equal(p.missingBackendCountries.length,5);assert.equal(p.missingBackendModules.length,6);assert.equal(p.productionAuthorized,false);assert.match(p.gate,/blocked/);
 assert.ok(p.countries.every(c=>c.scopedPreviewExamples===7&&!c.manifestVerified&&!c.productionEnabled&&c.recordedEvidenceCount===0&&c.remaining.length===7));
 assert.equal(p.countries.find(c=>c.country==='IN').missingBackendModules.length,6);
 assert.equal(p.countries.find(c=>c.country==='CA').missingBackendModules.length,7);
 assert.equal(p.previewInfrastructure.d1Migration005.database,'taxpulse-regulatory-preview');
 assert.equal(p.previewInfrastructure.d1Migration005.applied,true);
 assert.equal(p.previewInfrastructure.d1Migration005.head.sequence,0);
 assert.deepEqual(p.previewInfrastructure.d1Migration005.publisherSchedules,[]);
 assert.equal(p.previewInfrastructure.d1Migration005.previewCalculatorD1Binding,false);
 assert.equal(p.previewInfrastructure.d1Migration005.verifiedTriggers.length,3);
});
