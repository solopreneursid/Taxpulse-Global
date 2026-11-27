import {readFile,writeFile,stat} from 'node:fs/promises';
import {selectSupplementalBaseline} from './supplemental-baseline.mjs';
import {runRegulatoryMonitor} from '../engine/regulatory-edge.mjs';
const sources=JSON.parse(await readFile(new URL('../rules/supplemental-monitor-sources.json',import.meta.url),'utf8'));
let report,prior=null;
const previous=process.env.SUPPLEMENTAL_PREVIOUS_FILE;
if(previous){if((await stat(previous)).size>2*1024*1024)throw Error('Previous observation too large');prior=selectSupplementalBaseline(JSON.parse(await readFile(previous,'utf8')),sources);}
await runRegulatoryMonitor({REGULATORY_STATE:{get:async()=>prior,put:async(key,value)=>{if(key!=='latest')throw Error('Unexpected key');report=JSON.parse(value);}}},sources);
if(!report||report.sources.length!==sources.length||report.automaticRuleChanges!==false)throw Error('Invalid supplemental report');
const reachable=report.sources.filter(s=>s.status!=='fetch_failed').length;
await writeFile('supplemental-source-observations.json',JSON.stringify({...report,scope:'Supplemental source reachability and content digests; compare previous trusted main workflow observations when available, never activate',baseline:{status:prior?'compared':'not_available',checkedAt:prior?.checkedAt??null,matchedSources:prior?.sources.length??0}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({checkedAt:report.checkedAt,configured:sources.length,reachable,baseline:prior?'compared':'not_available',changed:report.sources.filter(s=>s.status==='review_required').map(s=>s.id),reviewPending:report.sources.filter(s=>s.reviewPending).map(s=>s.id),unavailable:report.sources.filter(s=>s.status==='fetch_failed').map(s=>({id:s.id,failure:s.failure})),automaticRuleChanges:false}));
if(!reachable)throw Error('No supplemental source reachable');
