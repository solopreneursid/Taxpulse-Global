import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateSalaryRemainder,calculateRegionalTax,calculateEmployeeContributions,assessTaxableIncome,compareIndiaRegimes} from '../engine/taxable-income.mjs';
const annual=(country,region,pay)=>calculateSalaryRemainder({country,region,pay,taxYear:'2026',scopeConfirmed:true});
const regional=(country,region,income)=>calculateRegionalTax({country,region,income,taxYear:'2026',scopeConfirmed:true});
const contrib=(country,income,extra={})=>calculateEmployeeContributions({country,income,taxYear:'2026',scopeConfirmed:true,...extra});
const assess=(country,taxableIncome,extra={})=>assessTaxableIncome({country,taxableIncome,taxYear:'2026',...extra});
test('US SSA and IRS payroll maxima and additional Medicare boundary',()=>{const r=annual('US','TX',201000);assert.deepEqual(r.contributions.map(c=>c.amount),[11439,2914.5,9]);assert.equal(r.taxRulesVerified,false);});
test('GB HMRC category A upper monthly boundary',()=>{const a=annual('GB','RUK',4189),b=annual('GB','RUK',4289);assert.equal(a.employeeContributions,3015.36);assert.ok(Math.abs(b.employeeContributions-a.employeeContributions-24)<.001);});
test('CA PE annual tax is not prorated July payroll withholding',()=>{const a=regional('CA','PE',200000),b=regional('CA','PE',201000);assert.ok(Math.abs(b.regionalTax-a.regionalTax-200)<.001);assert.equal(a.taxRulesVerified,false);});
test('CA CRA CPP and EI published maxima',()=>{assert.deepEqual(contrib('CA',85000).components.map(c=>c.amount),[4230.45,416,1123.07]);});
test('AU 2026-27 resident rates and full Medicare levy are separate',()=>{assert.equal(assess('AU',135000,{residentEligible:true}).incomeTax,31020);assert.equal(contrib('AU',135000).totalEmployeeContribution,2700);});
test('SG IRAS resident gross tax and CPF age bands are distinct',()=>{assert.equal(assess('SG',1000000,{residentEligible:true}).incomeTax,199150);assert.equal(contrib('SG',8001,{ageBand:'56-60'}).totalEmployeeContribution,1440);});
test('DE statutory tariff at EUR 50,000 individual assessed income',()=>{assert.equal(assess('DE',50000,{assessment:'individual'}).incomeTax,10548);});
test('AE ILOE inclusive basic wage threshold plus 5 percent VAT',()=>{const input={country:'AE',region:'AE',taxYear:'2026',pay:20000,monthlyBasicSalary:16000,scopeConfirmed:true};assert.equal(calculateSalaryRemainder(input).employeeContributions,63);assert.equal(calculateSalaryRemainder({...input,monthlyBasicSalary:16000.01}).employeeContributions,126);});
test('IN TY 2026-27 ordinary salary rebate and marginal relief examples',()=>{const i={country:'IN',taxYear:'2026',grossSalary:1275000,residentIndividual:true,ageGroup:'under-60',ordinarySalaryOnly:true,oldEligibleDeductions:0,newEligibleDeductions:0};assert.equal(compareIndiaRegimes(i).newRegime.incomeTax,0);assert.equal(compareIndiaRegimes({...i,grossSalary:1285000}).newRegime.incomeTax,10400);});

 // Expected values derived from published schedules, not from TaxPulse output.
 test('US federal single tax at first two 2026 taxable band endpoints',()=>{
  for(const [gross,tax] of [[28500,1240],[66500,5800]])assert.equal(annual('US','TX',gross).incomeTax,tax);
 });
 test('GB category A primary and upper threshold rounding',()=>{
  for(const [monthly,ni] of [[1048,0],[1049,.96],[4189,3015.36],[4190,3015.60]])assert.equal(annual('GB','RUK',monthly).employeeContributions,ni);
 });
 test('Canada CPP first and second ceiling and EI cap',()=>{
  assert.deepEqual(contrib('CA',74600).components.map(c=>c.amount),[4230.45,0,1123.07]);
  assert.deepEqual(contrib('CA',75600).components.map(c=>c.amount),[4230.45,40,1123.07]);
 });
 test('Australia FY 2026-27 next two upper band amounts',()=>{
  assert.equal(assess('AU',190000,{residentEligible:true}).incomeTax,51370);
  assert.equal(assess('AU',200000,{residentEligible:true}).incomeTax,55870);
 });
 test('Singapore published cumulative resident gross tax',()=>{
  for(const [income,tax] of [[40000,550],[80000,3350],[120000,7950]])assert.equal(assess('SG',income,{residentEligible:true}).incomeTax,tax);
 });
 test('Germany 2026 tariff basic exemption and joint splitting',()=>{
  assert.equal(assess('DE',12348,{assessment:'individual'}).incomeTax,0);
  assert.equal(assess('DE',24696,{assessment:'joint'}).incomeTax,0);
  assert.equal(assess('DE',100000,{assessment:'joint'}).incomeTax,21096);
 });
 test('UAE annual ILOE premium on either side of inclusive basic salary boundary',()=>{
  for(const [basic,annualPremium] of [[15999.99,63],[16000,63],[16000.01,126]])assert.equal(calculateSalaryRemainder({country:'AE',region:'AE',taxYear:'2026',pay:20000,monthlyBasicSalary:basic,scopeConfirmed:true}).employeeContributions,annualPremium);
 });
 test('India 2026 ordinary salary bands at 16 and 24 lakh taxable income',()=>{
  const i={country:'IN',taxYear:'2026',residentIndividual:true,ageGroup:'under-60',ordinarySalaryOnly:true,oldEligibleDeductions:0,newEligibleDeductions:0};
  for(const [gross,tax] of [[1675000,124800],[2475000,312000]])assert.equal(compareIndiaRegimes({...i,grossSalary:gross}).newRegime.incomeTax,tax);
 });
