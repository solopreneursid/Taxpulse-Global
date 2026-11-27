import {financialHealthSnapshot,financialRunway,debtRepayment,investmentScenario,retirementScenario,cashFlowStressScenario} from './decision-tools.mjs';
import {calculateBudget} from './budget.mjs';
import {encryptRecord,decryptRecord} from './secure-records.mjs';
import {calculateSalaryRemainder} from './taxable-income.mjs';
const own=(o,k)=>Object.hasOwn(o,k);
const regions=Object.freeze({TX:['US','USD','annual'],RUK:['GB','GBP','monthly'],SCT:['GB','GBP','monthly'],AB:['CA','CAD','annual'],AU:['AU','AUD','annual'],IN:['IN','INR','annual'],SG:['SG','SGD','monthly'],DE:['DE','EUR','monthly'],AE:['AE','AED','monthly']});
const extra=Object.freeze({IN:['epfMonthlyWage','professionalTaxAnnual'],DE:['annualTaxableIncome','healthSupplementRate'],AE:['monthlyBasicSalary']});
function exact(o,keys){
 if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!own(o,k)))throw new TypeError('Unsupported profile fields');
}
function minor(n){
 if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1e9||Math.abs(n*100-Math.round(n*100))>0.00002)throw new RangeError('Enter a nonnegative amount with at most two decimal places');
 return Math.round(n*100);
}
export function createFinancialProfile(salary,ruleContext={}){
 if(!salary||typeof salary!=='object'||!own(regions,salary.region))throw new RangeError('Unsupported region');
 const [country,currency,payPeriod]=regions[salary.region];
 const keys=['country','region','taxYear','pay','scopeConfirmed',...(extra[country]||[])];
 exact(salary,keys);
 if(salary.country!==country||salary.taxYear!=='2026'||salary.scopeConfirmed!==true)throw new RangeError('Confirm the supported tax profile');
 minor(salary.pay);
 const result=calculateSalaryRemainder(salary,ruleContext);
 if(result.currency!==currency)throw new Error('Currency mismatch');
 return Object.freeze({schemaVersion:1,country,region:salary.region,currency,taxYear:salary.taxYear,payPeriod,annualGross:result.annualGross,annualIncomeTax:result.incomeTax,annualEmployeeContributions:result.employeeContributions,annualTakeHome:result.annualRemainder,salary:Object.freeze(Object.fromEntries(keys.map(k=>[k,salary[k]]))),sampleOnly:true,taxRulesVerified:false});
}
export function salaryFromProfile(profile,ruleContext={}){
 if(!profile||profile.schemaVersion!==1)throw new TypeError('Unsupported profile version');
 const validated=createFinancialProfile(profile.salary,ruleContext);
 for(const key of ['country','region','currency','taxYear','payPeriod','annualGross','annualIncomeTax','annualEmployeeContributions','annualTakeHome','sampleOnly','taxRulesVerified'])if(profile[key]!==validated[key])throw new RangeError('Profile metadata does not match salary');
 return {...validated.salary};
}
export function offerFromProfile(profile,ruleContext={}){const salary=salaryFromProfile(profile,ruleContext);return {...salary,scopeConfirmed:false};}
export function internationalFromProfile(profile,{housing,living},ruleContext={}){
 const salary=offerFromProfile(profile,ruleContext);
 return {salary,housing:minor(housing)/100,living:minor(living)/100};
}
export function negotiationFromProfile(profile,monthlyIncrease,ruleContext={}){
 const current=salaryFromProfile(profile,ruleContext);
 if(minor(monthlyIncrease)===0)throw new RangeError('Enter a positive increase');
 return {current,monthlyIncrease};
}

const checkFingerprint=v=>{if(typeof v!=='string'||! /^[a-f0-9]{64}$/.test(v))throw Error('Invalid engine fingerprint');return v;};
export async function exportEncryptedProfile(profile,password,engineFingerprint,ruleContext={}){
 checkFingerprint(engineFingerprint);
 const salary=salaryFromProfile(profile,ruleContext);
 return encryptRecord({kind:'taxpulse-financial-profile',schemaVersion:1,engineFingerprint,salary},password);
}
export async function importEncryptedProfile(envelope,password,engineFingerprint,ruleContext={}){
 checkFingerprint(engineFingerprint);
 const data=await decryptRecord(envelope,password);
 exact(data,['kind','schemaVersion','engineFingerprint','salary']);
 if(data.kind!=='taxpulse-financial-profile'||data.schemaVersion!==1||data.engineFingerprint!==engineFingerprint)throw Error('Incompatible financial profile; use the original engine or enter the assumptions again');
 return createFinancialProfile(data.salary,ruleContext);
}

