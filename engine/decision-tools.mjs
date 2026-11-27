// Decision tools use explicit user-supplied assumptions; no statutory eligibility inferred.
import {compareIndiaRegimes,calculateSalaryRemainder,assessTaxableIncome} from './taxable-income.mjs';
import {calculateIndirectTax,calculateCorporateTaxComponent} from './business-tax.mjs';
import {calculateUsEmployerFica} from './employer-payroll.mjs';
import {calculateTreatyCreditComponent} from './treaty-credit.mjs';
const currencies=['INR','USD','GBP','CAD','AUD','EUR','SGD','AED'];
function exact(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))throw new TypeError('Unsupported input fields');}
function units(v,scale=100,max=1e9){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||Math.abs(v*scale-Math.round(v*scale))>0.00002)throw new RangeError('Invalid amount or precision');return BigInt(Math.round(v*scale));}
const out=n=>{if(n>100000000000000n||n< -100000000000000n)throw new RangeError('Result outside supported range');return Number(n)/100;};
const round=(n,d)=>n<0n?-round(-n,d):(n+d/2n)/d;
function currency(c){if(!currencies.includes(c))throw new RangeError('Unsupported currency');return c;}
function isoDate(value,label='Date'){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||
  !Number.isFinite(Date.parse(value+'T00:00:00.000Z'))||
  new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)!==value)
  throw new RangeError(label+' must be a valid ISO calendar date');
 return value;
}
function calendar2026(value,label='Transaction date'){
 const date=isoDate(value,label);
 if(date<'2026-01-01'||date>='2027-01-01')throw new RangeError(label+' must be in calendar 2026');
 return date;
}
function anniversaryClamped(value){
 const [year,month,day]=value.split('-').map(Number);
 const targetYear=year+1;
 const lastDay=new Date(Date.UTC(targetYear,month,0)).getUTCDate();
 return [targetYear,String(month).padStart(2,'0'),String(Math.min(day,lastDay)).padStart(2,'0')].join('-');
}
const sample={sampleOnly:true,taxRulesVerified:false};
export function indiaCtc(input,ruleContext={}){
 exact(input,['annualCtc','employerContributions','nonCashBenefits','employeeContributions','otherPayrollDeductions','residentIndividual','ageGroup','oldEligibleDeductions','newEligibleDeductions']);
 const whole=v=>{if(!Number.isSafeInteger(v)||v<0||v>1e9)throw new RangeError('Enter whole annual rupees');return BigInt(v);};
 const ctc=whole(input.annualCtc),employer=whole(input.employerContributions),benefits=whole(input.nonCashBenefits),employee=whole(input.employeeContributions),other=whole(input.otherPayrollDeductions);
 const gross=ctc-employer-benefits;if(gross<0n||employee+other>gross)throw new RangeError('Salary components exceed cash wages');
 const tax=compareIndiaRegimes({country:'IN',taxYear:'2026',grossSalary:Number(gross),residentIndividual:input.residentIndividual,ageGroup:input.ageGroup,ordinarySalaryOnly:true,oldEligibleDeductions:input.oldEligibleDeductions,newEligibleDeductions:input.newEligibleDeductions},ruleContext.indiaSalary);
 const regime=r=>{const net=(gross-employee-other)*100n-units(r.incomeTax);return {incomeTax:r.incomeTax,annualCash:out(net),monthlyCash:out(round(net,12n))};};
 return {...sample,currency:'INR',annualGross:Number(gross),annualEmployerContributions:Number(employer),annualNonCashBenefits:Number(benefits),annualEmployeeContributions:Number(employee),annualOtherPayrollDeductions:Number(other),old:regime(tax.oldRegime),new:regime(tax.newRegime),tax,warnings:['Use annual employer and employee amounts confirmed by the employer; do not double count noncash benefits or deductions. Assumes all remaining cash is ordinary taxable salary. No EPF, gratuity, professional tax, or eligibility is inferred. India EPFO wage-ceiling change effective 17 September 2026 requires independent review. Unverified example only.']};
}
export function purchasingPower(input){
 exact(input,['firstCurrency','secondCurrency','firstMonthlyIncome','secondMonthlyIncome','firstFactor','secondFactor','referenceYear']);
 currency(input.firstCurrency);currency(input.secondCurrency);if(input.firstCurrency===input.secondCurrency)throw new RangeError('Choose distinct currencies');
 if(!Number.isInteger(input.referenceYear)||input.referenceYear<1990||input.referenceYear>2026)throw new RangeError('Invalid reference year');
 const a=units(input.firstFactor,1000000,1e6),b=units(input.secondFactor,1000000,1e6);if(a===0n||b===0n)throw new RangeError('Factors must be positive');
 const x=round(units(input.firstMonthlyIncome)*1000000n,a),y=round(units(input.secondMonthlyIncome)*1000000n,b);
 return {...sample,firstInternationalDollars:out(x),secondInternationalDollars:out(y),difference:out(y-x),referenceYear:input.referenceYear,warnings:['User-entered national household-consumption PPP factors, local currency units per international dollar, from the same reference year. Not exchange rates, city prices, or spendable currency. No live data loaded.']};
}
export function relocationBreakEven(input){
 exact(input,['currency','currentMonthlySavings','destinationMonthlySavings','movingCost']);
 currency(input.currency);
 const signed=v=>v<0?-units(-v):units(v);
 const current=signed(input.currentMonthlySavings),destination=signed(input.destinationMonthlySavings),cost=units(input.movingCost),delta=destination-current;
 return {...sample,currency:input.currency,monthlyImprovement:out(delta),monthsToRecover:cost===0n?0:delta<=0n?null:Number((cost+delta-1n)/delta),firstYearDifference:out(delta*12n-cost),warnings:['Use monthly savings after taxes and living expenses, converted to the same currency. No future exchange-rate, inflation, investment, visa or cross-border tax assumptions.']};
}
export function indiaDeductionScenario(input,ruleContext={}){
 exact(input,['grossSalary','residentIndividual','ageGroup','oldEligibleDeductions','newEligibleDeductions','extraOldEligibleDeductions','extraNewEligibleDeductions']);
 const whole=v=>{if(!Number.isSafeInteger(v)||v<0||v>1e9)throw new RangeError('Enter whole annual rupees');return v;};
 const base={country:'IN',taxYear:'2026',grossSalary:whole(input.grossSalary),residentIndividual:input.residentIndividual,ageGroup:input.ageGroup,ordinarySalaryOnly:true,oldEligibleDeductions:whole(input.oldEligibleDeductions),newEligibleDeductions:whole(input.newEligibleDeductions)};
 const before=compareIndiaRegimes(base,ruleContext.indiaSalary),after=compareIndiaRegimes({...base,oldEligibleDeductions:whole(base.oldEligibleDeductions+whole(input.extraOldEligibleDeductions)),newEligibleDeductions:whole(base.newEligibleDeductions+whole(input.extraNewEligibleDeductions))},ruleContext.indiaSalary);
 return {...sample,currency:'INR',before,after,oldTaxReduction:before.oldRegime.incomeTax-after.oldRegime.incomeTax,newTaxReduction:before.newRegime.incomeTax-after.newRegime.incomeTax,warnings:['Only use deductions already confirmed eligible for each regime, excluding the standard deduction. A tax reduction is not a net financial benefit; the underlying expenditure may cost more. No deduction eligibility or regime recommendation is inferred.']};
}

