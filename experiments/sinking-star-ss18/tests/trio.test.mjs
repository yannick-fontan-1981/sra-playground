import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,TrioPuzzleSession,planReflection,planSwap,traceSwap,cellToPixel,PALETTE,GRID,circuitPressed,inSongRange} from '../dist/core.js';
import {decodeCommand,replay,solve,stateKey} from '../scripts/solver.mjs';
import {Author} from '../reference/author/author.mjs';

const p=(x,y)=>({x,y}),eq=(a,b)=>a.x===b.x&&a.y===b.y;
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(w,s,kind)=>stepWorld(w,s,6,cellToPixel(hero(s,kind).at));
const places=s=>({heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:s.stones,monsters:s.monsters,supports:s.supports,mirrors:s.mirrors,gateClosed:s.gateClosed,platformActive:s.platformActive});
function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y===19?'#':'.'));
 for(const [key,char] of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const [x,y] of o[key]??[])rows[y][x]=char;
 for(const [x,y] of o.goals??[[17,2],[17,7],[17,12]])rows[y][x]='g';
 for(const [kind,def] of [['M',[2,2]],['Z',[2,7]],['B',[2,12]]]){const [x,y]=o[kind]??def;rows[y][x]=kind;}
 const spec={id:o.id??'fixture',title:'Merchant–Wizard–Bard fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:p(x,y),facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
 const world=compileLevel(spec),state=initialState(world);return{spec,world,state};
}
const act=(f,kind,id)=>stepDetailed(f.world,select(f.world,f.state,kind),id);
const arrival=id=>fixture({id,goals:[[3,2],[3,7],[3,12]]});
const finish=session=>{session.action(4);session.nextHero();session.action(4);session.nextHero();return session.action(4);};

test('SS18 compiles exactly M/Z/B and three goals, with Merchant selected and colors 12/15/6',()=>{
 const f=fixture(),o=new TrioPuzzleSession([f.spec]).observe();assert.deepEqual(f.world.heroes.map(h=>h.kind),['merchant','wizard','bard']);assert.equal(f.state.active,0);assert.equal(o.gameCode,'SS18');assert.equal(f.world.goals.length,3);assert.ok(Object.isFrozen(f.world));assert.deepEqual(GRID,{cells:20,cellPx:3,originPx:2,canvasPx:64});assert.equal(PALETTE.length,16);
 for(const [kind,color] of [['merchant',12],['wizard',15],['bard',6]]){const at=cellToPixel(hero(f.state,kind).at);assert.equal(o.frame[at.y+1][at.x+1],color);}
 assert.deepEqual(compileLevel({...f.spec,mode:'trio'}),f.world);
 for(const rows of [['MZgg'],['MZBgg'],['MMZggg'],['ZBggg'],['MZBgggg']])assert.throws(()=>compileLevel({...f.spec,rows}),/one Merchant, one Wizard, one Bard and three destinations/);
 for(const mode of ['duo','solo',null,0])assert.throws(()=>compileLevel({...f.spec,mode}),/Invalid hero mode/);
 for(const char of ['W','T'])assert.throws(()=>compileLevel({...f.spec,rows:['MZ'+char+'ggg']}),/Unknown tile/);
});

test('map centering and circuit/device validation remain strict',()=>{
 const w=compileLevel({id:'small',title:'Small',rows:['BZMggg']});assert.deepEqual(w.heroes.map(h=>h.at),[p(9,9),p(8,9),p(7,9)]);
 assert.throws(()=>compileLevel({id:'ragged',title:'Ragged',rows:['MZBggg','...']}));
 assert.throws(()=>fixture({mirrors:[[2,2,'NE']]}));assert.throws(()=>fixture({mirrors:[[3,3,'BAD']]}));
 assert.throws(()=>fixture({gates:[{at:p(3,3),circuit:'absent',direction:'E',closedWhen:'pressed'}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)],color:16}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)]}],platforms:[{at:p(6,6),circuit:'a',activeWhen:'pressed'}]}));
});

test('selection cycles all three roles without moving or ticking adjacent monsters',()=>{
 const f=fixture({monsters:[[3,2]]}),session=new TrioPuzzleSession([f.spec]),initial=session.observe();
 assert.deepEqual(session.action(6,cellToPixel(f.state.heroes[0].at)),initial);assert.equal(session.observe().canUndo,false);
 for(let i=1;i<=3;i++){const before=session.observe(),after=session.nextHero();assert.equal(after.state,'NOT_FINISHED');assert.equal(after.levelsCompleted,0);assert.equal(after.canUndo,true);assert.notDeepEqual(after.frame,before.frame);}
 assert.deepEqual(session.observe().frame,initial.frame);session.undo();session.undo();assert.deepEqual(session.undo(),initial);
 for(const kind of ['merchant','wizard','bard']){const d=stepDetailed(f.world,f.state,6,cellToPixel(hero(f.state,kind).at));assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.phases,[]);assert.equal(d.state.heroes[d.state.active].kind,kind);}
});

