import test from 'node:test';
import assert from 'node:assert/strict';
import {SS09_LEVELS} from '../dist/levels.js';
import {compileLevel,initialState,stepWorld,stepDetailed,renderWorld,transitionFrames,DuoPuzzleSession,planReflection,inSongRange,cellToPixel,PALETTE,GRID} from '../dist/core.js';

const eq=(a,b)=>a.x===b.x&&a.y===b.y;
function fixture(o={}) {
  const width=14,height=10,rows=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||y===0||x===width-1||y===height-1?'#':'.'));
  const put=(p,c)=>rows[p[1]][p[0]]=c;
  for(const [k,c] of [['water','~'],['walls','#'],['supports','s'],['stones','o'],['monsters','m'],['buttons','b'],['doors','D']])for(const p of o[k]??[])put(p,c);
  put(o.M??[2,2],'M');put(o.B??[2,6],'B');for(const p of o.goals??[[11,2],[11,6]])put(p,'g');
  const spec={id:o.id??'fixture',title:'Duo fixture',rows:rows.map(r=>r.join('')),facing:o.facing??'E',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:{x,y},facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
  const world=compileLevel(spec),state=initialState(world),at=(x,y)=>({x:x+3,y:y+5});return {spec,world,state,at};
}
const select=(w,s,index)=>stepWorld(w,s,6,cellToPixel(s.heroes[index].at));
const hero=(s,kind)=>s.heroes.find(h=>h.kind===kind);
const assertAt=(actual,expected)=>assert.deepEqual(actual,expected);

