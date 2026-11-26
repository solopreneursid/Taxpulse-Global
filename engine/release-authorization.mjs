import {createHash,createPublicKey,verify} from 'node:crypto';
const hex=(s,n)=>typeof s==='string'&&s.length===n&&/^[0-9a-f]+$/.test(s);
const exact=(value,keys)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
export const releaseManifestDigest=m=>createHash('sha256').update(JSON.stringify(m)).digest('hex');
export function releaseApprovalBytes(payload){
 if(!exact(payload,['schemaVersion','purpose','commit','artifactSha256','manifestSha256','issuedAt','expiresAt'])||payload.schemaVersion!==1||payload.purpose!=='taxpulse-production-release'||!hex(payload.commit,40)||!hex(payload.artifactSha256,64)||!hex(payload.manifestSha256,64)||!iso(payload.issuedAt)||!iso(payload.expiresAt))throw Error('Invalid release approval payload');
 return Buffer.from(JSON.stringify(Object.fromEntries(Object.keys(payload).sort().map(k=>[k,payload[k]]))),'utf8');
}
function publicKey(raw){
 if(!hex(raw,64))throw Error('Missing or invalid trusted release key');
 return createPublicKey({key:{kty:'OKP',crv:'Ed25519',x:Buffer.from(raw,'hex').toString('base64url')},format:'jwk'});
}
export function verifyProductionAuthorization(manifest,authorization,context={}){
 const {commit,artifactSha256,founderPublicKeyHex,reviewerPublicKeyHex,now=new Date()}=context;
 if(!exact(authorization,['payload','founderSignature','reviewerSignature'])||!hex(authorization.founderSignature,128)||!hex(authorization.reviewerSignature,128))throw Error('Two signed release approvals required');
 const founder=publicKey(founderPublicKeyHex),reviewer=publicKey(reviewerPublicKeyHex);
 if(founderPublicKeyHex===reviewerPublicKeyHex)throw Error('Independent release keys required');
 const p=authorization.payload,bytes=releaseApprovalBytes(p);
 if(p.commit!==commit||p.artifactSha256!==artifactSha256||p.manifestSha256!==releaseManifestDigest(manifest))throw Error('Release subject mismatch');
 const t=now.getTime(),issued=Date.parse(p.issuedAt),expires=Date.parse(p.expiresAt);
 if(!Number.isFinite(t)||issued>t||expires<=t||expires-issued>7*86400000)throw Error('Release approval expired or not yet valid');
 if(!verify(null,bytes,founder,Buffer.from(authorization.founderSignature,'hex'))||!verify(null,bytes,reviewer,Buffer.from(authorization.reviewerSignature,'hex')))throw Error('Invalid release signature');
 return true;
}
