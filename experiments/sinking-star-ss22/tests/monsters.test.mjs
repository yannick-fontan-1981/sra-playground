import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepDetailed,stepWorld,QuartetPuzzleSession,cellToPixel,circuitPressed,renderWorld,transitionFrames} from '../dist/core.js';

const p=(x,y)=>({x,y});
const sorted=points=>points.map(q=>`${q.x},${q.y}`).sort();
function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y===19?'#':'.'));
 for(const [key,char] of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m']])for(const [x,y] of o[key]??[])rows[y][x]=char;
 for(const [x,y] of o.goals??[[17,2],[17,7],[17,12],[17,17]])rows[y][x]='g';
 for(const [kind,def] of [['M',[2,2]],['W',[2,17]],['T',[2,7]],['B',[2,12]]]){const [x,y]=o[kind]??def;rows[y][x]=kind;}
 const spec={id:'monster-fixture',title:'SS22 physical monster fixture',rows:rows.map(r=>r.join('')),facing:'S',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:p(x,y),facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
 const world=compileLevel(spec),state=initialState(world);return {spec,world,state};
}
const select=(f,kind,state=f.state)=>stepWorld(f.world,state,6,cellToPixel(state.heroes.find(h=>h.kind===kind).at));

test('monsters remain still after any hero walks, regardless of distance, axis or selected hero',()=>{
 const f=fixture({M:[3,4],W:[15,16],T:[15,10],B:[2,15],monsters:[[10,8],[8,12]]});
 for(const [kind,action] of [['merchant',2],['warrior',1],['thief',1],['bard',4]]){
  const before=select(f,kind),d=stepDetailed(f.world,before,action);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
  assert.deepEqual(d.state.monsters,f.state.monsters);
  assert.deepEqual(d.phases.map(q=>q.kind),['walk']);
  assert.equal(transitionFrames(f.world,before,d.state,action).length,3);
 }
});

test('repeated walks and hero selections leave a freely accessible monster weight in place',()=>{
 const f=fixture({T:[4,7],monsters:[[10,8]],circuits:[{id:'weight',buttons:[p(10,8)],color:15}],gates:[{at:p(13,8),circuit:'weight',direction:'E',closedWhen:'released'}]});
 let state=f.state;
 for(const kind of ['merchant','warrior','thief','bard']){
  state=select(f,kind,state);
  for(const action of [4,2,3,1]){
   const d=stepDetailed(f.world,state,action);state=d.state;
   assert.equal(state.failed,false);assert.equal(state.dead,false);
   assert.deepEqual(state.monsters,[p(10,8)]);assert.equal(circuitPressed(f.world,state,'weight'),true);
   assert.deepEqual(state.gateClosed,[false]);assert.deepEqual(d.phases.map(q=>q.kind),['walk']);
  }
 }
});

for(const c of [
 {name:'Bard song',kind:'bard',action:4,phase:'song',options:{B:[7,7],monsters:[[5,5],[15,8]]},from:p(5,5),to:p(6,5)},
 {name:'global reflection',kind:'merchant',action:5,phase:'reflect',options:{monsters:[[6,4],[15,8]],mirrors:[[6,6,'NE']]},from:p(6,4),to:p(8,6)},
])test(`${c.name} transports only its intended monster, with no second movement`,()=>{
 const f=fixture(c.options),before=select(f,c.kind),d=stepDetailed(f.world,before,c.action);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
 assert.deepEqual(sorted(d.state.monsters),sorted([c.to,p(15,8)]));
 assert.deepEqual(d.phases.map(q=>q.kind),[c.phase]);
 assert.deepEqual(d.phases[0].moves.filter(m=>m.actor==='monster'),[{actor:'monster',from:c.from,to:c.to}]);
 const frames=transitionFrames(f.world,before,d.state,c.action);
 assert.equal(frames.length,3);assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
 assert.notDeepEqual(frames[0],frames.at(-1));assert.notDeepEqual(frames[1],frames.at(-1));
});

for(const c of [
 {name:'Merchant push',kind:'merchant',phase:'push',options:{M:[8,8],monsters:[[9,8],[15,8]],circuits:[{id:'relay',buttons:[p(8,8)]}],gates:[{at:p(10,8),circuit:'relay',direction:'N',closedWhen:'released'}]},from:p(9,8),via:p(10,8),to:p(10,7)},
 {name:'Warrior push',kind:'warrior',phase:'push',options:{W:[8,8],monsters:[[9,8],[15,8]],circuits:[{id:'relay',buttons:[p(8,8)]}],gates:[{at:p(10,8),circuit:'relay',direction:'N',closedWhen:'released'}]},from:p(9,8),via:p(10,8),to:p(10,7)},
 {name:'Thief pull',kind:'thief',phase:'pull',options:{T:[8,8],monsters:[[7,8],[15,8]],circuits:[{id:'relay',buttons:[p(9,8)]}],gates:[{at:p(8,8),circuit:'relay',direction:'N',closedWhen:'pressed'}]},from:p(7,8),via:p(8,8),to:p(8,7)},
])test(`${c.name} hands a monster to a side press before contact, without autonomous movement`,()=>{
 const f=fixture(c.options),before=select(f,c.kind),d=stepDetailed(f.world,before,4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(sorted(d.state.monsters),sorted([c.to,p(15,8)]));
 assert.deepEqual(d.phases.map(q=>q.kind),[c.phase,'piston']);
 assert.deepEqual(d.phases[0].moves.filter(m=>m.actor==='monster'),[{actor:'monster',from:c.from,to:c.via}]);
 assert.deepEqual(d.phases[1].moves,[{actor:'monster',from:c.via,to:c.to}]);
 const session=new QuartetPuzzleSession([f.spec]);session.action(6,cellToPixel(f.state.heroes.find(h=>h.kind===c.kind).at));const prior=session.observe(),after=session.action(4);
 assert.equal(after.frames.length,6);assert.deepEqual(after.frames.at(-1),renderWorld(f.world,d.state));assert.deepEqual(session.undo(),prior);
});

test('an unrelayed monster pull remains dangerous and Undo restores both positions',()=>{
 const f=fixture({T:[8,8],monsters:[[7,8]]}),before=select(f,'thief'),d=stepDetailed(f.world,before,4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.deepEqual(d.state.monsters,[p(8,8)]);assert.deepEqual(d.state.heroes.find(h=>h.kind==='thief').at,p(9,8));assert.deepEqual(d.phases.map(q=>q.kind),['pull','combat']);
 const session=new QuartetPuzzleSession([f.spec]);session.nextHero();session.nextHero();const selected=session.observe();assert.equal(session.action(4).state,'GAME_OVER');assert.deepEqual(session.undo(),selected);
});

test('Merchant cannot use a crate to push a remote monster file',()=>{
 const f=fixture({M:[3,5],stones:[[4,5]],monsters:[[5,5]]}),d=stepDetailed(f.world,f.state,4);
 assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.monsters,f.state.monsters);assert.deepEqual(d.phases,[]);
});

test('Warrior can relay a monster through a crate file but has no protection from direct contact',()=>{
 const f=fixture({W:[3,5],stones:[[4,5]],monsters:[[5,5]]}),d=stepDetailed(f.world,select(f,'warrior'),4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,[p(5,5)]);assert.deepEqual(d.state.monsters,[p(6,5)]);assert.deepEqual(d.phases.map(q=>q.kind),['push']);
 const exposed=fixture({W:[4,5],monsters:[[5,5]]}),hit=stepDetailed(exposed.world,select(exposed,'warrior'),4);
 assert.equal(hit.state.failed,false);assert.equal(hit.state.dead,true);assert.equal(hit.state.heroes.find(h=>h.kind==='warrior').dead,true);assert.deepEqual(hit.phases.map(q=>q.kind),['push','combat']);
 const session=new QuartetPuzzleSession([exposed.spec]);session.nextHero();const before=session.observe();assert.equal(session.action(4).state,'GAME_OVER');assert.deepEqual(session.undo(),before);
});

test('a closing press delivers its occupant to a button which stays weighted after release',()=>{
 const f=fixture({monsters:[[10,8]],circuits:[{id:'control',buttons:[p(3,2)]},{id:'weight',buttons:[p(11,8)]}],gates:[
  {at:p(10,8),circuit:'control',direction:'E',closedWhen:'pressed'},
  {at:p(14,8),circuit:'weight',direction:'E',closedWhen:'released'},
 ]});
 const delivered=stepDetailed(f.world,f.state,4);
 assert.deepEqual(delivered.state.monsters,[p(11,8)]);assert.deepEqual(delivered.state.gateClosed,[true,false]);
 assert.equal(circuitPressed(f.world,delivered.state,'weight'),true);
 assert.deepEqual(delivered.phases.map(q=>q.kind),['walk','piston','gate']);
 assert.deepEqual(delivered.phases[1].moves,[{actor:'monster',from:p(10,8),to:p(11,8)}]);
 const released=stepDetailed(f.world,delivered.state,3);
 assert.deepEqual(released.state.monsters,[p(11,8)]);assert.deepEqual(released.state.gateClosed,[false,false]);
 const emptyClosure=stepDetailed(f.world,released.state,4);
 assert.deepEqual(emptyClosure.state.monsters,[p(11,8)]);assert.equal(emptyClosure.phases.some(q=>q.kind==='piston'),false);
});

test('opening a gate and closing an empty press do not transport a nearby monster',()=>{
 const f=fixture({monsters:[[10,8]],circuits:[{id:'control',buttons:[p(3,2)]}],gates:[{at:p(9,8),circuit:'control',direction:'E',closedWhen:'released'}]});
 const opened=stepDetailed(f.world,f.state,4),closed=stepDetailed(f.world,opened.state,3);
 for(const d of [opened,closed]){
  assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[p(10,8)]);
  assert.deepEqual(d.phases.map(q=>q.kind),['walk','gate']);
 }
 assert.deepEqual(opened.state.gateClosed,[false]);assert.deepEqual(closed.state.gateClosed,[true]);
});

test('a press has three visible movement frames and Undo restores the complete physical turn',()=>{
 const f=fixture({monsters:[[10,8]],circuits:[{id:'control',buttons:[p(3,2)]}],gates:[{at:p(10,8),circuit:'control',direction:'E',closedWhen:'pressed'}]});
 const session=new QuartetPuzzleSession([f.spec]),before=session.observe(),after=session.action(4),origin=cellToPixel(p(10,8));
 assert.equal(after.frames.length,6);assert.deepEqual(after.frameDurationsMs,[60,80,40,60,80,0]);
 for(let pixel=1;pixel<=3;pixel++)assert.equal(after.frames[2+pixel][origin.y][origin.x+pixel],8);
 assert.deepEqual(after.frames.at(-1),after.frame);
 assert.deepEqual(after.frame,renderWorld(f.world,stepDetailed(f.world,f.state,4).state));
 assert.deepEqual(session.undo(),before);assert.equal(session.observe().canUndo,false);
});

test('selection, refused movement and an empty reflection neither move monsters nor tick combat',()=>{
 const f=fixture({walls:[[2,3]],monsters:[[3,2],[10,8]]});
 for(const [action,data] of [[2,undefined],[5,undefined],[6,cellToPixel(f.state.heroes[1].at)],[6,p(0,0)]]){
  const d=stepDetailed(f.world,f.state,action,data);
  assert.deepEqual(d.state.monsters,f.state.monsters);assert.deepEqual(d.phases,[]);assert.equal(d.state.dead,false);
 }
});

test('a stationary monster still kills any adjacent hero after an accepted world action',()=>{
 const f=fixture({M:[8,8],T:[7,6],monsters:[[8,6]]}),d=stepDetailed(f.world,f.state,4);
 assert.equal(d.state.dead,true);assert.equal(d.state.heroes.find(h=>h.kind==='thief').dead,true);
 assert.deepEqual(d.state.monsters,[p(8,6)]);assert.deepEqual(d.phases.map(q=>q.kind),['walk','combat']);
});

test('press-induced monster combat is simultaneous and releases the dead monster weight',()=>{
 const f=fixture({monsters:[[10,8],[12,8]],circuits:[{id:'control',buttons:[p(3,2)]},{id:'weight',buttons:[p(12,8)]}],gates:[
  {at:p(10,8),circuit:'control',direction:'E',closedWhen:'pressed'},
  {at:p(16,8),circuit:'weight',direction:'E',closedWhen:'released'},
 ]});
 for(const before of [f.state,{...f.state,monsters:[...f.state.monsters].reverse()}]){
  const d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.equal(circuitPressed(f.world,d.state,'weight'),false);
  assert.deepEqual(d.state.gateClosed,[true,true]);assert.deepEqual(d.phases.map(q=>q.kind),['walk','piston','combat','gate']);
 }
});

test('press transport onto a raising platform is safe, and its withdrawal still drowns the monster',()=>{
 const f=fixture({monsters:[[10,8]],water:[[11,8]],circuits:[{id:'control',buttons:[p(3,2)]}],gates:[{at:p(10,8),circuit:'control',direction:'E',closedWhen:'pressed'}],platforms:[{at:p(11,8),circuit:'control',activeWhen:'pressed'}]});
 const onto=stepDetailed(f.world,f.state,4);
 assert.deepEqual(onto.state.monsters,[p(11,8)]);assert.deepEqual(onto.state.platformActive,[true]);
 assert.deepEqual(onto.phases.map(q=>q.kind),['walk','piston','platform']);
 const removed=stepDetailed(f.world,onto.state,3);
 assert.deepEqual(removed.state.monsters,[]);assert.deepEqual(removed.state.supports,[]);assert.deepEqual(removed.state.platformActive,[false]);assert.equal(removed.state.dead,false);
 const session=new QuartetPuzzleSession([f.spec]);session.action(4);const raised=session.observe();session.action(3);assert.deepEqual(session.undo(),raised);
});

test('a sung monster can rest on an immersed support without turning into a mobile crate',()=>{
 const f=fixture({B:[7,7],monsters:[[5,5]],supports:[[6,5]],walls:[[7,5]]}),d=stepDetailed(f.world,select(f,'bard'),4);
 assert.deepEqual(d.state.monsters,[p(6,5)]);assert.deepEqual(d.state.supports,[p(6,5)]);assert.deepEqual(d.state.stones,[]);
 const wait=stepDetailed(f.world,select(f,'merchant',d.state),4);
 assert.deepEqual(wait.state.monsters,[p(6,5)]);assert.deepEqual(wait.state.supports,[p(6,5)]);
});

test('forced transport into bare water removes a monster without producing a support',()=>{
 const f=fixture({B:[7,7],monsters:[[5,5]],water:[[6,5]]}),d=stepDetailed(f.world,select(f,'bard'),4);
 assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.state.supports,[]);
 assert.deepEqual(d.phases.map(q=>q.kind),['song']);
 assert.deepEqual(d.phases[0].moves.filter(m=>m.actor==='monster'),[{actor:'monster',from:p(5,5),to:p(6,5)}]);
});

