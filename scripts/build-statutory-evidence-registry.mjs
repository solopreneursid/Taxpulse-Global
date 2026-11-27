import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const COUNTRIES=['IN','US','GB','CA','AU','DE','SG','AE'];
const COUNTRY_ALIASES={
 IN:['india'],US:['united states','usa'],GB:['united kingdom','great britain','uk'],
 CA:['canada'],AU:['australia'],DE:['germany','deutschland'],SG:['singapore'],
 AE:['united arab emirates','uae','emirates']
};
const MODULES=['pit','payroll','capgains','vat','corporate','property','dtaa'];
const MODULE_SOURCE_REGISTRIES={
 pit:['rules/national-investment-2026.json'],
 payroll:['rules/payroll-versions.json'],
 capgains:['rules/national-investment-2026.json'],
 vat:['rules/business-tax-2026.json'],
 corporate:['rules/business-tax-2026.json'],
 property:['rules/national-investment-2026.json','rules/business-tax-2026.json'],
 dtaa:['rules/national-investment-2026.json']
};
const MODULE_EVIDENCE={
 pit:['de-ca-2026-assessment-review.json','india-2026-rebate-marginal-relief-review.json','india-2026-regime-compare.json','pit-independent-vectors-2026-11-25.json','initial-review-2026-11-25.json','history-2026-review.json'],
 payroll:['au-sg-ae-2026-review.json','contributions-2026-review.json','extended-salary-2026-review.json','german-emirati-salary-2026-review.json','salary-remainder-2026-review.json'],
 capgains:['capital-gains-2026-review.json','property-crypto-2026-review.json','history-expansion-2026-review.json'],
 vat:['au-sg-ae-2026-review.json','initial-review-2026-11-25.json','history-2026-review.json'],
 corporate:['initial-review-2026-11-25.json','history-2026-review.json'],
 property:['property-crypto-2026-review.json','regional-2026-review.json'],
 dtaa:['initial-review-2026-11-25.json','history-2026-review.json']
};
const EVIDENCE_COUNTRY_OVERRIDES={
 'au-sg-ae-2026-review.json':['AU','SG','AE'],
 'de-ca-2026-assessment-review.json':['DE','CA'],
 'german-emirati-salary-2026-review.json':['DE','AE'],
 'india-2026-rebate-marginal-relief-review.json':['IN'],
 'india-2026-regime-compare.json':['IN']
};
const MODULE_IMPLEMENTATION_FILES={
 pit:['engine/national-registry.mjs','engine/taxable-income.mjs','staging/integrated/worker.mjs'],
 payroll:['engine/payroll-registry.mjs','engine/taxable-income.mjs','engine/employer-payroll.mjs','staging/integrated/worker.mjs'],
 capgains:['engine/national-investment.mjs','engine/decision-tools.mjs','staging/integrated/worker.mjs'],
 vat:['engine/business-tax.mjs','engine/decision-tools.mjs','staging/integrated/worker.mjs'],
 corporate:['engine/business-tax.mjs','staging/integrated/worker.mjs'],
 property:['engine/decision-tools.mjs','staging/integrated/worker.mjs'],
 dtaa:['engine/treaty-credit.mjs','engine/decision-tools.mjs','staging/integrated/worker.mjs']
};
const MODULE_TEST_FILES={
 pit:['tests/country.test.mjs','tests/new-country-assessments.test.mjs','tests/official-pit-vectors.test.mjs','tests/pit-audit.test.mjs','tests/statutory-context.test.mjs','tests/statutory-us-gb.test.mjs','tests/statutory-de.test.mjs','tests/statutory-ca-au.test.mjs','tests/statutory-sg.test.mjs','tests/statutory-ae.test.mjs','tests/statutory-india.test.mjs','tests/taxable-income.test.mjs'],
 payroll:['tests/salary-remainder.test.mjs','tests/extended-salary.test.mjs','tests/german-emirati-salary.test.mjs','tests/contributions.test.mjs','tests/employer-payroll.test.mjs','tests/payroll-registry.test.mjs'],
 capgains:['tests/capital-gain.test.mjs','tests/property-crypto.test.mjs','tests/decision-tools.test.mjs'],
 vat:['tests/business-tax.test.mjs','tests/decision-tools.test.mjs'],
 corporate:['tests/business-tax.test.mjs','tests/decision-tools.test.mjs'],
 property:['tests/property-crypto.test.mjs','tests/decision-tools.test.mjs'],
 dtaa:['tests/treaty-credit.test.mjs','tests/decision-tools.test.mjs']
};
const EVIDENCE_DIR='rules/evidence';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const absolute=path=>resolve(ROOT,path);
const readText=path=>readFileSync(absolute(path),'utf8');
const readJson=path=>JSON.parse(readText(path));
const exists=path=>existsSync(absolute(path));
const unique=values=>[...new Set(values)].sort();
function normalizeUrl(value){
 try{
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol))return null;
  return url.toString().replace(/[),.;]+$/,'');
 }catch{return null;}
}
function walkUrls(value,country,urls,context=null){
 if(Array.isArray(value)){
  for(const child of value)walkUrls(child,country,urls,context);
  return;
 }
 if(value&&typeof value==='object'){
  let next=context;
  for(const key of ['jurisdiction','country','countryCode','isoCountryCode']){
   const candidate=value[key];
   if(typeof candidate==='string'&&COUNTRIES.includes(candidate.toUpperCase()))next=candidate.toUpperCase();
  }
  for(const key of ['jurisdictions','countries','countryCodes']){
   const candidates=value[key];
   if(Array.isArray(candidates)&&candidates.some(item=>String(item).toUpperCase()===country))next=country;
  }
  for(const [key,child] of Object.entries(value)){
   if(COUNTRIES.includes(key.toUpperCase()))walkUrls(child,country,urls,key.toUpperCase());
   else walkUrls(child,country,urls,next);
  }
  return;
 }
 if(typeof value==='string'&&context===country){
  const url=normalizeUrl(value);
  if(url)urls.add(url);
 }
}
function fileCountryContext(path,country){
 const normalized=path.toLowerCase();
 if(normalized===`rules/2026/${country.toLowerCase()}.json`)return true;
 const name=path.split('/').at(-1);
 if((EVIDENCE_COUNTRY_OVERRIDES[name]||[]).includes(country))return true;
 const aliases=COUNTRY_ALIASES[country]||[];
 return aliases.some(alias=>normalized.includes(alias.replaceAll(' ','-'))||normalized.includes(alias.replaceAll(' ','_')));
}
function evidenceAppliesToCountry(path,country){
 const name=path.split('/').at(-1);
 if((EVIDENCE_COUNTRY_OVERRIDES[name]||[]).includes(country))return true;
 try{
  const value=readJson(path);
  let found=false;
  const visit=node=>{
   if(found)return;
   if(Array.isArray(node)){
    if(node.some(item=>String(item).toUpperCase()===country))found=true;
    else for(const child of node)visit(child);
   }else if(node&&typeof node==='object'){
    for(const key of ['jurisdiction','country','countryCode','isoCountryCode']){
     if(String(node[key]||'').toUpperCase()===country)found=true;
    }
    for(const key of ['jurisdictions','countries','countryCodes']){
     if(Array.isArray(node[key])&&node[key].some(item=>String(item).toUpperCase()===country))found=true;
    }
    if(Object.hasOwn(node,country))found=true;
    for(const child of Object.values(node))visit(child);
   }
  };
  visit(value);
  return found;
 }catch{return fileCountryContext(path,country);}
}
function sourceFilesFor(country,module,evidenceFiles){
 const candidates=[
  `rules/2026/${country}.json`,
  ...(MODULE_SOURCE_REGISTRIES[module]||[]),
  ...(MODULE_EVIDENCE[module]||[]).map(name=>`${EVIDENCE_DIR}/${name}`)
 ];
 return unique(candidates.filter(path=>exists(path)&&(
  path.startsWith('rules/2026/')||
  MODULE_SOURCE_REGISTRIES[module]?.includes(path)||
  evidenceFiles.includes(path)&&evidenceAppliesToCountry(path,country)
 )));
}
function collectSourceRecords(paths,country){
 const records=[];
 for(const path of paths){
  let data;
  try{data=readJson(path);}catch{data=readText(path);}
  const urls=new Set();
  const context=fileCountryContext(path,country)?country:null;
  walkUrls(data,country,urls,context);
  for(const url of urls)records.push({
   url,
   sourceFile:path,
   associationMethod:context?'country-scoped-file':'jurisdiction-keyed-record',
   validationStatus:'recorded-reference-not-independently-validated'
  });
 }
 const byUrl=new Map();
 for(const record of records){
  const current=byUrl.get(record.url);
  if(!current||record.sourceFile<current.sourceFile)byUrl.set(record.url,record);
 }
 return [...byUrl.values()].sort((a,b)=>a.url.localeCompare(b.url));
}

