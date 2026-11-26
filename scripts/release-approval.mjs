import { readFile, writeFile } from 'node:fs/promises';
import { prepareReleaseApproval, signReleaseRole, assembleReleaseApproval } from '../engine/release-signing.mjs';
const usage = `Usage:
  node scripts/release-approval.mjs prepare MANIFEST ARTIFACT COMMIT OUTPUT [LIFETIME_HOURS]
  node scripts/release-approval.mjs sign ROLE PAYLOAD MANIFEST ARTIFACT COMMIT PRIVATE_PEM TRUSTED_PUBLIC_JSON OUTPUT I_APPROVE_THIS_EXACT_RELEASE
  node scripts/release-approval.mjs assemble FOUNDER_SIGNATURE REVIEWER_SIGNATURE MANIFEST ARTIFACT COMMIT FOUNDER_PUBLIC_JSON REVIEWER_PUBLIC_JSON OUTPUT
Private keys must stay on the respective signer's offline machine. No deployment is performed.`;
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const publicHex = async file => (await json(file)).publicKeyHex;
const output = (file, data) => writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'prepare' && (args.length === 4 || args.length === 5)) {
    const [manifest, artifact, commit, dest, hours] = args;
    await output(dest, prepareReleaseApproval(await json(manifest), await readFile(artifact), commit, { lifetimeHours: hours === undefined ? 24 : Number(hours) }));
  } else if (command === 'sign' && args.length === 9 && args[8] === 'I_APPROVE_THIS_EXACT_RELEASE') {
    const [role, payload, manifest, artifact, commit, key, trusted, dest] = args;
    await output(dest, signReleaseRole({ role, payload: await json(payload), manifest: await json(manifest), artifact: await readFile(artifact), commit, privatePem: await readFile(key), trustedPublicKeyHex: await publicHex(trusted) }));
  } else if (command === 'assemble' && args.length === 8) {
    const [founder, reviewer, manifest, artifact, commit, founderPublic, reviewerPublic, dest] = args;
    await output(dest, assembleReleaseApproval({ founder: await json(founder), reviewer: await json(reviewer), manifest: await json(manifest), artifact: await readFile(artifact), commit, founderPublicKeyHex: await publicHex(founderPublic), reviewerPublicKeyHex: await publicHex(reviewerPublic) }));
  } else throw Error(usage);
  console.log('Release approval file written. No deployment or statutory certification performed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Release approval failed');
  process.exitCode = 1;
}
