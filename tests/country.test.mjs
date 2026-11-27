import test from 'node:test';import assert from 'node:assert/strict';import {countryCalculate,catalog} from '../engine/country.mjs';import {readFileSync} from 'node:fs';
const call=(country,module,parameters)=>countryCalculate({country,module,taxYear:'2026',parameters});
for(const country of ['IN','US','GB']){const m=JSON.parse(readFileSync(new URL('../rules/2026/'+country+'.json',import.meta.url))).modules;const cases={pit:{grossSalary:100000,...(country==='IN'?{residentIndividual:true}:{})},payroll:country==='IN'?{region:'IN',pay:1000000,epfMonthlyWage:15000,professionalTaxAnnual:2500,scopeConfirmed:true}:country==='US'?{region:'TX',pay:100000,scopeConfirmed:true}:{region:'RUK',pay:5000,scopeConfirmed:true},capgains:country==='IN'?{acquired:'2020-01-01',disposed:'2026-12-01',saleProceeds:350000,adjustedBasis:100000,eligibleLosses:0,otherTaxableIncome:1500000,assetType:'listed-equity',scopeConfirmed:true}:country==='US'?{acquired:'2020-01-01',disposed:'2026-12-01',saleProceeds:20000,adjustedBasis:10000,eligibleLosses:0,otherTaxableIncome:100000,filingStatus:'single',scopeConfirmed:true}:{acquired:'2020-01-01',disposed:'2026-12-01',saleProceeds:62600,adjustedBasis:50000,eligibleLosses:0,otherTaxableIncome:20000,scopeConfirmed:true},vat:country==='IN'?{classification:'2523-2025-09-22',priceBasis:'exclusive',amount:100,scopeConfirmed:true}:country==='US'?{exclusiveAmount:100,scopeConfirmed:true}:{amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true},corporate:{revenue:100000,expenses:0,regimeId:m.corporate_tax.regimes[0].id},property:country==='IN'?{purchaserCategory:'male',taxableConsideration:1000000,transactionDate:'2026-11-27',scopeConfirmed:true}:country==='US'?{taxableConsideration:300001,transactionDate:'2026-11-27',scopeConfirmed:true}:{consideration:295000,buyerScope:'ordinary',transactionDate:'2026-11-27',scopeConfirmed:true},dtaa:country==='GB'?{foreignTaxPaidGbp:3000,treatyEligibleCapGbp:2500,ukTaxWithIncome:12000,ukTaxWithoutIncome:9000,scopeConfirmed:true}:{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticTax:10000,worldwideTaxableIncome:100000,foreignTaxableIncome:20000,domesticTaxOnItem:3000,scopeConfirmed:true}};for(const [module,parameters] of Object.entries(cases))test(country+' '+module+' sample',()=>{if(module==='payroll'){const r=call(country,module,parameters);assert.equal(r.module,'payroll');assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);assert.ok(Number.isFinite(r.annualRemainder));assert.ok(r.warnings.some(w=>w.includes('not payroll processing')));return;}if(module==='capgains'){const r=call(country,module,parameters);assert.equal(r.module,'capgains');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);assert.ok(r.warnings.some(w=>w.includes('not a complete capital-gains return')));assert.ok(Number.isFinite(r.estimatedGainTax));return;}if(module==='property'){const r=call(country,module,parameters);assert.equal(r.module,'property');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);assert.ok(r.sourceUrls.length>0);assert.ok(r.warnings.some(w=>w.includes('not a complete closing-cost')));assert.ok(Number.isFinite(country==='GB'?r.stampDuty:r.transferTax));return;}if(module==='vat'){const r=call(country,module,parameters);assert.equal(r.module,'vat');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);assert.ok(Number.isFinite(country==='US'?r.stateTax:r.taxAmount));assert.ok(r.sourceUrls.length>0);if(country==='IN')assert.ok(r.warnings.some(w=>w.includes('not a general 2026 India GST')));if(country==='US')assert.equal(r.taxType,'STATE_SALES_TAX');return;}if(module==='dtaa'){const r=call(country,module,parameters);assert.equal(r.module,'dtaa');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);assert.ok(Number.isFinite(r.modeledCredit));assert.ok(r.sourceUrls.length>0);assert.ok(r.warnings.some(w=>w.includes('does not determine treaty entitlement')));return;}if(module!=='pit'){assert.throws(()=>call(country,module,parameters),/Legacy .*disabled/);return;}const r=call(country,module,parameters);assert.equal(r.taxRulesVerified,false);assert.ok(r.result);assert.ok(r.warnings.length>=2);assert.ok(!JSON.stringify(r.result).includes('NaN'))})}
test('indirect-tax API rejects legacy generic slab input and requires a scoped source contract',()=>{assert.throws(()=>call('IN','vat',{amount:100,slabId:'standard_18',mode:'exclusive'}));assert.ok(catalog().modules.includes('vat'));assert.equal(Object.hasOwn(catalog().disabledModules,'vat'),false);});
test('unsupported country, year and invalid input fail closed',()=>{assert.throws(()=>call('DE','pit',{grossSalary:100}));assert.throws(()=>call('IN','pit',{grossSalary:-1}));assert.throws(()=>countryCalculate({country:'IN',taxYear:'2027',module:'pit',parameters:{grossSalary:100}}));assert.throws(()=>call('IN','vat',{amount:100,slabId:'unknown',mode:'exclusive'}));assert.equal(catalog().taxRulesVerified,false)});

