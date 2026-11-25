/** Geometry, source declarations and local design reviews. No optimality claim. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileLevel,initialState,terrainAt,supported,gateClosed,doorsOpen,equal} from '../dist/core.js';
import {SS21_LEVELS} from '../dist/levels.js';
import {TUTORIAL_LEVEL} from '../dist/tutorial.js';
import {replay} from './solver.mjs';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const directions=[[0,-1],[0,1],[-1,0],[1,0]],key=p=>p.y*20+p.x;
const report={game:'SS21',version:'0.1.0',success:false,scope:'Initial frozen geometry, exact layout comparison with SS14–20 and reproducible local counter-branches',levels:[],reviews:[],limitations:[
 'A winning witness proves solvability, not an optimal or unique route.',
 'The walking graphs freeze resources and circuit states and suppress automatic abilities. They do not model joint puzzle solving.',
 'A geometric comparison detects exact repeats under rotations, reflections and translations; it does not measure subjective originality or difficulty.',
 'Local counter-branches establish their observed outcomes, not permanent global impossibility after a mistake.'
]};

function initialWalking(world,state,hero,ignoreOtherHeroes=false){
 const occupied=[...state.stones,...state.monsters,...state.mirrors.map(m=>m.at),...(!ignoreOtherHeroes?state.heroes.filter(h=>h.kind!==hero.kind).map(h=>h.at):[])];
 const blocked=p=>!supported(world,state,p)||terrainAt(world,p)==='#'||occupied.some(q=>equal(p,q))
  ||world.gates.some((g,i)=>equal(g.at,p)&&gateClosed(world,state,i))
  ||world.doors.some(q=>equal(p,q))&&!doorsOpen(world,state);
 const queue=[hero.at],seen=new Set([key(hero.at)]);let transitions=0;
 for(let i=0;i<queue.length;i++)for(const [dx,dy]of directions){
  transitions++;const q={x:queue[i].x+dx,y:queue[i].y+dy};
  if(blocked(q)||seen.has(key(q)))continue;seen.add(key(q));queue.push(q);
 }
 return{role:hero.kind,states:seen.size,transitions,reachableGoals:world.goals.filter(g=>seen.has(key(g))),exhausted:true};
}
function matchingSize(walking){
 function match(i,used){if(i===walking.length)return 0;let best=match(i+1,used);
  for(const goal of walking[i].reachableGoals)if(!used.has(key(goal))){const next=new Set(used);next.add(key(goal));best=Math.max(best,1+match(i+1,next));}
  return best;
 }return match(0,new Set());
}
// Ignore occupants and devices, retain land/water and trim exterior wall padding.
function canonicalTerrain(rows){
 let matrix=rows.map(row=>[...row].map(c=>c==='#'?'#':'~s'.includes(c)?'~':'.'));
 const used=[];matrix.forEach((r,y)=>r.forEach((c,x)=>{if(c!=='#')used.push({x,y});}));
 const xs=used.map(p=>p.x),ys=used.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
 matrix=matrix.slice(y0,y1+1).map(r=>r.slice(x0,x1+1));
 const rotate=m=>m[0].map((_,x)=>m.map(r=>r[x]).reverse()),forms=[];
 for(let i=0;i<4;i++){forms.push(matrix.map(r=>r.join('')).join('\n'));forms.push(matrix.map(r=>[...r].reverse().join('')).join('\n'));matrix=rotate(matrix);}
 return hash(forms.sort()[0]);
}
function olderLayouts(){
 const list=[];
 for(const series of [14,15,16,17,18,19,20]){
  const relative=`experiments/sinking-star-ss${series}/src/levels.ts`,path=new URL(`../../sinking-star-ss${series}/src/levels.ts`,import.meta.url);
  const source=existsSync(path)?readFileSync(path,'utf8'):execFileSync('git',['show','HEAD:'+relative],{encoding:'utf8',cwd:fileURLToPath(new URL('../',import.meta.url)),maxBuffer:4*1024*1024});
  const match=source.match(/SS\d+_LEVELS[^=]*=\s*(\[[\s\S]*\])\s*;/);assert.ok(match,'Readable historical levels: '+relative);
  for(const level of JSON.parse(match[1]))list.push({series:'SS'+series,id:level.id,title:level.title,terrainSha256:canonicalTerrain(level.rows)});
 }
 return list;
}

try{
 assert.equal(SS21_LEVELS.length,8);
 const previous=olderLayouts(),newTerrains=new Set();
 report.layoutComparison={previousGames:['SS14','SS15','SS16','SS17','SS18','SS19','SS20'],previousLevels:previous.length,method:'Trim wall padding, normalize pieces to land, keep water, canonicalize all eight planar symmetries',historical:previous};
 for(const[index,spec]of SS21_LEVELS.entries()){
  const design=JSON.parse(readFileSync(new URL(`../reference/level${index+1}-design.json`,import.meta.url),'utf8'));
  assert.deepEqual(spec,design.spec);
  const world=compileLevel(spec),state=initialState(world),terrainHash=canonicalTerrain(spec.rows);
  assert.equal(state.heroes.length,4);assert.equal(world.goals.length,4);assert.ok(!state.dead&&!state.complete);
  for(const h of state.heroes)assert.ok(!world.goals.some(g=>equal(g,h.at)),'No hero starts on a goal');
  for(const g of world.gates)assert.ok(!world.buttons.some(b=>equal(g.at,b)),'Campaign presses and buttons have distinct tiles');
  assert.ok(!newTerrains.has(terrainHash),spec.id+': distinct terrain inside SS21');newTerrains.add(terrainHash);
  const repeats=previous.filter(p=>p.terrainSha256===terrainHash);assert.deepEqual(repeats,[],spec.id+': no exact historical terrain repeat');
  const walking=state.heroes.map(h=>initialWalking(world,state,h)),generousWalking=state.heroes.map(h=>initialWalking(world,state,h,true));
  const matching=matchingSize(generousWalking);
  assert.ok(matching<4,spec.id+': all four goals must not already be assignable by frozen walking');
  if(index===TUTORIAL_LEVEL-1)assert.ok(walking.every(r=>r.reachableGoals.length===0),'The tutorial room has no immediately reachable goal');
  const route=replay(spec,design.commands);assert.equal(route.state.complete,true);assert.equal(route.metrics.blocked,0);assert.equal(route.metrics.deaths,0);
  const local=[];
  for(const check of design.adaptation?.localChecks??[]){
   assert.ok(check.name&&check.observed&&check.scope,'Each local claim declares its scope');
   if(!check.commands){local.push({name:check.name,observed:check.observed,scope:check.scope,verification:'Reviewed by the dedicated author script'});continue;}
   const result=replay(spec,check.commands);
   for(const field of ['complete','dead','failed'])if(check.expected?.[field]!==undefined)assert.equal(result.state[field],check.expected[field]);
   local.push({name:check.name,observed:check.observed,scope:check.scope,actions:result.metrics.actions,blocked:result.metrics.blocked,deaths:result.metrics.deaths,complete:result.state.complete,finalStateSha256:hash(result.state)});
  }
  report.levels.push({level:index+1,title:spec.title,mapSha256:hash(spec),terrainSha256:terrainHash,goals:world.goals,landCells:world.terrain.filter(c=>c==='.').length,waterCells:world.terrain.filter(c=>c==='~').length,walking,generousWalking,maximumFrozenWalkingGoalAssignment:matching,buttonsAndPressesSeparate:true,exactHistoricalTerrainRepeats:repeats,localChecks:local});
 }
 for(const script of ['review-intro-ss21.mjs','review-middle-ss21.mjs','review-final-ss21.mjs','independent-review-ss21.mjs']){
  const path=new URL('../reference/author/'+script,import.meta.url);assert.ok(existsSync(path),'Missing required review: '+script);
  const output=execFileSync(process.execPath,[fileURLToPath(path)],{encoding:'utf8',maxBuffer:4*1024*1024});
  const result=JSON.parse(output);assert.ok(result.success!==false,script+': failed review');
  report.reviews.push({script:'reference/author/'+script,success:true,result,sha256:hash(result)});
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
mkdirSync(new URL('../validation/',import.meta.url),{recursive:true});
writeFileSync(new URL('../validation/design-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({success:report.success,levels:report.levels.length,reviews:report.reviews.length,error:report.error},null,2));
