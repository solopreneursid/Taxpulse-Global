import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateSalaryRemainder,calculateEmployeeContributions} from '../engine/taxable-income.mjs';
import {resolvePayrollRule,resolvePayrollRuleAt,validatePayrollRegistry} from '../engine/payroll-registry.mjs';
import {regulatorySummary} from '../engine/regulatory-dashboard.mjs';
const baseline=JSON.parse(readFileSync(new URL('../rules/payroll-versions.json',import.meta.url)));
test('OASDI data change affects salary without formula change',()=>{const i={country:'US',region:'TX',taxYear:'2026',pay:200000,scopeConfirmed:true};const original=calculateSalaryRemainder(i);const p=structuredClone(baseline);p.versions.find(r=>r.component==='oasdi').parameters.annualWageBase=190000;const changed=calculateSalaryRemainder(i,{payroll:p});assert.equal(original.contributions.find(c=>c.name==='Social Security').amount,11439);assert.equal(changed.contributions.find(c=>c.name==='Social Security').amount,11780);assert.equal(original.annualRemainder-changed.annualRemainder,341);});
test('invalid ceilings and rates are rejected',()=>{const p=structuredClone(baseline);p.versions.find(r=>r.component==='cpp-ei').parameters.cpp2Ceiling=1;assert.throws(()=>validatePayrollRegistry(p));});
test('regulatory dashboard never presents missing or old monitoring as current',()=>{const config=[{id:'x',jurisdiction:'GB',topics:['privacy'],url:'https://ico.org.uk/'}];const now=new Date('2026-11-25T12:00:00Z');const absent=regulatorySummary(config,null,now);assert.equal(absent.stale,true);assert.equal(absent.unavailable,1);const fresh=regulatorySummary(config,{checkedAt:'2026-11-25T11:00:00Z',sources:[{id:'x',url:config[0].url,status:'review_required',reviewPending:true}]},now);assert.equal(fresh.stale,false);assert.equal(fresh.reviewPending,1);assert.equal(fresh.taxRulesVerified,false);});

test('payroll rules resolve at exact effective dates and annual models reject split years',()=>{
 const split=structuredClone(baseline);
 const first=split.versions.find(r=>r.jurisdiction==='US'&&r.component==='oasdi'&&r.taxYear==='2026');
 first.effectiveUntil='2026-07-01';
 const second=structuredClone(first);
 second.version='US-OASDI-2026-H2-fixture';
 second.effectiveFrom='2026-07-01';
 second.effectiveUntil='2027-01-01';
 second.parameters={...second.parameters,annualWageBase:190000};
 split.versions.push(second);
 assert.equal(validatePayrollRegistry(split),split);
 assert.equal(resolvePayrollRuleAt('US','oasdi','2026-06-30',split).version,first.version);
 assert.equal(resolvePayrollRuleAt('US','oasdi','2026-07-01',split).version,second.version);
 assert.throws(()=>resolvePayrollRule('US','oasdi','2026',split),/full assessment period/);
});