const extendedPIT=[
 ['DE',{taxableIncome:50000,assessment:'individual'},'EUR','taxable-income'],
 ['AE',{salaryIncome:100000,employeeWagesOnly:true},'AED','employee-wages'],
 ['CA',{taxableIncome:50000,netIncome:50000,fullYearResident:true},'CAD','taxable-income'],
 ['AU',{taxableIncome:50000,residentEligible:true},'AUD','taxable-income'],
 ['SG',{taxableIncome:50000,residentEligible:true},'SGD','taxable-income']
];
for(const [country,parameters,currency,basis] of extendedPIT)test(country+' scoped PIT backend',()=>{
 const r=call(country,'pit',parameters);
 assert.equal(r.module,'pit');assert.equal(r.currency,currency);assert.equal(r.inputBasis,basis);
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r.incomeTax)&&r.incomeTax>=0);assert.ok(r.sourceUrls.length>0);
 assert.ok(r.warnings.length>=2);
});
test('country backend catalog exposes all eight countries and scoped PIT/payroll modules',()=>{
 const c=catalog();
 assert.deepEqual(c.countries.map(x=>x.code),['IN','US','GB','DE','AE','CA','AU','SG']);
 assert.deepEqual(c.modules,['pit','payroll','capgains','vat','property','dtaa']);
 assert.equal(c.countries.find(x=>x.code==='DE').source,'https://www.gesetze-im-internet.de/estg/__32a.html');
 assert.equal(c.countries.find(x=>x.code==='AE').source,'https://u.ae/en/information-and-services/finance-and-investment/taxation');
 assert.equal(c.pitInputBasis.DE,'taxableIncome with individual or eligible joint assessment');
 assert.equal(c.pitInputBasis.AE,'salaryIncome with employeeWagesOnly=true; ordinary employee wages only');
 assert.equal(c.payrollInputBasis.DE,'monthly EUR gross pay; region DE; requires annualTaxableIncome and healthSupplementRate');
 assert.equal(c.payrollInputBasis.AE,'monthly AED gross pay; region AE; requires monthlyBasicSalary and assumes non-GCC expatriate private-sector employee');
 assert.match(c.payrollScope,/no payroll withholding/);
 assert.equal(c.capgainsInputBasis.CA,'confirmedNetGain and transactionDate; calendar 2026 one-half capital-gain inclusion component only');
 assert.equal(c.capgainsInputBasis.AE,'confirmedNetGain and transactionDate; calendar 2026 natural-person personal investment income exclusion only');
 assert.match(c.capgainsScope,/no complete/i);
 assert.equal(c.propertyInputBasis.IN,'taxableConsideration, transactionDate and purchaserCategory male/female; Delhi sole-purchaser ordinary sale deed');
 assert.equal(c.propertyInputBasis.AE,'taxableConsideration and transactionDate; Dubai sale registration fee, not a tax');
 assert.match(c.propertyScope,/not a full closing-cost/);
 assert.equal(c.dtaaInputBasis.GB,'foreignTaxPaidGbp, treatyEligibleCapGbp, ukTaxWithIncome and ukTaxWithoutIncome; UK–India one-item credit component');
 assert.equal(c.dtaaInputBasis.SG,'foreignTaxPaid, treatyPermittedTax, domesticLimit and availableDomesticTax; Singapore–UK one-item credit component');
 assert.match(c.dtaaScope,/caller must establish treaty eligibility/);
 assert.equal(c.indirectTaxInputBasis.IN,'classification 2523-2025-09-22 (HSN 2523 cement), priceBasis exclusive/inclusive and amount; historical 18% IGST notification example effective 2025-09-22 only');
 assert.equal(c.indirectTaxInputBasis.US,'exclusiveAmount; Texas state sales tax 6.25% component only, local tax excluded; US has no federal VAT');
 assert.match(c.indirectTaxScope,/excludes taxability determination/);
});
test('extended PIT contracts reject missing residency and unsupported assessments',()=>{
 assert.throws(()=>call('DE','pit',{taxableIncome:50000}),/assessment/);
 assert.throws(()=>countryCalculate({country:'DE',taxYear:'2026',module:'pit',parameters:{country:'DE',taxYear:'2026',taxableIncome:50000,assessment:'individual'}}),/must be top-level/);
 assert.throws(()=>call('AE','pit',{salaryIncome:100000,employeeWagesOnly:false}),/Only ordinary employee wages supported/);
 assert.throws(()=>call('CA','pit',{taxableIncome:50000,netIncome:50000,fullYearResident:false}),/full-year resident/);
 assert.throws(()=>call('AU','pit',{taxableIncome:50000,residentEligible:false}),/Resident rate eligibility/);
 assert.throws(()=>call('SG','pit',{taxableIncome:50000,residentEligible:false}),/Resident rate eligibility/);
});

