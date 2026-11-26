import test from 'node:test';
import assert from 'node:assert/strict';
import {reverseSalary,automaticReverseSalary} from '../engine/reverse-salary.mjs';
import {calculateSalaryRemainder} from '../engine/taxable-income.mjs';
const profiles=[
 ['US','TX',60000,{}],['GB','RUK',4000,{}],['CA','AB',80000,{}],
 ['AU','AU',120000,{}],['IN','IN',1275000,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['SG','SG',5000,{}],['DE','DE',5000,{annualTaxableIncome:50000,healthSupplementRate:2.9}],
 ['AE','AE',20000,{monthlyBasicSalary:16000}]
];
for(const [country,region,pay,extras] of profiles)test(country+' reverse salary matches exhaustive forward results',()=>{
 const profile={country,region,taxYear:'2026',scopeConfirmed:true,...extras};
 for(const period of ['annual','monthly']){
 const field=period==='annual'?'annualRemainder':'averageMonthlyRemainder';
 const target=calculateSalaryRemainder({...profile,pay})[field];
 const minPay=pay-20,maxPay=pay+20;
 const r=reverseSalary({profile,target,period,minPay,maxPay});
 assert.equal(r.found,true);
 assert.ok(r.achieved>=target);
 assert.equal(r.salary[field],r.achieved);
 for(let p=minPay;p<r.requiredPay;p++)assert.ok(calculateSalaryRemainder({...profile,pay:p})[field]<target);
 assert.equal(r.taxRulesVerified,false);
 }
});
test('unreachable target and invalid requests',()=>{
 const profile={country:'US',region:'TX',taxYear:'2026',scopeConfirmed:true};
 const input={profile,target:1000000,period:'annual',minPay:100,maxPay:110};
 assert.equal(reverseSalary(input).found,false);
 for(const change of [{target:NaN},{target:1.001},{period:'weekly'},{maxPay:20000},{minPay:-1},{profile:{...profile,pay:100}},{profile:{...profile,scopeConfirmed:false}}])assert.throws(()=>reverseSalary({...input,...change}));
});

test('automatic search finds exact UAE target without manual bounds',()=>{
 const profile={country:'AE',region:'AE',taxYear:'2026',scopeConfirmed:true,monthlyBasicSalary:16000};
 const r=automaticReverseSalary({profile,target:19994.75,period:'monthly'});
 assert.equal(r.requiredPay,20000);assert.equal(r.searchComplete,true);
});
test('automatic search distinguishes limit from impossibility',()=>{
 const profile={country:'US',region:'TX',taxYear:'2026',scopeConfirmed:true};
 const result=automaticReverseSalary({profile,target:180000,period:'annual'});
 assert.equal(result.searchComplete,true);assert.equal(result.found,true);
 assert.ok(result.achieved>=180000);
 assert.ok(calculateSalaryRemainder({...profile,pay:result.requiredPay-1}).annualRemainder<180000);
 assert.equal(automaticReverseSalary({profile,target:300000,period:'annual'}).searchComplete,true);
});

test('automatic Alberta search resolves previously incomplete target',()=>{
 const profile={country:'CA',region:'AB',taxYear:'2026',scopeConfirmed:true};
 const result=automaticReverseSalary({profile,target:100000,period:'annual'});
 assert.equal(result.found,true);assert.equal(result.searchComplete,true);
 assert.ok(result.achieved>=100000);
 assert.ok(calculateSalaryRemainder({...profile,pay:result.requiredPay-1}).annualRemainder<100000);
 assert.equal(automaticReverseSalary({profile,target:150000,period:'annual'}).found,false);
});
test('automatic search handles fixed UAE premiums at both tiers',()=>{
 for(const basic of [16000,16000.01]){
  const profile={country:'AE',region:'AE',taxYear:'2026',scopeConfirmed:true,monthlyBasicSalary:basic};
  const result=automaticReverseSalary({profile,target:900000,period:'monthly'});
  assert.equal(result.requiredPay,basic<=16000?900006:900011);
  assert.equal(result.searchComplete,true);
 }
});

for(const [country,region,pay,extras] of [
 ['GB','RUK',8333,{}],['GB','SCT',10476,{}],['AU','AU',350000,{}],
 ['SG','SG',8000,{}],['SG','SG',50000,{}],
 ['DE','DE',6450,{annualTaxableIncome:50000,healthSupplementRate:2.9}],
 ['AE','AE',900000,{monthlyBasicSalary:16000}]
])test('optimized automatic search '+region+' at '+pay,()=>{
 const profile={country,region,taxYear:'2026',scopeConfirmed:true,...extras};
 for(const period of ['monthly','annual']){
  const field=period==='monthly'?'averageMonthlyRemainder':'annualRemainder';
  const target=calculateSalaryRemainder({...profile,pay})[field];
  const result=automaticReverseSalary({profile,target,period});
  assert.equal(result.found,true);
  assert.equal(result.searchComplete,true);
  assert.ok(result.requiredPay<=pay);
  assert.ok(result.achieved>=target);
  assert.ok(calculateSalaryRemainder({...profile,pay:result.requiredPay-1})[field]<target);
 }
});

test('India validates fixed deductions at the lowest feasible salary',()=>{
 const profile={country:'IN',region:'IN',taxYear:'2026',scopeConfirmed:true,epfMonthlyWage:0,professionalTaxAnnual:2400};
 const result=automaticReverseSalary({profile,target:0,period:'annual'});
 assert.equal(result.requiredPay,2400);assert.equal(result.achieved,0);
 assert.equal(automaticReverseSalary({profile,target:100,period:'monthly'}).requiredPay,3600);
});
for(const [country,region,pay,extras] of [
 ['CA','AB',68900,{}],['CA','AB',74600,{}],['CA','AB',85000,{}],['CA','AB',118000,{}],['CA','AB',150000,{}],
 ['IN','IN',1275000,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',1275015,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',1350000,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',5075005,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',10075005,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',20075005,{epfMonthlyWage:15000,professionalTaxAnnual:2400}],
 ['IN','IN',50000000,{epfMonthlyWage:0,professionalTaxAnnual:0}]
])test('reverse salary handles rounded threshold and high income '+country+' '+pay,()=>{
 const profile={country,region,taxYear:'2026',scopeConfirmed:true,...extras};
 for(const period of ['annual','monthly']){
  const field=period==='annual'?'annualRemainder':'averageMonthlyRemainder';
  const target=calculateSalaryRemainder({...profile,pay})[field];
  const r=automaticReverseSalary({profile,target,period});
  assert.equal(r.found,true);assert.equal(r.searchComplete,true);
  assert.ok(r.requiredPay<=pay);assert.ok(r.achieved>=target);
  // Independently exhaust the 1000 whole units immediately preceding the result,
  // including earlier local maxima at the rebate and surcharge cliffs.
  const lower=Math.max(country==='CA'?60000:profile.epfMonthlyWage*12,r.requiredPay-1000);
  for(let p=lower;p<r.requiredPay;p++)assert.ok(calculateSalaryRemainder({...profile,pay:p})[field]<target,'Skipped '+p);
 }
});
