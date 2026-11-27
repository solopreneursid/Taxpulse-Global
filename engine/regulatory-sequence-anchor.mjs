const HEX=/^[a-f0-9]{64}$/;
const MIRROR_KEY='taxpulse:regulatory-sequence-floor';
const KEYS=['schemaVersion','sequence','digest','state'];

export const SEQUENCE_FLOOR_MIRROR_KEY=MIRROR_KEY;
export const EMPTY_SEQUENCE_ANCHOR=Object.freeze({schemaVersion:1,sequence:0,digest:null,state:'empty'});

function exact(value,keys){
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
export function isValidSequenceAnchor(value){
 if(!exact(value,KEYS)||value.schemaVersion!==1||!Number.isSafeInteger(value.sequence)||value.sequence<0||!['empty','active','blocked'].includes(value.state))return false;
 if(value.sequence===0)return value.digest===null&&value.state==='empty';
 if(value.state==='active')return typeof value.digest==='string'&&HEX.test(value.digest);
 return value.state==='blocked'&&value.digest===null;
}
export function isValidSequenceAdvance(value){
 return exact(value,['sequence','digest','expectedSequence','state'])&&
  Number.isSafeInteger(value.sequence)&&value.sequence>0&&
  Number.isSafeInteger(value.expectedSequence)&&value.expectedSequence>=0&&
  value.sequence>value.expectedSequence&&
  ['active','blocked'].includes(value.state)&&
  (value.state==='active'?typeof value.digest==='string'&&HEX.test(value.digest):value.digest===null);
}
function mapRow(row){
 const value={schemaVersion:Number(row.schemaVersion),sequence:Number(row.sequence),digest:row.digest??null,state:row.state};
 if(!isValidSequenceAnchor(value))throw Error('Corrupt external sequence anchor; fail closed');
 return value;
}

/** Initialize the SQLite-backed Durable Object's private sequence table. */
export function initializeSequenceAnchor(sql){
 sql.exec(`CREATE TABLE IF NOT EXISTS regulatory_sequence_anchor (
  id INTEGER PRIMARY KEY CHECK (id=1),
  schema_version INTEGER NOT NULL CHECK (schema_version=1),
  sequence INTEGER NOT NULL CHECK (sequence>=0),
  digest TEXT,
  state TEXT NOT NULL CHECK (state IN ('empty','active','blocked')),
  CHECK (
   (sequence=0 AND digest IS NULL AND state='empty') OR
   (sequence>0 AND state='active' AND digest IS NOT NULL AND length(digest)=64) OR
   (sequence>0 AND state='blocked' AND digest IS NULL)
  )
 )`);
 sql.exec("INSERT OR IGNORE INTO regulatory_sequence_anchor (id,schema_version,sequence,digest,state) VALUES (1,1,0,NULL,'empty')");
 return readSequenceAnchor(sql);
}

/** Read the one authoritative row from the Durable Object's SQLite database. */
export function readSequenceAnchor(sql){
 const row=sql.exec("SELECT schema_version AS schemaVersion,sequence,digest,state FROM regulatory_sequence_anchor WHERE id=1").one();
 return mapRow(row);
}

/** Atomic compare-and-set. A stale publisher cannot lower or overwrite the floor. */
export function advanceSequenceAnchor(sql,input){
 if(!isValidSequenceAdvance(input))throw Error('Invalid external sequence advance');
 const rows=sql.exec(
  "UPDATE regulatory_sequence_anchor SET sequence=?,digest=?,state=? WHERE id=1 AND sequence=? AND sequence<? RETURNING schema_version AS schemaVersion,sequence,digest,state",
  input.sequence,input.digest,input.state,input.expectedSequence,input.sequence
 ).toArray();
 if(rows.length===0)return {conflict:true,state:readSequenceAnchor(sql)};
 if(rows.length!==1)throw Error('Unexpected external sequence anchor update result');
 return {conflict:false,state:mapRow(rows[0])};
}

/** KV is a non-authoritative diagnostic mirror; failure never changes anchor success. */
export async function mirrorSequenceFloor(kv,sequence){
 if(!kv||typeof kv.put!=='function')return false;
 try{await kv.put(MIRROR_KEY,String(sequence));return true;}
 catch{console.error('Regulatory sequence-floor KV mirror update failed');return false;}
}

export function createRegulatorySequenceAnchor(namespace,name='taxpulse-regulatory-head-v1'){
 if(!namespace||typeof namespace.idFromName!=='function'||typeof namespace.get!=='function')throw Error('REGULATORY_SEQUENCE_ANCHOR binding required');
 const stub=namespace.get(namespace.idFromName(name));
 if(typeof stub?.getState!=='function'||typeof stub?.advance!=='function')throw Error('REGULATORY_SEQUENCE_ANCHOR RPC methods unavailable');
 return Object.freeze({
  async getState(){
   const value=await stub.getState();
   if(!isValidSequenceAnchor(value))throw Error('Invalid external sequence anchor response');
   return value;
  },
  async advance(input){
   const value=await stub.advance(input);
   if(!isValidSequenceAnchor(value))throw Error('Invalid external sequence anchor response');
   return value;
  }
 });
}