const extendedPayroll=[
 ['DE',{region:'DE',pay:5000,annualTaxableIncome:50000,healthSupplementRate:2.9,scopeConfirmed:true},'EUR'],
 ['AE',{region:'AE',pay:20000,monthlyBasicSalary:16000,scopeConfirmed:true},'AED'],
 ['CA',{region:'AB',pay:100000,scopeConfirmed:true},'CAD'],
 ['AU',{region:'AU',pay:100000,scopeConfirmed:true},'AUD'],
 ['SG',{region:'SG',pay:5000,scopeConfirmed:true},'SGD']
];
for(const [country,parameters,currency] of extendedPayroll)test(country+' scoped salary-remainder backend',()=>{
 const r=call(country,'payroll',parameters);
 assert.equal(r.module,'payroll');assert.equal(r.currency,currency);
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r.annualGross)&&r.annualGross>0);
 assert.ok(Number.isFinite(r.annualRemainder)&&r.annualRemainder>=0);
 assert.ok(Number.isFinite(r.employeeContributions));
 assert.ok(r.sourceUrls.length>0);
 assert.ok(r.warnings.some(w=>w.includes('not payroll processing')));
});
test('payroll contracts reject missing confirmation, wrong region and duplicated context',()=>{
 assert.throws(()=>call('US','payroll',{region:'TX',pay:100000}),/Unsupported salary example/);
 assert.throws(()=>call('US','payroll',{region:'CA',pay:100000,scopeConfirmed:true}),/Unsupported salary region/);
 assert.throws(()=>countryCalculate({country:'US',taxYear:'2026',module:'payroll',parameters:{country:'US',region:'TX',pay:100000,scopeConfirmed:true}}),/must be top-level/);
});

const extendedCapitalGains=[
 ['AU',{proceeds:50000,costBase:30000,eligibleCapitalLosses:2000,otherTaxableIncome:100000,acquired:'2024-06-01',disposed:'2026-11-27',scopeConfirmed:true},'AUD','modeledIncrementalIncomeTax'],
 ['CA',{confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:true},'CAD','includedGain'],
 ['DE',{confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:true},'EUR','modeledTax'],
 ['SG',{confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:true},'SGD','modeledTax'],
 ['AE',{confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:true},'AED','modeledTax']
];
for(const [country,parameters,currency,resultField] of extendedCapitalGains)test(country+' scoped capital-gains backend',()=>{
 const r=call(country,'capgains',parameters);
 assert.equal(r.module,'capgains');assert.equal(r.country,country);assert.equal(r.currency,currency);
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r[resultField]));
 assert.ok(r.sourceUrls.length>0);
});
test('capital-gains dispatch rejects missing scope and duplicated context',()=>{
 assert.throws(()=>call('CA','capgains',{confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:false}));
 assert.throws(()=>call('CA','capgains',{confirmedNetGain:10000,transactionDate:'2027-01-01',scopeConfirmed:true}));
 assert.throws(()=>countryCalculate({country:'CA',taxYear:'2026',module:'capgains',parameters:{country:'CA',confirmedNetGain:10000,transactionDate:'2026-11-27',scopeConfirmed:true}}),/top-level request context/);
});

