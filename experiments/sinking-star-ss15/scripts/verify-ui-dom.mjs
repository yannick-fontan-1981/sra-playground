/** Actual compiled HTML, DOM input, canvas pixel buffers and controlled timers. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS15_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {lessonIds,TUTORIAL_LEVEL} from '../dist/tutorial.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const fixturesOnly=process.argv.includes('--fixtures-only');
const tutorialOnly=process.argv.includes('--tutorial-only');
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const html=readFileSync(resolve(root,'dist/SS15-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,1);
const entry='const session = new DuoPuzzleSession(SS15_LEVELS);';
assert.equal(scripts[0].split(entry).length,2);
const keys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const normal=a=>typeof a==='number'?{id:a}:{id:a.id??a.actionId??a.action,data:a.data};
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const n=parseInt(PALETTE[c].slice(1),16);return[n>>>16,(n>>>8)&255,n&255,255];})));
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===15||c===6)&&arms.filter(v=>v===c).length>=3)all.push({color:c,x,y,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const goalCount=frame=>{let n=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y;if([frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]].every(c=>c===11))n++;}return n;};
const dataAt=(spec,x,y)=>({x:3+3*(x+Math.floor((20-spec.rows[0].length)/2)),y:3+3*(y+Math.floor((20-spec.rows.length)/2))});
const tile=(frame,spec,x,y)=>{const p=dataAt(spec,x,y);return frame.slice(p.y-1,p.y+2).map(r=>r.slice(p.x-1,p.x+2));};
const colorCount=(frame,c)=>frame.reduce((n,row)=>n+row.filter(v=>v===c).length,0);
const makeArena=(name,placements,options={})=>{const cells=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));cells[7][1]='g';cells[7][2]='g';for(const [x,y,c] of placements)cells[y][x]=c;return{id:'ss15-ui-'+name,title:name,rows:cells.map(r=>r.join('')),...options};};
const createHarness=(spec,{reducedMotion=false,single=false}={})=>{
 // Pedagogical fixtures occupy the real tutorial index; the compiled tutorial
 // constant is never rewritten. A single-room terminal fixture still starts at 1.
 const levels=spec?(single?[spec]:SS15_LEVELS.map((level,index)=>index===TUTORIAL_LEVEL-1?spec:level)):SS15_LEVELS;
 const startLevel=spec&&!single?TUTORIAL_LEVEL:1;
 const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 window.matchMedia=query=>({matches:reducedMotion&&query==='(prefers-reduced-motion: reduce)',media:query,addEventListener(){},removeEventListener(){}});
 window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
 const errors=[];window.addEventListener('error',event=>errors.push(String(event.error??event.message)));window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
 const captures=[],timers=[],waits=[];let pixels=new Uint8ClampedArray(64*64*4),timerId=0;
 window.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);}});
 window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:512,bottom:512,width:512,height:512,toJSON(){return this;}});
 window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
 window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
 const advance=async()=>{await Promise.resolve();assert.ok(timers.length,'Expected intermediate timer');const t=timers.shift();t.callback(...t.args);await Promise.resolve();};
 const flush=async()=>{for(let i=0;i<500;i++){await Promise.resolve();if(!timers.length){await Promise.resolve();if(!timers.length)return;}const t=timers.shift();t.callback(...t.args);}throw new Error('Animation did not settle');};
 window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
 const fixtureLevels=single?JSON.stringify([spec]):`[...SS15_LEVELS.slice(0, TUTORIAL_LEVEL - 1), ${JSON.stringify(spec)}, ...SS15_LEVELS.slice(TUTORIAL_LEVEL)]`;
 window.eval(spec?scripts[0].replace(entry,`const session = new DuoPuzzleSession(${fixtureLevels});${single?'':' session.selectLevel(TUTORIAL_LEVEL);'}`):scripts[0]);
 const ref=new DuoPuzzleSession(levels),$=id=>window.document.getElementById(id),board=$('board');
 if(startLevel!==1)ref.selectLevel(startLevel);
 const key=(key,extra={})=>board.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));
 const click=data=>board.dispatchEvent(new window.MouseEvent('click',{clientX:(data.x+.25)*8,clientY:(data.y+.25)*8,bubbles:true,cancelable:true}));
 const dispatch=a=>{const {id,data}=normal(a);if(id===6)click(data);else key(keys[id]);};
 const equal=o=>assert.deepEqual(pixels,rgba(o.frame));
 const settled=async o=>{await flush();equal(o);assert.equal(board.dataset.busy,'false');};
 const action=async a=>{const start=captures.length,wait=waits.length,{id,data}=normal(a);dispatch(a);const next=ref.action(id,data);if(next.frames.length>1){assert.equal(board.dataset.busy,'true');assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);}await settled(next);for(let i=0;i<next.frames.length;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),`Action ${id}, frame ${i}`);assert.deepEqual(waits.slice(wait),(next.frameDurationsMs??next.frames.map(()=>70)).slice(0,-1));return next;};
 const choose=async level=>{$('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));await settled(ref.selectLevel(level));};
 const reset=async kind=>{$(kind).click();await settled(ref[kind]());};
 const learned=()=>Object.fromEntries(lessonIds.map(id=>[id,window.document.querySelector('[data-lesson="'+id+'"]').classList.contains('done')]));
 equal(ref.observe());
 assert.equal(board.dataset.level,String(startLevel));assert.equal($('tutorial').hidden,startLevel!==TUTORIAL_LEVEL);
 return{window,errors,ref,$,board,key,click,dispatch,equal,settled,action,choose,reset,learned,advance,flush,captures,timers,waits,get pixels(){return pixels;},close:()=>window.happyDOM.close()};
};
const report={success:false,htmlSha256:createHash('sha256').update(html).digest('hex'),scope:fixturesOnly?'fixtures-only':tutorialOnly?'tutorial-only':'focused-ui-and-full-campaign',tutorialLevel:TUTORIAL_LEVEL,pedagogicalFixtureLevel:TUTORIAL_LEVEL,environment:'Happy DOM, compiled standalone HTML, canvas pixel buffer and controlled animation queue',visualBrowserTest:false,checks:[]};
const checkReflectionFixtures=async()=>{
 const result=[];
 for(const f of [{name:'near hero ignores farther blocked arrival',farBlocked:true},{name:'near crate has a square outline',crate:true},{name:'equal distances exchange both heroes',tie:true}]){
  const placements=[[4,2,f.crate?'o':'Z'],[f.tie?6:7,4,'B'],[4,4,'1']];if(f.crate)placements.push([1,6,'Z']);if(f.farBlocked)placements.push([4,1,'#']);if(f.tie)placements.push([3,2,'o'],[2,2,'s']);
  const spec=makeArena(f.name,placements),h=createHarness(spec);
  try{
   const before=h.ref.observe();
   if(!f.tie)assert.deepEqual(tile(before.frame,spec,6,4),f.crate?[[1,1,1],[1,3,1],[1,1,1]]:[[3,1,3],[1,1,1],[3,1,3]]);
   const start=h.captures.length;assert.equal(h.key(' '),false);const next=h.ref.action(5);await h.settled(next);
   assert.equal(next.frames.length,3);for(let i=0;i<3;i++)assert.deepEqual(h.captures[start+i],rgba(next.frames[i]));
   assert.ok(h.$('feedback').textContent.includes('priorité au plus proche'));
   assert.equal(h.learned().mirror,true);assert.equal(h.learned()['bard-song'],false);assert.equal(h.learned()['wizard-swap'],false);
   if(f.tie){assert.deepEqual(heroes(next.frame).find(p=>p.color===15).data,dataAt(spec,6,4));assert.deepEqual(heroes(next.frame).find(p=>p.color===6).data,dataAt(spec,4,2));for(const point of [[3,2],[2,2]])assert.deepEqual(tile(next.frame,spec,...point),tile(before.frame,spec,...point),'Reflection cannot activate the Bard beside cargo or supports');}
   else assert.deepEqual(heroes(next.frame).find(p=>p.color===6).data,dataAt(spec,7,4));
   await h.reset('undo');h.equal(before);result.push({case:f.name,teleportFrames:3,preview:true,noAutomaticAbility:true,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkDeviceGlyphs=async()=>{
 const result=[];
 for(const shared of [false,true]){
  const circuits=[{id:'press',buttons:[{x:3,y:2}],color:shared?9:15},...(shared?[{id:'plate',buttons:[{x:5,y:5}],color:15}]:[])];
  const spec=makeArena(shared?'plate under open press':'pure violet press',[[2,2,'Z'],[7,7,'B']],{circuits,gates:[{at:{x:5,y:5},circuit:'press',direction:'E',closedWhen:'pressed'}]}),h=createHarness(spec);
  try{
   const before=h.ref.observe(),open=tile(before.frame,spec,5,5);
   assert.deepEqual(open,shared?[[3,7,3],[7,15,7],[3,7,3]]:[[7,15,7],[3,3,15],[7,15,7]]);assert.ok(!open.flat().includes(9));
   const closed=await h.action(4);assert.equal(tile(closed.frame,spec,5,5)[1][1],5);
   await h.reset('undo');h.equal(before);result.push({sharedPlate:shared,openPixels:open,closedCenter:5,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkMirrorInterference=async()=>{
 const cases=[
  {name:'blocking mirror alone flashes',M:[5,3],mirrors:[[5,5,'NE'],[6,5,'SE'],[7,1,'NE']],red:[1]},
  {name:'incompatible destinations flash both mirrors',M:[5,3],mirrors:[[5,5,'NE'],[3,3,'SE'],[7,1,'NE']],red:[0,1]},
  {name:'mirror hiding the only source flashes',M:[5,1],mirrors:[[5,5,'NE'],[5,3,'SE'],[7,1,'NE']],red:[1]},
 ];
 const result=[];
 for(const f of cases){
  const spec=makeArena(f.name,[[...f.M,'Z'],[2,6,'B']],{mirrors:f.mirrors.map(([x,y,facing])=>({at:{x,y},facing}))}),h=createHarness(spec);
  try{
   const before=h.ref.observe(),start=h.captures.length,wait=h.waits.length;
   assert.equal(h.key(' '),false);const next=h.ref.action(5),count=h.$('moves').textContent;
   assert.equal(h.board.dataset.busy,'true');assert.equal(next.frames.length,4);
   assert.match(h.$('feedback').textContent,/clignot(?:e|ent) en rouge/);
   assert.equal(h.learned().mirror,false,'A red refusal must not award the reflection lesson');
   h.key('ArrowRight');h.key('Tab');h.key('2');h.key('x');h.click(dataAt(spec,2,6));
   h.window.document.querySelector('[data-action="4"]').click();h.window.document.querySelector('[data-hero="bard"]').click();
   assert.equal(h.$('moves').textContent,count,'All ordinary inputs are locked during the warning');
   assert.equal(h.captures.length,start+1);assert.equal(h.$('victory').hidden,true);assert.equal(h.$('defeat').hidden,true);
   await h.settled(next);
   assert.deepEqual(next.frameDurationsMs,[110,70,110,0]);assert.deepEqual(h.waits.slice(wait),[110,70,110]);
   for(let i=0;i<4;i++)assert.deepEqual(h.captures[start+i],rgba(next.frames[i]),f.name+': exact displayed blink frame '+i);
   for(const [i,[x,y]] of f.mirrors.entries()){
    const original=tile(before.frame,spec,x,y),red=original.map(row=>row.map(c=>c===5?8:c));
    for(let frame=0;frame<4;frame++)assert.deepEqual(tile(next.frames[frame],spec,x,y),f.red.includes(i)&&frame%2===0?red:original,f.name+': mirror '+i+' frame '+frame);
   }
   assert.deepEqual(next.frame,before.frame);assert.equal(next.state,before.state);assert.equal(next.canUndo,false);
   assert.equal(h.$('undo').disabled,true);assert.equal(h.learned().mirror,false);assert.equal(h.learned()['bard-song'],false);assert.equal(h.learned()['wizard-bend'],false);
   const repeated=await h.action(5);assert.deepEqual(repeated,next,'Repeated refused reflection replays all frames without an Undo entry');
   assert.equal(h.learned().mirror,false);assert.match(h.$('feedback').textContent,/clignot(?:e|ent) en rouge/);
   result.push({case:f.name,redMirrorIndices:f.red,frames:4,exactPixelsAndTiming:true,unrelatedMirrorsUnchanged:true,unchangedFinalFrame:true,repeatedWarning:true,controlsLocked:true,noReflectionLesson:true,noUndoEntry:true});
  }finally{await h.close();}
 }
 const spec=makeArena('Undo during red mirror warning',[[5,2,'Z'],[2,6,'B']],{mirrors:[{at:{x:5,y:5},facing:'NE'},{at:{x:6,y:5},facing:'SE'}]}),h=createHarness(spec);
 try{
  const before=h.ref.observe();await h.action(2);const moved=h.ref.observe();assert.notDeepEqual(moved.frame,before.frame);assert.equal(moved.canUndo,true);
  h.key(' ');const warning=h.ref.action(5);assert.equal(warning.frames.length,4);assert.equal(h.board.dataset.busy,'true');
  await h.advance();assert.equal(h.board.dataset.busy,'true');assert.equal(h.learned().mirror,false);
  assert.equal(h.key('z'),false);const restored=h.ref.undo(),stopped=h.captures.length;
  await h.settled(restored);assert.equal(h.captures.length,stopped,'Cancelled warning timers cannot paint stale red frames');
  assert.deepEqual(restored,before);assert.equal(h.$('undo').disabled,true);assert.equal(h.learned().mirror,false);
  assert.ok(h.$('feedback').textContent.includes('Dernière action annulée'));
  result.push({case:'Undo during warning restores previous actual movement',midAnimationUndo:true,exactPreviousState:true,cancelledFramesCannotRepaint:true,noReflectionLesson:true});
 }finally{await h.close();}
 return result;
};
const checkRoleFixtures=async()=>{
 const cases=[
  {name:'Wizard exchanges the first crate only',placements:[[7,6,'B'],[2,4,'Z'],[4,4,'o'],[6,4,'o']],id:4,wizard:[4,4],stone:[2,4],heldStone:[6,4],lessons:['wizard-swap']},
  {name:'Wizard exchanges the partner without singing',placements:[[6,4,'B'],[2,4,'Z']],id:4,wizard:[6,4],bard:[2,4],lessons:['wizard-swap','wizard-partner']},
  {name:'Wizard ray bends at a white mirror face',placements:[[7,7,'B'],[2,2,'Z'],[5,2,'4'],[5,1,'o']],id:4,wizard:[5,1],stone:[2,2],lessons:['wizard-swap','wizard-bend']},
  {name:'Wizard cannot push a black mirror back',placements:[[7,7,'B'],[2,4,'Z'],[3,4,'1']],id:4,wizard:[2,4],frames:1,lessons:[]},
  {name:'substitution releases the Bard without moving nearby cargo',placements:[[2,4,'Z'],[6,4,'B'],[5,3,'o'],[5,2,'s'],[6,2,'~']],id:4,wizard:[6,4],bard:[2,4],stone:[5,3],support:[5,2],lessons:['wizard-swap','wizard-partner','release-by-swap']},
  {name:'a crate replaces the Wizard on a command without a hydraulic pulse',placements:[[2,4,'Z'],[7,7,'B'],[6,4,'o']],options:{circuits:[{id:'hold',buttons:[{x:2,y:4}],color:10}],gates:[{at:{x:7,y:5},circuit:'hold',direction:'S',closedWhen:'released'}]},id:4,wizard:[6,4],stone:[2,4],lessons:['wizard-swap','relay-weight']},
  {name:'swapped monsters fight without a false press lesson',placements:[[7,7,'B'],[2,4,'Z'],[6,4,'m'],[2,3,'m']],options:{circuits:[{id:'a',buttons:[{x:6,y:6}]}],gates:[{at:{x:7,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,wizard:[6,4],frames:8,combat:true,lessons:['wizard-swap','monster']},
  {name:'near crate follows one Bard step',placements:[[2,4,'B'],[7,7,'Z'],[4,4,'o']],role:'bard',id:4,bard:[3,4],stone:[5,4],lessons:['move','bard-song']},
  {name:'song crosses an intervening wall',placements:[[2,4,'B'],[7,7,'Z'],[4,4,'o'],[3,3,'#'],[3,4,'#'],[3,5,'#']],role:'bard',id:1,bard:[2,3],stone:[4,3],lessons:['move','bard-song','wall-song']},
  {name:'diagonal corner belongs to the radius-two square',placements:[[2,4,'B'],[7,7,'Z'],[4,6,'o']],role:'bard',id:1,bard:[2,3],stone:[4,5],lessons:['move','bard-song','diagonal-song']},
  {name:'one blocked choir member stays while a free member follows',placements:[[2,5,'B'],[7,7,'Z'],[4,4,'o'],[4,6,'o'],[5,4,'#']],role:'bard',id:4,bard:[3,5],stone:[5,6],heldStone:[4,4],lessons:['move','bard-song','selective-song']},
  {name:'simultaneous same-colour dependencies advance the whole nearby row',placements:[[2,4,'B'],[7,7,'Z'],[3,4,'o'],[4,4,'o']],role:'bard',id:4,bard:[3,4],stone:[4,4],heldStone:[5,4],lessons:['move','bard-song']},
  {name:'an outside-aura crate holds the inner row and blocks the Bard',placements:[[2,4,'B'],[7,7,'Z'],[3,4,'o'],[4,4,'o'],[5,4,'o']],role:'bard',id:4,bard:[2,4],stone:[3,4],heldStone:[5,4],frames:1,blockedBard:true,lessons:[]},
  {name:'a sung Wizard never casts and leaves the mirror still',placements:[[4,6,'B'],[4,4,'Z'],[3,4,'1'],[7,4,'o']],role:'bard',id:4,bard:[5,6],wizard:[5,4],mirror:[3,4],stone:[7,4],lessons:['move','partner-song']},
  {name:'song never pushes a mirror in front of the Bard',placements:[[2,4,'B'],[7,7,'Z'],[3,4,'1'],[4,3,'o']],role:'bard',id:4,bard:[2,4],stone:[4,3],mirror:[3,4],frames:1,blockedBard:true,lessons:[]},
  {name:'sunken support slides from water to water',placements:[[2,3,'B'],[7,7,'Z'],[4,3,'s'],[5,3,'~'],[6,3,'~']],role:'bard',id:4,bard:[3,3],support:[5,3],lessons:['move','bard-song','support-slide']},
  {name:'a support cannot climb onto dry floor',placements:[[2,3,'B'],[7,7,'Z'],[4,3,'s']],role:'bard',id:4,bard:[3,3],support:[4,3],lessons:['move']},
  {name:'the Bard destination support stays anchored',placements:[[2,4,'B'],[7,7,'Z'],[3,4,'s'],[4,4,'~']],role:'bard',id:4,bard:[3,4],support:[3,4],supportOccupied:true,lessons:['move','support-anchor']},
  {name:'sung crate becomes a permanent water support',placements:[[2,4,'B'],[7,7,'Z'],[4,4,'o'],[5,4,'~']],role:'bard',id:4,bard:[3,4],support:[5,4],lessons:['move','bard-song','platform']},
  {name:'unsafe sung partner landing refuses every movement',placements:[[2,4,'B'],[4,4,'Z'],[5,4,'~'],[4,2,'o']],role:'bard',id:4,bard:[2,4],wizard:[4,4],stone:[4,2],frames:1,blockedBard:true,lessons:[]},
  {name:'remote press carries Wizard without casting',placements:[[4,5,'Z'],[2,2,'B'],[3,5,'1'],[7,5,'o']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]},role:'bard',id:4,bard:[3,2],wizard:[5,5],mirror:[3,5],stone:[7,5],frames:6,lessons:['move','gate','press']},
  {name:'remote press carries Bard without singing cargo',placements:[[2,2,'Z'],[4,5,'B'],[3,4,'o'],[3,3,'s'],[4,3,'~']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,wizard:[3,2],bard:[5,5],stone:[3,4],support:[3,3],frames:6,lessons:['move','gate','press']},
  {name:'press sends a crate into water',placements:[[2,2,'Z'],[7,7,'B'],[4,4,'o'],[5,4,'~']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:4},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,wizard:[3,2],support:[5,4],frames:6,lessons:['move','gate','press','platform']},
  {name:'hydraulics settle before checking a pressed Bard over water',placements:[[2,2,'Z'],[4,5,'B'],[5,5,'~']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:4,y:5},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:5,y:5},circuit:'a',activeWhen:'pressed'}]},id:4,wizard:[3,2],bard:[5,5],frames:9,lessons:['move','gate','press']},
  {name:'sung monsters attack one another simultaneously',placements:[[7,7,'Z'],[2,4,'B'],[4,3,'m'],[6,3,'m']],role:'bard',id:4,bard:[3,4],frames:8,combat:true,lessons:['move','bard-song','monster']},
  {name:'a pressed mirror stays legible over its destination button',placements:[[2,2,'Z'],[7,7,'B'],[4,4,'1']],options:{circuits:[{id:'press',buttons:[{x:3,y:2}],color:10},{id:'plate',buttons:[{x:5,y:4}],color:15}],gates:[{at:{x:4,y:4},circuit:'press',direction:'E',closedWhen:'pressed'}]},id:4,wizard:[3,2],mirror:[5,4],frames:6,lessons:['move','gate','press']}
 ];
 const result=[];
 for(const f of cases){
  const spec=makeArena(f.name,f.placements,f.options),h=createHarness(spec);
  try{
   if(f.role==='bard'){await h.action({id:6,data:heroes(h.ref.observe().frame).find(p=>p.color===6).data});assert.ok(colorCount(h.ref.observe().frame,6)>5,'Selected Bard shows the dotted aura');}
   else assert.ok(colorCount(h.ref.observe().frame,6)<=5,'Inactive Bard has no aura');
   for(const a of f.prelude??[])await h.action(a);
   const before=h.ref.observe(),next=await h.action(f.id);assert.equal(next.frames.length,f.frames??3,f.name);
   for(const [key,color] of [['wizard',15],['bard',6]])if(f[key])assert.deepEqual(heroes(next.frame).find(p=>p.color===color).data,dataAt(spec,...f[key]),f.name+': '+key);
   for(const key of ['stone','heldStone'])if(f[key]){const t=tile(next.frame,spec,...f[key]);assert.equal(t[1][1],5);for(const[x,y]of[[1,0],[0,1],[2,1],[1,2]])assert.equal(t[y][x],13);}
   if(f.support){const t=tile(next.frame,spec,...f.support);for(const[x,y]of[[0,0],[2,0],[0,2],[2,2]])assert.equal(t[y][x],10);if(!f.supportOccupied)assert.equal(t[1][1],10);}
   if(f.mirror){const t=tile(next.frame,spec,...f.mirror);for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===y)assert.equal(t[y][x],0);else if(y>x)assert.equal(t[y][x],5);}}
   for(const id of lessonIds.filter(id=>id!=='select'))assert.equal(h.learned()[id],f.lessons.includes(id),`${f.name}: public lesson ${id}`);
   if(f.blockedBard)assert.match(h.$('feedback').textContent,/pas est refusé/);
   if(f.combat){assert.equal(next.state,'NOT_FINISHED');assert.equal(colorCount(next.frame,8),0);assert.deepEqual(next.frameDurationsMs.slice(3),[80,90,100,110,0]);}
   await h.reset('undo');h.equal(before);assert.deepEqual(h.errors,[]);
   result.push({case:f.name,frames:next.frames.length,exactPixelsAndTiming:true,publicLessons:f.lessons,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkRayLoop=async()=>{
 const spec=makeArena('returning Wizard ray',[[1,6,'B'],[3,3,'Z']],{mirrors:[{at:{x:3,y:1},facing:'SE'},{at:{x:7,y:1},facing:'SW'},{at:{x:7,y:6},facing:'NW'},{at:{x:3,y:6},facing:'NE'}]}),h=createHarness(spec);
 try{
  const before=h.ref.observe(),next=await h.action(1);
  assert.equal(next.frames.length,9);assert.ok(h.$('feedback').textContent.includes('revient sur le Magicien'));
  for(const id of lessonIds.filter(id=>id!=='select'))assert.equal(h.learned()[id],false,'A ray loop must not award '+id);
  assert.deepEqual(heroes(next.frame).map(p=>[p.color,p.x,p.y]),heroes(before.frame).map(p=>[p.color,p.x,p.y]));
  const repeated=await h.action(1);assert.deepEqual(repeated,next);await h.reset('undo');h.equal(before);
  return{frames:9,exactPixelsAndTiming:true,unchangedPositions:true,noSpuriousLessons:true,repeatedLoop:true,undo:true};
 }finally{await h.close();}
};
let h;
try{
 assert.equal(TUTORIAL_LEVEL,4,'The compiled tutorial belongs to the fourth room');
 assert.deepEqual([...lessonIds],['select','move','wizard-swap','wizard-partner','wizard-bend','relay-weight','bard-song','partner-song','selective-song','diagonal-song','wall-song','release-by-swap','platform','support-slide','support-anchor','mirror','gate','press','monster','goals']);
 assert.match(html,/SS15.*Les Accords Transposés/);assert.ok(!/Guerrier|warrior|Voleur|thief|La Forge des Reflets/.test(html.split('<script>')[0]));
 assert.equal((html.match(/data-lesson=/g)??[]).length,20);assert.equal(/<script[^>]+src=/.test(html),false);
 report.roleCoverage=await checkRoleFixtures();report.checks.push('Twenty-six compiled-HTML role fixtures cover reciprocal swaps, bent rays, silent substitution, square-range song, supports, presses, hydraulics and simultaneous combat.');
 report.reflectionCoverage=await checkReflectionFixtures();report.checks.push('Reflection keys, nearest source, equal-distance exchange and gray previews.');
 report.deviceGlyphCoverage=await checkDeviceGlyphs();report.checks.push('Exposed buttons have a gray background, pink plus and circuit center; pure presses have gray/open and black/closed centers.');
 report.mirrorInterferenceCoverage=await checkMirrorInterference();report.checks.push('Blocking backs alone blink red; ordinary inputs lock and mid-warning Undo restores the preceding state.');
 report.rayLoopCoverage=await checkRayLoop();report.checks.push('A returning Wizard ray displays its circuit, reports the loop and awards no false lesson.');
 if(!tutorialOnly){
  const spec=makeArena('interruptible reciprocal swap',[[2,4,'Z'],[7,7,'B'],[4,4,'o'],[6,4,'o']]);h=createHarness(spec);
  assert.equal(h.board.dataset.selected,'wizard');assert.equal(h.$('tutorial').hidden,false);assert.equal(h.$('lesson-progress').textContent,'0 / 20 découvertes');
  const moves=h.$('moves').textContent;let other=heroes(h.ref.observe().frame).find(p=>p.color===6);
  h.key('2');await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'bard');
  other=heroes(h.ref.observe().frame).find(p=>p.color===15);h.key('1');await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'wizard');
  other=heroes(h.ref.observe().frame).find(p=>p.color===6);assert.equal(h.key('Tab'),false);await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'bard');
  other=heroes(h.ref.observe().frame).find(p=>p.color===15);h.click(other.data);await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'wizard');
  other=heroes(h.ref.observe().frame).find(p=>p.color===6);h.window.document.querySelector('[data-hero="bard"]').click();await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'bard');
  other=heroes(h.ref.observe().frame).find(p=>p.color===15);h.window.document.querySelector('[data-hero="wizard"]').click();await h.settled(h.ref.action(6,other.data));assert.equal(h.board.dataset.selected,'wizard');
  assert.equal(h.$('moves').textContent,moves);assert.equal(h.key('Tab',{shiftKey:true}),true);
  h.click({x:-1,y:10});h.click({x:64,y:10});h.equal(h.ref.observe());
  h.$('level').dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));h.equal(h.ref.observe());
  report.checks.push('Keys 1/2, Tab, both role buttons and public-pixel clicks select the intended hero without a world tick; Shift+Tab exits and outside input is ignored.');
  await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);await h.choose(TUTORIAL_LEVEL);
  h.key('ArrowRight');const moving=h.ref.action(4),count=h.$('moves').textContent;
  assert.equal(h.board.dataset.busy,'true');h.key('ArrowDown');h.key('Tab');h.key('2');h.key(' ');assert.equal(h.$('moves').textContent,count);await h.settled(moving);
  assert.equal(h.learned()['wizard-swap'],true);await h.reset('undo');assert.equal(h.learned()['wizard-swap'],true,'Undo retains discoveries');
  h.key('ArrowRight');h.ref.action(4);h.$('undo').click();const undone=h.ref.undo(),stopped=h.captures.length;await h.settled(undone);assert.equal(h.captures.length,stopped);
  h.key('ArrowRight');h.ref.action(4);await h.reset('reset');assert.equal(h.$('moves').textContent,'0 actions');assert.ok(Object.values(h.learned()).every(v=>!v));assert.equal(h.board.dataset.level,String(TUTORIAL_LEVEL));assert.equal(h.$('tutorial').hidden,false);
  h.key('ArrowRight');h.ref.action(4);await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);
  await h.choose(TUTORIAL_LEVEL);h.key('ArrowRight');h.ref.action(4);await h.choose(SS15_LEVELS.length);await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);
  report.checks.push('Undo, Reset, Restart and level selection interrupt animations without stale frames; Reset clears discoveries in room 4 and Restart returns to room 1 with its tutorial panel hidden.');
  await h.close();h=undefined;
  const reduced=createHarness(spec,{reducedMotion:true});try{reduced.key('ArrowRight');const next=reduced.ref.action(4);reduced.equal(next);assert.equal(reduced.board.dataset.busy,'false');assert.equal(reduced.waits.length,0);report.checks.push('Reduced motion uses no timer waits.');}finally{await reduced.close();}
  const fatal=makeArena('terminal combat',[[2,4,'Z'],[7,7,'B'],[6,4,'m'],[6,3,'m']]);h=createHarness(fatal);
  h.key('ArrowRight');const dead=h.ref.action(4);assert.equal(dead.state,'GAME_OVER');assert.equal(h.$('defeat').hidden,true);await h.advance();assert.equal(h.$('defeat').hidden,true);await h.settled(dead);assert.equal(h.$('defeat').hidden,false);
  h.$('undo-defeat').click();await h.settled(h.ref.undo());assert.equal(h.$('defeat').hidden,true);report.checks.push('Defeat waits for the final combat frame and its Undo restores the live room.');await h.close();h=undefined;
  const win=makeArena('terminal victory',[[1,7,'.'],[2,7,'.'],[1,2,'Z'],[2,2,'g'],[6,6,'B'],[7,6,'g']]);h=createHarness(win,{single:true});assert.equal(h.ref.observe().levelCount,1);assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);await h.action(4);await h.action({id:6,data:heroes(h.ref.observe().frame).find(p=>p.color===6).data});
  h.key('ArrowRight');const won=h.ref.action(4);assert.equal(won.state,'WIN');assert.equal(h.$('victory').hidden,true);await h.settled(won);assert.equal(h.$('victory').hidden,false);
  assert.ok([...h.window.document.querySelectorAll('[data-action],[data-hero]')].every(e=>e.disabled));assert.ok(Object.values(h.learned()).every(v=>!v),'The single-room fixture does not impersonate the tutorial');await h.reset('undo');assert.equal(h.$('victory').hidden,true);await h.reset('restart');report.checks.push('VICTORY appears after the final frame and allows Undo or Restart; the one-room terminal fixture never pretends to be tutorial room 4.');await h.close();h=undefined;
 }
 if(!fixturesOnly){
  if(!tutorialOnly)assert.equal(SS15_LEVELS.length,8);h=createHarness();
  assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);assert.equal(h.$('level-title').textContent,'L’appui des deux traversées');
  for(let level=1;level<=SS15_LEVELS.length;level++){
   await h.choose(level);const initial=h.ref.observe();assert.deepEqual(heroes(initial.frame).map(p=>p.color).sort((a,b)=>a-b),[6,15]);assert.equal(goalCount(initial.frame),2);
   assert.equal(h.$('tutorial').hidden,level!==TUTORIAL_LEVEL);assert.equal(h.$('piston-help').hidden,!LEVEL_INFO[level-1].piston);
   assert.equal(h.$('level-title').textContent,SS15_LEVELS[level-1].title);assert.equal(h.$('source-label').textContent,LEVEL_INFO[level-1].label);assert.equal(h.$('level-objective').textContent,LEVEL_INFO[level-1].objective);
   assert.equal(h.$('source-link').hidden,!LEVEL_INFO[level-1].url);if(LEVEL_INFO[level-1].url)assert.equal(h.$('source-link').href,new URL(LEVEL_INFO[level-1].url).href);
   assert.equal(h.$('source-link-secondary').hidden,!LEVEL_INFO[level-1].secondary);if(LEVEL_INFO[level-1].secondary)assert.equal(h.$('source-link-secondary').href,new URL(LEVEL_INFO[level-1].secondary.url).href);
   const platforms=!!SS15_LEVELS[level-1].platforms?.length;for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])assert.equal(h.$(id).hidden,!platforms);
   if(SS15_LEVELS[level-1].rows.some(r=>r.includes('m'))){assert.equal(h.$('monster-help').hidden,false);assert.equal(h.$('monster-help').open,true);h.$('monster-help').open=false;const other=heroes(initial.frame).find(p=>p.color===6);await h.action({id:6,data:other.data});assert.equal(h.$('monster-help').open,false,'Help respects manual collapse during a room');}
  }
  assert.deepEqual(h.errors,[]);report.checks.push(`All ${SS15_LEVELS.length} compiled rooms expose their correct title, objective, two heroes, two goals, both source links and contextual help; only room 4 shows the tutorial.`);await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);await h.close();h=undefined;
  h=createHarness();report.campaignCoverage=[];
  const replayLevels=tutorialOnly?[TUTORIAL_LEVEL]:Array.from({length:SS15_LEVELS.length},(_,index)=>index+1);
  if(tutorialOnly)await h.choose(TUTORIAL_LEVEL);
  for(const level of replayLevels){
   const path=resolve(root,`reference/level${level}-design.json`);assert.ok(existsSync(path),'The authored room must exist');const design=JSON.parse(readFileSync(path,'utf8'));
   assert.deepEqual(design.spec,SS15_LEVELS[level-1],'Built room must match its authored reference');
   assert.equal(h.ref.observe().level,level);assert.equal(h.board.dataset.level,String(level));assert.equal(h.$('tutorial').hidden,level!==TUTORIAL_LEVEL);const completedBefore=h.ref.observe().levelsCompleted;let beforeLast;
   for(const action of design.actions){beforeLast=h.ref.observe();const discoveries=h.learned();await h.action(action);assert.equal(h.$('tutorial').hidden,h.ref.observe().level!==TUTORIAL_LEVEL);if(level!==TUTORIAL_LEVEL)assert.deepEqual(h.learned(),discoveries,'Only actual room 4 can award a discovery');}
   assert.equal(h.ref.observe().levelsCompleted,completedBefore+1);
   if(level<TUTORIAL_LEVEL)assert.ok(Object.values(h.learned()).every(v=>!v),'No discovery before the actual tutorial');
   if(level===TUTORIAL_LEVEL){for(const id of lessonIds)assert.equal(h.learned()[id],true,'Real room 4 tutorial acquisition: '+id);report.tutorialCoverage={level:TUTORIAL_LEVEL,actions:design.actions.length,discoveries:[...lessonIds],onlyTutorialRoomAwardsDiscoveries:true};}
   const completed=h.ref.observe();await h.reset('undo');h.equal(beforeLast);assert.equal(h.$('victory').hidden,true);assert.equal(h.$('tutorial').hidden,level!==TUTORIAL_LEVEL);
   await h.action(design.actions.at(-1));assert.deepEqual(h.ref.observe(),completed);assert.deepEqual(h.errors,[]);
   report.campaignCoverage.push({level,title:design.spec.title,actions:design.actions.length,exactPixelsAndTiming:true,completionUndo:true});
  }
  report.checks.push(tutorialOnly?'The authored level4 route earns all twenty discoveries from displayed public pixels after direct selection of the actual tutorial room.':'The authored level4 route earns all twenty discoveries from displayed public pixels; earlier rooms award none and later rooms add none.');
  if(!tutorialOnly){assert.equal(h.ref.observe().state,'WIN');assert.equal(h.$('victory').hidden,false);report.checks.push('All eight actual rooms, including the rebuilt finals, win through compiled HTML inputs with every frame and duration checked; each completion is undone and replayed.');}
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{if(h)await h.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
