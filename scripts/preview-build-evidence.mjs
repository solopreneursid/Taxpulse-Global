import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),bundle=new URL('staging/integrated/bundle/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=name=>readFileSync(new URL(name,bundle));
const files=readdirSync(bundle,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name).sort();
assert.ok(files.length>40);
const included=new Set(),queue=['worker.mjs'];
while(queue.length){
 const name=queue.pop();if(included.has(name))continue;
 assert.ok(files.includes(name),'Missing transitive module '+name);included.add(name);
 if(!name.endsWith('.mjs'))continue;
 for(const match of read(name).toString('utf8').matchAll(/(?:\bfrom\s*|\bimport\s*)['"]\.\/([^'"]+)['"]/g)){
  const dependency=match[1];assert.match(dependency,/^[A-Za-z0-9_.-]+$/);queue.push(dependency);
 }
}
const entries=[...included].sort().map(name=>{const b=read(name);return {name,bytes:b.length,sha256:sha(b)};});
const revision=read('preview-revision.txt').toString('utf8');assert.match(revision,/^[a-f0-9]{64}$/);
const report={schemaVersion:1,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),revision,engineFingerprint:JSON.parse(read('browser-fingerprint.mjs.txt').toString('utf8').replace(/^export default /,'').trim().replace(/;$/,'')),scope:'Static-import closure from worker.mjs; generated but unreferenced modules excluded. Not production authorization.',modules:entries,bundleDigest:sha(JSON.stringify(entries))};
assert.ok(entries.some(e=>e.name==='preview-revision.txt'));assert.ok(entries.some(e=>e.name==='browser-fingerprint.mjs.txt'));assert.ok(entries.some(e=>e.name==='worker.mjs'));
writeFileSync('preview-build-evidence.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Preview build evidence '+JSON.stringify(report));
