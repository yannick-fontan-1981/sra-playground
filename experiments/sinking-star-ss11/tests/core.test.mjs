import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,DuoPuzzleSession,planReflection,planSwap,traceSwap,cellToPixel,PALETTE,GRID} from '../dist/core.js';

/** Small mechanics fixtures; no campaign solution or author solver is loaded. */
function fixture(o={}) {
  const width=14,height=10;
  const rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=(p,c)=>rows[p[1]][p[0]]=c;
  for(const [k,c] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[k]??[])put(p,c);
  put(o.W??[2,2],'W');put(o.Z??[2,6],'Z');for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:o.id??'fixture',title:'Guerrier et Magicien',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});return{spec,world,state,at};
}
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const wizard=(f,s=f.state)=>stepWorld(f.world,s,6,cellToPixel(hero(s,'wizard').at));

test('SS11 requires W=Warrior and Z=Wizard, in stable order, with 3px cells and colors8/15',()=>{
  const f=fixture(),session=new DuoPuzzleSession([f.spec]),o=session.observe();
  assert.deepEqual(f.world.heroes.map(h=>h.kind),['warrior','wizard']);assert.equal(o.gameCode,'SS11');assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);
  for(const [kind,color] of [['warrior',8],['wizard',15]]){const p=cellToPixel(hero(f.state,kind).at);assert.equal(o.frame[p.y+1][p.x+1],color);}
  for(const rows of [['Wgg'],['Zgg'],['WWgg'],['ZZgg'],['WZg'],['WZggg'],['MWgg']])assert.throws(()=>compileLevel({...f.spec,rows}));
});

test('selection adds no combat tick and a public observation contains no private plans',()=>{
  const f=fixture({monsters:[[3,2]]}),s=wizard(f),o=new DuoPuzzleSession([f.spec]).nextHero();
  assert.equal(s.dead,false);assert.equal(s.active,1);assert.deepEqual(s.heroes,f.state.heroes);
  for(const key of ['heroes','stones','mirrors','world','paths','phases','loopPath'])assert.equal(key in o,false);
});

