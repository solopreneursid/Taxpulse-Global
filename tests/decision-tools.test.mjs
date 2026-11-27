import test from 'node:test';
import assert from 'node:assert/strict';
import {indiaCtc,purchasingPower,relocationBreakEven,indiaDeductionScenario,businessBreakEven,indiaTaxCliffs,indiaTaxOpportunity,salaryCliffs,taxableIncomeOpportunity,financialRunway,standardIndirectTax,financialHealthSnapshot,scopedCorporateTax} from '../engine/decision-tools.mjs';
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

test('global salary cliff scan bounds and known smooth Texas wages',()=>{
 const profile={country:'US',region:'TX',taxYear:'2026',scopeConfirmed:true};
 const r=salaryCliffs({profile,startPay:100000,endPay:100020});assert.equal(r.examinedIncrements,20);assert.equal(r.cliffCount,0);assert.equal(r.taxRulesVerified,false);
 assert.throws(()=>salaryCliffs({profile,startPay:100000,endPay:101001}));assert.throws(()=>salaryCliffs({profile:{...profile,pay:100000},startPay:100000,endPay:100020}));
});
for(const [country,region,startPay,extra] of [['GB','RUK',4189,{}],['GB','SCT',3000,{}],['CA','AB',74600,{}],['AU','AU',135000,{}],['IN','IN',1275000,{epfMonthlyWage:0,professionalTaxAnnual:0}],['SG','SG',8000,{}],['DE','DE',5000,{annualTaxableIncome:50000,healthSupplementRate:2.9}],['AE','AE',20000,{monthlyBasicSalary:16000}]])test('scoped global cliff scan '+region,()=>{
 const r=salaryCliffs({profile:{country,region,taxYear:'2026',scopeConfirmed:true,...extra},startPay,endPay:startPay+10});assert.equal(r.examinedIncrements,10);assert.ok(r.steps.every(s=>s.annualNetChange<0));assert.equal(r.sampleOnly,true);
});
test('four-country assessed income opportunities separate taxes from cash cost',()=>{
 const base={country:'SG',beforeTaxable:80000,afterTaxable:40000,beforeNet:0,afterNet:0,assessment:'individual',incrementalCashCost:1000,scopeConfirmed:true};
 const r=taxableIncomeOpportunity(base);assert.equal(r.taxReduction,2800);assert.equal(r.cashEffect,1800);
 for(const country of ['CA','AU','DE'])assert.ok(taxableIncomeOpportunity({...base,country,...(country==='CA'?{beforeNet:80000,afterNet:40000}:{})}).taxReduction>=0);
 assert.throws(()=>taxableIncomeOpportunity({...base,scopeConfirmed:false}));assert.throws(()=>taxableIncomeOpportunity({...base,afterTaxable:90000}));assert.throws(()=>taxableIncomeOpportunity({...base,beforeNet:80000}));
});
test('cash runway respects reserve, exact whole-month arithmetic and unreachable goals',()=>{
 const base={currency:'INR',monthlyIncome:10000,monthlyExpenses:6000,liquidSavings:10000,reserveFloor:5000,goalAmount:15000,horizonMonths:12};
 const r=financialRunway(base);assert.equal(r.monthlyBalance,4000);assert.equal(r.monthsToGoal,3);assert.equal(r.projectedSavings,58000);assert.equal(r.wholeMonthsBeforeReserve,null);
 const deficit=financialRunway({...base,monthlyExpenses:12000});assert.equal(deficit.wholeMonthsBeforeReserve,2);assert.equal(deficit.monthsToGoal,null);assert.equal(deficit.projectedSavings,-14000);
 assert.throws(()=>financialRunway({...base,horizonMonths:0}));assert.throws(()=>financialRunway({...base,monthlyIncome:-1}));
});

for(const [country,tax] of [['GB',20],['DE',19],['AU',10],['SG',9],['AE',5],['CA',5]])test('standard-rated single-supply source fixture '+country,()=>{
 const input={country,priceBasis:'exclusive',amount:100,scopeConfirmed:true};
 const r=standardIndirectTax(input);assert.equal(r.taxAmount,tax);assert.equal(r.grossAmount,100+tax);assert.equal(r.taxRulesVerified,false);
 assert.equal(standardIndirectTax({...input,priceBasis:'inclusive',amount:100+tax}).netAmount,100);
 assert.equal(standardIndirectTax({...input,amount:0}).taxAmount,0);
 assert.throws(()=>standardIndirectTax({...input,scopeConfirmed:false}));
});
test('standard indirect tax rejects unsupported scope and rounds a single amount',()=>{
 const input={country:'GB',priceBasis:'exclusive',amount:0.03,scopeConfirmed:true};
 assert.equal(standardIndirectTax(input).taxAmount,0.01);
 assert.throws(()=>standardIndirectTax({...input,country:'IN'}));assert.throws(()=>standardIndirectTax({...input,amount:-1}));assert.throws(()=>standardIndirectTax({...input,amount:0.001}));assert.throws(()=>standardIndirectTax({...input,priceBasis:'other'}));
});

