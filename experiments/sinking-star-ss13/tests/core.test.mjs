import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,DuoPuzzleSession,planReflection,planSwap,traceSwap,cellToPixel,PALETTE,GRID,circuitPressed} from '../dist/core.js';

/** Small mechanics fixtures; campaign witnesses and author solvers are never loaded. */
function fixture(o={}) {
  const width=14,height=10;
  const rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=(p,c)=>rows[p[1]][p[0]]=c;
  for(const [k,c] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[k]??[])put(p,c);
  put(o.T??[2,2],'T');put(o.Z??[2,6],'Z');for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:o.id??'fixture',title:'Voleur et Magicien',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});return{spec,world,state,at};
}
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(f,kind,s=f.state)=>stepWorld(f.world,s,6,cellToPixel(hero(s,kind).at));
const wizard=(f,s=f.state)=>select(f,'wizard',s);
const positions=s=>({heroes:s.heroes.map(h=>h.at),stones:s.stones,monsters:s.monsters,mirrors:s.mirrors,supports:s.supports});

test('SS13 requires T=Thief and Z=Wizard in stable order, colors14/15 and 3px cells',()=>{
  const f=fixture(),o=new DuoPuzzleSession([f.spec]).observe();
  assert.deepEqual(f.world.heroes.map(h=>h.kind),['thief','wizard']);assert.equal(o.gameCode,'SS13');assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);
  for(const [kind,color] of [['thief',14],['wizard',15]]){const p=cellToPixel(hero(f.state,kind).at);assert.equal(o.frame[p.y+1][p.x+1],color);}
  for(const rows of [['Tgg'],['Zgg'],['TTgg'],['ZZgg'],['TZg'],['TZggg'],['WZgg']])assert.throws(()=>compileLevel({...f.spec,rows}));
});

test('selection adds no combat tick and observations contain no semantic state or plans',()=>{
  const f=fixture({monsters:[[3,2]]}),s=wizard(f),o=new DuoPuzzleSession([f.spec]).nextHero();
  assert.equal(s.dead,false);assert.equal(s.active,1);assert.deepEqual(s.heroes,f.state.heroes);
  for(const key of ['heroes','stones','mirrors','world','paths','phases','loopPath','commands','solution','witness'])assert.equal(key in o,false);
});

test('invalid public action ids and fractional or out-of-canvas selections are rejected',()=>{
  const f=fixture(),session=new DuoPuzzleSession([f.spec]),before=session.observe();
  for(const id of [0,7,-1,2.5,NaN])assert.throws(()=>session.action(id),RangeError);
  for(const point of [undefined,{x:-1,y:2},{x:64,y:2},{x:2.5,y:2},{x:2,y:NaN}])assert.throws(()=>session.action(6,point),RangeError);
  assert.deepEqual(session.observe(),before);assert.deepEqual(session.action(6,{x:0,y:0}),before);
});

