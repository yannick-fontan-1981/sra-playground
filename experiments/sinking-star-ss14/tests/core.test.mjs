import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,
  DuoPuzzleSession,planReflection,inSongRange,cellToPixel,GRID,PALETTE} from '../dist/core.js';

function fixture(o={}) {
  const width=14,height=10;
  const rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=([x,y],c)=>{rows[y][x]=c;};
  for(const [key,tile] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[key]??[])put(p,tile);
  put(o.T??[2,2],'T');put(o.B??[2,6],'B');
  for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:'fixture',title:'Thief–Bard fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',
    mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),
    circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});
  return {spec,world,state,at};
}
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(f,s,index)=>stepWorld(f.world,s,6,cellToPixel(s.heroes[index].at));
const bardState=f=>select(f,f.state,1);
const positions=s=>({heroes:s.heroes.map(h=>h.at),stones:s.stones,monsters:s.monsters,mirrors:s.mirrors,supports:s.supports});

test('the Thief pulls only the adjacent rear crate in three timed frames',()=>{
  const f=fixture({T:[4,2],stones:[[2,2],[3,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(5,2));
  assert.deepEqual(d.state.stones,[f.at(2,2),f.at(4,2)]);assert.deepEqual(d.phases.map(p=>p.kind),['pull']);
  assert.equal(d.phases[0].moves.length,2);
  const view=new DuoPuzzleSession([f.spec]).action(4);
  assert.equal(view.frames.length,3);assert.deepEqual(view.frameDurationsMs,[60,80,0]);assert.deepEqual(view.frames.at(-1),view.frame);
});

test('perpendicular departure releases the old cargo and no front occupant can be pushed',()=>{
  const f=fixture({T:[4,2],stones:[[3,2]]}),d=stepDetailed(f.world,f.state,1);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk']);
  for(const extra of [{stones:[[3,2]]},{mirrors:[[3,2,'NE']]},{monsters:[[3,2]]},{B:[3,2]}]){
    const q=fixture(extra),refused=stepDetailed(q.world,q.state,4);
    assert.equal(refused.state.failed,true);assert.equal(refused.state.dead,false);assert.deepEqual(positions(refused.state),positions(q.state));assert.deepEqual(refused.phases,[]);
  }
});

test('a blocked Thief refuses the whole pull without ticking adjacent monsters',()=>{
  const f=fixture({T:[4,2],stones:[[3,2]],walls:[[5,2]],monsters:[[4,1]],facing:'N'}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(f.state));assert.deepEqual(d.phases,[]);
});

test('pulling the Bard never sings nearby cargo or shifts a free support',()=>{
  const f=fixture({T:[5,4],B:[4,4],stones:[[3,3]],supports:[[3,2]],water:[[4,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'bard').at,f.at(5,4));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['pull']);
});

test('a sung Thief does not pull an adjacent mirror ignored by the song',()=>{
  const f=fixture({T:[6,4],B:[6,6],mirrors:[[5,4,'NW']]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(7,4));
  assert.deepEqual(d.state.mirrors,f.state.mirrors);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
});

test('mirror traction preserves orientation while a submerged support is not pullable',()=>{
  const f=fixture({T:[4,4],mirrors:[[3,4,'NW']]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(d.state.mirrors,[{at:f.at(4,4),facing:'NW'}]);assert.deepEqual(d.phases.map(p=>p.kind),['pull']);
  const q=fixture({T:[4,4],supports:[[3,4]]}),walk=stepDetailed(q.world,q.state,4);
  assert.equal(walk.state.failed,false);assert.deepEqual(walk.state.supports,q.state.supports);assert.deepEqual(walk.phases.map(p=>p.kind),['walk']);
});

test('a lateral press moves the Thief without pulling the rear mirror',()=>{
  const f=fixture({T:[7,5],B:[2,2],mirrors:[[6,5,'NE']],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:7,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,bardState(f),4);
  assert.deepEqual(hero(d.state,'thief').at,f.at(8,5));assert.deepEqual(d.state.mirrors,f.state.mirrors);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});

test('both voluntary abilities reject an unsupported hydraulic landing',()=>{
  for(const kind of ['thief','bard']){
    const y=kind==='thief'?2:6;
    const f=fixture({water:[[3,y]],circuits:[{id:'a',buttons:[{x:8,y:8}]}],platforms:[{at:{x:3,y},circuit:'a',activeWhen:'pressed'}]}),before=kind==='bard'?bardState(f):f.state,d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(positions(d.state),positions(before));assert.deepEqual(d.phases,[]);
  }
});

test('a sung crate becomes a support which can be reused by another mobile crate',()=>{
  const f=fixture({T:[2,8],B:[6,5],stones:[[6,3],[7,3]],water:[[8,3]]}),first=stepDetailed(f.world,bardState(f),4);
  assert.equal(first.state.failed,false);assert.deepEqual(first.state.supports,[f.at(8,3)]);assert.deepEqual(first.state.stones,[f.at(7,3)]);
  const second=stepDetailed(f.world,first.state,4);
  assert.equal(second.state.failed,false);assert.deepEqual(second.state.supports,[f.at(8,3)]);assert.deepEqual(second.state.stones,[f.at(8,3)]);
});

test('the song cannot remove the support of a previously hauled mirror',()=>{
  const f=fixture({T:[6,3],B:[7,5],mirrors:[[5,3,'NE']],supports:[[7,3],[8,3]],water:[[9,3]],
    circuits:[{id:'bridge',buttons:[{x:2,y:2}]}],platforms:[{at:{x:7,y:3},circuit:'bridge',activeWhen:'pressed'}]});
  let s=stepWorld(f.world,f.state,4);s=stepWorld(f.world,s,4);s=stepWorld(f.world,s,2);
  assert.equal(s.failed,false);assert.deepEqual(s.mirrors[0].at,f.at(7,3));
  const before=select(f,s,1),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);assert.deepEqual(positions(d.state),positions(before));
});

test('a pulled crate can lose its hydraulic platform after a valid voluntary step',()=>{
  const f=fixture({T:[3,4],stones:[[2,4]],water:[[4,4]],circuits:[{id:'a',buttons:[{x:5,y:4}]}],platforms:[{at:{x:4,y:4},circuit:'a',activeWhen:'released'}]});
  const entered=stepWorld(f.world,f.state,4),d=stepDetailed(f.world,entered,4);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.equal(d.state.stones.length,0);assert.deepEqual(d.state.supports,[f.at(4,4)]);assert.deepEqual(d.phases.map(p=>p.kind),['pull','platform']);
  const left=stepWorld(f.world,d.state,2);assert.equal(left.platformActive[0],true);assert.deepEqual(left.supports,d.state.supports);
});

test('Undo restores a complete pull, press cascade and immersed cargo',()=>{
  const f=fixture({T:[3,2],stones:[[2,2],[7,5]],water:[[8,5]],circuits:[{id:'press',buttons:[{x:4,y:2}]}],gates:[{at:{x:7,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(d.phases.map(p=>p.kind),['pull','piston']);assert.deepEqual(d.state.supports,[f.at(8,5)]);
  const session=new DuoPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
  assert.equal(after.frames.length,6);assert.notDeepEqual(after.frame,before.frame);assert.deepEqual(session.undo(),before);
});

test('both destinations are required and final victory is deterministic and undoable',()=>{
  const spec={id:'win',title:'Duo finish',rows:['########','#Tg....#','#......#','#......#','#B.g...#','########']};
  const session=new DuoPuzzleSession([spec]);
  const one=session.action(4);assert.equal(one.state,'NOT_FINISHED');session.nextHero();session.action(4);
  const before=session.observe(),won=session.action(4);assert.equal(won.state,'WIN');assert.equal(won.levelsCompleted,1);
  assert.deepEqual(session.undo(),before);assert.deepEqual(session.action(4),won);
  const restarted=session.restart();assert.equal(restarted.state,'NOT_FINISHED');assert.equal(restarted.levelsCompleted,0);assert.equal(restarted.canUndo,false);
});

test('public observations expose only images, action controls and progression',()=>{
  const f=fixture(),o=new DuoPuzzleSession([f.spec]).observe();
  assert.deepEqual(Object.keys(o).sort(),['availableActionIds','canSelectLevel','canUndo','defaultFps','frame','frames','gameCode','level','levelCount','levelsCompleted','palette','state'].sort());
  assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);assert.equal(o.defaultFps,10);
});

test('compiler enforces the Thief/Bard duo, 3px cells and the public palette',()=>{
  const f=fixture(),o=new DuoPuzzleSession([f.spec]).observe();
  assert.deepEqual(f.state.heroes.map(h=>h.kind),['thief','bard']);
  assert.equal(GRID.cellPx,3);assert.equal(GRID.canvasPx,64);assert.equal(PALETTE.length,16);
  assert.equal(o.gameCode,'SS14');assert.ok(o.frame.flat().includes(14));assert.ok(o.frame.flat().includes(6));
  assert.ok(o.frame.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16)));
  assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replace('B','T'))}),/one Thief, one Bard/);
  assert.throws(()=>compileLevel({...f.spec,rows:['MBgg']}),/Unknown tile/);
});

test('the song carries the Thief and nearby cargo simultaneously across a wall',()=>{
  const f=fixture({T:[7,4],B:[6,4],stones:[[6,2]],walls:[[6,3]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
  assert.deepEqual(hero(d.state,'thief').at,f.at(8,4));assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  assert.deepEqual(d.state.stones,[f.at(7,2)]);assert.equal(d.state.active,1);
  assert.equal(inSongRange({x:0,y:0},{x:2,y:2}),true);assert.equal(inSongRange({x:0,y:0},{x:3,y:0}),false);
});

test('a sung Thief does not push cargo beyond the aura',()=>{
  const f=fixture({T:[6,4],B:[4,4],stones:[[7,4],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(6,4));
  assert.deepEqual(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,f.state.stones);
});

test('blocked choir members stay while free members move, but a blocked Bard cannot sing',()=>{
  const f=fixture({T:[2,8],B:[6,4],stones:[[6,2],[5,3]],walls:[[7,2]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(6,2),f.at(6,3)]);
  const blocked=fixture({T:[2,8],B:[6,4],stones:[[6,2]],walls:[[7,4]]}),b=stepDetailed(blocked.world,bardState(blocked),4);
  assert.equal(b.state.failed,true);assert.deepEqual(b.phases,[]);assert.deepEqual(b.state.stones,blocked.state.stones);
});

test('mirrors never follow a song and the Bard cannot push one',()=>{
  const f=fixture({T:[2,8],B:[6,4],mirrors:[[7,4,'NE']],stones:[[6,2]]}),before=bardState(f);
  const refused=stepDetailed(f.world,before,4);assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.stones,f.state.stones);
  const free=stepDetailed(f.world,before,1);assert.equal(free.state.failed,false);assert.deepEqual(free.state.mirrors,f.state.mirrors);
});

test('the song slides free supports on water and anchors occupied or destination supports',()=>{
  const f=fixture({T:[2,8],B:[6,4],supports:[[6,2],[7,2],[7,4]],water:[[8,2],[8,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(7,2),f.at(8,2),f.at(7,4)]);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,4));
  const dry=fixture({T:[2,8],B:[6,4],supports:[[6,2]]}),stay=stepWorld(dry.world,bardState(dry),4);
  assert.deepEqual(stay.supports,dry.state.supports);
});

test('an occupied support protects the Thief instead of following his sung move',()=>{
  const f=fixture({T:[2,8],B:[5,4],supports:[[6,3],[7,3]]});
  const s={...bardState(f),heroes:f.state.heroes.map(h=>h.kind==='thief'?{...h,at:f.at(6,3)}:h)},d=stepDetailed(f.world,s,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(7,3));
  assert.ok(d.state.supports.some(p=>p.x===f.at(6,3).x&&p.y===f.at(6,3).y));
});

test('a song refuses an unsupported companion landing even on an inactive hydraulic cell',()=>{
  for(const hydraulic of [false,true]){
    const f=fixture({T:[6,3],B:[5,4],water:[[7,3]],stones:[[4,2]],
      ...(hydraulic?{circuits:[{id:'bridge',buttons:[{x:2,y:2}]}],platforms:[{at:{x:7,y:3},circuit:'bridge',activeWhen:'pressed'}]}:{})});
    const before=bardState(f),d=stepDetailed(f.world,before,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.phases,[]);
    assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));
    assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.supports,before.supports);
  }
});

test('leaving a button can still withdraw an active platform beneath the distant partner',()=>{
  const f=fixture({T:[10,2],B:[3,4],water:[[10,3]],
    circuits:[{id:'bridge',buttons:[{x:3,y:4}]}],platforms:[{at:{x:10,y:3},circuit:'bridge',activeWhen:'pressed'}]});
  const entered=stepWorld(f.world,f.state,2),before=select(f,entered,1),d=stepDetailed(f.world,before,4);
  assert.equal(entered.failed,false);assert.deepEqual(before.platformActive,[true]);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.platformActive,[false]);
  assert.equal(d.state.dead,true);assert.equal(hero(d.state,'thief').dead,true);
  assert.ok(d.phases.some(p=>p.kind==='platform'));
});

test('a song can bring monsters into simultaneous combat without unsafe contact',()=>{
  const f=fixture({T:[2,2],B:[4,6],monsters:[[5,4],[7,4]]}),before=bardState(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,0);
  assert.deepEqual(d.phases.map(p=>p.kind),['song','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});

test('a lethal monster still attacks in the same simultaneous combat wave',()=>{
  const f=fixture({T:[8,4],B:[4,6],monsters:[[5,4],[7,4]]}),d=stepDetailed(f.world,bardState(f),4);
  assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.equal(hero(d.state,'thief').dead,true);
});

test('reflection chooses the nearer actor before testing the farther blocked arrival',()=>{
  const f=fixture({T:[6,3],B:[2,8],stones:[[9,4]],walls:[[6,1]],mirrors:[[6,4,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(planReflection(f.world,f.state).moves,[{actor:'hero',from:f.at(6,3),to:f.at(7,4)}]);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'thief').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);
});

test('mirror-reflected Bard and Thief do not trigger a song or a pull',()=>{
  const f=fixture({T:[7,5],B:[5,3],mirrors:[[5,5,'NE']],stones:[[4,3]],supports:[[3,3]]}),d=stepDetailed(f.world,bardState(f),5);
  assert.equal(d.state.failed,false);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
  assert.deepEqual(hero(d.state,'bard').at,f.at(7,5));assert.deepEqual(hero(d.state,'thief').at,f.at(5,3));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);
});

test('a blocking mirror flashes only its black backing red',()=>{
  const f=fixture({T:[6,2],B:[2,8],mirrors:[[6,4,'NE'],[8,4,'SE']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(d.blockedMirrorIndices,[1]);assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);
  const session=new DuoPuzzleSession([f.spec]),o=session.action(5),p=cellToPixel(f.at(8,4));
  assert.equal(o.frames.length,4);assert.equal(o.canUndo,false);
  // SE mirror's northwest backing is black, the northeast diagonal is white.
  assert.equal(o.frames[0][p.y][p.x],8);assert.equal(o.frames[1][p.y][p.x],5);
  assert.equal(o.frames[0][p.y][p.x+2],0);assert.equal(o.frames[2][p.y][p.x+2],0);
});

test('reflection previews use a gray plus for heroes and a gray outline for crates',()=>{
  for(const actor of ['hero','stone']){
    const f=fixture({T:actor==='hero'?[5,3]:[2,2],B:[2,8],stones:actor==='stone'?[[5,3]]:[],mirrors:[[5,5,'NE']]}),p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);
    const tile=frame.slice(p.y,p.y+3).map(r=>r.slice(p.x,p.x+3));
    assert.deepEqual(tile,actor==='hero'?[[3,1,3],[1,1,1],[3,1,3]]:[[1,1,1],[1,3,1],[1,1,1]]);
  }
});

test('the dotted magenta aura follows the Bard during its three movement frames',()=>{
  const f=fixture({T:[2,8],B:[6,4]}),before=bardState(f),d=stepDetailed(f.world,before,4),frames=transitionFrames(f.world,before,d.state,4),p=cellToPixel(f.at(6,4));
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
