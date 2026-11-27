// Only prior read-only observations from the same configured URL are carried forward.
const digest=/^[a-f0-9]{64}$/;
const timestamp=(value,now)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=now;
export function selectSupplementalBaseline(report,sources,now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid clock');
 if(!report||report.schemaVersion!==1||report.mode!=='review_only'||report.automaticRuleChanges!==false||!timestamp(report.checkedAt,now.getTime())||now.getTime()-Date.parse(report.checkedAt)>35*86400000||!Array.isArray(report.sources)||report.sources.length>40)throw Error('Invalid or stale previous supplemental observation');
 const seen=new Set(),rows=[];
 for(const row of report.sources){
  if(!row||typeof row.id!=='string'||seen.has(row.id)||row.ruleChangesApplied!==false)throw Error('Invalid previous source row');
  seen.add(row.id);const configured=sources.find(s=>s.id===row.id&&s.url===row.url);
  if(!configured||row.sha256===null)continue;
  if(typeof row.sha256!=='string'||!digest.test(row.sha256)||!timestamp(row.lastSuccessfulCheck,now.getTime()))throw Error('Invalid previous source digest or time');
  let url;try{url=new URL(row.resolvedUrl);}catch{throw Error('Invalid previous source URL');}
  const allowed=[configured.url,...(configured.alternateUrls||[])].map(u=>new URL(u).origin);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!allowed.includes(url.origin))throw Error('Unexpected previous source origin');
  rows.push({id:row.id,url:row.url,sha256:row.sha256,resolvedUrl:url.href,lastSuccessfulCheck:row.lastSuccessfulCheck,reviewPending:row.reviewPending===true,extractionStatus:'not_configured'});
 }
 return {checkedAt:report.checkedAt,sources:rows};
}
