import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,QuartetPuzzleSession,planReflection,cellToPixel,PALETTE,GRID,circuitPressed,inSongRange,planSwap,traceSwap} from '../dist/core.js';

const p=(x,y)=>({x,y}),eq=(a,b)=>a.x===b.x&&a.y===b.y;
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const select=(w,s,kind)=>stepWorld(w,s,6,cellToPixel(hero(s,kind).at));
const places=s=>({heroes:s.heroes.map(h=>({kind:h.kind,at:h.at,dead:!!h.dead})),stones:s.stones,monsters:s.monsters,supports:s.supports,mirrors:s.mirrors,gateClosed:s.gateClosed,platformActive:s.platformActive});
function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y===19?'#':'.'));
 for(const [key,char] of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const [x,y] of o[key]??[])rows[y][x]=char;
 for(const [x,y] of o.goals??[[17,2],[17,7],[17,12],[17,17]])rows[y][x]='g';
 for(const [kind,def] of [['M',[2,2]],['T',[2,17]],['Z',[2,7]],['B',[2,12]]]){const [x,y]=o[kind]??def;rows[y][x]=kind;}
 const spec={id:o.id??'fixture',title:'Merchant–Thief–Wizard–Bard fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:p(x,y),facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
 const world=compileLevel(spec),state=initialState(world);return{spec,world,state};
}
const act=(f,kind,id)=>stepDetailed(f.world,select(f.world,f.state,kind),id);
const arrival=id=>fixture({id,goals:[[3,2],[3,7],[3,12],[3,17]]});
const finish=session=>{for(let i=0;i<3;i++){session.action(4);session.nextHero();}return session.action(4);};

test('SS24 compiles exactly M/T/Z/B and four goals, with Merchant selected and colors 12/14/15/6',()=>{
 const f=fixture(),o=new QuartetPuzzleSession([f.spec]).observe();assert.deepEqual(f.world.heroes.map(h=>h.kind),['merchant','thief','wizard','bard']);assert.equal(f.state.active,0);assert.equal(o.gameCode,'SS24');assert.equal(f.world.goals.length,4);assert.ok(Object.isFrozen(f.world));assert.deepEqual(GRID,{cells:20,cellPx:3,originPx:2,canvasPx:64});assert.equal(PALETTE.length,16);
 for(const [kind,color] of [['merchant',12],['thief',14],['wizard',15],['bard',6]]){const at=cellToPixel(hero(f.state,kind).at);assert.equal(o.frame[at.y+1][at.x+1],color);}
 assert.deepEqual(compileLevel({...f.spec,mode:'quartet'}),f.world);
 for(const rows of [['MTZBggg'],['MZBgggg'],['MMZBgggg'],['TZBgggg'],['MTZBggggg']])assert.throws(()=>compileLevel({...f.spec,rows}),/one Merchant, one Thief, one Wizard, one Bard and four destinations/);
 for(const mode of ['trio','duo','solo',null,0])assert.throws(()=>compileLevel({...f.spec,mode}),/Invalid hero mode/);
 assert.throws(()=>compileLevel({...f.spec,rows:['MTZBWgggg']}),/Unknown tile/);
});

test('map centering and circuit/device validation remain strict',()=>{
 const w=compileLevel({id:'small',title:'Small',rows:['BZTMgggg']});assert.deepEqual(w.heroes.map(h=>h.at),[p(9,9),p(8,9),p(7,9),p(6,9)]);
 assert.throws(()=>compileLevel({id:'ragged',title:'Ragged',rows:['MTZBgggg','...']}));
 assert.throws(()=>fixture({mirrors:[[2,2,'NE']]}));assert.throws(()=>fixture({mirrors:[[3,3,'BAD']]}));
 assert.throws(()=>fixture({gates:[{at:p(3,3),circuit:'absent',direction:'E',closedWhen:'pressed'}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)],color:16}]}));
 assert.throws(()=>fixture({circuits:[{id:'a',buttons:[p(4,4)]}],platforms:[{at:p(6,6),circuit:'a',activeWhen:'pressed'}]}));
});

test('selection cycles all four roles without moving or ticking adjacent monsters',()=>{
 const f=fixture({monsters:[[3,2]]}),session=new QuartetPuzzleSession([f.spec]),initial=session.observe();
 assert.deepEqual(session.action(6,cellToPixel(f.state.heroes[0].at)),initial);assert.equal(session.observe().canUndo,false);
 for(let i=1;i<=4;i++){const before=session.observe(),after=session.nextHero();assert.equal(after.state,'NOT_FINISHED');assert.equal(after.levelsCompleted,0);assert.equal(after.canUndo,true);assert.notDeepEqual(after.frame,before.frame);}
 assert.deepEqual(session.observe().frame,initial.frame);session.undo();session.undo();session.undo();assert.deepEqual(session.undo(),initial);
 for(const kind of ['merchant','thief','wizard','bard']){const d=stepDetailed(f.world,f.state,6,cellToPixel(hero(f.state,kind).at));assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.phases,[]);assert.equal(d.state.heroes[d.state.active].kind,kind);}
});

