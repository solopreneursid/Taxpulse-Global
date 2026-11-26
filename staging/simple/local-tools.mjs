import {openEncryptedVault} from './engine/browser-vault.mjs';
import {parsePayslipText,reconcilePayslipAmounts} from './engine/document-text.mjs';
const $=id=>document.getElementById(id);
const text=$('local-document-text'),file=$('local-document-file'),out=$('local-document-result'),status=$('local-document-status');
let documentGeneration=0;
function clearDocument(){documentGeneration++;text.value='';file.value='';out.replaceChildren();status.textContent='';}
file.addEventListener('change',async()=>{const generation=++documentGeneration;out.replaceChildren();text.value='';status.textContent='';try{const f=file.files?.[0];if(!f)return;if(!/\.txt$/i.test(f.name)||f.size>400000)throw Error('Only plain-text files up to 400 KB');const value=new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer());if(value.length>200000||value.includes('\0'))throw Error('Invalid text file');if(generation!==documentGeneration)return;text.value=value;status.textContent='Sample loaded on this device. Review before reading amounts.';}catch{if(generation===documentGeneration)status.textContent='Could not read this UTF-8 text file. Nothing was uploaded.';}finally{if(generation===documentGeneration)file.value='';}});
text.addEventListener('input',()=>{documentGeneration++;out.replaceChildren();status.textContent='';});
$('local-document-parse').addEventListener('click',()=>{out.replaceChildren();try{const result=parsePayslipText(text.value);for(const [key,label] of [['grossPay','Gross pay'],['incomeTax','Tax withheld'],['netPay','Net pay']]){const row=result.fields[key],dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=row.ambiguous?'Multiple matches — review manually':row.value===null?'Not found or invalid':String(row.value)+' — confirm amount and currency';out.append(dt,dd);}status.textContent='Sample amounts only; not verified. Nothing uploaded.';}catch{status.textContent='Enter valid plain text within the supported size.';}});
$('local-document-clear').addEventListener('click',clearDocument);
const docConfirm=$('local-document-confirm'),docOther=$('local-document-other'),docReconcile=$('local-document-reconciliation');
function clearReconciliation(){docReconcile.textContent='';docConfirm.checked=false;docOther.value='';}
text.addEventListener('input',clearReconciliation);file.addEventListener('change',clearReconciliation);$('local-document-clear').addEventListener('click',clearReconciliation);
for(const el of [docConfirm,docOther])el.addEventListener('input',()=>{docReconcile.textContent='';});
$('local-document-reconcile').addEventListener('click',()=>{try{const r=reconcilePayslipAmounts(parsePayslipText(text.value),{sameCurrencyAndPeriod:docConfirm.checked,otherDeductions:docOther.valueAsNumber});docReconcile.textContent=r.balanced?'Arithmetic balances. This does not verify the payslip.':'Unreconciled difference: '+r.unreconciledDifference.toFixed(2)+' in the confirmed currency. Check missing amounts, deductions or additions.';}catch{docReconcile.textContent='Confirm all amounts use the same currency and period; enter other deductions (zero if none) and resolve missing or ambiguous fields.';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearReconciliation();});window.addEventListener('pagehide',clearReconciliation);

const password=$('local-vault-password'),note=$('local-vault-note'),select=$('local-vault-record'),vaultStatus=$('local-vault-status');
const controls=['local-vault-save','local-vault-open','local-vault-delete'].map($);
let busy=false,generation=0;
function clearVault(){generation++;password.value='';note.value='';vaultStatus.textContent='Visible example cleared.';}
async function useVault(action){if(busy)return;busy=true;controls.forEach(b=>b.disabled=true);const current=generation;let vault;try{vault=await openEncryptedVault();await action(vault,current);}catch{if(current===generation)vaultStatus.textContent='Unable to complete local storage operation. Check your passphrase and browser storage permissions.';}finally{vault?.close();password.value='';busy=false;controls.forEach(b=>b.disabled=false);}}
async function refresh(vault,selected=''){const rows=await vault.list();select.replaceChildren(new Option('Choose an example',''));for(const r of rows)select.add(new Option('Example saved '+r.createdAt,r.id));if(rows.some(r=>r.id===selected))select.value=selected;}
$('local-vault').addEventListener('toggle',()=>{if($('local-vault').open)useVault(async v=>refresh(v));else clearVault();});
$('local-vault-save').addEventListener('click',()=>useVault(async(v,current)=>{if(!note.value.trim()||note.value.length>20000)throw Error('Enter example');const value=note.value,pass=password.value;const saved=await v.save({kind:'demo-note',text:value},pass);if(current!==generation)return;note.value='';await refresh(v,saved.id);vaultStatus.textContent='Encrypted example saved on this device.';}));
$('local-vault-open').addEventListener('click',()=>useVault(async(v,current)=>{const id=select.value;if(!id)throw Error('Choose example');const value=await v.read(id,password.value);if(!value||value.kind!=='demo-note'||typeof value.text!=='string'||value.text.length>20000)throw Error('Invalid example');if(current===generation){note.value=value.text;vaultStatus.textContent='Example unlocked locally.';}}));
$('local-vault-delete').addEventListener('click',()=>useVault(async(v,current)=>{const id=select.value;if(!id||!window.confirm('Permanently delete this encrypted example from this device?'))return;if(!await v.remove(id))throw Error('Missing record');if(current===generation){note.value='';await refresh(v);vaultStatus.textContent='Encrypted example deleted.';}}));
$('local-vault-lock').addEventListener('click',clearVault);
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearVault();clearDocument();}});
window.addEventListener('pagehide',()=>{clearVault();clearDocument();});
