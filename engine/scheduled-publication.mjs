import {publishSnapshot,readRuleHead,blockSnapshot,assertRecoverySequenceFloor} from './rule-publisher.mjs';
import {createRegulatorySequenceAnchor} from './regulatory-sequence-anchor.mjs';
const MAX=512000;

export async function runScheduledPublication(env,engineFingerprint,{now=new Date()}={}){
 if(!env?.RULE_DB||!env?.RULE_INBOX||!env?.REGULATORY_SEQUENCE_ANCHOR||
    typeof env.RULE_PUBLIC_KEY!=='string'||typeof env.RULE_REVIEW_PUBLIC_KEY!=='string'||
    typeof env.RULE_REVIEWER_ID!=='string'||env.RULE_PUBLIC_KEY===env.RULE_REVIEW_PUBLIC_KEY)
  throw Error('Incomplete publisher configuration');
 const sequenceAnchor=createRegulatorySequenceAnchor(env.REGULATORY_SEQUENCE_ANCHOR);
 const head=await readRuleHead(env.RULE_DB),anchor=await sequenceAnchor.getState();
 if(head.sequence>anchor.sequence)throw Error('D1 regulatory sequence exceeds external sequence anchor');
 if(head.sequence<anchor.sequence&&['active','empty'].includes(head.state)){
  const blocked=await blockSnapshot(env.RULE_DB,head.sequence,sequenceAnchor);
  return {state:'rollback_detected',databaseSequence:head.sequence,externalSequenceFloor:anchor.sequence,blockedSequence:blocked.sequence};
 }
 if(head.sequence<anchor.sequence&&head.state!=='blocked')
  throw Error('Restored regulatory head must be blocked before recovery');
 if(head.sequence===anchor.sequence)assertRecoverySequenceFloor(head,anchor,head.sequence+1);
 const raw=await env.RULE_INBOX.get('pending-preview','text');
 if(raw===null)return {
  state:head.sequence<anchor.sequence||head.state==='blocked'||anchor.state==='blocked'?'sequence_floor_recovery_required':'no_candidate',
  databaseSequence:head.sequence,externalSequenceFloor:anchor.sequence
 };
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX)throw Error('Invalid publication package size');
 const packageData=JSON.parse(raw);
 if(!packageData||Object.keys(packageData).length!==3||!Object.hasOwn(packageData,'envelope')||!Object.hasOwn(packageData,'fixtures')||!Object.hasOwn(packageData,'review'))throw Error('Invalid publication package');
 const sequence=packageData.envelope?.payload?.sequence;
 if(!Number.isSafeInteger(sequence))throw Error('Invalid sequence');
 if(sequence<=Math.max(head.sequence,anchor.sequence))return {state:'already_processed',sequence:Math.max(head.sequence,anchor.sequence)};
 return publishSnapshot(env.RULE_DB,packageData.envelope,packageData.fixtures,{
  publicKeyHex:env.RULE_PUBLIC_KEY,engineFingerprint,review:packageData.review,
  reviewerPublicKeyHex:env.RULE_REVIEW_PUBLIC_KEY,reviewerId:env.RULE_REVIEWER_ID,
  sequenceAnchor,now
 });
}
export function createPublicationWorker(engineFingerprint){
 return {
  scheduled(event,env,ctx){
   ctx.waitUntil(runScheduledPublication(env,engineFingerprint)
    .then(r=>console.log(JSON.stringify({event:'regulatory-publication',...r})))
    .catch(()=>{console.error('Regulatory publication rejected');throw Error('Regulatory publication rejected');}));
  },
  fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});}
 };
}
