import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,TrioPuzzleSession,planReflection,planSwap,traceSwap,cellToPixel,PALETTE,GRID,circuitPressed} from '../dist/core.js';
import {decodeCommand,replay,solve} from '../scripts/solver.mjs';
import {Author} from '../reference/author/author.mjs';

const p=(x,y)=>({x,y}),eq=(a,b)=>a.x===b.x&&a.y===b.y;
const role=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(w,s,kind)=>stepWorld(w,s,6,cellToPixel(role(s,kind).at));
function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y===19?'#':'.'));
 for(const [key,char] of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const [x,y] of o[key]??[])rows[y][x]=char;
 for(const [x,y] of o.goals??[[17,2],[17,6],[17,10]])rows[y][x]='g';
 for(const [kind,def] of [['Z',[2,2]],['W',[2,6]],['T',[2,10]]]){const [x,y]=o[kind]??def;rows[y][x]=kind;}
 const spec={id:o.id??'fixture',title:'Trio fixture',rows:rows.map(row=>row.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:p(x,y),facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
 const world=compileLevel(spec),state=initialState(world);return{spec,world,state};
}
const act=(f,kind,id)=>stepDetailed(f.world,select(f.world,f.state,kind),id);
const goalFixture=id=>fixture({id,Z:[2,2],W:[2,6],T:[2,10],goals:[[3,2],[3,6],[3,10]]});
const finish=session=>{session.action(4);session.nextHero();session.action(4);session.nextHero();return session.action(4);};

test('compile requires exactly three distinct roles and goals in the stable W/T/Z order',()=>{
 const f=fixture();assert.deepEqual(f.world.heroes.map(h=>h.kind),['warrior','thief','wizard']);assert.equal(f.world.goals.length,3);assert.equal(f.state.active,0);assert.deepEqual(GRID,{cells:20,cellPx:3,originPx:2,canvasPx:64});assert.equal(PALETTE.length,16);assert.ok(Object.isFrozen(f.world));
 assert.deepEqual(compileLevel({...f.spec,mode:'trio'}),f.world);
 for(const rows of [['WTgg'],['WTZgg'],['WWTggg'],['WZggg'],['WTZgggg']])assert.throws(()=>compileLevel({...f.spec,rows}),/one Warrior, one Thief, one Wizard and three destinations/);
 for(const mode of ['duo','solo-warrior',null,0])assert.throws(()=>compileLevel({...f.spec,mode}),/Invalid hero mode/);
 for(const kind of ['Z','W','T'])assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replace(kind,'.'))}));
});
test('compile centers smaller maps, rejects ragged or overlapping devices and validates circuits',()=>{
 const w=compileLevel({id:'small',title:'Small',rows:['WTZggg']});assert.deepEqual(w.heroes.map(h=>h.at),[p(7,9),p(8,9),p(9,9)]);
 assert.throws(()=>compileLevel({id:'ragged',title:'Ragged',rows:['WTZggg','...']}));
 assert.throws(()=>fixture({mirrors:[[2,2,'NE']]}));assert.throws(()=>fixture({mirrors:[[3,3,'BAD']]}));
 assert.throws(()=>fixture({gates:[{at:p(3,3),circuit:'absent',direction:'E',closedWhen:'pressed'}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)],color:16}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)]}],platforms:[{at:p(6,6),circuit:'a',activeWhen:'pressed'}]}));
});
test('selection cycles all three roles without moving, ticking monsters or circuits',()=>{
 const f=fixture({monsters:[[3,2]]}),s=new TrioPuzzleSession([f.spec]),initial=s.observe();
 assert.deepEqual(s.action(6,cellToPixel(f.state.heroes[0].at)),initial);assert.equal(s.observe().canUndo,false);
 for(let i=1;i<=3;i++){const before=s.observe(),after=s.nextHero();assert.equal(after.state,'NOT_FINISHED');assert.equal(after.levelsCompleted,0);assert.equal(after.canUndo,true);assert.notDeepEqual(after.frame,before.frame);}
 assert.deepEqual(s.observe().frame,initial.frame);s.undo();s.undo();assert.notDeepEqual(s.observe().frame,initial.frame);assert.deepEqual(s.undo(),initial);
 for(const kind of ['warrior','thief','wizard']){const d=stepDetailed(f.world,f.state,6,cellToPixel(role(f.state,kind).at));assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.phases,[]);assert.equal(d.state.heroes[d.state.active].kind,kind);}
});
test('public image preserves red, green, violet identities and private state is never exposed',()=>{
 const f=fixture(),o=new TrioPuzzleSession([f.spec]).observe();assert.equal(o.gameCode,'SS17');
 for(const [kind,color] of [['wizard',15],['warrior',8],['thief',14]]){const at=cellToPixel(role(f.state,kind).at);assert.equal(o.frame[at.y+1][at.x+1],color);}
 assert.deepEqual(Object.keys(o).sort(),['availableActionIds','canSelectLevel','canUndo','defaultFps','frame','frames','gameCode','level','levelCount','levelsCompleted','palette','state'].sort());
 assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);assert.equal(o.frame.length,64);assert.ok(o.frame.every(row=>row.length===64&&row.every(c=>Number.isInteger(c)&&c>=0&&c<16)));
});
test('invalid ACTION ids and fractional or out-of-frame selection are atomic',()=>{
 const f=fixture(),before=JSON.stringify(f.state);for(const action of [0,7,1.5,NaN])assert.throws(()=>stepDetailed(f.world,f.state,action));
 for(const pos of [undefined,p(-1,3),p(64,3),p(3.5,4),p(3,NaN)])assert.throws(()=>stepDetailed(f.world,f.state,6,pos));assert.equal(JSON.stringify(f.state),before);
});
test('Warrior pushes a mixed file of both partners, crate and mirror without invoking their abilities',()=>{
 const f=fixture({W:[2,6],Z:[3,6],T:[4,6],stones:[[5,6],[1,6]],mirrors:[[6,6,'SE']]}),d=act(f,'warrior',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes.map(h=>h.at),[p(3,6),p(5,6),p(4,6)]);assert.deepEqual(d.state.stones,[p(1,6),p(6,6)]);assert.deepEqual(d.state.mirrors,[{at:p(7,6),facing:'SE'}]);assert.equal(d.phases.length,1);assert.equal(d.phases[0].moves.length,5);assert.equal(d.phases[0].kind,'push');
});
test('a blocked Warrior file is transactional and cannot sacrifice either partner or a mirror',()=>{
 for(const extra of [{walls:[[6,6]]},{water:[[6,6]],T:[5,6]},{water:[[6,6]],stones:[[3,6],[4,6]],mirrors:[[5,6,'NE']]},{water:[[6,6]],Z:[5,6]}]){
  const f=fixture({stones:[[3,6],[4,6],[5,6]],...extra}),before=select(f.world,f.state,'warrior'),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,before.heroes);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.mirrors,before.mirrors);assert.deepEqual(d.phases,[]);
 }
});
test('Thief pulls only the immediate rear actor in each cardinal direction, leaving the rest of a file',()=>{
 for(const [id,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
  const f=fixture({T:[8,10],stones:[[8-dx,10-dy],[8-2*dx,10-2*dy]]}),d=act(f,'thief',id);
  assert.equal(d.state.failed,false);assert.deepEqual(role(d.state,'thief').at,p(8+dx,10+dy));assert.ok(d.state.stones.some(q=>eq(q,p(8,10))));assert.ok(d.state.stones.some(q=>eq(q,p(8-2*dx,10-2*dy))));assert.equal(d.phases[0].kind,'pull');assert.equal(d.phases[0].moves.length,2);
 }
 const f=fixture({T:[8,10],stones:[[7,10]]}),d=act(f,'thief',1);assert.deepEqual(d.state.stones,f.state.stones);assert.equal(d.phases[0].kind,'walk');
});
test('Thief cannot push any forward occupant and an obstructed landing cancels his rear pull',()=>{
 for(const extra of [{stones:[[7,10],[9,10]]},{Z:[9,10]},{W:[9,10]},{mirrors:[[9,10,'NE']]},{monsters:[[9,10]]},{water:[[9,10]]},{walls:[[9,10]]}]){
  const f=fixture({T:[8,10],stones:[[7,10]],...extra}),before=select(f.world,f.state,'thief'),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.heroes,before.heroes);assert.deepEqual(d.phases,[]);
 }
});
test('Thief can recover either partner or a mirror without pushing or recursively pulling with them',()=>{
 for(const extra of [{Z:[7,10]},{W:[7,10]},{mirrors:[[7,10,'NW']]}]){
  const f=fixture({T:[8,10],stones:[[6,10]],...extra}),d=act(f,'thief',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,f.state.stones);assert.equal(d.phases[0].moves.length,2);assert.deepEqual(d.phases[0].moves[1].to,p(8,10));if(extra.mirrors)assert.equal(d.state.mirrors[0].facing,'NW');
 }
});
test('a pushed crate becomes one permanent support, while submerged supports never move',()=>{
 const f=fixture({stones:[[3,6],[4,6]],water:[[5,6]]});let s=select(f.world,f.state,'warrior');s=stepWorld(f.world,s,4);assert.deepEqual(s.supports,[p(5,6)]);assert.deepEqual(s.stones,[p(4,6)]);s=stepWorld(f.world,s,4);assert.deepEqual(s.supports,[p(5,6)]);assert.deepEqual(s.stones,[p(5,6)]);
 const t=fixture({T:[8,10],supports:[[7,10],[9,10]]}),d=act(t,'thief',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,t.state.supports);assert.equal(d.phases[0].kind,'walk');assert.deepEqual(role(d.state,'thief').at,p(9,10));
});
test('a monster pushed into water disappears without a support, but pulling one stays lethal',()=>{
 const f=fixture({W:[2,12],monsters:[[3,12]],water:[[4,12]]}),d=act(f,'warrior',4);assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,0);assert.equal(d.state.supports.length,0);
 const t=fixture({T:[8,10],monsters:[[7,10]]}),pull=act(t,'thief',4);assert.equal(pull.state.dead,true);assert.equal(role(pull.state,'thief').dead,true);assert.deepEqual(pull.phases.map(x=>x.kind),['pull','combat']);
});
test('all heroes refuse voluntary unsupported water and none gains an ability through a forced mirror move',()=>{
 for(const [kind,pos] of [['wizard',[2,2]],['warrior',[2,6]],['thief',[2,10]]]){
  const f=fixture({water:[[pos[0]+1,pos[1]]]}),d=act(f,kind,4);assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);
 }
 const f=fixture({T:[6,4],stones:[[6,3]],mirrors:[[6,6,'NE']]}),d=act(f,'thief',5);assert.equal(d.state.failed,false);assert.deepEqual(role(d.state,'thief').at,p(8,6));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});
