import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,
  DuoPuzzleSession,planReflection,planSwap,traceSwap,circuitPressed,inSongRange,cellToPixel,GRID,PALETTE} from '../dist/core.js';

function fixture(o={}) {
  const width=14,height=10;
  const rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=([x,y],c)=>{rows[y][x]=c;};
  for(const [key,tile] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[key]??[])put(p,tile);
  put(o.Z??[2,2],'Z');put(o.B??[2,6],'B');
  for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:'fixture',title:'Wizard–Bard fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',
    mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),
    circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});
  return {spec,world,state,at};
}
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(f,s,index)=>stepWorld(f.world,s,6,cellToPixel(s.heroes[index].at));
const bardState=f=>select(f,f.state,1);
const positions=s=>({heroes:s.heroes.map(h=>h.at),stones:s.stones,monsters:s.monsters,mirrors:s.mirrors,supports:s.supports});


const wizardFixture=o=>fixture({Z:[2,6],B:[2,2],...o});
const wizard=(f,s=f.state)=>select(f,s,0);
test('both voluntary abilities reject an unsupported hydraulic landing',()=>{
  for(const kind of ['wizard','bard']){
    const y=kind==='wizard'?2:6;
    const f=fixture({water:[[3,y]],circuits:[{id:'a',buttons:[{x:8,y:8}]}],platforms:[{at:{x:3,y},circuit:'a',activeWhen:'pressed'}]}),before=kind==='bard'?bardState(f):f.state,d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(before));assert.deepEqual(d.phases,[]);
  }
});


test('a sung crate becomes a support which can be reused by another mobile crate',()=>{
  const f=fixture({Z:[2,8],B:[6,5],stones:[[6,3],[7,3]],water:[[8,3]]}),first=stepDetailed(f.world,bardState(f),4);
  assert.equal(first.state.failed,false);assert.deepEqual(first.state.supports,[f.at(8,3)]);assert.deepEqual(first.state.stones,[f.at(7,3)]);
  const second=stepDetailed(f.world,first.state,4);
  assert.equal(second.state.failed,false);assert.deepEqual(second.state.supports,[f.at(8,3)]);assert.deepEqual(second.state.stones,[f.at(8,3)]);
});