test('goals settle after actual contact hazards, without adding a hypothetical pursuing attack',()=>{
 for(const [monster,dead] of [[[4,2],true],[[5,2],false]]){
  const f=fixture({M:[2,2],W:[3,17],T:[3,7],B:[3,12],goals:[[3,2],[17,7],[17,12],[17,17]],monsters:[monster]});
  // The text format allows one token per cell; compiled goals may overlap the
  // three already parked companions for this final-arrival contract.
  const world={...f.world,goals:[p(3,2),p(3,7),p(3,12),p(3,17)]},d=stepDetailed(world,f.state,4);
  assert.equal(d.state.dead,dead);assert.equal(d.state.complete,!dead);assert.deepEqual(d.state.monsters,[p(...monster)]);
  assert.deepEqual(d.phases.map(q=>q.kind),dead?['walk','combat']:['walk']);
 }
});

test('walking into stationary contact is public GAME_OVER and Undo restores the visible threat',()=>{
 const f=fixture({monsters:[[4,2]]}),session=new QuartetPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
 assert.equal(after.state,'GAME_OVER');assert.equal(after.frames.length,8);assert.equal(after.frameDurationsMs.at(-1),0);
 assert.deepEqual(after.frames.at(-1),after.frame);assert.deepEqual(session.undo(),before);
});
