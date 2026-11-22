/** Actual compiled HTML, DOM input, canvas pixel buffers and controlled timers. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {TrioPuzzleSession,PALETTE,stepDetailed} from '../dist/core.js';
import {SS18_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
import {replay} from './solver.mjs';
import {lessonIds,TUTORIAL_LEVEL} from '../dist/tutorial.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const fixturesOnly=process.argv.includes('--fixtures-only');
const tutorialOnly=process.argv.includes('--tutorial-only');
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const html=readFileSync(resolve(root,'dist/SS18-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,1);
const entry='const session = new TrioPuzzleSession(SS18_LEVELS);';
assert.equal(scripts[0].split(entry).length,2);
const keys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const normal=a=>typeof a==='number'?{id:a}:{id:a.id??a.actionId??a.action,data:a.data};
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const n=parseInt(PALETTE[c].slice(1),16);return[n>>>16,(n>>>8)&255,n&255,255];})));
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===12||c===6||c===15)&&arms.filter(v=>v===c).length>=3)all.push({color:c,x,y,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const goalCount=frame=>{let n=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y;if([frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]].every(c=>c===11))n++;}return n;};
const dataAt=(spec,x,y)=>({x:3+3*(x+Math.floor((20-spec.rows[0].length)/2)),y:3+3*(y+Math.floor((20-spec.rows.length)/2))});
const tile=(frame,spec,x,y)=>{const p=dataAt(spec,x,y);return frame.slice(p.y-1,p.y+2).map(r=>r.slice(p.x-1,p.x+2));};
const colorCount=(frame,c)=>frame.reduce((n,row)=>n+row.filter(v=>v===c).length,0);
const makeArena=(name,placements=[],options={})=>{
 const {goals=[[17,2],[17,6],[17,10]],...devices}=options;
 const cells=Array.from({length:20},(_,y)=>Array.from({length:20},(_,x)=>x===0||y===0||x===19||y===19?'#':'.'));
 cells[2][2]='M';cells[6][2]='B';cells[10][2]='Z';
 for(const [x,y] of goals)cells[y][x]='g';
 for(const [x,y,c] of placements){if('MZB'.includes(c))for(const row of cells)for(let i=0;i<row.length;i++)if(row[i]===c)row[i]='.';cells[y][x]=c;}
 return{id:'ss18-ui-'+name,title:name,rows:cells.map(r=>r.join('')),...devices};
};
const roleColors={merchant:12,wizard:15,bard:6};
const heroData=(observation,role)=>heroes(observation.frame).find(h=>h.color===roleColors[role])?.data;
const createHarness=(spec,{reducedMotion=false,single=false}={})=>{
 // Pedagogical fixtures occupy the real tutorial index; the compiled tutorial
 // constant is never rewritten. A single-room terminal fixture also starts at 1; it does not rewrite the tutorial constant.
 const levels=spec?(single?[spec]:SS18_LEVELS.map((level,index)=>index===TUTORIAL_LEVEL-1?spec:level)):SS18_LEVELS;
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
 const fixtureLevels=single?JSON.stringify([spec]):`[...SS18_LEVELS.slice(0, TUTORIAL_LEVEL - 1), ${JSON.stringify(spec)}, ...SS18_LEVELS.slice(TUTORIAL_LEVEL)]`;
 window.eval(spec?scripts[0].replace(entry,`const session = new TrioPuzzleSession(${fixtureLevels});${single?'':' session.selectLevel(TUTORIAL_LEVEL);'}`):scripts[0]);
 const ref=new TrioPuzzleSession(levels),$=id=>window.document.getElementById(id),board=$('board');
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
const checkRoleFixtures=async()=>{
 const cases=[
  {name:'Merchant pushes one crate',placements:[[3,2,'o']],id:4,merchant:[3,2],stone:[4,2]},
  {name:'Merchant cannot push a two-piece row',placements:[[3,2,'o'],[4,2,'o']],id:4,merchant:[2,2],stone:[3,2],heldStone:[4,2],frames:1},
  {name:'Merchant pushes Wizard without casting',placements:[[3,2,'Z'],[7,2,'o']],id:4,merchant:[3,2],wizard:[4,2],stone:[7,2]},
  {name:'Merchant pushes Bard without singing',placements:[[3,2,'B'],[3,3,'o']],id:4,merchant:[3,2],bard:[4,2],stone:[3,3]},
  {name:'Merchant moves a mirror without changing its face',placements:[[3,2,'1']],id:4,merchant:[3,2],mirror:[4,2]},
  {name:'Merchant crate creates an immersed support',placements:[[3,2,'o'],[4,2,'~']],id:4,merchant:[3,2],support:[4,2]},
  {name:'Merchant cannot push a companion into unsupported water',placements:[[3,2,'Z'],[4,2,'~']],id:4,merchant:[2,2],wizard:[3,2],frames:1},
  {name:'Bard transports both companions and cargo together',placements:[[6,6,'B'],[7,5,'M'],[7,7,'Z'],[8,6,'o']],role:'bard',id:4,bard:[7,6],merchant:[8,5],wizard:[8,7],stone:[9,6]},
  {name:'A butte retains one sung crate while the other advances',placements:[[6,6,'B'],[8,6,'o'],[9,6,'#'],[6,4,'o']],role:'bard',id:4,bard:[7,6],stone:[7,4],heldStone:[8,6]},
  {name:'Song reaches a diagonal corner and crosses a wall',placements:[[6,6,'B'],[6,4,'o'],[6,5,'#'],[8,4,'o']],role:'bard',id:4,bard:[7,6],stone:[7,4],heldStone:[9,4]},
  {name:'Blocked Bard cancels the complete song',placements:[[6,6,'B'],[7,6,'#'],[6,4,'o']],role:'bard',id:4,bard:[6,6],stone:[6,4],frames:1},
  {name:'A mirror never follows the song',placements:[[6,6,'B'],[8,6,'1'],[6,4,'o']],role:'bard',id:2,bard:[6,7],stone:[6,5],mirror:[8,6]},
  {name:'Song slides a free immersed support along water',placements:[[6,6,'B'],[6,4,'s'],[7,4,'~']],role:'bard',id:4,bard:[7,6],support:[7,4]},
  {name:'Bard landing anchors the next immersed support',placements:[[6,6,'B'],[7,6,'s'],[8,6,'~']],role:'bard',id:4,bard:[7,6],coveredSupport:[7,6]},
  {name:'Song atomically refuses to drown an inactive companion',placements:[[6,6,'B'],[6,4,'M'],[7,4,'~']],role:'bard',id:4,bard:[6,6],merchant:[6,4],frames:1},
  {name:'Wizard swaps the first crate and leaves the farther one',placements:[[5,10,'o'],[8,10,'o']],role:'wizard',id:4,wizard:[5,10],stone:[2,10],heldStone:[8,10]},
  {name:'Wizard exchanges Merchant without a passive push',placements:[[5,10,'M'],[6,10,'o']],role:'wizard',id:4,wizard:[5,10],merchant:[2,10],stone:[6,10]},
  {name:'Wizard exchanges Bard without a passive song',placements:[[5,10,'B'],[5,9,'o']],role:'wizard',id:4,wizard:[5,10],bard:[2,10],stone:[5,9]},
  {name:'Wizard walks when its line has no target',placements:[],role:'wizard',id:4,wizard:[3,10]},
  {name:'Wizard bends its ray through a white face',placements:[[6,7,'Z'],[6,10,'1'],[10,10,'o']],role:'wizard',id:2,wizard:[10,10],stone:[6,7]},
  {name:'Wizard ray crosses an immersed support without targeting it',placements:[[5,10,'s'],[8,10,'o']],role:'wizard',id:4,wizard:[8,10],stone:[2,10],support:[5,10]},
  {name:'Wizard swaps a monster while partners remain safe',placements:[[8,10,'m']],role:'wizard',id:4,wizard:[8,10],monster:[2,10]},
  {name:'A side press moves Bard without singing',placements:[[10,10,'B'],[9,9,'o']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:10},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,merchant:[3,2],bard:[11,10],stone:[9,9],frames:6},
  {name:'A press deposits a remote immersed support',placements:[[10,10,'o'],[11,10,'~']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:10},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,merchant:[3,2],support:[11,10],frames:6},
  {name:'Forced landing waits for hydraulic support',placements:[[10,10,'B'],[11,10,'~']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:10},circuit:'a',direction:'E',closedWhen:'pressed'}],platforms:[{at:{x:11,y:10},circuit:'a',activeWhen:'pressed'}]},id:4,merchant:[3,2],bard:[11,10],frames:9},
  {name:'Pressed monsters fight simultaneously away from every hero',placements:[[10,10,'m'],[12,10,'m']],options:{circuits:[{id:'a',buttons:[{x:3,y:2}]}],gates:[{at:{x:10,y:10},circuit:'a',direction:'E',closedWhen:'pressed'}]},id:4,merchant:[3,2],combat:true,frames:11},
 ];
 const result=[];
 for(const fixture of cases){
  const spec=makeArena(fixture.name,fixture.placements,fixture.options),h=createHarness(spec);
  try{
   if(fixture.role)await h.action({id:6,data:heroData(h.ref.observe(),fixture.role)});
   const before=h.ref.observe(),next=await h.action(fixture.id);assert.equal(next.frames.length,fixture.frames??3,fixture.name);assert.equal(next.state,'NOT_FINISHED');
   for(const [role,color] of Object.entries(roleColors))if(fixture[role])assert.deepEqual(heroes(next.frame).find(p=>p.color===color).data,dataAt(spec,...fixture[role]),fixture.name+': '+role);
   for(const key of ['stone','heldStone'])if(fixture[key]){const t=tile(next.frame,spec,...fixture[key]);assert.equal(t[1][1],5);for(const[x,y]of[[1,0],[0,1],[2,1],[1,2]])assert.equal(t[y][x],13);}
   if(fixture.support)assert.deepEqual(tile(next.frame,spec,...fixture.support),[[10,13,10],[13,10,13],[10,13,10]]);
   if(fixture.coveredSupport){const t=tile(next.frame,spec,...fixture.coveredSupport);for(const[x,y]of[[0,0],[2,0],[0,2],[2,2]])assert.equal(t[y][x],10);}
   if(fixture.mirror){const t=tile(next.frame,spec,...fixture.mirror);for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===y)assert.equal(t[y][x],0);else if(y>x)assert.equal(t[y][x],5);}}
   if(fixture.monster)assert.deepEqual(tile(next.frame,spec,...fixture.monster),[[8,5,8],[5,8,5],[8,5,8]]);
   if(fixture.combat)assert.deepEqual(next.frameDurationsMs.slice(-5),[80,90,100,110,0]);
   await h.reset('undo');h.equal(before);assert.deepEqual(h.errors,[]);
   result.push({case:fixture.name,frames:next.frames.length,exactPixelsAndTiming:true,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkReflectionFixtures=async()=>{
 const result=[];
 for(const f of [{name:'near hero ignores farther blocked arrival',farBlocked:true},{name:'near crate has a square preview',crate:true},{name:'equal distances exchange two roles without passive abilities',tie:true}]){
  const placements=[[6,4,f.crate?'o':'M'],[f.tie?8:9,6,'B'],[6,6,'1']];if(f.farBlocked)placements.push([6,3,'#']);if(f.tie)placements.push([5,4,'o']);
  const spec=makeArena(f.name,placements),h=createHarness(spec);
  try{
   const before=h.ref.observe();
   if(!f.tie)assert.deepEqual(tile(before.frame,spec,8,6),f.crate?[[1,1,1],[1,3,1],[1,1,1]]:[[3,1,3],[1,1,1],[3,1,3]]);
   const start=h.captures.length;assert.equal(h.key(' '),false);const next=h.ref.action(5);await h.settled(next);assert.equal(next.frames.length,3);
   for(let i=0;i<3;i++)assert.deepEqual(h.captures[start+i],rgba(next.frames[i]));
   if(f.tie){assert.deepEqual(heroData(next,'merchant'),dataAt(spec,8,6));assert.deepEqual(heroData(next,'bard'),dataAt(spec,6,4));assert.deepEqual(tile(next.frame,spec,5,4),tile(before.frame,spec,5,4));}
   else assert.deepEqual(heroData(next,'bard'),dataAt(spec,9,6));
   await h.reset('undo');h.equal(before);result.push({case:f.name,teleportFrames:3,preview:true,noAutomaticAbility:true,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkWizardLoop=async()=>{
 const spec=makeArena('returning wizard ray',[[4,4,'Z']],{mirrors:[{at:{x:4,y:2},facing:'SE'},{at:{x:10,y:2},facing:'SW'},{at:{x:10,y:7},facing:'NW'},{at:{x:4,y:7},facing:'NE'}]}),h=createHarness(spec);
 try{
  await h.action({id:6,data:heroData(h.ref.observe(),'wizard')});
  const before=h.ref.observe(),lessons=h.learned(),start=h.captures.length,wait=h.waits.length;
  h.key('ArrowUp');const loop=h.ref.action(1),count=h.$('moves').textContent;
  assert.equal(loop.frames.length,9);assert.equal(h.board.dataset.busy,'true');
  h.key('ArrowRight');h.key('Tab');h.key('1');h.key(' ');h.click(heroData(before,'bard'));
  assert.equal(h.$('moves').textContent,count);assert.equal(h.captures.length,start+1);
  await h.settled(loop);
  assert.deepEqual(loop.frameDurationsMs,[90,90,90,90,100,100,80,100,0]);
  assert.deepEqual(h.waits.slice(wait),loop.frameDurationsMs.slice(0,-1));
  for(let i=0;i<9;i++)assert.deepEqual(h.captures[start+i],rgba(loop.frames[i]));
  assert.deepEqual(heroes(loop.frame).map(({color,x,y})=>({color,x,y})),heroes(before.frame).map(({color,x,y})=>({color,x,y})));
  assert.match(h.$('feedback').textContent,/revient sur le Magicien/);assert.deepEqual(h.learned(),lessons,'Returning light is not a successful swap discovery');
  assert.deepEqual(await h.action(1),loop,'Repeated loop animation is deterministic');
  h.key('ArrowUp');h.ref.action(1);await h.reset('reset');const stopped=h.captures.length;await h.flush();assert.equal(h.captures.length,stopped,'Cancelled loop cannot repaint the reset board');
  assert.deepEqual(h.errors,[]);
  return{case:'four-mirror loop and two Wizard pulses',frames:9,exactPixelsAndTiming:true,controlsLocked:true,noFalseDiscovery:true,resetCancelsCallbacks:true};
 }finally{await h.close();}
};
const checkDeviceGlyphs=async()=>{
 const result=[];
 for(const shared of [false,true]){
  const circuits=[{id:'press',buttons:[{x:3,y:2}],color:shared?9:15},...(shared?[{id:'plate',buttons:[{x:10,y:10}],color:15}]:[])];
  const spec=makeArena(shared?'plate under open press':'pure violet press',[],{circuits,gates:[{at:{x:10,y:10},circuit:'press',direction:'E',closedWhen:'pressed'}]}),h=createHarness(spec);
  try{
   const before=h.ref.observe(),open=tile(before.frame,spec,10,10);assert.deepEqual(open,shared?[[3,7,3],[7,15,7],[3,7,3]]:[[7,15,7],[3,3,15],[7,15,7]]);assert.ok(!open.flat().includes(9));
   const closed=await h.action(4);assert.equal(tile(closed.frame,spec,10,10)[1][1],5);await h.reset('undo');h.equal(before);result.push({sharedPlate:shared,openPixels:open,closedCenter:5,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkActualLevel8Warning=async()=>{
 const design=JSON.parse(readFileSync(resolve(root,'reference/level8-design.json'),'utf8'));
 assert.deepEqual(design.spec,SS18_LEVELS[7]);
 const route=replay(design.spec,design.commands);
 const turn=route.trace.findIndex(t=>stepDetailed(route.world,t.before,5).blockedMirrorIndices?.length);
 assert.ok(turn>=0,'The actual final room has a reachable blocked mirror state');
 const h=createHarness();
 try{
  await h.choose(8);let beforePrevious=h.ref.observe();
  for(const action of design.actions.slice(0,turn)){beforePrevious=h.ref.observe();await h.action(action);}
  const before=h.ref.observe(),warning=await h.action(5);
  assert.deepEqual(warning.frameDurationsMs,[110,70,110,0]);assert.deepEqual(warning.frame,before.frame);
  let changed=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(warning.frames[0][y][x]!==before.frame[y][x]){changed++;assert.equal(before.frame[y][x],5);assert.equal(warning.frames[0][y][x],8);}
  assert.ok(changed>0);assert.deepEqual(warning.frames[0],warning.frames[2]);assert.deepEqual(warning.frames[1],before.frame);
  assert.deepEqual(await h.action(5),warning);await h.reset('undo');assert.deepEqual(h.ref.observe().frame,beforePrevious.frame,'Repeated warnings do not insert Undo entries');
  await h.reset('reset');assert.equal(h.board.dataset.level,'8');assert.equal(h.$('tutorial').hidden,true);assert.deepEqual(h.errors,[]);
  return{case:'actual level 8 blocked mirrors',level:8,prefixActions:turn,redMirrorIndices:stepDetailed(route.world,route.trace[turn].before,5).blockedMirrorIndices,frames:4,redPixels:changed,onlyBlackBacksChanged:true,exactPixelsAndTiming:true,repeatedWarningAddsNoUndo:true,resetClearsWarning:true};
 }finally{await h.close();}
};
const checkMirrorInterference=async()=>{
 const result=[];
 const cases=[
  {name:'blocking mirror alone flashes',W:[6,4],mirrors:[[6,6,'NE'],[7,6,'SE'],[16,1,'NE']],red:[1]},
  {name:'incompatible mirror destinations both flash',W:[6,4],mirrors:[[6,6,'NE'],[4,4,'SE'],[16,1,'NE']],red:[0,1]},
  {name:'wall-blocked reflection flashes its source mirror',W:[6,4],placements:[[8,6,'#']],mirrors:[[6,6,'NE'],[16,1,'NE']],red:[0]},
  {name:'closed-press reflection flashes its source mirror',W:[6,4],options:{circuits:[{id:'closed',buttons:[{x:14,y:14}],color:15}],gates:[{at:{x:8,y:6},circuit:'closed',direction:'E',closedWhen:'released'}]},mirrors:[[6,6,'NE'],[16,1,'NE']],red:[0]},
  {name:'independent blocked mirrors flash together without a partial valid transfer',W:[4,3],placements:[[12,3,'Z'],[8,12,'B'],[6,5,'#'],[14,5,'#']],mirrors:[[4,5,'NE'],[12,5,'NE'],[8,14,'NE']],red:[0,1]},
 ];
 for(const f of cases){
  const spec=makeArena(f.name,[[...f.W,'M'],...(f.placements??[])],{...f.options,mirrors:f.mirrors.map(([x,y,facing])=>({at:{x,y},facing}))}),h=createHarness(spec);
  try{
   const before=h.ref.observe(),start=h.captures.length,wait=h.waits.length;h.key(' ');const next=h.ref.action(5),count=h.$('moves').textContent;
   assert.equal(h.board.dataset.busy,'true');assert.equal(next.frames.length,4);
   h.key('ArrowRight');h.key('Tab');h.key('3');h.key('x');h.click(heroData(before,'bard'));h.window.document.querySelector('[data-action="4"]').click();h.window.document.querySelector('[data-hero="merchant"]').click();assert.equal(h.$('moves').textContent,count);assert.equal(h.captures.length,start+1);
   await h.settled(next);assert.deepEqual(h.waits.slice(wait),[110,70,110]);assert.deepEqual(next.frameDurationsMs,[110,70,110,0]);
   for(let i=0;i<4;i++)assert.deepEqual(h.captures[start+i],rgba(next.frames[i]));
   for(const [i,[x,y]] of f.mirrors.entries()){const original=tile(before.frame,spec,x,y),red=original.map(row=>row.map(c=>c===5?8:c));for(let frame=0;frame<4;frame++)assert.deepEqual(tile(next.frames[frame],spec,x,y),f.red.includes(i)&&frame%2===0?red:original);}
   assert.deepEqual(next.frame,before.frame);assert.equal(next.canUndo,false);assert.deepEqual(await h.action(5),next);assert.deepEqual(h.errors,[]);
   result.push({case:f.name,redMirrorIndices:f.red,frames:4,exactPixelsAndTiming:true,unrelatedMirrorsUnchanged:true,controlsLocked:true,noUndoEntry:true});
  }finally{await h.close();}
 }
 const warningSpec=makeArena('reduced-motion blocked reflection',[[6,4,'M'],[8,6,'#']],{mirrors:[{at:{x:6,y:6},facing:'NE'}]});
 const reduced=createHarness(warningSpec,{reducedMotion:true});
 try{
  const before=reduced.ref.observe(),start=reduced.captures.length;reduced.key('x');const warning=reduced.ref.action(5);reduced.equal(warning);
  assert.equal(warning.frames.length,4);assert.deepEqual(reduced.captures.slice(start,start+4),warning.frames.map(rgba));assert.equal(reduced.board.dataset.busy,'false');assert.equal(reduced.waits.length,0);assert.equal(reduced.timers.length,0);assert.deepEqual(warning.frame,before.frame);assert.deepEqual(reduced.errors,[]);
  result.push({case:'blocked reflection respects reduced motion',frames:4,noTimerWaits:true,normalRestingFrame:true});
 }finally{await reduced.close();}
 return result;
};
let h;
try{
 assert.equal(TUTORIAL_LEVEL,3);assert.equal(lessonIds.length,27);assert.equal(new Set(lessonIds).size,lessonIds.length);
 assert.match(html,/SS18.*La Galerie Résonante/);assert.ok(!/Guerrier|warrior|Voleur|thief|Forteresse Rose/.test(html.split('<script>')[0]));
 assert.equal((html.match(/data-lesson=/g)??[]).length,lessonIds.length);assert.equal(/<script[^>]+src=/.test(html),false);
 for(const role of Object.keys(roleColors))assert.equal((html.match(new RegExp(`data-hero="${role}"`,'g'))??[]).length,1);
 report.roleCoverage=await checkRoleFixtures();report.checks.push('Compiled-HTML role fixtures cover single pushes, songs with two partners, moving and anchored supports, first-target swaps, bent rays, presses, hydraulics and combat.');
 report.reflectionCoverage=await checkReflectionFixtures();report.checks.push('Global reflection uses nearest-source priority, exchanges equally distant actors and draws shape-specific previews.');
 report.wizardLoopCoverage=await checkWizardLoop();report.checks.push('A four-mirror returning ray illuminates its path and blinks the Wizard without moving occupants or awarding a false discovery.');
 report.deviceGlyphCoverage=await checkDeviceGlyphs();report.checks.push('Gray-backed buttons and black/gray press centers have the exact expected pixels.');
 report.mirrorInterferenceCoverage=await checkMirrorInterference();if(!fixturesOnly)report.mirrorInterferenceCoverage.push(await checkActualLevel8Warning());report.checks.push('Mirror warnings flash only involved backs, preserve diagonals and lock ordinary controls.');
 if(!tutorialOnly){
  const spec=makeArena('interruptible trio action',[[3,2,'o']]);h=createHarness(spec);
  assert.equal(h.board.dataset.selected,'merchant');assert.equal(h.$('tutorial').hidden,false);assert.equal(h.$('lesson-progress').textContent,`0 / ${lessonIds.length} découvertes`);const moves=h.$('moves').textContent;
  for(const [key,role] of [['2','wizard'],['3','bard'],['1','merchant']]){h.key(key);await h.settled(h.ref.action(6,heroData(h.ref.observe(),role)));assert.equal(h.board.dataset.selected,role);}
  for(const role of ['wizard','bard','merchant']){assert.equal(h.key('Tab'),false);await h.settled(h.ref.action(6,heroData(h.ref.observe(),role)));assert.equal(h.board.dataset.selected,role);}
  for(const role of ['wizard','bard','merchant']){const data=heroData(h.ref.observe(),role);h.click(data);await h.settled(h.ref.action(6,data));assert.equal(h.board.dataset.selected,role);}
  for(const role of ['bard','wizard','merchant']){h.window.document.querySelector(`[data-hero="${role}"]`).click();await h.settled(h.ref.action(6,heroData(h.ref.observe(),role)));assert.equal(h.board.dataset.selected,role);}
  assert.equal(h.$('moves').textContent,moves);assert.equal(h.key('Tab',{shiftKey:true}),true);h.click({x:-1,y:10});h.click({x:64,y:10});h.equal(h.ref.observe());
  h.$('level').dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));h.equal(h.ref.observe());
  report.checks.push('Keys 1/2/3, repeated Tab, all three role buttons and image clicks select correctly without advancing the world; Shift+Tab and off-canvas clicks are respected.');
  await h.reset('reset');h.key('ArrowRight');const moving=h.ref.action(4),count=h.$('moves').textContent;assert.equal(h.board.dataset.busy,'true');h.key('ArrowDown');h.key('Tab');h.key('3');h.key(' ');assert.equal(h.$('moves').textContent,count);await h.settled(moving);
  const discoveries=h.learned();await h.reset('undo');assert.deepEqual(h.learned(),discoveries,'Undo retains learned observations');
  h.key('ArrowRight');h.ref.action(4);h.$('undo').click();const undone=h.ref.undo(),stopped=h.captures.length;await h.settled(undone);assert.equal(h.captures.length,stopped,'Cancelled animation cannot repaint old pixels');
  h.key('ArrowRight');h.ref.action(4);await h.reset('reset');assert.equal(h.$('moves').textContent,'0 actions');assert.ok(Object.values(h.learned()).every(v=>!v));assert.equal(h.board.dataset.level,String(TUTORIAL_LEVEL));assert.equal(h.$('tutorial').hidden,false);
  h.key('ArrowRight');h.ref.action(4);await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);
  await h.choose(TUTORIAL_LEVEL);h.key('ArrowRight');h.ref.action(4);await h.choose(SS18_LEVELS.length);await h.reset('restart');assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);
  await h.choose(TUTORIAL_LEVEL);h.window.document.querySelector('[data-action="4"]').click();await h.settled(h.ref.action(4));
  report.checks.push('Direction buttons work; Undo, Reset, Restart and level selection interrupt animations without stale frames. Reset clears discoveries in the current room; Restart returns to level 1 with its tutorial hidden.');
  await h.close();h=undefined;
  const reduced=createHarness(spec,{reducedMotion:true});try{reduced.key('ArrowRight');const next=reduced.ref.action(4);reduced.equal(next);assert.equal(reduced.board.dataset.busy,'false');assert.equal(reduced.waits.length,0);report.checks.push('Reduced-motion mode paints the final result without timer waits.');}finally{await reduced.close();}
  const fatal=makeArena('terminal combat',[[6,4,'M'],[6,6,'m'],[7,6,'m']]);h=createHarness(fatal);h.key('ArrowDown');const dead=h.ref.action(2);assert.equal(dead.state,'GAME_OVER');assert.equal(h.$('defeat').hidden,true);await h.advance();assert.equal(h.$('defeat').hidden,true);await h.settled(dead);assert.equal(h.$('defeat').hidden,false);h.$('undo-defeat').click();await h.settled(h.ref.undo());assert.equal(h.$('defeat').hidden,true);report.checks.push('Defeat appears only after the combat animation and its Undo restores the three living heroes.');await h.close();h=undefined;
  const win=makeArena('terminal victory',[],{goals:[[3,2],[3,6],[3,10]]});h=createHarness(win,{single:true});assert.equal(h.ref.observe().levelCount,1);await h.action(4);await h.action({id:6,data:heroData(h.ref.observe(),'bard')});await h.action(4);await h.action({id:6,data:heroData(h.ref.observe(),'wizard')});h.key('ArrowRight');const won=h.ref.action(4);assert.equal(won.state,'WIN');assert.equal(h.$('victory').hidden,true);await h.settled(won);assert.equal(h.$('victory').hidden,false);assert.ok([...h.window.document.querySelectorAll('[data-action],[data-hero]')].every(e=>e.disabled));await h.reset('undo');assert.equal(h.$('victory').hidden,true);await h.reset('restart');report.checks.push('Victory waits for all three heroes and the last frame, disables ordinary controls, and can be undone or restarted.');await h.close();h=undefined;
 }
 if(!fixturesOnly){
  assert.equal(SS18_LEVELS.length,8);assert.equal(SS18_LEVELS[0].title,'Les trois pièces du chœur');assert.equal(SS18_LEVELS[TUTORIAL_LEVEL-1].title,'Le jardin des trois issues');h=createHarness();assert.equal(h.board.dataset.level,'1');assert.equal(h.$('tutorial').hidden,true);
  for(let level=1;level<=SS18_LEVELS.length;level++){
   await h.choose(level);const initial=h.ref.observe();assert.deepEqual(heroes(initial.frame).map(p=>p.color).sort((a,b)=>a-b),[6,12,15]);assert.equal(goalCount(initial.frame),3);assert.equal(h.$('tutorial').hidden,level!==TUTORIAL_LEVEL);assert.equal(h.$('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal(h.$('level-title').textContent,SS18_LEVELS[level-1].title);assert.equal(h.$('source-label').textContent,LEVEL_INFO[level-1].label);assert.equal(h.$('level-objective').textContent,LEVEL_INFO[level-1].objective);
   assert.equal(h.$('source-link').hidden,!LEVEL_INFO[level-1].url);if(LEVEL_INFO[level-1].url)assert.equal(h.$('source-link').href,new URL(LEVEL_INFO[level-1].url).href);assert.equal(h.$('source-link-secondary').hidden,!LEVEL_INFO[level-1].secondary);if(LEVEL_INFO[level-1].secondary)assert.equal(h.$('source-link-secondary').href,new URL(LEVEL_INFO[level-1].secondary.url).href);
   const platforms=!!SS18_LEVELS[level-1].platforms?.length;for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])assert.equal(h.$(id).hidden,!platforms);
   if(SS18_LEVELS[level-1].rows.some(r=>r.includes('m'))){assert.equal(h.$('monster-help').hidden,false);assert.equal(h.$('monster-help').open,true);h.$('monster-help').open=false;await h.action({id:6,data:heroData(initial,'bard')});assert.equal(h.$('monster-help').open,false,'Help respects a manual collapse in the current room');}
  }
  assert.deepEqual(h.errors,[]);report.checks.push('All eight rooms expose three heroes, three goals, correct titles, objectives, links and contextual help; the choir opens at level 1 and only the garden at level 3 shows the tutorial.');await h.close();h=undefined;
  h=createHarness();report.campaignCoverage=[];const replayLevels=tutorialOnly?[TUTORIAL_LEVEL]:Array.from({length:SS18_LEVELS.length},(_,i)=>i+1);if(tutorialOnly)await h.choose(TUTORIAL_LEVEL);
  for(const level of replayLevels){
   const path=resolve(root,`reference/level${level}-design.json`);assert.ok(existsSync(path));const design=JSON.parse(readFileSync(path,'utf8'));assert.deepEqual(design.spec,SS18_LEVELS[level-1]);assert.equal(h.ref.observe().level,level);const completedBefore=h.ref.observe().levelsCompleted;let beforeLast;
   for(const action of design.actions){beforeLast=h.ref.observe();const discoveries=h.learned();await h.action(action);assert.equal(h.$('tutorial').hidden,h.ref.observe().level!==TUTORIAL_LEVEL);if(level!==TUTORIAL_LEVEL)assert.deepEqual(h.learned(),discoveries,'Only the actual tutorial awards discoveries');}
   assert.equal(h.ref.observe().levelsCompleted,completedBefore+1);
   if(level===TUTORIAL_LEVEL){for(const id of lessonIds)assert.equal(h.learned()[id],true,'Real tutorial acquisition: '+id);report.tutorialCoverage={level:TUTORIAL_LEVEL,actions:design.actions.length,discoveries:[...lessonIds],onlyTutorialRoomAwardsDiscoveries:true};}
   const completed=h.ref.observe();await h.reset('undo');h.equal(beforeLast);assert.equal(h.$('victory').hidden,true);assert.equal(h.$('tutorial').hidden,level!==TUTORIAL_LEVEL);await h.action(design.actions.at(-1));assert.deepEqual(h.ref.observe(),completed);assert.deepEqual(h.errors,[]);report.campaignCoverage.push({level,title:design.spec.title,actions:design.actions.length,exactPixelsAndTiming:true,completionUndo:true});
  }
  report.checks.push('The actual garden route at level 3 earns all 27 discoveries from displayed public pixels; other rooms add none.');if(!tutorialOnly){assert.equal(h.ref.observe().state,'WIN');assert.equal(h.$('victory').hidden,false);report.checks.push('The compiled HTML completes all eight real rooms with every frame and duration checked, including Undo and replay of each completion.');}
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{if(h)await h.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
