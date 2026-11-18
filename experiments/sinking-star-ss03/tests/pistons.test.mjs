import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,circuitPressed,gateClosed,renderWorld,transitionFrames,contains,PullPuzzleSession} from '../dist/core.js';

const spec=(rows,circuits,gates)=>({id:'pistons',title:'Pistons',rows,circuits,gates});
const point=(level,x,y)=>({x:x+Math.floor((20-level.rows[0].length)/2),y:y+Math.floor((20-level.rows.length)/2)});
const gate=(x,y,circuit,direction='E',closedWhen='pressed')=>({at:{x,y},circuit,direction,closedWhen});
const circuit=(id,...buttons)=>({id,buttons:buttons.map(([x,y])=>({x,y}))});
const setup=level=>{const w=compileLevel(level);return {w,s:initialState(w)};};

test('a closing piston shifts a complete file of crates exactly one cell',()=>{
 const level=spec(['#########','#..oo...#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],[gate(4,1,'a','W')]);
 const {w,s}=setup(level),first=stepWorld(w,s,4),detail=stepDetailed(w,first,4);
 assert.equal(gateClosed(w,s,0),false);
 assert.equal(gateClosed(w,detail.state,0),true);
 assert.deepEqual(detail.state.stones,[point(level,2,1),point(level,3,1)]);
 const piston=detail.phases.find(p=>p.kind==='piston');
 assert.equal(piston.moves.length,2);
 assert.ok(piston.moves.every(m=>m.to.x===m.from.x-1&&m.to.y===m.from.y));
 assert.equal(detail.state.dead,false);
});

test('a blocked file crushes only the occupant of the closing piston',()=>{
 const level=spec(['#########','##oo....#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],[gate(3,1,'a','W')]);
 const {w,s}=setup(level),detail=stepDetailed(w,stepWorld(w,s,4),4);
 assert.deepEqual(detail.state.stones,[point(level,2,1)]);
 assert.equal(detail.state.failed,false,'crushing is a committed consequence, not an invalid action');
 assert.equal(detail.phases.at(-1).kind,'crush');
});

test('simultaneous closing pistons cannot push a file through another closed piston, regardless of definition order',()=>{
 const gates=[gate(4,1,'a','W'),gate(3,1,'a','W')];
 for(const order of [gates,[...gates].reverse()]){
  const level=spec(['#########','#..oo...#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],order);
  const {w,s}=setup(level),detail=stepDetailed(w,stepWorld(w,s,4),4);
  assert.deepEqual(detail.state.stones,[point(level,2,1)]);
  assert.equal(detail.phases.filter(p=>p.kind==='crush').length,1);
  assert.equal(detail.phases.filter(p=>p.kind==='piston').length,1);
  assert.ok(w.gates.every((_,i)=>gateClosed(w,detail.state,i)));
 }
});

test('a forced hero displacement does not pull the crate behind its forced direction',()=>{
 const level=spec(['#########','#...o...#','#..T....#','#......g#','#########'],[circuit('a',[3,2])],[gate(4,2,'a','S','released')]);
 const {w,s}=setup(level),detail=stepDetailed(w,s,4);
 assert.deepEqual(detail.state.hero,point(level,4,3));
 assert.deepEqual(detail.state.stones,s.stones);
 assert.deepEqual(detail.phases.map(p=>p.kind),['walk','piston']);
 assert.equal(detail.phases[1].moves[0].actor,'hero');
});

test('hero crushing produces GAME_OVER while Undo restores the exact previous frame',()=>{
 const level=spec(['#########','#...#...#','#..T....#','#......g#','#########'],[circuit('a',[3,2])],[gate(4,2,'a','N','released')]);
 const session=new PullPuzzleSession([level]),before=session.observe(),dead=session.action(4);
 assert.equal(dead.state,'GAME_OVER');
 assert.equal(dead.levelsCompleted,0);
 assert.equal(dead.canUndo,true);
 assert.deepEqual(session.action(1).frame,dead.frame);
 assert.deepEqual(session.undo(),before);
 session.action(4);assert.deepEqual(session.reset(),before);
});

test('one circuit can open a released-mode door while closing a pressed-mode door',()=>{
 const level=spec(['#########','#.......#','#T......#','#......g#','#########'],[circuit('a',[2,2])],[gate(4,1,'a','E','pressed'),gate(4,2,'a','W','released')]);
 const {w,s}=setup(level);
 assert.deepEqual(s.gateClosed,[false,true]);
 const pressed=stepWorld(w,s,4);assert.deepEqual(pressed.gateClosed,[true,false]);
 const released=stepWorld(w,pressed,3);assert.deepEqual(released.gateClosed,[false,true]);
});

test('a file deposited on another circuit triggers its piston in a second unit phase',()=>{
 const level=spec(['##########','#..o.....#','#T.b.....#','#..o...g.#','##########'],[circuit('a',[3,2]),circuit('b',[4,1])],[gate(3,1,'a'),gate(3,3,'b')]);
 const {w,s}=setup(level),before=stepWorld(w,s,4),detail=stepDetailed(w,before,4);
 assert.deepEqual(detail.state.stones,[point(level,4,1),point(level,4,3)]);
 assert.deepEqual(detail.state.gateClosed,[true,true]);
 assert.deepEqual(detail.phases.map(p=>p.kind),['walk','piston','piston']);
 const frames=transitionFrames(w,before,detail.state,4);
 assert.equal(frames.length,7,'one walk frame, then three frames for each of two forced pushes');
 assert.deepEqual(frames.at(-1),renderWorld(w,detail.state));
});

test('a closed gate itself weighs on a button beneath it and can drive another circuit',()=>{
 const level=spec(['#########','#.......#','#.T.....#','#......g#','#########'],[circuit('a',[3,2]),circuit('b',[3,1])],[gate(3,1,'a'),gate(6,1,'b')]);
 const {w,s}=setup(level),after=stepWorld(w,s,4);
 assert.equal(circuitPressed(w,after,'b'),true);
 assert.deepEqual(after.gateClosed,[true,true]);
 assert.equal(after.stones.length,0);
 const released=stepWorld(w,after,3);
 assert.deepEqual(released.gateClosed,[false,false]);
});

test('a pulled crate and the subsequent piston push animate as two separate three-frame phases',()=>{
 const level=spec(['##########','#........#','#oT......#','#......g.#','##########'],[circuit('a',[3,2])],[gate(2,2,'a','S')]);
 const {w,s}=setup(level),detail=stepDetailed(w,s,4),frames=transitionFrames(w,s,detail.state,4);
 assert.deepEqual(detail.phases.map(p=>p.kind),['pull','piston']);
 assert.deepEqual(detail.state.stones,[point(level,2,3)]);
 assert.equal(frames.length,6);
 assert.deepEqual(frames[2],renderWorld(w,detail.phases[0].after));
 assert.deepEqual(frames[5],renderWorld(w,detail.state));
 for(const phase of detail.phases)for(const m of phase.moves)assert.equal(Math.abs(m.from.x-m.to.x)+Math.abs(m.from.y-m.to.y),1);
 const session=new PullPuzzleSession([level]);const observed=session.action(4);
 assert.equal(observed.frames.length,6);
 assert.deepEqual(observed.frameDurationsMs,[60,80,40,60,80,0]);
});

test('piston animation advances a forced crate by one and two pixels before the final grid cell',()=>{
 const level=spec(['#########','#..o....#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],[gate(3,1,'a','E')]);
 const {w,s}=setup(level),before=stepWorld(w,s,4),detail=stepDetailed(w,before,4),frames=transitionFrames(w,before,detail.state,4);
 const from=point(level,3,1),px=2+3*from.x,py=2+3*from.y;
 assert.equal(frames.length,4);
 for(let pixels=1;pixels<=2;pixels++){
  const frame=frames[pixels];
  assert.equal(frame[py+1][px+pixels+1],5);
  assert.equal(frame[py][px+pixels+1],13);
 }
 assert.deepEqual(frames[3],renderWorld(w,detail.state));
});

test('a piston can create a permanent platform by pushing the tail crate into water',()=>{
 const level=spec(['#########','#..o~...#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],[gate(3,1,'a')]);
 const {w,s}=setup(level),after=stepWorld(w,stepWorld(w,s,4),4);
 assert.equal(after.stones.length,0);
 assert.ok(contains(after.supports,point(level,4,1)));
 assert.equal(after.dead,false);
});

test('a hero forced into unsupported water dies and a reset remains possible',()=>{
 const level=spec(['#########','#.......#','#..T....#','#...~..g#','#########'],[circuit('a',[3,2])],[gate(4,2,'a','S','released')]);
 const session=new PullPuzzleSession([level]);
 assert.equal(session.action(4).state,'GAME_OVER');
 assert.equal(session.reset().state,'NOT_FINISHED');
});

test('piston effects and circuits remain private to the engine observation',()=>{
 const level=spec(['#########','#..o....#','#T.b....#','#......g#','#########'],[circuit('a',[3,2])],[gate(3,1,'a')]);
 const session=new PullPuzzleSession([level]);session.action(4);const ob=session.action(4);
 for(const key of ['phases','moves','gateClosed','circuits','gates','hero','stones','dead'])assert.equal(key in ob,false);
 assert.ok(ob.frames.every(frame=>frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16))));
 assert.ok(!ob.frames.flat(2).includes(1));
});

test('malformed circuit definitions fail before gameplay',()=>{
 const rows=['#######','#T...g#','#######'];
 for(const level of [
  spec(rows,[circuit('a',[2,1]),circuit('a',[3,1])],[]),
  spec(rows,[circuit('a',[2,1]),circuit('b',[2,1])],[]),
  spec(rows,[circuit('a',[0,0])],[]),
  spec(rows,[circuit('a',[2,1])],[gate(3,1,'missing')]),
  spec(rows,[circuit('a',[2,1])],[gate(3,1,'a'),gate(3,1,'a')]),
 ])assert.throws(()=>compileLevel(level));
});
