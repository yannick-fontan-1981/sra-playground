import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QuartetPuzzleSession,cellToPixel} from '../dist/core.js';
import {observeLesson,TUTORIAL_LEVEL,visibleHeroes,lessonIds,heroSelection,actionFeedback} from '../dist/tutorial.js';

function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'#':'.'));
 for(const [name,char]of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m']])for(const [x,y]of o[name]??[])rows[y][x]=char;
 for(const[x,y]of [[17,2],[17,7],[17,12],[17,17]])rows[y][x]='g';
 for(const[role,at]of [['M',o.M??[2,2]],['W',o.W??[2,17]],['T',o.T??[2,10]],['B',o.B??[6,6]]])rows[at[1]][at[0]]=role;
 return{id:o.id??'public-tutorial',title:'Public tutorial regression',rows:rows.map(r=>r.join('')),facing:'E',circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[],mirrors:o.mirrors??[]};
}
function observedAction(session,id,data){
 const learned=new Set(),before=session.observe(),after=session.action(id,data);
 observeLesson(learned,before,after,id);return learned;
}
function tutorialSession(spec){
 const session=new QuartetPuzzleSession(Array.from({length:TUTORIAL_LEVEL},(_,index)=>({...spec,id:`${spec.id}-${index+1}`})));
 session.selectLevel(TUTORIAL_LEVEL);return session;
}
const select=(session,x,y)=>session.action(6,cellToPixel({x,y}));

test('the first workshop exposes thirty-three distinct discoveries and four public hero colours',()=>{
 assert.equal(TUTORIAL_LEVEL,1);assert.equal(lessonIds.length,33);assert.equal(new Set(lessonIds).size,33);
 const s=tutorialSession(fixture({monsters:[[10,2]],circuits:[{id:'green',buttons:[{x:12,y:5}],color:14},{id:'orange',buttons:[{x:12,y:7}],color:12}]}));
 assert.deepEqual(visibleHeroes(s.observe().frame).map(h=>h.kind).sort(),['bard','merchant','thief','warrior']);
 assert.equal(visibleHeroes(s.observe().frame).find(h=>h.selected).kind,'merchant');
 for(const kind of ['warrior','thief','bard','merchant']){const target=heroSelection(s.observe().frame);s.action(6,target);assert.equal(visibleHeroes(s.observe().frame).find(h=>h.selected).kind,kind);}
});

test('a Merchant single push teaches handling, while a blocked two-piece file teaches nothing',()=>{
 const single=tutorialSession(fixture({stones:[[3,2]]}));assert.ok(observedAction(single,4).has('merchant-push'));
 const file=tutorialSession(fixture({stones:[[3,2],[4,2]]}));assert.deepEqual([...observedAction(file,4)],[]);
});

test('Thief pulling the nearest crate leaves the second one and teaches single traction',()=>{
 const s=tutorialSession(fixture({T:[5,5],stones:[[4,5],[3,5]]}));select(s,5,5);
 const learned=observedAction(s,4);for(const id of ['move','thief-pull','single-pull'])assert.ok(learned.has(id));
 assert.ok(!learned.has('merchant-push'));assert.ok(!learned.has('partner-pull'));
});

test('a lone pull does not claim a demonstration of separating a rear file',()=>{
 const s=tutorialSession(fixture({T:[5,5],stones:[[4,5]]}));select(s,5,5);
 const learned=observedAction(s,4);assert.ok(learned.has('thief-pull'));assert.ok(!learned.has('single-pull'));
});

test('a blocked Thief cannot earn a pull or move discovery',()=>{
 const s=tutorialSession(fixture({T:[5,5],stones:[[4,5],[6,5]]}));select(s,5,5);
 assert.deepEqual([...observedAction(s,4)],[]);
});

test('pulling Merchant beside an idle Bard does not teach extraction of the Bard',()=>{
 const s=tutorialSession(fixture({T:[6,4],M:[5,4],B:[5,5],stones:[[5,6]]}));select(s,6,4);
 const learned=observedAction(s,4);assert.ok(learned.has('partner-pull'));assert.ok(!learned.has('release-by-pull'));
});

test('pulling Bard while his nearby crate stays teaches departure without song',()=>{
 const s=tutorialSession(fixture({T:[6,4],M:[2,12],B:[5,4],stones:[[5,5]]}));select(s,6,4);
 const learned=observedAction(s,4);assert.ok(learned.has('partner-pull'));assert.ok(learned.has('release-by-pull'));assert.ok(!learned.has('bard-song'));
});

test('pulling a crate onto the Thief button demonstrates weight handover without a gate pulse',()=>{
 const s=tutorialSession(fixture({T:[5,5],stones:[[4,5]],circuits:[{id:'relay',buttons:[{x:5,y:5}]}],gates:[{at:{x:14,y:5},circuit:'relay',direction:'E',closedWhen:'released'}]}));select(s,5,5);
 const learned=observedAction(s,4);assert.ok(learned.has('thief-pull'));assert.ok(learned.has('relay-weight'));assert.ok(!learned.has('gate'));assert.ok(!learned.has('press'));
});

