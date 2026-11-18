import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepDetailed,stepWorld,renderWorld,transitionFrames,planReflection,BardPuzzleSession,GRID,PALETTE} from '../dist/core.js';

function room({hero=[5,5],goal=[10,8],stones=[],monsters=[],supports=[],water=[],walls=[],buttons=[],mirrors=[],gates=[],circuits=[]}={}){
  const rows=Array.from({length:11},(_,y)=>Array.from({length:13},(_,x)=>x===0||x===12||y===0||y===10?'#':'.'));
  for(const [tiles,c] of [[water,'~'],[walls,'#'],[supports,'s'],[stones,'o'],[monsters,'m'],[buttons,'b']])for(const [x,y] of tiles)rows[y][x]=c;
  rows[goal[1]][goal[0]]='g';rows[hero[1]][hero[0]]='B';
  return {id:'fixture',title:'Fixture',rows:rows.map(r=>r.join('')),mirrors:mirrors.map(([x,y,facing])=>({at:{x,y},facing})),gates,circuits};
}
function setup(options){const spec=room(options),w=compileLevel(spec),s=initialState(w);return {spec,w,s,at:(x,y)=>({x:x+3,y:y+4})};}
const has=(points,p)=>points.some(q=>q.x===p.x&&q.y===p.y);
const deepFreeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))deepFreeze(v);}return x;};

test('Bard keeps the 64×64 sixteen-colour 3px-cell contract',()=>{
  const {w,s,at}=setup();const frame=renderWorld(w,s);
  assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);assert.equal(PALETTE[6],'#e03bca');
  assert.equal(frame.length,64);assert.ok(frame.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16)));
  const p=at(5,5);assert.equal(frame[3+p.y*3][3+p.x*3],6);
  assert.throws(()=>compileLevel({...room(),rows:['WWg']}),/Unknown tile/);
});
test('song covers the complete 5×5 square even across a wall; out-of-range crates stay',()=>{
  const {w,s,at}=setup({stones:[[3,3],[5,3],[8,5]],walls:[[5,4]]});
  const next=stepWorld(w,s,4);
  assert.deepEqual(next.hero,at(6,5));assert.ok(has(next.stones,at(4,3)));assert.ok(has(next.stones,at(6,3)));assert.ok(has(next.stones,at(8,5)));
});
test('a wall anchors one choir member without stopping the other members or Bard',()=>{
  const {w,s,at}=setup({stones:[[5,3],[5,7]],walls:[[6,3]]});const next=stepWorld(w,s,4);
  assert.ok(has(next.stones,at(5,3)));assert.ok(has(next.stones,at(6,7)));assert.deepEqual(next.hero,at(6,5));
});
test('a simultaneous convoy can enter cells vacated by its next member',()=>{
  const {w,s,at}=setup({stones:[[6,5],[7,5]]});const detail=stepDetailed(w,s,4);
  assert.deepEqual(detail.state.hero,at(6,5));assert.ok(has(detail.state.stones,at(7,5)));assert.ok(has(detail.state.stones,at(8,5)));assert.equal(detail.phases[0].moves.length,3);
});
test('anchored dependency propagates backwards and a blocked Bard cancels all movement',()=>{
  const {w,s}=setup({stones:[[6,5],[7,5],[4,3]],walls:[[8,5]]});const detail=stepDetailed(w,s,4);
  assert.equal(detail.state.failed,true);assert.deepEqual(detail.state.hero,s.hero);assert.deepEqual(detail.state.stones,s.stones);assert.equal(detail.phases.length,0);
});
test('a blocked Bard never advances combat or remote song',()=>{
  const {w,s}=setup({stones:[[4,3]],walls:[[6,5]],monsters:[[5,4]]});const next=stepWorld(w,s,4);
  assert.equal(next.dead,false);assert.equal(next.failed,true);assert.deepEqual(next.stones,s.stones);assert.deepEqual(next.monsters,s.monsters);
});
test('a stone moved into empty water becomes a brown/cyan platform',()=>{
  const {w,s,at}=setup({stones:[[5,3]],water:[[6,3]]});const next=stepWorld(w,s,4);
  assert.equal(next.stones.length,0);assert.ok(has(next.supports,at(6,3)));
  const f=renderWorld(w,next),p=at(6,3),x=2+p.x*3,y=2+p.y*3;
  assert.deepEqual(f.slice(y,y+3).map(r=>r.slice(x,x+3)),[[10,13,10],[13,10,13],[10,13,10]]);
});
test('submerged platforms slide on water, leaving their old cell as water',()=>{
  const {w,s,at}=setup({supports:[[5,3]],water:[[4,3],[6,3],[7,3]]});const next=stepWorld(w,s,4);
  assert.ok(has(next.supports,at(6,3)));assert.ok(!has(next.supports,at(5,3)));
  const f=renderWorld(w,next),p=at(5,3);assert.equal(f[3+p.y*3][3+p.x*3],9);
  const back=stepWorld(w,next,3);assert.ok(has(back.supports,at(5,3)));
});
test('a submerged platform cannot climb onto land',()=>{
  const {w,s}=setup({supports:[[5,3]]});const next=stepWorld(w,s,4);assert.deepEqual(next.supports,s.supports);assert.equal(next.failed,false);
});
test('the platform entered by the Bard is pinned for that step',()=>{
  const {w,s,at}=setup({supports:[[6,5]],water:[[7,5]]});const next=stepWorld(w,s,4);
  assert.deepEqual(next.hero,at(6,5));assert.deepEqual(next.supports,s.supports);assert.equal(next.dead,false);
});
test('the platform under the Bard remains in place when he steps away',()=>{
  const {w,s,at}=setup({hero:[4,5],supports:[[5,5]],water:[[6,5]]});
  const standing={...s,hero:at(5,5)};const next=stepWorld(w,standing,1);
  assert.deepEqual(next.hero,at(5,4));assert.deepEqual(next.supports,standing.supports);
});
test('walking into unsupported water cancels even otherwise valid choir movement',()=>{
  const {w,s}=setup({water:[[6,5]],stones:[[5,3]]});const next=stepWorld(w,s,4);
  assert.equal(next.failed,true);assert.equal(next.dead,false);assert.deepEqual(next.stones,s.stones);
});
test('an eligible monster follows the song and can drown',()=>{
  const {w,s}=setup({monsters:[[5,3]],water:[[6,3]]});const next=stepWorld(w,s,4);
  assert.equal(next.monsters.length,0);assert.equal(next.supports.length,0);assert.equal(next.dead,false);
});
test('combat remains simultaneous: two adjacent monsters both die and still attack the Bard',()=>{
  const {w,s}=setup({hero:[5,5],monsters:[[6,4],[7,4]],walls:[[6,3],[7,3]]});const next=stepWorld(w,s,1);
  assert.equal(next.monsters.length,0);assert.equal(next.dead,true);
});
test('song cannot pull a monster through a wall',()=>{
  const {w,s}=setup({monsters:[[5,3]],walls:[[6,3]]});const next=stepWorld(w,s,4);assert.deepEqual(next.monsters,s.monsters);
});

