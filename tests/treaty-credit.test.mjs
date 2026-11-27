import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTreatyCreditComponent } from '../engine/treaty-credit.mjs';

const input=extra=>({
  currency:'USD',worldwideIncome:100000,foreignSourceIncome:20000,
  domesticTaxOnWorldwideIncome:10000,foreignTaxPaid:3000,
  treatyLimit:2500,taxOnForeignItem:3000,scopeConfirmed:true,...extra
});
test('one-item credit is limited by the lowest of four independently supplied caps',()=>{
  const result=calculateTreatyCreditComponent(input({}));
  assert.equal(result.proportionalDomesticTaxLimit,2000);
  assert.equal(result.allowedCredit,2000);
  assert.equal(result.unusedForeignTax,1000);
  assert.equal(result.taxRulesVerified,false);
});
test('the proportional domestic-tax cap floors to minor units',()=>{
  const result=calculateTreatyCreditComponent(input({
    worldwideIncome:3,foreignSourceIncome:1,domesticTaxOnWorldwideIncome:1,
    foreignTaxPaid:1,treatyLimit:1,taxOnForeignItem:1
  }));
  assert.equal(result.proportionalDomesticTaxLimit,0.33);
  assert.equal(result.allowedCredit,0.33);
});
test('credit caps are never inferred and malformed or inconsistent inputs fail closed',()=>{
  assert.throws(()=>calculateTreatyCreditComponent(input({foreignSourceIncome:100001})));
  assert.throws(()=>calculateTreatyCreditComponent(input({worldwideIncome:0,foreignSourceIncome:1})));
  assert.throws(()=>calculateTreatyCreditComponent(input({currency:'US'})));
  assert.throws(()=>calculateTreatyCreditComponent(input({scopeConfirmed:false})));
  assert.throws(()=>calculateTreatyCreditComponent(input({foreignTaxPaid:-1})));
  assert.throws(()=>calculateTreatyCreditComponent(input({taxOnForeignItem:1.001})));
  assert.throws(()=>calculateTreatyCreditComponent({...input({}),extra:1}));
});