test('Warrior pushes the complete mixed chain without casting for the forced Wizard',()=>{
  const f=fixture({Z:[3,2],stones:[[4,2],[1,2]],mirrors:[[5,2,'SE']]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assert.deepEqual(hero(d.state,'warrior').at,f.at(3,2));assert.deepEqual(hero(d.state,'wizard').at,f.at(4,2));
  assert.deepEqual(d.state.stones,[f.at(1,2),f.at(5,2)]);assert.deepEqual(d.state.mirrors,[{at:f.at(6,2),facing:'SE'}]);
  assert.deepEqual(d.phases.map(p=>p.kind),['push']);assert.equal(d.phases[0].moves.length,4);assert.equal(transitionFrames(f.world,f.state,d.state,4).length,3);
});

test('a blocked chain end refuses the whole move atomically',()=>{
  const f=fixture({Z:[3,2],stones:[[4,2],[5,2]],walls:[[6,2]]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,true);assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases,[]);
});

test('a pushed crate becomes a fixed water support before the forced Wizard steps over it',()=>{
  const f=fixture({Z:[3,2],stones:[[4,2]],water:[[5,2]]}),first=stepWorld(f.world,f.state,4),second=stepWorld(f.world,first,4);
  assert.deepEqual(first.supports,[f.at(5,2)]);assert.equal(first.stones.length,0);assert.equal(second.dead,false);assert.deepEqual(hero(second,'wizard').at,f.at(5,2));assert.deepEqual(second.supports,first.supports);
});

test('a voluntary Warrior chain cannot sacrifice its Wizard or a mirror into open water',()=>{
  for(const extra of [{Z:[4,2]},{mirrors:[[4,2,'NE']]}]){
    const f=fixture({stones:[[3,2]],water:[[5,2]],...extra}),d=stepDetailed(f.world,f.state,4);
    assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.state.mirrors,f.state.mirrors);assert.deepEqual(d.state.stones,f.state.stones);
  }
});

test('Wizard swaps the first target and walks when no target exists',()=>{
  const f=fixture({Z:[3,6],stones:[[5,6],[8,6]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.phases[0].kind,'swap');assert.deepEqual(hero(d.state,'wizard').at,f.at(5,6));assert.deepEqual(d.state.stones,[f.at(3,6),f.at(8,6)]);
  const walking=stepDetailed(f.world,d.state,1);assert.equal(walking.phases[0].kind,'walk');assert.deepEqual(hero(walking.state,'wizard').at,f.at(5,5));
});

test('a Wizard target ray traverses water and bends at each white mirror face',()=>{
  const f=fixture({Z:[3,3],W:[2,8],stones:[[5,1]],mirrors:[[7,3,'NW'],[7,1,'SW']],water:[[4,3],[5,3],[6,3]]}),before=wizard(f),plan=planSwap(f.world,before,'E'),d=stepDetailed(f.world,before,4);
  assert.equal(plan.reflections,2);assert.deepEqual(plan.to,f.at(5,1));assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(5,1));assert.deepEqual(d.state.stones,[f.at(3,3)]);assert.equal(transitionFrames(f.world,before,d.state,4).length,3);
});

test('a black mirror back stops targeting and the Wizard cannot push the mirror',()=>{
  const f=fixture({Z:[3,6],stones:[[8,6]],mirrors:[[5,6,'NE']]}),before=wizard(f);assert.equal(planSwap(f.world,before,'E'),null);
  const walk=stepWorld(f.world,before,4),refused=stepDetailed(f.world,walk,4);
  assert.deepEqual(hero(walk,'wizard').at,f.at(4,6));assert.equal(refused.state.failed,true);assert.deepEqual(refused.state.mirrors,f.state.mirrors);assert.deepEqual(refused.state.stones,f.state.stones);
});

test('forcing the Wizard by a lateral press never casts toward a visible crate',()=>{
  const f=fixture({Z:[4,5],stones:[[7,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.deepEqual(hero(d.state,'wizard').at,f.at(5,5));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});

test('Space reflects the nearest actor even when the farther arrival is blocked',()=>{
  const f=fixture({W:[6,3],Z:[2,8],stones:[[9,4]],mirrors:[[6,4,'NE'],[6,1,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,false);assert.equal(d.blockedMirrorIndices,undefined);assert.deepEqual(hero(d.state,'warrior').at,f.at(7,4));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});

test('obstruction blinks only the blocking mirror black backing red and does not add Undo',()=>{
  const f=fixture({W:[5,3],mirrors:[[5,5,'NE'],[6,5,'SE'],[11,1,'NE']]}),session=new DuoPuzzleSession([f.spec]),initial=session.observe(),view=session.action(5),pixel=cellToPixel(f.at(6,5));
  assert.deepEqual(view.frameDurationsMs,[110,70,110,0]);assert.deepEqual(view.frames.map(frame=>frame[pixel.y][pixel.x]),[8,5,8,5]);assert.deepEqual(view.frames.map(frame=>frame[pixel.y+1][pixel.x+1]),[0,0,0,0]);
  const diff=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(view.frames[0][y][x]!==initial.frame[y][x])diff.push([x,y]);
  assert.deepEqual(diff,[[pixel.x,pixel.y],[pixel.x+1,pixel.y],[pixel.x,pixel.y+1]]);assert.deepEqual(view.frame,initial.frame);assert.equal(view.canUndo,false);assert.deepEqual(session.action(5),view);
});

test('a returning Wizard ray illuminates all four mirrors then blinks twice at its origin',()=>{
  const f=fixture({Z:[4,4],W:[2,8],mirrors:[[4,2,'SE'],[10,2,'SW'],[10,7,'NW'],[4,7,'NE']]}),before=wizard(f),trace=traceSwap(f.world,before,'N'),d=stepDetailed(f.world,before,1),frames=transitionFrames(f.world,before,d.state,1);
  assert.equal(trace.loop,true);assert.equal(trace.plan,null);assert.deepEqual(d.phases.map(p=>p.kind),['swap-loop']);assert.deepEqual(d.state.heroes.map(h=>h.at),before.heroes.map(h=>h.at));
  assert.equal(trace.loopPath.filter(p=>f.state.mirrors.some(m=>m.at.x===p.x&&m.at.y===p.y)).length,4);assert.equal(frames.length,9);
  const p=cellToPixel(hero(before,'wizard').at);assert.deepEqual([5,6,7,8].map(i=>frames[i][p.y+1][p.x+1]),[0,15,0,15]);
  const session=new DuoPuzzleSession([f.spec]);session.nextHero();const selected=session.observe(),first=session.action(1);assert.deepEqual(session.action(1),first);assert.deepEqual(session.undo(),selected);
});

test('swapping a monster beside another resolves both attacks and preserves the safe Wizard',()=>{
  const f=fixture({Z:[3,6],monsters:[[8,6],[3,5]]}),before=wizard(f),d=stepDetailed(f.world,before,4);
  assert.equal(d.state.dead,false);assert.deepEqual(hero(d.state,'wizard').at,f.at(8,6));assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['swap','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});

test('Undo restores a mixed chain and a reciprocal hero swap, with public animations',()=>{
  const f=fixture({Z:[3,2],stones:[[4,2]]}),session=new DuoPuzzleSession([f.spec]),initial=session.observe();
  const push=session.action(4);assert.equal(push.frames.length,3);assert.deepEqual(session.undo(),initial);
  session.nextHero();const selected=session.observe(),swap=session.action(3);assert.equal(swap.frames.length,3);assert.deepEqual(session.undo(),selected);
});
