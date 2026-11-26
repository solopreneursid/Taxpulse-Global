import {readFileSync} from 'node:fs';
import {catalog} from '../engine/country.mjs';
import {assertProductionReady} from '../engine/release-gate.mjs';
const manifest=JSON.parse(readFileSync(new URL('../rules/manifest.json',import.meta.url),'utf8'));
const supported=catalog(),countries=new Set(supported.countries.map(c=>c.code)),modules=new Set(supported.modules),required=['pit','payroll','capgains','vat','corporate','property','dtaa'];
const rows=['IN','US','GB','CA','AU','DE','SG','AE'].map(country=>{const r=manifest.countries?.[country];return {country,backendCountry:countries.has(country),manifestVerified:r?.verification==='verified',productionEnabled:r?.productionEnabled===true,recordedEvidenceCount:Array.isArray(r?.evidence)?r.evidence.length:0,missingBackendModules:required.filter(m=>!modules.has(m))};});
let gate;try{assertProductionReady(manifest);gate='unexpectedly-passed-without-authorization';process.exitCode=1;}catch(e){gate='blocked: '+e.message;}
console.log(JSON.stringify({releaseMode:manifest.releaseMode,gate,countries:rows,independentAssessment:'not established by this report',trustedKeys:'not inspected',productionAuthorized:false},null,2));
