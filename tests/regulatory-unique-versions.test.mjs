import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

function activate(db, sequence, regional, payroll = []) {
  const envelope = JSON.stringify({payload:{regional:{versions:regional},indiaSalary:{versions:[]},payroll:{versions:payroll}}});
  db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,state='active' WHERE id=1").run(sequence,String(sequence).padStart(64,'0'),envelope);
}
test('database rejects duplicate and missing version IDs atomically', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of ['001-regulatory-snapshots.sql','002-regulatory-version-ledger.sql','003-regulatory-unique-versions.sql']) {
      db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
    }
    activate(db,1,[{version:'v1',rate:100}]);
    for (const [regional,payroll] of [
      [[{version:'v2',rate:200},{version:'v2',rate:300}],[]],
      [[{version:'v2',rate:200}],[{version:'v2',rate:200}]],
      [[{rate:200}],[]]
    ]) {
      assert.throws(()=>activate(db,2,regional,payroll),/duplicate or missing snapshot version/);
      assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,1);
      for (const table of ['regulatory_events','regulatory_snapshots','regulatory_version_ledger']) {
        assert.equal(db.prepare('SELECT count(*) AS n FROM '+table).get().n,1);
      }
    }
    activate(db,2,[{version:'v2',rate:200}],[{version:'v3',rate:300}]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM regulatory_version_ledger').get().n,3);
  } finally {db.close();}
});
