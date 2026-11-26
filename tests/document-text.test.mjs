import test from 'node:test';import assert from 'node:assert/strict';import {parsePayslipText,reconcilePayslipAmounts} from '../engine/document-text.mjs';
test('extracts explicitly labelled values without transmitting text',()=>{const r=parsePayslipText('Gross pay: INR 1,00,000\nTDS: 12,000\nNet pay: 88,000');assert.equal(r.fields.grossPay.value,100000);assert.equal(r.fields.incomeTax.value,12000);assert.equal(r.fields.netPay.value,88000);assert.equal(r.uploaded,false);assert.equal(r.requiresConfirmation,true)});
test('ambiguous and unsupported amounts fail safely',()=>{assert.equal(parsePayslipText('Gross pay: 100\nGross pay: 200').fields.grossPay.value,null);assert.equal(parsePayslipText('Gross pay: 1.234,50').fields.grossPay.value,null);assert.throws(()=>parsePayslipText('x'.repeat(200001)))});

test('payslip reconciliation requires explicit currency and period confirmation',()=>{
 const p=parsePayslipText('Gross pay: 1000\nIncome tax: 100\nNet pay: 850');
 const r=reconcilePayslipAmounts(p,{sameCurrencyAndPeriod:true,otherDeductions:50});assert.equal(r.balanced,true);assert.equal(r.verified,false);assert.equal(r.uploaded,false);
 assert.equal(reconcilePayslipAmounts(p,{sameCurrencyAndPeriod:true,otherDeductions:0}).unreconciledDifference,50);
 assert.throws(()=>reconcilePayslipAmounts(p,{sameCurrencyAndPeriod:false,otherDeductions:50}));
 assert.throws(()=>reconcilePayslipAmounts(parsePayslipText('Gross pay: 1000\nNet pay: 850'),{sameCurrencyAndPeriod:true,otherDeductions:0}));
});
