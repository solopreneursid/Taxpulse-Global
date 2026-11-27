// Portable Web Crypto foundation. No network, account or storage dependency.
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const bytes=(s,len)=>{if(typeof s!=='string'||s.length!==len*2||!/^[0-9a-f]+$/i.test(s))throw Error('Invalid envelope');return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));};
const random=n=>crypto.getRandomValues(new Uint8Array(n));
const iterations=600000;
const envelopeKeys=['version','kdf','iterations','cipher','salt','iv','ciphertext'];
const receiptKeys=['version','payload','digest','algorithm','signed','independentlyVerified','taxRulesVerified'];
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const exact=(value,keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
async function key(password,salt){
 if(typeof password!=='string'||password.length<12||password.length>1024)throw Error('Passphrase must have 12–1024 characters');
 const material=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function sha256(text){
 if(typeof text!=='string'||enc.encode(text).length>2000000)throw Error('Invalid text');
 return hex(await crypto.subtle.digest('SHA-256',enc.encode(text)));
}
const aad=enc.encode('TaxPulse:vault:v1:PBKDF2-SHA256:600000:AES256GCM');
export async function encryptRecord(record,password){
 if(!plain(record))throw Error('A plain JSON record is required');
 const serialized=JSON.stringify(record);
 if(typeof serialized!=='string')throw Error('Invalid record');
 const plainBytes=enc.encode(serialized);
 if(plainBytes.length>1000000)throw Error('Record too large');
 const salt=random(16),iv=random(12),k=await key(password,salt);
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},k,plainBytes);
 return {version:1,kdf:'PBKDF2-SHA256',iterations,cipher:'AES-256-GCM',salt:hex(salt),iv:hex(iv),ciphertext:hex(data)};
}
export async function decryptRecord(e,password){
 if(!exact(e,envelopeKeys)||e.version!==1||e.kdf!=='PBKDF2-SHA256'||e.iterations!==iterations||e.cipher!=='AES-256-GCM'||typeof e.ciphertext!=='string'||e.ciphertext.length<32||e.ciphertext.length>2000032||e.ciphertext.length%2||!/^[0-9a-f]+$/i.test(e.ciphertext))throw Error('Invalid envelope');
 const salt=bytes(e.salt,16),iv=bytes(e.iv,12),ciphertext=bytes(e.ciphertext,e.ciphertext.length/2);
 try{
  const k=await key(password,salt);
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad,tagLength:128},k,ciphertext);
  const record=JSON.parse(dec.decode(data));
  if(!plain(record))throw Error('Invalid record payload');
  return record;
 }catch{throw Error('Unable to unlock record');}
}
export async function unsignedReceipt(payload){
 if(!plain(payload))throw Error('A plain JSON receipt payload is required');
 const serialized=JSON.stringify(payload);
 return {version:1,payload:JSON.parse(serialized),digest:await sha256(serialized),algorithm:'SHA-256',signed:false,independentlyVerified:false,taxRulesVerified:false};
}
export async function verifyReceiptDigest(receipt){
 if(!exact(receipt,receiptKeys)||receipt.version!==1||receipt.algorithm!=='SHA-256'||receipt.signed!==false||receipt.independentlyVerified!==false||receipt.taxRulesVerified!==false||! /^[0-9a-f]{64}$/.test(receipt.digest)||!plain(receipt.payload))return false;
 try{
  const serialized=JSON.stringify(receipt.payload);
  if(typeof serialized!=='string')return false;
  return (await sha256(serialized))===receipt.digest;
 }catch{return false;}
}
