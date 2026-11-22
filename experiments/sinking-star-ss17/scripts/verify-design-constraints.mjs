/** Deterministic geometry and local counter-branches; no global optimality claim. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileLevel,initialState,terrainAt,supported,gateClosed,doorsOpen,equal} from '../dist/core.js';
import {SS17_LEVELS} from '../dist/levels.js';
import {replay} from './solver.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const report={game:'SS17',success:false,scope:'Frozen initial geometry, author-local counter-branches and separately reported bounded reviews',levels:[],reviews:[],limitations:[
 'A winning witness proves solvability, not an optimal or unique route.',
 'Frozen geometry holds resources, other heroes and circuit states fixed; it does not model joint puzzle solving.',
 'Local counter-branches establish their observed outcomes, not permanent global impossibility after a mistake.',
 'A search stopped by its state or time budget remains inconclusive.'
]};
const directions=[[0,-1],[0,1],[-1,0],[1,0]];
function initialWalking(world,state,hero){
 const occupied=[...state.stones,...state.monsters,...state.mirrors.map(m=>m.at),...state.heroes.filter(h=>h.kind!==hero.kind).map(h=>h.at)];
 const blocked=p=>!supported(world,state,p)||terrainAt(world,p)==='#'||occupied.some(q=>equal(p,q))
  ||world.gates.some((g,i)=>equal(g.at,p)&&gateClosed(world,state,i))
  ||world.doors.some(q=>equal(p,q))&&!doorsOpen(world,state);
 const queue=[hero.at],seen=new Set([hero.at.y*20+hero.at.x]),goals=[];let transitions=0;
 for(let i=0;i<queue.length;i++){
  const p=queue[i];if(world.goals.some(g=>equal(p,g)))goals.push(p);
  for(const[dx,dy]of directions){transitions++;const q={x:p.x+dx,y:p.y+dy},key=q.y*20+q.x;if(blocked(q)||seen.has(key))continue;seen.add(key);queue.push(q);}
 }
 return{role:hero.kind,states:seen.size,transitions,goalsReached:goals.length,exhausted:true};
}
try{
 assert.equal(SS17_LEVELS.length,8);
 for(const [index,spec]of SS17_LEVELS.entries()){
  const design=JSON.parse(readFileSync(new URL(`../reference/level${index+1}-design.json`,import.meta.url),'utf8'));
  assert.deepEqual(spec,design.spec);
  const world=compileLevel(spec),state=initialState(world);
  assert.equal(state.heroes.length,3);assert.equal(world.goals.length,3);
  assert.ok(!state.dead&&!state.complete);
  for(const h of state.heroes)assert.ok(!world.goals.some(g=>equal(g,h.at)),'No hero starts on a goal');
  for(const g of world.gates)assert.ok(!world.buttons.some(b=>equal(g.at,b)),'Campaign presses and buttons have distinct tiles');
  const walking=state.heroes.map(h=>initialWalking(world,state,h));
  assert.ok(walking.every(r=>r.goalsReached===0),spec.id+': initial goals require a puzzle interaction');
  const route=replay(spec,design.commands);assert.equal(route.state.complete,true);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
  const local=[];
  for(const check of design.adaptation?.localChecks??[]){
   assert.ok(check.name&&check.observed&&check.scope);
   const commands=check.commands??design.commands.slice(0,design.stages[check.atStage-1]?.turn);
   assert.ok(typeof commands==='string'&&commands.length>0);
   const result=replay(spec,commands);
   if(index===1)assert.equal(result.state.failed,true,'Premature relay refuses the press load');
   if(index===2&&check.atStage===2)assert.equal(result.state.supports.length,1,'Half bridge still leaves one water cell');
   if(index===2&&!check.atStage){assert.equal(result.trace.at(-1).phases[0]?.kind,'swap');assert.ok(result.trace.at(-1).phases[0]?.moves.some(m=>m.actor==='stone'));assert.deepEqual(result.state.heroes[0].at,{x:14,y:5});}
   if(index===3&&check.name==='Le tireur masque le coude')assert.ok(result.trace.at(-1).phases[0]?.moves.every(m=>m.actor==='hero'));
   if(index===3&&check.name==='Confondre visée magique et reflet global')assert.equal(result.state.dead,true);
   if(check.expected?.complete!==undefined)assert.equal(result.state.complete,check.expected.complete);
   if(check.expected?.dead!==undefined)assert.equal(result.state.dead,check.expected.dead);
   if(check.expected?.failed!==undefined)assert.equal(result.state.failed,check.expected.failed);
   local.push({name:check.name,observed:check.observed,scope:check.scope,actions:result.metrics.actions,blocked:result.metrics.blocked,deaths:result.metrics.deaths,complete:result.state.complete,finalStateSha256:hash(result.state)});
  }
  report.levels.push({level:index+1,title:spec.title,mapSha256:hash(spec),noInitialGoalsByFrozenWalking:true,walking,buttonsAndPressesSeparate:true,localChecks:local});
 }
 for(const script of ['review-level1.mjs','review-final-levels.mjs','audit-level5.mjs','audit-level6.mjs','audit-level7.mjs','audit-level8.mjs']){
  const path=new URL('../reference/author/'+script,import.meta.url);
  assert.ok(existsSync(path),'Missing required review: '+script);
  const output=execFileSync(process.execPath,[fileURLToPath(path)],{encoding:'utf8',maxBuffer:4*1024*1024});
  const result=JSON.parse(output);assert.ok(result.success!==false,script+': failed review');
  report.reviews.push({script:'reference/author/'+script,success:true,result,sha256:hash(result)});
 }
 report.success=true;
} catch(error){report.error=error.stack;process.exitCode=1;}
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});
writeFileSync(new URL('../validation/design-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
