import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepDetailed,stepWorld,TrioPuzzleSession,cellToPixel,circuitPressed,renderWorld} from '../dist/core.js';

const p=(x,y)=>({x,y});
const sorted=points=>points.map(q=>`${q.x},${q.y}`).sort();
function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||x===19||y===0||y===19?'#':'.'));
 for(const [key,char] of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m']])for(const [x,y] of o[key]??[])rows[y][x]=char;
 for(const [x,y] of o.goals??[[17,2],[17,7],[17,12]])rows[y][x]='g';
 for(const [kind,def] of [['W',[2,2]],['Z',[2,7]],['B',[2,12]]]){const [x,y]=o[kind]??def;rows[y][x]=kind;}
 const spec={id:'hunt-fixture',title:'SS19 pursuit fixture',rows:rows.map(r=>r.join('')),facing:'S',mirrors:(o.mirrors??[]).map(([x,y,facing])=>({at:p(x,y),facing})),circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
 const world=compileLevel(spec),state=initialState(world);return {spec,world,state};
}
const select=(f,kind,state=f.state)=>stepWorld(f.world,state,6,cellToPixel(state.heroes.find(h=>h.kind===kind).at));

test('pursuit uses the post-action hero position, dominant axis and vertical ties',()=>{
 for(const [monster,expected] of [[[13,10],[12,10]],[[11,13],[11,12]],[[13,12],[13,11]],[[5,12],[5,11]],[[13,4],[13,5]]]){
  const f=fixture({W:[8,8],monsters:[monster]}),d=stepDetailed(f.world,f.state,4);
  assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[p(...expected)]);assert.deepEqual(d.phases.map(q=>q.kind),['walk','hunt']);
 }
 const f=fixture({W:[8,7],monsters:[[12,11]]}),d=stepDetailed(f.world,f.state,4);
 // Post-step (9,7): vertical distance4 exceeds horizontal3. The starting
 // position would also tie here; the following fixture distinguishes them.
 assert.deepEqual(d.state.monsters,[p(12,10)]);
 const post=fixture({W:[8,8],monsters:[[12,11]]}),r=stepDetailed(post.world,post.state,4);
 assert.deepEqual(r.state.monsters,[p(12,10)]); // New (9,8) tie, not old horizontal4.
});

test('selecting a different hero changes the next pursuit target without advancing time',()=>{
 const f=fixture({W:[3,5],Z:[15,10],B:[2,15],monsters:[[10,5]]});
 const warrior=stepDetailed(f.world,f.state,2),selected=select(f,'wizard'),wizard=stepDetailed(f.world,selected,1);
 assert.deepEqual(selected.monsters,f.state.monsters);assert.deepEqual(selected.heroes,f.state.heroes);
 assert.deepEqual(warrior.state.monsters,[p(9,5)]);assert.deepEqual(wizard.state.monsters,[p(11,5)]);
 assert.equal(warrior.state.dead,false);assert.equal(wizard.state.dead,false);
});

test('hunters stop on the chosen axis instead of taking a second route or pushing',()=>{
 for(const obstacle of [
  {walls:[[9,8]]},{stones:[[9,8]]},{mirrors:[[9,8,'NE']]},{water:[[9,8]]},
  {circuits:[{id:'a',buttons:[p(15,15)]}],gates:[{at:p(9,8),circuit:'a',direction:'E',closedWhen:'released'}]},
 ]){
  const f=fixture({W:[3,4],monsters:[[10,8]],...obstacle}),d=stepDetailed(f.world,f.state,2);
  assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[p(10,8)]);assert.ok(!d.phases.some(q=>q.kind==='hunt'));
  assert.deepEqual(d.state.stones,f.state.stones);assert.deepEqual(d.state.mirrors,f.state.mirrors);
 }
});