test('public observations expose only palette-indexed frames and the session contract',()=>{
 const f=fixture(),session=new QuartetPuzzleSession([f.spec]),views=[session.observe(),session.action(4),session.nextHero(),session.action(1),session.undo()];
 assert.deepEqual(Object.keys(views[0]).sort(),['availableActionIds','canSelectLevel','canUndo','defaultFps','frame','frames','gameCode','level','levelCount','levelsCompleted','palette','state'].sort());
 for(const o of views){assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);for(const frame of o.frames){assert.equal(frame.length,64);assert.ok(frame.every(r=>r.length===64&&r.every(n=>Number.isInteger(n)&&n>=0&&n<16)));}if(o.frameDurationsMs){assert.equal(o.frameDurationsMs.length,o.frames.length);assert.equal(o.frameDurationsMs.at(-1),0);assert.ok(o.frameDurationsMs.every(n=>Number.isFinite(n)&&n>=0));}}
});

test('malformed actions and invalid selections never mutate a session',()=>{
 const f=fixture(),session=new QuartetPuzzleSession([f.spec]),before=session.observe();
 for(const action of [0,7,1.5,NaN])assert.throws(()=>session.action(action));
 for(const at of [undefined,p(-1,3),p(64,3),p(3.5,4),p(3,NaN)])assert.throws(()=>session.action(6,at));
 for(const level of [0,2,1.5,NaN])assert.throws(()=>session.selectLevel(level));
 assert.deepEqual(session.observe(),before);assert.deepEqual(session.action(6,p(0,0)),before);
});

test('Merchant pushes one crate in every direction and refuses every two-piece file',()=>{
 for(const [id,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
  const f=fixture({M:[8,8],stones:[[8+dx,8+dy]]}),d=act(f,'merchant',id);assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'merchant').at,p(8+dx,8+dy));assert.deepEqual(d.state.stones,[p(8+2*dx,8+2*dy)]);assert.equal(d.phases[0].kind,'push');assert.equal(d.phases[0].moves.length,2);
  const chain=fixture({M:[8,8],stones:[[8+dx,8+dy],[8+2*dx,8+2*dy]]}),pushed=act(chain,'merchant',id);assert.equal(pushed.state.failed,true);assert.deepEqual(places(pushed.state),places(chain.state));assert.deepEqual(pushed.phases,[]);
 }
});

test('Merchant pushes each companion without triggering their song, pull or exchange',()=>{
 for(const [char,kind] of [['T','thief'],['Z','wizard'],['B','bard']]){
  const f=fixture({M:[4,4],[char]:[5,4],stones:[[10,4],[5,2]],supports:[[5,3]],water:[[6,3]]}),d=act(f,'merchant',4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(6,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['push']);
 }
});

test('a Merchant refuses an occupied landing and never drowns a partner or mirror voluntarily',()=>{
 for(const extra of [{Z:[5,4],stones:[[6,4]],walls:[[7,4]]},{B:[5,4],Z:[6,4],walls:[[7,4]]},{mirrors:[[5,4,'NE']],water:[[6,4]]},{Z:[5,4],water:[[6,4]]},{B:[5,4],water:[[6,4]]},{stones:[[5,4]],walls:[[6,4]]}]){
  const f=fixture({M:[4,4],...extra}),d=act(f,'merchant',4);assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 }
 const f=fixture({M:[4,4],mirrors:[[5,4,'NW']]}),d=act(f,'merchant',4);assert.deepEqual(d.state.mirrors,[{at:p(6,4),facing:'NW'}]);assert.equal(d.phases[0].kind,'push');
});

test('a Merchant creates an immersed support; a later crate remains mobile on it',()=>{
 const f=fixture({M:[4,4],stones:[[5,4]],water:[[6,4]]}),first=act(f,'merchant',4);assert.deepEqual(first.state.supports,[p(6,4)]);assert.deepEqual(first.state.stones,[]);
 const next={...first.state,heroes:first.state.heroes.map(h=>h.kind==='merchant'?{...h,at:p(4,4)}:h),stones:[p(5,4)]},second=stepDetailed(f.world,next,4);assert.deepEqual(second.state.supports,[p(6,4)]);assert.deepEqual(second.state.stones,[p(6,4)]);assert.equal(second.state.dead,false);
 const monster=fixture({M:[4,4],monsters:[[5,4]],water:[[6,4]]}),d=act(monster,'merchant',4);assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.state.supports,[]);
});

