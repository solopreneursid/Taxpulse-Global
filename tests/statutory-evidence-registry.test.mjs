import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildStatutoryEvidenceRegistry,writeStatutoryEvidenceRegistry} from '../scripts/build-statutory-evidence-registry.mjs';

const registry=writeStatutoryEvidenceRegistry();
const onDisk=JSON.parse(readFileSync(new URL('../rules/statutory-evidence-registry.json',import.meta.url),'utf8'));
const rebuilt=buildStatutoryEvidenceRegistry();

test('statutory evidence registry enumerates all 56 jurisdiction-module scopes',()=>{
 assert.equal(registry.summary.requiredScopes,56);
 assert.equal(registry.summary.jurisdictions,8);
 assert.equal(registry.summary.modules,7);
 assert.equal(registry.entries.length,56);
 assert.equal(new Set(registry.entries.map(entry=>entry.scopeId)).size,56);
});

test('generated registry is reproducible and matches its on-disk artifact',()=>{
 assert.deepEqual(registry,rebuilt);
 assert.deepEqual(onDisk,registry);
});

test('every scope records gaps and explicit source and test evidence states',()=>{
 for(const entry of registry.entries){
  assert.ok(entry.knownGaps.length>0,entry.scopeId);
  assert.ok(['recorded-source-urls','no-source-urls-recorded'].includes(entry.sourceStatus),entry.scopeId);
  assert.ok(['module-test-file-references-only','no-test-file-reference-recorded'].includes(entry.testStatus),entry.scopeId);
  assert.ok(Array.isArray(entry.sourceReferences),entry.scopeId);
  assert.ok(Array.isArray(entry.testFiles),entry.scopeId);
  assert.ok(Array.isArray(entry.implementationFiles),entry.scopeId);
 }
});

test('no scope is falsely marked independently approved or production enabled',()=>{
 assert.equal(registry.summary.independentlyApprovedScopes,0);
 assert.equal(registry.summary.productionEnabledScopes,0);
 for(const entry of registry.entries){
  assert.equal(entry.independentApprovalStatus,'not-established',entry.scopeId);
  assert.equal(entry.productionEnabled,false,entry.scopeId);
  assert.match(entry.releaseStatus,/blocked/);
 }
});

test('registry digest and local metadata hashes are valid',()=>{
 const {registryDigestSha256,...payload}=registry;
 const digest=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 assert.equal(registryDigestSha256,digest);
 for(const entry of registry.entries){
  for(const source of entry.sourceMetadataFiles){
   const bytes=readFileSync(new URL('../'+source.path,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),source.localMetadataSha256,entry.scopeId+':'+source.path);
  }
 }
});