test('the song carries the Wizard and nearby cargo simultaneously across a wall',()=>{
  const f=fixture({Z:[7,4],B:[6,4],stones:[[6,2]],walls:[[6,3]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(8,4));assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  assert.deepEqual(d.state.stones,[f.at(7,2)]);assert.equal(d.state.active,1);
  assert.equal(inSongRange({x:0,y:0},{x:2,y:2}),true);assert.equal(inSongRange({x:0,y:0},{x:3,y:0}),false);
});


test('a sung Wizard does not push cargo beyond the aura',()=>{
  const f=fixture({Z:[6,4],B:[4,4],stones:[[7,4],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(6,4));
  assert.deepEqual(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,f.state.stones);
});


test('blocked choir members stay while free members move, but a blocked Bard cannot sing',()=>{
  const f=fixture({Z:[2,8],B:[6,4],stones:[[6,2],[5,3]],walls:[[7,2]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(6,2),f.at(6,3)]);
  const blocked=fixture({Z:[2,8],B:[6,4],stones:[[6,2]],walls:[[7,4]]}),b=stepDetailed(blocked.world,bardState(blocked),4);
  assert.equal(b.state.failed,true);assert.deepEqual(b.phases,[]);assert.deepEqual(b.state.stones,blocked.state.stones);
});


test('mirrors never follow a song and the Bard cannot push one',()=>{
  const f=fixture({Z:[2,8],B:[6,4],mirrors:[[7,4,'NE']],stones:[[6,2]]}),before=bardState(f);
  const refused=stepDetailed(f.world,before,4);assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.stones,f.state.stones);
  const free=stepDetailed(f.world,before,1);assert.equal(free.state.failed,false);assert.deepEqual(free.state.mirrors,f.state.mirrors);
});


test('the song slides free supports on water and anchors occupied or destination supports',()=>{
  const f=fixture({Z:[2,8],B:[6,4],supports:[[6,2],[7,2],[7,4]],water:[[8,2],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(7,2),f.at(8,2),f.at(7,4)]);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  const dry=fixture({Z:[2,8],B:[6,4],supports:[[6,2]]}),stay=stepWorld(dry.world,bardState(dry),4);
  assert.deepEqual(stay.supports,dry.state.supports);
});


test('an occupied support protects the Wizard instead of following his sung move',()=>{
  const f=fixture({Z:[2,8],B:[5,4],supports:[[6,3],[7,3]]});
  const s={...bardState(f),heroes:f.state.heroes.map(h=>h.kind==='wizard'?{...h,at:f.at(6,3)}:h)},d=stepDetailed(f.world,s,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(7,3));
  assert.ok(d.state.supports.some(p=>p.x===f.at(6,3).x&&p.y===f.at(6,3).y));
});


test('a song refuses an unsupported companion landing even on an inactive hydraulic cell',()=>{
  for(const hydraulic of [false,true]){
    const f=fixture({Z:[6,3],B:[5,4],water:[[7,3]],stones:[[4,2]],
      ...(hydraulic?{circuits:[{id:'bridge',buttons:[{x:2,y:2}]}],platforms:[{at:{x:7,y:3},circuit:'bridge',activeWhen:'pressed'}]}:{})});
    const before=bardState(f),d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);
    assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));
    assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.supports,before.supports);
  }
});


test('leaving a button can still withdraw an active platform beneath the distant partner',()=>{
  const f=fixture({Z:[10,2],B:[3,4],water:[[10,3]],
    circuits:[{id:'bridge',buttons:[{x:3,y:4}]}],platforms:[{at:{x:10,y:3},circuit:'bridge',activeWhen:'pressed'}]});
  const entered=stepWorld(f.world,f.state,2),before=select(f,entered,1),d=stepDetailed(f.world,before,4);
  assert.equal(entered.failed,false);assert.deepEqual(before.platformActive,[true]);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.platformActive,[false]);
  assert.equal(d.state.dead,true);assert.equal(hero(d.state,'wizard').dead,true);
  assert.ok(d.phases.some(p=>p.kind==='platform'));
});