test('all four heroes reject voluntary unsupported water, including inactive hydraulic cells',()=>{
 for(const [char,kind,y] of [['M','merchant',2],['T','thief',17],['Z','wizard',7],['B','bard',12]])for(const hydraulic of [false,true]){
  const f=fixture({[char]:[2,y],water:[[3,y]],...(hydraulic?{circuits:[{id:'a',buttons:[p(14,14)]}],platforms:[{at:p(3,y),circuit:'a',activeWhen:'pressed'}]}:{})}),d=act(f,kind,4);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 }
});

test('Bard carries all three partners and cargo in the pre-move square, including diagonals across walls',()=>{
 const f=fixture({M:[8,8],T:[9,9],Z:[9,6],B:[7,7],stones:[[5,5],[9,5]],walls:[[6,5]]}),d=act(f,'bard',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'merchant').at,p(9,8));assert.deepEqual(hero(d.state,'thief').at,p(10,9));assert.deepEqual(hero(d.state,'wizard').at,p(10,6));assert.deepEqual(hero(d.state,'bard').at,p(8,7));assert.deepEqual(d.state.stones,[p(5,5),p(10,5)]);
 assert.equal(inSongRange(p(7,7),p(9,5)),true);assert.equal(inSongRange(p(7,7),p(10,7)),false);
 const across=fixture({B:[7,7],stones:[[7,5]],walls:[[7,6]]}),song=act(across,'bard',4);assert.deepEqual(song.state.stones,[p(8,5)]);assert.equal(song.phases[0].kind,'song');
});

test('sung Merchant, Thief and Wizard do not activate their own push, pull or exchange',()=>{
 for(const [char,kind] of [['M','merchant'],['T','thief'],['Z','wizard']]){
  const f=fixture({B:[4,8],[char]:[6,8],stones:[[7,8],[12,8]]}),d=act(f,'bard',4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(6,8));assert.deepEqual(hero(d.state,'bard').at,p(5,8));assert.deepEqual(d.state.stones,f.state.stones);
 }
 const f=fixture({B:[5,8],Z:[3,8],stones:[[2,8],[12,8]]}),d=act(f,'bard',4);assert.deepEqual(hero(d.state,'wizard').at,p(4,8));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['song']);
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
 for(const kind of ['merchant','thief','wizard']){
  const f=fixture({B:[7,7],supports:[[8,6],[9,6]]}),before={...select(f.world,f.state,'bard'),heroes:f.state.heroes.map(h=>h.kind===kind?{...h,at:p(8,6)}:h)},d=stepDetailed(f.world,before,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,kind).at,p(9,6));assert.ok(d.state.supports.some(q=>eq(q,p(8,6))));assert.ok(d.state.supports.some(q=>eq(q,p(9,6))));
 }
});

test('a song cannot drown any companion or remove a mirror support',()=>{
 for(const [char,kind] of [['M','merchant'],['T','thief'],['Z','wizard']])for(const hydraulic of [false,true]){
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

test('Thief pulls only the immediately rear occupant in every direction, never its whole file',()=>{
 for(const [id,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
  const f=fixture({T:[8,8],stones:[[8-dx,8-dy],[8-2*dx,8-2*dy]]}),d=act(f,'thief',id);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'thief').at,p(8+dx,8+dy));
  assert.deepEqual(new Set(d.state.stones.map(q=>`${q.x},${q.y}`)),new Set([p(8,8),p(8-2*dx,8-2*dy)].map(q=>`${q.x},${q.y}`)));
  assert.equal(d.phases[0].kind,'pull');assert.equal(d.phases[0].moves.length,2);assert.equal(d.state.active,1);
 }
});

test('Thief cannot push from the front and a refused forward step never pulls',()=>{
 for(const extra of [{stones:[[7,8],[9,8]]},{stones:[[7,8]],walls:[[9,8]]},{stones:[[7,8]],water:[[9,8]]}]){
  const f=fixture({T:[8,8],...extra}),d=act(f,'thief',4);assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 }
 const distant=fixture({T:[8,8],stones:[[12,8]]}),walk=act(distant,'thief',4);assert.deepEqual(hero(walk.state,'thief').at,p(9,8));assert.deepEqual(walk.state.stones,distant.state.stones);assert.equal(walk.phases[0].kind,'walk');
});

test('Thief pulls any companion without invoking its push, exchange or song',()=>{
 for(const [char,kind] of [['M','merchant'],['Z','wizard'],['B','bard']]){
  const f=fixture({T:[5,5],[char]:[4,5],stones:[[3,5],[4,3]],supports:[[3,3]]}),d=act(f,'thief',4);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'thief').at,p(6,5));assert.deepEqual(hero(d.state,kind).at,p(5,5));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['pull']);
 }
});

