import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { prepareReleaseApproval, signReleaseRole, assembleReleaseApproval } from '../engine/release-signing.mjs';
import { verifyProductionAuthorization } from '../engine/release-authorization.mjs';
const newKey = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), hex: Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex') };
};
const founder = newKey(), reviewer = newKey();
const manifest = { schemaVersion: 1, releaseMode: 'production', countries: {} };
const artifact = Buffer.from('synthetic artifact');
const commit = 'a'.repeat(40), now = new Date('2026-11-26T12:00:00Z');
const payload = prepareReleaseApproval(manifest, artifact, commit, { now });
const base = { payload, manifest, artifact, commit, now };
const signRole = (role, key, extra = {}) => signReleaseRole({ ...base, role, privatePem: key.pem, trustedPublicKeyHex: key.hex, ...extra });
const f = signRole('founder', founder), r = signRole('reviewer', reviewer);
const assembly = { founder: f, reviewer: r, manifest, artifact, commit, now, founderPublicKeyHex: founder.hex, reviewerPublicKeyHex: reviewer.hex };
test('two offline synthetic signers assemble an artifact-bound approval', () => {
  const auth = assembleReleaseApproval(assembly);
  assert.equal(verifyProductionAuthorization(manifest, auth, { commit, artifactSha256: createHash('sha256').update(artifact).digest('hex'), now, founderPublicKeyHex: founder.hex, reviewerPublicKeyHex: reviewer.hex }), true);
});
test('rejects preview manifests, changed subjects, expiry, swapped roles and keys', () => {
  assert.throws(() => prepareReleaseApproval({ ...manifest, releaseMode: 'preview' }, artifact, commit, { now }), /Production manifest/);
  assert.throws(() => prepareReleaseApproval(manifest, artifact, commit, { now, lifetimeHours: 169 }));
  assert.throws(() => signRole('founder', founder, { artifact: Buffer.from('different') }), /subject mismatch/);
  assert.throws(() => signRole('founder', founder, { trustedPublicKeyHex: reviewer.hex }), /trusted role key/);
  assert.throws(() => signRole('reviewer', reviewer, { now: new Date(payload.expiresAt) }), /expired/);
  assert.throws(() => assembleReleaseApproval({ ...assembly, reviewer: { ...r, signature: f.signature } }), /signature/);
  assert.throws(() => assembleReleaseApproval({ ...assembly, founder: r, reviewer: f }), /role/);
  assert.throws(() => assembleReleaseApproval({ ...assembly, reviewer: signRole('reviewer', founder), reviewerPublicKeyHex: founder.hex }), /Independent release keys/);
  const other = prepareReleaseApproval(manifest, artifact, commit, { now, lifetimeHours: 2 });
  assert.throws(() => assembleReleaseApproval({ ...assembly, reviewer: signRole('reviewer', reviewer, { payload: other }) }), /different payloads/);
});
