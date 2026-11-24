import test from 'node:test';
import assert from 'node:assert/strict';
import {TrioPuzzleSession,cellToPixel} from '../dist/core.js';
import {observeLesson,TUTORIAL_LEVEL,visibleHeroes} from '../dist/tutorial.js';

function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'#':'.'));
 for(const [name,char]of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m']])for(const [x,y]of o[name]??[])rows[y][x]=char;
 for(const[x,y]of [[17,2],[17,7],[17,12]])rows[y][x]='g';
 for(const[role,at]of [['W',o.W??[2,2]],['Z',o.Z??[2,10]],['B',o.B??[6,6]]])rows[at[1]][at[0]]=role;
 return{id:o.id??'public-tutorial',title:'Public tutorial regression',rows:rows.map(r=>r.join('')),facing:'E',circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[]};
}
function observedAction(session,id,data){
 const learned=new Set(),before=session.observe(),after=session.action(id,data);
 observeLesson(learned,before,after,id);return learned;
}
function tutorialSession(spec){
 const session=new TrioPuzzleSession(Array.from({length:TUTORIAL_LEVEL},(_,index)=>({...spec,id:`${spec.id}-${index+1}`})));
 session.selectLevel(TUTORIAL_LEVEL);return session;
}
const select=(session,x,y)=>session.action(6,cellToPixel({x,y}));

test('exchanging Warrior beside an idle Bard does not teach extraction of the Bard',()=>{
 const s=tutorialSession(fixture({Z:[2,4],W:[5,4],B:[6,5],stones:[[6,6]]}));select(s,2,4);
 const learned=observedAction(s,4);assert.ok(learned.has('wizard-partner'));assert.ok(!learned.has('release-by-swap'));
});
test('exchanging Bard while his nearby crate stays teaches departure without song',()=>{
 const s=tutorialSession(fixture({Z:[2,4],W:[2,12],B:[5,4],stones:[[5,5]]}));select(s,2,4);
 const learned=observedAction(s,4);assert.ok(learned.has('release-by-swap'));assert.ok(!learned.has('bard-song'));
});
test('moving an existing water support is not reported as creating a new one',()=>{
 const s=tutorialSession(fixture({B:[5,5],supports:[[5,7]],water:[[6,7]]}));select(s,5,5);
 const learned=observedAction(s,4);assert.ok(learned.has('support-slide'));assert.ok(!learned.has('water-support'));
});
test('a blocked Bard awards no song or movement discovery',()=>{
 const s=tutorialSession(fixture({B:[5,5],walls:[[6,5]],stones:[[5,7]]}));select(s,5,5);
 assert.deepEqual([...observedAction(s,4)],[]);
});
test('pushing Bard teaches the partner push without awarding a passive song',()=>{
 const s=tutorialSession(fixture({W:[4,4],B:[5,4],stones:[[5,6]]}));
 const learned=observedAction(s,4);assert.ok(learned.has('partner-push'));assert.ok(!learned.has('bard-song'));assert.ok(!learned.has('support-slide'));
});
test('the same visible push in another room awards no discovery',()=>{
 const spec=fixture({W:[4,4],stones:[[5,4]]});
 const s=new TrioPuzzleSession([spec,{...spec,id:'other-room'}]);s.selectLevel(TUTORIAL_LEVEL===1?2:1);
 assert.deepEqual([...observedAction(s,4)],[]);
});

test('a visible train push teaches the whole file while a single crate does not',()=>{
 const train=tutorialSession(fixture({W:[2,2],stones:[[3,2],[4,2]]}));
 assert.ok(observedAction(train,4).has('train-push'));
 const single=tutorialSession(fixture({W:[2,2],stones:[[3,2]]}));
 assert.ok(!observedAction(single,4).has('train-push'));
});
test('red guards remain distinct from Warrior and stay still during unrelated walking',()=>{
 const s=tutorialSession(fixture({monsters:[[10,2]]}));
 assert.equal(visibleHeroes(s.observe().frame).filter(h=>h.kind==='warrior').length,1);
 const learned=observedAction(s,2);assert.ok(learned.has('monster-still'));assert.ok(!learned.has('monster-song'));assert.ok(!learned.has('press'));
});
test('a song visibly moving a monster teaches its cause rather than stillness',()=>{
 const s=tutorialSession(fixture({B:[5,5],monsters:[[7,4]]}));select(s,5,5);
 const learned=observedAction(s,2);assert.ok(learned.has('monster-song'));assert.ok(learned.has('bard-song'));assert.ok(!learned.has('monster-still'));assert.ok(!learned.has('monster-press'));
});
test('selection alone does not claim a monster movement or a demonstration of walking',()=>{
 const s=tutorialSession(fixture({monsters:[[10,2]]}));
 const learned=observedAction(s,6,cellToPixel({x:6,y:6}));
 assert.ok(learned.has('select'));assert.ok(!learned.has('monster-still'));assert.ok(!learned.has('monster-song'));assert.ok(!learned.has('monster-press'));
});
test('a drowning press is recognized from two pixel translations despite no final monster sprite',()=>{
 const s=tutorialSession(fixture({monsters:[[10,5]],water:[[11,5]],circuits:[{id:'capture',buttons:[{x:3,y:2}],color:15}],gates:[{at:{x:10,y:5},circuit:'capture',direction:'E',closedWhen:'pressed'}]}));
 const learned=observedAction(s,4);assert.ok(learned.has('press'));assert.ok(learned.has('monster'));assert.ok(learned.has('monster-press'));assert.ok(!learned.has('monster-song'));assert.ok(!learned.has('monster-still'));
});