test('Thief pulls a mirror without rotating it and cannot pull an immersed support',()=>{
 const f=fixture({T:[8,8],mirrors:[[7,8,'NW']]}),d=act(f,'thief',4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.mirrors,[{at:p(8,8),facing:'NW'}]);assert.equal(d.phases[0].kind,'pull');
 const support=fixture({T:[8,8],supports:[[7,8]]}),walk=act(support,'thief',4);assert.deepEqual(walk.state.supports,support.state.supports);assert.equal(walk.phases[0].kind,'walk');
});

test('Thief can pull a mobile crate across an immersed support without extracting that support',()=>{
 const f=fixture({T:[8,7],stones:[[7,8]],supports:[[8,8]]});
 const before={...select(f.world,f.state,'thief'),heroes:f.state.heroes.map(h=>h.kind==='thief'?{...h,at:p(8,8)}:h)},first=stepDetailed(f.world,before,4),second=stepDetailed(f.world,first.state,4);
 assert.equal(first.state.failed,false);assert.deepEqual(first.state.stones,[p(8,8)]);assert.deepEqual(first.state.supports,[p(8,8)]);
 assert.equal(second.state.failed,false);assert.deepEqual(second.state.stones,[p(9,8)]);assert.deepEqual(second.state.supports,[p(8,8)]);
});

