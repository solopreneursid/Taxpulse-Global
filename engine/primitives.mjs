import {toMinorUnits,decimalRateUnits,roundRatio} from './statutory-context.mjs';

const MONEY_SCALE=100n;
const RATE_PRECISION=9;
const RATE_SCALE=10n**BigInt(RATE_PRECISION);
const minor=value=>toMinorUnits(value,2);
const money=value=>Number(value)/Number(MONEY_SCALE);
const rateUnits=value=>decimalRateUnits(value,RATE_PRECISION);
const applyRate=(amount,rate)=>roundRatio(amount*rate,RATE_SCALE);
const ratio=(numerator,denominator)=>roundRatio(numerator,denominator);

const TaxEnginePrimitives = {
 progressive_brackets(taxableBase,brackets){
  if(!Array.isArray(brackets)||brackets.length<1||brackets.length>64)throw new TypeError('Invalid tax brackets');
  const base=minor(taxableBase);
  let totalTax=0n,marginalRate=Number(brackets[0].rate)||0,previous=0n;
  const tiers=brackets.map((bracket,index)=>{
   if(!bracket||typeof bracket!=='object'||Array.isArray(bracket))throw new TypeError('Invalid tax bracket');
   const min=minor(bracket.min);
   const max=bracket.max===null||bracket.max===undefined?null:minor(bracket.max);
   const rate=rateUnits(bracket.rate);
   if(min!==previous||(max!==null&&max<=min)||index===brackets.length-1&&max!==null||index<brackets.length-1&&max===null)throw new RangeError('Invalid tax bracket boundaries');
   const taxableInTier=base<=min?0n:max===null?base-min:(base<max?base:max)-min;
   const taxInTier=applyRate(taxableInTier,rate);
   totalTax+=taxInTier;
   if(base>min)marginalRate=Number(bracket.rate);
   if(max!==null)previous=max;
   return {min:money(min),max:bracket.max===null||bracket.max===undefined?null:money(max),rate:Number(bracket.rate),taxableInTier:money(taxableInTier),taxInTier:money(taxInTier)};
  });
  return {primitive:'progressive_brackets',taxableBase:money(base),totalTax:money(totalTax),marginalRate,effectiveRate:base>0n?Number(totalTax)/Number(base):0,tiers};
 },

 capped_percentage(grossWage,rules){
  if(!Array.isArray(rules)||rules.length>64)throw new TypeError('Invalid contribution rules');
  const wage=minor(grossWage);
  let totalContribution=0n;
  const items=rules.map(rule=>{
   if(!rule||typeof rule!=='object'||Array.isArray(rule))throw new TypeError('Invalid contribution rule');
   const floor=minor(rule.min_Floor!==undefined?rule.min_Floor:rule.exemption??0);
   const rawCap=rule.annual_cap!==undefined?rule.annual_cap:rule.cap;
   const cap=rawCap===null||rawCap===undefined?null:minor(rawCap);
   if(cap!==null&&cap<floor)throw new RangeError('Contribution cap is below its floor');
   const subjectWage=(wage<floor?0n:cap===null?wage-floor:(wage<cap?wage:cap)-floor);
   const rate=rateUnits(rule.rate??0);
   const amount=applyRate(subjectWage,rate);
   totalContribution+=amount;
   return {name:rule.name,rate:Number(rule.rate)||0,floor:money(floor),cap:rawCap===null||rawCap===undefined?null:money(cap),subjectWage:money(subjectWage),amount:money(amount),note:rule.note||''};
  });
  return {primitive:'capped_percentage',grossWage:money(wage),totalContribution:money(totalContribution),effectiveRate:wage>0n?Number(totalContribution)/Number(wage):0,items};
 },

 flat_or_slab_lookup({amount,rate,exemption=0,surtaxOrCessRate=0,mode='exclusive'}){
  const rawAmount=minor(amount),r=rateUnits(rate),ex=minor(exemption),cess=rateUnits(surtaxOrCessRate);
  if(!['inclusive','exclusive'].includes(mode))throw new RangeError('Invalid tax mode');
  if(mode==='inclusive'){
   const baseTax=r>0n?ratio(rawAmount*r,RATE_SCALE+r):0n;
   const netAmount=rawAmount-baseTax;
   const surtaxAmount=applyRate(baseTax,cess);
   const totalTax=baseTax+surtaxAmount;
   return {primitive:'flat_or_slab_lookup',mode:'inclusive',netAmount:money(netAmount),exemptionApplied:0,taxableBase:money(netAmount),rate:Number(rate),baseTax:money(baseTax),surtaxAmount:money(surtaxAmount),totalTax:money(totalTax),grossAmount:money(rawAmount+surtaxAmount),effectiveRate:rawAmount>0n?Number(totalTax)/Number(rawAmount):0};
  }
  const exemptionApplied=rawAmount<ex?rawAmount:ex;
  const taxableBase=rawAmount-exemptionApplied;
  const baseTax=applyRate(taxableBase,r);
  const surtaxAmount=applyRate(baseTax,cess);
  const totalTax=baseTax+surtaxAmount;
  return {primitive:'flat_or_slab_lookup',mode:'exclusive',netAmount:money(rawAmount),exemptionApplied:money(exemptionApplied),taxableBase:money(taxableBase),rate:Number(rate),baseTax:money(baseTax),surtaxAmount:money(surtaxAmount),totalTax:money(totalTax),grossAmount:money(rawAmount+totalTax),effectiveRate:rawAmount>0n?Number(totalTax)/Number(rawAmount):0};
 },

 treaty_offset({grossIncome,sourceDomesticWhtRate,treatyWhtRate,residenceTaxRate,applyTreaty=true}){
  if(typeof applyTreaty!=='boolean')throw new TypeError('Invalid treaty flag');
  const gross=minor(grossIncome),sourceRate=rateUnits(sourceDomesticWhtRate),treatyRate=rateUnits(treatyWhtRate),residenceRate=rateUnits(residenceTaxRate);
  const appliedSourceRate=applyTreaty?(sourceRate<treatyRate?sourceRate:treatyRate):sourceRate;
  const foreignTaxPaid=applyRate(gross,appliedSourceRate);
  const domesticTax=applyRate(gross,residenceRate);
  const treatyCapCandidate=applyRate(gross,treatyRate);
  const treatyCap=treatyCapCandidate<domesticTax?treatyCapCandidate:domesticTax;
  const credit=foreignTaxPaid<treatyCap?foreignTaxPaid:treatyCap;
  const residual=domesticTax>credit?domesticTax-credit:0n;
  const total=foreignTaxPaid+residual;
  const statutorySourceTax=applyRate(gross,sourceRate);
  const savings=statutorySourceTax>foreignTaxPaid?statutorySourceTax-foreignTaxPaid:0n;
  const net=gross>total?gross-total:0n;
  return {primitive:'treaty_offset',grossIncome:money(gross),appliedSourceRate:Number(appliedSourceRate)/Number(RATE_SCALE),foreignTaxPaid:money(foreignTaxPaid),domesticTaxBeforeCredit:money(domesticTax),treatyCapAmount:money(treatyCap),foreignTaxCreditAllowed:money(credit),residualResidenceTax:money(residual),totalGlobalTax:money(total),treatySavingsAtSource:money(savings),netPostTaxIncome:money(net),effectiveGlobalTaxRate:gross>0n?Number(total)/Number(gross):0};
 }
};
export {TaxEnginePrimitives};
