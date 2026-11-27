import test from 'node:test';import assert from 'node:assert/strict';import {assertProductionReady} from '../engine/release-gate.mjs';import {catalog} from '../engine/country.mjs';
test('current prototype cannot enter production',()=>assert.throws(()=>assertProductionReady()));
test('missing country evidence fails closed',()=>assert.throws(()=>assertProductionReady({schemaVersion:1,releaseMode:'production',countries:{}})));

test('all seven backend modules exist but fabricated verification flags cannot bypass independent evidence', () => {
  const codes = ['IN', 'US', 'GB', 'DE', 'AE', 'CA', 'AU', 'SG'];
  const countries = Object.fromEntries(codes.map(code => [code, {
    taxYear: '2026', verification: 'verified', productionEnabled: true,
    evidence: ['unreviewed string evidence']
  }]));
  assert.deepEqual(catalog().modules,['pit','payroll','capgains','vat','corporate','property','dtaa']);
  assert.throws(
    () => assertProductionReady({ schemaVersion: 1, releaseMode: 'production', countries }),
    /Missing official-source evidence or independent checks: IN\/pit/
  );
});