test('compiler centers exactly one Merchant, one Bard and two destinations',()=>{
  const f=fixture();assert.equal(f.world.heroes.length,2);assert.equal(f.world.goals.length,2);assert.equal(f.world.heroes[0].kind,'merchant');assert.equal(f.world.heroes[1].kind,'bard');assertAt(f.state.heroes[0].at,f.at(2,2));assert.equal(GRID.cellPx,3);assert.equal(PALETTE.length,16);assert.ok(Object.isFrozen(f.world));
});
test('compiler rejects missing roles, destinations, ragged maps and invalid devices',()=>{
  const f=fixture();assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replace('B','.'))}));assert.throws(()=>compileLevel({...f.spec,rows:f.spec.rows.map(r=>r.replaceAll('g','.'))}));assert.throws(()=>compileLevel({...f.spec,rows:['MBgg','...']}));assert.throws(()=>fixture({mirrors:[[2,2,'NE']]}));assert.throws(()=>fixture({mirrors:[[3,3,'BAD']]}));assert.throws(()=>fixture({gates:[{at:{x:3,y:3},direction:'E',closedWhen:'pressed',circuit:'absent'}]}));
});
test('SS09 rejects solo rooms and repeated roles instead of inventing a hidden companion',()=>{
  const f=fixture();
  for(const rows of [['B.g'],['M.g'],['BBgg'],['MMgg'],['MBg'],['MBggg']])assert.throws(()=>compileLevel({...f.spec,rows}),/one Merchant, one Bard and two destinations/);
  for(const mode of ['solo-bard','solo-warrior','unknown',null,0])assert.throws(()=>compileLevel({...f.spec,mode}),/Invalid hero mode/);
  assert.deepEqual(compileLevel({...f.spec,mode:'duo'}),f.world);
});
test('selecting the current hero or an empty pixel adds no world tick or Undo history',()=>{
  const f=fixture(),session=new DuoPuzzleSession([f.spec]),before=session.observe();
  assert.deepEqual(session.action(6,cellToPixel(f.state.heroes[0].at)),before);assert.deepEqual(session.action(6,{x:0,y:0}),before);assert.equal(session.observe().canUndo,false);
  session.action(4);const moved=session.observe();assert.deepEqual(session.action(6,{x:0,y:0}),moved);assert.deepEqual(session.undo(),before);
});
test('SS09 renders a magenta Bard and an orange Merchant in the public pixel image',()=>{
  const f=fixture(),session=new DuoPuzzleSession([f.spec]),o=session.observe();assert.equal(o.gameCode,'SS09');assert.equal(o.frame.flat().includes(6),true);assert.equal(o.frame.flat().includes(12),true);assert.equal(o.frame.flat().includes(8),false);
});
test('compiler accepts movable mirror digits with exact face mapping',()=>{
  const f=fixture();const rows=f.spec.rows.map((r,i)=>i===4?r.slice(0,4)+'1234'+r.slice(8):r);const w=compileLevel({...f.spec,rows});assert.deepEqual(w.mirrors.map(m=>m.facing),['NE','SE','SW','NW']);
});
test('ACTION6 selects by public pixels without ticking monsters or circuits',()=>{
  const f=fixture({monsters:[[3,2]]});const next=select(f.world,f.state,1);assert.equal(next.active,1);assert.equal(next.dead,false);assert.deepEqual(next.heroes,f.state.heroes);assert.deepEqual(next.stones,f.state.stones);assert.deepEqual(stepDetailed(f.world,f.state,6,cellToPixel(f.state.heroes[1].at)).phases,[]);
  assert.equal(stepWorld(f.world,next,6,{x:0,y:0}),next);
});
test('invalid action and click payloads are rejected without mutation',()=>{
  const f=fixture(),before=JSON.stringify(f.state);for(const a of [0,7,1.5,NaN])assert.throws(()=>stepWorld(f.world,f.state,a));for(const p of [undefined,{x:-1,y:3},{x:64,y:4},{x:2.2,y:4}])assert.throws(()=>stepWorld(f.world,f.state,6,p));assert.equal(JSON.stringify(f.state),before);
});
test('Merchant pushes exactly one stone directly with a direction',()=>{
  const f=fixture({stones:[[3,2]]}),d=stepDetailed(f.world,f.state,4);assertAt(hero(d.state,'merchant').at,f.at(3,2));assertAt(d.state.stones[0],f.at(4,2));assert.equal(d.phases[0].kind,'push');assert.equal(d.phases[0].moves.length,2);
});
test('Merchant refuses a contiguous two-stone file atomically',()=>{
  const f=fixture({stones:[[3,2],[4,2]]}),s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.deepEqual(s.stones,f.state.stones);assertAt(s.heroes[0].at,f.state.heroes[0].at);
});
test('Merchant can push one mirror and its orientation is preserved',()=>{
  const f=fixture({mirrors:[[3,2,'SE']]});const s=stepWorld(f.world,f.state,4);assert.deepEqual(s.mirrors,[{at:f.at(4,2),facing:'SE'}]);assertAt(hero(s,'merchant').at,f.at(3,2));
});
test('voluntary steps and pushes refuse unsupported water for both heroes and mirrors',()=>{
  for(const o of [{water:[[3,2]]},{mirrors:[[3,2,'SE']],water:[[4,2]]},{B:[3,2],water:[[4,2]]}]){const f=fixture(o),s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.equal(s.dead,false);assert.deepEqual(s.mirrors,f.state.mirrors);assert.deepEqual(s.heroes.map(h=>h.at),f.state.heroes.map(h=>h.at));}
});
test('a submerged stone supports Merchant walking without singing',()=>{
  const f=fixture({stones:[[3,2]],water:[[4,2]]});let s=stepWorld(f.world,f.state,4);s=stepWorld(f.world,s,4);assertAt(hero(s,'merchant').at,f.at(4,2));assert.deepEqual(s.supports,[f.at(4,2)]);assert.equal(s.dead,false);
});
test('a monster pushed into water drowns without creating a platform',()=>{
  const f=fixture({monsters:[[3,2]],water:[[4,2]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.monsters.length,0);assert.equal(s.supports.length,0);assert.equal(s.dead,false);
});
test('global reflection exchanges both heroes simultaneously and preserves selection',()=>{
  const f=fixture({M:[5,3],B:[7,5],mirrors:[[5,5,'NE']]});const plan=planReflection(f.world,f.state);assert.equal(plan.moves.length,2);const s=stepWorld(f.world,f.state,5);assertAt(hero(s,'merchant').at,f.at(7,5));assertAt(hero(s,'bard').at,f.at(5,3));assert.equal(s.active,0);assert.equal(s.failed,false);
});
test('Bard-selected ACTION5 uses the same global mirror operation',()=>{
  const f=fixture({M:[5,3],B:[7,5],mirrors:[[5,5,'NE']]});const a=stepWorld(f.world,f.state,5),b=stepWorld(f.world,select(f.world,f.state,1),5);assert.deepEqual(a.heroes,b.heroes);assert.equal(b.active,1);
});
test('each mirror reflects only its nearer front occupant on either arm in every quadrant',()=>{
  const arms={NE:[[0,-1],[1,0]],NW:[[0,-1],[-1,0]],SE:[[0,1],[1,0]],SW:[[0,1],[-1,0]]};
  for(const [facing,vectors] of Object.entries(arms))for(const nearArm of [0,1]){
    const near=vectors[nearArm],far=vectors[1-nearArm];
    const from=[6+near[0],4+near[1]],distant=[6+3*far[0],4+3*far[1]],to=[6+far[0],4+far[1]];
    const f=fixture({M:from,B:[2,8],stones:[distant],mirrors:[[6,4,facing]]});
    const expected={actor:'hero',from:f.at(...from),to:f.at(...to)},plan=planReflection(f.world,f.state),d=stepDetailed(f.world,f.state,5);
    assert.deepEqual(plan?.moves,[expected],`${facing}: nearer arm ${nearArm}`);
    assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
    assertAt(hero(d.state,'merchant').at,expected.to);assertAt(hero(d.state,'bard').at,hero(f.state,'bard').at);assert.deepEqual(d.state.stones,f.state.stones);
  }
});
test('reflection distance outranks the selected hero and the kind of the nearer actor',()=>{
  for(const [key,actor] of [['stones','stone'],['monsters','monster']]){
    const f=fixture({M:[9,4],B:[2,8],[key]:[[6,3]],mirrors:[[6,4,'NE']]}),plan=planReflection(f.world,f.state),d=stepDetailed(f.world,f.state,5);
    assert.deepEqual(plan?.moves,[{actor,from:f.at(6,3),to:f.at(7,4)}]);
    assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assert.deepEqual(d.state[key],[f.at(7,4)]);
    assert.deepEqual(d.state.heroes.map(h=>h.at),f.state.heroes.map(h=>h.at));assert.equal(d.state.active,0);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
  }
});
test('a wall, closed door, closed press or actor at the farther arrival cannot veto the nearer reflection',()=>{
  const blockers=[
    {walls:[[6,1]]},
    {doors:[[6,1]],buttons:[[2,7]]},
    {circuits:[{id:'closed',buttons:[{x:2,y:7}]}],gates:[{at:{x:6,y:1},circuit:'closed',direction:'S',closedWhen:'released'}]},
    {stones:[[9,4],[6,1]]},
  ];
  for(const blocker of blockers){
    const f=fixture({M:[6,3],B:[2,8],stones:[[9,4]],mirrors:[[6,4,'NE']],...blocker}),d=stepDetailed(f.world,f.state,5);
    assert.deepEqual(planReflection(f.world,f.state)?.moves,[{actor:'hero',from:f.at(6,3),to:f.at(7,4)}]);
    assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assertAt(hero(d.state,'merchant').at,f.at(7,4));
    assert.deepEqual(d.state.stones,f.state.stones);assertAt(hero(d.state,'bard').at,hero(f.state,'bard').at);
  }
});
test('a blocked nearer arrival refuses reflection instead of admitting an occupant hidden beyond the obstruction',()=>{
  const f=fixture({M:[6,3],B:[9,4],walls:[[7,4]],mirrors:[[6,4,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(planReflection(f.world,f.state),null);assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);
  assert.deepEqual(d.state.heroes,f.state.heroes);assert.equal(renderWorld(f.world,f.state).flat().includes(1),false);
});
test('nearest-distance selection is local to each mirror, so a second mirror may reflect a farther hero',()=>{
  const f=fixture({M:[4,3],B:[10,3],stones:[[7,4]],mirrors:[[4,4,'NE'],[10,6,'NW']]}),d=stepDetailed(f.world,f.state,5);
  assert.deepEqual(planReflection(f.world,f.state)?.moves,[
    {actor:'hero',from:f.at(4,3),to:f.at(5,4)},
    {actor:'hero',from:f.at(10,3),to:f.at(7,6)},
  ]);
  assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);assertAt(hero(d.state,'merchant').at,f.at(5,4));assertAt(hero(d.state,'bard').at,f.at(7,6));assert.deepEqual(d.state.stones,f.state.stones);
});
test('a selected transfer blocked at another mirror still cancels the global action atomically',()=>{
  const f=fixture({M:[4,3],B:[10,3],stones:[[7,4]],walls:[[7,6]],mirrors:[[4,4,'NE'],[10,6,'NW']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(planReflection(f.world,f.state),null);assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);
  assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.state.stones,f.state.stones);
});
test('equal-distance hero and crate occupants still exchange simultaneously in all four quadrants',()=>{
  const cases=[['NE',[6,2],[8,4]],['NW',[6,2],[4,4]],['SE',[6,6],[8,4]],['SW',[6,6],[4,4]]];
  for(const [facing,M,stone] of cases){
    const f=fixture({M,B:[2,8],stones:[stone],mirrors:[[6,4,facing]]}),plan=planReflection(f.world,f.state),d=stepDetailed(f.world,f.state,5);
    assert.equal(plan?.moves.length,2,facing);assert.equal(d.state.failed,false);assert.equal(d.state.dead,false);
    assertAt(hero(d.state,'merchant').at,f.at(...stone));assert.deepEqual(d.state.stones,[f.at(...M)]);
    assert.equal(d.state.active,0);assert.equal(d.phases[0].moves.length,2);assert.equal(transitionFrames(f.world,f.state,d.state,5).length,3);
  }
});
test('a blocked reflection endpoint cancels the entire global reflection',()=>{
  const f=fixture({M:[5,3],B:[2,6],mirrors:[[5,5,'NE']],walls:[[7,5]]});assert.equal(planReflection(f.world,f.state),null);const s=stepWorld(f.world,f.state,5);assert.equal(s.failed,true);assert.deepEqual(s.heroes,f.state.heroes);
});
test('an actor seen by two mirrors with different destinations cannot clone',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE'],[3,3,'SE']]});assert.equal(planReflection(f.world,f.state),null);const s=stepWorld(f.world,f.state,5);assert.equal(s.failed,true);assert.equal(s.heroes.length,2);assert.deepEqual(s.heroes,f.state.heroes);
});
test('the mirror physically blocking a reflection blinks red twice and leaves every actor in place',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE'],[6,5,'SE'],[11,1,'NE']]}),before=JSON.stringify(f.state),detail=stepDetailed(f.world,f.state,5),session=new DuoPuzzleSession([f.spec]);
  const initial=session.observe(),view=session.action(5),pixel=cellToPixel(f.at(6,5));
  assert.equal(detail.state.failed,true);assert.deepEqual(detail.phases,[]);assert.deepEqual(detail.blockedMirrorIndices,[1]);
  assert.deepEqual({...detail.state,failed:false},f.state);assert.equal(JSON.stringify(f.state),before);
  assert.equal(view.frames.length,4);assert.deepEqual(view.frameDurationsMs,[110,70,110,0]);
  assert.deepEqual(view.frames.map(frame=>frame[pixel.y+1][pixel.x+1]),[8,0,8,0]);
  const diff=[];for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(view.frames[0][y][x]!==initial.frame[y][x])diff.push([x,y]);
  assert.deepEqual(diff,[[pixel.x+2,pixel.y],[pixel.x+1,pixel.y+1],[pixel.x,pixel.y+2]]);
  assert.deepEqual(view.frames[1],initial.frame);assert.deepEqual(view.frames.at(-1),view.frame);assert.deepEqual(view.frame,initial.frame);
  assert.equal(view.state,'NOT_FINISHED');assert.equal(view.canUndo,false);
  assert.deepEqual(Object.keys(view).sort(),[...Object.keys(initial),'frameDurationsMs'].sort());
});
test('a mirror hiding the only source is identified without animating an ordinary empty reflection',()=>{
  const hidden=fixture({M:[5,1],mirrors:[[5,5,'NE'],[5,3,'SE']]}),d=stepDetailed(hidden.world,hidden.state,5);
  assert.equal(planReflection(hidden.world,hidden.state),null);assert.deepEqual(d.blockedMirrorIndices,[1]);
  assert.deepEqual({...d.state,failed:false},hidden.state);assert.equal(transitionFrames(hidden.world,hidden.state,d.state,5).length,4);
  const empty=fixture({mirrors:[[5,5,'NE'],[5,3,'SE']]}),e=stepDetailed(empty.world,empty.state,5);
  assert.equal(e.blockedMirrorIndices,undefined);assert.equal(transitionFrames(empty.world,empty.state,e.state,5).length,1);
});
test('both interfering mirrors blink for incompatible destinations of one actor, but unrelated mirrors do not',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE'],[3,3,'SE'],[11,1,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,true);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.deepEqual(d.phases,[]);
  assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.state.mirrors,f.state.mirrors);
  const frames=transitionFrames(f.world,f.state,d.state,5);
  for(const [i,m] of f.state.mirrors.entries()){const p=cellToPixel(m.at);assert.equal(frames[0][p.y+1][p.x+1],i<2?8:0);}
});
test('mirror transfers competing for one destination identify both sources and remain atomic',()=>{
  const f=fixture({M:[5,3],B:[9,3],mirrors:[[5,5,'NE'],[9,5,'NW']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(planReflection(f.world,f.state),null);assert.deepEqual(d.blockedMirrorIndices,[0,1]);assert.equal(d.state.failed,true);
  assert.deepEqual(d.state.heroes,f.state.heroes);assert.deepEqual(d.state.mirrors,f.state.mirrors);
});
test('an irrelevant mirror beyond the farther arrival cannot veto or flash during a valid near reflection',()=>{
  const f=fixture({M:[6,3],B:[2,8],stones:[[9,4]],mirrors:[[6,4,'NE'],[6,1,'NE']]}),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,false);assert.equal(d.blockedMirrorIndices,undefined);assertAt(hero(d.state,'merchant').at,f.at(7,4));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
  const o=new DuoPuzzleSession([f.spec]).action(5);assert.equal(o.frames.length,3);assert.ok(o.frames.every(frame=>!frame.flat().includes(8)));
});
test('refused mirror flashes never tick monsters or hydraulic circuits',()=>{
  const f=fixture({M:[5,3],monsters:[[3,6]],mirrors:[[5,5,'NE'],[6,5,'SE']],water:[[8,8]],circuits:[{id:'still',buttons:[{x:2,y:6}]}],platforms:[{at:{x:8,y:8},circuit:'still',activeWhen:'pressed'}]}),before=JSON.stringify(f.state),d=stepDetailed(f.world,f.state,5);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual({...d.state,failed:false},f.state);assert.equal(JSON.stringify(f.state),before);
  assert.deepEqual(d.phases,[]);assert.deepEqual(d.state.platformActive,[true]);assert.equal(d.state.monsters.length,1);
});
test('repeated mirror warnings replay their animation without adding Undo history',()=>{
  const f=fixture({M:[5,2],mirrors:[[5,5,'NE'],[6,5,'SE']]}),session=new DuoPuzzleSession([f.spec]),initial=session.observe();
  session.action(2);const moved=session.observe();assert.equal(moved.canUndo,true);
  const first=session.action(5),second=session.action(5);assert.deepEqual(second,first);assert.equal(first.frames.length,4);
  assert.deepEqual(session.undo(),initial);assert.equal(session.observe().canUndo,false);
});
test('walls and closed doors do not cause a false red mirror warning',()=>{
  for(const obstacle of [{walls:[[7,5]]},{doors:[[7,5]],buttons:[[2,7]]}]){
    const f=fixture({M:[5,3],mirrors:[[5,5,'NE']],...obstacle}),d=stepDetailed(f.world,f.state,5);
    assert.equal(d.state.failed,true);assert.equal(d.blockedMirrorIndices,undefined);assert.equal(transitionFrames(f.world,f.state,d.state,5).length,1);
  }
});
test('reflection onto water creates a crate platform but kills an unsupported hero',()=>{
  const crate=fixture({M:[2,2],stones:[[5,3]],water:[[7,5]],mirrors:[[5,5,'NE']]});const s=stepWorld(crate.world,crate.state,5);assert.equal(s.stones.length,0);assert.deepEqual(s.supports,[crate.at(7,5)]);
  const person=fixture({M:[5,3],water:[[7,5]],mirrors:[[5,5,'NE']]});const dead=stepWorld(person.world,person.state,5);assert.equal(dead.dead,true);assert.equal(hero(dead,'merchant').dead,true);assert.equal(hero(dead,'bard').dead,false);
});
test('mirrors weigh on buttons and can hold a normal door open',()=>{
  const f=fixture({mirrors:[[3,2,'SE']],buttons:[[4,2]],doors:[[8,4]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.failed,false);const p=cellToPixel(f.at(8,4));const frame=renderWorld(f.world,s);assert.equal(frame[p.y+1][p.x+1],3);
});
test('a lateral press pushes a mirror and a companion file',()=>{
  const f=fixture({M:[2,2],B:[5,5],mirrors:[[4,5,'NE']],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const d=stepDetailed(f.world,f.state,4);assertAt(hero(d.state,'bard').at,f.at(6,5));assertAt(d.state.mirrors[0].at,f.at(5,5));assert.ok(d.phases.some(p=>p.kind==='piston'));assert.equal(d.state.dead,false);
});
test('blocked lateral press crushes only its own occupant',()=>{
  const f=fixture({M:[2,2],B:[5,5],stones:[[4,5]],walls:[[6,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.stones.length,0);assertAt(hero(d.state,'bard').at,f.at(5,5));assert.equal(d.state.dead,false);assert.ok(d.phases.some(p=>p.kind==='crush'));
});
test('a press can force the inactive hero into water and trigger GAME_OVER',()=>{
  const f=fixture({B:[4,5],water:[[5,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const s=stepWorld(f.world,f.state,4);assert.equal(s.dead,true);assert.equal(hero(s,'bard').dead,true);assertAt(hero(s,'bard').at,f.at(5,5));
});
test('a press may destroy a mirror by pushing it into unsupported water',()=>{
  const f=fixture({mirrors:[[4,5,'NE']],water:[[5,5]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});const s=stepWorld(f.world,f.state,4);assert.equal(s.mirrors.length,0);assert.equal(s.dead,false);assert.equal(s.supports.length,0);
});
test('monsters attack either hero, including the inactive companion',()=>{
  const f=fixture({monsters:[[3,6]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.dead,true);assert.equal(hero(s,'bard').dead,true);assert.equal(hero(s,'merchant').dead,false);
});
test('monsters attack simultaneously even if mutually killed in the same wave',()=>{
  const f=fixture({M:[4,2],monsters:[[4,3],[5,3]]});const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.ok(d.phases.some(p=>p.kind==='combat'));
});
test('a refused action never ticks an initially adjacent monster',()=>{
  const f=fixture({walls:[[3,2]],monsters:[[3,6]]});const s=stepWorld(f.world,f.state,4);assert.equal(s.failed,true);assert.equal(s.dead,false);assert.equal(s.monsters.length,1);
});
test('a move renders exact one-pixel, two-pixel and settled three-pixel advancement',()=>{
  const f=fixture(),s=stepWorld(f.world,f.state,4),frames=transitionFrames(f.world,f.state,s,4),p=cellToPixel(f.state.heroes[0].at);assert.equal(frames.length,3);assert.equal(frames[0][p.y+1][p.x+2],12);assert.equal(frames[1][p.y+1][p.x+3],12);assert.deepEqual(frames[2],renderWorld(f.world,s));assert.notDeepEqual(frames[0],frames[1]);
});
test('reflection has three frames and a gray plus for hero destinations',()=>{
  const f=fixture({M:[5,3],mirrors:[[5,5,'NE']]});const p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);assert.equal(frame[p.y+1][p.x+1],1);assert.equal(frame[p.y][p.x],3);assert.equal(frame[p.y][p.x+1],1);const s=stepWorld(f.world,f.state,5);assert.equal(transitionFrames(f.world,f.state,s,5).length,3);
});
test('crate reflection preview is a gray square outline and directional push has no preview',()=>{
  const f=fixture({stones:[[5,3]],mirrors:[[5,5,'NE']]});const p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);assert.equal(frame[p.y][p.x],1);assert.equal(frame[p.y+1][p.x+1],3);assert.equal(frame[p.y+2][p.x+2],1);const push=fixture({stones:[[3,2]]});assert.equal(renderWorld(push.world,push.state).flat().includes(1),false);
});
test('public reflection preview shows only the nearer hero plus and matches its animated transfer',()=>{
  const f=fixture({M:[6,3],B:[2,8],stones:[[9,4]],mirrors:[[6,4,'NE']]}),session=new DuoPuzzleSession([f.spec]),before=session.observe();
  const tile=(frame,x,y)=>{const p=cellToPixel(f.at(x,y));return frame.slice(p.y,p.y+3).map(row=>row.slice(p.x,p.x+3));};
  assert.deepEqual(tile(before.frame,7,4),[[3,1,3],[1,1,1],[3,1,3]]);
  assert.deepEqual(tile(before.frame,6,1),[[3,3,3],[3,3,3],[3,3,3]]);assert.equal(before.frame.flat().filter(c=>c===1).length,5);
  const state=stepWorld(f.world,f.state,5),after=session.action(5);
  assertAt(hero(state,'merchant').at,f.at(7,4));assert.deepEqual(state.stones,f.state.stones);assert.equal(after.frames.length,3);
  assert.deepEqual(after.frame,renderWorld(f.world,state));assert.deepEqual(after.frames.at(-1),after.frame);
});
test('public reflection preview shows only the nearer crate outline while the farther hero stays put',()=>{
  const f=fixture({M:[9,4],B:[2,8],stones:[[6,3]],mirrors:[[6,4,'NE']]}),frame=renderWorld(f.world,f.state);
  const tile=(x,y)=>{const p=cellToPixel(f.at(x,y));return frame.slice(p.y,p.y+3).map(row=>row.slice(p.x,p.x+3));};
  assert.deepEqual(tile(7,4),[[1,1,1],[1,3,1],[1,1,1]]);assert.deepEqual(tile(6,1),[[3,3,3],[3,3,3],[3,3,3]]);
  assert.equal(frame.flat().filter(c=>c===1).length,8);
  const state=stepWorld(f.world,f.state,5);assert.deepEqual(state.stones,[f.at(7,4)]);assert.deepEqual(state.heroes.map(h=>h.at),f.state.heroes.map(h=>h.at));
});
test('combat keeps all five phases after a movement with explicit durations',()=>{
  const f=fixture({M:[4,2],monsters:[[4,3],[5,3]]}),session=new DuoPuzzleSession([f.spec]),obs=session.action(4);assert.equal(obs.state,'GAME_OVER');assert.equal(obs.frames.length,8);assert.deepEqual(obs.frameDurationsMs,[60,80,40,80,90,100,110,0]);assert.deepEqual(obs.frames.at(-1),obs.frame);assert.notDeepEqual(obs.frames[3],obs.frames[4]);assert.notDeepEqual(obs.frames[4],obs.frames[5]);assert.equal(session.action(1).state,'GAME_OVER');
});
test('both destinations must be occupied at the same time',()=>{
  const f=fixture({M:[10,2],B:[10,6]});let s=stepWorld(f.world,f.state,4);assert.equal(s.complete,false);s=select(f.world,s,1);s=stepWorld(f.world,s,4);assert.equal(s.complete,true);assert.equal(s.dead,false);
});
test('Undo restores role selection, mirror positions, supports and deaths',()=>{
  const f=fixture({M:[5,3],water:[[7,5]],mirrors:[[5,5,'NE']]});const s=new DuoPuzzleSession([f.spec]),start=s.observe();s.nextHero();const selected=s.observe();s.action(5);assert.equal(s.observe().state,'GAME_OVER');assert.deepEqual(s.undo().frame,selected.frame);assert.deepEqual(s.undo().frame,start.frame);assert.equal(s.observe().canUndo,false);
});
test('progression accepts out-of-order completion and Undo crosses level boundaries',()=>{
  const a=fixture({id:'a',M:[10,2],B:[10,6]}),b=fixture({id:'b',M:[10,2],B:[10,6]}),s=new DuoPuzzleSession([a.spec,b.spec]);s.selectLevel(2);s.action(4);s.nextHero();const before=s.observe(),done=s.action(4);assert.equal(done.level,1);assert.equal(done.levelsCompleted,1);assert.equal(done.frames.length,4);assert.equal(done.frameDurationsMs.at(-2),100);assert.deepEqual(s.undo().frame,before.frame);assert.equal(s.observe().level,2);assert.equal(s.observe().levelsCompleted,0);
  s.action(4);s.action(4);s.nextHero();assert.equal(s.action(4).state,'WIN');assert.equal(s.observe().levelsCompleted,2);assert.equal(s.restart().level,1);assert.equal(s.observe().levelsCompleted,0);
});
test('observations expose only pixels and controls, including ACTION6',()=>{
  const f=fixture(),s=new DuoPuzzleSession([f.spec]),o=s.observe();assert.deepEqual(o.availableActionIds,[1,2,3,4,5,6]);assert.equal(o.frame.length,64);assert.ok(o.frame.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16)));for(const k of ['heroes','active','mirrors','stones','world','solution','witness'])assert.equal(k in o,false);const before=s.observe();assert.throws(()=>s.selectLevel(0));assert.deepEqual(s.observe(),before);
});

test('all four reflective quadrants map equal distances on their two front arms',()=>{
  const cases=[['NE',[5,3],[7,5]],['NW',[5,3],[3,5]],['SE',[5,7],[7,5]],['SW',[5,7],[3,5]]];
  for(const [face,M,target] of cases){const f=fixture({M,mirrors:[[5,5,face]]}),s=stepWorld(f.world,f.state,5);assert.equal(s.failed,false,face);assertAt(hero(s,'merchant').at,f.at(...target));}
});
test('the black back of a mirror does not reflect a hero',()=>{
  const f=fixture({M:[5,7],mirrors:[[5,5,'NE']]});assert.equal(planReflection(f.world,f.state),null);assert.equal(stepWorld(f.world,f.state,5).failed,true);
});
test('moving a mirror recomputes its reflection endpoints',()=>{
  const f=fixture({M:[4,5],B:[6,3],mirrors:[[5,5,'NE']]});const before=planReflection(f.world,f.state);assert.equal(before,null);const s=stepWorld(f.world,f.state,4),plan=planReflection(f.world,s);assertAt(s.mirrors[0].at,f.at(6,5));assert.ok(plan.moves.some(m=>m.actor==='hero'&&eq(m.from,f.at(6,3))&&eq(m.to,f.at(8,5))));
});
test('press cascades re-evaluate a second circuit after the first push',()=>{
  const f=fixture({stones:[[4,5],[8,5]],water:[[9,5]],buttons:[[3,2],[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]},{id:'b',buttons:[{x:5,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'},{at:{x:8,y:5},circuit:'b',direction:'E',closedWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,4);assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(9,5)]);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','piston']);assert.deepEqual(d.state.gateClosed,[true,true]);assert.equal(transitionFrames(f.world,f.state,d.state,4).length,9);
});
test('a closed gate can hold its own pressure plate after expelling a stone',()=>{
  const f=fixture({stones:[[4,5]],circuits:[{id:'a',buttons:[{x:4,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]});assert.deepEqual(f.state.gateClosed,[true]);assert.deepEqual(f.state.stones,[f.at(5,5)]);const s=stepWorld(f.world,f.state,4);assert.deepEqual(s.gateClosed,[true]);assert.equal(s.failed,false);
});

test('hero reflection preview stays readable over a support or destination while keeping its corners',()=>{
  for(const [extra,corner] of [[{supports:[[7,5]]},10],[{goals:[[7,5],[11,6]]},11]]){
    const f=fixture({M:[5,3],mirrors:[[5,5,'NE']],...extra}),p=cellToPixel(f.at(7,5)),frame=renderWorld(f.world,f.state);
    assert.equal(frame[p.y][p.x],corner);assert.equal(frame[p.y][p.x+1],1);assert.equal(frame[p.y+1][p.x],1);assert.equal(frame[p.y+1][p.x+1],1);assert.equal(frame[p.y+1][p.x+2],1);assert.equal(frame[p.y+2][p.x+1],1);
  }
});

test('a fatal initial press in a later level rejects the campaign before replacing an active session',()=>{
  const valid={id:'valid',title:'Valid',rows:['MBgg']};
  const fatal={id:'fatal',title:'Fatal initial press',rows:['M~Bgg'],circuits:[{id:'a',buttons:[{x:4,y:0}]}],gates:[{at:{x:0,y:0},circuit:'a',direction:'E',closedWhen:'released'}]};
  // The map itself is valid; settling its initial gate drowns the Merchant.
  const fatalWorld=compileLevel(fatal);assert.throws(()=>initialState(fatalWorld),/Initial piston circuit/);
  let active=new DuoPuzzleSession([valid]);active.nextHero();const before=active.observe();
  assert.throws(()=>{active=new DuoPuzzleSession([valid,fatal]);},/Initial piston circuit/);
  assert.deepEqual(active.observe(),before);assert.equal(active.observe().level,1);assert.equal(active.observe().canUndo,true);assert.equal(active.undo().canUndo,false);
});

test('rejected level selection preserves current pixels, completion and Undo history',()=>{
  const a=fixture({id:'transaction-a',M:[10,2],B:[10,6]}),b=fixture({id:'transaction-b',M:[10,2],B:[10,6]}),session=new DuoPuzzleSession([a.spec,b.spec]);
  session.action(4);session.nextHero();session.action(4);session.action(3);
  const before=session.observe();assert.equal(before.level,2);assert.equal(before.levelsCompleted,1);assert.equal(before.canUndo,true);
  for(const invalid of [0,3,1.5,NaN]){assert.throws(()=>session.selectLevel(invalid),/Invalid level/);assert.deepEqual(session.observe(),before);}
  const undone=session.undo();assert.equal(undone.level,2);assert.equal(undone.levelsCompleted,1);assert.notDeepEqual(undone.frame,before.frame);
});


test('hydraulic platforms require unique water cells, valid circuits and palette colors',()=>{
  const base={water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}],color:14}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]};
  const f=fixture(base);assert.equal(f.world.platforms.length,1);assert.equal(f.world.circuits[0].color,14);
  assert.throws(()=>fixture({...base,water:[]}));assert.throws(()=>fixture({...base,platforms:[...base.platforms,...base.platforms]}));
  assert.throws(()=>fixture({...base,platforms:[{...base.platforms[0],circuit:'missing'}]}));assert.throws(()=>fixture({...base,platforms:[{...base.platforms[0],activeWhen:'never'}]}));
  for(const color of [-1,16,1.2,NaN])assert.throws(()=>fixture({...base,circuits:[{...base.circuits[0],color}]}));
});

test('hydraulic bridges obey AND circuits and both polarities with visible circuit markers',()=>{
  const f=fixture({B:[8,6],water:[[5,5],[6,5]],circuits:[{id:'a',buttons:[{x:3,y:2},{x:9,y:6}],color:14}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'},{at:{x:6,y:5},circuit:'a',activeWhen:'released'}]});
  assert.deepEqual(f.state.platformActive,[false,true]);const p=cellToPixel(f.at(5,5)),off=renderWorld(f.world,f.state);assert.equal(off[p.y][p.x],7);assert.equal(off[p.y][p.x+1],9);assert.equal(off[p.y+1][p.x+1],14);
  let s=stepWorld(f.world,f.state,4);assert.deepEqual(s.platformActive,[false,true]);s=stepWorld(f.world,select(f.world,s,1),4);assert.deepEqual(s.platformActive,[true,false]);
  const on=renderWorld(f.world,s);assert.equal(on[p.y][p.x+1],7);assert.equal(on[p.y+1][p.x+1],14);
});

test('retracting a bridge under the inactive hero causes GAME_OVER and Undo restores the full bridge',()=>{
  const f=fixture({B:[4,5],water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
  const absent=stepWorld(f.world,select(f.world,f.state,1),4);assert.equal(absent.failed,true);assert.equal(absent.dead,false);
  const session=new DuoPuzzleSession([f.spec]),raised=session.action(4);assert.equal(raised.frames.length,6);assert.deepEqual(raised.frameDurationsMs,[60,80,40,60,80,0]);
  session.nextHero();session.action(4);session.nextHero();const before=session.observe(),fallen=session.action(3);assert.equal(fallen.state,'GAME_OVER');assert.equal(fallen.frames.length,6);assert.deepEqual(fallen.frameDurationsMs,[60,80,40,60,80,0]);assert.deepEqual(session.undo().frame,before.frame);
});

test('a crate stays movable on a raised bridge and becomes a permanent support when it retracts',()=>{
  const f=fixture({M:[3,5],B:[3,2],stones:[[4,5]],water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
  let s=stepWorld(f.world,f.state,4);assert.deepEqual(s.stones,[f.at(5,5)]);assert.equal(s.supports.length,0);
  s=stepWorld(f.world,select(f.world,s,1),3);assert.deepEqual(s.platformActive,[false]);assert.equal(s.stones.length,0);assert.deepEqual(s.supports,[f.at(5,5)]);
  const px=cellToPixel(f.at(5,5)),frame=renderWorld(f.world,s);assert.equal(frame[px.y][px.x],10);assert.equal(frame[px.y][px.x+1],13);assert.equal(frame[px.y+1][px.x+1],10);
  s=stepWorld(f.world,select(f.world,s,0),4);assert.equal(s.failed,false);assert.equal(s.dead,false);assertAt(hero(s,'merchant').at,f.at(5,5));
});

test('forced mirrors and monsters survive a simultaneous bridge activation, then fall on retraction',()=>{
  for(const actor of ['mirror','monster']){
    const f=fixture({...(actor==='mirror'?{mirrors:[[4,5,'NE']]}:{monsters:[[4,5]]}),water:[[5,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]});
    let s=stepWorld(f.world,f.state,4);assert.equal(s.dead,false);assert.deepEqual(s.platformActive,[true]);assertAt(actor==='mirror'?s.mirrors[0].at:s.monsters[0],f.at(5,5));
    s=stepWorld(f.world,s,3);assert.equal(s.dead,false);assert.equal(s.mirrors.length+s.monsters.length,0);assert.equal(s.supports.length,0);
  }
});

test('a reflection can activate its own landing bridge and release it safely on the return',()=>{
  const f=fixture({M:[5,3],B:[10,7],stones:[[2,6]],water:[[7,5]],mirrors:[[5,5,'NE'],[2,4,'SE']],circuits:[{id:'a',buttons:[{x:4,y:4}],color:15}],platforms:[{at:{x:7,y:5},circuit:'a',activeWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,5);assert.equal(d.state.dead,false);assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(7,5));assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['reflect','platform']);
  const s=stepWorld(f.world,d.state,5);assert.equal(s.dead,false);assertAt(hero(s,'merchant').at,f.at(5,3));assert.deepEqual(s.platformActive,[false]);
});

test('a press cascade settles the landing bridge before testing water support',()=>{
  const f=fixture({B:[9,5],stones:[[4,5]],water:[[10,5]],circuits:[{id:'a',buttons:[{x:3,y:2}]},{id:'b',buttons:[{x:5,y:5}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:10,y:5},circuit:'b',activeWhen:'pressed'}]});
  const d=stepDetailed(f.world,f.state,4);assert.deepEqual(d.state.platformActive,[true]);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston','platform']);
  const s=stepWorld(f.world,select(f.world,d.state,1),4);assert.equal(s.failed,false);assert.equal(s.dead,false);assertAt(hero(s,'bard').at,f.at(10,5));
});

test('a fatal initial forced landing on an absent bridge rejects the new campaign transactionally',()=>{
  const valid={id:'valid-water',title:'Valid',rows:['MBgg']};
  const fatal={id:'fatal-water',title:'Absent bridge',rows:['M~Bgg'],circuits:[{id:'a',buttons:[{x:4,y:0}]}],gates:[{at:{x:0,y:0},circuit:'a',direction:'E',closedWhen:'released'}],platforms:[{at:{x:1,y:0},circuit:'a',activeWhen:'pressed'}]};
  const world=compileLevel(fatal);assert.throws(()=>initialState(world),/Initial piston circuit/);
  let session=new DuoPuzzleSession([valid]);session.nextHero();const before=session.observe();assert.throws(()=>{session=new DuoPuzzleSession([valid,fatal]);},/Initial piston circuit/);assert.deepEqual(session.observe(),before);
});


const bardState=f=>select(f.world,f.state,1);
const song=(f,action=4,state=bardState(f))=>stepDetailed(f.world,state,action);

test('song range includes diagonal radius two and excludes radius three',()=>{
  assert.equal(inSongRange({x:6,y:4},{x:8,y:2}),true);assert.equal(inSongRange({x:6,y:4},{x:9,y:4}),false);
  for(const [action,dx,dy] of [[1,0,-1],[2,0,1],[3,-1,0],[4,1,0]]){
    const side=[-dy,dx],near=[6+2*side[0],4+2*side[1]],far=[6+3*side[0],4+3*side[1]];
    const f=fixture({M:[2,8],B:[6,4],stones:[near,far]}),d=song(f,action);
    assert.equal(d.state.failed,false);assert.equal(d.phases[0].kind,'song');
    assertAt(hero(d.state,'bard').at,f.at(6+dx,4+dy));assert.deepEqual(d.state.stones,f.state.stones.map(p=>eq(p,f.at(...near))?f.at(near[0]+dx,near[1]+dy):p));
  }
});
test('the Bard reaches a crate across an intervening wall',()=>{
  const f=fixture({M:[2,8],B:[4,4],walls:[[5,4]],stones:[[6,4]]}),d=song(f,1);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'bard').at,f.at(4,3));assert.deepEqual(d.state.stones,[f.at(6,3)]);
});
test('one blocked choir member stays while another advances',()=>{
  const f=fixture({M:[2,8],B:[6,4],stones:[[6,2],[5,3]],walls:[[7,2]]}),d=song(f);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(6,2),f.at(6,3)]);assertAt(hero(d.state,'bard').at,f.at(7,4));
});
test('a two-crate convoy advances simultaneously into a free tail',()=>{
  const f=fixture({M:[2,8],B:[4,4],stones:[[5,4],[6,4]]}),d=song(f);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(6,4),f.at(7,4)]);assertAt(hero(d.state,'bard').at,f.at(5,4));assert.equal(d.phases[0].moves.length,3);
});
test('an out-of-range tail blocks the convoy and cancels a blocked Bard',()=>{
  const f=fixture({M:[2,8],B:[4,4],stones:[[5,4],[6,4],[7,4]]}),before=bardState(f),d=song(f,4,before);
  assert.equal(d.state.failed,true);assert.deepEqual(d.phases,[]);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.heroes,before.heroes);
});
test('rear choir crates may enter the cells vacated by each other and the Bard',()=>{
  const f=fixture({M:[2,8],B:[6,4],stones:[[4,4],[5,4]]}),d=song(f);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,[f.at(5,4),f.at(6,4)]);assertAt(hero(d.state,'bard').at,f.at(7,4));
});
test('a blocked Bard cancels object movement and does not tick combat',()=>{
  const f=fixture({M:[2,8],B:[6,4],stones:[[4,3]],walls:[[7,4]],monsters:[[2,7]]}),before=bardState(f),d=song(f,4,before);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.monsters,before.monsters);assert.deepEqual(d.phases,[]);
});
test('mirrors do not sing and the Bard cannot push one',()=>{
  const f=fixture({M:[2,8],B:[6,4],mirrors:[[7,4,'NE']],stones:[[4,3]]}),d=song(f);
  assert.equal(d.state.failed,true);assert.deepEqual(d.state.mirrors,f.state.mirrors);assert.deepEqual(d.state.stones,f.state.stones);
  const away=song(f,1);assert.equal(away.state.failed,false);assert.deepEqual(away.state.mirrors,f.state.mirrors);
});
test('Merchant walking near the Bard never triggers a song',()=>{
  const f=fixture({M:[4,4],B:[6,4],stones:[[6,3]]}),d=stepDetailed(f.world,f.state,1);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,f.state.stones);assertAt(hero(d.state,'bard').at,f.at(6,4));assert.equal(d.phases[0].kind,'walk');
});
test('Merchant may push the Bard without triggering the Bard aura',()=>{
  const f=fixture({M:[3,4],B:[4,4],stones:[[5,3]]}),d=stepDetailed(f.world,f.state,4);
  assertAt(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,f.state.stones);assert.equal(d.phases[0].kind,'push');
});
test('the inactive Merchant follows the song while retaining identity and facing',()=>{
  const f=fixture({M:[7,4],B:[6,4],facing:'N'}),d=song(f);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'bard').at,f.at(7,4));assertAt(hero(d.state,'merchant').at,f.at(8,4));assert.equal(hero(d.state,'merchant').facing,'N');assert.equal(hero(d.state,'bard').facing,'E');assert.equal(d.state.active,1);
});
test('a wall anchors the Merchant without preventing a free Bard step',()=>{
  const f=fixture({M:[7,2],B:[6,4],walls:[[8,2]]}),d=song(f);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(7,2));assertAt(hero(d.state,'bard').at,f.at(7,4));
});
test('a sung Merchant cannot push an out-of-range crate',()=>{
  const f=fixture({M:[6,4],B:[4,4],stones:[[7,4]]}),d=song(f);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(6,4));assertAt(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,f.state.stones);
});
test('Merchant and crate inside the aura advance as independent convoy members',()=>{
  const f=fixture({M:[5,4],B:[4,4],stones:[[6,4]]}),d=song(f);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(6,4));assertAt(hero(d.state,'bard').at,f.at(5,4));assert.deepEqual(d.state.stones,[f.at(7,4)]);assert.equal(d.phases[0].moves.length,3);
});
test('a song that would drown the Merchant is refused atomically',()=>{
  const f=fixture({M:[6,2],B:[6,4],water:[[7,2]],stones:[[4,3]]}),before=bardState(f),d=song(f,4,before);
  assert.equal(d.state.failed,true);assert.equal(d.state.dead,false);assert.deepEqual(d.state.heroes,before.heroes);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.phases,[]);
});
test('the Bard cannot walk into unsupported water and ordinary refusal stays immediate',()=>{
  const f=fixture({M:[2,8],B:[6,4],water:[[7,4]],stones:[[4,3]]}),session=new DuoPuzzleSession([f.spec]);session.nextHero();const before=session.observe(),o=session.action(4);
  assert.equal(o.frames.length,1);assert.deepEqual(o.frameDurationsMs,[0]);assert.equal(o.state,'NOT_FINISHED');assert.deepEqual(o.frame,before.frame);assert.deepEqual(session.undo().frame,before.frame);
});
test('supports slide simultaneously along water but never climb onto land',()=>{
  const f=fixture({M:[2,8],B:[6,4],supports:[[6,2],[7,2]],water:[[8,2]]}),d=song(f);
  assert.deepEqual(d.state.supports,[f.at(7,2),f.at(8,2)]);assert.equal(d.state.failed,false);
  const dry=fixture({M:[2,8],B:[6,4],supports:[[6,2]]}),blocked=song(dry);
  assert.deepEqual(blocked.state.supports,dry.state.supports);assert.equal(blocked.state.failed,false);
});
test('a stationary support outside the aura holds back the approaching support train',()=>{
  const f=fixture({M:[2,8],B:[6,4],supports:[[7,2],[8,2],[9,2]],water:[[10,2]]}),d=song(f);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,f.state.supports);
});
test('the Bard destination support anchors instead of sliding away',()=>{
  const f=fixture({M:[2,8],B:[6,4],supports:[[7,4]],water:[[8,4]]}),d=song(f);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,f.state.supports);assertAt(hero(d.state,'bard').at,f.at(7,4));
});
test('the support under the Bard stays anchored as the Bard leaves it',()=>{
  const f=fixture({M:[2,8],B:[4,4],supports:[[6,3],[7,3]],water:[[8,3]]});
  const state={...bardState(f),heroes:f.state.heroes.map(h=>h.kind==='bard'?{...h,at:f.at(6,3)}:h)},d=song(f,4,state);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,f.state.supports);assertAt(hero(d.state,'bard').at,f.at(7,3));assert.ok(!d.phases[0].moves.some(m=>m.actor==='support'));
});
test('the support under a sung Merchant stays anchored when he reaches a raised bridge',()=>{
  const f=fixture({M:[2,8],B:[5,4],supports:[[6,3]],water:[[6,4]],circuits:[{id:'a',buttons:[{x:10,y:7}]}],platforms:[{at:{x:6,y:4},circuit:'a',activeWhen:'released'}]});
  const state={...bardState(f),heroes:f.state.heroes.map(h=>h.kind==='merchant'?{...h,at:f.at(6,3)}:h)},d=song(f,2,state);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'merchant').at,f.at(6,4));assert.deepEqual(d.state.supports,[f.at(6,3)]);assert.ok(!d.phases[0].moves.some(m=>m.actor==='support'));
});
test('a monster travels with its sung support and stays afloat',()=>{
  const f=fixture({M:[2,8],B:[6,4],supports:[[6,2]],water:[[7,2]]}),state={...bardState(f),monsters:[f.at(6,2)]},d=song(f,4,state);
  assert.equal(d.state.dead,false);assert.equal(d.state.failed,false);assert.deepEqual(d.state.supports,[f.at(7,2)]);assert.deepEqual(d.state.monsters,[f.at(7,2)]);
});
test('sunken supports are excluded from mirror reflections',()=>{
  const f=fixture({M:[2,2],B:[2,7],supports:[[5,3]],mirrors:[[5,5,'NE']]});assert.equal(planReflection(f.world,f.state),null);assert.deepEqual(stepWorld(f.world,f.state,5).supports,f.state.supports);
});
test('a sung crate entering open water becomes a cyan-cross support',()=>{
  const f=fixture({M:[2,8],B:[6,4],stones:[[6,2]],water:[[7,2]]}),d=song(f);assert.equal(d.state.failed,false);assert.equal(d.state.stones.length,0);assert.deepEqual(d.state.supports,[f.at(7,2)]);
});
test('song can bring two monsters into a simultaneous lethal duel',()=>{
  const f=fixture({M:[2,2],B:[4,6],monsters:[[5,4],[7,4]]}),before=bardState(f),d=song(f,4,before);
  assert.equal(d.state.dead,false);assert.equal(d.state.monsters.length,0);assert.deepEqual(d.phases.map(p=>p.kind),['song','combat']);assert.equal(transitionFrames(f.world,before,d.state,4).length,8);
});
test('a monster killed in a sung duel still hits the adjacent inactive Merchant',()=>{
  const f=fixture({M:[8,4],B:[4,6],monsters:[[5,4],[7,4]]}),d=song(f);assert.equal(d.state.monsters.length,0);assert.equal(d.state.dead,true);assert.equal(hero(d.state,'merchant').dead,true);assert.equal(hero(d.state,'bard').dead,false);
});
test('reflection moves the Bard and Merchant without any additional song',()=>{
  const f=fixture({M:[7,5],B:[5,3],mirrors:[[5,5,'NE']],stones:[[4,3]],supports:[[3,3]]}),before=bardState(f),d=stepDetailed(f.world,before,5);
  assert.equal(d.state.failed,false);assert.deepEqual(d.state.stones,before.stones);assert.deepEqual(d.state.supports,before.supports);assertAt(hero(d.state,'bard').at,f.at(7,5));assert.deepEqual(d.phases.map(p=>p.kind),['reflect']);
});
test('a press moving the Bard never sings again at its destination',()=>{
  const f=fixture({B:[4,5],stones:[[4,4]],buttons:[[3,2]],circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.failed,false);assertAt(hero(d.state,'bard').at,f.at(5,5));assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.phases.map(p=>p.kind),['walk','piston']);
});
test('a selected Bard has a dotted magenta radius-two perimeter and Merchant selection hides it',()=>{
  const f=fixture({M:[2,8],B:[6,4]}),p=cellToPixel(f.at(6,4)),inactive=renderWorld(f.world,f.state),active=renderWorld(f.world,bardState(f));
  assert.equal(active[p.y-6][p.x-6],6);assert.notEqual(active[p.y-6][p.x-5],6);assert.equal(active[p.y-6][p.x-4],6);assert.notEqual(inactive[p.y-6][p.x-6],6);
  assert.equal(active[p.y+14-6][p.x-6],6);assert.equal(active[p.y-6][p.x+14-6],6);assert.equal(active[p.y+1][p.x+1],6);
});
test('the aura follows all three one-pixel advancement frames',()=>{
  const f=fixture({M:[2,8],B:[6,4]}),before=bardState(f),d=song(f,4,before),frames=transitionFrames(f.world,before,d.state,4),p=cellToPixel(f.at(6,4));
  assert.equal(frames.length,3);for(let i=0;i<3;i++){assert.equal(frames[i][p.y-6][p.x-6+i+1],6);assert.notEqual(frames[i][p.y-6][p.x-6],6);assert.equal(frames[i][p.y+1][p.x+2+i],6);}assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
});
test('moving supports use three advancement frames with no stationary ghost',()=>{
  const f=fixture({M:[2,8],B:[6,4],supports:[[6,2]],water:[[7,2]]}),before=bardState(f),d=song(f,4,before),frames=transitionFrames(f.world,before,d.state,4),p=cellToPixel(f.at(6,2));
  assert.equal(frames.length,3);for(let i=0;i<3;i++){assert.equal(frames[i][p.y+1][p.x+2+i],10);assert.equal(frames[i].flat().filter(c=>c===10).length,5);}assert.deepEqual(frames.at(-1),renderWorld(f.world,d.state));
});
const expectedMirrorPixels={NE:[[0,null,null],[5,0,null],[5,5,0]],NW:[[null,null,0],[null,0,5],[0,5,5]],SE:[[5,5,0],[5,0,null],[0,null,null]],SW:[[0,5,5],[null,0,5],[null,null,0]]};
function assertMirrorPixels(frame,origin,facing){expectedMirrorPixels[facing].forEach((row,y)=>row.forEach((color,x)=>{if(color!==null)assert.equal(frame[origin.y+y][origin.x+x],color);}));}
test('the dotted aura never overwrites crate, monster, support or mirror glyphs',()=>{
  const f=fixture({M:[2,8],B:[6,4],stones:[[4,2]],monsters:[[8,6]],supports:[[4,6]],mirrors:[[8,2,'SW']],circuits:[{id:'m',buttons:[{x:8,y:2}],color:14}]}),frame=renderWorld(f.world,bardState(f));
  const tile=(x,y)=>{const p=cellToPixel(f.at(x,y));return frame.slice(p.y,p.y+3).map(r=>r.slice(p.x,p.x+3));};
  assert.deepEqual(tile(4,2),[[13,13,13],[13,5,13],[13,13,13]]);assert.deepEqual(tile(8,6),[[8,5,8],[5,8,5],[8,5,8]]);assert.deepEqual(tile(4,6),[[10,13,10],[13,10,13],[10,13,10]]);assertMirrorPixels(frame,cellToPixel(f.at(8,2)),'SW');
});
test('all mirror diagonals and black backs stay above button markings during a push',()=>{
  for(const facing of ['NE','NW','SE','SW']){
    const f=fixture({mirrors:[[3,2,facing]],circuits:[{id:'m',buttons:[{x:3,y:2},{x:4,y:2}],color:14}]}),d=stepDetailed(f.world,f.state,4),frames=transitionFrames(f.world,f.state,d.state,4),p=cellToPixel(f.at(3,2));
    assertMirrorPixels(renderWorld(f.world,f.state),p,facing);for(let i=0;i<3;i++)assertMirrorPixels(frames[i],{x:p.x+i+1,y:p.y},facing);
  }
});
test('Undo restores the entire simultaneous song, supports and selected aura',()=>{
  const f=fixture({M:[7,4],B:[6,4],stones:[[6,2]],water:[[7,2]]}),session=new DuoPuzzleSession([f.spec]);session.nextHero();const before=session.observe(),after=session.action(4);
  assert.equal(after.frames.length,3);assert.deepEqual(after.frameDurationsMs,[60,80,0]);assert.notDeepEqual(after.frame,before.frame);assert.deepEqual(session.undo().frame,before.frame);assert.deepEqual(session.undo().frame,renderWorld(f.world,f.state));
});
test('all supplied campaign rooms initialize live with the exact duo and two goals',()=>{
  for(const spec of SS09_LEVELS){const w=compileLevel(spec),s=initialState(w);assert.equal(s.dead,false,spec.id);assert.deepEqual(s.heroes.map(h=>h.kind),['merchant','bard']);assert.equal(w.goals.length,2);assert.equal(s.complete,false);const frame=renderWorld(w,s);assert.equal(frame.length,64);assert.ok(frame.every(r=>r.length===64&&r.every(v=>Number.isInteger(v)&&v>=0&&v<16)));}
});
