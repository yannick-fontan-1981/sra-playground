import test from 'node:test';
import assert from 'node:assert/strict';
import {compileLevel,initialState,stepWorld,stepDetailed,planSwap,circuitPressed,gateClosed,renderWorld,WizardPuzzleSession,VECTORS,PALETTE} from '../dist/core.js';

const spec=(rows,extras={})=>({id:'wizard',title:'Wizard',rows,...extras});
const point=(level,x,y)=>({x:x+Math.floor((20-level.rows[0].length)/2),y:y+Math.floor((20-level.rows.length)/2)});
const setup=level=>{const w=compileLevel(level);return {w,s:initialState(w)};};
const gate=(x,y,circuit,direction='E',closedWhen='pressed')=>({at:{x,y},circuit,direction,closedWhen});
const circuit=(id,...buttons)=>({id,buttons:buttons.map(([x,y])=>({x,y}))});

test('directions exchange with the first actor and never push or pull a file',()=>{
 const level=spec(['##########','#W..o..o.#','#.......g#','##########']);
 const {w,s}=setup(level),plan=planSwap(w,s,'E'),next=stepWorld(w,s,4);
 assert.equal(plan.target,'stone');assert.equal(plan.reflections,0);
 assert.deepEqual(plan.to,point(level,4,1));
 assert.deepEqual(next.hero,point(level,4,1));
 assert.deepEqual(next.stones,[point(level,1,1),point(level,7,1)]);
 assert.deepEqual(s.stones,[point(level,4,1),point(level,7,1)],'source state remains immutable');
 const back=stepWorld(w,next,3);assert.deepEqual(back.hero,s.hero);assert.deepEqual(back.stones,s.stones);
});

test('an empty sight line walks one cell; a blocked direction only changes facing',()=>{
 const level=spec(['#######','#W....#','#....g#','#######']),{w,s}=setup(level);
 const walked=stepWorld(w,s,4);assert.deepEqual(walked.hero,point(level,2,1));
 const refused=stepWorld(w,s,1);assert.deepEqual(refused.hero,s.hero);assert.equal(refused.facing,'N');assert.equal(refused.failed,true);
 assert.equal(planSwap(w,s,'E'),null);
});

test('sight crosses open water while a normal step into water is refused',()=>{
 const level=spec(['#########','#W~~o...#','#.....g.#','#########']),{w,s}=setup(level);
 const next=stepWorld(w,s,4);assert.deepEqual(next.hero,point(level,4,1));assert.deepEqual(next.stones,[s.hero]);assert.equal(next.dead,false);
 const empty=spec(['#########','#W~~....#','#.....g.#','#########']),e=setup(empty);
 assert.equal(stepWorld(e.w,e.s,4).failed,true);
});

test('walls and closed doors stop sight; the Wizard falls back to a normal step',()=>{
 for(const row of ['#W.#.o..#','#W.D.o..#']){
  const level=spec(['#########',row,'#b....g.#','#########']),{w,s}=setup(level);
  assert.equal(planSwap(w,s,'E'),null);assert.deepEqual(stepWorld(w,s,4).hero,point(level,2,1));
 }
});

test('each reflective mirror face turns both incoming directions; its black back blocks both others',()=>{
 const turns={NE:{S:'E',W:'N'},NW:{S:'W',E:'N'},SE:{N:'E',W:'S'},SW:{N:'W',E:'S'}};
 const ids={N:1,S:2,W:3,E:4};
 for(const [facing,valid] of Object.entries(turns))for(const direction of ['N','S','W','E']){
  const d=VECTORS[direction],out=VECTORS[valid[direction]??'N'];
  const hero={x:4-d.x*2,y:4-d.y*2},stone={x:4+out.x*2,y:4+out.y*2};
  if(hero.x===stone.x&&hero.y===stone.y){stone.x=6;stone.y=6;}
  const rows=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));
  rows[7][7]='g';rows[hero.y][hero.x]='W';rows[stone.y][stone.x]='o';
  const level=spec(rows.map(r=>r.join('')),{mirrors:[{at:{x:4,y:4},facing}]}),{w,s}=setup(level),plan=planSwap(w,s,direction);
  if(valid[direction]){
   assert.equal(plan?.reflections,1,`${facing}, ${direction}`);
   assert.deepEqual(plan.to,point(level,stone.x,stone.y));
   assert.deepEqual(stepWorld(w,s,ids[direction]).hero,plan.to);
  }else{
   assert.equal(plan,null,`${facing}, ${direction} back`);
   assert.deepEqual(stepWorld(w,s,ids[direction]).hero,point(level,hero.x+d.x,hero.y+d.y));
  }
 }
});

test('two mirrors route one exchange around a wall and keep both mirror positions fixed',()=>{
 const level=spec(['#########','#W......#','#..##...#','#....o..#','#......g#','#########'],{mirrors:[{at:{x:3,y:1},facing:'SW'},{at:{x:3,y:3},facing:'NE'}]});
 // Give the vertical segment open floor; the off-path wall remains a barrier.
 level.rows[2]='#...#...#';
 const {w,s}=setup(level),plan=planSwap(w,s,'E');
 assert.equal(plan.reflections,2);assert.deepEqual(plan.to,point(level,5,3));
 assert.deepEqual(stepWorld(w,s,4).hero,plan.to);assert.equal(w.mirrors.length,2);
});

