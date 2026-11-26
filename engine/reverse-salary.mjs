import {calculateSalaryRemainder} from './taxable-income.mjs';
// Explicit bounded exhaustive search: rounding and tax cliffs can violate monotonicity.
// Whole currency-unit grid; no claim about fractional gross amounts.
export function reverseSalary(input,ruleContext={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['profile','target','period','minPay','maxPay'].includes(k)))throw new TypeError('Invalid reverse salary request');
 const {profile,target,period,minPay,maxPay}=input;
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||Object.hasOwn(profile,'pay')||profile.scopeConfirmed!==true)throw new TypeError('Confirm salary assumptions without gross pay');
 if(!Number.isFinite(target)||target<0||target>1e9||Math.abs(target*100-Math.round(target*100))>0.00002||!['monthly','annual'].includes(period))throw new RangeError('Invalid target or period');
 if(!Number.isSafeInteger(minPay)||!Number.isSafeInteger(maxPay)||minPay<0||maxPay>1e9||maxPay<minPay||maxPay-minPay>10000)throw new RangeError('Choose a whole-unit search range of at most 10,001 candidates');
 const threshold=Math.round(target*100);
 // Endpoints must be valid under the unchanged, explicit profile.
 calculateSalaryRemainder({...profile,pay:minPay},ruleContext);
 calculateSalaryRemainder({...profile,pay:maxPay},ruleContext);
 for(let pay=minPay;pay<=maxPay;pay++){
  const salary=calculateSalaryRemainder({...profile,pay},ruleContext);
  const achieved=period==='annual'?salary.annualRemainder:salary.averageMonthlyRemainder;
  if(Math.round(achieved*100)>=threshold)return {found:true,target,period,minPay,maxPay,requiredPay:pay,achieved,salary,sampleOnly:true,taxRulesVerified:false,searchStep:1};
 }
 return {found:false,target,period,minPay,maxPay,sampleOnly:true,taxRulesVerified:false,searchStep:1};
}

/**
 * Search automatically from a mathematically necessary lower bound.
 * Never skip a candidate: tax rounding and relief cliffs need not be monotone.
 * Bound work per call; distinguish unfinished search from impossible target.
 */
export function automaticReverseSalary({profile,target,period},ruleContext={}){
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||profile.scopeConfirmed!==true||Object.hasOwn(profile,'pay'))throw new TypeError('Confirm salary assumptions');
 if(!Number.isFinite(target)||target<0||target>1e9||Math.abs(target*100-Math.round(target*100))>0.00002||!['monthly','annual'].includes(period))throw new RangeError('Invalid target');
 const limits={'US:TX':[0,250000,1],'GB:RUK':[0,100000,12],'GB:SCT':[0,100000,12],'CA:AB':[60000,150000,1],'AU:AU':[100000,1000000,1],'IN:IN':[0,1000000000,1],'SG:SG':[751,100000,12],'DE:DE':[2500,6450,12],'AE:AE':[100,1000000,12]};
 const key=profile.country+':'+profile.region;
 if(!Object.hasOwn(limits,key))throw new RangeError('Unsupported region');
 const [minimum,maximum,multiplier]=limits[key];
 let floor=minimum;
 if(key==='DE:DE')floor=Math.max(floor,Math.ceil(profile.annualTaxableIncome/12));
 if(key==='AE:AE')floor=Math.max(floor,Math.ceil(profile.monthlyBasicSalary));
 if(key==='IN:IN'){
  // At these low wages income tax is zero. Avoid evaluating a valid profile
  // at a salary where its fixed employee deductions exceed wages.
  if(!Number.isSafeInteger(profile.epfMonthlyWage)||profile.epfMonthlyWage<0||profile.epfMonthlyWage>15000||!Number.isSafeInteger(profile.professionalTaxAnnual)||profile.professionalTaxAnnual<0||profile.professionalTaxAnnual>2500)throw new RangeError('Invalid confirmed contribution wage or professional tax');
  floor=Math.max(floor,profile.epfMonthlyWage*12,Math.ceil(profile.epfMonthlyWage*12*0.12+profile.professionalTaxAnnual));
 }
 // Validate the profile even if the requested target exceeds the supported range.
 if(!Number.isFinite(floor)||floor>maximum)throw new RangeError('Unsupported profile');
 floor=Math.ceil(floor);
 calculateSalaryRemainder({...profile,pay:floor},ruleContext);
 // Monthly output may round up by half a cent.
 const annualTarget=period==='monthly'?Math.max(0,target-.005)*12:target;
 // UAE premium is constant for a fixed basic wage; Germany's assessed tax
 // is also constant when the caller holds assessed taxable income fixed.
 // Other profiles use only lower bounds that hold for every candidate.
 let deductionFloor=0;
 const base=calculateSalaryRemainder({...profile,pay:floor},ruleContext);
 if(key==='AE:AE')deductionFloor=base.totalModeledDeductions;
 if(key==='DE:DE')deductionFloor=base.incomeTax;
 if(key==='IN:IN')deductionFloor=base.employeeContributions;
 // For these scoped profiles total deductions are nondecreasing: progressive
 // tax on nondecreasing taxable income, plus nondecreasing contributions.
 // Singapore whole-dollar CPF rises by at most one dollar per dollar of pay;
 // Australia is restricted above the low-income offset phaseout.
 // Germany and UAE hold assessment and basic wage fixed.
 // India bundled new-regime tax is nondecreasing: progressive rates,
 // rebate/relief and surcharge/relief are minima of nondecreasing functions
 // with matching threshold boundaries. Cess and rounding preserve that.
 // Fixed EPF and professional tax do not vary. Net salary itself may dip.
 // Alberta bundled deductions before rounding are nondecreasing: CPP/EI
 // premiums rise or plateau, enhanced CPP reduces taxable-income slope by
 // at most 4%, federal+provincial marginal rates exceed the marginal
 // contribution-credit rates. Independent cent rounding can introduce
 // small dips; subtract CAD 1 from any observed deduction as a conservative
 // lower bound at all later whole-dollar wages (well above the sum of the
 // half-cent rounding errors of these components). Never extrapolate
 // this proof to arbitrary signed schedules.
 // Iterating a necessary bound cannot skip any feasible candidate.
 let start=Math.max(floor,Math.floor((annualTarget+deductionFloor)/multiplier));
 if(Object.keys(ruleContext).length===0&&['US:TX','GB:RUK','GB:SCT','AU:AU','SG:SG','DE:DE','AE:AE','IN:IN','CA:AB'].includes(key)){
  for(let i=0;i<64&&start<=maximum;i++){
   const at=calculateSalaryRemainder({...profile,pay:start},ruleContext);
   const safeDeduction=key==='CA:AB'?Math.max(0,at.totalModeledDeductions-1):at.totalModeledDeductions;
   const next=Math.floor((annualTarget+safeDeduction)/multiplier);
   if(next<=start)break;
   start=next;
  }
 }
 if(start>maximum)return {found:false,searchComplete:true,sampleOnly:true,taxRulesVerified:false};
 const end=Math.min(maximum,start+10000);
 const result=reverseSalary({profile,target,period,minPay:start,maxPay:end},ruleContext);
 return {...result,searchComplete:result.found||end===maximum};
}