test('X reflects the nearest actor between the two white mirror arms without singing',()=>{
  const {w,s,at}=setup({hero:[5,3],stones:[[4,3]],mirrors:[[5,5,'NE']]});const plan=planReflection(w,s);
  assert.equal(plan.moves.length,1);assert.deepEqual(plan.moves[0].to,at(7,5));
  const next=stepWorld(w,s,5);assert.deepEqual(next.hero,at(7,5));assert.deepEqual(next.stones,s.stones);
});
test('mirror backs ignore actors',()=>{
  const {w,s}=setup({hero:[5,7],mirrors:[[5,5,'NE']]});assert.equal(planReflection(w,s),null);assert.equal(stepWorld(w,s,5).failed,true);
});
test('reflection swaps two actors simultaneously at equal distance',()=>{
  const {w,s,at}=setup({hero:[5,3],stones:[[7,5]],mirrors:[[5,5,'NE']]});const next=stepWorld(w,s,5);
  assert.deepEqual(next.hero,at(7,5));assert.ok(has(next.stones,at(5,3)));assert.equal(next.failed,false);
});
test('a blocked destination arm cancels every mirror in the room atomically',()=>{
  const {w,s}=setup({hero:[5,3],stones:[[2,3]],mirrors:[[5,5,'NE'],[2,5,'NE']],walls:[[7,5]]});
  assert.equal(planReflection(w,s),null);const next=stepWorld(w,s,5);assert.equal(next.failed,true);assert.deepEqual(next.stones,s.stones);assert.deepEqual(next.hero,s.hero);
});
test('the solo Bard cannot be duplicated by two mirrors',()=>{
  const {w,s}=setup({hero:[5,3],mirrors:[[5,5,'NE'],[3,3,'SE']]});assert.equal(planReflection(w,s),null);
});
test('a reflected stone becomes a platform, and reflecting the Bard into open water is fatal',()=>{
  const fixture=setup({hero:[2,7],stones:[[5,3]],mirrors:[[5,5,'NE']],water:[[7,5]]});
  const next=stepWorld(fixture.w,fixture.s,5);assert.equal(next.stones.length,0);assert.ok(has(next.supports,fixture.at(7,5)));
  const {w,s}=setup({hero:[5,3],mirrors:[[5,5,'NE']],water:[[7,5]]});assert.equal(stepWorld(w,s,5).dead,true);
});
test('underwater platforms are not mirrored',()=>{
  const {w,s}=setup({hero:[2,7],supports:[[5,3]],mirrors:[[5,5,'NE']]});assert.equal(planReflection(w,s),null);
});
test('reflection previews distinguish the light-gray Bard cross from a crate square',()=>{
  const {w,s,at}=setup({hero:[5,3],mirrors:[[5,5,'NE']]});const f=renderWorld(w,s),p=at(7,5),x=2+p.x*3,y=2+p.y*3;
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[2,1],[1,2]])assert.equal(f[y+dy][x+dx],1);
  for(const [dx,dy] of [[0,0],[2,0],[0,2],[2,2]])assert.notEqual(f[y+dy][x+dx],1);
  const crate=setup({hero:[2,7],stones:[[5,3]],mirrors:[[5,5,'NE']]});
  assert.deepEqual(renderWorld(crate.w,crate.s).slice(y,y+3).map(r=>r.slice(x,x+3)),[[1,1,1],[1,3,1],[1,1,1]]);
});
test('ordinary song has no square destination preview and advances by 1/2/3 pixels',()=>{
  const {w,s,at}=setup({stones:[[5,3]]});const after=stepWorld(w,s,4),frames=transitionFrames(w,s,after,4);
  assert.equal(frames.length,3);assert.deepEqual(frames[2],renderWorld(w,after));
  const p=at(5,3),x=2+p.x*3,y=2+p.y*3;
  assert.equal(frames[0][y+1][x+2],5);assert.equal(frames[1][y+1][x+3],5);assert.equal(frames[2][y+1][x+4],5);
  assert.ok(!renderWorld(w,s).flat().includes(1));
});
test('reflection animation includes gray transfer markers and an exact final frame',()=>{
  const {w,s}=setup({hero:[5,3],mirrors:[[5,5,'NE']]});const after=stepWorld(w,s,5),frames=transitionFrames(w,s,after,5);
  assert.equal(frames.length,3);assert.ok(frames[0].flat().includes(10));assert.ok(frames[1].flat().includes(1));assert.deepEqual(frames[2],renderWorld(w,after));
});
test('transitions accept deeply frozen input and leave the original state intact',()=>{
  const {w,s}=setup({stones:[[5,3]]});const json=JSON.stringify(s);stepWorld(deepFreeze(w),deepFreeze(s),4);assert.equal(JSON.stringify(s),json);
});

