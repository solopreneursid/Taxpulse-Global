import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVerificationAudit} from '../scripts/verification-audit.mjs';

test('verification audit accounts for all 56 unique statutory scopes without inventing approval',()=>{
 const report=buildVerificationAudit();
 assert.equal(report.statutoryScopeCount,56);
 assert.equal(report.countryCount,8);
 assert.equal(report.moduleCount,7);
 assert.equal(report.scopes.length,56);
 assert.equal(new Set(report.scopes.map(row=>row.country+'/'+row.module)).size,56);
 assert.equal(report.evidence.scopeRecords,56);
 assert.equal(report.evidence.independentReferenceScopes,0);
 assert.ok(report.evidence.sourceLinkedScopes>0);
 assert.equal(report.evidence.sourceMissingScopes,56-report.evidence.sourceLinkedScopes);
 assert.equal(report.evidence.independentApprovals,0);
 assert.equal(report.evidence.unverifiedScopes,56);
 assert.equal(report.evidence.productionEnabledScopes,0);
 assert.ok(report.scopes.every(row=>row.independentApproval===false));
 assert.equal(report.productionAuthorized,false);
});

test('payroll audit exposes unsupported jurisdictions instead of claiming eight-country completeness',()=>{
 const report=buildVerificationAudit();
 assert.deepEqual(report.payroll.missingVersionedContributionRegistryJurisdictions,['DE','AE']);
 assert.deepEqual(report.payroll.separateSalaryModelJurisdictions,['DE','AE']);
 assert.equal(report.payroll.separateSalaryModelsTested,true);
 assert.equal(report.payroll.status,'partial-preview-only');
 assert.equal(report.payroll.productionEnabled,false);
 assert.equal(report.payroll.jurisdictions.length,6);
});

test('release gate remains blocked and audit identifies the actual blocker',()=>{
 const report=buildVerificationAudit();
 assert.equal(report.releaseGate.blocked,true);
 assert.match(report.releaseGate.reason,/Production release not authorized|Backend module not implemented|Unverified country|Missing official-source evidence/);
 assert.equal(report.releaseMode,'preview');
});
