import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {catalog} from '../engine/country.mjs';
import {payrollRules} from '../engine/payroll-registry.mjs';
import {assertProductionReady} from '../engine/release-gate.mjs';

const root=new URL('../',import.meta.url);
const readJson=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const REQUIRED_COUNTRIES=Object.freeze(['IN','US','GB','DE','AE','CA','AU','SG']);
const REQUIRED_MODULES=Object.freeze(['pit','payroll','capgains','vat','corporate','property','dtaa']);

export function buildVerificationAudit(){
 const manifest=readJson('rules/manifest.json');
 const coverage=readJson('rules/scoped-coverage.json');
 if(manifest.schemaVersion!==1||coverage.schemaVersion!==1||!Array.isArray(coverage.scopes))throw Error('Invalid statutory evidence inputs');
 const keys=new Set();
 for(const row of coverage.scopes){
  if(!row||!REQUIRED_COUNTRIES.includes(row.country)||!REQUIRED_MODULES.includes(row.module))throw Error('Unknown statutory scope');
  const key=row.country+'/'+row.module;
  if(keys.has(key))throw Error('Duplicate statutory scope: '+key);
  keys.add(key);
  if(!['scoped-example','not-implemented'].includes(row.status)||row.independentApproval!==false||!['tax-component','analogous-component'].includes(row.coverageKind)||typeof row.remaining!=='string')throw Error('Invalid coverage classification: '+key);
  if(row.status==='scoped-example'&&typeof row.scope!=='string'||row.status==='not-implemented'&&row.scope!==null)throw Error('Invalid scope description: '+key);
 }
 if(coverage.scopes.length!==56||keys.size!==56)throw Error('Expected exactly 56 unique country/module scopes');
 const backend=catalog();
 const payroll=payrollRules();
 const payrollJurisdictions=[...new Set(payroll.map(r=>r.jurisdiction))].sort();
 const evidence=REQUIRED_COUNTRIES.flatMap(country=>{
  const entry=manifest.countries?.[country];
  if(!entry)throw Error('Missing manifest country: '+country);
  return REQUIRED_MODULES.map(module=>{
   const recorded=(Array.isArray(entry.evidence)?entry.evidence:[]).filter(item=>item?.module===module);
   return {country,module,verification:entry.verification,productionEnabled:entry.productionEnabled===true,recordedEvidenceCount:recorded.length,independentApproval:recorded.some(item=>item?.independentApproval===true)};
  });
 });
 let releaseGate;
 try{assertProductionReady(manifest);releaseGate={blocked:false,reason:null};}
 catch(error){releaseGate={blocked:true,reason:String(error.message||error)};}
 const scopeCounts=Object.fromEntries(['scoped-example','not-implemented'].map(status=>[status,coverage.scopes.filter(row=>row.status===status).length]));
 const moduleCoverage=REQUIRED_MODULES.map(module=>({
  module,
  scopedExamples:coverage.scopes.filter(row=>row.module===module&&row.status==='scoped-example').length,
  notImplemented:coverage.scopes.filter(row=>row.module===module&&row.status==='not-implemented').length,
  independentApprovals:coverage.scopes.filter(row=>row.module===module&&row.independentApproval===true).length
 }));
 return {
  schemaVersion:1,
  reportType:'engineering-verification-inventory',
  statutoryScopeCount:coverage.scopes.length,
  countryCount:REQUIRED_COUNTRIES.length,
  moduleCount:REQUIRED_MODULES.length,
  scopeCounts,
  moduleCoverage,
  scopes:coverage.scopes.map(row=>({
   country:row.country,module:row.module,status:row.status,coverageKind:row.coverageKind,
   scope:row.scope,remaining:row.remaining,independentApproval:false
  })),
  payroll:{
   registryVersionCount:payroll.length,
   jurisdictions:payrollJurisdictions,
   missingJurisdictions:REQUIRED_COUNTRIES.filter(country=>!payrollJurisdictions.includes(country)),
   status:'partial-preview-only',
   productionEnabled:false,
   note:'A payroll registry entry is not a complete payroll engine. The current registry has no DE or AE payroll component and all entries remain legally unverified.'
  },
  backend:{
   countries:backend.countries.map(row=>row.code).sort(),
   activeModules:backend.modules,
   disabledModules:backend.disabledModules,
   taxRulesVerified:backend.taxRulesVerified===true,
   sampleOnly:backend.sampleOnly===true
  },
  evidence:{
   scopeRecords:evidence.length,
   recordedApprovalEvidence:evidence.reduce((n,row)=>n+row.recordedEvidenceCount,0),
   independentApprovals:evidence.filter(row=>row.independentApproval).length,
   unverifiedScopes:evidence.filter(row=>row.verification!=='verified').length,
   productionEnabledScopes:evidence.filter(row=>row.productionEnabled).length
  },
  releaseGate,
  releaseMode:manifest.releaseMode,
  productionAuthorized:false,
  limitations:[
   'This report inventories implementation and evidence state; it does not establish legal correctness.',
   'A scoped example or matching automated test does not constitute statutory verification.',
   'Independent statutory approval, independent security assessment, physical-device acceptance and founder release authorization remain separate requirements.'
  ]
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(buildVerificationAudit(),null,2));
