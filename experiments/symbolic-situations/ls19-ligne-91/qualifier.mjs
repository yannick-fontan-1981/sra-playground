import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { development,game } from './situations.mjs';
import { native,run } from './service.mjs';
import { evaluate } from './criteres.mjs';
const {values:v}=parseArgs({options:{sha:{type:'string'},depot:{type:'string',default:'.'},reserve:{type:'string'},rapport:{type:'string'}}});
let cases=development;
if(v.reserve){
  const bytes=readFileSync(v.reserve), sum=createHash('sha256').update(bytes).digest('hex');
  assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8').includes(sum),'Engagement de réserve différent');
  cases=JSON.parse(bytes).situations;
}
const host=native(v.sha,v.depot),results=[];
try{
  for(const spec of cases) {
    const turns=await run(game(spec),host.program);
    results.push({id:spec.id,...evaluate(spec,turns),turns});
  }
}finally{host.close();}
const packet=JSON.stringify({sha:v.sha,runtime:process.version,results},null,2)+'\n';
if(v.rapport) writeFileSync(v.rapport,packet,{flag:'wx'});
console.log(JSON.stringify({departs:results.length,conformes:results.filter(r=>r.ok).length,
  controles:results.reduce((s,r)=>s+r.checks,0),premiersEcarts:results.map(r=>r.ecarts[0]??null),
  sha256:createHash('sha256').update(packet).digest('hex')}));
process.exitCode=Number(!results.every(r=>r.ok));