test('Thief leaves cargo behind by departing sideways and replaces its own button weight when pulling',()=>{
 const f=fixture({T:[8,8],stones:[[7,8]],circuits:[{id:'a',buttons:[p(8,8)]}],water:[[15,5]],platforms:[{at:p(15,5),circuit:'a',activeWhen:'pressed'}]});
 const side=act(f,'thief',1);assert.deepEqual(side.state.stones,f.state.stones);assert.equal(side.phases[0].kind,'walk');assert.deepEqual(side.state.platformActive,[false]);
 const pull=act(f,'thief',4);assert.deepEqual(pull.state.stones,[p(8,8)]);assert.equal(circuitPressed(f.world,pull.state,'a'),true);assert.deepEqual(pull.state.platformActive,[true]);assert.deepEqual(pull.phases.map(p=>p.kind),['pull']);
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
 assert.equal(d.state.failed,false);assert.equal(d.state.active,3);assert.deepEqual(hero(d.state,'wizard').at,p(8,6));assert.deepEqual(hero(d.state,'bard').at,p(6,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});

test('a blocked farther reflected arrival cannot veto a nearer valid one',()=>{
 const f=fixture({Z:[10,9],stones:[[13,10]],walls:[[10,7]],mirrors:[[10,10,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,p(11,10));
 const blocked=fixture({Z:[10,9],stones:[[13,10]],walls:[[11,10]],mirrors:[[10,10,'NE']]}),r=act(blocked,'merchant',5);assert.equal(r.state.failed,true);assert.deepEqual(r.blockedMirrorIndices,[0]);assert.deepEqual(places(r.state),places(blocked.state));
});

test('multiple mirrors refuse incompatible destinations and conflicting destinations without cloning',()=>{
 const sameLanding=fixture({M:[6,4],Z:[10,4],mirrors:[[6,6,'NE'],[10,6,'NW']]}),d=act(sameLanding,'merchant',5);assert.equal(d.state.failed,true);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(places(d.state),places(sameLanding.state));
 const sameSource=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[4,4,'SE']]}),r=act(sameSource,'merchant',5);assert.equal(r.state.failed,true);assert.deepEqual(r.blockedMirrorIndices,[0,1]);assert.equal(r.state.heroes.length,4);assert.deepEqual(places(r.state),places(sameSource.state));
});

test('forced reflection into water drowns any hero, whereas a crate becomes an immersed support',()=>{
 for(const char of ['M','T','Z','B']){
  const f=fixture({[char]:[6,4],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.equal(d.state.heroes.filter(h=>h.dead).length,1);
 }
 const f=fixture({stones:[[6,4]],water:[[8,6]],mirrors:[[6,6,'NE']]}),d=act(f,'merchant',5);assert.equal(d.state.dead,false);assert.deepEqual(d.state.supports,[p(8,6)]);assert.deepEqual(d.state.stones,[]);
});

test('walls, doors and closed presses flash the projecting mirror twice without a new Undo entry',()=>{
 for(const obstacle of [{walls:[[8,6]]},{buttons:[[14,14]],doors:[[8,6]]},{circuits:[{id:'a',buttons:[p(14,14)]}],gates:[{at:p(8,6),circuit:'a',direction:'E',closedWhen:'released'}]}]){
  const f=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[16,1,'NE']],monsters:[[3,2]],...obstacle}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[0]);assert.deepEqual(d.phases,[]);assert.equal(d.state.dead,false);assert.deepEqual(places(d.state),places(f.state));
  const session=new QuartetPuzzleSession([f.spec]),before=session.observe(),warning=session.action(5),at=cellToPixel(p(6,6)),other=cellToPixel(p(16,1));assert.deepEqual(warning.frameDurationsMs,[110,70,110,0]);assert.deepEqual(warning.frames.map(f=>f[at.y+2][at.x]),[8,5,8,5]);assert.deepEqual(warning.frames.map(f=>f[at.y+1][at.x+1]),[0,0,0,0]);assert.deepEqual(warning.frames.map(f=>f[other.y+2][other.x]),[5,5,5,5]);assert.deepEqual(warning.frame,before.frame);assert.equal(warning.canUndo,false);assert.deepEqual(session.action(5),warning);assert.deepEqual(session.undo(),before);
 }
});

test('an intervening mirror warns on its black back and retains every white diagonal pixel',()=>{
 const f=fixture({Z:[6,4],mirrors:[[6,6,'NE'],[7,6,'SE']]}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[1]);
 const session=new QuartetPuzzleSession([f.spec]),warning=session.action(5),at=cellToPixel(p(7,6));assert.deepEqual(warning.frames.map(f=>f[at.y][at.x]),[8,5,8,5]);assert.deepEqual(warning.frames.map(f=>f[at.y][at.x+2]),[0,0,0,0]);assert.equal(warning.canUndo,false);
});

test('every independently blocked mirror warns and a valid third transfer is not partially applied',()=>{
 const f=fixture({M:[4,3],Z:[12,3],B:[8,12],walls:[[6,5],[14,5]],mirrors:[[4,5,'NE'],[12,5,'NE'],[8,14,'NE']]}),d=stepDetailed(f.world,f.state,5);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(places(d.state),places(f.state));assert.deepEqual(d.phases,[]);
 const session=new QuartetPuzzleSession([f.spec]),warning=session.action(5);for(const [i,m] of f.state.mirrors.entries()){const at=cellToPixel(m.at);assert.deepEqual(warning.frames.map(f=>f[at.y+2][at.x]),i<2?[8,5,8,5]:[5,5,5,5]);}
});

test('a reflection refused by later door closure warns and leaves the entire earlier world intact',()=>{
 const f=fixture({M:[5,4],stones:[[6,4]],circuits:[{id:'a',buttons:[p(6,4)]}],doors:[[5,5]],mirrors:[[6,6,'NE']]}),occupied=stepWorld(f.world,f.state,2),d=stepDetailed(f.world,occupied,5);assert.equal(planReflection(f.world,occupied).moves.length,1);assert.deepEqual(d.blockedMirrorIndices,[0]);assert.deepEqual(places(d.state),places(occupied));assert.deepEqual(d.phases,[]);
 const session=new QuartetPuzzleSession([f.spec]),initial=session.observe(),before=session.action(2),warning=session.action(5);assert.deepEqual(warning.frame,before.frame);assert.deepEqual(session.undo().frame,initial.frame);
});

test('a side press moves every role without invoking a push, exchange or song',()=>{
 for(const [char,kind] of [['M','merchant'],['T','thief'],['Z','wizard'],['B','bard']]){
  const controller=char==='M'?{Z:[3,3]}:{M:[3,3]},f=fixture({...controller,[char]:[10,8],stones:[[9,8],[10,6],[15,8]],circuits:[{id:'a',buttons:[p(4,3)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}]}),operator=char==='M'?'wizard':'merchant',d=act(f,operator,4);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,kind).at,p(11,8));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
 }
});