test('simultaneous proposals to the same free cell cancel independently of monster array order',()=>{
 const f=fixture({W:[9,7],monsters:[[9,9],[10,8]]});
 const normal=stepDetailed(f.world,f.state,3),reversed=stepDetailed(f.world,{...f.state,monsters:[...f.state.monsters].reverse()},3);
 assert.deepEqual(sorted(normal.state.monsters),['10,8','9,9']);assert.deepEqual(sorted(reversed.state.monsters),sorted(normal.state.monsters));
 assert.equal(normal.state.dead,false);assert.ok(!normal.phases.some(q=>q.kind==='hunt'));
});

test('pursuit can bring one monster into a blocked monster and resolves their contact simultaneously',()=>{
 const f=fixture({W:[3,5],monsters:[[8,8],[10,8]],stones:[[7,8]]}),d=stepDetailed(f.world,f.state,3);
 assert.equal(d.state.dead,false);assert.deepEqual(d.state.monsters,[]);assert.deepEqual(d.phases.map(q=>q.kind),['walk','hunt','combat']);
 assert.deepEqual(d.phases[1].moves,[{actor:'monster',from:p(10,8),to:p(9,8)}]);
 const reversed=stepDetailed(f.world,{...f.state,monsters:[...f.state.monsters].reverse()},3);assert.deepEqual(reversed.state.monsters,[]);
});

test('contacts caused by a spell resolve before any surviving monster can flee',()=>{
 const f=fixture({Z:[3,7],monsters:[[10,7],[3,6]]}),d=stepDetailed(f.world,select(f,'wizard'),4);
 assert.deepEqual(d.phases.map(q=>q.kind),['swap','combat']);assert.deepEqual(d.state.monsters,[]);assert.equal(d.state.dead,false);
 const endangered=fixture({W:[8,8],Z:[7,6],monsters:[[8,6]]}),hit=stepDetailed(endangered.world,endangered.state,4);
 assert.equal(hit.state.dead,true);assert.equal(hit.state.heroes.find(h=>h.kind==='wizard').dead,true);assert.ok(!hit.phases.some(q=>q.kind==='hunt'));
});

test('a monster moved by the song then pursues once, while the selected Bard keeps its new position',()=>{
 const f=fixture({B:[7,7],monsters:[[5,5]]}),d=stepDetailed(f.world,select(f,'bard'),4);
 assert.deepEqual(d.phases.map(q=>q.kind),['song','hunt']);assert.deepEqual(d.phases[0].after.monsters,[p(6,5)]);assert.deepEqual(d.state.monsters,[p(6,6)]);
 assert.deepEqual(d.state.heroes.find(h=>h.kind==='bard').at,p(8,7));assert.equal(d.state.dead,false);
});

test('a transposed monster pursues from its new square toward the new Wizard square',()=>{
 const f=fixture({Z:[3,7],monsters:[[10,7]]}),d=stepDetailed(f.world,select(f,'wizard'),4);
 assert.deepEqual(d.phases.map(q=>q.kind),['swap','hunt']);assert.deepEqual(d.phases[0].after.monsters,[p(3,7)]);assert.deepEqual(d.state.monsters,[p(4,7)]);assert.equal(d.state.dead,false);
});

test('a pursuing monster opens and releases a floor button before the turn ends',()=>{
 const f=fixture({W:[3,4],monsters:[[10,8]],circuits:[{id:'a',buttons:[p(9,8)],color:15}],gates:[{at:p(13,8),circuit:'a',direction:'E',closedWhen:'released'}]});
 const onto=stepDetailed(f.world,f.state,2);assert.equal(circuitPressed(f.world,onto.state,'a'),true);assert.deepEqual(onto.state.gateClosed,[false]);assert.deepEqual(onto.phases.map(q=>q.kind),['walk','hunt','gate']);
 const off=stepDetailed(f.world,onto.state,2);assert.equal(circuitPressed(f.world,off.state,'a'),false);assert.deepEqual(off.state.gateClosed,[true]);assert.deepEqual(off.state.monsters,[p(8,8)]);assert.equal(off.phases.filter(q=>q.kind==='hunt').length,1);
});

