import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync,writeFileSync} from 'node:fs';
const target=JSON.parse(readFileSync(new URL('../data/hosted-preview-check.json',import.meta.url),'utf8'));
const origin='https://hqventures-taxpulse-integrated-preview.solopreneursid-proy.workers.dev';
assert.match(target.revision,/^[a-f0-9]{64}$/);
async function get(path){const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000),redirect:'error',headers:{'cache-control':'no-cache'}});assert.equal(r.status,200,path);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);return r;}
const health=await (await get('/health')).json();assert.equal(health.previewRevision,target.revision);assert.equal(health.taxRulesVerified,false);assert.equal(health.monetization,'disabled');
const status=await (await get('/v1/regulatory/status')).json();assert.equal(status.monitoring.configuredSources,target.sourceCount);assert.equal(status.monitoring.taxRulesVerified,false);
const runtime=await (await get('/v1/regulatory/runtime')).json();assert.equal(runtime.state,target.runtimeState);
const home=await get('/');
for(const [name,value] of Object.entries({'x-frame-options':'DENY','x-content-type-options':'nosniff','referrer-policy':'no-referrer','cross-origin-opener-policy':'same-origin','cross-origin-resource-policy':'same-origin','cache-control':'no-store'}))assert.equal(home.headers.get(name),value,name);
for(const directive of ["connect-src 'none'","form-action 'none'","frame-ancestors 'none'","script-src 'self'"])assert.ok(home.headers.get('content-security-policy').includes(directive),directive);
assert.equal((await fetch(origin+'/tools/not-a-tool',{redirect:'error'})).status,404);
assert.equal((await fetch(origin+'/v1/salary/remainder',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);
const routes=[['/','tools'],['/salary','category-salary'],['/taxes','category-taxes'],['/career','category-career'],['/abroad','category-abroad'],['/money','category-money'],['/business','business'],['/tax-rules','updates']];
const tools=['salary-remainder','reverse-salary','india-ctc','my-tax','india-regimes','taxable-income','employee-contributions','regional-tax','investment-tax','time-machine','india-deduction-scenario','salary-offers','salary-negotiation','compensation','compare','international-salary','purchasing-power','relocation-break-even','monthly-budget','business-break-even','india-tax-cliffs','india-tax-opportunity','salary-cliffs','taxable-income-opportunity','financial-runway','standard-indirect-tax','financial-health','scoped-corporate-tax','residential-sdlt','uk-india-credit','debt-repayment','notified-gst','employer-ni','au-discount-gain','investment-scenario','retirement-scenario','us-employer-fica','sg-buyer-duty','uk-dividend-tax','scoped-investment-gain','scoped-transfer-tax','texas-state-sales-tax','scoped-treaty-credit','confirmed-treaty-credit'];
const results=[];
const browser=await chromium.launch({headless:true});try{
 for(const width of [320,390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  try{
   const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
   if(width===320){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
   for(const [path,id] of [...routes,...tools.map(id=>['/tools/'+id,id])]){
    const start=performance.now();
    const response=await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200,path);
    await page.locator('#'+id).waitFor({state:'visible',timeout:20000});
    const elapsed=Math.round(performance.now()-start);
    assert.ok(elapsed<20000,'Route readiness exceeds 20s: '+path);
    const a=await page.evaluate(()=>({
     overflow:document.documentElement.scrollWidth>innerWidth,
     duplicateIds:[...document.querySelectorAll('[id]')].map(e=>e.id).filter((id,i,all)=>all.indexOf(id)!==i),
     unlabeled:[...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>e.id),
     missingDescriptions:[...document.querySelectorAll('[aria-describedby]')].flatMap(e=>e.getAttribute('aria-describedby').split(/\s+/).filter(id=>!document.getElementById(id)))
    }));
    assert.deepEqual(a,{overflow:false,duplicateIds:[],unlabeled:[],missingDescriptions:[]},path+' accessibility/layout');
    if(path==='/'){assert.equal(await page.locator('#tools .category-card').count(),6);assert.equal(await page.locator('#tools .tool-link').count(),44);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('skip')),true);await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');}
    if(path==='/money'){
     const archive=page.locator('#planning-archive');if(!(await archive.evaluate(el=>el.open)))await archive.locator('summary').click();
     for(const [k,v] of Object.entries({monthlyIncome:5000,monthlyExpenses:4000,liquidSavings:8000,reserveFloor:6000,horizonMonths:12,incomeReductionPercent:50,expenseIncreasePercent:25,shockStartMonth:2,shockDurationMonths:3}))await page.locator('#cash-flow-stress-'+k).fill(String(v));
     await page.locator('#cash-flow-stress-run').click();await page.locator('#cash-flow-stress-result').waitFor({state:'visible',timeout:10000});
     const stress=await page.locator('#cash-flow-stress-result').innerText();assert.match(stress,/Stress ending savings/);assert.match(stress,/9,500/);assert.match(stress,/First reserve breach month/);
     results.push({width,action:'financial-twin-cash-flow-stress',endingSavings:'9,500',reserveBreachMonth:3});
    }
    if(id==='updates'){await page.locator('.regulatory-panel').waitFor({state:'visible',timeout:20000});assert.equal(await page.locator('.regulatory-source').count(),target.sourceCount);}
    if(id==='business-break-even'){
     for(const [k,v] of Object.entries({unitPrice:1000,unitVariableCost:400,monthlyFixedCosts:30000,monthlyUnits:80,targetMonthlySurplus:15000}))await page.locator('#business-break-even-'+k).fill(String(v));
     const calculationStart=performance.now();await page.locator('#business-break-even-form button[type=submit]').click();await page.locator('#business-break-even-result').waitFor();
     assert.match(await page.locator('#business-break-even-breakdown').innerText(),/Whole units to break even\s*50/);
     assert.match(await page.locator('#business-break-even-breakdown').innerText(),/Whole units for surplus goal\s*75/);
     results.push({width,action:'business-calculation',elapsedMs:Math.round(performance.now()-calculationStart)});
    }
    results.push({width,path,readyMs:elapsed});
   }
   assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.url.startsWith(origin+'/')&&r.method==='GET'),'Unexpected outbound browser request');
  }finally{await context.close();}
 }
}finally{await browser.close();}
const report={revision:target.revision,environment:'GitHub-hosted Chromium; 4x CPU slowdown at 320px; not physical mobile or WCAG certification',results};
writeFileSync('hosted-verification-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Hosted checks passed: 6 workspaces, 44 tool routes, 3 widths; exact revision '+target.revision);
