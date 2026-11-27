import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancialProfile,salaryFromProfile,offerFromProfile,internationalFromProfile,negotiationFromProfile,exportEncryptedProfile,importEncryptedProfile,validatePlanningArchive,exportPlanningArchive,importPlanningArchive,planningReport} from '../engine/financial-profile.mjs';
import {calculateSalaryRemainder} from '../engine/taxable-income.mjs';
const cases=[['US','TX',100000,{}],['GB','RUK',3000,{}],['GB','SCT',4000,{}],['CA','AB',100000,{}],['AU','AU',100000,{}],['IN','IN',1500000,{epfMonthlyWage:15000,professionalTaxAnnual:2500}],['SG','SG',5000,{}],['DE','DE',5000,{annualTaxableIncome:50000,healthSupplementRate:2.9}],['AE','AE',20000,{monthlyBasicSalary:16000}]];
for(const [country,region,pay,extras] of cases)test('financial profile parity '+region,()=>{
 const salary={country,region,taxYear:'2026',pay,scopeConfirmed:true,...extras};
 const p=createFinancialProfile(salary),r=calculateSalaryRemainder(salary);
 assert.equal(p.annualTakeHome,r.annualRemainder);
 assert.deepEqual(salaryFromProfile(p),salary);
 assert.equal(offerFromProfile(p).scopeConfirmed,false);
 assert.deepEqual(internationalFromProfile(p,{housing:100,living:200}),{salary:{...salary,scopeConfirmed:false},housing:100,living:200});
 assert.deepEqual(negotiationFromProfile(p,100),{current:salary,monthlyIncrease:100});
 assert.equal(Object.isFrozen(p.salary),true);
 assert.equal(p.taxRulesVerified,false);
 assert.throws(()=>salaryFromProfile({...p,annualTakeHome:p.annualTakeHome+1}));
 assert.throws(()=>salaryFromProfile({...p,currency:'XXX'}));
 assert.throws(()=>createFinancialProfile({...salary,scopeConfirmed:false}));
 assert.throws(()=>createFinancialProfile({...salary,unexpected:1}));
 assert.throws(()=>internationalFromProfile(p,{housing:-1,living:0}));
 assert.throws(()=>negotiationFromProfile(p,0));
});

test('encrypted profile backup authenticates and binds the exact calculation engine',async()=>{
 const p=createFinancialProfile({country:'US',region:'TX',taxYear:'2026',pay:100000,scopeConfirmed:true}),password='fictional-test-password',fingerprint='a'.repeat(64);
 const envelope=await exportEncryptedProfile(p,password,fingerprint);
 assert.ok(!JSON.stringify(envelope).includes('annualTakeHome'));
 assert.deepEqual(await importEncryptedProfile(envelope,password,fingerprint),p);
 await assert.rejects(importEncryptedProfile(envelope,password,'b'.repeat(64)),/Incompatible/);
 await assert.rejects(importEncryptedProfile(envelope,'different-test-password',fingerprint));
 await assert.rejects(exportEncryptedProfile({...p,annualTakeHome:1},password,fingerprint));
});

test('planning archive validates bounded profiles and scenarios, authenticates file, rejects altered input',async()=>{
 const salary={country:'US',region:'TX',taxYear:'2026',pay:100000,scopeConfirmed:true},investment={currency:'USD',initialSavings:1000,monthlyContribution:100,annualReturnPercent:5,horizonMonths:12,inflationPercent:2},input={salaryProfiles:[salary,{...salary,pay:110000}],scenarios:[{kind:'investment-scenario',input:investment}]},pass='synthetic-archive-passphrase',fp='a'.repeat(64);
 const envelope=await exportPlanningArchive(input,pass,fp);assert.ok(!JSON.stringify(envelope).includes('monthlyContribution'));assert.deepEqual(await importPlanningArchive(envelope,pass,fp),input);
 await assert.rejects(importPlanningArchive(envelope,pass,'b'.repeat(64)));await assert.rejects(importPlanningArchive(envelope,'wrong-synthetic-passphrase',fp));
 assert.throws(()=>validatePlanningArchive({...input,salaryProfiles:Array(11).fill(salary)}));
 assert.throws(()=>validatePlanningArchive({...input,scenarios:[{kind:'__proto__',input:investment}]}));
 assert.throws(()=>validatePlanningArchive({...input,scenarios:[{kind:'investment-scenario',input:{...investment,horizonMonths:601}}]}));
 assert.throws(()=>validatePlanningArchive({...input,scenarios:[{kind:'investment-scenario',input:investment,result:{}}]}));
});

test('consolidated report recalculates separate scenarios without summing currencies or alternatives',()=>{
 const salary={country:'US',region:'TX',taxYear:'2026',pay:100000,scopeConfirmed:true},investment={currency:'INR',initialSavings:1000,monthlyContribution:100,annualReturnPercent:12,horizonMonths:2,inflationPercent:0},input={salaryProfiles:[salary],scenarios:[{kind:'investment-scenario',input:investment},{kind:'investment-scenario',input:{...investment,currency:'GBP',annualReturnPercent:0}}]};
 const r=planningReport(input,'a'.repeat(64));assert.equal(r.salary[0].currency,'USD');assert.equal(r.salary[0].annualGross,100000);assert.equal(r.scenarios[0].metrics.nominalBalance,1221.1);assert.equal(r.scenarios[1].metrics.nominalBalance,1200);assert.equal(r.scenarios[1].currency,'GBP');assert.equal(r.taxRulesVerified,false);assert.equal(r.sampleOnly,true);assert.equal(Object.hasOwn(r,'combinedBalance'),false);
 assert.throws(()=>planningReport({salaryProfiles:[],scenarios:[]},'a'.repeat(64)));assert.throws(()=>planningReport(input,'bad'));
});


test('cash-flow stress is preserved, recalculated and summarized in the encrypted Financial Twin archive',async()=>{
 const salary={country:'US',region:'TX',taxYear:'2026',pay:100000,scopeConfirmed:true};
 const stress={currency:'USD',monthlyIncome:5000,monthlyExpenses:4000,liquidSavings:8000,reserveFloor:6000,horizonMonths:12,incomeReductionPercent:50,expenseIncreasePercent:25,shockStartMonth:2,shockDurationMonths:3};
 const input={salaryProfiles:[salary],scenarios:[{kind:'cash-flow-stress',input:stress}]};
 const pass='synthetic-stress-archive-passphrase',fingerprint='f'.repeat(64);
 assert.deepEqual(validatePlanningArchive(input),input);
 const envelope=await exportPlanningArchive(input,pass,fingerprint);
 assert.ok(!JSON.stringify(envelope).includes('monthlyIncome'));
 assert.deepEqual(await importPlanningArchive(envelope,pass,fingerprint),input);
 const report=planningReport(input,fingerprint);
 assert.equal(report.scenarios[0].kind,'cash-flow-stress');
 assert.equal(report.scenarios[0].metrics.baselineEndingLiquidSavings,20000);
 assert.equal(report.scenarios[0].metrics.stressEndingLiquidSavings,9500);
 assert.equal(report.scenarios[0].metrics.stressFirstReserveBreachMonth,3);
 assert.equal(report.scenarios[0].metrics.reserveRestoredMonth,9);
 assert.equal(report.taxRulesVerified,false);
});
