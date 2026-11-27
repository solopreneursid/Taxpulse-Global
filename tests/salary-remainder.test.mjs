import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSalaryRemainder as calc} from '../engine/taxable-income.mjs';
import {createReceipt,verifyReceipt} from '../engine/proof.mjs';
const us=(pay)=>({country:'US',region:'TX',taxYear:'2026',pay,scopeConfirmed:true});
const gb=(pay,region='RUK')=>({country:'GB',region,taxYear:'2026',pay,scopeConfirmed:true});
test('Texas 100k ordinary salary regular income tax and FICA',()=>{const r=calc(us(100000));assert.equal(r.incomeTax,13170);assert.deepEqual(r.contributions.map(c=>c.amount),[6200,1450,0]);assert.equal(r.annualRemainder,79180);assert.equal(r.averageMonthlyRemainder,6598.33);assert.equal(r.taxRulesVerified,false);});
test('Social Security cap and additional Medicare threshold',()=>{assert.equal(calc(us(184500)).contributions[0].amount,11439);assert.equal(calc(us(200000)).contributions[2].amount,0);assert.equal(calc(us(200100)).contributions[2].amount,.9);const r=calc(us(250000));assert.equal(r.incomeTax,51304);assert.deepEqual(r.contributions.map(c=>c.amount),[11439,3625,450]);assert.equal(r.annualRemainder,183182);});
test('US zero wages and standard deduction boundary',()=>{assert.equal(calc(us(0)).annualRemainder,0);assert.equal(calc(us(16100)).incomeTax,0);assert.equal(calc(us(16100)).employeeContributions,1231.65);});
test('UK monthly thresholds not annualized thresholds',()=>{assert.equal(calc(gb(1048)).employeeContributions,0);assert.equal(calc(gb(1049)).employeeContributions,.96);assert.equal(calc(gb(4189)).employeeContributions,3015.36);assert.equal(calc(gb(4190)).employeeContributions,3015.6);});
test('England and Scotland 4000 monthly',()=>{const a=calc(gb(4000)),b=calc(gb(4000,'SCT'));assert.equal(a.incomeTax,7086);assert.equal(b.incomeTax,8142.05);assert.equal(a.employeeContributions,2833.92);assert.equal(a.annualRemainder,38080.08);assert.equal(b.annualRemainder,37024.03);});
test('unsupported situations reject rather than extrapolate',()=>{for(const v of [us(250001),us(-1),us(1.001),gb(100001),gb(4000.01),{...us(10000),region:'PA'},{...us(10000),scopeConfirmed:false},{...gb(4000),extra:1}])assert.throws(()=>calc(v));});
test('replay report',async()=>{const engineFingerprint='a'.repeat(64);const r=await createReceipt({kind:'salary-remainder',input:gb(4000,'SCT'),engineFingerprint});assert.deepEqual(await verifyReceipt(r,engineFingerprint),{integrity:true,sameEngine:true,reproduced:true});});

test('Singapore 2026 income estimate resolves the separate YA 2027 preview period',()=>{
 const a=calc({country:'SG',region:'SG',taxYear:'2026',pay:3000,scopeConfirmed:true});
 const b=calc({country:'SG',region:'SG',taxYear:'2026',pay:4000,scopeConfirmed:true});
 assert.equal(a.taxYearLabel,'Income earned in calendar year 2026; YA 2027');
 assert.equal(a.taxableIncome,27800);
 assert.equal(a.incomeTax,156);
 assert.equal(a.employeeContributions,7200);
 assert.equal(a.effectiveRuleVersion,'SG-2026-salary-assessment-v1');
 assert.equal(b.taxableIncome,37400);
 assert.equal(b.incomeTax,459);
 assert.equal(b.employeeContributions,9600);
});