test('public observations expose only palette-indexed frames and the session contract',()=>{
 const f=fixture(),session=new TrioPuzzleSession([f.spec]),views=[session.observe(),session.action(4),session.nextHero(),session.action(1),session.undo()];
 assert.deepEqual(Object.keys(views[0]).sort(),['availableActionIds','canSelectLevel','canUndo','defaultFps','frame','frames','gameCode','level','levelCount','levelsCompleted','palette','state'].sort());
 for(const o of views){assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);for(const frame of o.frames){assert.equal(frame.length,64);assert.ok(frame.every(r=>r.length===64&&r.every(n=>Number.isInteger(n)&&n>=0&&n<16)));}if(o.frameDurationsMs){assert.equal(o.frameDurationsMs.length,o.frames.length);assert.equal(o.frameDurationsMs.at(-1),0);assert.ok(o.frameDurationsMs.every(n=>Number.isFinite(n)&&n>=0));}}
});

test('malformed actions and invalid selections never mutate a session',()=>{
 const f=fixture(),session=new TrioPuzzleSession([f.spec]),before=session.observe();
 for(const action of [0,7,1.5,NaN])assert.throws(()=>session.action(action));
 for(const at of [undefined,p(-1,3),p(64,3),p(3.5,4),p(3,NaN)])assert.throws(()=>session.action(6,at));
 for(const level of [0,2,1.5,NaN])assert.throws(()=>session.selectLevel(level));
 assert.deepEqual(session.observe(),before);assert.deepEqual(session.action(6,p(0,0)),before);
});

test('Merchant pushes one crate in every direction and stops in front of a two-piece file',()=>{
 for(const [id,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
  const f=fixture({M:[8,8],stones:[[8+dx,8+dy]]}),d=act(f,'merchant',id);assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'merchant').at,p(8+dx,8+dy));assert.deepEqual(d.state.stones,[p(8+2*dx,8+2*dy)]);assert.equal(d.phases[0].kind,'push');assert.equal(d.phases[0].moves.length,2);
  const chain=fixture({M:[8,8],stones:[[8+dx,8+dy],[8+2*dx,8+2*dy]]}),blocked=act(chain,'merchant',id);assert.equal(blocked.state.failed,true);assert.deepEqual(places(blocked.state),places(chain.state));assert.deepEqual(blocked.phases,[]);
 }
});

test('Merchant pushes either partner without triggering their song or distant swap',()=>{
 for(const [char,kind] of [['Z','wizard'],['B','bard']]){
  const f=fixture({M:[4,4],[char]:[5,4],stones:[[10,4],[5,2]],supports:[[5,3]],water:[[6,3]]}),d=act(f,'merchant',4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(6,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['push']);
 }
});

test('a Merchant never pushes a mixed chain or destroys a partner or mirror voluntarily',()=>{
 for(const extra of [{Z:[5,4],stones:[[6,4]]},{B:[5,4],Z:[6,4]},{mirrors:[[5,4,'NE']],water:[[6,4]]},{Z:[5,4],water:[[6,4]]},{B:[5,4],water:[[6,4]]},{stones:[[5,4]],walls:[[6,4]]}]){
  const f=fixture({M:[4,4],...extra}),d=act(f,'merchant',4);assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 }
 const f=fixture({M:[4,4],mirrors:[[5,4,'NW']]}),d=act(f,'merchant',4);assert.deepEqual(d.state.mirrors,[{at:p(6,4),facing:'NW'}]);assert.equal(d.phases[0].kind,'push');
});

test('a Merchant creates an immersed support; a later crate remains mobile on it',()=>{
 const f=fixture({M:[4,4],stones:[[5,4]],water:[[6,4]]}),first=act(f,'merchant',4);assert.deepEqual(first.state.supports,[p(6,4)]);assert.deepEqual(first.state.stones,[]);
 const next={...first.state,heroes:first.state.heroes.map(h=>h.kind==='merchant'?{...h,at:p(4,4)}:h),stones:[p(5,4)]},second=stepDetailed(f.world,next,4);assert.deepEqual(second.state.supports,[p(6,4)]);assert.deepEqual(second.state.stones,[p(6,4)]);assert.equal(second.state.dead,false);
 const monster=fixture({M:[4,4],monsters:[[5,4]],water:[[6,4]]}),d=act(monster,'merchant',4);assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.state.supports,[]);
});