test('Thief pulls exactly the adjacent rear crate, leaving the remainder of a file',()=>{
  const f=fixture({T:[4,2],stones:[[2,2],[3,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(5,2));assert.deepEqual(d.state.stones,[f.at(2,2),f.at(4,2)]);
  assert.deepEqual(d.phases.map(p=>p.kind),['pull']);assert.equal(d.phases[0].moves.length,2);assert.equal(transitionFrames(f.world,f.state,d.state,4).length,3);
});

test('a perpendicular departure leaves the old rear crate in place',()=>{
  const f=fixture({T:[4,2],stones:[[3,2]]}),d=stepDetailed(f.world,f.state,1);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk']);
});

test('the Thief cannot push a front crate, mirror, monster or partner',()=>{
  for(const extra of [{stones:[[3,2]]},{mirrors:[[3,2,'NE']]},{monsters:[[3,2]]},{Z:[3,2]}]){
    const f=fixture(extra),d=stepDetailed(f.world,f.state,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(f.state));assert.deepEqual(d.phases,[]);
  }
});

test('a blocked forward step refuses traction atomically and does not tick a monster',()=>{
  const f=fixture({T:[4,2],stones:[[3,2]],walls:[[5,2]],monsters:[[4,1]],facing:'N'}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(f.state));assert.equal(hero(d.state,'thief').facing,'E');assert.deepEqual(d.phases,[]);
});

test('pulling the Wizard does not cast toward another visible crate',()=>{
  const f=fixture({T:[4,4],Z:[3,4],stones:[[2,4]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(4,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['pull']);
});

test('mirror traction preserves facing and animates the two actors in three timed frames',()=>{
  const f=fixture({T:[4,4],mirrors:[[3,4,'NW']]}),session=new DuoPuzzleSession([f.spec]),o=session.action(4);
  const d=stepDetailed(f.world,f.state,4);assert.deepEqual(d.state.mirrors,[{at:f.at(4,4),facing:'NW'}]);
  assert.equal(o.frames.length,3);assert.deepEqual(o.frameDurationsMs,[60,80,0]);assert.deepEqual(o.frames.at(-1),o.frame);
});

test('a submerged support remains fixed and is not a traction or swap target',()=>{
  const f=fixture({T:[4,4],Z:[3,6],supports:[[3,4],[5,6]]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['walk']);assert.equal(planSwap(f.world,wizard(f),'E'),null);
});

test('a lateral press moves the Thief without dragging the crate behind him',()=>{
  const f=fixture({T:[4,5],Z:[2,2],stones:[[3,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,wizard(f),4);
  assert.deepEqual(hero(d.state,'thief').at,f.at(5,5));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});

test('voluntary walking cannot use an inactive hydraulic platform as a landing',()=>{
  for(const kind of ['thief','wizard']){
    const y=kind==='thief'?2:6;
    const f=fixture({water:[[3,y]],circuits:[{id:'a',buttons:[{x:8,y:8}]}],platforms:[{at:{x:3,y},circuit:'a',activeWhen:'pressed'}]}),before=select(f,kind),d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(before));assert.deepEqual(d.phases,[]);
  }
});

test('withdrawing a platform after a valid pull sinks its crate into a persistent support',()=>{
  const f=fixture({T:[3,4],stones:[[2,4]],water:[[4,4]],circuits:[{id:'a',buttons:[{x:5,y:4}]}],platforms:[{at:{x:4,y:4},circuit:'a',activeWhen:'released'}]});
  const entered=stepWorld(f.world,f.state,4),d=stepDetailed(f.world,entered,4);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.equal(d.state.stones.length,0);assert.deepEqual(d.state.supports,[f.at(4,4)]);assert.deepEqual(d.phases.map(p=>p.kind),['pull','platform']);
  const left=stepWorld(f.world,d.state,2);assert.equal(left.platformActive[0],true);assert.deepEqual(left.supports,d.state.supports);
});

test('pressing a command may withdraw a previously valid platform under the partner, and Undo restores it',()=>{
  const f=fixture({T:[3,4],Z:[2,4],water:[[4,4]],circuits:[{id:'a',buttons:[{x:5,y:4}]}],platforms:[{at:{x:4,y:4},circuit:'a',activeWhen:'released'}]}),session=new DuoPuzzleSession([f.spec]);
  session.action(4);const before=session.observe(),o=session.action(4);assert.equal(o.state,'GAME_OVER');assert.deepEqual(session.undo(),before);
});

test('Wizard exchanges the first aligned target and walks when no target exists',()=>{
  const f=fixture({Z:[3,6],stones:[[5,6],[8,6]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.phases[0].kind,'swap');assert.deepEqual(hero(d.state,'wizard').at,f.at(5,6));assert.deepEqual(d.state.stones,[f.at(3,6),f.at(8,6)]);
  const walking=stepDetailed(f.world,d.state,1);assert.equal(walking.phases[0].kind,'walk');assert.deepEqual(hero(walking.state,'wizard').at,f.at(5,5));
});

test('a Wizard ray crosses water and bends at two white mirror faces',()=>{
  const f=fixture({Z:[3,3],T:[2,8],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=wizard(f),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
  assert.equal(plan.reflections,2);assert.deepEqual(plan.to,f.at(5,1));assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(5,1));assert.deepEqual(d.state.stones,[f.at(3,3)]);assert.equal(transitionFrames(f.world,before,d.state,4).length,3);
});

test('a black mirror back stops the ray and the Wizard cannot push or swap the mirror',()=>{
  const f=fixture({Z:[3,6],stones:[[8,6]],mirrors:[[5,6,'NE']]}),before=wizard(f);assert.equal(planSwap(f.world,before,'E'),null);
  const walk=stepWorld(f.world,before,4),refused=stepDetailed(f.world,walk,4);
  assert.deepEqual(hero(walk,'wizard').at,f.at(4,6));assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.mirrors,f.state.mirrors);assert.deepEqual(refused.state.stones,f.state.stones);
});

test('a Wizard exchanges partners across water while preserving the number on each island',()=>{
  const f=fixture({Z:[3,4],T:[8,4],water:[[4,4],[5,4],[6,4],[7,4]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(8,4));assert.deepEqual(hero(d.state,'thief').at,f.at(3,4));assert.equal(d.state.dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);
});

test('a lateral press moves the Wizard without casting toward a visible crate',()=>{
  const f=fixture({Z:[4,5],stones:[[7,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(5,5));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});

test('Space reflects the nearer actor even when the farther arrival is blocked',()=>{
  const f=fixture({T:[6,3],Z:[2,8],stones:[[9,4]],mirrors:[[6,4,'NE'],[6,1,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,false);assert.equal(d.blockedMirrorIndices,undefined);assert.deepEqual(hero(d.state,'thief').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});

test('equal distances on the two mirror arms exchange both actors',()=>{
  const f=fixture({T:[6,2],stones:[[9,5]],mirrors:[[6,5,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(9,5));assert.deepEqual(d.state.stones,[f.at(6,2)]);assert.equal(d.phases[0].moves.length,2);
});

test('a crate reflected into water creates an appui and a later hero may stand on it',()=>{
  const f=fixture({T:[7,6],Z:[2,8],stones:[[6,4]],water:[[8,6]],mirrors:[[6,6,'NE']]});
  // The Thief at distance1 would take priority; place him outside the beam first.
  const away=stepWorld(f.world,f.state,2),drop=stepDetailed(f.world,away,5);
  assert.equal(drop.state.failed,false);assert.deepEqual(drop.state.supports,[f.at(8,6)]);assert.equal(drop.state.stones.length,0);
  const up=stepWorld(f.world,drop.state,1),over=stepWorld(f.world,up,4);assert.equal(over.dead,false);assert.deepEqual(hero(over,'thief').at,f.at(8,6));
});

test('reflection into unsupported water is a real death and remains undoable',()=>{
  const f=fixture({T:[6,4],Z:[2,8],water:[[8,6]],mirrors:[[6,6,'NE']]}),session=new DuoPuzzleSession([f.spec]),before=session.observe(),o=session.action(5);
  assert.equal(o.state,'GAME_OVER');assert.deepEqual(session.undo(),before);
});

test('mirror refusal blinks only the blocking black back and consumes no Undo',()=>{
  const f=fixture({T:[5,3],mirrors:[[5,5,'NE'],[6,5,'SE'],[11,1,'NE']]}),session=new DuoPuzzleSession([f.spec]),initial=session.observe(),view=session.action(5),pixel=cellToPixel(f.at(6,5));
  assert.deepEqual(view.frameDurationsMs,[110,70,110,0]);assert.deepEqual(view.frames.map(frame=>frame[pixel.y][pixel.x]),[8,5,8,5]);assert.deepEqual(view.frames.map(frame=>frame[pixel.y+1][pixel.x+1]),[0,0,0,0]);
  const diff=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(view.frames[0][y][x]!==initial.frame[y][x])diff.push([x,y]);
  assert.deepEqual(diff,[[pixel.x,pixel.y],[pixel.x+1,pixel.y],[pixel.x,pixel.y+1]]);assert.deepEqual(view.frame,initial.frame);assert.equal(view.canUndo,false);assert.deepEqual(session.action(5),view);
});

test('a returning Wizard ray lights four mirrors, blinks twice and changes no positions',()=>{
  const f=fixture({Z:[4,4],T:[2,8],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),before=wizard(f),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
  assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(positions(d.state),positions(before));
  assert.equal(trace.loopPath.filter(p=>f.state.mirrors.some(m=>m.at.x===p.x&&m.at.y===p.y)).length,4);assert.equal(frames.length,9);
  const p=cellToPixel(hero(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][p.y+1][p.x+1]),[0,15,0,15]);
  const session=new DuoPuzzleSession([f.spec]);session.nextHero();const selected=session.observe(),first=session.action(1);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});

test('swapping a monster beside another resolves both attacks with a safe Wizard',()=>{
  const f=fixture({Z:[3,6],monsters:[[8,6],[3,5]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(8,6));assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});

test('monsters attack orthogonally, including a monster that dies in the same wave',()=>{
  const f=fixture({monsters:[[3,2],[4,2]]}),d=stepDetailed(f.world,wizard(f),4);
  assert.equal(d.state.monsters.length,0);assert.equal(hero(d.state,'thief').dead,true);assert.equal(d.state.dead,true);assert.equal(d.phases.at(-1).kind,'combat');
  const diagonal=fixture({monsters:[[4,3]]}),safe=stepWorld(diagonal.world,diagonal.state,4);assert.equal(safe.dead,false);
});

test('a living monster can hold a command button without attacking from two cells away',()=>{
  const f=fixture({Z:[3,6],monsters:[[8,6]],circuits:[{id:'a',buttons:[{x:3,y:6}]}],gates:[{at:{x:10,y:4},circuit:'a',direction:'E',closedWhen:'released'}]}),d=stepDetailed(f.world,wizard(f),4);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,1);assert.equal(circuitPressed(f.world,d.state,'a'),true);assert.equal(d.state.gateClosed[0],false);
});

test('Undo restores traction and a reciprocal hero exchange with their public animations',()=>{
  const f=fixture({T:[4,2],Z:[3,2],stones:[[2,2]]}),session=new DuoPuzzleSession([f.spec]),initial=session.observe();
  const pull=session.action(4);assert.equal(pull.frames.length,3);assert.deepEqual(session.undo(),initial);
  session.nextHero();const selected=session.observe(),swap=session.action(4);assert.equal(swap.frames.length,3);assert.deepEqual(session.undo(),selected);
});

test('both destinations are required, heroes stay usable there, and level completion is undoable',()=>{
  const first={id:'a',title:'Deux destinations',rows:['######','#TgZg#','######']},second={...first,id:'b'};
  const s=new DuoPuzzleSession([first,second]);s.action(4);assert.equal(s.observe().levelsCompleted,0);s.nextHero();s.nextHero();assert.equal(s.observe().level,1);
  s.nextHero();const before=s.observe(),completed=s.action(4);assert.equal(completed.levelsCompleted,1);assert.equal(completed.level,2);assert.deepEqual(s.undo(),before);
  s.action(4);s.action(4);s.nextHero();const won=s.action(4);assert.equal(won.state,'WIN');assert.equal(won.levelsCompleted,2);
  assert.equal(s.restart().level,1);assert.equal(s.observe().levelsCompleted,0);assert.equal(s.observe().canUndo,false);
});

test('all public frames are exact palette-indexed 64×64 images with valid durations',()=>{
  const f=fixture({T:[4,4],mirrors:[[3,4,'NE']]}),s=new DuoPuzzleSession([f.spec]),views=[s.observe(),s.action(4),s.nextHero(),s.action(1),s.undo()];
  for(const o of views){for(const frame of o.frames){assert.equal(frame.length,64);assert.ok(frame.every(row=>row.length===64&&row.every(n=>Number.isInteger(n)&&n>=0&&n<16)));}if(o.frameDurationsMs){assert.equal(o.frameDurationsMs.length,o.frames.length);assert.equal(o.frameDurationsMs.at(-1),0);assert.ok(o.frameDurationsMs.every(n=>Number.isFinite(n)&&n>=0));}}
});