test('a closing lateral press moves a remote crate and does not trigger another song',()=>{
  const {w,s,at}=setup({hero:[2,6],stones:[[8,3],[10,5]],buttons:[[3,6]],circuits:[{id:'press',buttons:[{x:3,y:6}]}],gates:[{at:{x:8,y:3},circuit:'press',direction:'E',closedWhen:'pressed'}]});
  const detail=stepDetailed(w,s,4);assert.ok(has(detail.state.stones,at(9,3)));assert.ok(has(detail.state.stones,at(10,5)));
  assert.equal(detail.phases.filter(p=>p.kind==='piston').length,1);assert.equal(transitionFrames(w,s,detail.state,4).length,6);
});
test('a press pushes an entire file into water; undo restores the platform, gate and file',()=>{
  const spec=room({hero:[2,6],stones:[[8,3],[9,3]],water:[[10,3]],buttons:[[3,6]],circuits:[{id:'press',buttons:[{x:3,y:6}]}],gates:[{at:{x:8,y:3},circuit:'press',direction:'E',closedWhen:'pressed'}]});
  const session=new BardPuzzleSession([spec]);const initial=session.observe();const after=session.action(4);
  assert.ok(after.frames.length>=6);assert.deepEqual(session.undo().frame,initial.frame);
  assert.deepEqual(session.action(4).frame,after.frame);assert.deepEqual(session.reset().frame,initial.frame);
});
test('session exposes directions plus reflection and rejects other actions',()=>{
  const session=new BardPuzzleSession([room()]);assert.deepEqual(session.observe().availableActionIds,[1,2,3,4,5]);assert.equal(session.observe().gameCode,'SS05');
  for(const action of [0,6,NaN,1.5])assert.throws(()=>session.action(action),RangeError);
});
test('WIN requires every room even when levels are selected out of order; undo crosses completion',()=>{
  const levels=[0,1,2].map(i=>({...room({hero:[5,5],goal:[6,5]}),id:`room${i}`}));const session=new BardPuzzleSession(levels);
  session.selectLevel(3);assert.equal(session.action(4).level,1);assert.equal(session.observe().levelsCompleted,1);
  assert.equal(session.action(4).level,2);const before=session.observe();assert.equal(session.action(4).state,'WIN');assert.deepEqual(session.undo().frame,before.frame);assert.equal(session.observe().levelsCompleted,2);
  session.action(4);const won=session.observe();assert.deepEqual(session.action(1).frame,won.frame);assert.equal(session.restart().levelsCompleted,0);
});
test('GAME_OVER disables further state changes and can be undone',()=>{
  const session=new BardPuzzleSession([room({hero:[5,3],mirrors:[[5,5,'NE']],water:[[7,5]]})]);const initial=session.observe();assert.equal(session.action(5).state,'GAME_OVER');const dead=session.observe();assert.deepEqual(session.action(1).frame,dead.frame);assert.deepEqual(session.undo().frame,initial.frame);
});