test('all three heroes reject voluntary unsupported water, including inactive hydraulic cells',()=>{
 for(const [char,kind,y] of [['M','merchant',2],['Z','wizard',7],['B','bard',12]])for(const hydraulic of [false,true]){
  const f=fixture({[char]:[2,y],water:[[3,y]],...(hydraulic?{circuits:[{id:'a',buttons:[p(14,14)]}],platforms:[{at:p(3,y),circuit:'a',activeWhen:'pressed'}]}:{})}),d=act(f,kind,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 }
});

test('Bard carries both partners and cargo in the pre-move square, including diagonals across walls',()=>{
 const f=fixture({M:[8,8],Z:[9,6],B:[7,7],stones:[[5,5],[9,5]],walls:[[6,5]]}),d=act(f,'bard',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'merchant').at,p(9,8));assert.deepEqual(hero(d.state,'wizard').at,p(10,6));assert.deepEqual(hero(d.state,'bard').at,p(8,7));assert.deepEqual(d.state.stones,[p(5,5),p(10,5)]);
 assert.equal(inSongRange(p(7,7),p(9,5)),true);assert.equal(inSongRange(p(7,7),p(10,7)),false);
 const across=fixture({B:[7,7],stones:[[7,5]],walls:[[7,6]]}),song=act(across,'bard',4);assert.deepEqual(song.state.stones,[p(8,5)]);assert.equal(song.phases[0].kind,'song');
});

test('sung Merchant and Wizard do not push or cast beyond the original aura',()=>{
 for(const [char,kind] of [['M','merchant'],['Z','wizard']]){
  const f=fixture({B:[4,8],[char]:[6,8],stones:[[7,8],[12,8]]}),d=act(f,'bard',4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(6,8));assert.deepEqual(hero(d.state,'bard').at,p(5,8));assert.deepEqual(d.state.stones,f.state.stones);
 }
 const f=fixture({B:[5,8],Z:[6,8],stones:[[12,8]]}),d=act(f,'bard',4);assert.deepEqual(hero(d.state,'wizard').at,p(7,8));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
});

test('blocked choir members stay put; a blocked Bard cancels every movement',()=>{
 const f=fixture({B:[7,7],stones:[[7,5],[6,6]],walls:[[8,5]]}),d=act(f,'bard',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[p(7,5),p(7,6)]);
 const blocked=fixture({B:[7,7],stones:[[7,5]],walls:[[8,7]]}),r=act(blocked,'bard',4);assert.equal(r.state.failed,true);assert.deepEqual(places(r.state),places(blocked.state));assert.deepEqual(r.phases,[]);
});

test('Bard cannot move a mirror or propagate movement through an occupant outside the aura',()=>{
 const f=fixture({B:[7,7],mirrors:[[8,7,'NE']],stones:[[7,5]]}),blocked=act(f,'bard',4);assert.equal(blocked.state.failed,true);assert.deepEqual(blocked.state.stones,f.state.stones);
 const free=act(f,'bard',1);assert.equal(free.state.failed,false);assert.deepEqual(free.state.mirrors,f.state.mirrors);
 const chain=fixture({B:[7,7],stones:[[8,5],[9,5],[10,5]]}),d=act(chain,'bard',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,chain.state.stones);assert.deepEqual(hero(d.state,'bard').at,p(8,7));
});

test('the song slides free supports only along water and anchors the Bard landing',()=>{
 const f=fixture({B:[7,7],supports:[[7,5],[8,5],[8,7]],water:[[9,5],[9,7]]}),d=act(f,'bard',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[p(8,5),p(9,5),p(8,7)]);assert.deepEqual(hero(d.state,'bard').at,p(8,7));
 const dry=fixture({B:[7,7],supports:[[7,5]]}),stay=act(dry,'bard',4);assert.deepEqual(stay.state.supports,dry.state.supports);
});

test('an occupied immersed support anchors each companion while the hero can cross to the next one',()=>{
 for(const kind of ['merchant','wizard']){
  const f=fixture({B:[7,7],supports:[[8,6],[9,6]]}),before={...select(f.world,f.state,'bard'),heroes:f.state.heroes.map(h=>h.kind===kind?{...h,at:p(8,6)}:h)},d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(9,6));assert.ok(d.state.supports.some(q=>eq(q,p(8,6))));assert.ok(d.state.supports.some(q=>eq(q,p(9,6))));
 }
});

test('a song cannot drown either companion or remove a mirror support',()=>{
 for(const [char,kind] of [['M','merchant'],['Z','wizard']])for(const hydraulic of [false,true]){
  const f=fixture({B:[7,7],[char]:[8,6],water:[[9,6]],stones:[[5,5]],...(hydraulic?{circuits:[{id:'a',buttons:[p(15,15)]}],platforms:[{at:p(9,6),circuit:'a',activeWhen:'pressed'}]}:{})}),before=select(f.world,f.state,'bard'),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(before));assert.deepEqual(d.phases,[]);
 }
 const f=fixture({B:[7,7],supports:[[7,5],[8,5]],water:[[9,5]],mirrors:[[4,4,'NW']]}),before={...select(f.world,f.state,'bard'),mirrors:[{at:p(7,5),facing:'NW'}]},d=stepDetailed(f.world,before,4);assert.equal(d.state.failed,true);assert.deepEqual(places(d.state),places(before));
});

