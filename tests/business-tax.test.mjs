import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIndirectTax,
  calculateCorporateTaxComponent,
  validateBusinessTaxRules
} from '../engine/business-tax.mjs';
import rules from '../rules/business-tax-2026.json' with { type: 'json' };

const supply = (country,jurisdiction,amount,mode='exclusive',extra={}) => ({
  country,jurisdiction,taxYear:'2026',transactionDate:'2026-11-27',amount,mode,
  sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true,...extra
});
const corp = (country,taxableProfit,extra={}) => ({
  country,taxYear:'2026',taxableProfit,scopeConfirmed:true,...extra
});

for (const [country,jurisdiction,rate,currency] of [
  ['GB','GB',2000,'GBP'],['DE','DE',1900,'EUR'],['AU','AU',1000,'AUD'],
  ['SG','SG',900,'SGD'],['AE','AE',500,'AED'],['CA','CA-AB',500,'CAD'],
  ['CA','CA-ON',1300,'CAD'],['CA','CA-NS',1400,'CAD'],
  ['CA','CA-NB',1500,'CAD'],['CA','CA-NL',1500,'CAD'],
  ['CA','CA-PE',1500,'CAD'],['US','US-TX',625,'USD']
]) {
  test(country+' '+jurisdiction+' exclusive standard-rate calculation',() => {
    const result=calculateIndirectTax(supply(country,jurisdiction,100));
    assert.equal(result.rateBasisPoints,rate);
    assert.equal(result.currency,currency);
    assert.equal(result.taxableAmount,100);
    assert.equal(result.taxAmount,rate/100);
    assert.equal(result.grossAmount,100+rate/100);
    assert.equal(result.taxRulesVerified,false);
  });
}
test('inclusive calculation reverses GST and sales tax without floating point',()=>{
  const au=calculateIndirectTax(supply('AU','AU',110,'inclusive'));
  assert.equal(au.taxableAmount,100);assert.equal(au.taxAmount,10);assert.equal(au.grossAmount,110);
  const texas=calculateIndirectTax(supply('US','US-TX',106.25,'inclusive'));
  assert.equal(texas.taxableAmount,100);assert.equal(texas.taxAmount,6.25);
});
test('supply classification, seller registration and place are explicit assertions',()=>{
  assert.throws(()=>calculateIndirectTax(supply('SG','SG',100,'exclusive',{sellerRegistered:false})));
  assert.throws(()=>calculateIndirectTax(supply('DE','DE',100,'exclusive',{standardRatedSupply:false})));
  assert.throws(()=>calculateIndirectTax(supply('CA','CA-ON',100,'exclusive',{jurisdiction:'CA-QC'})));
  assert.throws(()=>calculateIndirectTax(supply('US','US-TX',100,'exclusive',{jurisdiction:'US-CA'})));
  assert.throws(()=>calculateIndirectTax(supply('IN','IN',100)));
  assert.throws(()=>calculateIndirectTax(supply('GB','GB',100,'exclusive',{taxYear:'2025'})));
  assert.throws(()=>calculateIndirectTax(supply('GB','GB',100,'exclusive',{transactionDate:'2027-01-01'})));
  assert.throws(()=>calculateIndirectTax(supply('GB','GB',100,'exclusive',{unexpected:true})));
  assert.throws(()=>calculateIndirectTax(supply('GB','GB',1.001)));
  assert.throws(()=>calculateIndirectTax(supply('GB','GB',100,'other')));
});
test('corporate tax federal and national components use explicit scope',()=>{
  assert.equal(calculateCorporateTaxComponent(corp('US',100000)).corporateIncomeTaxComponent,21000);
  assert.equal(calculateCorporateTaxComponent(corp('DE',100000)).corporateIncomeTaxComponent,15000);
  const ca=calculateCorporateTaxComponent(corp('CA',100000,{
    eligibleSmallBusinessProfit:25000,smallBusinessEligibilityConfirmed:true
  }));
  assert.equal(ca.taxComponents[0].tax,11250);
  assert.equal(ca.taxComponents[1].tax,2250);
  assert.equal(ca.corporateIncomeTaxComponent,13500);
});
test('Canadian small-business allocation cannot exceed profit or proceed without confirmation',()=>{
  assert.throws(()=>calculateCorporateTaxComponent(corp('CA',100000,{
    eligibleSmallBusinessProfit:25000,smallBusinessEligibilityConfirmed:false
  })));
  assert.throws(()=>calculateCorporateTaxComponent(corp('CA',100000,{
    eligibleSmallBusinessProfit:100001,smallBusinessEligibilityConfirmed:true
  })));
});
test('India Section 115BAA base rate requires confirmed regime eligibility',()=>{
 const result=calculateCorporateTaxComponent(corp('IN',1000000,{taxRegime:'115BAA',regimeEligibilityConfirmed:true}));
 assert.equal(result.currency,'INR');assert.equal(result.corporateIncomeTaxComponent,220000);
 assert.equal(result.taxComponents[0].rateBasisPoints,2200);
 assert.ok(result.warnings.some(w=>w.includes('10% surcharge and 4% health and education cess')));
 assert.throws(()=>calculateCorporateTaxComponent(corp('IN',1000000,{taxRegime:'115BAA',regimeEligibilityConfirmed:false})));
});
test('UK corporation tax main rate requires one non-ring-fence company above threshold',()=>{
 const result=calculateCorporateTaxComponent(corp('GB',300000,{mainRateEligibilityConfirmed:true,associatedCompanies:1,ringFenceProfits:false}));
 assert.equal(result.currency,'GBP');assert.equal(result.corporateIncomeTaxComponent,75000);
 assert.throws(()=>calculateCorporateTaxComponent(corp('GB',250000,{mainRateEligibilityConfirmed:true,associatedCompanies:1,ringFenceProfits:false})));
 assert.throws(()=>calculateCorporateTaxComponent(corp('GB',300000,{mainRateEligibilityConfirmed:true,associatedCompanies:2,ringFenceProfits:false})));
 assert.throws(()=>calculateCorporateTaxComponent(corp('GB',300000,{mainRateEligibilityConfirmed:true,associatedCompanies:1,ringFenceProfits:true})));
});
test('Australian 25% company rate requires both base-rate-entity tests',()=>{
 const result=calculateCorporateTaxComponent(corp('AU',100000,{aggregatedTurnoverBelow50m:true,passiveIncomeAtOrBelow80Percent:true}));
 assert.equal(result.currency,'AUD');assert.equal(result.corporateIncomeTaxComponent,25000);
 assert.throws(()=>calculateCorporateTaxComponent(corp('AU',100000,{aggregatedTurnoverBelow50m:true,passiveIncomeAtOrBelow80Percent:false})));
});
test('UAE corporate tax applies 9% only above AED 375,000',()=>{
 const result=calculateCorporateTaxComponent(corp('AE',500000,{qualifyingFreeZoneIncome:false,pillarTwoInScope:false}));
 assert.equal(result.currency,'AED');assert.equal(result.corporateIncomeTaxComponent,11250);
 assert.equal(result.taxComponents[0].taxableProfit,375000);
 assert.equal(result.taxComponents[1].taxableProfit,125000);
 const below=calculateCorporateTaxComponent(corp('AE',300000,{qualifyingFreeZoneIncome:false,pillarTwoInScope:false}));
 assert.equal(below.corporateIncomeTaxComponent,0);
 assert.throws(()=>calculateCorporateTaxComponent(corp('AE',500000,{qualifyingFreeZoneIncome:true,pillarTwoInScope:false})));
 assert.throws(()=>calculateCorporateTaxComponent(corp('AE',500000,{qualifyingFreeZoneIncome:false,pillarTwoInScope:true})));
});
test('Singapore YA 2026 partial and start-up exemptions are separately calculated',()=>{
  const partial=calculateCorporateTaxComponent(corp('SG',200000,{
    reliefScheme:'partial',reliefEligibilityConfirmed:true
  }));
  assert.equal(partial.exemptAmount,102500);
  assert.equal(partial.taxableProfitAfterExemption,97500);
  assert.equal(partial.corporateIncomeTaxComponent,16575);
  const startup=calculateCorporateTaxComponent(corp('SG',200000,{
    reliefScheme:'startup',reliefEligibilityConfirmed:true
  }));
  assert.equal(startup.exemptAmount,125000);
  assert.equal(startup.taxableProfitAfterExemption,75000);
  assert.equal(startup.corporateIncomeTaxComponent,12750);
  assert.throws(()=>calculateCorporateTaxComponent(corp('SG',200000,{
    reliefScheme:'startup',reliefEligibilityConfirmed:false
  })));
});
test('invalid business registry changes fail closed',()=>{
  const invalid=structuredClone(rules);
  invalid.indirectTax[0].rateBasisPoints=20001;
  assert.throws(()=>validateBusinessTaxRules(invalid));
  const badSource=structuredClone(rules);
  badSource.corporateTax[0].sourceUrls=['https://example.com/tax'];
  assert.throws(()=>validateBusinessTaxRules(badSource));
  const overlap=structuredClone(rules);
  overlap.indirectTax.push({...overlap.indirectTax[0],version:'GB-overlap',effectiveFrom:'2026-06-01'});
  assert.throws(()=>validateBusinessTaxRules(overlap));
  const wrongThreshold=structuredClone(rules);wrongThreshold.corporateTax.find(x=>x.country==='AE').zeroRateThreshold=-1;assert.throws(()=>validateBusinessTaxRules(wrongThreshold));
  const wrongCurrency=structuredClone(rules);
  wrongCurrency.indirectTax[0].currency='EUR';
  assert.throws(()=>validateBusinessTaxRules(wrongCurrency));
  const invertedRates=structuredClone(rules);
  invertedRates.corporateTax[1].smallBusinessRateBasisPoints=1600;
  assert.throws(()=>validateBusinessTaxRules(invertedRates));
});
