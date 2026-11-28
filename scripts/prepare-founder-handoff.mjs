import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {assertProductionReady} from '../engine/release-gate.mjs';
import {releaseManifestDigest} from '../engine/release-authorization.mjs';
import {buildStatutoryEvidenceRegistry} from './build-statutory-evidence-registry.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=(v,n)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const file=(dir,name)=>{
 if(typeof name!=='string'||! /^[A-Za-z0-9_.-]+$/.test(name)||name==='.'||name==='..'||basename(name)!==name)throw Error('Invalid bundle member');
 const path=resolve(dir,name);
 if(!lstatSync(path).isFile())throw Error('Bundle member must be a regular file');
 return readFileSync(path);
};
export function verifyPreviewEvidence(evidence,bundleDirectory,commit){
 if(!hex(commit,40)||evidence?.schemaVersion!==1||evidence.commit!==commit||
    !hex(evidence.revision,64)||!hex(evidence.engineFingerprint,64)||!hex(evidence.bundleDigest,64)||
    !Array.isArray(evidence.modules)||evidence.modules.length<1||evidence.modules.length>500)throw Error('Invalid preview evidence or commit');
 const seen=new Set();
 for(const row of evidence.modules){
  if(!row||seen.has(row.name)||!Number.isSafeInteger(row.bytes)||row.bytes<0||!hex(row.sha256,64))throw Error('Invalid or duplicate module');
  seen.add(row.name);
  const bytes=file(bundleDirectory,row.name);
  if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('Preview module mismatch: '+row.name);
 }
 // Independently enumerate the static import closure; a partial inventory cannot pass.
 const required=new Set(),pending=['worker.mjs'];
 while(pending.length){
  const name=pending.pop();if(required.has(name))continue;
  if(!seen.has(name))throw Error('Unlisted transitive preview module: '+name);
  required.add(name);
  if(name.endsWith('.mjs'))for(const match of file(bundleDirectory,name).toString('utf8').matchAll(/(?:\bfrom\s*|\bimport\s*)['"]\.\/([^'"]+)['"]/g))pending.push(match[1]);
 }
 if(required.size!==seen.size||sha(JSON.stringify(evidence.modules))!==evidence.bundleDigest)throw Error('Preview module inventory digest mismatch');
 if(file(bundleDirectory,'preview-revision.txt').toString('utf8').trim()!==evidence.revision)throw Error('Preview revision mismatch');
 const fingerprint=JSON.parse(file(bundleDirectory,'browser-fingerprint.mjs.txt').toString('utf8').replace(/^export default /,'').trim().replace(/;$/,''));
 if(fingerprint!==evidence.engineFingerprint)throw Error('Preview fingerprint mismatch');
 return {commit,revision:evidence.revision,engineFingerprint:evidence.engineFingerprint,moduleCount:seen.size,bundleDigest:evidence.bundleDigest};
}
export function prepareFounderHandoff({evidence,bundleDirectory,commit,manifest,registry}){
 if(manifest?.releaseMode!=='preview'||manifest.schemaVersion!==1)throw Error('This handoff only supports the blocked preview manifest');
 const verified=verifyPreviewEvidence(evidence,bundleDirectory,commit);
 if(registry?.summary?.requiredScopes!==56||registry.summary.independentlyApprovedScopes!==0||registry.summary.productionEnabledScopes!==0||!hex(registry.registryDigestSha256,64))throw Error('Unexpected statutory evidence state');
 let gate;try{assertProductionReady(manifest);}catch(error){gate=String(error.message);}
 if(!gate)throw Error('Preview must remain blocked');
 return {schemaVersion:1,purpose:'taxpulse-preview-founder-handoff',productionAuthorized:false,signableProductionArtifact:false,
 preview:verified,previewManifestDigest:releaseManifestDigest(manifest),statutoryEvidenceRegistryDigest:registry.registryDigestSha256,
 releaseGate:gate,requiredScopes:56,independentlyApprovedScopes:0,
 remaining:['Complete statutory calculation scope and independent review','Resolve single authoritative sequence-anchor deployment and verify hosted RPC','Independent security assessment and physical device acceptance','Build exact authorized production artifact from clean commit','Enroll distinct trusted founder and reviewer public keys','Prepare, sign and assemble artifact-bound approval offline'],
 signingTool:'scripts/release-approval.mjs',limitations:['This is a verified local preview inventory, not hosted parity or a production signing payload.','No private key, signature, production manifest or production artifact is created.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==4)throw Error('Usage: node scripts/prepare-founder-handoff.mjs PREVIEW_BUILD_EVIDENCE.json OUTPUT.json');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8'}).trim())throw Error('Dirty tracked checkout');
 const handoff=prepareFounderHandoff({evidence:JSON.parse(readFileSync(process.argv[2],'utf8')),bundleDirectory:resolve(root,'staging/integrated/bundle'),commit,manifest:JSON.parse(readFileSync(resolve(root,'rules/manifest.json'),'utf8')),registry:buildStatutoryEvidenceRegistry()});
 writeFileSync(process.argv[3],JSON.stringify(handoff,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('Blocked preview handoff prepared; no production signing authority granted.');
}