test('a sung crate becomes a support while another crate later occupies it',()=>{
 const f=fixture({B:[7,7],stones:[[7,5],[8,5]],water:[[9,5]]}),first=act(f,'bard',4),second=stepDetailed(f.world,first.state,4);
 assert.equal(first.state.failed,false);assert.deepEqual(first.state.supports,[p(9,5)]);assert.deepEqual(first.state.stones,[p(8,5)]);assert.equal(second.state.failed,false);assert.deepEqual(second.state.stones,[p(9,5)]);assert.deepEqual(second.state.supports,[p(9,5)]);
});

test('song-induced monster combat is simultaneous, including a dying attacker',()=>{
 const safe=fixture({B:[5,8],monsters:[[6,6],[8,6]]}),before=select(safe.world,safe.state,'bard'),d=stepDetailed(safe.world,before,4);assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.phases.map(p=>p.kind),['song','combat']);assert.equal(transitionFrames(safe.world,before,d.state,4).length,8);
 const lethal=fixture({M:[9,6],B:[5,8],monsters:[[6,6],[8,6]]}),hit=act(lethal,'bard',4);assert.equal(hit.state.dead,true);assert.equal(hero(hit.state,'merchant').dead,true);assert.deepEqual(hit.state.monsters,[]);
});

test('Wizard exchanges the first aligned crate in every direction and walks with no target',()=>{
 for(const [id,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
  const f=fixture({Z:[8,8],stones:[[8+2*dx,8+2*dy],[8+5*dx,8+5*dy]]}),before=select(f.world,f.state,'wizard'),d=stepDetailed(f.world,before,id);assert.equal(d.phases[0].kind,'swap');assert.deepEqual(hero(d.state,'wizard').at,p(8+2*dx,8+2*dy));assert.ok(d.state.stones.some(q=>eq(q,p(8,8))));assert.ok(d.state.stones.some(q=>eq(q,p(8+5*dx,8+5*dy))));assert.equal(d.state.active,1);assert.equal(transitionFrames(f.world,before,d.state,id).length,3);
 }
 const f=fixture(),d=act(f,'wizard',4);assert.equal(d.phases[0].kind,'walk');assert.deepEqual(hero(d.state,'wizard').at,p(3,7));
});

test('Wizard exchanges either companion across water without invoking their ability',()=>{
 for(const [char,kind] of [['M','merchant'],['B','bard']]){
  const f=fixture({Z:[3,5],[char]:[10,5],water:[[4,5],[5,5],[6,5],[7,5],[8,5],[9,5]],stones:[[11,5],[10,3]],supports:[[9,3]]}),d=act(f,'wizard',4);assert.deepEqual(hero(d.state,'wizard').at,p(10,5));assert.deepEqual(hero(d.state,kind).at,p(3,5));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.equal(d.state.dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);
 }
});

test('Wizard rays cross water and relay through two white faces; black backs and supports are not targets',()=>{
 const f=fixture({Z:[3,3],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=select(f.world,f.state,'wizard'),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);assert.equal(plan.reflections,2);assert.deepEqual(plan.to,p(5,1));assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,p(5,1));assert.deepEqual(d.phases[0].paths[0],[p(3,3),...plan.path]);
 const black=fixture({Z:[3,5],supports:[[5,5]],mirrors:[[7,5,'NE']]}),s=select(black.world,black.state,'wizard');assert.equal(planSwap(black.world,s,'E'),null);const walk=stepWorld(black.world,s,4);assert.deepEqual(hero(walk,'wizard').at,p(4,5));assert.deepEqual(walk.supports,black.state.supports);
 const adjacent=fixture({Z:[6,5],mirrors:[[7,5,'NE']]}),refused=act(adjacent,'wizard',4);assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.mirrors,adjacent.state.mirrors);
});

test('a returning Wizard ray lights four mirrors and pulses without changing positions or ticking combat',()=>{
 const f=fixture({Z:[6,6],mirrors:[[6,3,'SE'],[12,3,'SW'],[12,10,'NW'],[6,10,'NE']],monsters:[[5,6]]}),before=select(f.world,f.state,'wizard'),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
 assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(places(d.state),places(before));assert.equal(d.state.dead,false);assert.equal(frames.length,9);
 const at=cellToPixel(hero(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][at.y+1][at.x+1]),[0,15,0,15]);
 const session=new TrioPuzzleSession([f.spec]);session.nextHero();const selected=session.observe(),first=session.action(1);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});

