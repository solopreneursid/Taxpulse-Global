const HEX=/^[a-f0-9]{64}$/;
const MIRROR_KEY='taxpulse:regulatory-sequence-floor';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const initial=()=>({schemaVersion:1,sequence:0,digest:null,state:'empty'});
function validState(value){
 if(!exact(value,['schemaVersion','sequence','digest','state'])||value.schemaVersion!==1||!Number.isSafeInteger(value.sequence)||value.sequence<0||!['empty','active','blocked'].includes(value.state))return false;
 if(value.sequence===0)return value.digest===null&&value.state==='empty';
 if(value.state==='active')return typeof value.digest==='string'&&HEX.test(value.digest);
 return value.state==='blocked'&&value.digest===null;
}
function validAdvance(value){
 return exact(value,['sequence','digest','expectedSequence','state'])&&
  Number.isSafeInteger(value.sequence)&&value.sequence>0&&
  Number.isSafeInteger(value.expectedSequence)&&value.expectedSequence>=0&&
  value.sequence>value.expectedSequence&&
  ['active','blocked'].includes(value.state)&&
  (value.state==='active'?typeof value.digest==='string'&&HEX.test(value.digest):value.digest===null);
}

/**
 * Strongly consistent sequence anchor outside the D1 database.
 * D1 Time Travel restores cannot roll this Durable Object state back.
 * Workers KV is updated only as a best-effort operational mirror.
 */
export class RegulatorySequenceAnchor {
 constructor(state,env){this.state=state;this.env=env;}
 async read(){
  const value=await this.state.storage.get('anchor');
  if(value===undefined)return initial();
  if(!validState(value))throw Error('Corrupt external sequence anchor; fail closed');
  return value;
 }
 async mirror(sequence){
  const kv=this.env?.RULE_SEQUENCE_FLOOR;
  if(!kv||typeof kv.put!=='function')return;
  try{await kv.put(MIRROR_KEY,String(sequence));}
  catch{console.error('Regulatory sequence-floor mirror update failed');}
 }
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/state'&&request.method==='GET'){
   try{return json(await this.read());}
   catch{return json({error:'sequence_anchor_unavailable'},503);}
  }
  if(url.pathname==='/advance'&&request.method==='POST'){
   const declared=request.headers.get('content-length');
   if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>2048))return json({error:'invalid_sequence_advance'},400);
   let input;try{input=await request.json();}catch{return json({error:'invalid_json'},400);}
   if(!validAdvance(input))return json({error:'invalid_sequence_advance'},400);
   try{
    const next=await this.state.blockConcurrencyWhile(async()=>{
     const current=await this.read();
     if(input.expectedSequence!==current.sequence||input.sequence<=current.sequence)return {conflict:true,state:current};
     const value={schemaVersion:1,sequence:input.sequence,digest:input.digest,state:input.state};
     await this.state.storage.put('anchor',value);
     return {conflict:false,state:value};
    });
    if(next.conflict)return json({error:'sequence_anchor_conflict',state:next.state},409);
    await this.mirror(next.state.sequence);
    return json(next.state);
   }catch{return json({error:'sequence_anchor_write_failed'},503);}
  }
  if(url.pathname==='/state'||url.pathname==='/advance')return json({error:'method_not_allowed'},405);
  return json({error:'not_found'},404);
 }
}

export function createRegulatorySequenceAnchor(namespace,name='taxpulse-regulatory-head-v1'){
 if(!namespace||typeof namespace.idFromName!=='function'||typeof namespace.get!=='function')throw Error('REGULATORY_SEQUENCE_ANCHOR binding required');
 const stub=namespace.get(namespace.idFromName(name));
 async function call(path,body){
  const response=await stub.fetch('https://sequence-anchor.invalid'+path,{
   method:body?'POST':'GET',
   headers:body?{'content-type':'application/json'}:undefined,
   body:body?JSON.stringify(body):undefined,
   redirect:'error'
  });
  const value=await response.json().catch(()=>({error:'invalid_anchor_response'}));
  if(!response.ok)throw Error(value.error||'External sequence anchor request failed');
  return value;
 }
 return Object.freeze({
  getState:()=>call('/state'),
  advance:({sequence,digest,expectedSequence,state})=>call('/advance',{sequence,digest,expectedSequence,state})
 });
}
