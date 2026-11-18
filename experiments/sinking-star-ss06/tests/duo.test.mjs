import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,DuoPuzzleSession,planReflection,cellToPixel,PALETTE,GRID} from '../dist/core.js';

const eq=(a,b)=>a.x===b.x&&a.y===b.y;
function fixture(o={}) {
  const width=14,height=10,rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=(p,c)=>rows[p[1]][p[0]]=c;
  for(const [k,c] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[k]??[])put(p,c);
  put(o.M??[2,2],'M');put(o.W??[2,6],'W');for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:o.id??'fixture',title:'Duo fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),circuits:o.circuits??[],gates:o.gates??[]};
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