/** Single-product monthly contribution-margin and break-even scenario. No tax assumptions. */
export function businessBreakEven(input){
 exact(input,['currency','unitPrice','unitVariableCost','monthlyFixedCosts','monthlyUnits','targetMonthlySurplus']);
 currency(input.currency);
 const price=units(input.unitPrice),variable=units(input.unitVariableCost),fixed=units(input.monthlyFixedCosts),target=units(input.targetMonthlySurplus);
 if(!Number.isSafeInteger(input.monthlyUnits)||input.monthlyUnits<0||input.monthlyUnits>1000000000)throw new RangeError('Enter whole monthly sales units');
 if(price===0n)throw new RangeError('Sale price must be positive');
 const sold=BigInt(input.monthlyUnits),margin=price-variable,revenue=price*sold,variableTotal=variable*sold;
 const surplus=revenue-variableTotal-fixed;
 const required=need=>need===0n?0:margin<=0n?null:(need+margin-1n)/margin;
 const asUnits=v=>{if(v===null)return null;if(v>1000000000000n)throw new RangeError('Required sales outside supported range');return Number(v);};
 return {...sample,currency:input.currency,monthlyRevenue:out(revenue),monthlyVariableCosts:out(variableTotal),monthlyFixedCosts:out(fixed),unitContribution:out(margin),monthlyOperatingSurplus:out(surplus),breakEvenUnits:asUnits(required(fixed)),targetUnits:asUnits(required(fixed+target)),targetGap:out(surplus>=target?0n:target-surplus),warnings:['Single product or billable service unit, constant net selling price and variable cost, and fixed monthly operating costs. Enter prices and costs excluding recoverable sales tax. No automatic income tax, VAT/GST, payroll, inventory, debt, working capital or cash-collection timing. Operating surplus is not net income or cash flow.']};
}

export function indiaTaxCliffs(input,ruleContext={}){
 exact(input,['startSalary','endSalary','residentIndividual','ageGroup','oldEligibleDeductions','newEligibleDeductions','regime']);
 const {startSalary,endSalary,regime}=input;
 if(!Number.isSafeInteger(startSalary)||!Number.isSafeInteger(endSalary)||startSalary<0||endSalary>1e9||endSalary<=startSalary||endSalary-startSalary>2000||!['old','new'].includes(regime))throw new RangeError('Choose a whole-rupee interval of 1–2,000 increments');
 const base={country:'IN',taxYear:'2026',residentIndividual:input.residentIndividual,ageGroup:input.ageGroup,ordinarySalaryOnly:true,oldEligibleDeductions:input.oldEligibleDeductions,newEligibleDeductions:input.newEligibleDeductions};
 const taxAt=grossSalary=>compareIndiaRegimes({...base,grossSalary},ruleContext.indiaSalary)[regime+'Regime'].incomeTax;
 let prior=taxAt(startSalary),startTax=prior,cliffCount=0,worstTaxJump=0,worstSalary=null,worstNetChange=0;
 const cliffs=[];
 for(let gross=startSalary+1;gross<=endSalary;gross++){
  const tax=taxAt(gross),jump=tax-prior;
  if(jump>1){cliffCount++;if(cliffs.length<50)cliffs.push({grossSalary:gross,previousTax:prior,incomeTax:tax,taxIncrease:jump,netChange:1-jump});if(jump>worstTaxJump){worstTaxJump=jump;worstSalary=gross;worstNetChange=1-jump;}}
  prior=tax;
 }
 return {...sample,currency:'INR',startSalary,endSalary,regime,startTax,endTax:prior,cliffCount,worstTaxJump,worstSalary,worstNetChange,cliffs,truncated:cliffCount>cliffs.length,examinedIncrements:endSalary-startSalary,warnings:['Exhaustive whole-rupee scan of the selected India ordinary-salary interval only. A cliff means income tax rises by more than the one-rupee gross increase, including statutory rounding; a rounding cliff is not necessarily a policy discontinuity. Excludes payroll, benefits, special income, eligibility changes and salary outside this interval.']};
}
export function indiaTaxOpportunity(input,ruleContext={}){
 exact(input,['grossSalary','residentIndividual','ageGroup','oldEligibleDeductions','newEligibleDeductions','extraOldEligibleDeductions','extraNewEligibleDeductions','incrementalCashCost']);
 const {incrementalCashCost,...scenario}=input;
 const cost=units(incrementalCashCost),r=indiaDeductionScenario(scenario,ruleContext);
 const oldTax=units(r.oldTaxReduction),newTax=units(r.newTaxReduction);
 return {...sample,currency:'INR',oldTaxReduction:r.oldTaxReduction,newTaxReduction:r.newTaxReduction,incrementalCashCost:out(cost),oldCashEffect:out(oldTax-cost),newCashEffect:out(newTax-cost),before:r.before,after:r.after,warnings:['Enter only additional deductions already confirmed eligible for each regime. Incremental cash cost is the extra outlay needed to obtain those deductions; use zero for a qualifying expense already incurred. Cash effect means tax reduction minus additional cash outlay, not investment return, total wealth change or advice. No eligibility, contribution limits or future benefits are inferred.']};
}

/** Adjacent whole-unit pay scan using an unchanged, explicitly confirmed salary profile. */
export function salaryCliffs(input,ruleContext={}){
 exact(input,['profile','startPay','endPay']);
 const {profile,startPay,endPay}=input;
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.hasOwn(profile,'pay')||profile.scopeConfirmed!==true||!Number.isSafeInteger(startPay)||!Number.isSafeInteger(endPay)||startPay<0||endPay>1e9||endPay<=startPay||endPay-startPay>1000)throw new RangeError('Confirm profile and choose 1–1,000 whole-unit increments');
 const at=pay=>calculateSalaryRemainder({...profile,pay},ruleContext);
 let previous=at(startPay);at(endPay);
 const initial=previous,steps=[];let count=0,worst=null;
 for(let pay=startPay+1;pay<=endPay;pay++){
  const current=at(pay),grossDelta=units(current.annualGross,100,12e9)-units(previous.annualGross,100,12e9);
  const taxDelta=units(current.totalModeledDeductions,100,12e9)-units(previous.totalModeledDeductions,100,12e9);
  if(taxDelta>grossDelta){const step={pay,annualGrossIncrease:out(grossDelta),annualDeductionIncrease:out(taxDelta),annualNetChange:out(grossDelta-taxDelta)};count++;if(steps.length<50)steps.push(step);if(!worst||step.annualNetChange<worst.annualNetChange)worst=step;}
  previous=current;
 }
 return {...sample,currency:initial.currency,payFrequency:initial.payFrequency,startPay,endPay,examinedIncrements:endPay-startPay,cliffCount:count,worst,steps,truncated:count>steps.length,firstAnnualRemainder:initial.annualRemainder,lastAnnualRemainder:previous.annualRemainder,warnings:['Scans only the specified whole-unit interval using the same confirmed salary assumptions for each step. Annualized taxes and modeled employee contributions only. Rounding can cause small downward steps. Other eligibility, benefits, assessed income, basic salary and wage-base changes are not inferred. No claim outside this interval.']};
}
/** Compare user-confirmed taxable income scenarios; not a deduction eligibility engine. */
export function taxableIncomeOpportunity(input,ruleContext={}){
 exact(input,['country','beforeTaxable','afterTaxable','beforeNet','afterNet','assessment','incrementalCashCost','scopeConfirmed']);
 if(input.scopeConfirmed!==true||!['CA','AU','DE','SG'].includes(input.country)||!['individual','joint'].includes(input.assessment))throw Error('Confirm supported assessment');
 const before=units(input.beforeTaxable),after=units(input.afterTaxable),cost=units(input.incrementalCashCost);
 if(after>before)throw Error('Revised taxable income must not exceed baseline');
 const ca=input.country==='CA',de=input.country==='DE';
 if(!de&&input.assessment!=='individual')throw Error('Joint assessment only supported for Germany');
 if(ca){if(units(input.afterNet)>units(input.beforeNet))throw Error('Revised net income must not exceed baseline');}
 else if(input.beforeNet!==0||input.afterNet!==0)throw Error('Net income fields are Canada-only');
 const assess=(taxableIncome,netIncome)=>assessTaxableIncome({country:input.country,taxYear:'2026',taxableIncome,...(ca?{netIncome,fullYearResident:true}:de?{assessment:input.assessment}:{residentEligible:true})},ruleContext);
 const first=assess(input.beforeTaxable,input.beforeNet),second=assess(input.afterTaxable,input.afterNet),reduction=units(first.incomeTax)-units(second.incomeTax);
 return {...sample,currency:first.currency,beforeTax:first.incomeTax,afterTax:second.incomeTax,taxReduction:out(reduction),incrementalCashCost:out(cost),cashEffect:out(reduction-cost),sourceUrls:first.sourceUrls,warnings:[...first.warnings,'Only compare already-confirmed assessed amounts. Tax reduction minus incremental cash cost is not investment return or eligibility advice. Canada is federal only; Germany ordinary tariff only; Australia excludes Medicare and Singapore excludes rebates.']};
}
/** Deterministic cash planning, with a reserve floor, no speculative investment return. */
export function financialRunway(input){
 exact(input,['currency','monthlyIncome','monthlyExpenses','liquidSavings','reserveFloor','goalAmount','horizonMonths']);
 currency(input.currency);
 const income=units(input.monthlyIncome),expenses=units(input.monthlyExpenses),savings=units(input.liquidSavings),reserve=units(input.reserveFloor),goal=units(input.goalAmount);
 if(!Number.isSafeInteger(input.horizonMonths)||input.horizonMonths<1||input.horizonMonths>600)throw Error('Choose a 1–600 month horizon');
 const balance=income-expenses,available=savings>reserve?savings-reserve:0n,needed=reserve+goal;
 const monthsToGoal=savings>=needed?0:balance<=0n?null:Number((needed-savings+balance-1n)/balance);
 const runway=savings<reserve?0:balance<0n?Number(available/(-balance)):null;
 return {...sample,currency:input.currency,monthlyBalance:out(balance),availableAboveReserve:out(available),projectedSavings:out(savings+balance*BigInt(input.horizonMonths)),monthsToGoal,wholeMonthsBeforeReserve:runway,goalGapNow:out(needed>savings?needed-savings:0n),warnings:['Constant monthly income and costs. Goal is in addition to the selected reserve. A starting balance below the protected reserve is an immediate breach even when monthly cash flow is positive. Negative projected savings means a modeled funding shortfall, not available credit. No interest, inflation, investment return, taxes, debt restructuring or emergency costs are inferred.']};
}

