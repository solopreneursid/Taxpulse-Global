import {reconcileRegulatoryReports} from './regulatory-reconciliation.mjs';
const states=new Set(['baseline','unchanged','review_required','fetch_failed']);
export function regulatorySummary(config,report,now=new Date()){
 const checkedAt=typeof report?.checkedAt==='string'&&Number.isFinite(Date.parse(report.checkedAt))?report.checkedAt:null;
 const age=checkedAt?now.getTime()-Date.parse(checkedAt):Infinity;
 const stale=age<0||age>36*3600000;
 const observations=Array.isArray(report?.sources)&&report.sources.length<=40?report.sources:[];
 const rows=config.map(s=>{const r=observations.find(x=>x&&typeof x==='object'&&x.id===s.id&&x.url===s.url);return {id:s.id,jurisdiction:s.jurisdiction,topics:s.topics,url:s.url,status:r&&states.has(r.status)?r.status:'not_checked',reviewPending:r?.reviewPending===true,lastSuccessfulCheck:typeof r?.lastSuccessfulCheck==='string'?r.lastSuccessfulCheck:null,extractionStatus:r?.extractionStatus==='candidate'?'candidate':r?.extractionStatus==='review_required'?'review_required':'not_available'};});
 return {mode:'review_only',checkedAt,stale,configuredSources:rows.length,reviewPending:rows.filter(r=>r.reviewPending).length,unavailable:rows.filter(r=>r.status==='fetch_failed'||r.status==='not_checked').length,sources:rows,taxRulesVerified:false,automaticProductionActivation:false};
}
export async function loadRegulatorySummary(config,env,now=new Date()){
 const kv=env?.REGULATORY_STATE;
 const read=async key=>{try{return await kv?.get(key,'json')??null;}catch{return null;}};
 const [edge,independent]=await Promise.all([read('latest'),read('independent-latest')]);
 const validEdge=edge?.mode==='review_only'&&edge.automaticRuleChanges===false&&Array.isArray(edge.sources)&&edge.sources.length<=40&&edge.sources.every(x=>x&&typeof x==='object')?edge:null;
 const base=regulatorySummary(config,validEdge,now);
 // An independent observation must be delivered via the separately signed intake.
 // Do not equate matching candidates or an available URL with legal verification.
 const trusted=independent?.collectorProof?.kind==='collector-ed25519'&&/^[a-f0-9]{64}$/.test(independent.collectorProof.reportDigest||'')?independent:null;
 const result={...base,reconciliation:null};
 try{
  const r=reconcileRegulatoryReports(config,validEdge,trusted,{now});
  result.reconciliation={checkedAt:r.generatedAt,edgeCheckedAt:base.checkedAt,independentCheckedAt:typeof trusted?.checkedAt==='string'&&Number.isFinite(Date.parse(trusted.checkedAt))?trusted.checkedAt:null,reachable:r.reachable,unavailable:r.unavailable,conflictingCandidates:r.conflictingCandidates,automaticRuleChanges:false};
  const byId=new Map(r.sources.map(s=>[s.id,s]));
  result.sources=base.sources.map(s=>{const q=byId.get(s.id);return {...s,reconciliationStatus:q.status,reconciliationExtraction:q.extraction,reviewPending:s.reviewPending||q.reviewPending||q.extraction==='matching_candidates'};});
  result.reviewPending=result.sources.filter(s=>s.reviewPending).length;
 }catch{/* Fail closed: retain edge-only status; never fabricate reconciliation. */}
 return result;
}
