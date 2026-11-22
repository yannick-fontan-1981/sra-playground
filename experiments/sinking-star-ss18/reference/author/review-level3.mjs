import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {compileLevel,initialState,stepDetailed,TrioPuzzleSession,cellToPixel,gateClosed,platformActive,terrainAt,circuitPressed} from '../../dist/core.js';
import {lessonIds,observeLesson,TUTORIAL_LEVEL} from '../../dist/tutorial.js';
import {replay} from '../../scripts/solver.mjs';
import {Author} from './author.mjs';
import {SS18_LEVELS} from '../../dist/levels.js';

const design=JSON.parse(readFileSync(new URL('../level3-design.json',import.meta.url),'utf8'));
const world=compileLevel(design.spec),start=initialState(world),reference=replay(design.spec,design.commands);
const eq=(a,b)=>a.x===b.x&&a.y===b.y,key=p=>`${p.x},${p.y}`;
const spatial=s=>({heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:s.stones,monsters:s.monsters,supports:s.supports,mirrors:s.mirrors,gateClosed:s.gateClosed,platformActive:s.platformActive});
assert.equal(reference.state.complete,true);assert.equal(reference.metrics.blocked,0);assert.equal(reference.metrics.deaths,0);
assert.equal(world.goals.length,3);assert.equal(world.heroes.length,3);
const [g0,g1,g2]=world.goals;assert.notEqual((g1.x-g0.x)*(g2.y-g0.y)-(g1.y-g0.y)*(g2.x-g0.x),0,'The three exits must not form one final row');
assert.ok(world.heroes.every(h=>world.goals.every(g=>!eq(h.at,g))));
assert.ok(world.gates.every(g=>!world.buttons.some(b=>eq(b,g.at))),'A press is never a button in this map');

// Geometry only: devices and other occupants are frozen at their initial state.
// This is not a search over the combinatorial space of all three-role actions.
function reach(from,{ignoreOccupants=false,onlyOpticalGate=false,waterPassable=false}={}){
 const queue=[from],seen=new Set([key(from)]);let transitions=0;
 for(let head=0;head<queue.length;head++)for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
  transitions++;const at={x:queue[head].x+dx,y:queue[head].y+dy},terrain=terrainAt(world,at);
  if(terrain==='#')continue;
  if(!waterPassable&&terrain==='~'&&!start.supports.some(p=>eq(p,at))&&!world.platforms.some((p,i)=>eq(p.at,at)&&platformActive(world,start,i)))continue;
  if(world.gates.some((g,i)=>eq(g.at,at)&&(onlyOpticalGate?g.circuit==='optique':gateClosed(world,start,i))))continue;
  if(!ignoreOccupants&&[...start.stones,...start.monsters,...start.mirrors.map(m=>m.at),...start.heroes.map(h=>h.at)].some(p=>!eq(p,from)&&eq(p,at)))continue;
  if(seen.has(key(at)))continue;seen.add(key(at));queue.push(at);
 }
 return{positions:seen.size,transitions,reachableGoals:world.goals.filter(g=>seen.has(key(g)))};
}
const initialGeometry=world.heroes.map(h=>({role:h.kind,...reach(h.at)}));
assert.ok(initialGeometry.every(r=>r.reachableGoals.length===0));
// The north-east alcove remains geometrically sealed while its initial weight
// stays on the optical command, even with all other gates and occupants removed.
const opticalOverapproximation=world.heroes.map(h=>({role:h.kind,...reach(h.at,{ignoreOccupants:true,onlyOpticalGate:true,waterPassable:true})}));
assert.ok(opticalOverapproximation.every(r=>!r.reachableGoals.some(g=>eq(g,{x:16,y:3}))));

const session=new TrioPuzzleSession(SS18_LEVELS.slice(0,TUTORIAL_LEVEL)),learned=new Set(),discoveryEvents=[];
// Reach the real tutorial index through the two preceding rooms.
for(let level=1;level<TUTORIAL_LEVEL;level++){
 const earlier=JSON.parse(readFileSync(new URL(`../level${level}-design.json`,import.meta.url),'utf8'));
 for(const action of earlier.actions){const before=session.observe(),after=session.action(action.id,action.data);observeLesson(learned,before,after,action.id);}
}
assert.equal(session.observe().level,TUTORIAL_LEVEL);assert.equal(learned.size,0);
let frameCount=0;
for(const [i,action] of design.actions.entries()){
 const before=session.observe(),old=new Set(learned),after=session.action(action.id,action.data);frameCount+=after.frames.length;observeLesson(learned,before,after,action.id);
 const discoveries=[...learned].filter(id=>!old.has(id));if(discoveries.length)discoveryEvents.push({entry:i+1,discoveries});
}
assert.equal(session.observe().state,'WIN');assert.deepEqual([...learned].sort(),[...lessonIds].sort());