/**
 * Deterministic income/expense shock against a constant-cash-flow baseline.
 * Shock months are inclusive; the original assumptions resume automatically
 * after the shock. This is a sensitivity analysis, not a forecast.
 */
const scenarioOut=n=>{if(n>9007199254740991n||n< -9007199254740991n)throw new RangeError('Scenario result exceeds exact numeric range');return Number(n)/100;};
export function cashFlowStressScenario(input){
 exact(input,['currency','monthlyIncome','monthlyExpenses','liquidSavings','reserveFloor','horizonMonths','incomeReductionPercent','expenseIncreasePercent','shockStartMonth','shockDurationMonths']);
 currency(input.currency);
 const income=units(input.monthlyIncome),expenses=units(input.monthlyExpenses),savings=units(input.liquidSavings),reserve=units(input.reserveFloor);
 const incomeReduction=units(input.incomeReductionPercent,100,100),expenseIncrease=units(input.expenseIncreasePercent,100,500);
 if(!Number.isSafeInteger(input.horizonMonths)||input.horizonMonths<1||input.horizonMonths>600)throw RangeError('Choose a 1–600 month horizon');
 if(!Number.isSafeInteger(input.shockStartMonth)||input.shockStartMonth<1||input.shockStartMonth>input.horizonMonths)throw RangeError('Shock start must be within the planning horizon');
 if(!Number.isSafeInteger(input.shockDurationMonths)||input.shockDurationMonths<1||input.shockDurationMonths>input.horizonMonths-input.shockStartMonth+1)throw RangeError('Shock duration must fit within the planning horizon');
 const shockEnd=input.shockStartMonth+input.shockDurationMonths-1;
 const simulate=stressed=>{
  let balance=savings,minimum=savings,totalIncome=0n,totalExpenses=0n,firstReserveBreachMonth=savings<reserve?0:null,firstNegativeMonth=null,reserveRestoredMonth=null,monthsBelowReserve=0;
  for(let month=1;month<=input.horizonMonths;month++){
   const shock=stressed&&month>=input.shockStartMonth&&month<=shockEnd;
   const received=shock?round(income*(10000n-incomeReduction),10000n):income;
   const spent=shock?round(expenses*(10000n+expenseIncrease),10000n):expenses;
   balance+=received-spent;totalIncome+=received;totalExpenses+=spent;
   if(balance<minimum)minimum=balance;
   if(balance<reserve){monthsBelowReserve++;if(firstReserveBreachMonth===null)firstReserveBreachMonth=month;}
   if(balance<0n&&firstNegativeMonth===null)firstNegativeMonth=month;
   if(stressed&&month>shockEnd&&firstReserveBreachMonth!==null&&reserveRestoredMonth===null&&balance>=reserve)reserveRestoredMonth=month;
   scenarioOut(balance);scenarioOut(totalIncome);scenarioOut(totalExpenses);
  }
  return {summary:{endingLiquidSavings:scenarioOut(balance),minimumLiquidSavings:scenarioOut(minimum),totalIncome:scenarioOut(totalIncome),totalExpenses:scenarioOut(totalExpenses),netCashFlow:scenarioOut(totalIncome-totalExpenses),firstReserveBreachMonth,monthsBelowReserve,firstNegativeMonth,reserveRestoredMonth},endingMinor:balance,minimumMinor:minimum};
 };
 const baseline=simulate(false),stress=simulate(true);
 return {...sample,currency:input.currency,horizonMonths:input.horizonMonths,shock:{startMonth:input.shockStartMonth,endMonth:shockEnd,durationMonths:input.shockDurationMonths,incomeReductionPercent:input.incomeReductionPercent,expenseIncreasePercent:input.expenseIncreasePercent},baseline:baseline.summary,stress:stress.summary,endingSavingsImpact:scenarioOut(stress.endingMinor-baseline.endingMinor),minimumSavingsImpact:scenarioOut(stress.minimumMinor-baseline.minimumMinor),warnings:['A deterministic cash-flow sensitivity using user-entered after-tax income and total expenses. The shock applies only during the inclusive months shown; baseline assumptions resume afterward. Balances are sampled at month-end; intra-month payment timing and daily liquidity are not modeled. Expenses must include debt payments to avoid double counting. No tax recalculation, credit access, borrowing, inflation, interest, investment return, insurance, emergency reimbursement or probability is inferred. A reserve breach is a planning signal, not a solvency or lending assessment.']};
}


/** Versioned 2026 standard-rate component; caller confirms registration and classification. */
export function standardIndirectTax(input){
 exact(input,['country','priceBasis','amount','transactionDate','scopeConfirmed']);
 if(input.scopeConfirmed!==true)throw Error('Confirm registered seller, place of supply, standard-rate classification and date');
 const jurisdiction=input.country==='CA'?'CA-AB':input.country;
 const country=jurisdiction.startsWith('CA-')?'CA':jurisdiction.startsWith('US-')?'US':jurisdiction;
 const result=calculateIndirectTax({
  country,jurisdiction,taxYear:'2026',transactionDate:input.transactionDate,
  amount:input.amount,mode:input.priceBasis,sellerRegistered:true,
  standardRatedSupply:true,scopeConfirmed:true
 });
 return {...sample,currency:result.currency,ratePercent:result.rate*100,
  netAmount:result.taxableAmount,taxAmount:result.taxAmount,grossAmount:result.grossAmount,
  scope:result.warnings[0],sourceUrls:result.sourceUrls,sourceReviewedOn:'2026-11-27',
  warnings:result.warnings};
}

/** Integrated snapshot; user-entered balances and cash flows, no estimated asset valuations. */
export function financialHealthSnapshot(input){
 exact(input,['currency','monthlyIncome','monthlyExpenses','liquidSavings','otherAssets','liabilities','monthlyDebtPayments','reserveFloor','goalAmount','horizonMonths']);
 const {otherAssets,liabilities,monthlyDebtPayments,...plan}=input;
 const liquid=units(input.liquidSavings),assets=liquid+units(otherAssets),debt=units(liabilities),payments=units(monthlyDebtPayments),expenses=units(input.monthlyExpenses),income=units(input.monthlyIncome);
 if(payments>expenses)throw Error('Monthly debt payments must already be included in monthly expenses');
 const runway=financialRunway(plan);
 return {...sample,currency:input.currency,totalAssets:out(assets),liabilities:out(debt),netWorth:out(assets-debt),monthlyDebtPayments:out(payments),debtServicePercent:income===0n?null:Number(round(payments*10000n,income))/100,monthlyBalance:runway.monthlyBalance,projectedLiquidSavings:runway.projectedSavings,monthsToGoal:runway.monthsToGoal,wholeMonthsBeforeReserve:runway.wholeMonthsBeforeReserve,warnings:[...runway.warnings,'Snapshot of user-entered balances only. Other assets exclude liquid savings. Monthly expenses include debt payments; do not count them twice. Debt-service percentage is based on after-tax cash income, not lender underwriting. Asset and debt balances are not projected, and no credit rating, solvency assessment or recommendation is inferred.']};
}