test('nearest reflection wins over selection or actor kind in every mirror quadrant',()=>{
 const arms={NE:[[0,-1],[1,0]],NW:[[0,-1],[-1,0]],SE:[[0,1],[1,0]],SW:[[0,1],[-1,0]]};
 for(const [facing,dirs] of Object.entries(arms))for(const arm of [0,1]){
  const n=dirs[arm],far=dirs[1-arm],from=[10+n[0],10+n[1]],to=p(10+far[0],10+far[1]);
  const f=fixture({Z:from,W:[2,5],T:[2,15],stones:[[10+3*far[0],10+3*far[1]]],mirrors:[[10,10,facing]]}),d=act(f,'thief',5);assert.equal(d.state.failed,false);assert.deepEqual(planReflection(f.world,f.state)?.moves,[{actor:'hero',from:p(...from),to}]);assert.deepEqual(role(d.state,'wizard').at,to);assert.deepEqual(d.state.stones,f.state.stones);
 }
});
test('equal-distance heroes exchange identities and selection remains on the same role',()=>{
 const f=fixture({Z:[6,4],W:[8,6],T:[2,15],mirrors:[[6,6,'NE']]}),d=act(f,'warrior',5);assert.equal(d.state.failed,false);assert.equal(d.state.active,0);assert.deepEqual(role(d.state,'wizard').at,p(8,6));assert.deepEqual(role(d.state,'warrior').at,p(6,4));assert.deepEqual(role(d.state,'thief').at,p(2,15));assert.equal(d.phases[0].moves.length,2);
});
test('far blocked arrival is irrelevant, but a nearer blocked arrival refuses the whole reflection',()=>{
 const f=fixture({Z:[10,9],stones:[[13,10]],walls:[[10,7]],mirrors:[[10,10,'NE']]}),d=act(f,'wizard',5);assert.equal(d.state.failed,false);assert.deepEqual(role(d.state,'wizard').at,p(11,10));
 const blocked=fixture({Z:[10,9],stones:[[13,10]],walls:[[11,10]],mirrors:[[10,10,'NE']]}),r=act(blocked,'wizard',5);assert.equal(r.state.failed,true);assert.deepEqual(r.state.heroes,blocked.state.heroes);assert.equal(planReflection(blocked.world,blocked.state),null);
});
test('multiple mirrors resolve globally and reject incompatible destinations without cloning',()=>{
 const f=fixture({Z:[6,4],W:[10,4],mirrors:[[6,6,'NE'],[10,6,'NW']]}),d=act(f,'wizard',5);assert.equal(d.state.failed,true);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(d.state.heroes,f.state.heroes);
 const one=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[4,4,'SE']]}),r=act(one,'wizard',5);assert.equal(r.state.failed,true);assert.equal(r.state.heroes.length,3);assert.deepEqual(r.state.heroes,one.state.heroes);
});
test('forced reflection into water drowns any role; reflected crates create an appui instead',()=>{
 for(const char of ['Z','W','T']){
  const f=fixture({[char]:[6,4],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'wizard',5);assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.equal(d.state.heroes.filter(h=>h.dead).length,1);
 }
 const f=fixture({stones:[[6,4]],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'wizard',5);assert.equal(d.state.dead,false);assert.deepEqual(d.state.supports,[p(8,6)]);assert.equal(d.state.stones.length,0);
});
test('a forced Thief press move never drags the crate behind the departure cell',()=>{
 const f=fixture({T:[8,10],stones:[[7,10]],circuits:[{id:'a',buttons:[p(3,2)]}],gates:[{at:p(8,10),circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=act(f,'wizard',4);assert.deepEqual(role(d.state,'thief').at,p(9,10));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});
test('releasing a weighted button fires the side press and builds a remote support, Undo restores both',()=>{
 const f=fixture({T:[8,10],stones:[[7,10],[14,6]],water:[[15,6]],circuits:[{id:'a',buttons:[p(7,10)]}],gates:[{at:p(14,6),circuit:'a',direction:'E',closedWhen:'released'}]}),d=act(f,'thief',4);assert.equal(d.state.dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['pull','piston']);assert.deepEqual(d.state.supports,[p(15,6)]);
 const s=new TrioPuzzleSession([f.spec]);s.nextHero();const before=s.observe(),after=s.action(4);assert.deepEqual(after.frameDurationsMs,[60,80,40,60,80,0]);assert.deepEqual(s.undo(),before);
});
test('AND circuits can use all three heroes and the last departure releases the mechanism',()=>{
 const f=fixture({circuits:[{id:'a',buttons:[p(3,2),p(3,6),p(3,10)]}],gates:[{at:p(12,12),circuit:'a',direction:'E',closedWhen:'released'}]});let s=f.state;
 for(const kind of ['warrior','thief','wizard']){s=stepWorld(f.world,select(f.world,s,kind),4);assert.equal(circuitPressed(f.world,s,'a'),kind==='wizard');}
 assert.deepEqual(s.gateClosed,[false]);s=stepWorld(f.world,s,4);assert.equal(circuitPressed(f.world,s,'a'),false);assert.deepEqual(s.gateClosed,[true]);
});
test('hydraulic activation is settled before a simultaneous reflected hero landing',()=>{
 const f=fixture({Z:[6,4],W:[2,6],T:[2,15],stones:[[3,10]],water:[[8,6]],mirrors:[[6,6,'NE'],[3,8,'SE']],circuits:[{id:'a',buttons:[p(5,8)],color:15}],platforms:[{at:p(8,6),circuit:'a',activeWhen:'pressed'}]}),d=act(f,'wizard',5);
 assert.equal(d.state.dead,false);assert.equal(d.state.failed,false);assert.deepEqual(role(d.state,'wizard').at,p(8,6));assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['reflect','platform']);
 const back=stepWorld(f.world,d.state,5);assert.equal(back.dead,false);assert.deepEqual(role(back,'wizard').at,p(6,4));assert.deepEqual(back.platformActive,[false]);
});
test('a crate on a raised platform remains mobile, then sinks permanently when the operator leaves',()=>{
 const f=fixture({Z:[3,2],W:[8,6],stones:[[9,6]],water:[[10,6]],circuits:[{id:'a',buttons:[p(3,2)]}],platforms:[{at:p(10,6),circuit:'a',activeWhen:'pressed'}]});let s=stepWorld(f.world,select(f.world,f.state,'warrior'),4);assert.deepEqual(s.stones,[p(10,6)]);assert.equal(s.supports.length,0);
 s=stepWorld(f.world,select(f.world,s,'wizard'),3);assert.deepEqual(s.platformActive,[false]);assert.deepEqual(s.supports,[p(10,6)]);assert.equal(s.stones.length,0);s=stepWorld(f.world,select(f.world,s,'warrior'),4);assert.equal(s.dead,false);assert.deepEqual(role(s,'warrior').at,p(10,6));
});
test('withdrawing a bridge beneath either inactive companion causes GAME_OVER and Undo restores it',()=>{
 for(const char of ['W','T']){
  const f=fixture({Z:[3,2],[char]:[9,6],water:[[10,6]],circuits:[{id:'a',buttons:[p(3,2)]}],platforms:[{at:p(10,6),circuit:'a',activeWhen:'pressed'}]});
  const s=new TrioPuzzleSession([f.spec]);s.action(6,cellToPixel(role(f.state,char==='W'?'warrior':'thief').at));s.action(4);s.action(6,cellToPixel(role(f.state,'wizard').at));const before=s.observe(),after=s.action(3);assert.equal(after.state,'GAME_OVER');assert.deepEqual(s.undo().frame,before.frame);
 }
});
test('combat is orthogonal, simultaneous, and a killed monster still attacks in that wave',()=>{
 const diagonal=fixture({W:[6,6],monsters:[[8,7]]}),safe=act(diagonal,'warrior',2);assert.equal(safe.state.dead,false);
 const pair=fixture({W:[6,4],monsters:[[6,6],[7,6]]}),d=act(pair,'warrior',2);assert.equal(d.state.dead,true);assert.equal(d.state.monsters.length,0);assert.equal(role(d.state,'warrior').dead,true);assert.deepEqual(d.phases.map(p=>p.kind),['walk','combat']);
 const frames=transitionFrames(pair.world,pair.state,d.state,2);assert.equal(frames.length,8);
});
test('colored buttons have exactly gray corners, a pink plus, and a circuit-colored center',()=>{
 const f=fixture({circuits:[{id:'violet',buttons:[p(8,8)],color:15}]}),frame=renderWorld(f.world,f.state),px=cellToPixel(p(8,8));assert.deepEqual(frame.slice(px.y,px.y+3).map(row=>row.slice(px.x,px.x+3)),[[3,7,3],[7,15,7],[3,7,3]]);
});
test('a pure violet press has a black center closed and gray center open, never a button or blue artifact',()=>{
 const f=fixture({circuits:[{id:'violet',buttons:[p(3,6)],color:15}],gates:[{at:p(8,8),circuit:'violet',direction:'E',closedWhen:'released'}]}),px=cellToPixel(p(8,8));
 for(const [state,center] of [[f.state,5],[stepWorld(f.world,f.state,4),3]]){const tile=renderWorld(f.world,state).slice(px.y,px.y+3).map(row=>row.slice(px.x,px.x+3));assert.equal(tile[1][1],center);assert.equal(tile.flat().includes(9),false);assert.notDeepEqual(tile,[[3,7,3],[7,15,7],[3,7,3]]);}
});
test('mirror faces stay above circuit markings in every quadrant',()=>{
 for(const face of ['NE','NW','SE','SW']){
  const f=fixture({mirrors:[[8,8,face]],circuits:[{id:'v',buttons:[p(8,8)],color:15}]}),px=cellToPixel(p(8,8)),frame=renderWorld(f.world,f.state);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){const diagonal=(face==='NW'||face==='SE')?x+y===2:x===y,black=face==='NE'?y>x:face==='SW'?x>y:face==='NW'?x+y>2:x+y<2;if(diagonal)assert.equal(frame[px.y+y][px.x+x],0);else if(black)assert.equal(frame[px.y+y][px.x+x],5);}
 }
});
test('walk and pull move one, two, then three pixels and finish on the exact rendered state',()=>{
 const f=fixture({T:[8,10],stones:[[7,10]]}),s=select(f.world,f.state,'thief'),d=stepDetailed(f.world,s,4),frames=transitionFrames(f.world,s,d.state,4),px=cellToPixel(p(7,10));assert.equal(frames.length,3);assert.equal(frames[0][px.y][px.x+1],13);assert.equal(frames[1][px.y][px.x+2],13);assert.deepEqual(frames[2],renderWorld(f.world,d.state));
 const session=new TrioPuzzleSession([fixture().spec]),o=session.action(4);assert.deepEqual(o.frameDurationsMs,[60,80,0]);assert.equal(o.frames.length,3);assert.deepEqual(o.frames.at(-1),o.frame);
});
test('blocking mirror backs flash red twice without a world tick or new Undo entry',()=>{
 const f=fixture({Z:[6,4],monsters:[[3,10]],mirrors:[[6,6,'NE'],[7,6,'SE']]}),s=new TrioPuzzleSession([f.spec]),initial=s.observe(),o=s.action(5),px=cellToPixel(p(7,6));assert.equal(o.state,'NOT_FINISHED');assert.equal(o.canUndo,false);assert.deepEqual(o.frameDurationsMs,[110,70,110,0]);assert.deepEqual(o.frames.map(frame=>frame[px.y][px.x]),[8,5,8,5]);assert.deepEqual(o.frames.map(frame=>frame[px.y+1][px.x+1]),[0,0,0,0]);assert.deepEqual(o.frame,initial.frame);assert.deepEqual(s.action(5),o);
});
test('walls, closed doors and closed presses warn on the projecting mirror without moving the world',()=>{
 for(const obstacle of [
  {walls:[[8,6]]},
  {buttons:[[14,14]],doors:[[8,6]]},
  {circuits:[{id:'closed',buttons:[p(14,14)],color:15}],gates:[{at:p(8,6),circuit:'closed',direction:'E',closedWhen:'released'}]},
 ]){
  const f=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[16,1,'NE']],...obstacle}),detail=stepDetailed(f.world,f.state,5);
  assert.equal(planReflection(f.world,f.state),null);assert.deepEqual(detail.blockedMirrorIndices,[0]);assert.deepEqual(detail.phases,[]);assert.deepEqual(detail.state,{...f.state,failed:true});
  const session=new TrioPuzzleSession([f.spec]),before=session.observe(),warning=session.action(5),at=cellToPixel(p(6,6)),other=cellToPixel(p(16,1));
  assert.deepEqual(warning.frameDurationsMs,[110,70,110,0]);assert.deepEqual(warning.frames.map(frame=>frame[at.y+2][at.x]),[8,5,8,5]);assert.deepEqual(warning.frames.map(frame=>frame[at.y+1][at.x+1]),[0,0,0,0]);assert.deepEqual(warning.frames.map(frame=>frame[other.y+2][other.x]),[5,5,5,5]);
  assert.deepEqual(warning.frame,before.frame);assert.equal(warning.canUndo,false);assert.deepEqual(session.action(5),warning);assert.deepEqual(session.undo(),before);
 }
});
test('every independently blocked mirror flashes while a global refusal applies no partial transfer',()=>{
 const f=fixture({Z:[4,3],W:[12,3],T:[8,12],walls:[[6,5],[14,5]],mirrors:[[4,5,'NE'],[12,5,'NE'],[8,14,'NE']]}),detail=stepDetailed(f.world,f.state,5);
 assert.deepEqual(detail.blockedMirrorIndices,[0,1]);assert.deepEqual(detail.state,{...f.state,failed:true});assert.deepEqual(detail.phases,[]);
 const before=renderWorld(f.world,f.state),session=new TrioPuzzleSession([f.spec]),warning=session.action(5);
 for(const [i,mirror] of f.state.mirrors.entries()){
  const at=cellToPixel(mirror.at);assert.deepEqual(warning.frames.map(frame=>frame[at.y+2][at.x]),i<2?[8,5,8,5]:[5,5,5,5]);
 }
 assert.deepEqual(warning.frame,before);assert.equal(warning.canUndo,false);
});
test('reflection refused by a subsequent door closure warns on its active mirror and leaves the occupied door safe',()=>{
 const f=fixture({W:[5,4],stones:[[6,4]],circuits:[{id:'door',buttons:[p(6,4)]}],doors:[[5,5]],mirrors:[[6,6,'NE']]}),occupied=stepWorld(f.world,f.state,2),plan=planReflection(f.world,occupied),detail=stepDetailed(f.world,occupied,5);
 assert.equal(plan.moves.length,1);assert.deepEqual(detail.blockedMirrorIndices,[0]);assert.deepEqual(detail.state,{...occupied,failed:true});assert.deepEqual(detail.phases,[]);
 const session=new TrioPuzzleSession([f.spec]),initial=session.observe(),before=session.action(2),warning=session.action(5),at=cellToPixel(p(6,6));
 assert.deepEqual(warning.frames.map(frame=>frame[at.y+2][at.x]),[8,5,8,5]);assert.deepEqual(warning.frame,before.frame);assert.equal(warning.state,'NOT_FINISHED');assert.equal(warning.canUndo,true);assert.deepEqual(session.undo().frame,initial.frame);
});
test('all three destinations must be occupied at the same time before level completion',()=>{
 const f=goalFixture('goals'),s=new TrioPuzzleSession([f.spec]);s.action(4);s.nextHero();s.action(4);assert.equal(s.observe().state,'NOT_FINISHED');assert.equal(s.observe().levelsCompleted,0);s.nextHero();assert.equal(s.action(4).state,'WIN');assert.equal(s.observe().levelsCompleted,1);assert.equal(s.undo().state,'NOT_FINISHED');assert.equal(s.observe().levelsCompleted,0);
});
test('campaign transition and completion are reversible across all three heroes',()=>{
 const a=goalFixture('a'),b=goalFixture('b'),s=new TrioPuzzleSession([a.spec,b.spec]),transition=finish(s);assert.equal(transition.level,2);assert.equal(transition.levelsCompleted,1);assert.equal(transition.frames.length,4);assert.equal(transition.frameDurationsMs.at(-2),100);
 const undone=s.undo();assert.equal(undone.level,1);assert.equal(undone.levelsCompleted,0);assert.equal(undone.state,'NOT_FINISHED');assert.equal(s.action(4).level,2);assert.equal(finish(s).state,'WIN');assert.equal(s.observe().levelsCompleted,2);
});
test('arbitrary level order, invalid selection, Reset and Restart preserve the campaign contract',()=>{
 const specs=['a','b','c'].map(id=>goalFixture(id).spec),s=new TrioPuzzleSession(specs);s.selectLevel(3);finish(s);assert.equal(s.observe().level,1);assert.equal(s.observe().levelsCompleted,1);s.action(4);const before=s.observe();
 for(const bad of [0,4,1.5,NaN]){assert.throws(()=>s.selectLevel(bad));assert.deepEqual(s.observe(),before);}
 const reset=s.reset();assert.equal(reset.level,1);assert.equal(reset.levelsCompleted,1);assert.equal(reset.canUndo,false);const restart=s.restart();assert.equal(restart.level,1);assert.equal(restart.levelsCompleted,0);assert.equal(restart.canUndo,false);
});
test('every initial room is validated before a new campaign replaces an existing session',()=>{
 const good={id:'good',title:'Good',rows:['WTZggg']},fatal={id:'fatal',title:'Fatal',rows:['Z~WTggg'],circuits:[{id:'a',buttons:[p(6,0)]}],gates:[{at:p(0,0),circuit:'a',direction:'E',closedWhen:'released'}],platforms:[{at:p(1,0),circuit:'a',activeWhen:'pressed'}]};
 let s=new TrioPuzzleSession([good]);s.nextHero();const before=s.observe();assert.throws(()=>{s=new TrioPuzzleSession([good,fatal]);},/Initial piston circuit/);assert.deepEqual(s.observe(),before);
});
test('author selection cycles correctly to all three roles and metrics separate their actions',()=>{
 const f=fixture({stones:[[3,2],[3,6],[1,10]]}),a=new Author(f.spec);a.select('thief');assert.equal(a.hero.kind,'thief');a.select('wizard');assert.equal(a.hero.kind,'wizard');a.select('warrior');assert.equal(a.hero.kind,'warrior');assert.throws(()=>a.select('merchant'),/Unknown hero kind/);
 const r=replay(f.spec,'RCRCR');assert.equal(r.metrics.swaps,1);assert.equal(r.metrics.stoneSwaps,1);assert.equal(r.metrics.warriorPushes,1);assert.equal(r.metrics.thiefPulls,1);assert.equal(r.metrics.selections,2);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 const next=decodeCommand('C',{...f.state,active:2});assert.equal(next.id,6);assert.deepEqual(next.data,p(9,21));
});

test('Wizard exchanges the first aligned crate and walks only when the ray has no target',()=>{
 const f=fixture({Z:[3,4],stones:[[5,4],[8,4]]}),before=select(f.world,f.state,'wizard'),d=stepDetailed(f.world,before,4);
 assert.equal(d.phases[0].kind,'swap');assert.deepEqual(role(d.state,'wizard').at,p(5,4));assert.deepEqual(d.state.stones,[p(3,4),p(8,4)]);assert.equal(d.state.active,2);
 const walk=stepDetailed(f.world,d.state,1);assert.equal(walk.phases[0].kind,'walk');assert.deepEqual(role(walk.state,'wizard').at,p(5,3));
 const frames=transitionFrames(f.world,before,d.state,4);assert.equal(frames.length,3);assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
 const session=new TrioPuzzleSession([f.spec]);session.nextHero();session.nextHero();const selected=session.observe(),o=session.action(4);assert.deepEqual(o.frameDurationsMs,[70,90,0]);assert.deepEqual(session.undo(),selected);
});
test('Wizard exchanges either companion across water and never invokes the transferred companion power',()=>{
 for(const [char,kind] of [['W','warrior'],['T','thief']]){
  const f=fixture({Z:[3,4],[char]:[9,4],water:[[4,4],[5,4],[6,4],[7,4],[8,4]],stones:[[2,4],[10,4]]}),d=act(f,'wizard',4);
  assert.deepEqual(role(d.state,'wizard').at,p(9,4));assert.deepEqual(role(d.state,kind).at,p(3,4));assert.deepEqual(d.state.stones,f.state.stones);assert.equal(d.state.dead,false);assert.equal(d.state.active,2);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);assert.equal(d.phases[0].moves.length,2);
 }
});
test('Wizard ray crosses water and relays through two white mirror faces',()=>{
 const f=fixture({Z:[3,3],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=select(f.world,f.state,'wizard'),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
 assert.equal(plan.reflections,2);assert.deepEqual(plan.to,p(5,1));assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(role(d.state,'wizard').at,p(5,1));assert.deepEqual(d.state.stones,[p(3,3)]);assert.equal(transitionFrames(f.world,before,d.state,4).length,3);
 assert.deepEqual(d.phases[0].paths[0],[p(3,3),...plan.path]);
});
test('every mirror face turns only its two accepted Wizard arrival directions',()=>{
 const configurations={NE:{S:'E',W:'N'},NW:{S:'W',E:'N'},SE:{N:'E',W:'S'},SW:{N:'W',E:'S'}};
 const v={N:p(0,-1),S:p(0,1),W:p(-1,0),E:p(1,0)},id={N:1,S:2,W:3,E:4};
 for(const [facing,turns] of Object.entries(configurations))for(const direction of ['N','S','W','E']){
  const delta=v[direction],from=[10-2*delta.x,10-2*delta.y],out=turns[direction];
  const target=out?[10+2*v[out].x,10+2*v[out].y]:[10+2*delta.x,10+2*delta.y];
  const f=fixture({Z:from,stones:[target],mirrors:[[10,10,facing]]}),before=select(f.world,f.state,'wizard'),plan=planSwap(f.world,before,direction),d=stepDetailed(f.world,before,id[direction]);
  if(out){assert.equal(plan.reflections,1);assert.deepEqual(plan.to,p(...target));assert.equal(d.phases[0].kind,'swap');}
  else{assert.equal(plan,null);assert.equal(d.phases[0].kind,'walk');assert.deepEqual(d.state.stones,f.state.stones);assert.equal(stepDetailed(f.world,d.state,id[direction]).state.failed,true);}
 }
});
test('walls, closed doors and presses stop Wizard targeting; an adjacent mirror is never pushed or exchanged',()=>{
 for(const extra of [
  {walls:[[5,4]]},
  {buttons:[[15,15]],doors:[[5,4]]},
  {circuits:[{id:'closed',buttons:[p(15,15)]}],gates:[{at:p(5,4),circuit:'closed',direction:'E',closedWhen:'released'}]},
  {mirrors:[[5,4,'NE']]},
 ]){
  const f=fixture({Z:[3,4],stones:[[8,4]],...extra}),before=select(f.world,f.state,'wizard');assert.equal(planSwap(f.world,before,'E'),null);
  const walked=stepDetailed(f.world,before,4),refused=stepDetailed(f.world,walked.state,4);assert.equal(walked.phases[0].kind,'walk');assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.stones,f.state.stones);assert.deepEqual(refused.state.mirrors,f.state.mirrors);
 }
});
test('submerged supports never become swap targets or movable crates',()=>{
 const f=fixture({Z:[3,4],supports:[[4,4],[5,4]],stones:[[7,4]]}),before=select(f.world,f.state,'wizard'),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
 assert.deepEqual(plan.to,p(7,4));assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.state.stones,[p(3,4)]);
 const walking=fixture({Z:[3,4],supports:[[4,4],[5,4]]}),walk=act(walking,'wizard',4);assert.equal(walk.phases[0].kind,'walk');assert.deepEqual(role(walk.state,'wizard').at,p(4,4));assert.deepEqual(walk.state.supports,walking.state.supports);
});
test('atomic swaps conserve both button weights and keep their shared door and press open',()=>{
 const f=fixture({Z:[3,4],stones:[[8,4]],circuits:[{id:'relay',buttons:[p(3,4),p(8,4)],color:15}],doors:[[12,4]],gates:[{at:p(12,8),circuit:'relay',direction:'S',closedWhen:'released'}]}),d=act(f,'wizard',4);
 assert.equal(circuitPressed(f.world,f.state,'relay'),true);assert.equal(circuitPressed(f.world,d.state,'relay'),true);assert.deepEqual(d.state.gateClosed,[false]);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);assert.equal(d.state.failed,false);
});
test('Wizard monster swap resolves simultaneous combat after transport and preserves a distant companion',()=>{
 const f=fixture({Z:[3,8],monsters:[[8,8],[3,7]]}),before=select(f.world,f.state,'wizard'),d=stepDetailed(f.world,before,4);
 assert.equal(d.state.dead,false);assert.deepEqual(role(d.state,'wizard').at,p(8,8));assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);assert.deepEqual(role(d.state,'warrior').at,role(f.state,'warrior').at);
});
test('a monster swap can kill an inactive companion in the same simultaneous attack wave',()=>{
 const f=fixture({Z:[3,4],W:[3,3],monsters:[[9,4]]}),d=act(f,'wizard',4);
 assert.equal(d.state.dead,true);assert.equal(role(d.state,'warrior').dead,true);assert.equal(role(d.state,'wizard').dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);
});
test('presses and global reflection move the Wizard without recursively casting a visible spell',()=>{
 const pressed=fixture({Z:[8,10],stones:[[12,10]],circuits:[{id:'a',buttons:[p(3,6)]}],gates:[{at:p(8,10),circuit:'a',direction:'E',closedWhen:'pressed'}]}),a=act(pressed,'warrior',4);
 assert.deepEqual(role(a.state,'wizard').at,p(9,10));assert.deepEqual(a.state.stones,pressed.state.stones);assert.deepEqual(a.phases.map(p=>p.kind),['walk','piston']);
 const reflected=fixture({Z:[6,4],stones:[[12,6]],mirrors:[[6,6,'NE']]}),b=act(reflected,'wizard',5);
 assert.deepEqual(role(b.state,'wizard').at,p(8,6));assert.deepEqual(b.state.stones,reflected.state.stones);assert.deepEqual(b.phases.map(p=>p.kind),['reflect']);
});
test('Wizard arrows and ACTION5 retain distinct targeting and transport semantics',()=>{
 const f=fixture({Z:[3,3],stones:[[7,1]],mirrors:[[7,3,'NW']]}),before=select(f.world,f.state,'wizard'),spell=stepDetailed(f.world,before,4),global=stepDetailed(f.world,before,5);
 assert.equal(spell.phases[0].kind,'swap');assert.deepEqual(role(spell.state,'wizard').at,p(7,1));assert.deepEqual(spell.state.stones,[p(3,3)]);
 assert.equal(global.phases[0].kind,'reflect');assert.deepEqual(role(global.state,'wizard').at,p(3,3));assert.deepEqual(global.state.stones,[p(5,3)]);assert.equal(global.state.active,2);
});
test('a returning Wizard ray animates every turn and two pulses without moving or adding repeated Undo snapshots',()=>{
 const f=fixture({Z:[4,4],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),before=select(f.world,f.state,'wizard'),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
 assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.equal(d.state.failed,true);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.mirrors,before.mirrors);
 assert.equal(trace.loopPath.filter(p=>f.state.mirrors.some(m=>eq(m.at,p))).length,4);assert.equal(frames.length,9);
 const px=cellToPixel(role(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][px.y+1][px.x+1]),[0,15,0,15]);
 for(const frame of frames)for(const mirror of f.state.mirrors){const at=cellToPixel(mirror.at);assert.equal(frame[at.y+1][at.x+1],0);}
 const session=new TrioPuzzleSession([f.spec]);session.nextHero();session.nextHero();const selected=session.observe(),first=session.action(1);assert.deepEqual(first.frameDurationsMs,[90,90,90,90,100,100,80,100,0]);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});
