import test from 'node:test';
import assert from 'node:assert/strict';
import {createFinancialProfile,salaryFromProfile,offerFromProfile,internationalFromProfile,negotiationFromProfile,exportEncryptedProfile,importEncryptedProfile} from '../engine/financial-profile.mjs';
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
