import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,DuoPuzzleSession,planReflection,cellToPixel,PALETTE,GRID} from '../dist/core.js';

const eq=(a,b)=>a.x===b.x&&a.y===b.y;
function fixture(o={}) {
  const width=14,height=10,rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=(p,c)=>rows[p[1]][p[0]]=c;
  for(const [k,c] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[k]??[])put(p,c);
  put(o.M??[2,2],'M');put(o.W??[2,6],'W');for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:o.id??'fixture',title:'Duo fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});return {spec,world,state,at};
}
const select=(w,s,index)=>stepWorld(w,s,6,cellToPixel(s.heroes[index].at));
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const assertAt=(actual,expected)=>assert.deepEqual(actual,expected);

test('compiler centers exactly one Merchant, one Warrior and two destinations',()=>{
  const f=fixture();assert.equal(f.world.heroes.length,2);assert.equal(f.world.goals.length,2);assert.equal(f.world.heroes[0].kind,'merchant');assert.equal(f.world.heroes[1].kind,'warrior');assertAt(f.state.heroes[0].at,f.at(2,2));assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);assert.ok(Object.isFrozen(f.world));
});
test('compiler rejects missing roles, destinations, ragged maps and invalid devices',()=>{
  const f=fixture();assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replace('W','.'))}));assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replaceAll('g','.'))}));assert.throws(()=>compileLevel({...f.spec,rows:['MWgg','...']}));assert.throws(()=>fixture({mirrors:[[2,2,'NE']]}));assert.throws(()=>fixture({mirrors:[[3,3,'BAD']]}));assert.throws(()=>fixture({gates:[{at:{x:3,y:3},direction:'E',closedWhen:'pressed',circuit:'absent'}]}));
});
test('solo rooms explicitly require one Warrior and one destination while duo remains the default',()=>{
  const solo={id:'solo-contract',title:'Solo contract',mode:'solo-warrior',rows:['#####','#W.g#','#####']};
  const world=compileLevel(solo);assert.deepEqual(world.heroes.map(h=>h.kind),['warrior']);assert.equal(world.goals.length,1);assert.equal(initialState(world).active,0);
  assert.throws(()=>compileLevel({...solo,mode:undefined}),/one Merchant, one Warrior and two destinations/);
  for(const rows of [['M.g'],['MWgg'],['WWg'],['Wgg'],['W..']])assert.throws(()=>compileLevel({...solo,rows}),/exactly one Warrior and one destination/);
  for(const mode of ['solo','unknown',null,0])assert.throws(()=>compileLevel({...solo,mode}),/Invalid hero mode/);
  const duo=fixture();assert.deepEqual(compileLevel({...duo.spec,mode:'duo'}),duo.world);
});
test('a solo Warrior keeps chain pushing and wins with the only destination',()=>{
  const spec={id:'solo-push',title:'Solo push',mode:'solo-warrior',rows:['########','#Woo...#','#....g.#','########']};
  const world=compileLevel(spec),initial=initialState(world),pushed=stepDetailed(world,initial,4);
  assert.equal(pushed.phases[0].kind,'push');assert.equal(pushed.phases[0].moves.length,3);assert.equal(pushed.state.heroes.length,1);assert.equal(pushed.state.heroes[0].kind,'warrior');
  const session=new DuoPuzzleSession([spec]),before=session.observe();assert.equal(before.frame.flat().includes(12),false);assert.equal(before.frame.flat().includes(8),true);
  let observation;for(const action of [4,4,2,4,4])observation=session.action(action);
  assert.equal(observation.state,'WIN');assert.equal(observation.levelsCompleted,1);assert.deepEqual(observation.availableActionIds,[1,2,3,4,5,6]);
  for(const key of ['heroes','active','mode','goals','solution','world'])assert.equal(key in observation,false);
  const undone=session.undo();assert.equal(undone.state,'NOT_FINISHED');assert.equal(undone.levelsCompleted,0);assert.equal(session.action(4).state,'WIN');
});
test('solo selection never ticks or adds Undo history, including after a movement',()=>{
  const spec={id:'solo-selection',title:'Solo selection',mode:'solo-warrior',rows:['#######','#W..g.#','#######']};
  const world=compileLevel(spec),initial=initialState(world),self=cellToPixel(initial.heroes[0].at),session=new DuoPuzzleSession([spec]),before=session.observe();
  assert.equal(stepWorld(world,initial,6,self),initial);assert.deepEqual(stepDetailed(world,initial,6,self).phases,[]);
  assert.deepEqual(session.nextHero(),before);assert.deepEqual(session.action(6,self),before);assert.deepEqual(session.action(6,{x:0,y:0}),before);assert.equal(session.observe().canUndo,false);
  session.action(4);const moved=session.observe();assert.equal(moved.canUndo,true);assert.deepEqual(session.nextHero(),moved);assert.deepEqual(session.action(6,{x:0,y:0}),moved);
  assert.deepEqual(session.undo(),before);assert.equal(session.observe().canUndo,false);
});
test('mixed campaigns transition between duo and solo rooms and Undo restores either state',()=>{
  const duo=fixture({id:'mixed-duo',M:[10,2],W:[10,6]}),solo={id:'mixed-solo',title:'Solo finish',mode:'solo-warrior',rows:['#####','#W.g#','#####']};
  const session=new DuoPuzzleSession([duo.spec,solo]);session.action(4);session.nextHero();const beforeTransition=session.observe();
  let observation=session.action(4);assert.equal(observation.level,2);assert.equal(observation.levelsCompleted,1);assert.equal(observation.frame.flat().includes(12),false);
  assert.deepEqual(session.undo(),beforeTransition);session.action(4);session.action(4);const beforeWin=session.observe();assert.equal(beforeWin.level,2);
  observation=session.action(4);assert.equal(observation.state,'WIN');assert.equal(observation.levelsCompleted,2);
  assert.deepEqual(session.undo(),beforeWin);assert.equal(session.action(4).state,'WIN');
  observation=session.selectLevel(1);assert.equal(observation.level,1);assert.equal(observation.levelsCompleted,1);assert.equal(observation.frame.flat().includes(12),true);assert.equal(observation.frame.flat().includes(8),true);
});
test('compiler accepts movable mirror digits with exact face mapping',()=>{
  const f=fixture();const rows=f.spec.rows.map((r,i)=>i===4?r.slice(0,4)+'1234'+r.slice(8):r);const w=compileLevel({...f.spec,rows});assert.deepEqual(w.mirrors.map(m=>m.facing),['NE','SE','SW','NW']);
});
test('ACTION6 selects by public pixels without ticking monsters or circuits',()=>{
  const f=fixture({monsters:[[3,2]]});const next=select(f.world,f.state,1);assert.equal(next.active,1);assert.equal(next.dead,false);assert.deepEqual(next.heroes,f.state.heroes);assert.deepEqual(next.stones,f.state.stones);assert.deepEqual(stepDetailed(f.world,f.state,6,cellToPixel(f.state.heroes[1].at)).phases,[]);
  assert.equal(stepWorld(f.world,next,6,{x:0,y:0}),next);
});
test('invalid action and click payloads are rejected without mutation',()=>{
  const f=fixture(),before=JSON.stringify(f.state);for(const a of [0,7,1.5,NaN])assert.throws(()=>stepWorld(f.world,f.state,a));for(const p of [undefined,{x:-1,y:3},{x:64,y:4},{x:2.2,y:4}])assert.throws(()=>stepWorld(f.world,f.state,6,p));assert.equal(JSON.stringify(f.state),before);
});
test('Merchant pushes exactly one stone directly with a direction',()=>{
  const f=fixture({stones:[[3,2]]}),d=stepDetailed(f.world,f.state,4);assertAt(hero(d.state,'merchant').at,f.at(3,2));assertAt(d.state.stones[0],f.at(4,2));assert.equal(d.phases[0].kind,'push');assert.equal(d.phases[0].moves.length,2);
});
test('Merchant refuses a contiguous two-stone file atomically',()=>{
  const f=fixture({stones:[[3,2],[4,2]]}),s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.deepEqual(s.stones,f.state.stones);assertAt(s.heroes[0].at,f.state.heroes[0].at);
});
test('Warrior pushes a whole stone file and converts its tail into an aquatic support',()=>{
  const f=fixture({stones:[[3,6],[4,6],[5,6]],water:[[6,6]]});let s=select(f.world,f.state,1);s=stepWorld(f.world,s,4);assertAt(hero(s,'warrior').at,f.at(3,6));assert.deepEqual(s.stones,[f.at(4,6),f.at(5,6)]);assert.deepEqual(s.supports,[f.at(6,6)]);assert.equal(s.dead,false);
});
test('blocked Warrior tail cancels all motion',()=>{
  const f=fixture({stones:[[3,6],[4,6]],walls:[[5,6]]});const s=stepWorld(f.world,select(f.world,f.state,1),4);assert.equal(s.failed,true);assert.deepEqual(s.stones,f.state.stones);assertAt(hero(s,'warrior').at,f.at(2,6));
});
test('Warrior can push the companion and a mixed file without changing roles',()=>{
  const f=fixture({M:[3,6],stones:[[4,6]],mirrors:[[5,6,'NW']]});const d=stepDetailed(f.world,select(f.world,f.state,1),4);assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(4,6));assertAt(hero(d.state,'warrior').at,f.at(3,6));assertAt(d.state.stones[0],f.at(5,6));assert.deepEqual(d.state.mirrors,[{at:f.at(6,6),facing:'NW'}]);assert.equal(d.phases[0].moves.length,4);
});
test('Merchant can push one mirror and its orientation is preserved',()=>{
  const f=fixture({mirrors:[[3,2,'SE']]});const s=stepWorld(f.world,f.state,4);assert.deepEqual(s.mirrors,[{at:f.at(4,2),facing:'SE'}]);assertAt(hero(s,'merchant').at,f.at(3,2));
});
test('voluntary steps and pushes refuse unsupported water for both heroes and mirrors',()=>{
  for(const o of [{water:[[3,2]]},{mirrors:[[3,2,'SE']],water:[[4,2]]},{W:[3,2],water:[[4,2]]}]){const f=fixture(o),s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.equal(s.dead,false);assert.deepEqual(s.mirrors,f.state.mirrors);assert.deepEqual(s.heroes.map(h=>h.at),f.state.heroes.map(h=>h.at));}
});
test('a submerged stone is a stationary traversable platform',()=>{
  const f=fixture({stones:[[3,2]],water:[[4,2]]});let s=stepWorld(f.world,f.state,4);s=stepWorld(f.world,s,4);assertAt(hero(s,'merchant').at,f.at(4,2));assert.deepEqual(s.supports,[f.at(4,2)]);assert.equal(s.dead,false);
});
test('a monster pushed into water drowns without creating a platform',()=>{
  const f=fixture({monsters:[[3,2]],water:[[4,2]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.monsters.length,0);assert.equal(s.supports.length,0);assert.equal(s.dead,false);
});
test('global reflection exchanges both heroes simultaneously and preserves selection',()=>{
  const f=fixture({M:[5,3],W:[7,5],mirrors:[[5,5,'NE']]});const plan=planReflection(f.world,f.state);assert.equal(plan.moves.length,2);const s=stepWorld(f.world,f.state,5);assertAt(hero(s,'merchant').at,f.at(7,5));assertAt(hero(s,'warrior').at,f.at(5,3));assert.equal(s.active,0);assert.equal(s.failed,false);
});
test('Warrior-selected ACTION5 uses the same global mirror operation',()=>{
  const f=fixture({M:[5,3],W:[7,5],mirrors:[[5,5,'NE']]});const a=stepWorld(f.world,f.state,5),b=stepWorld(f.world,select(f.world,f.state,1),5);assert.deepEqual(a.heroes,b.heroes);assert.equal(b.active,1);
});
test('a blocked reflection endpoint cancels the entire global reflection',()=>{
  const f=fixture({M:[5,3],W:[2,6],mirrors:[[5,5,'NE']],walls:[[7,5]]});assert.equal(planReflection(f.world,f.state),null);const s=stepWorld(f.world,f.state,5);assert.equal(s.failed,true);assert.deepEqual(s.heroes,f.state.heroes);
});
test('an actor seen by two mirrors with different destinations cannot clone',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE'],[3,3,'SE']]});assert.equal(planReflection(f.world,f.state),null);const s=stepWorld(f.world,f.state,5);assert.equal(s.failed,true);assert.equal(s.heroes.length,2);assert.deepEqual(s.heroes,f.state.heroes);
});
test('reflection onto water creates a crate platform but kills an unsupported hero',()=>{
  const crate=fixture({M:[2,2],stones:[[5,3]],water:[[7,5]],mirrors:[[5,5,'NE']]});const s=stepWorld(crate.world,crate.state,5);assert.equal(s.stones.length,0);assert.deepEqual(s.supports,[crate.at(7,5)]);
  const person=fixture({M:[5,3],water:[[7,5]],mirrors:[[5,5,'NE']]});const dead=stepWorld(person.world,person.state,5);assert.equal(dead.dead,true);assert.equal(hero(dead,'merchant').dead,true);assert.equal(hero(dead,'warrior').dead,false);
});
test('mirrors weigh on buttons and can hold a normal door open',()=>{
  const f=fixture({mirrors:[[3,2,'SE']],buttons:[[4,2]],doors:[[8,4]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.failed,false);const p=cellToPixel(f.at(8,4));const frame=renderWorld(f.world,s);assert.equal(frame[p.y+1][p.x+1],3);
});
test('a lateral press pushes a mirror and a companion file',()=>{
  const f=fixture({M:[2,2],W:[5,5],mirrors:[[4,5,'NE']],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const d=stepDetailed(f.world,f.state,4);assertAt(hero(d.state,'warrior').at,f.at(6,5));assertAt(d.state.mirrors[0].at,f.at(5,5));assert.ok(d.phases.some(p=>p.kind==='piston'));assert.equal(d.state.dead,false);
});
test('blocked lateral press crushes only its own occupant',()=>{
  const f=fixture({M:[2,2],W:[5,5],stones:[[4,5]],walls:[[6,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.stones.length,0);assertAt(hero(d.state,'warrior').at,f.at(5,5));assert.equal(d.state.dead,false);assert.ok(d.phases.some(p=>p.kind==='crush'));
});
test('a press can force the inactive hero into water and trigger GAME_OVER',()=>{
  const f=fixture({W:[4,5],water:[[5,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const s=stepWorld(f.world,f.state,4);assert.equal(s.dead,true);assert.equal(hero(s,'warrior').dead,true);assertAt(hero(s,'warrior').at,f.at(5,5));
});
test('a press may destroy a mirror by pushing it into unsupported water',()=>{
  const f=fixture({mirrors:[[4,5,'NE']],water:[[5,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const s=stepWorld(f.world,f.state,4);assert.equal(s.mirrors.length,0);assert.equal(s.dead,false);assert.equal(s.supports.length,0);
});
test('monsters attack either hero, including the inactive companion',()=>{
  const f=fixture({monsters:[[3,6]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.dead,true);assert.equal(hero(s,'warrior').dead,true);assert.equal(hero(s,'merchant').dead,false);
});
test('monsters attack simultaneously even if mutually killed in the same wave',()=>{
  const f=fixture({M:[4,2],monsters:[[4,3],[5,3]]});const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.ok(d.phases.some(p=>p.kind==='combat'));
});
test('a refused action never ticks an initially adjacent monster',()=>{
  const f=fixture({walls:[[3,2]],monsters:[[3,6]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.equal(s.dead,false);assert.equal(s.monsters.length,1);
});
test('a move renders exact one-pixel, two-pixel and settled three-pixel advancement',()=>{
  const f=fixture(),s=stepWorld(f.world,f.state,4),frames=transitionFrames(f.world,f.state,s,4),p=cellToPixel(f.state.heroes[0].at);assert.equal(frames.length,3);assert.equal(frames[0][p.y+1][p.x+2],12);assert.equal(frames[1][p.y+1][p.x+3],12);assert.deepEqual(frames[2],renderWorld(f.world,s));assert.notDeepEqual(frames[0],frames[1]);
});
test('reflection has three frames and a gray plus for hero destinations',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE']]});const p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);assert.equal(frame[p.y+1][p.x+1],1);assert.equal(frame[p.y][p.x],3);assert.equal(frame[p.y][p.x+1],1);const s=stepWorld(f.world,f.state,5);assert.equal(transitionFrames(f.world,f.state,s,5).length,3);
});
test('crate reflection preview is a gray square outline and directional push has no preview',()=>{
  const f=fixture({stones:[[5,3]],mirrors:[[5,5,'NE']]});const p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);assert.equal(frame[p.y][p.x],1);assert.equal(frame[p.y+1][p.x+1],3);assert.equal(frame[p.y+2][p.x+2],1);const push=fixture({stones:[[3,2]]});assert.equal(renderWorld(push.world,push.state).flat().includes(1),false);
});
test('combat keeps all five phases after a movement with explicit durations',()=>{
  const f=fixture({M:[4,2],monsters:[[4,3],[5,3]]}),session=new DuoPuzzleSession([f.spec]),obs=session.action(4);assert.equal(obs.state,'GAME_OVER');assert.equal(obs.frames.length,8);assert.deepEqual(obs.frameDurationsMs,[60,80,40,80,90,100,110,0]);assert.deepEqual(obs.frames.at(-1),obs.frame);assert.notDeepEqual(obs.frames[3],obs.frames[4]);assert.notDeepEqual(obs.frames[4],obs.frames[5]);assert.equal(session.action(1).state,'GAME_OVER');
});
test('both destinations must be occupied at the same time',()=>{
  const f=fixture({M:[10,2],W:[10,6]});let s=stepWorld(f.world,f.state,4);assert.equal(s.complete,false);s=select(f.world,s,1);s=stepWorld(f.world,s,4);assert.equal(s.complete,true);assert.equal(s.dead,false);
});
test('Undo restores role selection, mirror positions, supports and deaths',()=>{
  const f=fixture({M:[5,3],water:[[7,5]],mirrors:[[5,5,'NE']]});const s=new DuoPuzzleSession([f.spec]),start=s.observe();s.nextHero();const selected=s.observe();s.action(5);assert.equal(s.observe().state,'GAME_OVER');assert.deepEqual(s.undo().frame,selected.frame);assert.deepEqual(s.undo().frame,start.frame);assert.equal(s.observe().canUndo,false);
});
test('progression accepts out-of-order completion and Undo crosses level boundaries',()=>{
  const a=fixture({id:'a',M:[10,2],W:[10,6]}),b=fixture({id:'b',M:[10,2],W:[10,6]}),s=new DuoPuzzleSession([a.spec,b.spec]);s.selectLevel(2);s.action(4);s.nextHero();const before=s.observe(),done=s.action(4);assert.equal(done.level,1);assert.equal(done.levelsCompleted,1);assert.equal(done.frames.length,4);assert.equal(done.frameDurationsMs.at(-2),100);assert.deepEqual(s.undo().frame,before.frame);assert.equal(s.observe().level,2);assert.equal(s.observe().levelsCompleted,0);
  s.action(4);s.action(4);s.nextHero();assert.equal(s.action(4).state,'WIN');assert.equal(s.observe().levelsCompleted,2);assert.equal(s.restart().level,1);assert.equal(s.observe().levelsCompleted,0);
});
test('observations expose only pixels and controls, including ACTION6',()=>{
  const f=fixture(),s=new DuoPuzzleSession([f.spec]),o=s.observe();assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);assert.equal(o.frame.length,64);assert.ok(o.frame.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16)));for(const k of ['heroes','active','mirrors','stones','world','solution','witness'])assert.equal(k in o,false);const before=s.observe();assert.throws(()=>s.selectLevel(0));assert.deepEqual(s.observe(),before);
});

test('all four reflective quadrants map equal distances on their two front arms',()=>{
  const cases=[['NE',[5,3],[7,5]],['NW',[5,3],[3,5]],['SE',[5,7],[7,5]],['SW',[5,7],[3,5]]];
  for(const [face,M,target] of cases){const f=fixture({M,mirrors:[[5,5,face]]}),s=stepWorld(f.world,f.state,5);assert.equal(s.failed,false,face);assertAt(hero(s,'merchant').at,f.at(...target));}
});
test('the black back of a mirror does not reflect a hero',()=>{
  const f=fixture({M:[5,7],mirrors:[[5,5,'NE']]});assert.equal(planReflection(f.world,f.state),null);assert.equal(stepWorld(f.world,f.state,5).failed,true);
});
test('moving a mirror recomputes its reflection endpoints',()=>{
  const f=fixture({M:[4,5],W:[6,3],mirrors:[[5,5,'NE']]});const before=planReflection(f.world,f.state);assert.equal(before,null);const s=stepWorld(f.world,f.state,4),plan=planReflection(f.world,s);assertAt(s.mirrors[0].at,f.at(6,5));assert.ok(plan.moves.some(m=>m.actor==='hero'&&eq(m.from,f.at(6,3))&&eq(m.to,f.at(8,5))));
});
test('press cascades re-evaluate a second circuit after the first push',()=>{
  const f=fixture({stones:[[4,5],[8,5]],water:[[9,5]],buttons:[[3,2],[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]},{id:'b',buttons:[{x:5,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'},{at:{x:8,y:5},circuit:'b',direction:'E',closedWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(9,5)]);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','piston']);assert.deepEqual(d.state.gateClosed,[true,true]);assert.equal(transitionFrames(f.world,f.state,d.state,4).length,9);
});
test('a closed gate can hold its own pressure plate after expelling a stone',()=>{
  const f=fixture({stones:[[4,5]],circuits:[{id:'a',buttons:[{x:4,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});assert.deepEqual(f.state.gateClosed,[true]);assert.deepEqual(f.state.stones,[f.at(5,5)]);const s=stepWorld(f.world,f.state,4);assert.deepEqual(s.gateClosed,[true]);assert.equal(s.failed,false);
});

test('hero reflection preview stays readable over a support or destination while keeping its corners',()=>{
  for(const [extra,corner] of [[{supports:[[7,5]]},10],[{goals:[[7,5],[11,6]]},11]]){
    const f=fixture({M:[5,3],mirrors:[[5,5,'NE']],...extra}),p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);
    assert.equal(frame[p.y][p.x],corner);assert.equal(frame[p.y][p.x+1],1);assert.equal(frame[p.y+1][p.x],1);assert.equal(frame[p.y+1][p.x+1],1);assert.equal(frame[p.y+1][p.x+2],1);assert.equal(frame[p.y+2][p.x+1],1);
  }
});

test('a fatal initial press in a later level rejects the campaign before replacing an active session',()=>{
  const valid={id:'valid',title:'Valid',rows:['MWgg']};
  const fatal={id:'fatal',title:'Fatal initial press',rows:['M~Wgg'],circuits:[{id:'a',buttons:[{x:4,y:0}]}],gates:[{at:{x:0,y:0},circuit:'a',direction:'E',closedWhen:'released'}]};
  // The map itself is valid; settling its initial gate drowns the Merchant.
  const fatalWorld=compileLevel(fatal);assert.throws(()=>initialState(fatalWorld),/Initial piston circuit/);
  let active=new DuoPuzzleSession([valid]);active.nextHero();const before=active.observe();
  assert.throws(()=>{active=new DuoPuzzleSession([valid,fatal]);},/Initial piston circuit/);
  assert.deepEqual(active.observe(),before);assert.equal(active.observe().level,1);assert.equal(active.observe().canUndo,true);assert.equal(active.undo().canUndo,false);
});

test('rejected level selection preserves current pixels, completion and Undo history',()=>{
  const a=fixture({id:'transaction-a',M:[10,2],W:[10,6]}),b=fixture({id:'transaction-b',M:[10,2],W:[10,6]}),session=new DuoPuzzleSession([a.spec,b.spec]);
  session.action(4);session.nextHero();session.action(4);session.action(3);
  const before=session.observe();assert.equal(before.level,2);assert.equal(before.levelsCompleted,1);assert.equal(before.canUndo,true);
  for(const invalid of [0,3,1.5,NaN]){assert.throws(()=>session.selectLevel(invalid),/Invalid level/);assert.deepEqual(session.observe(),before);}
  const undone=session.undo();assert.equal(undone.level,2);assert.equal(undone.levelsCompleted,1);assert.notDeepEqual(undone.frame,before.frame);
});


test('hydraulic platforms require unique water cells, valid circuits and palette colors',()=>{
  const base={water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}],color:14}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]};
  const f=fixture(base);assert.equal(f.world.platforms.length,1);assert.equal(f.world.circuits[0].color,14);
  assert.throws(()=>fixture({...base,water:[]}));assert.throws(()=>fixture({...base,platforms:[...base.platforms,...base.platforms]}));
  assert.throws(()=>fixture({...base,platforms:[{...base.platforms[0],circuit:'missing'}]}));assert.throws(()=>fixture({...base,platforms:[{...base.platforms[0],activeWhen:'never'}]}));
  for(const color of [-1,16,1.2,NaN])assert.throws(()=>fixture({...base,circuits:[{...base.circuits[0],color}]}));
});

test('hydraulic bridges obey AND circuits and both polarities with visible circuit markers',()=>{
  const f=fixture({W:[8,6],water:[[5,5],[6,5]],circuits:[{id:'a',buttons:[{x:3,y:2},{x:9,y:6}],color:14}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'},{at:{x:6,y:5},circuit:'a',activeWhen:'released'}]});
  assert.deepEqual(f.state.platformActive,[false,true]);const p=cellToPixel(f.at(5,5)),off=renderWorld(f.world,f.state);assert.equal(off[p.y][p.x],7);assert.equal(off[p.y][p.x+1],9);assert.equal(off[p.y+1][p.x+1],14);
  let s=stepWorld(f.world,f.state,4);assert.deepEqual(s.platformActive,[false,true]);s=stepWorld(f.world,select(f.world,s,1),4);assert.deepEqual(s.platformActive,[true,false]);
  const on=renderWorld(f.world,s);assert.equal(on[p.y][p.x+1],7);assert.equal(on[p.y+1][p.x+1],14);
});

test('retracting a bridge under the inactive hero causes GAME_OVER and Undo restores the full bridge',()=>{
  const f=fixture({W:[4,5],water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
  const absent=stepWorld(f.world,select(f.world,f.state,1),4);assert.equal(absent.failed,true);assert.equal(absent.dead,false);
  const session=new DuoPuzzleSession([f.spec]),raised=session.action(4);assert.equal(raised.frames.length,6);assert.deepEqual(raised.frameDurationsMs,[60,80,40,60,80,0]);
  session.nextHero();session.action(4);session.nextHero();const before=session.observe(),fallen=session.action(3);assert.equal(fallen.state,'GAME_OVER');assert.equal(fallen.frames.length,6);assert.deepEqual(fallen.frameDurationsMs,[60,80,40,60,80,0]);assert.deepEqual(session.undo().frame,before.frame);
});

test('a crate stays movable on a raised bridge and becomes a permanent support when it retracts',()=>{
  const f=fixture({W:[3,5],stones:[[4,5]],water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
  let s=stepWorld(f.world,f.state,4);s=stepWorld(f.world,select(f.world,s,1),4);assert.deepEqual(s.stones,[f.at(5,5)]);assert.equal(s.supports.length,0);
  s=stepWorld(f.world,select(f.world,s,0),3);assert.deepEqual(s.platformActive,[false]);assert.equal(s.stones.length,0);assert.deepEqual(s.supports,[f.at(5,5)]);
  const px=cellToPixel(f.at(5,5)),frame=renderWorld(f.world,s);assert.equal(frame[px.y][px.x],10);assert.equal(frame[px.y][px.x+1],13);assert.equal(frame[px.y+1][px.x+1],10);
  s=stepWorld(f.world,select(f.world,s,1),4);assert.equal(s.failed,false);assert.equal(s.dead,false);assertAt(hero(s,'warrior').at,f.at(5,5));
});

test('forced mirrors and monsters survive a simultaneous bridge activation, then fall on retraction',()=>{
  for(const actor of ['mirror','monster']){
    const f=fixture({...(actor==='mirror'?{mirrors:[[4,5,'NE']]}:{monsters:[[4,5]]}),water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
    let s=stepWorld(f.world,f.state,4);assert.equal(s.dead,false);assert.deepEqual(s.platformActive,[true]);assertAt(actor==='mirror'?s.mirrors[0].at:s.monsters[0],f.at(5,5));
    s=stepWorld(f.world,s,3);assert.equal(s.dead,false);assert.equal(s.mirrors.length+s.monsters.length,0);assert.equal(s.supports.length,0);
  }
});

test('a reflection can activate its own landing bridge and release it safely on the return',()=>{
  const f=fixture({M:[5,3],W:[10,7],stones:[[2,6]],water:[[7,5]],mirrors:[[5,5,'NE'],[2,4,'SE']],circuits:[{id:'a',buttons:[{x:4,y:4}],color:15}],platforms:[{at:{x:7,y:5},circuit:'a',activeWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,5);assert.equal(d.state.dead,false);assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(7,5));assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['reflect','platform']);
  const s=stepWorld(f.world,d.state,5);assert.equal(s.dead,false);assertAt(hero(s,'merchant').at,f.at(5,3));assert.deepEqual(s.platformActive,[false]);
});

test('a press cascade settles the landing bridge before testing water support',()=>{
  const f=fixture({W:[7,5],stones:[[4,5]],water:[[8,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]},{id:'b',buttons:[{x:5,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:8,y:5},circuit:'b',activeWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,4);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','platform']);
  const s=stepWorld(f.world,select(f.world,d.state,1),4);assert.equal(s.failed,false);assert.equal(s.dead,false);assertAt(hero(s,'warrior').at,f.at(8,5));
});

test('a fatal initial forced landing on an absent bridge rejects the new campaign transactionally',()=>{
  const valid={id:'valid-water',title:'Valid',rows:['MWgg']};
  const fatal={id:'fatal-water',title:'Absent bridge',rows:['M~Wgg'],circuits:[{id:'a',buttons:[{x:4,y:0}]}],gates:[{at:{x:0,y:0},circuit:'a',direction:'E',closedWhen:'released'}],platforms:[{at:{x:1,y:0},circuit:'a',activeWhen:'pressed'}]};
  const world=compileLevel(fatal);assert.throws(()=>initialState(world),/Initial piston circuit/);
  let session=new DuoPuzzleSession([valid]);session.nextHero();const before=session.observe();assert.throws(()=>{session=new DuoPuzzleSession([valid,fatal]);},/Initial piston circuit/);assert.deepEqual(session.observe(),before);
});