test('financial health combines a balance sheet with cash flow without double-counting debt payments',()=>{
 const base={currency:'INR',monthlyIncome:10000,monthlyExpenses:6000,liquidSavings:10000,otherAssets:40000,liabilities:20000,monthlyDebtPayments:2000,reserveFloor:5000,goalAmount:15000,horizonMonths:12};
 const r=financialHealthSnapshot(base);assert.equal(r.totalAssets,50000);assert.equal(r.netWorth,30000);assert.equal(r.monthlyBalance,4000);assert.equal(r.debtServicePercent,20);assert.equal(r.projectedLiquidSavings,58000);assert.equal(r.monthsToGoal,3);assert.equal(r.taxRulesVerified,false);
 assert.equal(financialHealthSnapshot({...base,monthlyIncome:0}).debtServicePercent,null);assert.equal(financialHealthSnapshot({...base,liabilities:60000}).netWorth,-10000);
 assert.throws(()=>financialHealthSnapshot({...base,monthlyDebtPayments:6001}));assert.throws(()=>financialHealthSnapshot({...base,otherAssets:-1}));
});

test('UK ordinary company tax small rate, marginal relief and main rate fixtures',()=>{
 const input={jurisdiction:'GB',scopeConfirmed:true,taxableProfit:50000};
 assert.equal(scopedCorporateTax(input).grossCorporateTax,9500);
 assert.equal(scopedCorporateTax({...input,taxableProfit:100000}).grossCorporateTax,22750);
 assert.equal(scopedCorporateTax({...input,taxableProfit:250000}).grossCorporateTax,62500);
 assert.equal(scopedCorporateTax({...input,taxableProfit:300000}).grossCorporateTax,75000);
});
test('UAE threshold and Australia confirmed company rate fixtures',()=>{
 const input={jurisdiction:'AE',scopeConfirmed:true,taxableProfit:375000};
 assert.equal(scopedCorporateTax(input).grossCorporateTax,0);
 assert.equal(scopedCorporateTax({...input,taxableProfit:375100}).grossCorporateTax,9);
 assert.equal(scopedCorporateTax({...input,taxableProfit:1000000}).grossCorporateTax,56250);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'AU-base',taxableProfit:100000}).grossCorporateTax,25000);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'AU-full',taxableProfit:100000}).grossCorporateTax,30000);
 assert.throws(()=>scopedCorporateTax({...input,scopeConfirmed:false}));assert.throws(()=>scopedCorporateTax({...input,jurisdiction:'IN'}));assert.throws(()=>scopedCorporateTax({...input,taxableProfit:-1}));
});

for(const [country,rate] of [['CA-ON',13],['CA-NS',14],['CA-NB',15],['CA-NL',15],['CA-PE',15]])test('CRA HST scope '+country,()=>{
 const input={country,priceBasis:'exclusive',amount:100,scopeConfirmed:true};assert.equal(standardIndirectTax(input).taxAmount,rate);assert.equal(standardIndirectTax({...input,priceBasis:'inclusive',amount:100+rate}).netAmount,100);
});
test('company tax components US Canada Germany and Singapore with explicitly confirmed scope',()=>{
 const input={scopeConfirmed:true,taxableProfit:100000};
 for(const [jurisdiction,expected] of [['US',21000],['CA-general',15000],['CA-small',9000],['DE',15000],['SG-PTE',8075],['SG-startup',4250]])assert.equal(scopedCorporateTax({...input,jurisdiction}).grossCorporateTax,expected);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'SG-PTE',taxableProfit:200000}).grossCorporateTax,16575);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'SG-startup',taxableProfit:200000}).grossCorporateTax,12750);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'SG-PTE',taxableProfit:10000}).grossCorporateTax,425);
 assert.equal(scopedCorporateTax({...input,jurisdiction:'SG-PTE',taxableProfit:0}).grossCorporateTax,0);
 assert.throws(()=>scopedCorporateTax({...input,jurisdiction:'CA-small',taxableProfit:500000.01}));
});
