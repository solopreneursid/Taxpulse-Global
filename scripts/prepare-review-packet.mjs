import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {catalog} from '../engine/country.mjs';
import {assertProductionReady} from '../engine/release-gate.mjs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const sha=b=>createHash('sha256').update(b).digest('hex');
const countries=['IN','US','GB','CA','AU','DE','SG','AE'];
const modules=['pit','payroll','capgains','vat','corporate','property','dtaa'];
const sortedFiles=(directory,pattern)=>readdirSync(new URL(directory+'/',root),{withFileTypes:true}).filter(e=>e.isFile()&&pattern.test(e.name)).map(e=>directory+'/'+e.name).sort();
export function prepareReviewPacket(){
 const manifest=JSON.parse(read('rules/manifest.json')),backend=catalog();
 const coverage=JSON.parse(read('rules/scoped-coverage.json'));if(coverage.schemaVersion!==1||!Array.isArray(coverage.scopes)||coverage.scopes.length!==56||new Set(coverage.scopes.map(s=>s.country+'/'+s.module)).size!==56)throw Error('Invalid scoped coverage inventory');
 const evidence=sortedFiles('rules/evidence',/\.json$/),notes=sortedFiles('rules/review-notes',/\.md$/);
 const files=[...new Set(['rules/manifest.json','rules/scoped-coverage.json','rules/supplemental-monitor-sources.json','rules/statutory-review-2026-11-25.md','rules/monitor-sources.json','rules/national-investment-2026.json','rules/india-salary-versions.json','rules/regional-versions.json','rules/payroll-versions.json',...countries.map(c=>'rules/2026/'+c+'.json'),...evidence,...notes,...sortedFiles('engine',/\.mjs$/),...sortedFiles('migrations',/\.sql$/),...sortedFiles('scripts',/\.mjs$/),...sortedFiles('data',/\.json$/),...sortedFiles('.github/workflows',/\.yml$/),...sortedFiles('tests',/\.test\.mjs$/),'staging/integrated/worker.mjs','staging/integrated/build.mjs','staging/simple/index.html','staging/simple/simple.mjs','staging/simple/local-tools.mjs','staging/simple/simple.css','browser-tests/smoke.mjs','browser-tests/hosted-smoke.mjs','package-lock.json','REGULATORY-PUBLISHER-RUNBOOK.md','REGULATORY-UPDATE-PIPELINE.md','REGULATORY-COLLECTOR-ENROLLMENT.md','RELEASE-2-CHECKLIST.md','REVIEW-HANDOFF.md','docs/PHASE-60-EIGHT-COUNTRY-PIT-BACKEND.md'])].sort();
 const inventory=files.map(path=>({path,sha256:sha(read(path))}));
 const scopes=countries.flatMap(country=>modules.map(module=>{
  const r=manifest.countries[country],recorded=r.evidence.filter(e=>e.module===module),example=coverage.scopes.find(s=>s.country===country&&s.module===module);if(!example||!['scoped-example','not-implemented'].includes(example.status)||example.independentApproval!==false||!['tax-component','analogous-component'].includes(example.coverageKind)||typeof example.remaining!=='string'||(example.status==='scoped-example'?typeof example.scope!=='string':example.scope!==null))throw Error('Invalid scope inventory row');
  return {country,module,scopedPreviewStatus:example.status,scopedPreviewDescription:example.scope,coverageKind:example.coverageKind,remainingEngineering:example.remaining,backendCatalogPresent:backend.countries.some(c=>c.code===country)&&backend.modules.includes(module),recordedEvidenceCount:recorded.length,manifestVerified:r.verification==='verified',productionEnabled:r.productionEnabled===true,independentReview:'not established by this packet'};
 }));
 let releaseGate;try{assertProductionReady(manifest);throw Error('unexpected approval without authorization');}catch(e){releaseGate=String(e.message);}
 if(releaseGate==='unexpected approval without authorization')throw Error(releaseGate);
 return {schemaVersion:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),releaseMode:manifest.releaseMode,releaseGate,reviewStatus:'pending',scopes,inventory,limitations:['Hashes identify exact source files, not statutory accuracy or actual deployed artifact bytes.','No external reviewer identity, review signature, release signature or private key is created.','Source review records are preliminary. Review all relevant rules and effective dates independently.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Usage: node scripts/prepare-review-packet.mjs OUTPUT.json');
 const packet=prepareReviewPacket();writeFileSync(process.argv[2],JSON.stringify(packet,null,2)+'\n',{flag:'wx'});console.log('Review packet prepared: '+packet.scopes.length+' country/module scopes; '+packet.inventory.length+' hashed files; '+packet.releaseGate);
}