/** Ordinary company-tax rate calculation on an already established taxable profit. */
export function scopedCorporateTax(input){
 exact(input,['jurisdiction','taxableProfit','scopeConfirmed']);
 if(input.scopeConfirmed!==true||!['GB','AE','AU-base','AU-full','US','CA-general','CA-small','DE','SG-PTE','SG-startup','IN-115BAA'].includes(input.jurisdiction))throw Error('Confirm ordinary company scope');
 if(['US','CA-general','CA-small','DE','SG-PTE','SG-startup'].includes(input.jurisdiction)){
  const country=input.jurisdiction.startsWith('CA-')?'CA':
    input.jurisdiction.startsWith('SG-')?'SG':input.jurisdiction;
  const profit=units(input.taxableProfit);
  if(input.jurisdiction==='CA-small'&&profit>50000000n)throw Error('Confirmed eligible profit cannot exceed CAD 500,000 in this example');
  const parameters=country==='CA'
    ? {eligibleSmallBusinessProfit:input.jurisdiction==='CA-small'?input.taxableProfit:0,
       smallBusinessEligibilityConfirmed:input.jurisdiction==='CA-small'}
    : country==='SG'
      ? {reliefScheme:input.jurisdiction==='SG-PTE'?'partial':'startup',
         reliefEligibilityConfirmed:true}
      : {};
  const component=calculateCorporateTaxComponent({
    country,taxYear:'2026',taxableProfit:input.taxableProfit,
    scopeConfirmed:true,...parameters
  });
  const tax=units(component.corporateIncomeTaxComponent);
  const taxPeriod=country==='SG'?'YA 2026 (basis period ordinarily 2025)':
    country==='DE'?'Assessment year 2026':'Calendar year 2026';
  return {...sample,currency:component.currency,taxableProfit:component.taxableProfit,
    grossCorporateTax:component.corporateIncomeTaxComponent,
    profitAfterModeledTax:out(profit-tax),
    effectiveRatePercent:profit===0n?0:Number(round(tax*10000n,profit))/100,
    sourceUrls:component.sourceUrls,sourceReviewedOn:'2026-11-27',
    taxPeriod,scope:component.warnings[0],warnings:component.warnings};
 }
 const p=units(input.taxableProfit);let numerator,currency,source,scope,period;
 if(input.jurisdiction==='GB'){
  currency='GBP';source='https://www.gov.uk/guidance/corporation-tax-marginal-relief';period='1 April 2026 to 31 March 2027';
  scope='UK resident ordinary non-ring-fence trading company, full aligned accounting year, no associated companies, no exempt distributions, augmented profits equal taxable profits, eligible for small profits rate and marginal relief.';
  numerator=p<=5000000n?p*1900n:p>=25000000n?p*2500n:p*2500n-(25000000n-p)*150n;
 }else if(input.jurisdiction==='AE'){
  currency='AED';source='https://mof.gov.ae/en/news/ministry-of-finance-confirms-applicable-taxable-income-threshold-for-corporate-tax-abu-dhabi-uae/';period='Calendar year 2026';
  scope='UAE ordinary resident juridical person, full calendar-year tax period; not exempt, free-zone, multinational minimum-tax or small-business relief case.';
  numerator=(p>37500000n?p-37500000n:0n)*900n;
 }else if(input.jurisdiction==='IN-115BAA'){
  currency='INR';source='https://www.incometax.gov.in/iec/foportal/help/company/return-applicable';period='FY 2025–26 / AY 2026–27 (historical)';
  if(p%1000n!==0n)throw Error('Enter taxable income already rounded to a multiple of INR 10');
  scope='Domestic company with valid section 115BAA election, entire rounded total income subject to ordinary 22% rate; 10% surcharge and 4% cess, no MAT. Excludes special-rate income, credit, interest, and filing adjustments.';
  numerator=p*25168n;
 }else if(input.jurisdiction==='US'){
  currency='USD';source='https://www.irs.gov/instructions/i1120';period='Calendar year 2026';
  scope='US domestic ordinary C corporation, regular federal income tax only; excludes state and local taxes, corporate alternative minimum tax, credits, special taxes and adjustments.';
  numerator=p*2100n;
 }else if(input.jurisdiction.startsWith('CA-')){
  currency='CAD';source='https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-tax-rates.html';period='Calendar year 2026';
  const small=input.jurisdiction==='CA-small';
  if(small&&p>50000000n)throw Error('Confirmed eligible profit cannot exceed CAD 500,000 in this example');
  scope='Canada federal component only; full-year Canadian business income, '+(small?'all input profit confirmed eligible for the small business deduction within the actual allocated limit':'all input profit confirmed subject to the general federal rate reduction')+'. Excludes provincial tax, special sectors, refundable tax, and other credits.';
  numerator=p*(small?900n:1500n);
 }else if(input.jurisdiction==='DE'){
  currency='EUR';source='https://www.gesetze-im-internet.de/kstg_1977/__23.html';period='Assessment year 2026';
  scope='Germany ordinary corporation subject to the 15% corporate income tax component only. Excludes solidarity surcharge, municipal trade tax, credits and other liabilities.';
  numerator=p*1500n;
 }else if(input.jurisdiction.startsWith('SG-')){
  currency='SGD';source='https://www.iras.gov.sg/taxes/corporate-income-tax/basics-of-corporate-income-tax/corporate-income-tax-rate-rebates-and-tax-exemption-schemes';period='YA 2026 (basis period ordinarily 2025)';
  const startup=input.jurisdiction==='SG-startup',firstLimit=startup?10000000n:1000000n,cap=20000000n;
  const first=p<firstLimit?p:firstLimit,second=p<=firstLimit?0n:(p<cap?p:cap)-firstLimit;
  scope='Singapore normal chargeable income before '+(startup?'confirmed eligible start-up exemption':'partial tax exemption')+'; gross 17% calculation after exemption but before YA 2026 corporate income tax rebate, cash grants, credits and other relief.';
  numerator=(p*4n-first*3n-second*2n)*1700n;
 }else{
  currency='AUD';source='https://www.ato.gov.au/tax-rates-and-codes/company-tax-rate-changes';period='1 July 2026 to 30 June 2027';
  scope='Australian ordinary resident company, confirmed '+(input.jurisdiction==='AU-base'?'base rate entity eligible for 25%':'not a base rate entity, full 30% rate')+', full aligned income year, no special entity rates.';
  numerator=p*(input.jurisdiction==='AU-base'?2500n:3000n);
 }
 const tax=input.jurisdiction==='IN-115BAA'?round(numerator,100000000n)*1000n:round(numerator,input.jurisdiction.startsWith('SG-')?40000n:10000n);
 return {...sample,currency,taxableProfit:out(p),grossCorporateTax:out(tax),profitAfterModeledTax:out(p-tax),effectiveRatePercent:p===0n?0:Number(round(tax*10000n,p))/100,sourceUrls:[source],sourceReviewedOn:['GB','AE','AU-base','AU-full'].includes(input.jurisdiction)?'2026-11-26':'2026-11-27',taxPeriod:period,scope,warnings:[scope+' '+period+'. Taxable profit must already be independently established, not turnover or accounting profit. Gross modeled rate calculation before other credits, offsets, reliefs, adjustments, withholding, dividend taxes or filing-specific rounding. No eligibility, accounting adjustments, associated-company count, free-zone status or tax residence inferred. No filing or statutory approval.']};
}