test('pushing a partner off a button replaces its weight during the same move',()=>{
 const s=tutorialSession(fixture({M:[4,4],T:[5,4],circuits:[{id:'relay',buttons:[{x:5,y:4}]}],gates:[{at:{x:14,y:5},circuit:'relay',direction:'E',closedWhen:'released'}]}));
 const learned=observedAction(s,4);assert.ok(learned.has('partner-push'));assert.ok(learned.has('relay-weight'));assert.ok(!learned.has('thief-pull'));assert.ok(!learned.has('gate'));
});

test('a mirror can be visibly handled by either Merchant or Thief',()=>{
 for(const [kind,positions,mirror,selectAt] of [['merchant',{M:[4,4]},[5,4],null],['thief',{T:[6,4]},[5,4],[6,4]]]){
  const s=tutorialSession(fixture({...positions,mirrors:[{at:{x:mirror[0],y:mirror[1]},facing:'NE'}]}));if(selectAt)select(s,...selectAt);
  const learned=observedAction(s,4);assert.ok(learned.has('mirror-motion'));assert.ok(learned.has(kind==='merchant'?'merchant-push':'thief-pull'));assert.ok(!learned.has('mirror'));
 }
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
 const s=tutorialSession(fixture({M:[4,4],B:[5,4],stones:[[5,6]]}));
 const learned=observedAction(s,4);assert.ok(learned.has('partner-push'));assert.ok(!learned.has('bard-song'));assert.ok(!learned.has('support-slide'));assert.ok(!learned.has('partner-pull'));
});

test('the same visible push in another room awards no discovery',()=>{
 const spec=fixture({M:[4,4],stones:[[5,4]]}),s=new QuartetPuzzleSession([spec,{...spec,id:'other-room'}]);s.selectLevel(2);
 assert.deepEqual([...observedAction(s,4)],[]);
});

test('red monsters remain distinct from the red Warrior and the other heroes and stay still during unrelated walking',()=>{
 const s=tutorialSession(fixture({monsters:[[10,2]],circuits:[{id:'red',buttons:[{x:14,y:14}],color:8}]}));
 assert.equal(visibleHeroes(s.observe().frame).length,4);
 assert.deepEqual(visibleHeroes(s.observe().frame).find(h=>h.kind==='warrior'),{x:2,y:17,kind:'warrior',selected:false});
 const learned=observedAction(s,2);assert.ok(learned.has('monster-still'));assert.ok(!learned.has('monster-song'));assert.ok(!learned.has('press'));
});

test('a song visibly moving a monster teaches its cause rather than stillness',()=>{
 const s=tutorialSession(fixture({B:[5,5],monsters:[[7,4]]}));select(s,5,5);
 const learned=observedAction(s,2);assert.ok(learned.has('monster-song'));assert.ok(learned.has('bard-song'));assert.ok(!learned.has('monster-still'));assert.ok(!learned.has('monster-press'));
});

test('selection alone does not claim a monster movement or walking demonstration',()=>{
 const s=tutorialSession(fixture({monsters:[[10,2]]})),learned=observedAction(s,6,cellToPixel({x:6,y:6}));
 assert.deepEqual([...learned],['select']);
});

test('a drowning press is recognized from two pixel translations despite no final monster sprite',()=>{
 const s=tutorialSession(fixture({monsters:[[10,5]],water:[[11,5]],circuits:[{id:'capture',buttons:[{x:3,y:2}],color:15}],gates:[{at:{x:10,y:5},circuit:'capture',direction:'E',closedWhen:'pressed'}]}));
 const learned=observedAction(s,4);assert.ok(learned.has('press'));assert.ok(learned.has('monster'));assert.ok(learned.has('monster-press'));assert.ok(!learned.has('monster-song'));assert.ok(!learned.has('monster-still'));assert.ok(!learned.has('merchant-push'));
});

test('a press transporting Thief does not earn the active pull discovery',()=>{
 const s=tutorialSession(fixture({T:[10,5],stones:[[9,5]],circuits:[{id:'relay',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:5},circuit:'relay',direction:'E',closedWhen:'pressed'}]}));
 const learned=observedAction(s,4);assert.ok(learned.has('press'));assert.ok(!learned.has('thief-pull'));assert.ok(!learned.has('merchant-push'));
});

test('a returning geometric layout does not turn Thief movement into a ranged power',()=>{
 const s=tutorialSession(fixture({T:[6,6],B:[2,12],mirrors:[{at:{x:6,y:3},facing:'SE'},{at:{x:12,y:3},facing:'SW'},{at:{x:12,y:10},facing:'NW'},{at:{x:6,y:10},facing:'NE'}]}));
 select(s,6,6);const before=s.observe(),after=s.action(1),learned=new Set();observeLesson(learned,before,after,1);
 assert.equal(after.frames.length,3);assert.deepEqual(visibleHeroes(after.frame).find(h=>h.kind==='thief'),{kind:'thief',x:6,y:5,selected:true});assert.deepEqual([...learned],['move']);assert.match(actionFeedback(before,after,1),/sans pièce à tirer/);
});

