import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

const [dir]=process.argv.slice(2);
const read=(name,suffix)=>readFileSync(join(dir,name+'.'+suffix),'utf8');
const sha={base:'0aef4289e97ce094782dfd03f5a79ace6eae5fd2',candidat:'c515ea1464387c940b06e93f3ad7ecd73f782f60'};
const known=[{code:'SS05',actions:36,levels:1,stop:'target_levels_completed',budget:44},
  {code:'SS11',actions:80,levels:0,stop:'session_action_budget',budget:80}];
const loadService=v=>read(v,'service-complet.jsonl').trim().split(/\r?\n/).map(JSON.parse);
const [a,b]=Object.keys(sha).map(loadService);
for (const run of [a,b])assert.deepEqual(run.map(r=>({code:r.code,actions:r.actions,levels:r.levels,
  stop:r.reason,budget:r.levelStats[0].budget.actions})),known);
const relevant=['effects','authority','recoveries','decisions','usage','series','pathKinds','trace'];
const autonome=a.map((row,i)=>{
  for(const field of relevant)assert.deepEqual(row[field],b[i][field],row.code+' '+field);
  assert.equal(row.levelStats[0].prefixHash,b[i].levelStats[0].prefixHash);
  return {...known[i],hash:row.levelStats[0].prefixHash,firstDifference:null};
});
const [x,y]=Object.keys(sha).map(v=>JSON.parse(read(v,'controle-final.json')));
assert.deepEqual(x,y);
assert.deepEqual(x.map(r=>[r.prefix,r.closure,r.crossing]),[[14,14,6],[12,6,12]]);
const guide=x.map(({route,...r})=>{
  assert.equal(r.actions,32);
  assert.equal(r.confirmations,31);
  assert.equal(r.first,'ACTION1');
  assert.equal(route.at(-1).levels,1);
  assert.deepEqual(r.evidenceTest.without,{actions:['ACTION2'],pressure:null});
  assert.deepEqual(r.evidenceTest.restored,{actions:['ACTION1'],pressure:'reserve_weight'});
  assert.deepEqual(r.evidenceTest.restored,r.evidenceTest.control);
  const {command,admitted,actor,changed,levels}=r.evidenceTest.fallback;
  assert.deepEqual([command,admitted,actor,changed,levels],['ACTION2',true,'14,41',true,0]);
  assert.equal(r.negative.result,'pressure_projection_contradicted');
  assert.equal(r.negative.next,'ACTION4');
  assert.equal(createHash('sha256').update(JSON.stringify(route)).digest('hex'),r.sha);
  return r;
});
console.log(JSON.stringify({sha,autonome,guide,gestesNatifsParSha:208},null,2));