test('a ray returning to its Wizard terminates and a fixed mirror cannot be entered',()=>{
 const level=spec(['#########','#.......#','#.W.....#','#.......#','#.......#','#.......#','#......g#','#########'],{mirrors:[{at:{x:5,y:2},facing:'SW'},{at:{x:5,y:5},facing:'NW'},{at:{x:2,y:5},facing:'NE'}]});
 const {w,s}=setup(level);assert.equal(planSwap(w,s,'E'),null);
 const refused=stepWorld(w,s,4);assert.equal(refused.failed,true);assert.deepEqual(refused.hero,s.hero);assert.equal(refused.facing,'E');
 const beside={...s,hero:point(level,4,2)};
 assert.equal(stepWorld(w,beside,4).failed,true);
});

test('a complete four-mirror sight loop refuses the move instead of falling back to an empty adjacent floor',()=>{
 const level=spec(['#########','#.......#','#..W....#','#.......#','#.......#','#.......#','#......g#','#########'],{mirrors:[{at:{x:5,y:2},facing:'SW'},{at:{x:5,y:5},facing:'NW'},{at:{x:2,y:5},facing:'NE'},{at:{x:2,y:2},facing:'SE'}]});
 const {w,s}=setup(level),detail=stepDetailed(w,s,4);
 assert.equal(planSwap(w,s,'E'),null);assert.equal(detail.state.failed,true);
 assert.deepEqual(detail.state.hero,s.hero);assert.deepEqual(detail.phases,[]);
});

test('a monster is a stationary exchange target and weighs on a circuit',()=>{
 const level=spec(['#########','#W..m...#','#......g#','#########'],{circuits:[circuit('a',[1,1])],gates:[gate(6,2,'a','N','released')]});
 const {w,s}=setup(level),next=stepWorld(w,s,4);
 assert.deepEqual(next.hero,point(level,4,1));assert.deepEqual(next.monsters,[point(level,1,1)]);
 assert.equal(circuitPressed(w,next,'a'),true);assert.equal(next.dead,false);
 const walked=stepWorld(w,next,2);assert.deepEqual(walked.monsters,next.monsters,'monsters do not chase');
});

test('orthogonal monster contact kills, diagonal contact does not',()=>{
 const level=spec(['#######','#W....#','#..m..#','#....g#','#######']),{w,s}=setup(level);
 const diagonal=stepWorld(w,s,4);assert.equal(diagonal.dead,false);
 const contact=stepWorld(w,diagonal,2);assert.equal(contact.dead,true);assert.equal(contact.complete,false);
});

test('adjacent monsters eliminate each other simultaneously after a successful move',()=>{
 const level=spec(['#########','#W......#','#...mm..#','#......g#','#########']),{w,s}=setup(level),detail=stepDetailed(w,s,2);
 assert.equal(detail.state.monsters.length,0);assert.equal(detail.state.dead,false);
 assert.equal(detail.phases.at(-1).kind,'combat');
});

test('a monster killed in the same combat wave still attacks the adjacent Wizard',()=>{
 const level=spec(['#######','#W....#','#..mm.#','#....g#','#######']),{w,s}=setup(level),first=stepWorld(w,s,4);
 // The first move is diagonal; both monsters die immediately. Place the Wizard
 // into the contact geometry before that first simultaneous wave instead.
 const contact={...s,hero:point(level,2,1)};
 const next=stepWorld(w,contact,2);assert.equal(next.dead,true);assert.equal(next.monsters.length,0);
 assert.equal(first.monsters.length,0);
});

test('presses settle before contact attacks, so a monster can be pushed away in time',()=>{
 const level=spec(['#########','#.......#','#..m....#','#.W.....#','#......g#','#########'],{circuits:[circuit('a',[2,2])],gates:[gate(3,2,'a')]});
 const {w,s}=setup(level),detail=stepDetailed(w,s,1);
 assert.deepEqual(detail.state.hero,point(level,2,2));assert.deepEqual(detail.state.monsters,[point(level,4,2)]);
 assert.equal(detail.state.dead,false);assert.deepEqual(detail.phases.map(p=>p.kind),['walk','piston']);
});

test('a monster removed by combat releases its plate and closes the associated released-mode press immediately',()=>{
 const level=spec(['#########','#W......#','#...mm..#','#......g#','#########'],{circuits:[circuit('a',[4,2])],gates:[gate(6,1,'a','S','released')]});
 const {w,s}=setup(level);assert.equal(gateClosed(w,s,0),false);
 const next=stepWorld(w,s,2);assert.equal(next.monsters.length,0);assert.equal(gateClosed(w,next,0),true);
});