export function buildStatutoryEvidenceRegistry(){
 const inventoryPath='rules/scoped-coverage.json';
 const inventory=readJson(inventoryPath);
 const evidenceFiles=readdirSync(absolute(EVIDENCE_DIR)).filter(name=>name.endsWith('.json')).map(name=>`${EVIDENCE_DIR}/${name}`).sort();
 const scopes=[...inventory.scopes].sort((a,b)=>a.country.localeCompare(b.country)||a.module.localeCompare(b.module));
 const entries=scopes.map(scope=>{
  const sourcePaths=sourceFilesFor(scope.country,scope.module,evidenceFiles);
  const sourceReferences=collectSourceRecords(sourcePaths,scope.country);
  const testFiles=unique((MODULE_TEST_FILES[scope.module]||[]).filter(exists));
  const independentReferenceFiles=scope.module==='pit'
   ?sourcePaths.filter(path=>path.includes('pit-independent-vectors'))
   :[];
  const sourceMetadataFiles=sourcePaths.map(path=>({path,localMetadataSha256:sha256(readText(path))}));
  const implementationFiles=unique((MODULE_IMPLEMENTATION_FILES[scope.module]||[]).filter(exists));
  return {
   scopeId:`${scope.country}:${scope.module}`,
   jurisdiction:scope.country,
   module:scope.module,
   scopeDescription:scope.scope,
   inventoryStatus:scope.status,
   coverageKind:scope.coverageKind,
   knownGaps:scope.remaining||'No gap description supplied; statutory completeness is not established.',
   sourceStatus:sourceReferences.length?'recorded-source-urls':'no-source-urls-recorded',
   sourceReferences,
   sourceMetadataFiles,
   implementationFiles,
   testStatus:testFiles.length?'module-test-file-references-only':'no-test-file-reference-recorded',
   testFiles,
   independentReferenceStatus:independentReferenceFiles.length?'independent-reference-vector-file-recorded':'independent-reference-vectors-not-recorded',
   independentReferenceFiles,
   independentApprovalStatus:'not-established',
   productionEnabled:false,
   releaseStatus:'blocked-pending-statutory-completeness-and-independent-approval'
  };
 });
 const summary={
  requiredScopes:entries.length,
  jurisdictions:unique(entries.map(entry=>entry.jurisdiction)).length,
  modules:unique(entries.map(entry=>entry.module)).length,
  sourceLinkedScopes:entries.filter(entry=>entry.sourceReferences.length>0).length,
  sourceMissingScopes:entries.filter(entry=>entry.sourceReferences.length===0).length,
  moduleTestReferencedScopes:entries.filter(entry=>entry.testFiles.length>0).length,
  independentReferenceScopes:entries.filter(entry=>entry.independentReferenceFiles.length>0).length,
  independentlyApprovedScopes:entries.filter(entry=>entry.independentApprovalStatus==='approved').length,
  productionEnabledScopes:entries.filter(entry=>entry.productionEnabled).length
 };
 const payload={
  schemaVersion:1,
  registryId:'taxpulse-statutory-evidence-registry',
  taxYear:'2026',
  generatedFrom:{
   scopeInventory:{path:inventoryPath,localMetadataSha256:sha256(readText(inventoryPath))},
   evidenceDirectory:EVIDENCE_DIR,
   sourceAssociationPolicy:'Country-keyed or explicitly country-scoped source metadata only; URLs are recorded references and are not independently validated by this generator.'
  },
  summary,
  entries
 };
 return {...payload,registryDigestSha256:sha256(JSON.stringify(payload))};
}
export function writeStatutoryEvidenceRegistry(){
 const registry=buildStatutoryEvidenceRegistry();
 const output=absolute('rules/statutory-evidence-registry.json');
 writeFileSync(output,JSON.stringify(registry,null,2)+'\n');
 return registry;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const registry=writeStatutoryEvidenceRegistry();
 console.log(JSON.stringify(registry.summary));
}