test('a song can bring monsters into simultaneous combat without unsafe contact',()=>{
  const f=fixture({Z:[2,2],B:[4,6],monsters:[[5,4],[7,4]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,0);
  assert.deepEqual(d.phases.map(p=>p.kind),['song','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});


test('a lethal monster still attacks in the same simultaneous combat wave',()=>{
  const f=fixture({Z:[8,4],B:[4,6],monsters:[[5,4],[7,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.equal(hero(d.state,'wizard').dead,true);
});


test('reflection chooses the nearer actor before testing the farther blocked arrival',()=>{
  const f=fixture({Z:[6,3],B:[2,8],stones:[[9,4]],walls:[[6,1]],mirrors:[[6,4,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(planReflection(f.world,f.state).moves,[{actor:'hero',from:f.at(6,3),to:f.at(7,4)}]);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);
});


test('mirror-reflected Bard and Wizard do not trigger a song or a spell',()=>{
  const f=fixture({Z:[7,5],B:[5,3],mirrors:[[5,5,'NE']],stones:[[4,3]],supports:[[3,3]]}),d=stepDetailed(f.world,bardState(f),5);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,5));assert.deepEqual(hero(d.state,'wizard').at,f.at(5,3));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);
});


test('a blocking mirror flashes only its black backing red',()=>{
  const f=fixture({Z:[6,2],B:[2,8],mirrors:[[6,4,'NE'],[8,4,'SE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(d.blockedMirrorIndices,[1]);assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);
  const session=new DuoPuzzleSession([f.spec]),o=session.action(5),p=cellToPixel(f.at(8,4));
  assert.equal(o.frames.length,4);assert.equal(o.canUndo,false);
  // SE mirror's northwest backing is black, the northeast diagonal is white.
  assert.equal(o.frames[0][p.y][p.x],8);assert.equal(o.frames[1][p.y][p.x],5);
  assert.equal(o.frames[0][p.y][p.x+2],0);assert.equal(o.frames[2][p.y][p.x+2],0);
});


test('reflection previews use a gray plus for heroes and a gray outline for crates',()=>{
  for(const actor of ['hero','stone']){
    const f=fixture({Z:actor==='hero'?[5,3]:[2,2],B:[2,8],stones:actor==='stone'?[[5,3]]:[],mirrors:[[5,5,'NE']]}),p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);
    const tile=frame.slice(p.y,p.y+3).map(r=>r.slice(p.x,p.x+3));
    assert.deepEqual(tile,actor==='hero'?[[3,1,3],[1,1,1],[3,1,3]]:[[1,1,1],[1,3,1],[1,1,1]]);
  }
});


test('the dotted magenta aura follows the Bard during its three movement frames',()=>{
  const f=fixture({Z:[2,8],B:[6,4]}),before=bardState(f),d=stepDetailed(f.world,before,4),frames=transitionFrames(f.world,before,d.state,4),p=cellToPixel(f.at(6,4));
  assert.equal(frames.length,3);
  for(let i=0;i<3;i++){assert.equal(frames[i][p.y-6][p.x-6+i+1],6);assert.notEqual(frames[i][p.y-6][p.x-6],6);}
  assert.deepEqual(frames[2],renderWorld(f.world,d.state));
});


test('a press can move the Bard without triggering nearby cargo',()=>{
  const f=fixture({B:[7,5],stones:[[7,4]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'bard').at,f.at(8,5));assert.deepEqual(d.state.stones,f.state.stones);
  assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});


test('hydraulic platforms settle before resolving a press landing into water',()=>{
  const f=fixture({B:[7,5],water:[[8,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:8,y:5},circuit:'a',activeWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.dead,false);assert.equal(d.state.failed,false);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(hero(d.state,'bard').at,f.at(8,5));
  assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','platform']);
});


test('selection is a public pixel action without a combat tick; malformed actions are atomic',()=>{
  const f=fixture({monsters:[[3,2]]}),session=new DuoPuzzleSession([f.spec]),before=session.observe();
  const next=session.action(6,cellToPixel(f.state.heroes[1].at));assert.equal(next.state,'NOT_FINISHED');assert.equal(next.frames.length,1);
  assert.deepEqual(session.undo(),before);
  for(const action of [0,7,1.5])assert.throws(()=>session.action(action));
  for(const p of [undefined,{x:-1,y:3},{x:64,y:4},{x:2.2,y:4}])assert.throws(()=>session.action(6,p));
  assert.deepEqual(session.observe(),before);assert.throws(()=>session.selectLevel(0));assert.deepEqual(session.observe(),before);
});

test('Wizard exchanges the first aligned target and walks when no target exists',()=>{
  const f=wizardFixture({Z:[3,6],stones:[[5,6],[8,6]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.phases[0].kind,'swap');assert.deepEqual(hero(d.state,'wizard').at,f.at(5,6));assert.deepEqual(d.state.stones,[f.at(3,6),f.at(8,6)]);
  const walking=stepDetailed(f.world,d.state,1);assert.equal(walking.phases[0].kind,'walk');assert.deepEqual(hero(walking.state,'wizard').at,f.at(5,5));
});


test('a Wizard ray crosses water and bends at two white mirror faces',()=>{
  const f=wizardFixture({Z:[3,3],B:[2,8],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=wizard(f),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
  assert.equal(plan.reflections,2);assert.deepEqual(plan.to,f.at(5,1));assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(5,1));assert.deepEqual(d.state.stones,[f.at(3,3)]);assert.equal(transitionFrames(f.world,before,d.state,4).length,3);
});


test('a black mirror back stops the ray and the Wizard cannot push or swap the mirror',()=>{
  const f=wizardFixture({Z:[3,6],stones:[[8,6]],mirrors:[[5,6,'NE']]}),before=wizard(f);assert.equal(planSwap(f.world,before,'E'),null);
  const walk=stepWorld(f.world,before,4),refused=stepDetailed(f.world,walk,4);
  assert.deepEqual(hero(walk,'wizard').at,f.at(4,6));assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.mirrors,f.state.mirrors);assert.deepEqual(refused.state.stones,f.state.stones);
});


test('a Wizard exchanges partners across water while preserving the number on each island',()=>{
  const f=wizardFixture({Z:[3,4],B:[8,4],water:[[4,4],[5,4],[6,4],[7,4]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(8,4));assert.deepEqual(hero(d.state,'bard').at,f.at(3,4));assert.equal(d.state.dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);
});


test('a returning Wizard ray lights four mirrors, blinks twice and changes no positions',()=>{
  const f=wizardFixture({Z:[4,4],B:[2,8],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),before=wizard(f),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
  assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(positions(d.state),positions(before));
  assert.equal(trace.loopPath.filter(p=>f.state.mirrors.some(m=>m.at.x===p.x&&m.at.y===p.y)).length,4);assert.equal(frames.length,9);
  const p=cellToPixel(hero(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][p.y+1][p.x+1]),[0,15,0,15]);
  const session=new DuoPuzzleSession([f.spec]);const selected=session.observe(),first=session.action(1);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});


test('swapping a monster beside another resolves both attacks with a safe Wizard',()=>{
  const f=wizardFixture({Z:[3,6],monsters:[[8,6],[3,5]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(8,6));assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});


test('a living monster can hold a command button without attacking from two cells away',()=>{
  const f=wizardFixture({Z:[3,6],monsters:[[8,6]],circuits:[{id:'a',buttons:[{x:3,y:6}]}],gates:[{at:{x:10,y:4},circuit:'a',direction:'E',closedWhen:'released'}]}),d=stepDetailed(f.world,wizard(f),4);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,1);assert.equal(circuitPressed(f.world,d.state,'a'),true);assert.equal(d.state.gateClosed[0],false);
});


test('all public frames are exact palette-indexed 64×64 images with valid durations',()=>{
  const f=wizardFixture({B:[4,4],mirrors:[[3,4,'NE']]}),s=new DuoPuzzleSession([f.spec]),views=[s.observe(),s.action(4),s.nextHero(),s.action(1),s.undo()];
  for(const o of views){for(const frame of o.frames){assert.equal(frame.length,64);assert.ok(frame.every(row=>row.length===64&&row.every(n=>Number.isInteger(n)&&n>=0&&n<16)));}if(o.frameDurationsMs){assert.equal(o.frameDurationsMs.length,o.frames.length);assert.equal(o.frameDurationsMs.at(-1),0);assert.ok(o.frameDurationsMs.every(n=>Number.isFinite(n)&&n>=0));}}
});

test('SS15 compiles Wizard then Bard, exposes colors15/6, and rejects a wrong duo',()=>{
  const f=fixture(),o=new DuoPuzzleSession([f.spec]).observe();
  assert.deepEqual(f.world.heroes.map(h=>h.kind),['wizard','bard']);assert.equal(f.state.active,0);assert.equal(o.gameCode,'SS15');assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);
  for(const [kind,color] of [['wizard',15],['bard',6]]){const p=cellToPixel(hero(f.state,kind).at);assert.equal(o.frame[p.y+1][p.x+1],color);}
  for(const rows of [['Zgg'],['Bgg'],['ZZgg'],['BBgg'],['ZBg'],['ZBggg'],['TBgg']])assert.throws(()=>compileLevel({...f.spec,rows}));
  for(const key of ['heroes','stones','mirrors','world','paths','phases','loopPath','commands','solution','witness'])assert.equal(key in o,false);
});

test('transposing the Bard releases nearby cargo and free supports without a song',()=>{
  const f=fixture({Z:[2,4],B:[8,4],stones:[[7,3]],supports:[[7,2]],water:[[8,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(8,4));assert.deepEqual(hero(d.state,'bard').at,f.at(2,4));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);
});

test('the sung Wizard does not cast at a distant visible crate',()=>{
  const f=fixture({Z:[6,4],B:[5,5],stones:[[11,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);
  const selected=select(f,d.state,0),cast=stepDetailed(f.world,selected,4);
  assert.deepEqual(cast.phases.map(p=>p.kind),['swap']);assert.deepEqual(hero(cast.state,'wizard').at,f.at(11,4));
});

test('a press moves the Wizard without casting and keeps the nearby Bard silent',()=>{
  const f=fixture({Z:[7,5],B:[2,2],stones:[[11,5],[10,3]],circuits:[{id:'press',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(8,5));assert.deepEqual(d.state.stones,f.state.stones);
});

test('reciprocal substitution preserves both command weights without a hydraulic pulse',()=>{
  const f=fixture({Z:[2,4],B:[8,4],circuits:[{id:'both',buttons:[{x:2,y:4},{x:8,y:4}],color:10}],platforms:[{at:{x:5,y:2},circuit:'both',activeWhen:'pressed'}],water:[[5,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(circuitPressed(f.world,d.state,'both'),true);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);
  const session=new DuoPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
  assert.deepEqual(after.frameDurationsMs,[70,90,0]);assert.deepEqual(session.undo(),before);
});

test('neither an immersed support nor a mirror is a substitution target',()=>{
  const f=fixture({Z:[3,4],B:[2,8],supports:[[5,4]],mirrors:[[7,4,'NE']]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(planSwap(f.world,f.state,'E'),null);assert.deepEqual(d.phases.map(p=>p.kind),['walk']);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.state.mirrors,f.state.mirrors);
});

test('a song cannot remove an unanchored submerged support underneath a mirror',()=>{
  const f=fixture({Z:[2,8],B:[7,5],mirrors:[[4,3,'NE']],supports:[[7,3],[8,3]],water:[[9,3]]});
  // Valid state after a prior press delivered the mirror onto the first support.
  const before={...bardState(f),mirrors:[{at:f.at(7,3),facing:'NE'}]},d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);assert.deepEqual(positions(d.state),positions(before));
});

test('a lateral press can reposition a mirror which neither hero can move voluntarily',()=>{
  const f=fixture({Z:[2,2],B:[2,8],mirrors:[[7,5,'NW']],circuits:[{id:'press',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.mirrors,[{at:f.at(8,5),facing:'NW'}]);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
  const session=new DuoPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
  assert.equal(after.frames.length,6);assert.deepEqual(session.undo(),before);
});

test('device glyphs expose a clean plate or an opaque press with the right center',()=>{
  const f=fixture({Z:[2,2],B:[2,8],circuits:[{id:'press',buttons:[{x:3,y:2}],color:9},{id:'plate',buttons:[{x:7,y:5}],color:15}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),p=cellToPixel(f.at(7,5));
  const tile=s=>{const frame=renderWorld(f.world,s);return frame.slice(p.y,p.y+3).map(row=>row.slice(p.x,p.x+3));};
  assert.deepEqual(tile(f.state),[[3,7,3],[7,15,7],[3,7,3]]);
  const closed=stepWorld(f.world,f.state,4);assert.equal(tile(closed)[1][1],5);
  const pure=fixture({Z:[2,2],B:[2,8],circuits:[{id:'press',buttons:[{x:3,y:2}],color:15}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]});
  const frame=renderWorld(pure.world,pure.state);assert.equal(frame[p.y+1][p.x+1],3);
});

test('two simultaneous destinations govern progression, undo and final victory',()=>{
  const spec={id:'a',title:'Arrival',rows:['########','#Zg....#','#......#','#......#','#......#','#....Bg#','########']},session=new DuoPuzzleSession([spec,{...spec,id:'b'}]);
  session.action(4);assert.equal(session.observe().levelsCompleted,0);
  session.nextHero();const before=session.observe(),completed=session.action(4);
  assert.equal(completed.levelsCompleted,1);assert.equal(completed.level,2);assert.deepEqual(session.undo(),before);
  session.action(4);session.action(4);session.nextHero();const won=session.action(4);
  assert.equal(won.state,'WIN');assert.equal(won.levelsCompleted,2);assert.equal(session.undo().state,'NOT_FINISHED');assert.equal(session.action(4).state,'WIN');
  assert.equal(session.restart().level,1);assert.equal(session.observe().levelsCompleted,0);assert.equal(session.observe().canUndo,false);
});
