/** Actual compiled HTML, DOM input, canvas pixel buffers and controlled timers. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS10_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const skipLevel5=process.argv.includes('--skip-level5');
const tutorialOnly=process.argv.includes('--tutorial-only');
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const errors=[],networkRequests=[];
const html=readFileSync(resolve(root,'dist/SS10-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,1);
const entry='const session = new DuoPuzzleSession(SS10_LEVELS);';
assert.equal(scripts[0].split(entry).length,2);
const lessonIds=['move','select','warrior-push','chain','thief-pull','single-pull','release','mirror-motion','platform','mirror','gate','goals'];
const keys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const normal=a=>typeof a==='number'?{id:a}:{id:a.id??a.actionId??a.action,data:a.data};
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const n=parseInt(PALETTE[c].slice(1),16);return[n>>>16,(n>>>8)&255,n&255,255];})));
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===8||c===14)&&arms.filter(v=>v===c).length>=3)all.push({color:c,x,y,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const goalCount=frame=>{let n=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y;if([frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]].every(c=>c===11))n++;}return n;};
const dataAt=(spec,x,y)=>({x:3+3*(x+Math.floor((20-spec.rows[0].length)/2)),y:3+3*(y+Math.floor((20-spec.rows.length)/2))});
const tile=(frame,spec,x,y)=>{const p=dataAt(spec,x,y);return frame.slice(p.y-1,p.y+2).map(r=>r.slice(p.x-1,p.x+2));};
const colorCount=(frame,c)=>frame.reduce((n,row)=>n+row.filter(v=>v===c).length,0);
const makeArena=(name,placements,options={})=>{const cells=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));cells[7][1]='g';cells[7][2]='g';for(const [x,y,c] of placements)cells[y][x]=c;return{id:'ss10-ui-'+name,title:name,rows:cells.map(r=>r.join('')),...options};};
const createHarness=spec=>{
 const levels=spec?[spec,...SS10_LEVELS.slice(1)]:SS10_LEVELS;
 const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 window.addEventListener('error',event=>errors.push(String(event.message)));
 window.console.error=(...args)=>errors.push(args.map(String).join(' '));
 window.fetch=(url)=>{networkRequests.push(String(url));throw new Error('Unexpected network request');};
 window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
 const captures=[],timers=[],waits=[];let pixels=new Uint8ClampedArray(64*64*4),timerId=0;
 window.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);}});
 window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:512,bottom:512,width:512,height:512,toJSON(){return this;}});
 window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
 window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
 const advance=async()=>{await Promise.resolve();assert.ok(timers.length,'Expected intermediate timer');const t=timers.shift();t.callback(...t.args);await Promise.resolve();};
 const flush=async()=>{for(let i=0;i<500;i++){await Promise.resolve();if(!timers.length){await Promise.resolve();if(!timers.length)return;}const t=timers.shift();t.callback(...t.args);}throw new Error('Animation did not settle');};
 window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
 window.eval(spec?scripts[0].replace(entry,`const session = new DuoPuzzleSession([${JSON.stringify(spec)}, ...SS10_LEVELS.slice(1)]);`):scripts[0]);
 const ref=new DuoPuzzleSession(levels),$=id=>window.document.getElementById(id),board=$('board');
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
 return{window,ref,$,board,key,click,dispatch,equal,settled,action,choose,reset,learned,advance,flush,captures,timers,waits,get pixels(){return pixels;},close:()=>window.happyDOM.close()};
};
const report={success:false,htmlSha256:createHash('sha256').update(html).digest('hex'),scope:tutorialOnly?'tutorial-only':skipLevel5?'campaign-except-level5':'full-campaign',environment:'Happy DOM running actual compiled standalone HTML, canvas RGBA buffers and controlled animation timers',visualBrowserTest:false,nativeBrowserAttempt:'Chromium launch denied by environment socket EPERM; see browser-report.json',checks:[],errors,networkRequests};
let h;
try{
 const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
 const actionsFor=level=>{const a=witnesses.find(w=>w.level===level)?.actions;assert.ok(a?.length);return a;};
 assert.equal(SS10_LEVELS.length,8);assert.equal(witnesses.length,8);
 h=createHarness();const {$,key,ref}=h;
 assert.equal(h.board.dataset.level,'1');assert.equal($('tutorial').hidden,false);assert.equal($('tutorial').open,true);
 assert.equal($('tutorial-title').textContent,'Niveau 1 · '+SS10_LEVELS[0].title);assert.ok($('campaign-subtitle').textContent.includes('Guerrier + Voleur'));
 assert.deepEqual([...h.window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),lessonIds);
 report.checks.push('Standalone HTML opens level1 with the correct Warrior/Thief roles and twelve-discovery tutorial.');
 let other=heroes(ref.observe().frame).find(p=>!p.selected),count=$('moves').textContent;await h.action({id:6,data:other.data});assert.equal($('moves').textContent,count);assert.equal(h.board.dataset.selected,'thief');
 other=heroes(ref.observe().frame).find(p=>!p.selected);assert.equal(key('Tab'),false);await h.settled(ref.action(6,other.data));assert.equal(h.board.dataset.selected,'warrior');assert.equal(key('Tab',{shiftKey:true}),true);
 other=heroes(ref.observe().frame).find(p=>!p.selected);key('2');await h.settled(ref.action(6,other.data));other=heroes(ref.observe().frame).find(p=>!p.selected);key('1');await h.settled(ref.action(6,other.data));
 other=heroes(ref.observe().frame).find(p=>!p.selected);h.window.document.querySelector('[data-hero="thief"]').click();await h.settled(ref.action(6,other.data));assert.equal($('moves').textContent,count);
 h.click({x:-1,y:10});h.click({x:64,y:10});h.equal(ref.observe());$('level').dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));h.equal(ref.observe());
 report.checks.push('Pixelclick,Tab,1/2 and hero buttons select without a movement count; Shift+Tab is not trapped and invalid canvas/selector input is ignored.');
 await h.reset('restart');
 if(!tutorialOnly){
  const a=actionsFor(1)[0],before=ref.observe();h.dispatch(a);const animated=ref.action(a.id,a.data);assert.ok(animated.frames.length>1);assert.equal(h.board.dataset.busy,'true');count=$('moves').textContent;
  key('ArrowRight');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);await h.settled(animated);
  await h.reset('undo');h.equal(before);h.dispatch(a);ref.action(a.id,a.data);$('undo').click();const undone=ref.undo(),stopped=h.captures.length;await h.settled(undone);assert.equal(h.captures.length,stopped);
  h.dispatch(a);ref.action(a.id,a.data);await h.reset('reset');assert.equal($('moves').textContent,'0 actions');assert.ok(Object.values(h.learned()).every(v=>!v));
  h.dispatch(a);ref.action(a.id,a.data);await h.choose(8);await h.reset('restart');assert.equal($('tutorial').hidden,false);
  report.checks.push('Animation blocks ordinary commands; Undo,Reset,Restart and level selection cancel stale callbacks and restore exact public pixels.');
  for(let level=1;level<=8;level++){
   if(skipLevel5&&level===5)continue;
   await h.choose(level);const initial=ref.observe();assert.deepEqual(heroes(initial.frame).map(p=>p.color).sort((a,b)=>a-b),[8,14]);assert.equal(goalCount(initial.frame),2);assert.equal($('tutorial').hidden,level!==1);
   assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal($('source-link').href,new URL(LEVEL_INFO[level-1].url).href);
   for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])assert.equal($(id).hidden,!SS10_LEVELS[level-1].platforms?.length);
  }
  report.checks.push('Each checked room displays both heroes,two goals,its own source and the correct press/platform help.');
 }
 await h.reset('restart');let actions=0,frames=0,selections=0,reflectionKeyChecked=false,completed=0;
 const levels=tutorialOnly?[1]:Array.from({length:8},(_,i)=>i+1).filter(i=>!skipLevel5||i!==5);
 for(const level of levels){
  if(ref.observe().level!==level)await h.choose(level);
  for(const a of actionsFor(level)){
   if(!reflectionKeyChecked&&a.id===5){
    const before=ref.observe(),start=h.captures.length;assert.equal(key(' '),false);const expected=ref.action(5);await h.settled(expected);
    for(let i=0;i<expected.frames.length;i++)assert.deepEqual(h.captures[start+i],rgba(expected.frames[i]));await h.reset('undo');h.equal(before);
    h.window.document.querySelector('[data-action="5"]').click();const button=ref.action(5);await h.settled(button);assert.deepEqual(button.frames,expected.frames);await h.reset('undo');h.equal(before);reflectionKeyChecked=true;
   }
   const next=await h.action(a);actions++;frames+=next.frames.length;selections+=+(a.id===6);
  }
  completed++;assert.equal(ref.observe().levelsCompleted,completed);
  if(level===1){for(const id of lessonIds)assert.equal(h.learned()[id],true,'Tutorial acquisition: '+id);report.tutorialCoverage={level:1,actions:actionsFor(1).length,discoveries:[...lessonIds]};}
 }
 report.witnessCoverage={levels,actions,frames,selections,allPixelsAndDurationsCompared:true};
 report.checks.push('All checked witnesses replay through the compiled HTML; every canvas paint and requested delay matches the reference, all twelve lessons are earned, and Space/button/X reflections agree.');
 if(!tutorialOnly&&!skipLevel5){
  assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);assert.ok([...h.window.document.querySelectorAll('[data-action],[data-hero]')].every(e=>e.disabled));count=$('moves').textContent;key('ArrowDown');key('2');assert.equal($('moves').textContent,count);
  await h.reset('undo');assert.equal($('victory').hidden,true);assert.equal(ref.observe().levelsCompleted,7);await h.reset('restart');assert.equal(ref.observe().levelsCompleted,0);assert.equal(ref.observe().level,1);
  report.checks.push('Final VICTORY disables gameplay; Undo exits victory and Restart clears campaign progress and tutorial counters.');
 }
 if(!tutorialOnly){
  const failures=JSON.parse(readFileSync(resolve(root,'tests/failures.json'),'utf8'));assert.ok(failures.length);report.defeatCoverage=[];
  for(const fatal of failures){
   await h.choose(fatal.level);for(const a of fatal.actions.slice(0,-1))await h.action(a);const before=ref.observe(),last=fatal.actions.at(-1);h.dispatch(last);let dead=ref.action(last.id,last.data);
   assert.equal(dead.state,'GAME_OVER');assert.equal($('defeat').hidden,true);assert.ok(dead.frames.length>1);await h.advance();assert.equal($('defeat').hidden,true);
   $('undo').click();const restored=ref.undo(),stop=h.captures.length;await h.settled(restored);h.equal(before);assert.equal(h.captures.length,stop);
   const start=h.captures.length;h.dispatch(last);dead=ref.action(last.id,last.data);
   for(let i=0;i<dead.frames.length;i++){if(i)await h.advance();assert.deepEqual(h.captures[start+i],rgba(dead.frames[i]));assert.equal($('defeat').hidden,i<dead.frames.length-1);}await h.settled(dead);
   count=$('moves').textContent;key('ArrowDown');key('Tab');assert.equal($('moves').textContent,count);$('undo-defeat').click();await h.settled(ref.undo());h.equal(before);
   h.dispatch(last);ref.action(last.id,last.data);await h.flush();$('reset-defeat').click();await h.settled(ref.reset());assert.equal($('defeat').hidden,true);assert.equal($('moves').textContent,'0 actions');assert.ok(Object.values(h.learned()).every(v=>!v));
   report.defeatCoverage.push({level:fatal.level,cause:fatal.cause,actions:fatal.actions.length,frames:dead.frames.length,midAnimationUndo:true,overlayAfterLastFrame:true});
  }
  report.checks.push('Reachable defeat waits for all frames,locks controls,and supports mid-animation Undo plus panel Undo/Reset.');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(networkRequests,[]);
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{if(h)await h.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,tutorialOnly?'validation/tutorial-ui-report.json':skipLevel5?'validation/ui-before-level5-report.json':'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
