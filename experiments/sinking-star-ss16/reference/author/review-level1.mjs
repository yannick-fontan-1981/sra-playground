/** Private independent review; never bundled into the game. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileLevel,initialState,stepDetailed,terrainAt,supported,gateClosed,TrioPuzzleSession} from '../../dist/core.js';
import {replay,decodeCommand,stateKey} from '../../scripts/solver.mjs';
import {lessonIds,observeLesson} from '../../dist/tutorial.js';
const historical=[{"id": "mirror-pulled-to-eight", "description": "Le miroir ramené à8,6 transportait depuis le seul appui8,13 vers15,6.", "spec": {"id": "ss16-01", "title": "L’atelier des trois passeurs", "rows": ["####################", "#.....#########....#", "#.....#########.ggg#", "#.Mo..~.~~~~#~~....#", "#.....#.#~~~#~~###.#", "#######.o#~~#~~m.m.#", "#######.~...~~~....#", "#.......~##~#~~....#", "#..W....~~~~#~~....#", "#.......~~~~#~~....#", "#.o..o..~~~~#~~#####", "#...o...~~~~#~~#####", "#.......~~~..~~#####", "#ooT....~~~..~~#####", "#.......~~...~~#####", "#.......~~~~#~~#####", "#.......~~~~#~~#####", "#.......~~~~#~~#####", "####################", "####################"], "mirrors": [{"at": {"x": 9, "y": 6}, "facing": "SE"}], "circuits": [{"id": "cyan", "color": 10, "buttons": [{"x": 6, "y": 8}]}, {"id": "violet", "color": 15, "buttons": [{"x": 2, "y": 9}, {"x": 17, "y": 5}]}], "gates": [{"at": {"x": 8, "y": 5}, "circuit": "cyan", "direction": "S", "closedWhen": "pressed"}, {"at": {"x": 15, "y": 5}, "circuit": "cyan", "direction": "E", "closedWhen": "pressed"}, {"at": {"x": 18, "y": 4}, "circuit": "violet", "direction": "S", "closedWhen": "released"}], "platforms": [{"at": {"x": 8, "y": 6}, "circuit": "cyan", "activeWhen": "pressed"}]}, "commands": "RRRRRDDDDLDUDDLLDLDLURURRCCURRRUUUUURURLDDDDDDDLLLLRRRUCCDDDDDRRRRRXDRCCDDDLDRRRXUCCDRRXRXRDCCLURCRDLCCDRURUUUULLCCDRXRRRUUUUCCUURUUULU"}, {"id": "two-support-lower-route", "description": "Le sol10,14 autorisait seulement deux appuis8/9,14, puis une traction verticale remontait le cargo.", "spec": {"id": "ss16-01", "title": "L’atelier des trois passeurs", "rows": ["####################", "#.....#########....#", "#.....#########.ggg#", "#.Mo..~.~~~~#~~....#", "#.....#.#~~~#~~###.#", "#######.o#~~#~~m.m.#", "#######.~...~~~....#", "#.......###~#~~....#", "#..W....~~~~#~~....#", "#.......~~~~#~~....#", "#.o..o..~~~~#~~#####", "#...o...~~~~#~~#####", "#.......~~~..~~#####", "#ooT....~~~..~~#####", "#.......~~...~~#####", "#.......~~~~#~~#####", "#.......~~~~#~~#####", "#.......~~~~#~~#####", "####################", "####################"], "mirrors": [{"at": {"x": 9, "y": 6}, "facing": "SE"}], "circuits": [{"id": "cyan", "color": 10, "buttons": [{"x": 6, "y": 8}]}, {"id": "violet", "color": 15, "buttons": [{"x": 2, "y": 9}, {"x": 17, "y": 5}]}], "gates": [{"at": {"x": 8, "y": 5}, "circuit": "cyan", "direction": "S", "closedWhen": "pressed"}, {"at": {"x": 15, "y": 5}, "circuit": "cyan", "direction": "E", "closedWhen": "pressed"}, {"at": {"x": 18, "y": 4}, "circuit": "violet", "direction": "S", "closedWhen": "released"}], "platforms": [{"at": {"x": 8, "y": 6}, "circuit": "cyan", "activeWhen": "pressed"}]}, "commands": "RRRRRDDDDLDUDDLLDLDLURURRCURRRRURRRLLLDDLLLLCRRRULLDDDRUDRCCDDDDDDRRRRRRRRUURCURRRRRUCDDDDULCDDLLLLLULLLDRRRRRRCUXDLCCRRUULXDDLCCXDDRRRRRRRUUXDDRCCRULDCCRUURUUUULLCCUUUUUUCCURRUUULU"}];
const design=JSON.parse(readFileSync(new URL('../level1-design.json',import.meta.url),'utf8'));
const spec=design.spec,hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),eq=(a,b)=>a.x===b.x&&a.y===b.y,key=p=>`${p.x},${p.y}`;
assert.equal(spec.rows[7][8],'#');assert.equal(spec.rows[14][10],'~');
const repairs=historical.map(old=>{
 const previous=replay(old.spec,old.commands);assert.equal(previous.state.complete,true);assert.equal(previous.metrics.blocked,0);assert.equal(previous.metrics.deaths,0);
 const w=compileLevel(spec);let s=initialState(w),firstFailure;
 for(const [i,c] of [...old.commands].entries()){
  const action=decodeCommand(c,s),before=s,d=stepDetailed(w,s,action.id,action.data);s=d.state;
  if(s.failed||s.dead){firstFailure={turn:i+1,command:c,selectedHero:before.heroes[before.active],failed:s.failed,dead:s.dead,phases:d.phases.map(p=>p.kind)};break;}
 }
 assert.ok(firstFailure);assert.equal(s.complete,false);
 return{id:old.id,description:old.description,oldMapSha256:hash(old.spec),oldCommands:old.commands,oldActions:previous.metrics.actions,oldWinning:true,oldRefusals:0,oldDeaths:0,oldPermanentSupports:previous.state.supports,fixedFirstFailure:firstFailure,fixedShortcutCompletes:false};
});
const winning=replay(spec,design.commands);assert.equal(winning.state.complete,true);assert.equal(winning.metrics.blocked,0);assert.equal(winning.metrics.deaths,0);assert.equal(winning.metrics.platformsCreated,5);
const session=new TrioPuzzleSession([spec]),learned=new Set();for(const action of winning.actions){const before=session.observe(),after=session.action(action.id,action.data);observeLesson(learned,before,after,action.id);}assert.deepEqual([...learned].sort(),[...lessonIds].sort());
const world=winning.world,initial=initialState(world),steps=[[0,-1],[0,1],[-1,0],[1,0]];
const blocked=(state,p)=>terrainAt(world,p)==='#'||world.gates.some((g,i)=>eq(g.at,p)&&gateClosed(world,state,i));
function floorComponent(state,origin){const queue=[origin],seen=new Set([key(origin)]);for(let i=0;i<queue.length;i++)for(const[dx,dy]of steps){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(!seen.has(key(p))&&!blocked(state,p)&&supported(world,state,p)){seen.add(key(p));queue.push(p);}}return{cells:queue,seen};}
function boundary(component){return[...new Map(component.cells.flatMap(q=>steps.map(([dx,dy])=>({x:q.x+dx,y:q.y+dy}))).filter(p=>!component.seen.has(key(p))&&terrainAt(world,p)!=='#').map(p=>[key(p),p])).values()];}
const dock=floorComponent(initial,initial.heroes[0].at),dockWater=boundary(dock).filter(p=>terrainAt(world,p)==='~');assert.deepEqual(dockWater,[{x:6,y:3}]);assert.equal(dock.cells.some(p=>world.goals.some(g=>eq(g,p))),false);
const chamber=floorComponent(initial,world.goals[0]),neighbors=boundary(chamber),dryEntrances=neighbors.filter(p=>terrainAt(world,p)==='.'),waterNeighbors=neighbors.filter(p=>terrainAt(world,p)==='~');assert.deepEqual(dryEntrances,[{x:18,y:4}]);assert.equal(world.goals.every(g=>chamber.seen.has(key(g))),true);
const setupStage=design.stages.find(s=>s.label.includes('seul axe'));assert.ok(setupStage);const setup=replay(spec,design.commands.slice(0,setupStage.turn)).state;
const resourceKey=s=>JSON.stringify([s.stones,s.monsters,s.supports,s.mirrors]);
function search(start,roleIndex){
 const first={...start,active:roleIndex},queue=[first],seen=new Set([stateKey(first)]),resources=resourceKey(first),otherPositions=first.heroes.map(h=>h.at);let transitions=0,court=false,goals=false;
 for(let i=0;i<queue.length;i++){
  const s=queue[i],h=s.heroes[roleIndex];court ||= h.at.x>=15;goals ||= world.goals.some(p=>eq(p,h.at));
  for(const id of [1,2,3,4,5]){transitions++;const n=stepDetailed(world,s,id).state;
   if(n.dead||n.failed||resourceKey(n)!==resources||n.heroes.some((h,i)=>i!==roleIndex&&!eq(h.at,otherPositions[i])))continue;
   const k=stateKey(n);if(seen.has(k))continue;seen.add(k);queue.push(n);
  }
  assert.ok(seen.size<20000,'Queue must exhaust rather than silently reaching a search cap');
 }
 return{states:seen.size,transitions,exhausted:true,courtReachable:court,goalReachable:goals};
}
const restricted=[];
for(let mask=0;mask<8;mask++)for(const mirrorX of [8,9,10,11])for(let roleIndex=0;roleIndex<3;roleIndex++){
 const start={...structuredClone(setup),heroes:setup.heroes.map((h,i)=>({...h,at:[{x:5,y:9},{x:3,y:8},{x:3,y:13}][i]})),mirrors:[{at:{x:mirrorX,y:6},facing:'SE'}],supports:[...setup.supports,...[8,9,10].filter((_,i)=>mask&(1<<i)).map(x=>({x,y:13}))],complete:false,failed:false,dead:false};
 const r=search(start,roleIndex);if(mask!==7||mirrorX!==11)assert.equal(r.courtReachable,false);assert.equal(r.goalReachable,false);restricted.push({supportMask:mask,mainSupports:start.supports.filter(p=>p.y===13),mirror:[mirrorX,6],activeRole:start.heroes[roleIndex].kind,...r});
}
assert.ok(restricted.filter(r=>r.supportMask===7&&r.mirror[0]===11).every(r=>r.courtReachable));
const report={game:'SS16',level:1,success:true,mapSha256:hash(spec),reviewer:'Independent engine review',scope:'Two reproduced historical winning shortcuts, corrected winning replay, public tutorial coverage, dry-topology checks and 96 fixed-resource single-hero searches',repairs,
 currentWinningRoute:{...winning.metrics,complete:true,lessons:learned.size,lessonIds:[...lessonIds]},
 geometry:{merchantDockFloorCells:dock.cells.length,merchantDockOnlyWaterExit:dockWater,goalChamberFloorCells:chamber.cells.length,uniqueDryGoalEntrance:dryEntrances,adjacentGoalWater:waterNeighbors,exitInitiallyClosed:true,blockedSouthArms:[[8,7],[9,7],[10,7]],lowerShortcutCellNowWater:[10,14]},
 restrictedProbes:{count:restricted.length,allQueuesExhausted:true,states:restricted.reduce((n,r)=>n+r.states,0),transitions:restricted.reduce((n,r)=>n+r.transitions,0),cases:restricted},
 limitations:[
  'The old winning routes establish two concrete bypasses; their first failures verify those routes were eliminated.',
  'Each of96 searches moves one hero while both other heroes and all resources stay fixed; three exact bridge cells and four fixed mirror positions vary between searches. Several cooperating heroes or rearranged resources are outside this search.',
  'The full three-cell bridge with mirror11,6 reaches the right court in this restricted model; partial versions do not. This does not prove every winning solution uses those exact three cells.',
  'The chamber has one dry gate entrance and also a water boundary at14,3. No claim of an entirely wall-sealed enclosure or global impossibility of resource-dependent bypasses is made.',
  'The witnessed press provides the hydraulic support and clears both monsters. Mirror access is not claimed to require that particular support-creation method: another crate could in principle be immersed at8,6.',
  'No minimum-length, uniqueness, exhaustive resource-arrangement search or autonomous SRA success is claimed.'
 ]};
writeFileSync(new URL('../level1-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:true,actions:winning.metrics.actions,lessons:learned.size,repairs:repairs.map(r=>({id:r.id,oldActions:r.oldActions,firstFailure:r.fixedFirstFailure})),searches:restricted.length,states:report.restrictedProbes.states,transitions:report.restrictedProbes.transitions},null,2));