/** England and Northern Ireland, one ordinary freehold residential purchase. */
export function residentialSdlt(input){
 exact(input,['consideration','buyerScope','transactionDate','scopeConfirmed']);
 const transactionDate=calendar2026(input.transactionDate);
 if(input.scopeConfirmed!==true||!['ordinary','first-time'].includes(input.buyerScope)||!Number.isSafeInteger(input.consideration)||input.consideration<0||input.consideration>1e9)throw Error('Confirm scope and whole-pound chargeable consideration');
 const p=BigInt(input.consideration);
 let numerator=0n;
 const first=input.buyerScope==='first-time'&&p<=500000n;
 if(first)numerator=(p>300000n?p-300000n:0n)*5n;
 else {
  let lower=0n;for(const [upper,rate] of [[125000n,0n],[250000n,2n],[925000n,5n],[1500000n,10n],[1000000000n,12n]]){
   const taxable=p<=lower?0n:(p<upper?p:upper)-lower;numerator+=taxable*rate;lower=upper;
  }
 }
 const tax=numerator/100n;
 return {...sample,currency:'GBP',consideration:Number(p),transactionDate,ruleEffectiveFrom:'2025-04-01',stampDuty:Number(tax),priceAndDuty:Number(p+tax),firstTimeReliefApplied:first,sourceUrls:['https://www.gov.uk/stamp-duty-land-tax/residential-property-rates','https://www.gov.uk/hmrc-internal-manuals/stamp-duty-land-tax-manual/sdltm00050'],sourceReviewedOn:'2026-11-27',warnings:['England or Northern Ireland, ordinary individual UK-resident buyer(s) for SDLT, one unlinked freehold residential transaction, no higher rates or other reliefs. Rates for transactions from 1 April 2025, cross-checked 27 November 2026. First-time option assumes all purchasers meet the relief conditions including main residence intention; above GBP 500,000 ordinary bands apply. Tax rounded down to whole pounds. Excludes lease rent, linked transactions, companies, additional dwellings, non-resident surcharge, Scotland, Wales and fees.']};
}
/** A single income item, UK-side treaty credit cap, with eligibility already established. */
export function ukIndiaCredit(input){
 exact(input,['foreignTaxPaidGbp','treatyEligibleCapGbp','ukTaxWithIncome','ukTaxWithoutIncome','scopeConfirmed']);
 if(input.scopeConfirmed!==true)throw Error('Confirm UK residence, Indian source and eligible taxes');
 const paid=units(input.foreignTaxPaidGbp),cap=units(input.treatyEligibleCapGbp),withIncome=units(input.ukTaxWithIncome),without=units(input.ukTaxWithoutIncome);
 if(without>withIncome)throw Error('UK tax without income must not exceed tax with income');
 const attributable=withIncome-without,credit=[paid,cap,attributable].reduce((a,b)=>a<b?a:b);
 return {...sample,currency:'GBP',ukTaxOnItem:out(attributable),modeledCredit:out(credit),ukTaxAfterCredit:out(withIncome-credit),foreignTaxNotCredited:out(paid-credit),combinedTax:out(withIncome-credit+paid),sourceUrls:['https://www.gov.uk/government/publications/india-tax-treaties/2020-uk-india-synthesised-text-of-the-multilateral-instrument-and-the-1993-double-taxation-convention-in-force','https://www.gov.uk/government/publications/calculating-foreign-tax-credit-relief-on-income-hs263-self-assessment-helpsheet/relief-for-foreign-tax-paid-2026-hs263'],sourceReviewedOn:'2026-11-27',warnings:['UK-side Article 24 credit-cap example for one ordinary Indian-source income item, UK tax year 2025–26, following HMRC HS263 2026. All figures already established in GBP using applicable conversion rules. No residence, treaty rate, treaty eligibility, income sourcing, refundable foreign tax, relief election, ordering of multiple sources, dividends, capital gains, or tax-sparing rules inferred. Credit is limited to paid tax, confirmed treaty-permitted amount and UK liability attributable to this item. Not a claim or filing determination.']};
}
/** Fixed nominal monthly amortization, integer minor units, bounded horizon. */
export function debtRepayment(input){
 exact(input,['currency','principal','annualRatePercent','monthlyPayment','extraPayment','horizonMonths']);
 currency(input.currency);
 const principal=units(input.principal),rate=units(input.annualRatePercent,100,100),payment=units(input.monthlyPayment),extra=units(input.extraPayment);
 if(principal<=0n||payment<=0n||!Number.isSafeInteger(input.horizonMonths)||input.horizonMonths<1||input.horizonMonths>600)throw Error('Choose positive debt, payment and 1–600 months');
 const monthlyInterest=b=>round(b*rate,120000n);
 const simulate=limit=>{
  let balance=principal,interest=0n,total=0n,months=0,reason=null;const schedule=[];
  while(balance>0n&&months<input.horizonMonths){
   const charge=monthlyInterest(balance);
   if(limit<=charge){reason='payment-does-not-reduce-principal';break;}
   const due=balance+charge,paid=limit<due?limit:due;balance=due-paid;interest+=charge;total+=paid;months++;
   schedule.push({month:months,payment:out(paid),interest:out(charge),principalRepaid:out(paid-charge),remaining:out(balance)});
  }
  return {status:balance===0n?'paid':reason||'horizon-ended',payoffMonths:balance===0n?months:null,monthsModeled:months,interest:out(interest),totalPaid:out(total),remaining:out(balance),schedule};
 };
 const base=simulate(payment),accelerated=simulate(payment+extra),both=base.status==='paid'&&accelerated.status==='paid';
 return {...sample,currency:input.currency,base,accelerated,interestSaved:both?out(units(base.interest,100,1e12)-units(accelerated.interest,100,1e12)):null,monthsSaved:both?base.payoffMonths-accelerated.payoffMonths:null,warnings:['Fixed nominal annual interest divided into 12 monthly periods; monthly interest rounded to nearest minor unit, payment at period end. No fees, rate changes, penalty, daily accrual, new borrowing or lender-specific rounding. If payment does not reduce principal the schedule stops before that payment; unpaid balances are not projected beyond the stop or horizon. Interest and months saved shown only if both plans pay off within the selected horizon. Example, not a lender quote.']};
}

/** Historical example of one explicitly confirmed notified inter-state GST classification. */
export function notifiedIndiaGst(input){
 exact(input,['classification','priceBasis','amount','scopeConfirmed']);
 if(input.classification!=='2523-2025-09-22'||!['exclusive','inclusive'].includes(input.priceBasis)||input.scopeConfirmed!==true)throw Error('Confirm the specified historical classification');
 const amount=units(input.amount),rate=1800n,tax=input.priceBasis==='exclusive'?round(amount*rate,10000n):round(amount*rate,11800n),net=input.priceBasis==='exclusive'?amount:amount-tax;
 return {...sample,currency:'INR',ratePercent:18,netAmount:out(net),taxAmount:out(tax),grossAmount:out(net+tax),sourceUrls:['https://www.pib.gov.in/PressReleasePage.aspx?PRID=2163671&lang=2&reg=3','https://courier.cbic.gov.in/advisory/2025/NOTIFICATION%20NO.%209_2025-INTEGRATED%20TAX%20%28RATE%29%20-1759486719.pdf'],warnings:['Historical example as at 22 September 2025 only: HSN 2523 hydraulic cement, confirmed ordinary domestic inter-state taxable supply subject to 18% IGST, registered supplier, forward charge. No classification inference, cess, reverse charge, exemption, transitional supply, tax credit, later amendments or invoice/return rounding determination.']};
}
export function ukEmployerNi(input,ruleContext={}){
 exact(input,['region','monthlyGross','scopeConfirmed']);
 if(!['RUK','SCT'].includes(input.region)||input.scopeConfirmed!==true||!Number.isSafeInteger(input.monthlyGross)||input.monthlyGross<0)throw Error('Confirm category A scope and whole monthly pounds');
 const salary=calculateSalaryRemainder({country:'GB',region:input.region,taxYear:'2026',pay:input.monthlyGross,scopeConfirmed:true},ruleContext),pay=units(input.monthlyGross),threshold=41700n,ni=round((pay>threshold?pay-threshold:0n)*1500n,10000n);
 return {...sample,currency:'GBP',monthlyGross:out(pay),monthlyEmployerNi:out(ni),annualEmployerNi:out(ni*12n),annualEmploymentCost:out((pay+ni)*12n),annualEmployeeRemainder:salary.annualRemainder,sourceUrls:['https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027'],warnings:['2026–27; 12 equal monthly payments to an ordinary category A employee, not a director. Employer NI 15% above GBP 417 per month. No employment allowance, special categories, freeports, investment zones, employer pension, benefits, levy, or other costs. Employee remainder is the existing limited salary model.']};
}
export function australiaDiscountGain(input){
 exact(input,['proceeds','costBase','eligibleCapitalLosses','otherTaxableIncome','acquired','disposed','scopeConfirmed']);
 const acquired=isoDate(input.acquired,'Acquisition date');
 const disposed=isoDate(input.disposed,'Disposal date');
 if(disposed<'2026-07-01'||disposed>='2027-07-01')throw Error('Disposal must fall in Australian FY 2026–27');
 const eligibleAfter=anniversaryClamped(acquired);
 if(disposed<=eligibleAfter)throw Error('The disposal date must be after the 12-month anniversary; acquisition and CGT-event days are excluded');
 if(input.scopeConfirmed!==true)throw Error('Confirm ordinary discount-eligible gain and loss treatment');
 const proceeds=units(input.proceeds),cost=units(input.costBase),loss=units(input.eligibleCapitalLosses),other=units(input.otherTaxableIncome);
 if(proceeds<cost||loss>proceeds-cost)throw Error('Only positive gains and applicable losses up to the gain supported');
 const gain=proceeds-cost,net=gain-loss,discounted=round(net,2n),calculate=taxableIncome=>assessTaxableIncome({country:'AU',taxYear:'2026',taxableIncome,residentEligible:true});
 const before=calculate(out(other)),after=calculate(out(other+discounted));
 return {...sample,currency:'AUD',acquired,disposed,minimumEligibleDisposalDate:eligibleAfter,holdingPeriodEligible:true,taxPeriod:'FY 2026–27',ruleEffectiveFrom:'2026-07-01',grossGain:out(gain),gainAfterLosses:out(net),assessableGain:out(discounted),modeledIncrementalIncomeTax:out(units(after.incomeTax)-units(before.incomeTax)),sourceUrls:['https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/calculating-your-cgt/cgt-discount','https://www.ato.gov.au/individuals-and-families/investments-and-assets/capital-gains-tax/capital-gains-tax-reform'],warnings:['FY 2026–27 only, ordinary eligible Australian resident individual throughout ownership, one asset held at least 12 months, eligible losses already established and applied before 50% discount. No main residence, small-business, affordable-housing, indexation, foreign-resident or rollover case. Incremental ordinary income tax including modeled LITO only; excludes Medicare, offsets, filing rounding and later CGT reforms.']};
}