const cases=[];
const refuse=(label,before,action,extra={})=>{
 const detail=stepDetailed(world,before,action);assert.equal(detail.state.failed,true,label);assert.equal(detail.state.dead,false,label);assert.deepEqual(spatial(detail.state),spatial(before),label);assert.deepEqual(detail.phases,[],label);
 cases.push({label,result:'refused-atomically',action,...extra});return detail;
};
const pick=(state,kind)=>{const h=state.heroes.find(h=>h.kind===kind);return stepDetailed(world,state,6,cellToPixel(h.at)).state;};
const prefix=turn=>new Author(design.spec).act(design.commands.slice(0,turn));
const songStage=design.stages.find(s=>s.label.startsWith('Le chant traverse'));
const relayStage=design.stages.find(s=>s.label.startsWith('L’échange des partenaires'));
const pressStage=design.stages.find(s=>s.label.startsWith('La commande verte'));
assert.ok(songStage&&relayStage&&pressStage);

refuse('A blocked Bard cannot sing through the wall in front of his own step',pick(start,'bard'),1);
const initialMirror=refuse('An unprepared initial reflection does not send its distant crate through the boundary',start,5);
assert.deepEqual(initialMirror.blockedMirrorIndices,[0]);
const twoCrates=prefix(songStage.turn).go(5,8,'merchant');
refuse('The Merchant cannot move the two crates retained in a file by the Bard exercise',twoCrates.state,4,{legalPrefix:twoCrates.commands});
const missedSupport=prefix(songStage.turn).go(8,11,'merchant');
refuse('The Merchant must follow the shifted support rather than enter its former water cell',missedSupport.state,2,{legalPrefix:missedSupport.commands});

const relay=prefix(relayStage.turn);assert.equal(circuitPressed(world,relay.state,'releve'),true);
const departure=stepDetailed(world,pick(relay.state,'bard'),4);assert.equal(departure.state.failed,false);assert.equal(departure.state.dead,false);assert.equal(circuitPressed(world,departure.state,'releve'),false);assert.equal(gateClosed(world,departure.state,2),true);
cases.push({label:'Walking away from the relay releases its gate before the Merchant has entered',result:'gate-closes',legalPrefix:relay.commands,action:4});

const firstDeposit=reference.trace[0].after;assert.equal(circuitPressed(world,firstDeposit,'atelier'),false);assert.equal(gateClosed(world,firstDeposit,0),true);
const press=reference.trace[pressStage.turn-1];assert.equal(press.phases.filter(p=>p.kind==='piston').length,2);assert.equal(press.after.monsters.length,0);assert.equal(circuitPressed(world,press.after,'atelier'),true);assert.equal(gateClosed(world,press.after,0),false);
cases.push({label:'The southern exit needs both cyan weights; the paired press supplies the second one',result:'two-weights-and-two-presses',entry:pressStage.turn});

const report={success:true,level:TUTORIAL_LEVEL,title:design.spec.title,reference:{entries:reference.metrics.actions,selections:reference.metrics.selections,moves:reference.metrics.actions-reference.metrics.selections,frames:frameCount,result:session.observe().state,blocked:reference.metrics.blocked,deaths:reference.metrics.deaths},discoveries:{count:learned.size,ids:[...lessonIds],events:discoveryEvents},layout:{exits:world.goals,nonCollinear:true,pressesAreSeparateFromButtons:true},initialGeometry,opticalOverapproximation,cases,scope:'The geometry checks freeze devices and resources; the second graph deliberately opens other gates and ignores water/occupants. Counter-branches are local legal experiments, not proofs of a unique solution or global necessity for every tutorial demonstration. No shortest route or autonomous SRA result is claimed.'};
writeFileSync(new URL('../level3-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