test('replay metrics count actual mirror traversals even when swap endpoints remain aligned',()=>{
 const f=fixture({Z:[3,3],stones:[[3,7]],mirrors:[[7,3,'NW'],[7,1,'SW'],[1,1,'SE'],[1,7,'NE']]}),r=replay(f.spec,'CCR');
 assert.equal(r.state.failed,false);assert.deepEqual(role(r.state,'wizard').at,p(3,7));assert.equal(r.metrics.swaps,1);assert.equal(r.metrics.stoneSwaps,1);assert.equal(r.metrics.partnerSwaps,0);assert.equal(r.metrics.bentSwaps,1);assert.equal(r.metrics.multiMirrorSwaps,1);assert.equal(r.metrics.swapReflections,4);
 const hero=fixture({Z:[3,4],W:[9,4]}),h=replay(hero.spec,'CCR');assert.equal(h.metrics.partnerSwaps,1);assert.equal(h.metrics.bentSwaps,0);
 const monster=fixture({Z:[3,4],monsters:[[9,4]]}),m=replay(monster.spec,'CCR');assert.equal(m.metrics.monsterSwaps,1);
 const loop=fixture({Z:[4,4],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),l=replay(loop.spec,'CCU');assert.equal(l.metrics.swapLoops,1);assert.equal(l.metrics.swaps,0);assert.equal(l.metrics.blocked,1);
});
test('Author.go stays within ordinary Wizard walking and cannot silently solve an island with a spell',()=>{
 const wall=Array.from({length:18},(_,i)=>[5,i+1]),f=fixture({Z:[3,4],stones:[[8,4]],water:wall}),a=new Author(f.spec);
 a.go(3,3,'wizard');assert.deepEqual(a.hero.at,p(3,3));assert.throws(()=>a.go(8,4),/No walking route/);assert.deepEqual(a.hero.at,p(3,3));
 a.go(3,4);a.act('R');assert.deepEqual(a.hero.at,p(8,4));
});
test('solver swap ablations are behavioral restrictions and exhaustive impossibility is explicit',()=>{
 const f=fixture({Z:[3,4],stones:[[8,4]],water:Array.from({length:18},(_,i)=>[5,i+1])}),start=select(f.world,f.state,'wizard'),goal=s=>eq(role(s,'wizard').at,p(8,4));
 const options={start,goal,disableSelection:true,disableReflections:true,disablePartnerSwaps:true,maxStates:5000,maxMs:2000};
 const solved=solve(f.spec,options);assert.equal(solved.status,'solved');assert.equal(solved.commands,'R');
 for(const option of ['disableSwaps','disableStoneSwaps']){const blocked=solve(f.spec,{...options,[option]:true});assert.equal(blocked.status,'unsolvable');}
});
