// Decision tools use explicit user-supplied assumptions; no statutory eligibility inferred.
import {compareIndiaRegimes,calculateSalaryRemainder,assessTaxableIncome} from './taxable-income.mjs';
const currencies=['INR','USD','GBP','CAD','AUD','EUR','SGD','AED'];
function exact(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))throw new TypeError('Unsupported input fields');}
function units(v,scale=100,max=1e9){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max||Math.abs(v*scale-Math.round(v*scale))>0.00002)throw new RangeError('Invalid amount or precision');return BigInt(Math.round(v*scale));}
const out=n=>{if(n>100000000000000n||n< -100000000000000n)throw new RangeError('Result outside supported range');return Number(n)/100;};
const round=(n,d)=>n<0n?-round(-n,d):(n+d/2n)/d;
function currency(c){if(!currencies.includes(c))throw new RangeError('Unsupported currency');return c;}
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
 const runway=balance<0n?Number(available/(-balance)):null;
 return {...sample,currency:input.currency,monthlyBalance:out(balance),availableAboveReserve:out(available),projectedSavings:out(savings+balance*BigInt(input.horizonMonths)),monthsToGoal,wholeMonthsBeforeReserve:runway,goalGapNow:out(needed>savings?needed-savings:0n),warnings:['Constant monthly income and costs. Goal is in addition to the selected reserve. Negative projected savings means a modeled funding shortfall, not available credit. No interest, inflation, investment return, taxes, debt restructuring or emergency costs are inferred.']};
}

