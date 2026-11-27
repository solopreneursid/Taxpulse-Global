import {publishSnapshot,readRuleHead,blockSnapshot} from './rule-publisher.mjs';
const MAX=512000;
const FLOOR_KEY='taxpulse:regulatory-sequence-floor';
export async function readDurableSequenceFloor(store){
 if(!store||typeof store.get!=='function'||typeof store.put!=='function')throw Error('Durable sequence-floor storage unavailable');
 const raw=await store.get(FLOOR_KEY,'text');
 if(raw===null||typeof raw!=='string'||!/^(0|[1-9]\\d*)$/.test(raw))throw Error('Durable regulatory sequence floor is not initialized');
 const floor=Number(raw);
 if(!Number.isSafeInteger(floor)||floor<0)throw Error('Invalid durable regulatory sequence floor');
 return floor;
}

export async function runScheduledPublication(env,engineFingerprint,{now=new Date()}={}){
 if(!env?.RULE_DB||!env?.RULE_INBOX||!env?.RULE_SEQUENCE_FLOOR||typeof env.RULE_PUBLIC_KEY!=='string'||typeof env.RULE_REVIEW_PUBLIC_KEY!=='string'||typeof env.RULE_REVIEWER_ID!=='string'||env.RULE_PUBLIC_KEY===env.RULE_REVIEW_PUBLIC_KEY)throw Error('Incomplete publisher configuration');
 const head=await readRuleHead(env.RULE_DB),floor=await readDurableSequenceFloor(env.RULE_SEQUENCE_FLOOR);
 if(head.sequence>floor)throw Error('D1 regulatory sequence exceeds durable sequence floor');
 if(head.sequence<floor&&head.state==='active'){
  const blocked=await blockSnapshot(env.RULE_DB,head.sequence,env.RULE_SEQUENCE_FLOOR);
  return {state:'rollback_detected',databaseSequence:head.sequence,durableSequenceFloor:floor,blockedSequence:blocked.sequence};
 }
 if(head.sequence<floor&&head.state!=='blocked')throw Error('Restored regulatory head must be blocked before recovery');
 const raw=await env.RULE_INBOX.get('pending-preview','text');
 if(raw===null)return {state:head.sequence<floor||head.state==='blocked'?'sequence_floor_recovery_required':'no_candidate',databaseSequence:head.sequence,durableSequenceFloor:floor};
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX)throw Error('Invalid publication package size');
 const packageData=JSON.parse(raw);
 if(!packageData||Object.keys(packageData).length!==3||!Object.hasOwn(packageData,'envelope')||!Object.hasOwn(packageData,'fixtures')||!Object.hasOwn(packageData,'review'))throw Error('Invalid publication package');
 const sequence=packageData.envelope?.payload?.sequence;
 if(!Number.isSafeInteger(sequence))throw Error('Invalid sequence');
 if(sequence<=Math.max(head.sequence,floor))return {state:'already_processed',sequence:Math.max(head.sequence,floor)};
 return publishSnapshot(env.RULE_DB,packageData.envelope,packageData.fixtures,{publicKeyHex:env.RULE_PUBLIC_KEY,engineFingerprint,review:packageData.review,reviewerPublicKeyHex:env.RULE_REVIEW_PUBLIC_KEY,reviewerId:env.RULE_REVIEWER_ID,now,sequenceFloorStore:env.RULE_SEQUENCE_FLOOR});
}
export function createPublicationWorker(engineFingerprint){return {scheduled(event,env,ctx){ctx.waitUntil(runScheduledPublication(env,engineFingerprint).then(r=>console.log(JSON.stringify({event:'regulatory-publication',...r}))).catch(()=>{console.error('Regulatory publication rejected');throw Error('Regulatory publication rejected');}));},fetch(){return new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});}};}
