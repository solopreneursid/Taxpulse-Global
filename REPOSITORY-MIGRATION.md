# TaxPulse Global standalone migration

Canonical repository: solopreneursid/Taxpulse-Global. Default branch: main. Imported from solopreneursid/YorpHives_Website at c348a836d3880fe4b393b5a756a3e8f31a8ef792 (product subtree 6a15a027137d89ba66b330af0a70028cc4804f5a). Git subtree split preserved product-specific history (d8a7407b2fe3d9da8826ebb0f8f1bbc226af1eca). Import run 45755196560 verified all 181 original blobs and preserved the destination LICENSE. Original PR #107 and original CI run logs remain historical records in the old repository.

Root-level product layout. CI and hosted verification are standalone. The independent evidence collector is configured and active here. A new repository-scoped collector key was enrolled; signed delivery and KV read-back passed in run 45755972060. The old default-branch scheduler was removed after the new schedule was verified in source. Do not transfer private keys via commits or logs. Follow REGULATORY-COLLECTOR-ENROLLMENT.md to generate a new key.

Keep the existing Cloudflare staging Worker, monitor, evidence intake, private publisher, KV namespaces and D1 database; these already contain the live observations and review queue. Do not recreate or delete them. The intake Worker has been redeployed from this repository with the new public key; the old key is no longer accepted. The new schedule is 47 1 * * * (07:17 IST). The Cloudflare monitor remains at 08:00 IST. The obsolete repository secret should be deleted by the founder; the connector cannot manage Actions secrets. Existing signed publisher/reviewer enrollment and statutory approval remain separate release blockers. Production remains unchanged.

The one-time import workflow is removed from main after verified import; the history and migration branch remain for audit and rollback. New development must be committed here.

## Verified cutover (2026-11-26)
- Standalone CI run 45755395235: 450/450 tests, zero dependency vulnerabilities, hosted mobile and desktop checks passed.
- Intake Worker version d1089ecb-f5e0-4384-a71c-e15df61713da: new repository source and public key; original regulatory KV binding retained.
- New collector run 45755972060: signed report accepted, exact digest 618e41d0045f7f8a296a37ff0bb52051b1e3e930e3df874f01a840e557b98d55 confirmed by KV read-back. 27/30 retrieved in that run; 29/30 reachable across collectors. Automatic rule changes false.
- Standalone scheduler enabled in 6c042c1c32cab113cc696e3c2a07b16aab5e06f3. Old workflow removed in eef2a3895efd40af95cdf2305d89fea4b89c4331; no TaxPulse workflows remain on old default branch.
- Next cron-triggered run not yet observed. Legacy branch and historical PR retained for audit only. No production deployment or statutory activation.