const extendedProperty=[
 ['DE',{taxableConsideration:100000,transactionDate:'2026-11-27',scopeConfirmed:true},'transferTax'],
 ['AE',{taxableConsideration:100000,transactionDate:'2026-11-27',scopeConfirmed:true},'transferTax'],
 ['CA',{taxableConsideration:400000,transactionDate:'2026-11-27',scopeConfirmed:true},'transferTax'],
 ['AU',{taxableConsideration:1350000,transactionDate:'2026-11-27',scopeConfirmed:true},'transferTax'],
 ['SG',{purchasePrice:4500100,marketValue:4500100,propertyType:'residential',transactionDate:'2026-11-27',scopeConfirmed:true},'buyerStampDuty']
];
for(const [country,parameters,resultField] of extendedProperty)test(country+' scoped property backend',()=>{
 const r=call(country,'property',parameters);
 assert.equal(r.module,'property');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r[resultField]));assert.ok(r.sourceUrls.length>0);
 if(country==='AE')assert.equal(r.chargeType,'registration-fee');
});
test('property dispatch rejects unsupported purchaser categories and dates',()=>{
 assert.throws(()=>call('IN','property',{taxableConsideration:1000000,transactionDate:'2026-11-27',scopeConfirmed:true}));
 assert.throws(()=>call('IN','property',{purchaserCategory:'other',taxableConsideration:1000000,transactionDate:'2026-11-27',scopeConfirmed:true}));
 assert.throws(()=>call('SG','property',{purchasePrice:100000,marketValue:100000,propertyType:'mixed',transactionDate:'2026-11-27',scopeConfirmed:true}));
 assert.throws(()=>call('GB','property',{consideration:295000,buyerScope:'ordinary',transactionDate:'2027-01-01',scopeConfirmed:true}));
});

const extendedTreaty=[
 ['CA',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:true}],
 ['AU',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:true}],
 ['DE',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:true}],
 ['SG',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:true}],
 ['AE',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:true}]
];
for(const [country,parameters] of extendedTreaty)test(country+' scoped treaty-credit backend',()=>{
 const r=call(country,'dtaa',parameters);
 assert.equal(r.module,'dtaa');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r.modeledCredit));assert.ok(r.sourceUrls.length>0);
});
test('treaty-credit dispatch rejects unconfirmed limits and duplicated context',()=>{
 assert.throws(()=>call('CA','dtaa',{foreignTaxPaid:3000,treatyPermittedTax:2500,domesticLimit:2000,availableDomesticTax:5000,scopeConfirmed:false}));
 assert.throws(()=>countryCalculate({country:'US',taxYear:'2026',module:'dtaa',parameters:{jurisdiction:'US-GB',foreignTaxPaid:3000,treatyPermittedTax:2500,domesticTax:10000,worldwideTaxableIncome:100000,foreignTaxableIncome:20000,domesticTaxOnItem:3000,scopeConfirmed:true}}),/top-level request context/);
});

const extendedIndirectTax=[
 ['DE',{amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}],
 ['AE',{amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}],
 ['CA',{province:'ON',amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}],
 ['AU',{amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}],
 ['SG',{amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}]
];
for(const [country,parameters] of extendedIndirectTax)test(country+' scoped indirect-tax backend',()=>{
 const r=call(country,'vat',parameters);
 assert.equal(r.module,'vat');assert.equal(r.country,country);assert.equal(r.taxYear,'2026');
 assert.equal(r.sampleOnly,true);assert.equal(r.taxRulesVerified,false);
 assert.ok(Number.isFinite(r.taxAmount));assert.ok(r.sourceUrls.length>0);
});
test('indirect-tax dispatch rejects unconfirmed classification and unsupported regions',()=>{
 assert.throws(()=>call('IN','vat',{classification:'2523-2025-09-22',priceBasis:'exclusive',amount:100,scopeConfirmed:false}));
 assert.throws(()=>call('US','vat',{exclusiveAmount:100,scopeConfirmed:false}));
 assert.throws(()=>call('CA','vat',{province:'QC',amount:100,mode:'exclusive',transactionDate:'2026-11-27',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true}));
});
