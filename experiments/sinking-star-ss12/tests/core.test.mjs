import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,
  DuoPuzzleSession,planReflection,inSongRange,cellToPixel,GRID,PALETTE} from '../dist/core.js';

function fixture(o={}) {
  const width=14,height=10;
  const rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=([x,y],c)=>{rows[y][x]=c;};
  for(const [key,tile] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[key]??[])put(p,tile);
  put(o.W??[2,2],'W');put(o.B??[2,6],'B');
  for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:'fixture',title:'Warrior–Bard fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',
    mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),
    circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});
  return {spec,world,state,at};
}
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(f,s,index)=>stepWorld(f.world,s,6,cellToPixel(s.heroes[index].at));
const bardState=f=>select(f,f.state,1);

test('compiler enforces the Warrior/Bard duo, 3px cells and the public palette',()=>{
  const f=fixture(),o=new DuoPuzzleSession([f.spec]).observe();
  assert.deepEqual(f.state.heroes.map(h=>h.kind),['warrior','bard']);
  assert.equal(GRID.cellPx,3);assert.equal(GRID.canvasPx,64);assert.equal(PALETTE.length,16);
  assert.equal(o.gameCode,'SS12');assert.ok(o.frame.flat().includes(8));assert.ok(o.frame.flat().includes(6));
  assert.ok(o.frame.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16)));
  assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replace('B','W'))}),/one Warrior, one Bard/);
  assert.throws(()=>compileLevel({...f.spec,rows:['MBgg']}),/Unknown tile/);
});

test('the Warrior pushes an entire mixed file in three advancement frames',()=>{
  const f=fixture({W:[2,4],B:[5,4],stones:[[3,4]],mirrors:[[4,4,'NE']]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['push']);
  assert.equal(d.phases[0].moves.length,4);
  assert.deepEqual(hero(d.state,'warrior').at,f.at(3,4));assert.deepEqual(hero(d.state,'bard').at,f.at(6,4));
  assert.deepEqual(d.state.stones,[f.at(4,4)]);assert.deepEqual(d.state.mirrors,[{at:f.at(5,4),facing:'NE'}]);
  const frames=transitionFrames(f.world,f.state,d.state,4);
  assert.equal(frames.length,3);assert.notDeepEqual(frames[0],frames[1]);assert.deepEqual(frames[2],renderWorld(f.world,d.state));
});

test('a wall or unsafe companion landing refuses the complete Warrior file',()=>{
  for(const extra of [{walls:[[6,4]]},{water:[[6,4]]}]){
    const f=fixture({W:[2,4],B:[5,4],stones:[[3,4],[4,4]],...extra}),d=stepDetailed(f.world,f.state,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);
    assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.heroes.map(h=>h.at),f.state.heroes.map(h=>h.at));
  }
});