function signedRate(v,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||Math.abs(v*100-Math.round(v*100))>0.00002)throw RangeError('Invalid rate');return BigInt(Math.round(v*100));}
function months(v,max=600){if(!Number.isSafeInteger(v)||v<1||v>max)throw RangeError('Invalid horizon');return v;}
/** Nominal fixed annual rate divided by 12; cash flows at month end. */
export function investmentScenario(input){
 exact(input,['currency','initialSavings','monthlyContribution','annualReturnPercent','horizonMonths','inflationPercent']);
 currency(input.currency);const initial=units(input.initialSavings),contribution=units(input.monthlyContribution),rate=signedRate(input.annualReturnPercent,-99,100),inflation=signedRate(input.inflationPercent,0,25),n=months(input.horizonMonths);
 let balance=initial;
 for(let month=0;month<n;month++){balance+=round(balance*rate,120000n)+contribution;out(balance);}
 const invested=initial+contribution*BigInt(n),real=Number(balance)/100/Math.pow(1+Number(inflation)/10000,n/12);
 if(!Number.isFinite(real))throw RangeError('Unsupported result');
 return {...sample,currency:input.currency,nominalBalance:out(balance),totalContributed:out(invested),modeledGrowth:out(balance-invested),inflationAdjustedBalance:Math.round(real*100)/100,warnings:['Hypothetical constant nominal annual return divided by 12; rounded monthly growth and end-of-month contributions. Inflation uses annual compounding. Returns are assumptions, not forecasts or guarantees. Excludes taxes, fees, market volatility and changes to contributions.']};
}
/** A finite retirement drawdown plan, not a safe withdrawal rate recommendation. */
export function retirementScenario(input){
 exact(input,['currency','startingBalance','monthlyWithdrawal','annualReturnPercent','annualSpendingGrowthPercent','horizonMonths']);
 currency(input.currency);const initial=units(input.startingBalance),withdraw=units(input.monthlyWithdrawal),rate=signedRate(input.annualReturnPercent,-99,100),growth=signedRate(input.annualSpendingGrowthPercent,0,25),n=months(input.horizonMonths);
 if(withdraw===0n)throw RangeError('Positive withdrawal required');
 let balance=initial,total=0n,fullyFundedMonths=0,firstShortfallMonth=null,spending=withdraw;
 for(let m=1;m<=n;m++){if(m>1&&(m-1)%12===0)spending+=round(spending*growth,10000n);balance+=round(balance*rate,120000n);out(balance);if(balance<spending){firstShortfallMonth=m;total+=balance;balance=0n;break;}balance-=spending;total+=spending;fullyFundedMonths++;}
 return {...sample,currency:input.currency,fullyFundedMonths,firstShortfallMonth,remainingBalance:out(balance),totalWithdrawn:out(total),warnings:['Finite hypothetical drawdown; nominal annual return divided by 12, monthly rounded growth and end-of-month withdrawals, spending increases at each annual anniversary. Stops at first funding shortfall after partial withdrawal. No pensions, taxes, fees, longevity estimate, volatility, guaranteed returns or advice on a safe withdrawal rate.']};
}

/** 2026 annual aggregate employer FICA, excluding per-pay-period rounding. */
export function usEmployerFica(input,ruleContext={}){
 exact(input,['annualWages','scopeConfirmed']);
 if(input.scopeConfirmed!==true)throw Error('Confirm ordinary covered wages');
 const result=calculateUsEmployerFica({
  country:'US',taxYear:'2026',coveredWages:input.annualWages,
  singleEmployer:true,scopeConfirmed:true
 },ruleContext);
 const wages=units(result.coveredWages),tax=units(result.employerFicaTotal);
 return {...sample,currency:'USD',annualWages:result.coveredWages,
  employerSocialSecurity:result.socialSecurityEmployerTax,
  employerMedicare:result.medicareEmployerTax,
  employerFica:result.employerFicaTotal,
  wagesPlusEmployerFica:out(wages+tax),
  sourceUrls:result.sourceUrls,warnings:result.warnings};
}
/** Singapore BSD only; higher of consideration and independently established market value. */
export function singaporeBuyerDuty(input){
 exact(input,['purchasePrice','marketValue','propertyType','transactionDate','scopeConfirmed']);
 const transactionDate=calendar2026(input.transactionDate);
 if(input.scopeConfirmed!==true||!['residential','nonresidential'].includes(input.propertyType))throw Error('Confirm pure property classification and date');
 const price=units(input.purchasePrice),value=units(input.marketValue),basis=price>value?price:value;
 if(basis<=0n)throw Error('Positive dutiable value required');
 let numerator=0n,lower=0n;
 for(const [upper,rate] of [[18000000n,1n],[36000000n,2n],[100000000n,3n],[150000000n,4n],[300000000n,5n],[100000000000n,input.propertyType==='residential'?6n:5n]]){
  const slice=basis<=lower?0n:(basis<upper?basis:upper)-lower;numerator+=slice*rate;lower=upper;
 }
 const dollars=numerator/10000n,duty=(dollars<1n?1n:dollars)*100n;
 return {...sample,currency:'SGD',transactionDate,ruleEffectiveFrom:'2023-02-15',dutiableValue:out(basis),buyerStampDuty:out(duty),purchasePricePlusBsd:out(price+duty),sourceUrls:["https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/buyer's-stamp-duty-(bsd)"],warnings:['Singapore pure residential or pure non-residential property, ordinary single acquisition under rates effective from 15 February 2023, cross-checked 27 November 2026. BSD only, floor to whole SGD with minimum SGD 1. No ABSD, SSD, remission, mixed-use, linked acquisition, valuation, financing or other charges; purchase price plus BSD is not total acquisition cost.']};
}
/** UK dividend component after explicitly established allocation of personal allowance. */
export function ukDividendTax(input){
 exact(input,['otherTaxableIncome','taxableDividends','scopeConfirmed']);
 if(input.scopeConfirmed!==true)throw Error('Confirm final taxable amounts and applicable bands');
 const other=units(input.otherTaxableIncome),dividends=units(input.taxableDividends),allowance=dividends<50000n?dividends:50000n;
 let start=other+allowance,end=other+dividends,numerator=0n;
 for(const [upper,rate] of [[3770000n,1075n],[12514000n,3575n],[200000000000n,3935n]]){
  if(end<=start)break;
  if(start>=upper)continue;
  const stop=end<upper?end:upper;numerator+=(stop-start)*rate;start=stop;
 }
 const tax=round(numerator,10000n);
 return {...sample,currency:'GBP',taxableDividends:out(dividends),dividendAllowance:out(allowance),dividendsAboveAllowance:out(dividends-allowance),modeledDividendTax:out(tax),sourceUrls:['https://www.gov.uk/tax-on-dividends','https://www.legislation.gov.uk/ukpga/2026/11/part/1/crossheading/income-tax-charge-rates-and-allowances/made'],warnings:['UK 2026–27 ordinary individual, other income and dividends after the final applicable Personal Allowance allocation. No savings income, band extensions, reliefs, special rates, ISA or foreign tax. All eligible annual dividends included, dividend allowance consumes bands. Component only: not total income tax, Personal Allowance determination or return rounding.']};
}