test('hunters cross existing submerged supports and active platforms, but never bare water',()=>{
 const supported=fixture({W:[3,4],monsters:[[10,8]],supports:[[9,8]]}),walk=stepDetailed(supported.world,supported.state,2);
 assert.deepEqual(walk.state.monsters,[p(9,8)]);assert.deepEqual(walk.state.supports,[p(9,8)]);
 const f=fixture({W:[3,4],monsters:[[10,8]],water:[[9,8]],circuits:[{id:'a',buttons:[p(2,7)]}],platforms:[{at:p(9,8),circuit:'a',activeWhen:'pressed'}]}),onto=stepDetailed(f.world,f.state,2);
 assert.deepEqual(onto.state.monsters,[p(9,8)]);assert.deepEqual(onto.state.platformActive,[true]);
 const removed=stepDetailed(f.world,select(f,'wizard',onto.state),1);assert.deepEqual(removed.state.monsters,[]);assert.deepEqual(removed.state.platformActive,[false]);assert.equal(removed.state.dead,false);assert.ok(!removed.phases.some(q=>q.kind==='hunt'));
});

test('selection, a refused walk and a reflection with no transfer do not pursue or attack',()=>{
 const f=fixture({walls:[[3,2]],monsters:[[10,5]]});
 for(const [action,data] of [[4,undefined],[5,undefined],[6,cellToPixel(f.state.heroes[1].at)],[6,p(0,0)]]){
  const d=stepDetailed(f.world,f.state,action,data);assert.deepEqual(d.state.monsters,f.state.monsters);assert.deepEqual(d.phases,[]);assert.equal(d.state.dead,false);
 }
});

test('pursuit gets three visible one-pixel frames and the whole accepted turn is one Undo entry',()=>{
 const f=fixture({monsters:[[10,5]]}),session=new TrioPuzzleSession([f.spec]),before=session.observe(),after=session.action(2);
 assert.equal(after.frames.length,6);assert.deepEqual(after.frameDurationsMs,[60,80,40,60,80,0]);assert.deepEqual(after.frames.at(-1),after.frame);
 const origin=cellToPixel(p(10,5));assert.equal(after.frames[3][origin.y][origin.x-1],8);assert.equal(after.frames[4][origin.y][origin.x-2],8);
 const expected=stepDetailed(f.world,f.state,2);assert.deepEqual(after.frame,renderWorld(f.world,expected.state));
 assert.deepEqual(session.undo(),before);assert.equal(session.observe().canUndo,false);
});

test('the last apparent goal arrival loses if the following pursuit contacts a hero',()=>{
 const f=fixture({W:[2,2],Z:[3,7],B:[3,12],goals:[[3,2],[17,7],[17,12]],monsters:[[5,2]]});
 // Goals may overlap starting heroes in author state; the text grammar keeps
 // one token per square, so replace only the compiled goal list in this test.
 const world={...f.world,goals:[p(3,2),p(3,7),p(3,12)]},d=stepDetailed(world,f.state,4);
 assert.deepEqual(d.phases.map(q=>q.kind),['walk','hunt','combat']);assert.equal(d.state.dead,true);assert.equal(d.state.complete,false);assert.equal(d.state.heroes[0].dead,true);
});

test('a pursuit kill is public GAME_OVER with combat frames and Undo restores the starting threat',()=>{
 const f=fixture({W:[2,2],monsters:[[5,2]]}),session=new TrioPuzzleSession([f.spec]),before=session.observe(),after=session.action(4);
 assert.equal(after.state,'GAME_OVER');assert.equal(after.frames.length,11);assert.equal(after.frameDurationsMs.at(-1),0);assert.deepEqual(after.frames.at(-1),after.frame);assert.deepEqual(session.undo(),before);
});