test('a pushed Bard never casts a second song, even with cargo inside its aura',()=>{
  const f=fixture({W:[2,4],B:[4,4],stones:[[3,4],[5,3]],supports:[[6,2]],water:[[7,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'bard').at,f.at(5,4));
  assert.deepEqual(d.state.stones,[f.at(5,3),f.at(4,4)]);assert.deepEqual(d.state.supports,f.state.supports);
  assert.deepEqual(d.phases.map(p=>p.kind),['push']);
});

test('the song carries the Warrior and nearby cargo simultaneously across a wall',()=>{
  const f=fixture({W:[7,4],B:[6,4],stones:[[6,2]],walls:[[6,3]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
  assert.deepEqual(hero(d.state,'warrior').at,f.at(8,4));assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  assert.deepEqual(d.state.stones,[f.at(7,2)]);assert.equal(d.state.active,1);
  assert.equal(inSongRange({x:0,y:0},{x:2,y:2}),true);assert.equal(inSongRange({x:0,y:0},{x:3,y:0}),false);
});

test('a sung Warrior does not push cargo beyond the aura',()=>{
  const f=fixture({W:[6,4],B:[4,4],stones:[[7,4],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'warrior').at,f.at(6,4));
  assert.deepEqual(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,f.state.stones);
});

test('blocked choir members stay while free members move, but a blocked Bard cannot sing',()=>{
  const f=fixture({W:[2,8],B:[6,4],stones:[[6,2],[5,3]],walls:[[7,2]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(6,2),f.at(6,3)]);
  const blocked=fixture({W:[2,8],B:[6,4],stones:[[6,2]],walls:[[7,4]]}),b=stepDetailed(blocked.world,bardState(blocked),4);
  assert.equal(b.state.failed,true);assert.deepEqual(b.phases,[]);assert.deepEqual(b.state.stones,blocked.state.stones);
});

test('mirrors never follow a song and the Bard cannot push one',()=>{
  const f=fixture({W:[2,8],B:[6,4],mirrors:[[7,4,'NE']],stones:[[6,2]]}),before=bardState(f);
  const refused=stepDetailed(f.world,before,4);assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.stones,f.state.stones);
  const free=stepDetailed(f.world,before,1);assert.equal(free.state.failed,false);assert.deepEqual(free.state.mirrors,f.state.mirrors);
});

test('crates pushed into water become supports and both heroes require supported landings',()=>{
  const f=fixture({stones:[[3,2],[4,2]],water:[[5,2]]});
  let s=stepWorld(f.world,f.state,4);assert.equal(s.failed,false);assert.deepEqual(s.supports,[f.at(5,2)]);assert.deepEqual(s.stones,[f.at(4,2)]);
  s=stepWorld(f.world,s,4);assert.deepEqual(s.supports,[f.at(5,2)]);assert.deepEqual(s.stones,[f.at(5,2)]);
  for(const kind of ['warrior','bard']){
    const q=fixture({W:[2,2],B:[6,4],water:kind==='warrior'?[[3,2]]:[[7,4]]}),d=stepDetailed(q.world,kind==='bard'?bardState(q):q.state,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);
  }
});

test('the song slides free supports on water and anchors occupied or destination supports',()=>{
  const f=fixture({W:[2,8],B:[6,4],supports:[[6,2],[7,2],[7,4]],water:[[8,2],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(7,2),f.at(8,2),f.at(7,4)]);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  const dry=fixture({W:[2,8],B:[6,4],supports:[[6,2]]}),stay=stepWorld(dry.world,bardState(dry),4);
  assert.deepEqual(stay.supports,dry.state.supports);
});

test('an occupied support protects the Warrior instead of following his sung move',()=>{
  const f=fixture({W:[2,8],B:[5,4],supports:[[6,3],[7,3]]});
  const s={...bardState(f),heroes:f.state.heroes.map(h=>h.kind==='warrior'?{...h,at:f.at(6,3)}:h)},d=stepDetailed(f.world,s,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'warrior').at,f.at(7,3));
  assert.ok(d.state.supports.some(p=>p.x===f.at(6,3).x&&p.y===f.at(6,3).y));
});

test('a song refuses an unsupported companion landing even on an inactive hydraulic cell',()=>{
  for(const hydraulic of [false,true]){
    const f=fixture({W:[6,3],B:[5,4],water:[[7,3]],stones:[[4,2]],
      ...(hydraulic?{circuits:[{id:'bridge',buttons:[{x:2,y:2}]}],platforms:[{at:{x:7,y:3},circuit:'bridge',activeWhen:'pressed'}]}:{})});
    const before=bardState(f),d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);
    assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));
    assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.supports,before.supports);
  }
});

test('a song cannot slide a mirror support away over an inactive hydraulic platform',()=>{
  const f=fixture({W:[6,3],B:[8,5],mirrors:[[7,3,'NE']],supports:[[8,3]],water:[[9,3]],
    circuits:[{id:'bridge',buttons:[{x:2,y:2}]}],platforms:[{at:{x:8,y:3},circuit:'bridge',activeWhen:'pressed'}]});
  const pushed=stepWorld(f.world,f.state,4),before=select(f,pushed,1),d=stepDetailed(f.world,before,4);
  assert.equal(pushed.failed,false);assert.deepEqual(pushed.mirrors[0].at,f.at(8,3));
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);
  assert.deepEqual(d.state.mirrors,before.mirrors);assert.deepEqual(d.state.supports,before.supports);
});

test('leaving a button can still withdraw an active platform beneath the distant partner',()=>{
  const f=fixture({W:[10,2],B:[3,4],water:[[10,3]],
    circuits:[{id:'bridge',buttons:[{x:3,y:4}]}],platforms:[{at:{x:10,y:3},circuit:'bridge',activeWhen:'pressed'}]});
  const entered=stepWorld(f.world,f.state,2),before=select(f,entered,1),d=stepDetailed(f.world,before,4);
  assert.equal(entered.failed,false);assert.deepEqual(before.platformActive,[true]);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.platformActive,[false]);
  assert.equal(d.state.dead,true);assert.equal(hero(d.state,'warrior').dead,true);
  assert.ok(d.phases.some(p=>p.kind==='platform'));
});

