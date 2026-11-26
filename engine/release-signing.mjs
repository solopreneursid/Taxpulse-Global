import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { releaseApprovalBytes, releaseManifestDigest, verifyProductionAuthorization } from './release-authorization.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const roles = new Set(['founder', 'reviewer']);
const isHex = (s, n) => typeof s === 'string' && s.length === n && /^[0-9a-f]+$/.test(s);

function subject(manifest, artifact, commit) {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.releaseMode !== 'production') throw Error('Production manifest required');
  if (!(artifact instanceof Uint8Array) || artifact.byteLength === 0) throw Error('Exact nonempty artifact required');
  if (!isHex(commit, 40)) throw Error('Full Git commit SHA required');
  return { commit, artifactSha256: sha256(artifact), manifestSha256: releaseManifestDigest(manifest) };
}

export function prepareReleaseApproval(manifest, artifact, commit, { now = new Date(), lifetimeHours = 24 } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isInteger(lifetimeHours) || lifetimeHours < 1 || lifetimeHours > 168) throw Error('Invalid release approval lifetime');
  const payload = { schemaVersion: 1, purpose: 'taxpulse-production-release', ...subject(manifest, artifact, commit), issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + lifetimeHours * 3600000).toISOString() };
  releaseApprovalBytes(payload);
  return payload;
}

function checkedBytes(payload, manifest, artifact, commit, now) {
  const bytes = releaseApprovalBytes(payload), expected = subject(manifest, artifact, commit);
  for (const field of Object.keys(expected)) if (payload[field] !== expected[field]) throw Error('Release subject mismatch: ' + field);
  const t = now.getTime(), issued = Date.parse(payload.issuedAt), expiry = Date.parse(payload.expiresAt);
  if (!Number.isFinite(t) || issued > t || expiry <= t || expiry - issued > 7 * 86400000) throw Error('Release approval expired or not yet valid');
  return bytes;
}

export function signReleaseRole({ payload, manifest, artifact, commit, role, privatePem, trustedPublicKeyHex, now = new Date() }) {
  if (!roles.has(role) || !isHex(trustedPublicKeyHex, 64)) throw Error('Invalid signing role or trusted public key');
  const bytes = checkedBytes(payload, manifest, artifact, commit, now);
  const key = createPrivateKey(privatePem);
  if (key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 private key required');
  const publicKeyHex = Buffer.from(createPublicKey(key).export({ format: 'jwk' }).x, 'base64url').toString('hex');
  if (publicKeyHex !== trustedPublicKeyHex) throw Error('Private key does not match the trusted role key');
  return { role, payload, publicKeyHex, signature: sign(null, bytes, key).toString('hex') };
}

export function assembleReleaseApproval({ founder, reviewer, manifest, artifact, commit, founderPublicKeyHex, reviewerPublicKeyHex, now = new Date() }) {
  const subjectDigest = subject(manifest, artifact, commit);
  if (!founder || !reviewer || founder.role !== 'founder' || reviewer.role !== 'reviewer' || founder.publicKeyHex !== founderPublicKeyHex || reviewer.publicKeyHex !== reviewerPublicKeyHex) throw Error('Release signer role or trust mismatch');
  const left = checkedBytes(founder.payload, manifest, artifact, commit, now), right = checkedBytes(reviewer.payload, manifest, artifact, commit, now);
  if (!left.equals(right)) throw Error('Signers approved different payloads');
  const authorization = { payload: founder.payload, founderSignature: founder.signature, reviewerSignature: reviewer.signature };
  verifyProductionAuthorization(manifest, authorization, { commit, artifactSha256: subjectDigest.artifactSha256, founderPublicKeyHex, reviewerPublicKeyHex, now });
  return authorization;
}
