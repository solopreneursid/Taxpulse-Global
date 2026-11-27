import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
test('generated Worker routes and validation',async()=>{
 execFileSync(process.execPath,[new URL('../staging/integrated/build.mjs',import.meta.url).pathname]);
 const temp=mkdtempSync(join(tmpdir(),'taxpulse-'));
 try{
 cpSync(new URL('../staging/integrated/bundle/',import.meta.url),temp,{recursive:true});
 let source=readFileSync(join(temp,'worker.mjs'),'utf8');
 source=source.replace(/import (a\d+) from '\.\/(.*?)';/g,(_,name,file)=>'const '+name+'='+JSON.stringify(readFileSync(join(temp,file),'utf8'))+';');
 writeFileSync(join(temp,'worker.mjs'),source);
 const worker=(await import(pathToFileURL(join(temp,'worker.mjs')).href)).default;
 const call=(path,options)=>worker.fetch(new Request('https://preview.example'+path,options));
 const status=await call('/v1/regulatory/runtime');assert.equal(status.status,200);assert.equal((await status.json()).state,'bundled-preview');const context=await call('/assets/engine/runtime-context.mjs');assert.equal(context.status,200);assert.match(await context.text(),/bundled-preview/);
 const health=await call('/health');assert.equal(health.status,200);const healthBody=await health.json();assert.equal(healthBody.taxRulesVerified,false);assert.equal(healthBody.previewRevision,readFileSync(join(temp,'preview-revision.txt'),'utf8').trim());assert.equal(healthBody.monetization,'disabled');
 const html=await call('/');assert.equal(html.status,200);assert.match(html.headers.get('x-robots-tag'),/noindex/);const simpleHtml=await html.text();assert.match(simpleHtml,/Taxes made easier/);assert.deepEqual([...simpleHtml.matchAll(/https:\/\/[^"'\s<]+/g)].map(m=>m[0]),['https://data.worldbank.org/indicator/PA.NUS.PRVT.PP']);assert.doesNotMatch(simpleHtml,/<(?:script|link)[^>]+(?:src|href)="https?:/i);
 assert.match(html.headers.get('content-security-policy'),/script-src 'self';/);assert.doesNotMatch(html.headers.get('content-security-policy'),/tailwindcss/);
 for(const path of ['/salary','/taxes','/career','/abroad','/money','/business','/tax-rules','/tools/india-ctc','/tools/purchasing-power','/tools/relocation-break-even','/tools/india-deduction-scenario','/tools/business-break-even','/tools/india-tax-cliffs','/tools/india-tax-opportunity','/tools/salary-cliffs','/tools/taxable-income-opportunity','/tools/financial-runway','/tools/standard-indirect-tax','/tools/financial-health','/tools/scoped-corporate-tax','/tools/residential-sdlt','/tools/uk-india-credit','/tools/debt-repayment','/tools/notified-gst','/tools/employer-ni','/tools/au-discount-gain','/tools/investment-scenario','/tools/retirement-scenario','/tools/us-employer-fica','/tools/sg-buyer-duty','/tools/uk-dividend-tax','/tools/scoped-investment-gain','/tools/scoped-transfer-tax','/tools/texas-state-sales-tax','/tools/scoped-treaty-credit','/tools/confirmed-treaty-credit']){const res=await call(path);assert.equal(res.status,200,path);assert.match(res.headers.get('x-robots-tag'),/noindex/);}
 assert.equal((await call('/tools/not-a-tool')).status,404);
 const countryPage=await call('/country/india');assert.equal(countryPage.status,200);assert.match(await countryPage.text(),/<title>India salary and tax examples/);assert.match(countryPage.headers.get('x-robots-tag'),/noindex/);assert.equal((await call('/country/not-a-country')).status,404);
 assert.equal((await call('/advanced-preview')).status,404);
 assert.equal((await call('/assets/application.js')).status,404);
 for(const path of ['/assets/simple.css','/assets/simple.mjs',...['country','primitives','us-filing-statuses','IN','US','GB','DE','AE','CA','AU','SG','manifest','scenarios','taxable-income','proof','fingerprint','reverse-salary'].map(n=>'/assets/engine/'+n+'.mjs')]){
  const asset=await call(path);assert.equal(asset.status,200,path);assert.doesNotMatch(asset.headers.get('content-security-policy'),/tailwindcss/);
  if(path.endsWith('.mjs'))assert.match(asset.headers.get('content-type'),/application\/javascript/);
 }
 assert.equal(await (await call('/',{method:'HEAD'})).text(),'');
 assert.equal((await call('/assets/country-rules.js')).status,404);
 assert.equal((await call('/assets/browser-vault.mjs')).status,404);
 for(const path of ['/assets/engine/browser-vault.mjs','/assets/engine/secure-records.mjs','/assets/engine/document-text.mjs','/assets/local-tools.mjs'])assert.equal((await call(path)).status,200);
 assert.equal((await call('/assets/secure-records.mjs')).status,404);
 const manifest=await call('/app.webmanifest');assert.equal(manifest.status,200);assert.equal((await manifest.json()).display,'standalone');const sw=await call('/sw.js');assert.equal(sw.status,200);assert.equal(sw.headers.get('service-worker-allowed'),'/');assert.match(await sw.text(),/No tax calculations are available offline/);
 const catalog=await (await call('/v1/catalog')).json();assert.equal(catalog.countries.length,8);assert.deepEqual(catalog.countries.map(c=>c.code),['IN','US','GB','DE','AE','CA','AU','SG']);assert.deepEqual(catalog.filingStatusOptions.US,['single','mfj','hoh','mfs']);assert.match(catalog.countries.find(c=>c.code==='IN').taxYearLabel,/2026-27/);
 assert.equal((await (await call('/openapi.json')).json()).openapi,'3.1.0');
 const payload={country:'GB',taxYear:'2026',module:'pit',parameters:{grossSalary:130000}};
 const post=(body,headers={})=>call('/v1/country/calculate',{method:'POST',headers:{'content-type':'application/json',...headers},body});
 const good=await post(JSON.stringify(payload));assert.equal(good.status,200);assert.ok(Math.abs((await good.json()).result.incomeTax-44703)<1e-7);
 assert.equal((await post(JSON.stringify(payload),{origin:'https://other.example'})).status,403);
 assert.equal((await post('{}',{'content-type':'text/plain'})).status,415);
 assert.equal((await post('x'.repeat(17000))).status,413);
 assert.equal((await post('{}',{'content-length':'16385'})).status,413);
 assert.equal((await post(new Uint8Array([123,255,125]))).status,400);
 assert.equal((await post('{')).status,400);
 assert.equal(html.headers.get('x-frame-options'),'DENY');
 assert.equal(html.headers.get('cross-origin-opener-policy'),'same-origin');
 assert.equal(html.headers.get('cross-origin-resource-policy'),'same-origin');
 assert.deepEqual(catalog.modules,['pit']);
 for(const module of ['payroll','capgains','vat','corporate','property','dtaa']){
  assert.ok(catalog.disabledModules[module]);
  assert.equal((await post(JSON.stringify({...payload,module}))).status,400);
 }
 const schema=(await (await call('/openapi.json')).json()).paths['/v1/country/calculate'].post.requestBody.content['application/json'].schema;
 assert.deepEqual(schema.properties.module.enum,catalog.modules);
 const countrySchema=(await (await call('/openapi.json')).json()).paths['/v1/country/calculate'].post.requestBody.content['application/json'].schema.properties.country.enum;assert.deepEqual(countrySchema,['IN','US','GB','DE','AE','CA','AU','SG']);
 const indiaInput={country:'IN',taxYear:'2026',module:'pit',parameters:{grossSalary:1285000,residentIndividual:true}};
 const india=await post(JSON.stringify(indiaInput));assert.equal(india.status,200);const indiaResult=(await india.json()).result;assert.ok(Math.abs(indiaResult.incomeTax-10400)<0.005);assert.ok(Math.abs(indiaResult.marginalReliefApplied-51500)<0.005);
 assert.equal((await post(JSON.stringify({...indiaInput,parameters:{grossSalary:1285000}}))).status,400);
 assert.equal((await post(JSON.stringify({...payload,country:'DE'}))).status,400);
 const extendedCountryCases=[
  ['DE',{taxableIncome:50000,assessment:'individual'}],
  ['AE',{salaryIncome:100000,employeeWagesOnly:true}],
  ['CA',{taxableIncome:50000,netIncome:50000,fullYearResident:true}],
  ['AU',{taxableIncome:50000,residentEligible:true}],
  ['SG',{taxableIncome:50000,residentEligible:true}]
 ];
 for(const [country,parameters] of extendedCountryCases){
  const response=await post(JSON.stringify({country,taxYear:'2026',module:'pit',parameters}));
  assert.equal(response.status,200,country);
  const result=await response.json();
  assert.equal(result.country,country);assert.equal(result.module,'pit');
  assert.equal(result.sampleOnly,true);assert.equal(result.taxRulesVerified,false);
  assert.ok(Number.isFinite(result.incomeTax));
 }
 const assess=await call('/v1/taxable-income/calculate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'DE',taxYear:'2026',taxableIncome:50000,assessment:'individual'})});
 assert.equal(assess.status,200);assert.equal((await assess.json()).incomeTax,10548);
 assert.equal((await call('/v1/taxable-income/calculate')).status,405);
 const indiaCompare=await call('/v1/india/regime-compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'IN',taxYear:'2026',grossSalary:1500000,residentIndividual:true,ageGroup:'under-60',ordinarySalaryOnly:true,oldEligibleDeductions:0,newEligibleDeductions:0})});
 assert.equal(indiaCompare.status,200);assert.equal((await indiaCompare.json()).newRegime.incomeTax,97500);
 assert.equal((await call('/v1/india/regime-compare')).status,405);
 const investment=await call('/v1/investment/capital-gain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'GB',taxYear:'2026',acquired:'2025-06-01',disposed:'2026-06-02',saleProceeds:62600,adjustedBasis:50000,eligibleLosses:0,otherTaxableIncome:20000,scopeConfirmed:true})});
 assert.equal(investment.status,200);assert.equal((await investment.json()).estimatedGainTax,1728);
 assert.equal((await call('/v1/investment/capital-gain')).status,405);
 const crypto=await call('/v1/investment/capital-gain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'IN',taxYear:'2026',assetType:'crypto',acquired:'2024-08-01',disposed:'2026-08-02',saleProceeds:1500000,adjustedBasis:1000000,eligibleLosses:0,otherTaxableIncome:1500000,scopeConfirmed:true})});
 assert.equal(crypto.status,200);assert.equal((await crypto.json()).estimatedGainTax,156000);
 const region=await call('/v1/regional/calculate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'US',region:'PA',taxYear:'2026',income:100000,scopeConfirmed:true})});
 assert.equal(region.status,200);assert.equal((await region.json()).regionalTax,3070);
 assert.equal((await call('/v1/regional/calculate')).status,405);
 const pay=await call('/v1/salary/remainder',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'US',region:'TX',taxYear:'2026',pay:100000,scopeConfirmed:true})});
 assert.equal(pay.status,200);assert.equal((await pay.json()).annualRemainder,79180);
 assert.equal((await call('/v1/salary/remainder')).status,405);
 const contribution=await call('/v1/contributions/calculate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'CA',taxYear:'2026',income:100000,scopeConfirmed:true})});
 assert.equal(contribution.status,200);assert.equal((await contribution.json()).totalEmployeeContribution,5769.52);
 assert.equal((await call('/v1/contributions/calculate')).status,405);
 const businessTax=await call('/v1/business/indirect-tax',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'GB',jurisdiction:'GB',taxYear:'2026',transactionDate:'2026-11-27',amount:100,mode:'exclusive',sellerRegistered:true,standardRatedSupply:true,scopeConfirmed:true})});
 assert.equal(businessTax.status,200);assert.equal((await businessTax.json()).taxAmount,20);
 const corporate=await call('/v1/business/corporate-tax',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'DE',taxYear:'2026',taxableProfit:100000,scopeConfirmed:true})});
 assert.equal(corporate.status,200);assert.equal((await corporate.json()).corporateIncomeTaxComponent,15000);
 const property=await call('/v1/property/transfer-tax',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jurisdiction:'DE-BE',taxableConsideration:100000,transactionDate:'2026-11-27',scopeConfirmed:true})});
 assert.equal(property.status,200);assert.equal((await property.json()).transferTax,6000);
 const scopedGain=await call('/v1/investment/scoped-gain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jurisdiction:'CA',confirmedNetGain:100000,transactionDate:'2026-11-27',scopeConfirmed:true})});
 assert.equal(scopedGain.status,200);assert.equal((await scopedGain.json()).includedGain,50000);
 const treaty=await call('/v1/treaty/credit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({currency:'USD',worldwideIncome:100000,foreignSourceIncome:20000,domesticTaxOnWorldwideIncome:10000,foreignTaxPaid:3000,treatyLimit:2500,taxOnForeignItem:3000,scopeConfirmed:true})});
 assert.equal(treaty.status,200);assert.equal((await treaty.json()).allowedCredit,2000);
 const confirmedTreaty=await call('/v1/treaty/confirmed-credit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jurisdiction:'DE-GB',foreignTaxPaid:500,treatyPermittedTax:600,domesticLimit:700,availableDomesticTax:800,scopeConfirmed:true})});
 assert.equal(confirmedTreaty.status,200);assert.equal((await confirmedTreaty.json()).modeledCredit,500);
 const employer=await call('/v1/employer-payroll/fica',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({annualWages:100000,scopeConfirmed:true})});
 assert.equal(employer.status,200);assert.equal((await employer.json()).employerFica,7650);
 for(const path of ['/v1/business/indirect-tax','/v1/business/corporate-tax','/v1/property/transfer-tax','/v1/investment/scoped-gain','/v1/treaty/credit','/v1/treaty/confirmed-credit','/v1/employer-payroll/fica'])assert.equal((await call(path)).status,405,path);

 const extendedPay=await call('/v1/salary/remainder',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'AU',region:'AU',taxYear:'2026',pay:100000,scopeConfirmed:true})});
 assert.equal(extendedPay.status,200);assert.equal((await extendedPay.json()).annualRemainder,77480);
 const history=await call('/v1/history/rules');assert.equal(history.status,200);assert.equal((await history.json()).rules.length,14);
 const compare=await call('/v1/history/compare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'AU',firstRuleId:'AU-2024-25-resident-ordinary-v1',secondRuleId:'AU-2027-28-resident-ordinary-v1',taxableIncome:100000,scopeConfirmed:true})});
 assert.equal(compare.status,200);assert.equal((await compare.json()).taxChange,-536);
 assert.equal((await call('/v1/history/compare')).status,405);
 const dePay=await call('/v1/salary/remainder',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'DE',region:'DE',taxYear:'2026',pay:5000,annualTaxableIncome:50000,healthSupplementRate:2.9,scopeConfirmed:true})});
 assert.equal(dePay.status,200);assert.equal((await dePay.json()).annualRemainder,36402);
 const aePay=await call('/v1/salary/remainder',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({country:'AE',region:'AE',taxYear:'2026',pay:20000,monthlyBasicSalary:16000,scopeConfirmed:true})});
 assert.equal(aePay.status,200);assert.equal((await aePay.json()).annualRemainder,239937);
 for(const path of ['/salary','/taxes','/career','/abroad','/money','/business','/tax-rules','/tools/salary-remainder','/tools/investment-tax']){const page=await call(path);assert.equal(page.status,200,path);assert.match(await page.text(),/category-card/);}
 assert.equal((await call('/tools/not-a-tool')).status,404);
 assert.equal((await call('/missing')).status,404);
 assert.equal((await call('/v1/country/calculate')).status,405);
 }finally{rmSync(temp,{recursive:true,force:true})}
});