test('a monster forced into water disappears without creating a platform',()=>{
 const level=spec(['#########','#..m~...#','#W.b....#','#......g#','#########'],{circuits:[circuit('a',[3,2])],gates:[gate(3,1,'a')]});
 const {w,s}=setup(level),next=stepWorld(w,stepWorld(w,s,4),4);
 assert.equal(next.monsters.length,0);assert.equal(next.supports.length,0);assert.equal(next.dead,false);
});

test('undo restores a lethal exchange including facing and monster positions; reset and restart recover play',()=>{
 const level=spec(['#######','#Wm...#','#....g#','#######']),session=new WizardPuzzleSession([level]);
 const before=session.observe(),dead=session.action(4);assert.equal(dead.state,'GAME_OVER');assert.equal(dead.canUndo,true);
 assert.deepEqual(session.action(1).frame,dead.frame);assert.deepEqual(session.undo(),before);
 session.action(4);assert.deepEqual(session.reset(),before);assert.deepEqual(session.restart(),before);
});

test('only four directions are available and internal targeting, monsters, circuits and phases stay private',()=>{
 const level=spec(['#######','#W..o.#','#....g#','#######']),session=new WizardPuzzleSession([level]);
 for(const invalid of [0,5,-1,1.5,NaN])assert.throws(()=>session.action(invalid),RangeError);
 const ob=session.action(4);assert.deepEqual(ob.availableActionIds,[1,2,3,4]);assert.equal(ob.gameCode,'SS04');
 for(const key of ['hero','stones','monsters','mirrors','ray','plan','stateData','circuits','gates','phases'])assert.equal(key in ob,false);
 assert.equal(ob.palette[15],PALETTE[15]);assert.ok(ob.frames.every(f=>f.length===64&&f.every(r=>r.length===64&&r.every(c=>Number.isInteger(c)&&c>=0&&c<16))));
 assert.equal(renderWorld(compileLevel(level),initialState(compileLevel(level))).flat().includes(1),false,'no resting preview');
});

test('victory requires every level even when selected out of order; undo can reverse a level transition',()=>{
 const levels=[1,2,3].map(n=>({id:`level-${n}`,title:`Level ${n}`,rows:['#####','#Wg.#','#####']}));
 const session=new WizardPuzzleSession(levels);session.selectLevel(3);
 const third=session.action(4);assert.equal(third.levelsCompleted,1);assert.equal(third.level,1);assert.equal(third.state,'NOT_FINISHED');
 const undone=session.undo();assert.equal(undone.level,3);assert.equal(undone.levelsCompleted,0);
 session.action(4);session.action(4);const won=session.action(4);assert.equal(won.state,'WIN');assert.equal(won.levelsCompleted,3);
 assert.equal(session.reset().state,'NOT_FINISHED');assert.equal(session.restart().levelsCompleted,0);
});

test('invalid mirrors and overlapping circuit devices are rejected before gameplay',()=>{
 const rows=['#######','#W...g#','#.....#','#######'];
 for(const mirrors of [
  [{at:{x:2,y:2},facing:'E'}],
  [{at:{x:0,y:0},facing:'NE'}],
  [{at:{x:1,y:1},facing:'NE'}],
  [{at:{x:2,y:2},facing:'NE'},{at:{x:2,y:2},facing:'SW'}],
 ])assert.throws(()=>compileLevel(spec(rows,{mirrors})));
 assert.throws(()=>compileLevel(spec(rows,{mirrors:[{at:{x:2,y:2},facing:'NE'}],circuits:[circuit('a',[2,2])]})));
});


test('combat cannot leave a living actor trapped inside a newly closed legacy door',()=>{
 const level=spec(['#########','#.WD....#','#.......#','#..mm...#','#......g#','#########'],{circuits:[circuit('a',[3,3])]});
 const {w,s}=setup(level),next=stepWorld(w,s,4);
 assert.equal(next.failed,true);assert.deepEqual(next.hero,s.hero);
 assert.deepEqual(next.monsters,s.monsters,'the legacy-door conflict refuses the complete atomic action');
});

test('a closed press on the destination preserves yellow corners and visible pink gate edges',()=>{
 const level=spec(['#######','#W..g.#','#b....#','#######'],{circuits:[circuit('a',[1,2])],gates:[gate(4,1,'a','N','released')]});
 const {w,s}=setup(level),p=point(level,4,1),x=2+p.x*3,y=2+p.y*3,closed=renderWorld(w,s);
 assert.equal(closed[y][x],11);assert.equal(closed[y][x+2],11);assert.equal(closed[y+2][x],11);assert.equal(closed[y+2][x+2],11);
 assert.equal(closed[y+2][x+1],7);assert.equal(closed[y+1][x+1],5);assert.equal(closed[y][x+1],0,'direction mark stays visible');
 const next=stepWorld(w,s,2),open=renderWorld(w,next);assert.equal(gateClosed(w,next,0),false);
 assert.equal(open[y][x+1],11);assert.equal(open[y+2][x+1],11);assert.equal(open[y+1][x+1],3);
});
