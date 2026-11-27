import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {compareIndiaRegimes} from '../engine/taxable-income.mjs';import {resolveIndiaSalaryRule,resolveIndiaSalaryRuleAt,validateIndiaSalaryRegistry} from '../engine/india-salary-registry.mjs';
const baseline=JSON.parse(readFileSync(new URL('../rules/india-salary-versions.json',import.meta.url)));
const input={country:'IN',taxYear:'2026',grossSalary:1500000,residentIndividual:true,ageGroup:'under-60',ordinarySalaryOnly:true,oldEligibleDeductions:0,newEligibleDeductions:0};
test('India salary baseline and parameter-only mutation',()=>{const r=compareIndiaRegimes(input);assert.equal(r.newRegime.incomeTax,97500);const changed=structuredClone(baseline);changed.versions[0].parameters.new.standardDeduction=100000;changed.versions[0].version='IN-synthetic-test';const updated=compareIndiaRegimes(input,changed);assert.equal(updated.newRegime.standardDeduction,100000);assert.equal(updated.newRegime.incomeTax,93600);assert.equal(updated.ruleId,'IN-synthetic-test');assert.equal(updated.taxRulesVerified,false);assert.equal(compareIndiaRegimes(input).newRegime.incomeTax,97500);});
test('future and partial periods require explicit effective-date resolution',()=>{const changed=structuredClone(baseline);changed.versions.push({...structuredClone(changed.versions[0]),taxYear:'2027',version:'IN-synthetic-2027',effectiveFrom:'2027-04-01',effectiveUntil:'2028-04-01'});assert.equal(compareIndiaRegimes({...input,taxYear:'2027'},changed).taxYear,'2027');assert.throws(()=>compareIndiaRegimes({...input,taxYear:'2028'},changed));changed.versions[1].effectiveFrom='2027-09-01';assert.equal(validateIndiaSalaryRegistry(changed),changed);assert.equal(resolveIndiaSalaryRuleAt('2027-09-01',changed).version,'IN-synthetic-2027');assert.throws(()=>resolveIndiaSalaryRule('2027',changed),/full assessment period/);});
test('invalid parameters and unauthorized rule data rejected',()=>{for(const mutate of [r=>r.parameters.new.bands[0][1]=101,r=>r.parameters.cessPercent=-1,r=>r.parameters.roundingRupees=0,r=>r.parameters.old.exempt.default=600000,r=>r.status='approved']){const d=structuredClone(baseline);mutate(d.versions[0]);assert.throws(()=>validateIndiaSalaryRegistry(d));}});

test('India annual comparison rejects a mid-year version split but date lookup resolves both versions',()=>{
 const split=structuredClone(baseline);
 const first=split.versions[0];
 first.effectiveUntil='2026-10-01';
 const second=structuredClone(first);
 second.version='IN-2026-27-salary-H2-fixture';
 second.effectiveFrom='2026-10-01';
 second.effectiveUntil='2027-04-01';
 second.parameters={...second.parameters,new:{...second.parameters.new,standardDeduction:80000}};
 split.versions.push(second);
 assert.equal(validateIndiaSalaryRegistry(split),split);
 assert.equal(resolveIndiaSalaryRuleAt('2026-09-30',split).version,first.version);
 assert.equal(resolveIndiaSalaryRuleAt('2026-10-01',split).version,second.version);
 assert.throws(()=>resolveIndiaSalaryRule('2026',split),/full assessment period/);
});
