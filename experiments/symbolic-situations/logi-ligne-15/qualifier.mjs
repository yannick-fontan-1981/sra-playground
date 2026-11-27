import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {native,run} from './service.mjs';
import {board,development,historical} from './situations.mjs';
import {evaluate} from './oracle.mjs';
const {values:v}=parseArgs({options:{sha:{type:'string'},depot:{type:'string',default:'.'},reserve:{type:'string'},rapport:{type:'string'}}});
let cases=[null,...development];
if(v.reserve){
  const bytes=readFileSync(v.reserve),h=createHash('sha256').update(bytes).digest('hex');
  assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8').includes(h),'Sélection réservée différente du gel');
  cases=JSON.parse(bytes).cases;
}
const host=native(v.sha,v.depot),results=[];
try{
  for(const spec of cases) {
    const turns=await run(spec?board(spec):historical,host.program);
    results.push({id:spec?.id??'historique',...evaluate(spec,turns),turns});
  }
}finally{host.close();}
const bytes=JSON.stringify({sha:v.sha,runtime:process.version,results},null,2)+'\n';
if(v.rapport)writeFileSync(v.rapport,bytes,{flag:'wx'});
for(const [i,r] of results.entries())console.log(JSON.stringify({id:v.reserve?i+1:r.id,ok:r.ok,checks:r.checks,ecarts:r.ecarts}));
console.log('SHA-256 '+createHash('sha256').update(bytes).digest('hex'));
process.exitCode=Number(results.some(r=>!r.ok));