test('the real first workshop earns all 33 discoveries from its 321 public inputs',()=>{
 const design=JSON.parse(readFileSync(new URL('../reference/level1-design.json',import.meta.url),'utf8'));
 assert.equal(design.spec.title,'L’école des cortèges');assert.equal(design.actions.length,321);
 const session=new QuartetPuzzleSession([design.spec]),learned=new Set();
 for(const {id,data} of design.actions){const before=session.observe(),after=session.action(id,data);observeLesson(learned,before,after,id);}
 assert.equal(session.observe().state,'WIN');assert.deepEqual(lessonIds.filter(id=>learned.has(id)),[...lessonIds]);
});

test('the complete workshop route awards no discoveries outside level 1',()=>{
 const design=JSON.parse(readFileSync(new URL('../reference/level1-design.json',import.meta.url),'utf8'));
 const session=new QuartetPuzzleSession([fixture({id:'untouched-room'}),design.spec]),learned=new Set();session.selectLevel(2);
 for(const {id,data} of design.actions){const before=session.observe(),after=session.action(id,data);observeLesson(learned,before,after,id);assert.equal(learned.size,0);}
 assert.equal(session.observe().levelsCompleted,1);
});

test('Warrior single, file and mixed-file discoveries distinguish what visibly moved',()=>{
 for(const [options,expected] of [
  [{W:[4,4],stones:[[5,4]]},['warrior-push']],
  [{W:[4,4],stones:[[5,4],[6,4]]},['warrior-push','file-push']],
  [{W:[4,4],B:[5,4],stones:[[6,4],[5,6]]},['warrior-push','file-push','mixed-file','partner-push']],
 ]){
  const session=tutorialSession(fixture(options));select(session,4,4);const learned=observedAction(session,4);
  for(const id of ['warrior-push','file-push','mixed-file','partner-push'])assert.equal(learned.has(id),expected.includes(id),id);
  for(const id of ['merchant-push','thief-pull','bard-song','support-slide'])assert.equal(learned.has(id),false,id);
 }
});

test('a blocked Warrior file awards no push, file or movement discovery',()=>{
 const session=tutorialSession(fixture({W:[4,4],stones:[[5,4],[6,4]],walls:[[7,4]]}));select(session,4,4);
 assert.deepEqual([...observedAction(session,4)],[]);
});

test('a Bard carrying Warrior and cargo teaches song without a Warrior or Merchant push',()=>{
 const session=tutorialSession(fixture({B:[5,5],W:[6,5],stones:[[7,5]]}));select(session,5,5);
 const before=session.observe(),after=session.action(4),learned=new Set();observeLesson(learned,before,after,4);
 assert.deepEqual(visibleHeroes(after.frame).find(h=>h.kind==='warrior'),{x:7,y:5,kind:'warrior',selected:false});
 for(const id of ['bard-song','partner-song'])assert.equal(learned.has(id),true,id);
 for(const id of ['warrior-push','file-push','mixed-file','merchant-push','partner-push'])assert.equal(learned.has(id),false,id);
 assert.match(actionFeedback(before,after,4),/chant entraîne aussi un partenaire/);
});

test('a press transporting the Warrior does not claim his active file push',()=>{
 const session=tutorialSession(fixture({W:[10,5],stones:[[11,5]],circuits:[{id:'relay',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:5},circuit:'relay',direction:'E',closedWhen:'pressed'}]}));
 const learned=observedAction(session,4);assert.ok(learned.has('press'));
 for(const id of ['warrior-push','file-push','mixed-file','merchant-push'])assert.equal(learned.has(id),false,id);
});

test('Warrior visibly moving a mirror also teaches mirror handling',()=>{
 const session=tutorialSession(fixture({W:[4,4],mirrors:[{at:{x:5,y:4},facing:'NE'}]}));select(session,4,4);
 const learned=observedAction(session,4);assert.ok(learned.has('warrior-push'));assert.ok(learned.has('mirror-motion'));assert.ok(!learned.has('mirror'));
});

test('Warrior replacing a partner on a button demonstrates an uninterrupted weight handover',()=>{
 const session=tutorialSession(fixture({W:[4,4],M:[5,4],circuits:[{id:'relay',buttons:[{x:5,y:4}]}],gates:[{at:{x:14,y:5},circuit:'relay',direction:'E',closedWhen:'released'}]}));select(session,4,4);
 const learned=observedAction(session,4);for(const id of ['warrior-push','partner-push','relay-weight'])assert.ok(learned.has(id),id);
 assert.ok(!learned.has('gate'));assert.ok(!learned.has('press'));assert.ok(!learned.has('merchant-push'));
});
