import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { build,development } from './fixture.mjs';
import { mount,run } from './montage.mjs';
import { check,expected } from './criteres.mjs';

const {values:v}=parseArgs({options:{sha:{type:'string'},depot:{type:'string',default:'.'},reserve:{type:'string'},rapport:{type:'string'}}});
const cases=development.map(s=>[s,expected[s.op]]);
if(v.reserve){
  const bytes=readFileSync(v.reserve);
  const digest=createHash('sha256').update(bytes).digest('hex');
  assert.ok(readFileSync(new URL('GEL.md',import.meta.url),'utf8').includes(digest),'Engagement de réserve invalide');
  cases.splice(0,cases.length,...JSON.parse(bytes).cases);
}
const m=mount(v.sha,v.depot),results=[];
try{
  for(const [spec,criterion] of cases) {
    const turns=await run(build(spec),m.program);
    const verdict=check(criterion,turns);
    results.push({fiche:spec.op,...verdict,turns});
  }
}finally{m.close();}
if(v.rapport) writeFileSync(v.rapport,JSON.stringify({sha:v.sha,results},null,2)+'\n',{flag:'wx'});
for(const [i,r] of results.entries()) console.log(JSON.stringify({depart:v.reserve?i+1:r.fiche,ok:r.ok,
  checks:r.checks,ecarts:r.ecarts}));
process.exitCode=results.every(r=>r.ok)?0:1;
