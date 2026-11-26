// Local-only plain-text payslip extraction. Never infers tax eligibility or uploads data.
const fields={grossPay:/^\s*(?:gross pay|gross salary|gross earnings)\s*[:=]\s*(.*?)\s*$/gim,incomeTax:/^\s*(?:income tax|tax withheld|tds)\s*[:=]\s*(.*?)\s*$/gim,netPay:/^\s*(?:net pay|take.home pay)\s*[:=]\s*(.*?)\s*$/gim};
export function parsePayslipText(text){if(typeof text!=='string'||text.length>200000)throw Error('Invalid or oversized text');const result={};for(const [name,re] of Object.entries(fields)){const matches=Array.from(text.matchAll(re),m=>m[1]);const candidates=matches.map(m=>{const v=m.replace(/^(?:USD|INR|GBP|EUR|AED|CAD|AUD|SGD|[$₹£€])\s*/i,'');if(!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(v))return null;const n=Number(v.replaceAll(',',''));return Number.isFinite(n)&&n<=1e9?n:null});result[name]={value:candidates.length===1?candidates[0]:null,requiresReview:true,ambiguous:candidates.length>1}}return {fields:result,format:'plain_text',uploaded:false,verified:false,requiresConfirmation:true}}

/** Arithmetic only, not payroll certification. No missing value is inferred. */
export function reconcilePayslipAmounts(parsed,{sameCurrencyAndPeriod,otherDeductions}){
 if(sameCurrencyAndPeriod!==true)throw Error('Confirm matching currency and pay period');
 const minor=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9||Math.abs(v*100-Math.round(v*100))>0.00002)throw Error('Invalid amount');return Math.round(v*100);};
 const value=name=>{const row=parsed?.fields?.[name];if(!row||row.ambiguous||row.value===null)throw Error('Review ambiguous or missing amounts');return minor(row.value);};
 const gross=value('grossPay'),tax=value('incomeTax'),net=value('netPay'),other=minor(otherDeductions);
 const difference=gross-tax-other-net;
 return {grossPay:gross/100,incomeTax:tax/100,netPay:net/100,otherDeductions:other/100,unreconciledDifference:difference/100,balanced:difference===0,verified:false,uploaded:false,requiresConfirmation:true};
}
