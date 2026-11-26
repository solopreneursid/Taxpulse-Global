import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {releaseApprovalBytes,releaseManifestDigest,verifyProductionAuthorization} from '../engine/release-authorization.mjs';
const key=()=>{const {privateKey,publicKey}=generateKeyPairSync('ed25519');return {privateKey,raw:Buffer.from(publicKey.export({format:'jwk'}).x,'base64url').toString('hex')};};
const founder=key(),reviewer=key(),stranger=key();
const manifest={schemaVersion:1,releaseMode:'production',countries:{}};
const context={commit:'a'.repeat(40),artifactSha256:'b'.repeat(64),founderPublicKeyHex:founder.raw,reviewerPublicKeyHex:reviewer.raw,now:new Date('2026-11-26T12:00:00.000Z')};
const payload={schemaVersion:1,purpose:'taxpulse-production-release',commit:context.commit,artifactSha256:context.artifactSha256,manifestSha256:releaseManifestDigest(manifest),issuedAt:'2026-11-26T00:00:00.000Z',expiresAt:'2026-11-27T00:00:00.000Z'};
const signed=(p=payload)=>({payload:p,founderSignature:sign(null,releaseApprovalBytes(p),founder.privateKey).toString('hex'),reviewerSignature:sign(null,releaseApprovalBytes(p),reviewer.privateKey).toString('hex')});
test('synthetic approvals bind exact commit, manifest and artifact with separate keys',()=>{
 const a=signed();assert.equal(verifyProductionAuthorization(manifest,a,context),true);
 for(const c of [{...context,commit:'c'.repeat(40)},{...context,artifactSha256:'c'.repeat(64)},{...context,founderPublicKeyHex:reviewer.raw},{...context,reviewerPublicKeyHex:stranger.raw},{...context,now:new Date(payload.expiresAt)},{...context,now:new Date('2026-11-25T00:00:00.000Z')}])assert.throws(()=>verifyProductionAuthorization(manifest,a,c));
 assert.throws(()=>verifyProductionAuthorization({...manifest,countries:{US:{}}},a,context),/subject mismatch/);
 assert.throws(()=>verifyProductionAuthorization(manifest,{...a,reviewerSignature:a.founderSignature},context),/signature/);
 assert.throws(()=>verifyProductionAuthorization(manifest,undefined,context));
 assert.throws(()=>verifyProductionAuthorization(manifest,a,{}));
 assert.throws(()=>verifyProductionAuthorization(manifest,signed({...payload,expiresAt:'2026-12-04T00:00:00.000Z'}),context),/expired/);
});
