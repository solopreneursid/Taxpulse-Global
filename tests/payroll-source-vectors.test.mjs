import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateGermanEmployerSocialInsurance as de,calculateUaeFederalPension as ae,calculateAustraliaPaydaySuper as au} from '../engine/employer-payroll.mjs';

const german={country:'DE',taxYear:'2026',monthlyCoveredWage:5000,healthSupplementRate:2.9,scopeConfirmed:true};
const emirates={country:'AE',taxYear:'2026',monthlyContributionSalary:10000,scopeConfirmed:true};
const australia={country:'AU',taxYear:'2026',priorYearToDateQualifyingEarnings:187500,currentPayQualifyingEarnings:18750,scopeConfirmed:true};

test('DE employer shares and separate contribution ceilings',()=>{
 const a=de(german);
 assert.deepEqual([a.pension,a.unemployment,a.health,a.longTermCare,a.totalEmployerContribution],[465,65,437.5,90,1057.5]);
 const b=de({...german,monthlyCoveredWage:9000});
 assert.equal(b.pensionContributionBase,8450);
 assert.equal(b.healthContributionBase,5812.5);
 assert.deepEqual([b.pension,b.unemployment,b.health,b.longTermCare],[785.85,109.85,508.59,104.63]);
 assert.equal(b.totalEmployerContribution,1508.92);
});
test('AE private-sector contribution shares and strict subsidy boundary',()=>{
 const a=ae(emirates);
 assert.deepEqual([a.employeeContribution,a.employerContribution,a.governmentSupport,a.totalContribution],[1100,1250,250,2600]);
 const b=ae({...emirates,monthlyContributionSalary:20000});
 assert.deepEqual([b.employeeContribution,b.employerContribution,b.governmentSupport,b.totalContribution],[2200,3000,0,5200]);
 const c=ae({...emirates,monthlyContributionSalary:19999.99});
 assert.equal(c.governmentSupport,500);
 assert.equal(ae({...emirates,monthlyContributionSalary:70000}).totalContribution,18200);
});
test('AU reproduces ATO published Michael example and annual cap',()=>{
 const a=au(australia);
 assert.equal(a.employerSuperGuarantee,2250);
 const b=au({...australia,priorYearToDateQualifyingEarnings:206250,currentPayQualifyingEarnings:100000});
 assert.equal(b.currentPaySubjectToSuper,64580);
 assert.equal(b.employerSuperGuarantee,7749.6);
 assert.equal(b.yearToDateQualifyingEarningsForCap,270830);
 assert.equal(au({...australia,priorYearToDateQualifyingEarnings:306250}).employerSuperGuarantee,0);
 assert.equal(au({...australia,priorYearToDateQualifyingEarnings:270829.99,currentPayQualifyingEarnings:100}).currentPaySubjectToSuper,0.01);
});
test('all three reject unsupported periods, missing eligibility and malformed amounts',()=>{
 for(const [fn,input,key] of [[de,german,'monthlyCoveredWage'],[ae,emirates,'monthlyContributionSalary'],[au,australia,'currentPayQualifyingEarnings']]){
  for(const invalid of [{scopeConfirmed:false},{taxYear:'2027'},{country:'XX'},{[key]:-1},{[key]:1.001},{[key]:null},{[key]:Infinity},{extra:true}])assert.throws(()=>fn({...input,...invalid}));
  const result=fn(input);assert.equal(result.sampleOnly,true);assert.equal(result.taxRulesVerified,false);assert.ok(result.sourceUrls.length>=2);
 }
 assert.throws(()=>ae({...emirates,monthlyContributionSalary:2999.99}));
 assert.throws(()=>ae({...emirates,monthlyContributionSalary:70000.01}));
 assert.throws(()=>de({...german,healthSupplementRate:10.01}));
});
