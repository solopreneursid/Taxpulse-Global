import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ECB_URL,COUNTRIES,parseEcbDaily,parseWorldBankPpp} from '../engine/reference-data.mjs';
const output=process.argv[2]||'reference-review';
await mkdir(output,{recursive:true});
const retrievedAt=new Date().toISOString(),today=retrievedAt.slice(0,10);
async function get(url){
 const res=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!res.ok)throw Error('HTTP '+res.status);
 const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length>1000000)throw Error('Oversized response');
 return {text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:createHash('sha256').update(bytes).digest('hex')};
}
const report={schemaVersion:1,retrievedAt,reviewStatus:'pending',sources:{}};
async function collect(key,url,parser){
 try{const raw=await get(url);const observation=parser(raw.text);await writeFile(output+'/'+key+'-source.txt',raw.text,{flag:'wx'});report.sources[key]={status:'retrieved',url,sourceDigest:raw.sha256,observation};}
 catch(error){report.sources[key]={status:'unavailable',url,error:String(error.message).slice(0,200)};}
}
const year=new Date().getUTCFullYear()-2;
const wb='https://api.worldbank.org/v2/country/'+Object.keys(COUNTRIES).join(';')+'/indicator/PA.NUS.PRVT.PP?date='+year+'&format=json&per_page=100';
await Promise.all([collect('ecb',ECB_URL,xml=>parseEcbDaily(xml,{today})),collect('ppp',wb,body=>parseWorldBankPpp(JSON.parse(body),year))]);
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));if(Object.values(report.sources).some(x=>x.status!=='retrieved'))process.exitCode=1;
