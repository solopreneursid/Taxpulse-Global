import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUsEmployerFica } from '../engine/employer-payroll.mjs';
import { calculateSalaryRemainder } from '../engine/taxable-income.mjs';

const calc=coveredWages=>calculateUsEmployerFica({
  country:'US',taxYear:'2026',coveredWages,singleEmployer:true,scopeConfirmed:true
});
for(const [wages,social,medicare,total] of [
  [0,0,0,0],
  [100000,6200,1450,7650],
  [184500,11439,2675.25,14114.25],
  [200000,11439,2900,14339]
]) test('2026 employer FICA '+wages,()=>{
  const result=calc(wages);
  assert.equal(result.socialSecurityEmployerTax,social);
  assert.equal(result.medicareEmployerTax,medicare);
  assert.equal(result.employerFicaTotal,total);
  assert.equal(result.employeeAdditionalMedicareEmployerMatch,0);
  assert.equal(result.taxRulesVerified,false);
});
test('employer base share matches employee regular FICA, excluding Additional Medicare',()=>{
  for(const wages of [100000,184500,200000]){
    const employee=calculateSalaryRemainder({
      country:'US',region:'TX',taxYear:'2026',pay:wages,scopeConfirmed:true
    });
    const employer=calc(wages);
    const employeeRegular=employee.contributions
      .filter(row=>row.name==='Social Security'||row.name==='Medicare')
      .reduce((sum,row)=>sum+row.amount,0);
    assert.equal(employer.employerFicaTotal,employeeRegular);
  }
});
test('employer FICA rejects unsupported or ambiguous payroll inputs',()=>{
  assert.throws(()=>calc(-1));
  assert.throws(()=>calc(1.001));
  assert.throws(()=>calc('1000.001'));
  assert.throws(()=>calculateUsEmployerFica({
    country:'US',taxYear:'2026',coveredWages:1000,singleEmployer:false,scopeConfirmed:true
  }));
  assert.throws(()=>calculateUsEmployerFica({
    country:'US',taxYear:'2025',coveredWages:1000,singleEmployer:true,scopeConfirmed:true
  }));
  assert.throws(()=>calculateUsEmployerFica({
    country:'US',taxYear:'2026',coveredWages:1000,singleEmployer:true,scopeConfirmed:true,employeeCount:2
  }));
});