test('a press pushes a mixed train without invoking the companions’ abilities',()=>{
 const f=fixture({M:[3,3],T:[14,8],Z:[11,8],B:[12,8],stones:[[10,8]],mirrors:[[13,8,'NW']],circuits:[{id:'a',buttons:[p(4,3)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=act(f,'merchant',4);assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,[p(11,8)]);assert.deepEqual(hero(d.state,'wizard').at,p(12,8));assert.deepEqual(hero(d.state,'bard').at,p(13,8));assert.deepEqual(d.state.mirrors,[{at:p(14,8),facing:'NW'}]);assert.deepEqual(hero(d.state,'thief').at,p(15,8));assert.equal(d.phases[1].moves.length,5);
});

test('hydraulic activation resolves before a forced press landing and Undo restores the cascade',()=>{
 const f=fixture({B:[10,8],water:[[11,8]],circuits:[{id:'a',buttons:[p(3,2)]}],gates:[{at:p(10,8),circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:p(11,8),circuit:'a',activeWhen:'pressed'}]}),d=act(f,'merchant',4);assert.equal(d.state.dead,false);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(hero(d.state,'bard').at,p(11,8));assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','platform']);
 const session=new QuartetPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);assert.equal(after.frames.length,9);assert.deepEqual(session.undo(),before);
});

test('withdrawal of a platform can kill any distant inactive companion and is reversible',()=>{
 for(const [char,kind] of [['T','thief'],['Z','wizard'],['B','bard']]){
  const f=fixture({M:[3,2],[char]:[10,8],water:[[11,8]],circuits:[{id:'a',buttons:[p(3,2)]}],platforms:[{at:p(11,8),circuit:'a',activeWhen:'pressed'}]}),entered=stepWorld(f.world,select(f.world,f.state,kind),4),before=select(f.world,entered,'merchant'),d=stepDetailed(f.world,before,1);assert.equal(entered.dead,false);assert.equal(d.state.failed,false);assert.equal(d.state.dead,true);assert.equal(hero(d.state,kind).dead,true);
  const session=new QuartetPuzzleSession([f.spec]);session.action(6,cellToPixel(hero(f.state,kind).at));session.action(4);session.action(6,cellToPixel(hero(f.state,'merchant').at));const prior=session.observe();assert.equal(session.action(1).state,'GAME_OVER');assert.deepEqual(session.undo().frame,prior.frame);
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

test('walk, push, pull, swap and song expose exact durations and a clean final frame',()=>{
 for(const [options,roleId,expected] of [[{},0,[60,80,0]],[{stones:[[3,2]]},0,[60,80,0]],[{B:[7,7],stones:[[7,5]]},3,[60,80,0]],[{stones:[[5,7]]},2,[70,90,0]],[{T:[8,8],stones:[[7,8],[6,8]]},1,[60,80,0]]]){
  const f=fixture(options),session=new QuartetPuzzleSession([f.spec]);for(let i=0;i<roleId;i++)session.nextHero();const before=session.observe(),after=session.action(4);assert.deepEqual(after.frameDurationsMs,expected);assert.deepEqual(after.frames.at(-1),after.frame);assert.deepEqual(session.undo(),before);
 }
});

test('all four goals must be simultaneously occupied, including heroes previously parked there',()=>{
 const f=arrival('a'),session=new QuartetPuzzleSession([f.spec]);for(let i=0;i<3;i++){session.action(4);assert.equal(session.observe().levelsCompleted,0);session.nextHero();}assert.equal(session.action(4).state,'WIN');assert.equal(session.observe().levelsCompleted,1);assert.equal(session.undo().state,'NOT_FINISHED');assert.equal(session.observe().levelsCompleted,0);assert.equal(session.action(4).state,'WIN');
});

test('campaign transitions preserve all four identities and can be undone across levels',()=>{
 const a=arrival('a'),b=arrival('b'),session=new QuartetPuzzleSession([a.spec,b.spec]),transition=finish(session);assert.equal(transition.level,2);assert.equal(transition.levelsCompleted,1);assert.equal(transition.frames.length,4);assert.equal(transition.frameDurationsMs.at(-2),100);
 const back=session.undo();assert.equal(back.level,1);assert.equal(back.levelsCompleted,0);assert.equal(back.state,'NOT_FINISHED');assert.equal(session.action(4).level,2);assert.equal(finish(session).state,'WIN');assert.equal(session.observe().levelsCompleted,2);
});

test('arbitrary level order, Reset and Restart retain completed levels only where appropriate',()=>{
 const specs=['a','b','c'].map(id=>arrival(id).spec),session=new QuartetPuzzleSession(specs);session.selectLevel(3);finish(session);assert.equal(session.observe().level,1);assert.equal(session.observe().levelsCompleted,1);session.action(4);const before=session.observe();
 for(const n of [0,4,1.5,NaN]){assert.throws(()=>session.selectLevel(n));assert.deepEqual(session.observe(),before);}
 const reset=session.reset();assert.equal(reset.level,1);assert.equal(reset.levelsCompleted,1);assert.equal(reset.canUndo,false);const restart=session.restart();assert.equal(restart.level,1);assert.equal(restart.levelsCompleted,0);assert.equal(restart.canUndo,false);
});

test('every initial room is checked before accepting a new campaign',()=>{
 const good={id:'good',title:'Good',rows:['MTZBgggg']},fatal={id:'fatal',title:'Fatal',rows:['M~TZBgggg'],circuits:[{id:'a',buttons:[p(8,0)]}],gates:[{at:p(0,0),circuit:'a',direction:'E',closedWhen:'released'}],platforms:[{at:p(1,0),circuit:'a',activeWhen:'pressed'}]};
 let session=new QuartetPuzzleSession([good]);session.nextHero();const before=session.observe();assert.throws(()=>{session=new QuartetPuzzleSession([good,fatal]);},/Initial piston circuit/);assert.deepEqual(session.observe(),before);
});






test('four-button circuits count every hero and settle when any operator leaves',()=>{
 const f=fixture({M:[4,4],T:[8,4],Z:[4,8],B:[8,8],circuits:[{id:'all',buttons:[p(4,4),p(8,4),p(4,8),p(8,8)]}],gates:[{at:p(12,8),circuit:'all',direction:'E',closedWhen:'released'}]});
 assert.equal(circuitPressed(f.world,f.state,'all'),true);assert.deepEqual(f.state.gateClosed,[false]);
 for(const kind of ['merchant','thief','wizard','bard']){
  const d=act(f,kind,2);assert.equal(d.state.failed,false);assert.equal(circuitPressed(f.world,d.state,'all'),false);assert.deepEqual(d.state.gateClosed,[true]);assert.deepEqual(d.phases.map(q=>q.kind),['walk','gate']);
 }
});


test('Wizard exchanges the first aligned crate and walks only when the ray has no target',()=>{
 const f=fixture({Z:[3,4],stones:[[5,4],[8,4]]}),before=select(f.world,f.state,'wizard'),d=stepDetailed(f.world,before,4);
 assert.equal(d.phases[0].kind,'swap');assert.deepEqual(hero(d.state,'wizard').at,p(5,4));assert.deepEqual(d.state.stones,[p(3,4),p(8,4)]);assert.equal(d.state.active,2);
 const walk=stepDetailed(f.world,d.state,1);assert.equal(walk.phases[0].kind,'walk');assert.deepEqual(hero(walk.state,'wizard').at,p(5,3));
 const frames=transitionFrames(f.world,before,d.state,4);assert.equal(frames.length,3);assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
 const session=new QuartetPuzzleSession([f.spec]);session.nextHero();session.nextHero();const selected=session.observe(),o=session.action(4);assert.deepEqual(o.frameDurationsMs,[70,90,0]);assert.deepEqual(session.undo(),selected);
});
test('Wizard exchanges each companion across water and never invokes the transferred companion power',()=>{
 for(const [char,kind] of [['M','merchant'],['T','thief'],['B','bard']]){
  const f=fixture({Z:[3,4],[char]:[9,4],water:[[4,4],[5,4],[6,4],[7,4],[8,4]],stones:[[2,4],[10,4]]}),d=act(f,'wizard',4);
  assert.deepEqual(hero(d.state,'wizard').at,p(9,4));assert.deepEqual(hero(d.state,kind).at,p(3,4));assert.deepEqual(d.state.stones,f.state.stones);assert.equal(d.state.dead,false);assert.equal(d.state.active,2);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);assert.equal(d.phases[0].moves.length,2);
 }
});
test('Wizard ray crosses water and relays through two white mirror faces',()=>{
 const f=fixture({Z:[3,3],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=select(f.world,f.state,'wizard'),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
 assert.equal(plan.reflections,2);assert.deepEqual(plan.to,p(5,1));assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,p(5,1));assert.deepEqual(d.state.stones,[p(3,3)]);assert.equal(transitionFrames(f.world,before,d.state,4).length,3);
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
 const walking=fixture({Z:[3,4],supports:[[4,4],[5,4]]}),walk=act(walking,'wizard',4);assert.equal(walk.phases[0].kind,'walk');assert.deepEqual(hero(walk.state,'wizard').at,p(4,4));assert.deepEqual(walk.state.supports,walking.state.supports);
});
test('atomic swaps conserve both button weights and keep their shared door and press open',()=>{
 const f=fixture({Z:[3,4],stones:[[8,4]],circuits:[{id:'relay',buttons:[p(3,4),p(8,4)],color:15}],doors:[[12,4]],gates:[{at:p(12,8),circuit:'relay',direction:'S',closedWhen:'released'}]}),d=act(f,'wizard',4);
 assert.equal(circuitPressed(f.world,f.state,'relay'),true);assert.equal(circuitPressed(f.world,d.state,'relay'),true);assert.deepEqual(d.state.gateClosed,[false]);assert.deepEqual(d.phases.map(p=>p.kind),['swap']);assert.equal(d.state.failed,false);
});
test('Wizard monster swap resolves simultaneous combat after transport and preserves a distant companion',()=>{
 const f=fixture({Z:[3,8],B:[14,14],monsters:[[8,8],[3,7]]}),before=select(f.world,f.state,'wizard'),d=stepDetailed(f.world,before,4);
 assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,p(8,8));assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);assert.deepEqual(hero(d.state,'thief').at,hero(f.state,'thief').at);
});
test('a monster swap can kill an inactive companion in the same simultaneous attack wave',()=>{
 const f=fixture({Z:[3,4],T:[3,3],monsters:[[9,4]]}),d=act(f,'wizard',4);
 assert.equal(d.state.dead,true);assert.equal(hero(d.state,'thief').dead,true);assert.equal(hero(d.state,'wizard').dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);
});
test('presses and global reflection move the Wizard without recursively casting a visible spell',()=>{
 const pressed=fixture({Z:[8,10],stones:[[12,10]],circuits:[{id:'a',buttons:[p(3,17)]}],gates:[{at:p(8,10),circuit:'a',direction:'E',closedWhen:'pressed'}]}),a=act(pressed,'thief',4);
 assert.deepEqual(hero(a.state,'wizard').at,p(9,10));assert.deepEqual(a.state.stones,pressed.state.stones);assert.deepEqual(a.phases.map(p=>p.kind),['walk','piston']);
 const reflected=fixture({Z:[6,4],stones:[[12,6]],mirrors:[[6,6,'NE']]}),b=act(reflected,'wizard',5);
 assert.deepEqual(hero(b.state,'wizard').at,p(8,6));assert.deepEqual(b.state.stones,reflected.state.stones);assert.deepEqual(b.phases.map(p=>p.kind),['reflect']);
});
test('Wizard arrows and ACTION5 retain distinct targeting and transport semantics',()=>{
 const f=fixture({Z:[3,3],stones:[[7,1]],mirrors:[[7,3,'NW']]}),before=select(f.world,f.state,'wizard'),spell=stepDetailed(f.world,before,4),global=stepDetailed(f.world,before,5);
 assert.equal(spell.phases[0].kind,'swap');assert.deepEqual(hero(spell.state,'wizard').at,p(7,1));assert.deepEqual(spell.state.stones,[p(3,3)]);
 assert.equal(global.phases[0].kind,'reflect');assert.deepEqual(hero(global.state,'wizard').at,p(3,3));assert.deepEqual(global.state.stones,[p(5,3)]);assert.equal(global.state.active,2);
});
test('a returning Wizard ray animates every turn and two pulses without moving or adding repeated Undo snapshots',()=>{
 const f=fixture({Z:[4,4],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),before=select(f.world,f.state,'wizard'),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
 assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.equal(d.state.failed,true);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.mirrors,before.mirrors);
 assert.equal(trace.loopPath.filter(p=>f.state.mirrors.some(m=>eq(m.at,p))).length,4);assert.equal(frames.length,9);
 const px=cellToPixel(hero(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][px.y+1][px.x+1]),[0,15,0,15]);
 for(const frame of frames)for(const mirror of f.state.mirrors){const at=cellToPixel(mirror.at);assert.equal(frame[at.y+1][at.x+1],0);}
 const session=new QuartetPuzzleSession([f.spec]);session.nextHero();session.nextHero();const selected=session.observe(),first=session.action(1);assert.deepEqual(first.frameDurationsMs,[90,90,90,90,100,100,80,100,0]);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});


test('Wizard exchanges the Thief without pulling cargo behind the transported Thief',()=>{
 const f=fixture({Z:[4,8],T:[8,8],stones:[[9,8]]}),d=act(f,'wizard',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
 assert.deepEqual(hero(d.state,'wizard').at,p(8,8));assert.deepEqual(hero(d.state,'thief').at,p(4,8));
 assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(q=>q.kind),['swap']);
});

test('a Wizard with no forward target walks without pulling an immediately rear crate',()=>{
 const f=fixture({Z:[8,8],stones:[[7,8]]}),d=act(f,'wizard',4);
 assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'wizard').at,p(9,8));
 assert.deepEqual(d.state.stones,[p(7,8)]);assert.deepEqual(d.phases.map(q=>q.kind),['walk']);
});

test('Bard carries a Thief without extracting the rear crate outside the initial aura',()=>{
 const f=fixture({B:[5,8],T:[3,8],stones:[[2,8]]}),d=act(f,'bard',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
 assert.deepEqual(hero(d.state,'bard').at,p(6,8));assert.deepEqual(hero(d.state,'thief').at,p(4,8));
 assert.deepEqual(d.state.stones,[p(2,8)]);assert.deepEqual(d.phases.map(q=>q.kind),['song']);
});

test('Thief extracts Bard without singing nearby cargo or a free water support',()=>{
 const f=fixture({T:[5,8],B:[4,8],stones:[[3,8]],supports:[[4,6]],water:[[5,6]]}),d=act(f,'thief',4);
 assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
 assert.deepEqual(hero(d.state,'thief').at,p(6,8));assert.deepEqual(hero(d.state,'bard').at,p(5,8));
 assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.supports,f.state.supports);
 assert.deepEqual(d.phases.map(q=>q.kind),['pull']);
 const session=new QuartetPuzzleSession([f.spec]);session.nextHero();const before=session.observe(),after=session.action(4);
 assert.equal(after.frames.length,3);assert.deepEqual(after.frameDurationsMs,[60,80,0]);assert.deepEqual(session.undo(),before);
});
