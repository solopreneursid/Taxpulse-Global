import test from 'node:test';
import assert from 'node:assert/strict';
import {indiaCtc,purchasingPower,relocationBreakEven,indiaDeductionScenario,businessBreakEven,indiaTaxCliffs,indiaTaxOpportunity} from '../engine/decision-tools.mjs';
const ctc={annualCtc:1800000,employerContributions:100000,nonCashBenefits:200000,employeeContributions:21600,otherPayrollDeductions:2500,residentIndividual:true,ageGroup:'under-60',oldEligibleDeductions:0,newEligibleDeductions:0};
test('CTC cash component and tax reconciliation',()=>{
 const r=indiaCtc(ctc);assert.equal(r.annualGross,1500000);assert.equal(r.new.incomeTax,97500);assert.equal(r.new.annualCash,1378400);assert.equal(r.taxRulesVerified,false);
 assert.throws(()=>indiaCtc({...ctc,employerContributions:2000000}));assert.throws(()=>indiaCtc({...ctc,employeeContributions:-1}));assert.throws(()=>indiaCtc({...ctc,extra:1}));
});
test('national purchasing power is not nominal currency conversion',()=>{
 const x={firstCurrency:'INR',secondCurrency:'USD',firstMonthlyIncome:20000,secondMonthlyIncome:1200,firstFactor:20,secondFactor:1,referenceYear:2024};const r=purchasingPower(x);assert.equal(r.firstInternationalDollars,1000);assert.equal(r.difference,200);assert.throws(()=>purchasingPower({...x,firstFactor:0}));assert.throws(()=>purchasingPower({...x,referenceYear:2027}));assert.throws(()=>purchasingPower({...x,secondCurrency:'INR'}));
});
test('relocation break-even, negative savings and unreachable targets',()=>{
 const x={currency:'INR',currentMonthlySavings:50000,destinationMonthlySavings:70000,movingCost:110000};const r=relocationBreakEven(x);assert.equal(r.monthsToRecover,6);assert.equal(r.firstYearDifference,130000);assert.equal(relocationBreakEven({...x,destinationMonthlySavings:-1000}).monthsToRecover,null);assert.equal(relocationBreakEven({...x,movingCost:0}).monthsToRecover,0);
});
test('deductions comparison is independently computed under both regimes',()=>{
 const x={grossSalary:1500000,residentIndividual:true,ageGroup:'under-60',oldEligibleDeductions:0,newEligibleDeductions:0,extraOldEligibleDeductions:100000,extraNewEligibleDeductions:0};const r=indiaDeductionScenario(x);assert.ok(r.oldTaxReduction>0);assert.equal(r.newTaxReduction,0);assert.equal(r.taxRulesVerified,false);assert.throws(()=>indiaDeductionScenario({...x,extraOldEligibleDeductions:-1}));
});

test('business break-even and operating surplus reconcile in minor units',()=>{
 const i={currency:'INR',unitPrice:1000,unitVariableCost:400,monthlyFixedCosts:30000,monthlyUnits:80,targetMonthlySurplus:15000};
 const r=businessBreakEven(i);assert.equal(r.monthlyRevenue,80000);assert.equal(r.monthlyVariableCosts,32000);assert.equal(r.unitContribution,600);assert.equal(r.monthlyOperatingSurplus,18000);assert.equal(r.breakEvenUnits,50);assert.equal(r.targetUnits,75);assert.equal(r.targetGap,0);assert.equal(r.taxRulesVerified,false);
 assert.equal(businessBreakEven({...i,monthlyUnits:40}).targetGap,21000);
 assert.equal(businessBreakEven({...i,unitVariableCost:1000}).breakEvenUnits,null);
 assert.equal(businessBreakEven({...i,unitVariableCost:1200}).targetUnits,null);
 assert.equal(businessBreakEven({...i,monthlyFixedCosts:0,targetMonthlySurplus:0,unitVariableCost:1200}).breakEvenUnits,0);
 assert.equal(businessBreakEven({...i,currency:'USD',unitPrice:1.03,unitVariableCost:.33,monthlyFixedCosts:1,monthlyUnits:2,targetMonthlySurplus:0}).breakEvenUnits,2);
 for(const change of [{unitPrice:0},{unitVariableCost:-1},{monthlyUnits:1.5},{monthlyUnits:1e10},{unitPrice:0.001},{currency:'XYZ'},{extra:1}])assert.throws(()=>businessBreakEven({...i,...change}));
});

const indiaProfile={residentIndividual:true,ageGroup:'under-60',oldEligibleDeductions:0,newEligibleDeductions:0};
test('India cliff scan catches rounded rebate boundary',()=>{
 const i={...indiaProfile,startSalary:1275000,endSalary:1275020,regime:'new'};
 const r=indiaTaxCliffs(i);assert.equal(r.examinedIncrements,20);assert.ok(r.cliffCount>0);assert.equal(r.worstSalary,1275005);assert.equal(r.worstTaxJump,10);assert.equal(r.worstNetChange,-9);assert.equal(r.taxRulesVerified,false);
 assert.equal(indiaTaxCliffs({...i,startSalary:400000,endSalary:400010}).cliffCount,0);
 assert.throws(()=>indiaTaxCliffs({...i,endSalary:1277001}));assert.throws(()=>indiaTaxCliffs({...i,regime:'other'}));
});
test('India opportunity uses cost-adjusted tax savings not gross savings',()=>{
 const i={...indiaProfile,grossSalary:1500000,extraOldEligibleDeductions:100000,extraNewEligibleDeductions:0,incrementalCashCost:100000};
 const r=indiaTaxOpportunity(i);assert.ok(r.oldTaxReduction>0);assert.equal(r.oldCashEffect,r.oldTaxReduction-100000);assert.equal(r.newCashEffect,-100000);assert.equal(r.taxRulesVerified,false);
 assert.equal(indiaTaxOpportunity({...i,incrementalCashCost:0}).oldCashEffect,r.oldTaxReduction);assert.throws(()=>indiaTaxOpportunity({...i,incrementalCashCost:-1}));
});
