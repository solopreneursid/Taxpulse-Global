# Statutory evidence records

TaxPulse's statutory evidence registry is generated from the 56-scope inventory, rule metadata, evidence review records and test-file references.

Run:

```sh
node scripts/build-statutory-evidence-registry.mjs
```

The generator writes `rules/statutory-evidence-registry.json`. The staging CI test also generates and uploads this file as the `statutory-evidence-registry` artifact.

## Interpretation rules

- A recorded URL is a source reference, not proof that the source was retrieved, current, applicable or independently validated.
- `localMetadataSha256` hashes the repository's local rule/evidence metadata file. It is not a hash of the external government publication.
- Test-file references identify relevant module-level tests. They do not establish that every statutory edge case is covered.
- `knownGaps` is carried forward from the scope inventory.
- Independent approval remains `not-established` until a genuine independent attestation is enrolled and verified.
- Every generated scope remains `productionEnabled: false`.

Do not change a scope to approved or production-enabled merely because the generator, test suite or source URL checks pass.
