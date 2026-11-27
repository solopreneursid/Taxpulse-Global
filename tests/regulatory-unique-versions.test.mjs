import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

function activate(db, sequence, regional, payroll = [], nationalPeriods = [], national = {national:{},investment:{},sources:{}}) {
  const envelope = JSON.stringify({payload:{regional:{versions:regional},indiaSalary:{versions:[]},payroll:{versions:payroll},national:{...national,effectivePeriods:nationalPeriods}}});
  db.prepare("UPDATE regulatory_head SET sequence=?,digest=?,envelope=?,state='active' WHERE id=1").run(sequence,String(sequence).padStart(64,'0'),envelope);
}
test('database rejects duplicate and missing version IDs atomically', () => {
  const db = new DatabaseSync(':memory:');
  try {
    for (const file of ['001-regulatory-snapshots.sql','002-regulatory-version-ledger.sql','003-regulatory-unique-versions.sql','005-regulatory-national-version-ledger.sql']) {
      db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
    }
    activate(db,1,[{version:'v1',rate:100}]);
    for (const [regional,payroll,nationalPeriods] of [
      [[{version:'v2',rate:200},{version:'v2',rate:300}],[],[]],
      [[{version:'v2',rate:200}],[{version:'v2',rate:200}],[]],
      [[{rate:200}],[],[]],
      [[{version:'v2',rate:200}],[],[{version:'v2'}]],
      [[],[],[{version:'v2'},{version:'v2'}]]
    ]) {
      assert.throws(()=>activate(db,2,regional,payroll,nationalPeriods),/duplicate or missing snapshot version/);
      assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,1);
      for (const table of ['regulatory_events','regulatory_snapshots','regulatory_version_ledger']) {
        assert.equal(db.prepare('SELECT count(*) AS n FROM '+table).get().n,1);
      }
    }
    activate(db,2,[{version:'v2',rate:200}],[{version:'v3',rate:300}]);
    assert.equal(db.prepare('SELECT count(*) AS n FROM regulatory_version_ledger').get().n,3);
  } finally {db.close();}
});


test('national, investment and salary versions are backfilled and immutable in migration 005',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync(new URL('../migrations/001-regulatory-snapshots.sql',import.meta.url),'utf8'));
  const periods=[
   {jurisdiction:'US',component:'national-assessment',taxYear:'2026',version:'US-2026-national-v1',effectiveFrom:'2026-01-01',effectiveUntil:'2027-01-01',status:'preview',legalStatus:'unverified'},
   {jurisdiction:'US',component:'investment-assessment',taxYear:'2026',version:'US-2026-investment-v1',effectiveFrom:'2026-01-01',effectiveUntil:'2027-01-01',status:'preview',legalStatus:'unverified'},
   {jurisdiction:'SG',component:'salary-assessment',taxYear:'2026',version:'SG-2026-salary-v1',effectiveFrom:'2026-01-01',effectiveUntil:'2027-01-01',status:'preview',legalStatus:'unverified'}
  ];
  const registry={national:{US:{ordinaryRate:2100},SG:{salaryRate:0}},investment:{US:{holdingYears:1}},sources:{US:['https://www.irs.gov/'],SG:['https://www.iras.gov.sg/']}};
  activate(db,1,[],[],periods,registry);
  activate(db,2,[],[],periods,registry);
  db.exec(readFileSync(new URL('../migrations/002-regulatory-version-ledger.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/003-regulatory-unique-versions.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/005-regulatory-national-version-ledger.sql',import.meta.url),'utf8'));
  const rows=db.prepare('SELECT version,definition,first_sequence FROM regulatory_version_ledger ORDER BY version').all();
  assert.deepEqual(rows.map(r=>[r.version,r.first_sequence]),[
   ['SG-2026-salary-v1',1],['US-2026-investment-v1',1],['US-2026-national-v1',1]
  ]);
  const salary=JSON.parse(rows[0].definition);
  const investment=JSON.parse(rows[1].definition);
  const national=JSON.parse(rows[2].definition);
  assert.equal(salary.parameters.salaryRate,0);
  assert.equal(investment.parameters.holdingYears,1);
  assert.deepEqual(national.sourceUrls,['https://www.irs.gov/']);
  assert.equal(national.period.effectiveFrom,'2026-01-01');
  assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,3);
  assert.throws(()=>activate(db,3,[],[],periods,{...registry,national:{...registry.national,US:{ordinaryRate:2200}}}),/immutable historical version changed/);
  const duplicate=[...periods,{...periods[0]}];
  assert.throws(()=>activate(db,3,[],[],duplicate,registry),/duplicate or missing snapshot version/);
  assert.equal(db.prepare('SELECT sequence FROM regulatory_head').get().sequence,2);
  assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,3);
  db.exec(readFileSync(new URL('../migrations/005-regulatory-national-version-ledger.sql',import.meta.url),'utf8'));
  assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,3);
 }finally{db.close();}
});

test('migration 005 aborts when historical national snapshots reuse a version for changed parameters',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(readFileSync(new URL('../migrations/001-regulatory-snapshots.sql',import.meta.url),'utf8'));
  const period={jurisdiction:'US',component:'national-assessment',taxYear:'2026',version:'US-2026-national-v1',effectiveFrom:'2026-01-01',effectiveUntil:'2027-01-01',status:'preview',legalStatus:'unverified'};
  const first={national:{US:{ordinaryRate:2100}},investment:{},sources:{US:['https://www.irs.gov/']}};
  const changed={national:{US:{ordinaryRate:2200}},investment:{},sources:{US:['https://www.irs.gov/']}};
  activate(db,1,[],[],[period],first);
  activate(db,2,[],[],[period],changed);
  db.exec(readFileSync(new URL('../migrations/002-regulatory-version-ledger.sql',import.meta.url),'utf8'));
  db.exec(readFileSync(new URL('../migrations/003-regulatory-unique-versions.sql',import.meta.url),'utf8'));
  assert.throws(()=>db.exec(readFileSync(new URL('../migrations/005-regulatory-national-version-ledger.sql',import.meta.url),'utf8')),/immutable version ledger/);
  assert.equal(db.prepare('SELECT count(*) n FROM regulatory_version_ledger').get().n,0);
 }finally{db.close();}
});
