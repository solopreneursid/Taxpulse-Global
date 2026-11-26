// Strict public-data parsing. Candidate observations are not approved by retrieval alone.
export const ECB_URL='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
export const PPP_URL='https://data.worldbank.org/indicator/PA.NUS.PRVT.PP';
export const COUNTRIES=Object.freeze({IND:'INR',USA:'USD',GBR:'GBP',CAN:'CAD',AUS:'AUD',DEU:'EUR',SGP:'SGD',ARE:'AED'});
const ECB_CURRENCIES=['USD','GBP','CAD','AUD','INR','SGD'];
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw Error('Invalid observation date');return value;}
function positive(n){if(typeof n!=='number'||!Number.isFinite(n)||n<=0||n>1e6)throw Error('Invalid reference value');return n;}
export function parseEcbDaily(xml,{today=new Date().toISOString().slice(0,10)}={}){
 if(typeof xml!=='string'||xml.length>1000000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('Invalid ECB document');
 const dates=[...xml.matchAll(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/g)];
 if(dates.length!==1)throw Error('Expected one ECB daily observation');
 const observedAt=date(dates[0][1]);if(observedAt>date(today)||Date.parse(today)-Date.parse(observedAt)>7*86400000)throw Error('Stale or future ECB observation');
 const rates={EUR:1};for(const m of xml.matchAll(/<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"](\d+(?:\.\d+)?)['"]\s*\/>/g)){
  if(!ECB_CURRENCIES.includes(m[1]))continue;if(Object.hasOwn(rates,m[1]))throw Error('Duplicate ECB observation');rates[m[1]]=positive(Number(m[2]));
 }
 if(ECB_CURRENCIES.some(c=>!Object.hasOwn(rates,c)))throw Error('Missing supported ECB currency');
 return {source:ECB_URL,observedAt,baseCurrency:'EUR',rates,unsupportedCurrencies:['AED'],reviewStatus:'pending'};
}
export function parseWorldBankPpp(payload,year){
 if(!Number.isInteger(year)||year<1990||year>new Date().getUTCFullYear()||!Array.isArray(payload)||!Array.isArray(payload[1]))throw Error('Invalid World Bank response');
 const values={};for(const row of payload[1]){
  if(!Object.hasOwn(COUNTRIES,row.countryiso3code)||row.date!==String(year)||row.indicator?.id!=='PA.NUS.PRVT.PP')continue;
  const currency=COUNTRIES[row.countryiso3code];if(Object.hasOwn(values,currency))throw Error('Duplicate PPP observation');
  values[currency]=positive(row.value);
 }
 if(Object.values(COUNTRIES).some(c=>!Object.hasOwn(values,c)))throw Error('Incomplete same-year PPP observations');
 return {source:PPP_URL,indicator:'PA.NUS.PRVT.PP',referenceYear:year,license:'CC BY 4.0',unit:'local currency units per international dollar',values,reviewStatus:'pending'};
}
export function ecbCrossRate(snapshot,firstCurrency,secondCurrency){
 if(!snapshot||snapshot.baseCurrency!=='EUR'||!Object.hasOwn(snapshot.rates||{},firstCurrency)||!Object.hasOwn(snapshot.rates||{},secondCurrency)||firstCurrency===secondCurrency)throw Error('Unsupported currency pair');
 return Math.round(positive(snapshot.rates[firstCurrency])/positive(snapshot.rates[secondCurrency])*1e6)/1e6;
}

export function referenceInputs(report,kind,first,second,{today=new Date().toISOString().slice(0,10)}={}){
 if(!report||report.schemaVersion!==1||report.reviewStatus!=='pending'||first===second||!Object.values(COUNTRIES).includes(first)||!Object.values(COUNTRIES).includes(second))throw Error('Invalid reference selection');
 const source=report.sources?.[kind];if(!source||source.status!=='retrieved'||! /^[a-f0-9]{64}$/.test(source.sourceDigest)||source.observation?.reviewStatus!=='pending')throw Error('Candidate evidence unavailable');
 const o=source.observation;
 if(kind==='ecb'){
  if(source.url!==ECB_URL||o.source!==ECB_URL||date(o.observedAt)>date(today)||Date.parse(today)-Date.parse(o.observedAt)>7*86400000)throw Error('Stale or invalid ECB candidate');
  const rate=ecbCrossRate(o,first,second);if(rate<=0)throw Error('Exchange rate below supported precision');return {rate,rateDate:o.observedAt};
 }
 if(kind==='ppp'){
  if(o.source!==PPP_URL||o.indicator!=='PA.NUS.PRVT.PP'||!Number.isInteger(o.referenceYear)||o.referenceYear<1990||o.referenceYear>Number(date(today).slice(0,4))||!Object.hasOwn(o.values||{},first)||!Object.hasOwn(o.values||{},second))throw Error('Invalid PPP candidate');
  return {firstFactor:Math.round(positive(o.values[first])*1e6)/1e6,secondFactor:Math.round(positive(o.values[second])*1e6)/1e6,referenceYear:o.referenceYear};
 }
 throw Error('Unsupported reference kind');
}