const planningCalculators=Object.freeze({'monthly-budget':calculateBudget,'financial-health':financialHealthSnapshot,'financial-runway':financialRunway,'cash-flow-stress':cashFlowStressScenario,'debt-repayment':debtRepayment,'investment-scenario':investmentScenario,'retirement-scenario':retirementScenario});
/** Versioned input-only archive. Validate every item before making any restored values available. */
export function validatePlanningArchive(input,ruleContext={}){
 exact(input,['salaryProfiles','scenarios']);
 if(!Array.isArray(input.salaryProfiles)||input.salaryProfiles.length>10||!Array.isArray(input.scenarios)||input.scenarios.length>30||input.salaryProfiles.length+input.scenarios.length===0)throw Error('Archive must have 1–10 salary profiles or 1–30 planning scenarios');
 const salaryProfiles=input.salaryProfiles.map(s=>createFinancialProfile(s,ruleContext).salary);
 const scenarios=input.scenarios.map(s=>{exact(s,['kind','input']);if(!own(planningCalculators,s.kind))throw Error('Unsupported planning scenario');planningCalculators[s.kind](s.input);return {kind:s.kind,input:structuredClone(s.input)};});
 return {salaryProfiles,scenarios};
}
export async function exportPlanningArchive(input,password,engineFingerprint,ruleContext={}){
 checkFingerprint(engineFingerprint);
 const archive=validatePlanningArchive(input,ruleContext);
 return encryptRecord({kind:'taxpulse-planning-archive',schemaVersion:1,engineFingerprint,...archive},password);
}
export async function importPlanningArchive(envelope,password,engineFingerprint,ruleContext={}){
 checkFingerprint(engineFingerprint);const data=await decryptRecord(envelope,password);
 exact(data,['kind','schemaVersion','engineFingerprint','salaryProfiles','scenarios']);
 if(data.kind!=='taxpulse-planning-archive'||data.schemaVersion!==1||data.engineFingerprint!==engineFingerprint)throw Error('Incompatible planning archive');
 return validatePlanningArchive({salaryProfiles:data.salaryProfiles,scenarios:data.scenarios},ruleContext);
}

/** Recalculate independently captured examples; never sum alternatives or currencies. */
export function planningReport(input,engineFingerprint,ruleContext={}){
 checkFingerprint(engineFingerprint);
 const validated=validatePlanningArchive(input,ruleContext);
 const salary=validated.salaryProfiles.map((s,index)=>{const p=createFinancialProfile(s,ruleContext);return {index:index+1,region:p.region,currency:p.currency,taxYear:p.taxYear,annualGross:p.annualGross,annualIncomeTax:p.annualIncomeTax,annualEmployeeContributions:p.annualEmployeeContributions,annualTakeHome:p.annualTakeHome};});
 const metrics={
 'monthly-budget':r=>({monthlyIncome:r.monthlyIncome,monthlyExpenses:r.monthlyExpenses,monthlyBalance:r.monthlyBalance,annualBalance:r.annualBalance,monthlyGoal:r.monthlyGoal,goalGap:r.goalGap,alternativeMonthlyBalance:r.alternative.monthlyBalance}),
 'financial-health':r=>({totalAssets:r.totalAssets,liabilities:r.liabilities,netWorth:r.netWorth,monthlyBalance:r.monthlyBalance,projectedLiquidSavings:r.projectedLiquidSavings,monthsToGoal:r.monthsToGoal}),
 'financial-runway':r=>({monthlyBalance:r.monthlyBalance,projectedSavings:r.projectedSavings,monthsToGoal:r.monthsToGoal,wholeMonthsBeforeReserve:r.wholeMonthsBeforeReserve}),
 'cash-flow-stress':r=>({baselineEndingLiquidSavings:r.baseline.endingLiquidSavings,stressEndingLiquidSavings:r.stress.endingLiquidSavings,endingSavingsImpact:r.endingSavingsImpact,baselineFirstReserveBreachMonth:r.baseline.firstReserveBreachMonth??'No breach',stressFirstReserveBreachMonth:r.stress.firstReserveBreachMonth??'No breach',stressMonthsBelowReserve:r.stress.monthsBelowReserve,stressFirstNegativeMonth:r.stress.firstNegativeMonth??'No negative balance',reserveRestoredMonth:r.stress.reserveRestoredMonth??(r.stress.firstReserveBreachMonth===null?'Not required':'Not restored within horizon')}),
 'debt-repayment':r=>({basePayoffMonths:r.base.payoffMonths,baseRemaining:r.base.remaining,acceleratedPayoffMonths:r.accelerated.payoffMonths,acceleratedRemaining:r.accelerated.remaining,interestSaved:r.interestSaved,monthsSaved:r.monthsSaved}),
 'investment-scenario':r=>({nominalBalance:r.nominalBalance,totalContributed:r.totalContributed,modeledGrowth:r.modeledGrowth,inflationAdjustedBalance:r.inflationAdjustedBalance}),
 'retirement-scenario':r=>({fullyFundedMonths:r.fullyFundedMonths,firstShortfallMonth:r.firstShortfallMonth,remainingBalance:r.remainingBalance,totalWithdrawn:r.totalWithdrawn})
 };
 const scenarios=validated.scenarios.map(({kind,input},index)=>{const r=planningCalculators[kind](input);return {index:index+1,kind,currency:r.currency,input,metrics:metrics[kind](r),warnings:r.warnings};});
 return {schemaVersion:1,kind:'taxpulse-planning-report',engineFingerprint,sampleOnly:true,taxRulesVerified:false,salary,scenarios,warnings:['Independent examples, not a single combined balance sheet. Do not add balances, currencies, or alternative scenarios. Recalculated with the running preview; engine fingerprint identifies the statutory engine, not an independent report signature. No statutory approval, suitability assessment, or production authorization.']};
}