test('Wizard substitution preserves both weights of an AND circuit without a hydraulic pulse',()=>{
 const f=fixture({Z:[3,5],B:[10,5],circuits:[{id:'a',buttons:[p(3,5),p(10,5),p(2,2)]}],water:[[15,5]],platforms:[{at:p(15,5),circuit:'a',activeWhen:'pressed'}]}),d=act(f,'wizard',4);assert.equal(circuitPressed(f.world,d.state,'a'),true);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);assert.equal(d.state.dead,false);
});

test('Wizard swaps a monster into simultaneous combat while remaining safe',()=>{
 const f=fixture({Z:[3,7],monsters:[[10,7],[3,6]]}),d=act(f,'wizard',4);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,p(10,7));assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);
 const weight=fixture({Z:[3,7],monsters:[[10,7]],circuits:[{id:'a',buttons:[p(3,7)]}],gates:[{at:p(14,7),circuit:'a',direction:'E',closedWhen:'released'}]}),held=act(weight,'wizard',4);assert.equal(held.state.dead,false);assert.equal(held.state.monsters.length,1);assert.equal(circuitPressed(weight.world,held.state,'a'),true);assert.deepEqual(held.state.gateClosed,[false]);
});

test('global reflection chooses the nearest actor in every quadrant independently of the selected role',()=>{
 const arms={NE:[[0,-1],[1,0]],NW:[[0,-1],[-1,0]],SE:[[0,1],[1,0]],SW:[[0,1],[-1,0]]};
 for(const [facing,dirs] of Object.entries(arms))for(const arm of [0,1]){
  const n=dirs[arm],far=dirs[1-arm],from=[10+n[0],10+n[1]],to=p(10+far[0],10+far[1]);
  const f=fixture({Z:from,stones:[[10+3*far[0],10+3*far[1]]],mirrors:[[10,10,facing]]}),d=act(f,'bard',5);assert.equal(d.state.failed,false);assert.deepEqual(planReflection(f.world,f.state)?.moves,[{actor:'hero',from:p(...from),to}]);assert.deepEqual(hero(d.state,'wizard').at,to);assert.deepEqual(d.state.stones,f.state.stones);
 }
});

test('equal-distance reflected companions exchange without abilities or selection changes',()=>{
 const f=fixture({Z:[6,4],B:[8,6],stones:[[8,4],[12,6]],supports:[[7,4]],water:[[8,4]],mirrors:[[6,6,'NE']]}),before=select(f.world,f.state,'bard'),d=stepDetailed(f.world,before,5);
 assert.equal(d.state.failed,false);assert.equal(d.state.active,2);assert.deepEqual(hero(d.state,'wizard').at,p(8,6));assert.deepEqual(hero(d.state,'bard').at,p(6,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});

test('a blocked farther reflected arrival cannot veto a nearer valid one',()=>{
 const f=fixture({Z:[10,9],stones:[[13,10]],walls:[[10,7]],mirrors:[[10,10,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,p(11,10));
 const blocked=fixture({Z:[10,9],stones:[[13,10]],walls:[[11,10]],mirrors:[[10,10,'NE']]}),r=act(blocked,'merchant',5);assert.equal(r.state.failed,true);assert.deepEqual(r.blockedMirrorIndices,[0]);assert.deepEqual(places(r.state),places(blocked.state));
});

test('multiple mirrors refuse incompatible destinations and conflicting destinations without cloning',()=>{
 const sameLanding=fixture({M:[6,4],Z:[10,4],mirrors:[[6,6,'NE'],[10,6,'NW']]}),d=act(sameLanding,'merchant',5);assert.equal(d.state.failed,true);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(places(d.state),places(sameLanding.state));
 const sameSource=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[4,4,'SE']]}),r=act(sameSource,'merchant',5);assert.equal(r.state.failed,true);assert.deepEqual(r.blockedMirrorIndices,[0,1]);assert.equal(r.state.heroes.length,3);assert.deepEqual(places(r.state),places(sameSource.state));
});

test('forced reflection into water drowns any hero, whereas a crate becomes an immersed support',()=>{
 for(const char of ['M','Z','B']){
  const f=fixture({[char]:[6,4],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.equal(d.state.heroes.filter(h=>h.dead).length,1);
 }
 const f=fixture({stones:[[6,4]],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.dead,false);assert.deepEqual(d.state.supports,[p(8,6)]);assert.deepEqual(d.state.stones,[]);
});

test('walls, doors and closed presses flash the projecting mirror twice without a new Undo entry',()=>{
 for(const obstacle of [{walls:[[8,6]]},{buttons:[[14,14]],doors:[[8,6]]},{circuits:[{id:'a',buttons:[p(14,14)]}],gates:[{at:p(8,6),circuit:'a',direction:'E',closedWhen:'released'}]}]){
  const f=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[16,1,'NE']],monsters:[[3,2]],...obstacle}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[0]);assert.deepEqual(d.phases,[]);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));
  const session=new TrioPuzzleSession([f.spec]),before=session.observe(),warning=session.action(5),at=cellToPixel(p(6,6)),other=cellToPixel(p(16,1));assert.deepEqual(warning.frameDurationsMs,[110,70,110,0]);assert.deepEqual(warning.frames.map(f=>f[at.y+2][at.x]),[8,5,8,5]);assert.deepEqual(warning.frames.map(f=>f[at.y+1][at.x+1]),[0,0,0,0]);assert.deepEqual(warning.frames.map(f=>f[other.y+2][other.x]),[5,5,5,5]);assert.deepEqual(warning.frame,before.frame);assert.equal(warning.canUndo,false);assert.deepEqual(session.action(5),warning);assert.deepEqual(session.undo(),before);
 }
});

