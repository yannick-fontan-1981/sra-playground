/** Reproducible author audits; none of this module enters the playable HTML. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SS16_LEVELS} from '../dist/levels.js';
import {compileLevel,initialState,stepDetailed,circuitPressed,supported,terrainAt,gateClosed,doorsOpen} from '../dist/core.js';
import {replay,decodeCommand} from './solver.mjs';

const root=new URL('../',import.meta.url);
const json=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const designs=Array.from({length:8},(_,i)=>json(`reference/level${i+1}-design.json`));
const eq=(a,b)=>a.x===b.x&&a.y===b.y;
const topology=[];
for(const [i,d]of designs.entries()){
 assert.deepEqual(d.spec,SS16_LEVELS[i],'Sync and build the current author maps before auditing');
 const w=compileLevel(d.spec),s=initialState(w),queue=s.heroes.map(h=>h.at),seen=new Set(queue.map(p=>`${p.x},${p.y}`));
 assert.equal(w.heroes.length,3);assert.equal(w.goals.length,3);
 assert.ok(w.gates.every(g=>!w.buttons.some(p=>eq(p,g.at))),'Campaign presses are distinct from buttons');
 for(let j=0;j<queue.length;j++)for(const[dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const p={x:queue[j].x+dx,y:queue[j].y+dy},k=`${p.x},${p.y}`;
  if(seen.has(k)||terrainAt(w,p)==='#'||!supported(w,s,p)||w.gates.some((g,n)=>eq(g.at,p)&&gateClosed(w,s,n))||(w.doors.some(g=>eq(g,p))&&!doorsOpen(w,s)))continue;
  seen.add(k);queue.push(p);
 }
 const directGoals=w.goals.filter(p=>seen.has(`${p.x},${p.y}`));assert.deepEqual(directGoals,[],'No initial fixed-circuit walking access to a goal');
 topology.push({level:i+1,specSha256:hash(d.spec),initialReachableGoals:0,floorCellsReached:seen.size,purePresses:true});
}

const local=[];
for(const n of [2,3,4]){
 const d=designs[n-1];
 for(const c of d.adaptation.localChecks){
  const r=replay(d.spec,d.commands.slice(0,c.turn)+(c.alternative??''));
  const actual={};
  for(const [field,expected]of Object.entries(c.observed)){
   let observed;
   switch(field){
    case 'refusals':observed=r.metrics.blocked;break;
    case 'pistonPushes':observed=r.metrics.pistonPushes;break;
    case 'dead':case 'failed':case 'platformActive':observed=r.state[field];break;
    case 'deadHeroes':observed=r.state.heroes.filter(h=>h.dead).map(h=>h.kind);break;
    case 'stones':case 'supports':case 'monsters':observed=typeof expected==='number'?r.state[field].length:r.state[field];break;
    case 'mirror':observed=r.state.mirrors[0];break;
    case 'thief':observed=r.state.heroes.find(h=>h.kind==='thief').at;break;
    case 'pressure':case 'secondCircuit':observed=circuitPressed(r.world,r.state,'depot-a-deux');break;
    case 'nextThiefActions':observed=Object.fromEntries(Object.keys(expected).map(command=>{const a=decodeCommand(command,r.state),next=stepDetailed(r.world,r.state,a.id,a.data).state;return[command,{failed:next.failed,dead:next.dead}];}));break;
    default:throw Error('Unrecognized local audit field: '+field);
   }
   assert.deepEqual(observed,expected,`L${n} ${c.effect}: ${field}`);actual[field]=observed;
  }
  local.push({level:n,turn:c.turn,alternative:c.alternative??'',effect:c.effect,observed:actual});
 }
}

for(const name of ['review-level1.mjs','review-final-levels.mjs','review-finals.mjs']){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('reference/author/'+name,root))],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.status!==0)throw Error(`${name} failed\n${result.stdout}\n${result.stderr}`);
}
const workshop=json('reference/level1-independent-review.json');
assert.equal(workshop.success,true);assert.equal(workshop.mapSha256,hash(designs[0].spec));
const finalDesign=json('reference/levels5-8-review.json');
assert.equal(finalDesign.success,true);for(const n of [5,6,7,8])assert.equal(finalDesign.specHashes[n],hash(designs[n-1].spec),'Fresh designer review for L'+n);
const independent=json('reference/finals-independent-review.json');
assert.equal(independent.success,true);for(const n of [7,8])assert.equal(independent.specHashes[n],hash(designs[n-1].spec),'Fresh independent review for L'+n);

const report={game:'SS16',version:json('package.json').version,success:true,specHashes:Object.fromEntries(designs.map((d,i)=>[i+1,hash(d.spec)])),
 scope:'Initial fixed-circuit walking topology, exact local counter-branches, reproduced historical bypasses and explicitly bounded independent reviews.',
 initialTopology:topology,localLevels2to4:local,
 workshop:{historicalWinningBypassesCorrected:workshop.repairs.length,restrictedSearches:workshop.restrictedProbes.count,states:workshop.restrictedProbes.states,transitions:workshop.restrictedProbes.transitions,allQueuesExhausted:workshop.restrictedProbes.allQueuesExhausted},
 finalDesigner:{success:finalDesign.success,checks:finalDesign.checks,specHashes:finalDesign.specHashes},
 independentFinals:{success:independent.success,status:independent.status,specHashes:independent.specHashes},
 limitations:['Initial flood-fill holds circuits fixed and ignores actor obstacles; it is not a search over actions.','Local counter-branches establish their stated effects only.','Restricted searches freeze the resources and inactive heroes listed in the underlying report.','Alternative advanced solutions are allowed; no global minimum, uniqueness or mandatory reference-route resource count is claimed.']};
writeFileSync(new URL('validation/design-report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:true,levels:topology.length,localChecks:local.length,workshopSearches:report.workshop.restrictedSearches,finalDesignerChecks:finalDesign.checks,independentFinals:independent.status}));
