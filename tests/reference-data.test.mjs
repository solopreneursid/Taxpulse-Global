import test from 'node:test';import assert from 'node:assert/strict';import {parseEcbDaily,parseWorldBankPpp,ecbCrossRate,COUNTRIES,referenceInputs,compareReferenceCandidates} from '../engine/reference-data.mjs';
const xml='<Cube time="2026-11-25">'+Object.entries({USD:1.2,GBP:.8,CAD:1.5,AUD:1.6,INR:100,SGD:1.4}).map(([c,r])=>'<Cube currency="'+c+'" rate="'+r+'"/>').join('')+'</Cube>';
test('synthetic ECB daily data checks coverage, freshness and conversion direction',()=>{
 const r=parseEcbDaily(xml,{today:'2026-11-26'});assert.equal(r.reviewStatus,'pending');assert.equal(ecbCrossRate(r,'INR','USD'),83.333333);assert.throws(()=>ecbCrossRate(r,'AED','USD'));assert.throws(()=>parseEcbDaily(xml,{today:'2026-12-10'}));assert.throws(()=>parseEcbDaily(xml.replace('currency="GBP"','currency="USD"'),{today:'2026-11-26'}));assert.throws(()=>parseEcbDaily('<!DOCTYPE x>'+xml,{today:'2026-11-26'}));
});
test('synthetic PPP rejects missing, duplicate, null and mixed-year observations',()=>{
 const rows=Object.keys(COUNTRIES).map(countryiso3code=>({countryiso3code,date:'2024',indicator:{id:'PA.NUS.PRVT.PP'},value:2}));
 const r=parseWorldBankPpp([{},rows],2024);assert.equal(r.values.AED,2);assert.equal(r.reviewStatus,'pending');assert.throws(()=>parseWorldBankPpp([{},rows.slice(1)],2024));assert.throws(()=>parseWorldBankPpp([{},[...rows,rows[0]]],2024));assert.throws(()=>parseWorldBankPpp([{},[{...rows[0],value:null},...rows.slice(1)]],2024));
});

test('dated reference candidates need explicit compatible selection and freshness',()=>{
 const p={schemaVersion:1,reviewStatus:'pending',sources:{ecb:{status:'retrieved',url:'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',sourceDigest:'a'.repeat(64),observation:parseEcbDaily(xml,{today:'2026-11-26'})}}};
 assert.deepEqual(referenceInputs(p,'ecb','INR','USD',{today:'2026-11-26'}),{rate:83.333333,rateDate:'2026-11-25'});
 assert.throws(()=>referenceInputs(p,'ecb','INR','USD',{today:'2026-12-10'}));assert.throws(()=>referenceInputs(p,'ecb','AED','USD',{today:'2026-11-26'}));
});

test('public reference comparison detects drift, unavailable sources and never activates',()=>{
 const obs=parseEcbDaily(xml,{today:'2026-11-26'});
 const prior={schemaVersion:1,reviewStatus:'pending',sources:{ecb:{status:'retrieved',url:obs.source,sourceDigest:'a'.repeat(64),observation:obs},ppp:{status:'unavailable'}}};
 const next=structuredClone(prior);next.sources.ecb.observation.rates.INR=101;
 const r=compareReferenceCandidates(prior,next,{today:'2026-11-26'});assert.deepEqual(r.sources[0].changedCurrencies,['INR']);assert.equal(r.sources[0].reviewRequired,true);assert.equal(r.sources[1].status,'unavailable');assert.equal(r.automaticActivation,false);
 assert.equal(compareReferenceCandidates(prior,prior,{today:'2026-11-26'}).sources[0].status,'unchanged');
 assert.throws(()=>compareReferenceCandidates(prior,next,{today:'2026-12-10'}));
});
