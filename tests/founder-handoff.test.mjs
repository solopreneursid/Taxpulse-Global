import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyPreviewEvidence,prepareFounderHandoff} from '../scripts/prepare-founder-handoff.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'taxpulse-founder-handoff-'));
 const commit='a'.repeat(40),revision='b'.repeat(64),engineFingerprint='c'.repeat(64);
 const files={'worker.mjs':"import revision from './preview-revision.txt'; import fp from './browser-fingerprint.mjs.txt'; export default {revision,fp};",'preview-revision.txt':revision,'browser-fingerprint.mjs.txt':'export default '+JSON.stringify(engineFingerprint)+';\n'};
 const modules=Object.keys(files).sort().map(name=>{const bytes=Buffer.from(files[name]);writeFileSync(join(dir,name),bytes);return {name,bytes:bytes.length,sha256:sha(bytes)};});
 return {dir,commit,evidence:{schemaVersion:1,commit,revision,engineFingerprint,modules,bundleDigest:sha(JSON.stringify(modules))}};
}
test('founder handoff binds exact preview inventory but cannot authorize production',()=>{
 const f=fixture();
 try{
  assert.equal(verifyPreviewEvidence(f.evidence,f.dir,f.commit).moduleCount,3);
  const registry={summary:{requiredScopes:56,independentlyApprovedScopes:0,productionEnabledScopes:0},registryDigestSha256:'d'.repeat(64)};
  const manifest=JSON.parse(readFileSync(new URL('../rules/manifest.json',import.meta.url),'utf8'));
  const input={evidence:f.evidence,bundleDirectory:f.dir,commit:f.commit,manifest,registry};
  const handoff=prepareFounderHandoff(input);
  assert.equal(handoff.productionAuthorized,false);assert.equal(handoff.signableProductionArtifact,false);
  assert.equal(handoff.preview.commit,f.commit);
  assert.throws(()=>prepareFounderHandoff({...input,manifest:{...manifest,releaseMode:'production'}}));
  assert.throws(()=>verifyPreviewEvidence(f.evidence,f.dir,'e'.repeat(40)));
  const missing=structuredClone(f.evidence);missing.modules=missing.modules.filter(x=>x.name!=='preview-revision.txt');missing.bundleDigest=sha(JSON.stringify(missing.modules));
  assert.throws(()=>verifyPreviewEvidence(missing,f.dir,f.commit),/Unlisted transitive/);
  const malicious=structuredClone(f.evidence);malicious.modules[0].name='../outside';
  assert.throws(()=>verifyPreviewEvidence(malicious,f.dir,f.commit),/Invalid bundle member/);
  writeFileSync(join(f.dir,'worker.mjs'),'tampered');
  assert.throws(()=>verifyPreviewEvidence(f.evidence,f.dir,f.commit),/module mismatch/);
 }finally{rmSync(f.dir,{recursive:true,force:true});}
});
