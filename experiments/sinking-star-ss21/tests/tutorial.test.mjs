import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {QuartetPuzzleSession,cellToPixel} from '../dist/core.js';
import {observeLesson,TUTORIAL_LEVEL,visibleHeroes,lessonIds,heroSelection,actionFeedback} from '../dist/tutorial.js';

function fixture(o={}){
 const rows=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'#':'.'));
 for(const[name,char]of [['walls','#'],['water','~'],['supports','s'],['stones','o'],['monsters','m']])for(const[x,y]of o[name]??[])rows[y][x]=char;
 for(const[x,y]of [[17,2],[17,7],[17,12],[17,17]])rows[y][x]='g';
 for(const[role,at]of [['M',o.M??[2,2]],['W',o.W??[2,6]],['T',o.T??[2,10]],['Z',o.Z??[6,6]]])rows[at[1]][at[0]]=role;
 return{id:o.id??'public-tutorial',title:'Public tutorial regression',mode:'quartet',rows:rows.map(r=>r.join('')),facing:'E',circuits:o.circuits??[],gates:o.gates??[],platforms:o.platforms??[],mirrors:o.mirrors??[]};
}
const session=spec=>new QuartetPuzzleSession([spec]);
const select=(s,x,y)=>s.action(6,cellToPixel({x,y}));
function observed(s,id,data){const learned=new Set(),before=s.observe(),after=s.action(id,data);observeLesson(learned,before,after,id);return{learned,before,after};}
const publicOnly=o=>({level:o.level,frame:structuredClone(o.frame),frames:structuredClone(o.frames),levelsCompleted:o.levelsCompleted});