test('a song can bring monsters into simultaneous combat without unsafe contact',()=>{
  const f=fixture({W:[2,2],B:[4,6],monsters:[[5,4],[7,4]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,0);
  assert.deepEqual(d.phases.map(p=>p.kind),['song','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});

test('a lethal monster still attacks in the same simultaneous combat wave',()=>{
  const f=fixture({W:[8,4],B:[4,6],monsters:[[5,4],[7,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.equal(hero(d.state,'warrior').dead,true);
});

test('reflection chooses the nearer actor before testing the farther blocked arrival',()=>{
  const f=fixture({W:[6,3],B:[2,8],stones:[[9,4]],walls:[[6,1]],mirrors:[[6,4,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(planReflection(f.world,f.state).moves,[{actor:'hero',from:f.at(6,3),to:f.at(7,4)}]);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'warrior').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);
});

test('mirror-reflected Bard and Warrior do not trigger a song or a push',()=>{
  const f=fixture({W:[7,5],B:[5,3],mirrors:[[5,5,'NE']],stones:[[4,3]],supports:[[3,3]]}),d=stepDetailed(f.world,bardState(f),5);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,5));assert.deepEqual(hero(d.state,'warrior').at,f.at(5,3));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);
});

test('a blocking mirror flashes only its black backing red',()=>{
  const f=fixture({W:[6,2],B:[2,8],mirrors:[[6,4,'NE'],[8,4,'SE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(d.blockedMirrorIndices,[1]);assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);
  const session=new DuoPuzzleSession([f.spec]),o=session.action(5),p=cellToPixel(f.at(8,4));
  assert.equal(o.frames.length,4);assert.equal(o.canUndo,false);
  // SE mirror's northwest backing is black, the northeast diagonal is white.
  assert.equal(o.frames[0][p.y][p.x],8);assert.equal(o.frames[1][p.y][p.x],5);
  assert.equal(o.frames[0][p.y][p.x+2],0);assert.equal(o.frames[2][p.y][p.x+2],0);
});

test('reflection previews use a gray plus for heroes and a gray outline for crates',()=>{
  for(const actor of ['hero','stone']){
    const f=fixture({W:actor==='hero'?[5,3]:[2,2],B:[2,8],stones:actor==='stone'?[[5,3]]:[],mirrors:[[5,5,'NE']]}),p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);
    const tile=frame.slice(p.y,p.y+3).map(r=>r.slice(p.x,p.x+3));
    assert.deepEqual(tile,actor==='hero'?[[3,1,3],[1,1,1],[3,1,3]]:[[1,1,1],[1,3,1],[1,1,1]]);
  }
});

test('the dotted magenta aura follows the Bard during its three movement frames',()=>{
  const f=fixture({W:[2,8],B:[6,4]}),before=bardState(f),d=stepDetailed(f.world,before,4),frames=transitionFrames(f.world,before,d.state,4),p=cellToPixel(f.at(6,4));
  assert.equal(frames.length,3);
  for(let i=0;i<3;i++){assert.equal(frames[i][p.y-6][p.x-6+i+1],6);assert.notEqual(frames[i][p.y-6][p.x-6],6);}
  assert.deepEqual(frames[2],renderWorld(f.world,d.state));
});

test('a press can move the Bard without triggering nearby cargo',()=>{
  const f=fixture({B:[7,5],stones:[[7,4]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'bard').at,f.at(8,5));assert.deepEqual(d.state.stones,f.state.stones);
  assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});

test('Undo restores an entire Warrior push, pressure cascade and immersed cargo',()=>{
  const f=fixture({stones:[[3,2],[7,5]],water:[[8,5]],circuits:[{id:'press',buttons:[{x:4,y:2}]}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(d.phases.map(p=>p.kind),['push','piston']);assert.deepEqual(d.state.supports,[f.at(8,5)]);
  const session=new DuoPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
  assert.equal(after.frames.length,6);assert.notDeepEqual(after.frame,before.frame);assert.deepEqual(session.undo(),before);
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
