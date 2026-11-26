# TaxPulse Global standalone migration

Canonical repository: solopreneursid/Taxpulse-Global. Default branch: main. Imported from solopreneursid/YorpHives_Website at c348a836d3880fe4b393b5a756a3e8f31a8ef792 (product subtree 6a15a027137d89ba66b330af0a70028cc4804f5a). Git subtree split preserved product-specific history (d8a7407b2fe3d9da8826ebb0f8f1bbc226af1eca). Import run 45755196560 verified all 181 original blobs and preserved the destination LICENSE. Original PR #107 and original CI run logs remain historical records in the old repository.

Root-level product layout. CI and hosted verification are standalone. The independent evidence collector is now configured here, but the daily schedule is held until a new repository-scoped collector key is securely enrolled and live submission/read-back are verified. The prior scheduler is retained temporarily for continuity. Do not transfer private keys via commits or logs. Follow REGULATORY-COLLECTOR-ENROLLMENT.md to generate a new key.

Keep the existing Cloudflare staging Worker, monitor, evidence intake, private publisher, KV namespaces and D1 database; these already contain the live observations and review queue. Do not recreate or delete them. After new-key enrollment, update intake code and public key from this repository, verify the new collector, enable the daily schedule here, disable the old default-branch TaxPulse collector and revoke its old secret. Existing signed publisher/reviewer enrollment and statutory approval remain separate release blockers. Production remains unchanged.

The one-time import workflow is removed from main after verified import; the history and migration branch remain for audit and rollback. New development must be committed here.