const indirectSchedules=Object.freeze({
 'CA-ON':Object.freeze({currency:'CAD',rate:1300,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'Ontario — confirmed ordinary HST place of supply'}),
 'CA-NS':Object.freeze({currency:'CAD',rate:1400,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'Nova Scotia — confirmed ordinary HST place of supply'}),
 'CA-NB':Object.freeze({currency:'CAD',rate:1500,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'New Brunswick — confirmed ordinary HST place of supply'}),
 'CA-NL':Object.freeze({currency:'CAD',rate:1500,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'Newfoundland and Labrador — confirmed ordinary HST place of supply'}),
 'CA-PE':Object.freeze({currency:'CAD',rate:1500,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'Prince Edward Island — confirmed ordinary HST place of supply'}),
 GB:Object.freeze({currency:'GBP',rate:2000,source:'https://www.gov.uk/vat-rates',scope:'UK standard-rated domestic supply'}),
 DE:Object.freeze({currency:'EUR',rate:1900,source:'https://www.gesetze-im-internet.de/ustg_1980/__12.html',scope:'Germany ordinary standard-rated domestic supply'}),
 AU:Object.freeze({currency:'AUD',rate:1000,source:'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/how-gst-works',scope:'Australia standard-rated domestic taxable sale'}),
 SG:Object.freeze({currency:'SGD',rate:900,source:'https://www.iras.gov.sg/taxes/goods-services-tax-%28gst%29/basics-of-gst/current-gst-rates',scope:'Singapore standard-rated domestic taxable supply'}),
 AE:Object.freeze({currency:'AED',rate:500,source:'https://mof.gov.ae/en/public-finance/tax/value-added-tax-vat/',scope:'UAE standard-rated domestic taxable supply'}),
 CA:Object.freeze({currency:'CAD',rate:500,source:'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate.html',scope:'Alberta only, confirmed place of supply; federal GST'})
});
/** Single ordinary taxable supply, as at the recorded source review date. */
export function standardIndirectTax(input){
 exact(input,['country','priceBasis','amount','scopeConfirmed']);
 if(!Object.hasOwn(indirectSchedules,input.country)||input.scopeConfirmed!==true||!['exclusive','inclusive'].includes(input.priceBasis))throw Error('Confirm standard-rated domestic supply and supported jurisdiction');
 const s=indirectSchedules[input.country],amount=units(input.amount),rate=BigInt(s.rate);
 const tax=input.priceBasis==='exclusive'?round(amount*rate,10000n):round(amount*rate,10000n+rate);
 const net=input.priceBasis==='exclusive'?amount:amount-tax,gross=net+tax;
 return {...sample,currency:s.currency,ratePercent:s.rate/100,netAmount:out(net),taxAmount:out(tax),grossAmount:out(gross),scope:s.scope,sourceUrls:[s.source],sourceReviewedOn:input.country.startsWith('CA-')?'2026-11-27':'2026-11-26',warnings:[s.scope+'. Published standard rate cross-check in November 2026, not independently approved. Confirm registered seller, tax point, place of supply, standard-rated classification and price basis before using. Single amount rounded to nearest currency cent; not invoice-line rounding, input tax recovery, filing, exemption, zero-rating, reduced rate, reverse charge or cross-border advice.']};
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
 if(input.scopeConfirmed!==true||!['GB','AE','AU-base','AU-full','US','CA-general','CA-small','DE','SG-PTE','SG-startup'].includes(input.jurisdiction))throw Error('Confirm ordinary company scope');
 const p=units(input.taxableProfit);let numerator,currency,source,scope,period;
 if(input.jurisdiction==='GB'){
  currency='GBP';source='https://www.gov.uk/guidance/corporation-tax-marginal-relief';period='1 April 2026 to 31 March 2027';
  scope='UK resident ordinary non-ring-fence trading company, full aligned accounting year, no associated companies, no exempt distributions, augmented profits equal taxable profits, eligible for small profits rate and marginal relief.';
  numerator=p<=5000000n?p*1900n:p>=25000000n?p*2500n:p*2500n-(25000000n-p)*150n;
 }else if(input.jurisdiction==='AE'){
  currency='AED';source='https://mof.gov.ae/en/news/ministry-of-finance-confirms-applicable-taxable-income-threshold-for-corporate-tax-abu-dhabi-uae/';period='Calendar year 2026';
  scope='UAE ordinary resident juridical person, full calendar-year tax period; not exempt, free-zone, multinational minimum-tax or small-business relief case.';
  numerator=(p>37500000n?p-37500000n:0n)*900n;
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
 const tax=round(numerator,input.jurisdiction.startsWith('SG-')?40000n:10000n);
 return {...sample,currency,taxableProfit:out(p),grossCorporateTax:out(tax),profitAfterModeledTax:out(p-tax),effectiveRatePercent:p===0n?0:Number(round(tax*10000n,p))/100,sourceUrls:[source],sourceReviewedOn:['GB','AE','AU-base','AU-full'].includes(input.jurisdiction)?'2026-11-26':'2026-11-27',taxPeriod:period,scope,warnings:[scope+' '+period+'. Taxable profit must already be independently established, not turnover or accounting profit. Gross modeled rate calculation before other credits, offsets, reliefs, adjustments, withholding, dividend taxes or filing-specific rounding. No eligibility, accounting adjustments, associated-company count, free-zone status or tax residence inferred. No filing or statutory approval.']};
}

/** England and Northern Ireland, one ordinary freehold residential purchase. */
export function residentialSdlt(input){
 exact(input,['consideration','buyerScope','scopeConfirmed']);
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
 return {...sample,currency:'GBP',consideration:Number(p),stampDuty:Number(tax),priceAndDuty:Number(p+tax),firstTimeReliefApplied:first,sourceUrls:['https://www.gov.uk/stamp-duty-land-tax/residential-property-rates','https://www.gov.uk/hmrc-internal-manuals/stamp-duty-land-tax-manual/sdltm00050'],sourceReviewedOn:'2026-11-27',warnings:['England or Northern Ireland, ordinary individual UK-resident buyer(s) for SDLT, one unlinked freehold residential transaction, no higher rates or other reliefs. Rates for transactions from 1 April 2025, cross-checked 27 November 2026. First-time option assumes all purchasers meet the relief conditions including main residence intention; above GBP 500,000 ordinary bands apply. Tax rounded down to whole pounds. Excludes lease rent, linked transactions, companies, additional dwellings, non-resident surcharge, Scotland, Wales and fees.']};
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