test('31 discoveries and four selectable public hero sprites',()=>{
 assert.equal(TUTORIAL_LEVEL,1);assert.equal(lessonIds.length,31);assert.equal(new Set(lessonIds).size,31);
 const s=session(fixture({monsters:[[10,2]],circuits:[{id:'green',buttons:[{x:12,y:5}],color:14}]}));
 assert.deepEqual(visibleHeroes(s.observe().frame).map(h=>h.kind).sort(),['merchant','thief','warrior','wizard']);
 assert.equal(visibleHeroes(s.observe().frame).find(h=>h.selected).kind,'merchant');
 for(const kind of ['warrior','thief','wizard','merchant']){s.action(6,heroSelection(s.observe().frame));assert.equal(visibleHeroes(s.observe().frame).find(h=>h.selected).kind,kind);}
});
test('the complete route earns every lesson using copied public pixels only',()=>{
 const d=JSON.parse(readFileSync(new URL('../reference/level1-design.json',import.meta.url),'utf8')),s=session(d.spec),learned=new Set();
 for(const a of d.actions){const before=publicOnly(s.observe()),after=publicOnly(s.action(a.id,a.data));observeLesson(learned,before,after,a.id);}
 assert.equal(s.observe().state,'WIN');assert.deepEqual([...learned].sort(),[...lessonIds].sort());
});
test('Merchant single push differs from a refused two-piece file',()=>{
 assert.ok(observed(session(fixture({stones:[[3,2]]})),4).learned.has('merchant-push'));
 assert.deepEqual([...observed(session(fixture({stones:[[3,2],[4,2]]})),4).learned],[]);
});
test('Warrior moving crates and a partner demonstrates a mixed file',()=>{
 const s=session(fixture({W:[4,5],T:[7,5],stones:[[5,5],[6,5]]}));select(s,4,5);
 const {learned}=observed(s,4);for(const id of ['warrior-push','chain','mixed-chain','partner-push'])assert.ok(learned.has(id),id);
 assert.ok(!learned.has('merchant-push'));assert.ok(!learned.has('thief-pull'));
});
test('one crate pushed by Warrior does not demonstrate a mixed file',()=>{
 const s=session(fixture({W:[4,5],stones:[[5,5]]}));select(s,4,5);
 const {learned}=observed(s,4);assert.ok(learned.has('warrior-push'));for(const id of ['chain','mixed-chain','partner-push'])assert.ok(!learned.has(id));
});
test('Thief separates the rear neighbour from a file, but a lone pull does not teach separation',()=>{
 for(const extra of [true,false]){
  const s=session(fixture({T:[5,5],stones:extra?[[4,5],[3,5]]:[[4,5]]}));select(s,5,5);
  const {learned}=observed(s,4);assert.ok(learned.has('thief-pull'));assert.equal(learned.has('single-pull'),extra);assert.ok(!learned.has('partner-pull'));
 }
});
test('blocked Thief earns neither movement nor traction',()=>{
 const s=session(fixture({T:[5,5],stones:[[4,5],[6,5]]}));select(s,5,5);assert.deepEqual([...observed(s,4).learned],[]);
});
test('pulling a partner does not invoke that partner ability',()=>{
 const s=session(fixture({T:[6,4],M:[5,4],stones:[[4,4]]}));select(s,6,4);
 const {learned}=observed(s,4);assert.ok(learned.has('partner-pull'));assert.ok(!learned.has('merchant-push'));assert.ok(!learned.has('wizard-swap'));
});
test('replacing Thief on a button teaches a handover without a gate pulse',()=>{
 const s=session(fixture({T:[5,5],stones:[[4,5]],circuits:[{id:'relay',buttons:[{x:5,y:5}]}],gates:[{at:{x:14,y:5},circuit:'relay',direction:'E',closedWhen:'released'}]}));select(s,5,5);
 const {learned}=observed(s,4);assert.ok(learned.has('relay-weight'));assert.ok(!learned.has('gate'));assert.ok(!learned.has('press'));
});
test('pushing Wizard off a button keeps its weight without casting a spell',()=>{
 const s=session(fixture({M:[4,4],Z:[5,4],stones:[[10,4]],circuits:[{id:'relay',buttons:[{x:5,y:4}]}],gates:[{at:{x:14,y:5},circuit:'relay',direction:'E',closedWhen:'released'}]}));
 const {learned}=observed(s,4);for(const id of ['merchant-push','partner-push','relay-weight'])assert.ok(learned.has(id));
 assert.ok(!learned.has('wizard-swap'));assert.ok(!learned.has('gate'));
});
test('handling a mirror is distinct from reflecting its contents',()=>{
 for(const [kind,roles,at]of [['merchant',{M:[4,4]},null],['thief',{T:[6,4]},[6,4]]]){
  const s=session(fixture({...roles,mirrors:[{at:{x:5,y:4},facing:'NE'}]}));if(at)select(s,...at);
  const {learned}=observed(s,4);assert.ok(learned.has('mirror-motion'));assert.ok(learned.has(kind==='merchant'?'merchant-push':'thief-pull'));assert.ok(!learned.has('mirror'));
 }
});
test('walking onto a fixed support does not create another support',()=>{
 const {learned}=observed(session(fixture({M:[4,5],supports:[[5,5]]})),4);assert.ok(learned.has('cross-support'));assert.ok(!learned.has('water-support'));
});
test('Wizard first target and water crossing are identified from the visible line',()=>{
 const s=session(fixture({Z:[5,5],stones:[[8,5],[10,5]],water:[[6,5]]}));select(s,5,5);
 const {learned}=observed(s,4);for(const id of ['wizard-swap','wizard-first','wizard-water'])assert.ok(learned.has(id));
 for(const id of ['wizard-bend','wizard-walk','water-support'])assert.ok(!learned.has(id));
});
test('a farther occupant behind a wall does not demonstrate first-target masking',()=>{
 const s=session(fixture({Z:[5,5],stones:[[8,5],[12,5]],walls:[[10,5]]}));select(s,5,5);
 const {learned}=observed(s,4);assert.ok(learned.has('wizard-swap'));assert.ok(!learned.has('wizard-first'));
});
test('partner exchange is recognized without implying a walk',()=>{
 const s=session(fixture({Z:[5,5],M:[8,5]}));select(s,5,5);const {learned}=observed(s,4);
 assert.ok(learned.has('wizard-partner'));assert.ok(!learned.has('wizard-walk'));assert.ok(!learned.has('merchant-push'));
});
test('a white mirror face bends the spell independently of global reflection',()=>{
 const s=session(fixture({Z:[5,5],stones:[[8,8]],mirrors:[{at:{x:5,y:8},facing:'NE'}]}));select(s,5,5);
 const {learned}=observed(s,2);assert.ok(learned.has('wizard-bend'));assert.ok(!learned.has('mirror'));assert.ok(!learned.has('wizard-walk'));
});
test('handling in a later room earns no tutorial discovery',()=>{
 const f=fixture({stones:[[3,2]]}),s=new QuartetPuzzleSession([f,{...f,id:'later'}]);s.selectLevel(2);assert.deepEqual([...observed(s,4).learned],[]);
});
test('red monster stays distinct from Warrior during unrelated walking',()=>{
 const s=session(fixture({monsters:[[10,2]]}));assert.equal(visibleHeroes(s.observe().frame).length,4);
 const {learned}=observed(s,2);assert.ok(learned.has('monster-still'));assert.ok(!learned.has('monster-press'));assert.ok(!learned.has('press'));
});
test('selection alone is not evidence of walking or monster movement',()=>{
 const s=session(fixture({monsters:[[10,2]]}));assert.deepEqual([...observed(s,6,cellToPixel({x:6,y:6})).learned],['select']);
});
test('a drowning press is recognized before the final monster sprite disappears',()=>{
 const s=session(fixture({monsters:[[10,5]],water:[[11,5]],circuits:[{id:'capture',buttons:[{x:3,y:2}],color:15}],gates:[{at:{x:10,y:5},circuit:'capture',direction:'E',closedWhen:'pressed'}]}));
 const {learned,before,after}=observed(s,4);for(const id of ['press','monster','monster-press'])assert.ok(learned.has(id));
 assert.ok(!learned.has('monster-still'));assert.ok(!learned.has('merchant-push'));assert.match(actionFeedback(before,after,4),/presse.*monstre/i);
});
test('a press transporting Thief cannot teach active traction',()=>{
 const s=session(fixture({T:[10,5],stones:[[9,5]],circuits:[{id:'relay',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:5},circuit:'relay',direction:'E',closedWhen:'pressed'}]}));
 const {learned}=observed(s,4);assert.ok(learned.has('press'));assert.ok(!learned.has('thief-pull'));assert.ok(!learned.has('merchant-push'));
});
test('a returning spell earns no successful exchange or walking discovery',()=>{
 const mirrors=[{at:{x:6,y:3},facing:'SE'},{at:{x:12,y:3},facing:'SW'},{at:{x:12,y:10},facing:'NW'},{at:{x:6,y:10},facing:'NE'}];
 const s=session(fixture({Z:[6,6],mirrors}));select(s,6,6);const {learned,before,after}=observed(s,1);
 assert.deepEqual([...learned],[]);assert.match(actionFeedback(before,after,1),/rayon revient/);
});