/** Compare only explicitly confirmed personal investment components, not total tax. */
export function scopedInvestmentGain(input){
 exact(input,['jurisdiction','confirmedNetGain','transactionDate','scopeConfirmed']);
 const transactionDate=calendar2026(input.transactionDate,'Disposal date');
 if(input.scopeConfirmed!==true||!['CA','DE','SG','AE'].includes(input.jurisdiction))throw Error('Confirm established positive gain and classification');
 const gain=units(input.confirmedNetGain);let included=null,tax=null,currency,source,scope;
 if(input.jurisdiction==='CA'){currency='CAD';included=round(gain,2n);source='https://laws-lois.justice.gc.ca/eng/acts/I-3.3/section-38.html';scope='Canada calendar 2026, ordinary individual net positive capital gain after confirmed eligible current-year losses, one-half inclusion; no exemption, reserve, carryover or special asset. Inclusion component only; no income tax calculated.';}
 else if(input.jurisdiction==='DE'){currency='EUR';included=gain;tax=round(gain*2500n,10000n);source='https://www.gesetze-im-internet.de/estg/__32d.html';scope='Germany 2026, ordinary private share disposal income subject to section 32d standard 25% separate tariff; entered gain already taxable after applicable allowance and loss treatment. Excludes church tax, solidarity surcharge, foreign credits, preferential assessment and special participation rules.';}
 else if(input.jurisdiction==='SG'){currency='SGD';included=0n;tax=0n;source='https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/what-is-taxable-what-is-not/gains-from-sale-of-property-shares-and-financial-instruments';scope='Singapore individual, confirmed personal investment share disposal, not trading or business income. Local income tax on this gain only, not stamp duty or foreign tax.';}
 else {currency='AED';included=0n;tax=0n;source='https://tax.gov.ae/en/taxes/corporate.tax/corporate.tax.topics/basis.of.taxation.natural.person.aspx';scope='UAE natural person, confirmed Personal Investment Income excluded from corporate tax; not licensed business or commercial activity. Corporate tax component only, not other taxes or duties.';}
 return {...sample,currency,taxYear:'2026',transactionDate,confirmedNetGain:out(gain),includedGain:included===null?null:out(included),modeledTax:tax===null?null:out(tax),scope,sourceUrls:[source,...(input.jurisdiction==='CA'?['https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/sole-proprietorships-partnerships/report-business-income-expenses/claiming-capital-cost-allowance/personal-use-property.html']:[])],warnings:[scope+' Source cross-check 27 November 2026. No residence, exemption or investment classification inferred. No total payable tax or filing determination.']};
}
/** Selected ordinary property transaction components, no valuation inference. */
export function scopedTransferTax(input){
 exact(input,['jurisdiction','taxableConsideration','transactionDate','scopeConfirmed']);
 const transactionDate=isoDate(input.transactionDate);
 const nsw=input.jurisdiction==='AU-NSW';
 if(nsw?(transactionDate<'2026-07-01'||transactionDate>='2027-07-01'):(transactionDate<'2026-01-01'||transactionDate>='2027-01-01'))throw Error(nsw?'NSW transfer date must be in FY 2026–27':'Transaction date must be in calendar 2026');
 if(input.scopeConfirmed!==true||!['DE-BE','CA-ON','IN-DL-male','IN-DL-female','US-NY','AU-NSW','AE-DU'].includes(input.jurisdiction))throw Error('Confirm applicable location and taxable consideration');
 const p=units(input.taxableConsideration);if(p===0n)throw Error('Positive consideration required');
 let tax,currency,source,scope;
 if(input.jurisdiction==='DE-BE'){if(p<250000n)throw Error('Small-value exemption not modeled; use at least EUR 2,500 and confirm no exemption');currency='EUR';tax=round(p*600n,10000n);source='https://service.berlin.de/dienstleistung/325323/';scope='Berlin ordinary taxable direct property acquisition, 6% on established consideration; excludes exemptions, share deals, special valuation and fees.';}
 else if(input.jurisdiction.startsWith('IN-DL-')){currency='INR';source='https://revenue.delhi.gov.in/revenue/property-registration';scope='Delhi ordinary sale deed, sole purchaser, confirmed published male or female purchaser category, established dutiable value, combined stamp and transfer duty only. No registration fee, exemption, valuation or joint ownership.';tax=round(p*(input.jurisdiction==='IN-DL-male'?600n:400n),10000n);}
 else if(input.jurisdiction==='US-NY'){currency='USD';source='https://www.tax.ny.gov/bus/transfer/rptidx.htm';scope='New York State ordinary taxable residential conveyance outside NYC, state base transfer tax only, normally seller liability, below USD 1 million, no exemption or special valuation.';if(p>=100000000n)throw Error('Additional residential mansion tax not supported');tax=p<=50000n?0n:((p+49999n)/50000n)*200n;}
 else if(input.jurisdiction==='AU-NSW'){currency='AUD';source='https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/transfer-duty/understanding-transfer-duty/calculate-transfer-duty';scope='NSW general transfer duty, FY 2026–27, confirmed ordinary nonresidential direct acquisition, no concessions, surcharge or special valuation. Input restricted to whole multiples of AUD 100; uses published base amounts.';if(p%10000n!==0n)throw Error('Use multiples of AUD 100 only');const brackets=[[129000000n,5223700n,550n],[38700000n,1160200n,450n],[10300000n,166200n,350n],[3800000n,52500n,175n],[1800000n,22500n,150n],[0n,0n,125n]];const [floor,base,rate]=brackets.find(([f])=>p>f);tax=base+round((p-floor)*rate,10000n);if(tax<2000n)tax=2000n;}
 else if(input.jurisdiction==='AE-DU'){currency='AED';source='https://dubailand.gov.ae/en/news-media/dld-calls-on-developers-to-pay-property-registration-fees-within-60-days/';scope='Dubai property sale registration FEE, not a tax. Combined buyer/seller 4% charge on confirmed sale value, allocation by agreement. Excludes administrative, registrar, mortgage and other fees.';tax=round(p*400n,10000n);}
 else {currency='CAD';source='https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax';scope='Ontario ordinary direct acquisition containing one or two single-family residences, provincial LTT only, agreements and transfers under rates effective January 2017; no refund, rebate, non-resident speculation tax or municipal LTT.';let total=0n,lower=0n;for(const [upper,rate] of [[5500000n,50n],[25000000n,100n],[40000000n,150n],[200000000n,200n],[100000000000n,250n]]){const v=p<=lower?0n:(p<upper?p:upper)-lower;total+=v*rate;lower=upper;}tax=round(total,10000n);}
 return {...sample,currency,transactionDate,taxPeriod:nsw?'FY 2026–27':'Calendar year 2026',ruleEffectiveFrom:input.jurisdiction==='AU-NSW'?'2026-07-01':input.jurisdiction==='CA-ON'?'2017-01-01':input.jurisdiction==='DE-BE'?'2014-01-01':null,taxableConsideration:out(p),transferTax:out(tax),considerationPlusTax:out(p+tax),chargeType:input.jurisdiction==='AE-DU'?'registration-fee':'tax',scope,sourceUrls:[source],warnings:[scope+' Cross-checked 27 November 2026. Nearest minor-unit arithmetic only, not assessment rounding or total closing costs.']};
}
export function texasStateSalesTax(input){
 exact(input,['exclusiveAmount','scopeConfirmed']);
 if(input.scopeConfirmed!==true)throw Error('Confirm Texas state-taxable sale and exclusions');
 const amount=units(input.exclusiveAmount),tax=round(amount*625n,10000n);
 return {...sample,currency:'USD',exclusiveAmount:out(amount),stateTax:out(tax),amountPlusStateTax:out(amount+tax),sourceUrls:['https://comptroller.texas.gov/taxes/sales/faq/local.php'],warnings:['Texas state sales tax component 6.25%, source cross-check 27 November 2026. Confirm ordinary taxable retail sale, registered seller and correct state sourcing. Local sales taxes (up to 2%) are excluded, as are exemptions and special rounding. This is not VAT or total sales tax.']};
}
/** Treaty-limited ordinary credit components; adjusted bases must be independently established. */
export function scopedTreatyCredit(input){
 exact(input,['jurisdiction','foreignTaxPaid','treatyPermittedTax','domesticTax','worldwideTaxableIncome','foreignTaxableIncome','domesticTaxOnItem','scopeConfirmed']);
 if(input.scopeConfirmed!==true||!['US-GB','IN-GB'].includes(input.jurisdiction))throw Error('Confirm treaty and adjusted income and tax bases');
 const us=input.jurisdiction==='US-GB';
 const domestic=units(input.domesticTax),world=units(input.worldwideTaxableIncome);
 const foreign=units(input.foreignTaxableIncome),item=units(input.domesticTaxOnItem);
 if(world===0n||foreign>world||item>domestic)throw Error('Invalid confirmed income or tax bases');
 const result=calculateTreatyCreditComponent({
  currency:us?'USD':'INR',worldwideIncome:input.worldwideTaxableIncome,
  foreignSourceIncome:input.foreignTaxableIncome,
  domesticTaxOnWorldwideIncome:input.domesticTax,
  foreignTaxPaid:input.foreignTaxPaid,treatyLimit:input.treatyPermittedTax,
  taxOnForeignItem:input.domesticTaxOnItem,scopeConfirmed:true
 });
 const sources=us
  ? ['https://www.gov.uk/government/publications/usa-tax-treaties/2001-uk-usa-double-taxation-convention-as-amended-by-the-2002-protocol-in-force','https://www.irs.gov/individuals/international-taxpayers/foreign-tax-credit-how-to-figure-the-credit']
  : ['https://www.gov.uk/government/publications/india-tax-treaties/2020-uk-india-synthesised-text-of-the-multilateral-instrument-and-the-1993-double-taxation-convention-in-force','https://www.incometax.gov.in/iec/foportal/help/statutory-forms/popular-form/form67-um'];
 const scope=us
  ? 'US-side UK treaty Article 24, calendar 2026, one ordinary general-category income item; adjusted limitation numerator, denominator and domestic tax already established.'
  : 'India-side UK treaty Article 24(2), historical FY 2025–26 / AY 2026–27 only; one eligible UK-source income item and Rule 128 credit limits already established.';
 return {...sample,currency:result.currency,
  proportionalLimit:result.proportionalDomesticTaxLimit,
  modeledCredit:result.allowedCredit,
  domesticTaxAfterCredit:out(domestic-units(result.allowedCredit)),
  foreignTaxNotCredited:result.unusedForeignTax,
  sourceUrls:sources,
  warnings:[scope,...result.warnings,
   'No treaty eligibility, residence, source, re-sourcing, special categories, carryovers, tax sparing, multiple income items, exchange conversion or filing position is inferred. This is not a tax-credit claim or filing determination.']};
}
/** Explicitly confirmed treaty credit calculation, without inferring the assessed domestic limit. */
const confirmedCreditScopes=Object.freeze({
 'CA-GB':Object.freeze({currency:'CAD',period:'Calendar 2025 (historical)',scope:'Canadian resident individual, UK treaty Article 21, one ordinary non-business item, confirmed federal foreign tax credit limit under domestic law. Excludes provincial credit, deduction, exempt income and special limits.',sources:['https://www.canada.ca/en/department-finance/programs/tax-policy/tax-treaties/country/united-kingdom-convention-consolidated-1978-1980-1985.html','https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/about-your-tax-return/tax-return/completing-a-tax-return/deductions-credits-expenses/line-40500-federal-foreign-tax-credit.html']}),
 'AU-GB':Object.freeze({currency:'AUD',period:'FY 2025–26 (historical)',scope:'Australian resident individual, UK treaty, one ordinary included foreign income item, foreign income tax offset (FITO). Input domestic limit is already calculated tax difference ignoring relevant foreign income and deductions; statutory minimum limit AUD 1,000. No other offsets or special FITO treatment.',sources:['https://www.gov.uk/government/publications/australia-tax-treaties/synthesised-text-of-the-multilateral-instrument-and-the-2003-australia-uk-double-taxation-convention-in-force','https://www.ato.gov.au/individuals-and-families/your-tax-return/instructions-to-complete-your-tax-return/mytax-instructions/2026/tax-offsets/foreign-income-tax-offset']}),
 'DE-GB':Object.freeze({currency:'EUR',period:'Calendar 2026',scope:'German resident individual, UK treaty Article 23(1)(b), one eligible UK directors fee subject to German credit method and ordinary income tax. Confirm German section 34c limitation; no exemption-method income, preferential capital-income tariff, church tax or solidarity surcharge.',sources:['https://www.gov.uk/government/publications/germany-tax-treaties/2010-uk-germany-double-taxation-convention-as-amended-by-the-2021-protocol-in-force','https://www.gesetze-im-internet.de/estg/__34c.html']}),
 'SG-GB':Object.freeze({currency:'SGD',period:'YA 2026',scope:'Singapore resident company, UK treaty Article 23, one taxable UK-source item subject to direct double-taxation relief, no pooling, exemption, underlying tax, special credits or rebates. Confirm Singapore tax attributable after relevant deductions.',sources:['https://www.gov.uk/government/publications/singapore-tax-treaties/synthesised-text-of-the-multilateral-instrument-and-the-1997-uk-singapore-double-taxation-agreement-in-force','https://www.iras.gov.sg/taxes/corporate-income-tax/income-deductions-for-companies/claiming-reliefs/foreign-tax-credit']}),
 'AE-GB':Object.freeze({currency:'AED',period:'Calendar 2026',scope:'UAE ordinary resident juridical person subject to corporate tax, UK treaty, one taxable UK-source income item, confirmed treaty entitlement and UAE corporate tax on relevant income. No exempt or qualifying free-zone income, minimum tax, other credits, carryover or refunds.',sources:['https://www.gov.uk/government/publications/united-arab-emirates-tax-treaties/2016-uk-uae-double-taxation-convention','https://tax.gov.ae/en/faq.aspx?keyword=Is+a+credit+available+for+foreign+tax+paid+on+income+that+is+also+subject+to+UAE+CT%3F']})
});
export function confirmedTreatyCredit(input){
 exact(input,['jurisdiction','foreignTaxPaid','treatyPermittedTax','domesticLimit','availableDomesticTax','scopeConfirmed']);
 if(input.scopeConfirmed!==true||!Object.hasOwn(confirmedCreditScopes,input.jurisdiction))throw Error('Confirm applicable treaty and domestic limits');
 const s=confirmedCreditScopes[input.jurisdiction],paid=units(input.foreignTaxPaid),permitted=units(input.treatyPermittedTax),rawLimit=units(input.domesticLimit),available=units(input.availableDomesticTax);
 const limit=input.jurisdiction==='AU-GB'&&rawLimit<100000n?100000n:rawLimit;
 const credit=[paid,permitted,limit,available].reduce((a,b)=>a<b?a:b);
 return {...sample,currency:s.currency,domesticCreditLimit:out(limit),modeledCredit:out(credit),domesticTaxAfterCredit:out(available-credit),foreignTaxNotCredited:out(paid-credit),sourceUrls:s.sources,warnings:[s.period+'. '+s.scope+' All values supplied in domestic currency, after independently established eligibility and adjustments; lower of paid, treaty-permitted, domestic cap and available domestic tax. No actual return, eligibility, exchange, sourcing, or refund calculation.']};
}