test('an intervening mirror warns on its black back and retains every white diagonal pixel',()=>{
 const f=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[7,6,'SE']]}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[1]);
 const session=new TrioPuzzleSession([f.spec]),warning=session.action(5),at=cellToPixel(p(7,6));assert.deepEqual(warning.frames.map(f=>f[at.y][at.x]),[8,5,8,5]);assert.deepEqual(warning.frames.map(f=>f[at.y][at.x+2]),[0,0,0,0]);assert.equal(warning.canUndo,false);
});

test('every independently blocked mirror warns and a valid third transfer is not partially applied',()=>{
 const f=fixture({M:[4,3],Z:[12,3],B:[8,12],walls:[[6,5],[14,5]],mirrors:[[4,5,'NE'],[12,5,'NE'],[8,14,'NE']]}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 const session=new TrioPuzzleSession([f.spec]),warning=session.action(5);for(const [i,m] of f.state.mirrors.entries()){const at=cellToPixel(m.at);assert.deepEqual(warning.frames.map(f=>f[at.y+2][at.x]),i<2?[8,5,8,5]:[5,5,5,5]);}
});

test('a reflection refused by later door closure warns and leaves the entire earlier world intact',()=>{
 const f=fixture({M:[5,4],stones:[[6,4]],circuits:[{id:'a',buttons:[p(6,4)]}],doors:[[5,5]],mirrors:[[6,6,'NE']]}),occupied=stepWorld(f.world,f.state,2),d=stepDetailed(f.world,occupied,5);assert.equal(planReflection(f.world,occupied).moves.length,1);assert.deepEqual(d.blockedMirrorIndices,[0]);assert.deepEqual(places(d.state),places(occupied));assert.deepEqual(d.phases,[]);
 const session=new TrioPuzzleSession([f.spec]),initial=session.observe(),before=session.action(2),warning=session.action(5);assert.deepEqual(warning.frame,before.frame);assert.deepEqual(session.undo().frame,initial.frame);
});

test('a side press moves every role without invoking a push, song or spell',()=>{
 for(const [char,kind] of [['M','merchant'],['Z','wizard'],['B','bard']]){
  const controller=char==='M'?{Z:[3,3]}:{M:[3,3]},f=fixture({...controller,[char]:[10,8],stones:[[10,6],[15,8]],circuits:[{id:'a',buttons:[p(4,3)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}]}),operator=char==='M'?'wizard':'merchant',d=act(f,operator,4);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,kind).at,p(11,8));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
 }
});

test('a press can push a mixed train even though the Merchant alone cannot',()=>{
 const f=fixture({M:[3,3],Z:[11,8],B:[12,8],stones:[[10,8]],mirrors:[[13,8,'NW']],circuits:[{id:'a',buttons:[p(4,3)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=act(f,'merchant',4);assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,[p(11,8)]);assert.deepEqual(hero(d.state,'wizard').at,p(12,8));assert.deepEqual(hero(d.state,'bard').at,p(13,8));assert.deepEqual(d.state.mirrors,[{at:p(14,8),facing:'NW'}]);assert.equal(d.phases[1].moves.length,4);
});

test('hydraulic activation resolves before a forced press landing and Undo restores the cascade',()=>{
 const f=fixture({B:[10,8],water:[[11,8]],circuits:[{id:'a',buttons:[p(3,2)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:p(11,8),circuit:'a',activeWhen:'pressed'}]}),d=act(f,'merchant',4);assert.equal(d.state.dead,false);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(hero(d.state,'bard').at,p(11,8));assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','platform']);
 const session=new TrioPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);assert.equal(after.frames.length,9);assert.deepEqual(session.undo(),before);
});

test('withdrawal of a platform can kill either distant inactive companion and is reversible',()=>{
 for(const [char,kind] of [['Z','wizard'],['B','bard']]){
  const f=fixture({M:[3,2],[char]:[10,8],water:[[11,8]],circuits:[{id:'a',buttons:[p(3,2)]}],platforms:[{at:p(11,8),circuit:'a',activeWhen:'pressed'}]}),entered=stepWorld(f.world,select(f.world,f.state,kind),4),before=select(f.world,entered,'merchant'),d=stepDetailed(f.world,before,1);assert.equal(entered.dead,false);assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.equal(hero(d.state,kind).dead,true);
  const session=new TrioPuzzleSession([f.spec]);session.action(6,cellToPixel(hero(f.state,kind).at));session.action(4);session.action(6,cellToPixel(hero(f.state,'merchant').at));const prior=session.observe();assert.equal(session.action(1).state,'GAME_OVER');assert.deepEqual(session.undo().frame,prior.frame);
 }
});

test('retracting a hydraulic platform turns its crate into a persistent support',()=>{
 const f=fixture({M:[8,8],Z:[3,2],stones:[[9,8]],water:[[10,8]],circuits:[{id:'a',buttons:[p(3,2)]}],platforms:[{at:p(10,8),circuit:'a',activeWhen:'pressed'}]}),pushed=act(f,'merchant',4);assert.deepEqual(pushed.state.stones,[p(10,8)]);assert.deepEqual(pushed.state.supports,[]);
 const withdrew=stepWorld(f.world,select(f.world,pushed.state,'wizard'),1);assert.deepEqual(withdrew.supports,[p(10,8)]);assert.deepEqual(withdrew.stones,[]);
 const raised=stepWorld(f.world,withdrew,2);assert.deepEqual(raised.platformActive,[true]);assert.deepEqual(raised.supports,[p(10,8)]);
});

test('buttons have opaque gray corners, pink arms and the circuit pixel above the aura',()=>{
 const f=fixture({B:[7,7],circuits:[{id:'violet',buttons:[p(5,5)],color:15}]}),frame=renderWorld(f.world,select(f.world,f.state,'bard')),at=cellToPixel(p(5,5));assert.deepEqual(frame.slice(at.y,at.y+3).map(r=>r.slice(at.x,at.x+3)),[[3,7,3],[7,15,7],[3,7,3]]);
});

test('a pure violet press has gray center open and black closed without blue or a button overlay',()=>{
 const f=fixture({circuits:[{id:'violet',buttons:[p(3,2)],color:15}],gates:[{at:p(8,8),circuit:'violet',direction:'E',closedWhen:'pressed'}]}),at=cellToPixel(p(8,8));
 for(const [s,center] of [[f.state,3],[stepWorld(f.world,f.state,4),5]]){const tile=renderWorld(f.world,s).slice(at.y,at.y+3).map(r=>r.slice(at.x,at.x+3));assert.equal(tile[1][1],center);assert.equal(tile.flat().includes(9),false);assert.notDeepEqual(tile,[[3,7,3],[7,15,7],[3,7,3]]);}
});

test('mirror diagonals and black backs remain above every circuit marking in all orientations',()=>{
 for(const face of ['NE','NW','SE','SW']){
  const f=fixture({mirrors:[[8,8,face]],circuits:[{id:'v',buttons:[p(8,8)],color:15}]}),at=cellToPixel(p(8,8)),frame=renderWorld(f.world,f.state);
  for(let y=0;y<3;y++)for(let x=0;x<3;x++){const diagonal=face==='NW'||face==='SE'?x+y===2:x===y,black=face==='NE'?y>x:face==='SW'?x>y:face==='NW'?x+y>2:x+y<2;if(diagonal)assert.equal(frame[at.y+y][at.x+x],0);else if(black)assert.equal(frame[at.y+y][at.x+x],5);}
 }
});

test('the Bard aura and moving submerged support advance by one pixel in each animation frame',()=>{
 const f=fixture({B:[7,7],supports:[[7,5]],water:[[8,5]]}),before=select(f.world,f.state,'bard'),d=stepDetailed(f.world,before,4),frames=transitionFrames(f.world,before,d.state,4),at=cellToPixel(p(7,7)),support=cellToPixel(p(7,5));assert.equal(frames.length,3);
 for(let i=0;i<3;i++){assert.equal(frames[i][at.y-6][at.x-6+i+1],6);assert.notEqual(frames[i][at.y-6][at.x-6],6);assert.equal(frames[i][support.y+1][support.x+i+1],13);}
 assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
});

test('walk, push, song and swap expose exact durations and a clean final frame',()=>{
 for(const [options,roleId,expected] of [[{},0,[60,80,0]],[{stones:[[3,2]]},0,[60,80,0]],[{B:[7,7],stones:[[7,5]]},2,[60,80,0]],[{stones:[[6,7]]},1,[70,90,0]]]){
  const f=fixture(options),session=new TrioPuzzleSession([f.spec]);for(let i=0;i<roleId;i++)session.nextHero();const before=session.observe(),after=session.action(4);assert.deepEqual(after.frameDurationsMs,expected);assert.deepEqual(after.frames.at(-1),after.frame);assert.deepEqual(session.undo(),before);
 }
});

test('all three goals must be simultaneously occupied, including heroes previously parked there',()=>{
 const f=arrival('a'),session=new TrioPuzzleSession([f.spec]);session.action(4);session.nextHero();session.action(4);assert.equal(session.observe().levelsCompleted,0);session.nextHero();assert.equal(session.action(4).state,'WIN');assert.equal(session.observe().levelsCompleted,1);assert.equal(session.undo().state,'NOT_FINISHED');assert.equal(session.observe().levelsCompleted,0);assert.equal(session.action(4).state,'WIN');
});

test('campaign transitions preserve all three identities and can be undone across levels',()=>{
 const a=arrival('a'),b=arrival('b'),session=new TrioPuzzleSession([a.spec,b.spec]),transition=finish(session);assert.equal(transition.level,2);assert.equal(transition.levelsCompleted,1);assert.equal(transition.frames.length,4);assert.equal(transition.frameDurationsMs.at(-2),100);
 const back=session.undo();assert.equal(back.level,1);assert.equal(back.levelsCompleted,0);assert.equal(back.state,'NOT_FINISHED');assert.equal(session.action(4).level,2);assert.equal(finish(session).state,'WIN');assert.equal(session.observe().levelsCompleted,2);
});

test('arbitrary level order, Reset and Restart retain completed levels only where appropriate',()=>{
 const specs=['a','b','c'].map(id=>arrival(id).spec),session=new TrioPuzzleSession(specs);session.selectLevel(3);finish(session);assert.equal(session.observe().level,1);assert.equal(session.observe().levelsCompleted,1);session.action(4);const before=session.observe();
 for(const n of [0,4,1.5,NaN]){assert.throws(()=>session.selectLevel(n));assert.deepEqual(session.observe(),before);}
 const reset=session.reset();assert.equal(reset.level,1);assert.equal(reset.levelsCompleted,1);assert.equal(reset.canUndo,false);const restart=session.restart();assert.equal(restart.level,1);assert.equal(restart.levelsCompleted,0);assert.equal(restart.canUndo,false);
});

test('every initial room is checked before accepting a new campaign',()=>{
 const good={id:'good',title:'Good',rows:['MZBggg']},fatal={id:'fatal',title:'Fatal',rows:['M~ZBggg'],circuits:[{id:'a',buttons:[p(6,0)]}],gates:[{at:p(0,0),circuit:'a',direction:'E',closedWhen:'released'}],platforms:[{at:p(1,0),circuit:'a',activeWhen:'pressed'}]};
 let session=new TrioPuzzleSession([good]);session.nextHero();const before=session.observe();assert.throws(()=>{session=new TrioPuzzleSession([good,fatal]);},/Initial piston circuit/);assert.deepEqual(session.observe(),before);
});

test('author selection and metrics distinguish Merchant pushes, Wizard swaps and Bard transport',()=>{
 const f=fixture({stones:[[3,2],[6,7],[2,14]]}),author=new Author(f.spec);author.select('bard');assert.equal(author.hero.kind,'bard');author.select('wizard');assert.equal(author.hero.kind,'wizard');author.select('merchant');assert.equal(author.hero.kind,'merchant');assert.throws(()=>author.select('thief'),/Unknown hero kind/);
 const r=replay(f.spec,'RCRCR');assert.equal(r.metrics.merchantPushes,1);assert.equal(r.metrics.swaps,1);assert.equal(r.metrics.stoneSwaps,1);assert.equal(r.metrics.songs,1);assert.equal(r.metrics.songStoneMoves,1);assert.equal(r.metrics.selections,2);assert.equal(r.metrics.blocked,0);assert.equal(r.metrics.deaths,0);
 assert.deepEqual(decodeCommand('C',{...f.state,active:2}),{id:6,data:p(9,9)});assert.notEqual(stateKey(f.state),stateKey(r.state));
});

test('author search reconstructs legal routes without leaking them through observations',()=>{
 const f=arrival('search'),start={...f.state,heroes:f.state.heroes.map(h=>h.kind==='merchant'?h:{...h,at:p(h.at.x+1,h.at.y)})},solution=solve(f.spec,{start,maxStates:100,maxMs:500,disableSelection:true});assert.equal(solution.status,'solved');assert.equal(solution.commands,'R');assert.equal(solution.state.complete,true);assert.equal('commands' in new TrioPuzzleSession([f.spec]).observe(),false);
});
