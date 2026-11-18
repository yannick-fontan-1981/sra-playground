/** Executes the actual standalone HTML. DOM/keyboard/canvas-buffer checks, not native-browser QA. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS06_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const window=new Window({settings:{enableJavaScriptEvaluation:true}});
window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
const captures=[],timers=[],waits=[];let pixels=new Uint8ClampedArray(64*64*4),timerId=0;
window.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);}});
window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:512,bottom:512,width:512,height:512,toJSON(){return this;}});
window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
const advanceTimer=async()=>{await Promise.resolve();assert.ok(timers.length,'Expected an intermediate animation timer');const next=timers.shift();next.callback(...next.args);await Promise.resolve();};
const flush=async()=>{for(let i=0;i<300;i++){await Promise.resolve();if(!timers.length){await Promise.resolve();if(!timers.length)return;}const next=timers.shift();next.callback(...next.args);}throw new Error('Animation did not settle');};
const html=readFileSync(resolve(root,'dist/SS06-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
const $=id=>window.document.getElementById(id);
const key=(value,extra={})=>$('board').dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra}));
const clickPixel=data=>$('board').dispatchEvent(new window.MouseEvent('click',{clientX:(data.x+.25)*8,clientY:(data.y+.25)*8,bubbles:true,cancelable:true}));
const actionKeys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const normal=a=>typeof a==='number'?{id:a}:{id:a.id??a.actionId??a.action,data:a.data};
const dispatch=a=>{const {id,data}=normal(a);if(id===6){assert.ok(data,'ACTION6 requires pixel data');clickPixel(data);}else key(actionKeys[id]);};
let ref;
const doRef=a=>{const {id,data}=normal(a);return ref.action(id,data);};
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(r=>r.flatMap(c=>{const rgb=parseInt(PALETTE[c].slice(1),16);return[rgb>>>16,(rgb>>>8)&255,rgb&255,255];})));
const equalFrame=o=>assert.deepEqual(pixels,rgba(o.frame));
const settled=async o=>{await flush();equalFrame(o);assert.equal($('board').dataset.busy,'false');};
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+x*3,py=2+y*3,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===12||c===8)&&arms.filter(v=>v===c).length>=3)all.push({color:c,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const report={success:false,environment:'Happy DOM, canvas pixel buffer and controlled animation timer queue',visualBrowserTest:false,checks:[]};
let witnessMode=false,witnessActions=0,witnessFrames=0,selectionActions=0;
const replay=async actions=>{for(const a of actions){const start=captures.length,waitStart=waits.length;dispatch(a);const next=doRef(a);if(next.frames.length>1&&next.state!=='NOT_FINISHED'){assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);}await settled(next);for(let i=0;i<next.frames.length;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),`Engine frame ${i+1}/${next.frames.length}`);assert.deepEqual(waits.slice(waitStart),(next.frameDurationsMs??next.frames.map(()=>70)).slice(0,-1));if(witnessMode){witnessActions++;witnessFrames+=next.frames.length;if(normal(a).id===6)selectionActions++;}}};
const choose=level=>{$('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));equalFrame(ref.selectLevel(level));};
const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
const actionsFor=level=>{const actions=witnesses.find(w=>w.level===level)?.actions;assert.ok(actions?.length,`Missing witness ${level}`);return actions;};
const lessonIds=['move','select','merchant-push','warrior-push','platform','mirror','gate','goals'];
try{
  assert.equal(SS06_LEVELS.length,8,'The SS06 release contains eight rooms');
  ref=new DuoPuzzleSession(SS06_LEVELS);
  assert.equal(scripts.length,1);window.eval(scripts[0]);equalFrame(ref.observe());
  assert.equal($('board').dataset.level,'1');assert.equal($('tutorial').open,true);assert.equal($('tutorial').hidden,false);assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);
  assert.ok(window.document.title.startsWith('SS06'));assert.deepEqual(heroes(ref.observe().frame).map(h=>h.color).sort((a,b)=>a-b),[8,12]);
  if(process.env.SS06_UI_CAPTURE_DIR){mkdirSync(process.env.SS06_UI_CAPTURE_DIR,{recursive:true});writeFileSync(resolve(process.env.SS06_UI_CAPTURE_DIR,'ss06-ui-initial.rgba'),pixels);}
  report.checks.push('The complete compiled HTML opens level 1 with both colored heroes, exact engine pixels and its rich tutorial expanded');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4,5]);
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),lessonIds);
  assert.ok($('mirror-help').textContent.includes('+ gris clair'));assert.ok($('mirror-help').textContent.includes('contour carré gris clair'));
  assert.ok($('monster-help').textContent.includes('s’éliminent mutuellement'));assert.ok($('piston-help').textContent.includes('ils doivent être occupés ensemble'));
  assert.ok(window.document.body.textContent.includes('Appui dans l’eau · fixe'));
  report.checks.push('Five controls, eight tutorial objectives, distinct reflection previews and the duo-specific water, mirror, circuit and monster rules are present');

  let other=heroes(ref.observe().frame).find(h=>!h.selected),count=$('moves').textContent;
  clickPixel(other.data);equalFrame(ref.action(6,other.data));assert.equal($('moves').textContent,count);assert.equal($('board').dataset.selected,'warrior');assert.equal(timers.length,0);
  other=heroes(ref.observe().frame).find(h=>!h.selected);assert.equal(key('Tab'),false);equalFrame(ref.action(6,other.data));assert.equal($('board').dataset.selected,'merchant');
  assert.equal(key('Tab',{shiftKey:true}),true,'Shift+Tab remains an accessible exit from the canvas');
  other=heroes(ref.observe().frame).find(h=>!h.selected);key('2');equalFrame(ref.action(6,other.data));
  other=heroes(ref.observe().frame).find(h=>!h.selected);window.document.querySelector('[data-hero="merchant"]').click();equalFrame(ref.action(6,other.data));
  assert.equal($('moves').textContent,count);
  report.checks.push('Canvas clicks, Tab, number keys and role buttons select through ACTION6 without a game tick or movement-counter increment; Shift+Tab exits');

  const unchanged=ref.observe();clickPixel({x:64,y:12});clickPixel({x:-1,y:12});equalFrame(unchanged);
  $('level').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));equalFrame(unchanged);
  report.checks.push('Out-of-canvas clicks are ignored and keys in the level selector do not dispatch game actions');
  $('restart').click();await settled(ref.restart());

  const tutorial=actionsFor(1),probe=new DuoPuzzleSession(SS06_LEVELS);let firstAnimation=-1;
  for(let i=0;i<tutorial.length;i++){const a=normal(tutorial[i]),next=probe.action(a.id,a.data);if(next.level===1&&next.frames.length>1){firstAnimation=i;break;}}
  assert.ok(firstAnimation>=0);await replay(tutorial.slice(0,firstAnimation));
  const firstAction=tutorial[firstAnimation];dispatch(firstAction);const first=doRef(firstAction);assert.equal($('board').dataset.busy,'true');
  count=$('moves').textContent;key('ArrowRight');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);await settled(first);
  report.checks.push('Movement uses every frame and duration; directions, reflection and selection are blocked while animating, while Space still prevents scrolling');

  $('undo').click();equalFrame(ref.undo());dispatch(firstAction);doRef(firstAction);assert.equal($('board').dataset.busy,'true');
  $('undo').click();const undone=ref.undo(),canceled=captures.length;await settled(undone);assert.equal(captures.length,canceled,'Canceled frames cannot repaint');
  report.checks.push('Undo during an animation restores both heroes and cancels stale callbacks');

  dispatch(firstAction);doRef(firstAction);$('reset').click();await settled(ref.reset());assert.equal($('moves').textContent,'0 actions');assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')));
  await replay(tutorial.slice(0,firstAnimation));dispatch(firstAction);doRef(firstAction);choose(SS06_LEVELS.length);await settled(ref.observe());
  $('restart').click();await settled(ref.restart());assert.equal($('tutorial').hidden,false);
  report.checks.push('Reset, level changes and return to tutorial cancel pending animation callbacks and reset the appropriate counters');

  for(let level=1;level<=SS06_LEVELS.length;level++){choose(level);assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal($('tutorial').hidden,level!==1);assert.equal($('source-link').hidden,!LEVEL_INFO[level-1].url);if(LEVEL_INFO[level-1].url)assert.equal($('source-link').href,LEVEL_INFO[level-1].url);}
  report.checks.push('Every level displays its own source attribution and relevant piston help, with all eight rooms available');

  // The fifth room must visibly start with the condemned crate, not a mirror on its press.
  choose(5);
  const fifth=SS06_LEVELS[4],fifthMirrors=[...(fifth.mirrors??[]).map(m=>m.at)];
  fifth.rows.forEach((row,y)=>[...row].forEach((c,x)=>{if('1234'.includes(c))fifthMirrors.push({x,y});}));
  assert.ok(fifthMirrors.every(m=>!(fifth.gates??[]).some(g=>g.at.x===m.x&&g.at.y===m.y)),'No level-5 mirror may occupy a press cell initially');
  const cratePresses=(fifth.gates??[]).filter(g=>'o*'.includes(fifth.rows[g.at.y][g.at.x]));
  assert.ok(cratePresses.length>0,'Level 5 starts with a crate on its press');
  const ox=Math.floor((20-fifth.rows[0].length)/2),oy=Math.floor((20-fifth.rows.length)/2),fifthFrame=ref.observe().frame;
  for(const g of cratePresses){const px=2+(g.at.x+ox)*3,py=2+(g.at.y+oy)*3;assert.equal(fifthFrame[py+1][px+1],5);assert.deepEqual([fifthFrame[py][px+1],fifthFrame[py+1][px],fifthFrame[py+1][px+2],fifthFrame[py+2][px+1]],[13,13,13,13],'The initial crate remains visibly brown above the press');}
  report.checks.push('Level 5 visibly starts with a brown condemned crate on its press and has no initial mirror/press overlap');

  $('restart').click();await settled(ref.restart());
  const reflectionIndex=tutorial.findIndex(a=>normal(a).id===5);assert.ok(reflectionIndex>=0);await replay(tutorial.slice(0,reflectionIndex));
  const beforeReflection=ref.observe(),start=captures.length,waitStart=waits.length;assert.equal(key(' '),false);const reflected=ref.action(5);assert.ok(reflected.frames.length>=3);await settled(reflected);
  for(let i=0;i<reflected.frames.length;i++)assert.deepEqual(captures[start+i],rgba(reflected.frames[i]));assert.deepEqual(waits.slice(waitStart),reflected.frameDurationsMs.slice(0,-1));
  $('undo').click();await settled(ref.undo());equalFrame(beforeReflection);
  window.document.querySelector('[data-action="5"]').click();const button=ref.action(5);await settled(button);assert.deepEqual(button.frames,reflected.frames);
  $('undo').click();await settled(ref.undo());key('x');const xReflection=ref.action(5);await settled(xReflection);assert.deepEqual(xReflection.frames,reflected.frames);
  report.checks.push('Space, X and the Reflet button perform the same real reflection and preserve every teleport frame');

  $('restart').click();await settled(ref.restart());witnessMode=true;await replay(tutorial);
  assert.equal(ref.observe().levelsCompleted,1);if(SS06_LEVELS.length>1)assert.equal(ref.observe().level,2);
  for(const id of lessonIds)assert.ok(window.document.querySelector(`[data-lesson="${id}"]`).classList.contains('done'),`${id} is learned through actual public pixels and input`);
  report.checks.push('The complete tutorial earns all eight discoveries, including both push strengths, platform, reflection, gate and two simultaneous goals');
  for(let level=2;level<=SS06_LEVELS.length;level++){assert.equal(ref.observe().level,level);const completed=ref.observe().levelsCompleted;await replay(actionsFor(level));assert.equal(ref.observe().levelsCompleted,completed+1);}
  witnessMode=false;report.witnessCoverage={levels:SS06_LEVELS.length,actions:witnessActions,frames:witnessFrames,selectionActions,allFrameDurationsVerified:true};
  assert.equal(witnessActions,witnesses.reduce((n,w)=>n+w.actions.length,0));assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);
  assert.ok([...window.document.querySelectorAll('[data-action],[data-hero]')].every(b=>b.disabled));
  count=$('moves').textContent;key('ArrowDown');key('Tab');key('1');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);
  report.checks.push('All eight witnesses replay through the actual UI with exact frames and timing; victory needs all rooms and disables direction, reflection and hero selection');

  $('undo').click();await settled(ref.undo());assert.equal($('victory').hidden,true);assert.equal(ref.observe().levelsCompleted,SS06_LEVELS.length-1);
  $('restart').click();await settled(ref.restart());assert.equal(ref.observe().level,1);assert.equal(ref.observe().levelsCompleted,0);assert.equal($('tutorial').hidden,false);
  report.checks.push('Undo exits final victory and restores progression; Restart returns to the open tutorial with zero completions');

  const failurePath=resolve(root,'tests/failures.json');
  assert.ok(existsSync(failurePath),'A real reachable defeat route is required for terminal animation coverage');
  const failures=JSON.parse(readFileSync(failurePath,'utf8'));assert.ok(Array.isArray(failures)&&failures.length>0,'Defeat coverage cannot be empty');report.defeatCoverage=[];
  for(const fatal of failures){
    choose(fatal.level);await replay(fatal.actions.slice(0,-1));const before=ref.observe(),last=fatal.actions.at(-1);
    dispatch(last);let failed=doRef(last);assert.equal(failed.state,'GAME_OVER');assert.ok(failed.frames.length>1);
    assert.equal($('defeat').hidden,true);const middle=Math.max(1,Math.floor((failed.frames.length-1)/2));
    for(let i=1;i<=middle;i++){await advanceTimer();assert.deepEqual(pixels,rgba(failed.frames[i]));assert.equal($('defeat').hidden,true);}
    $('undo').click();const restored=ref.undo();equalFrame(before);const stoppedAt=captures.length;await settled(restored);assert.equal(captures.length,stoppedAt);assert.equal($('defeat').hidden,true);
    const from=captures.length,waitFrom=waits.length;dispatch(last);failed=doRef(last);
    for(let i=0;i<failed.frames.length;i++){if(i)await advanceTimer();assert.deepEqual(captures[from+i],rgba(failed.frames[i]));assert.equal($('defeat').hidden,i<failed.frames.length-1);}
    await settled(failed);assert.deepEqual(waits.slice(waitFrom),failed.frameDurationsMs.slice(0,-1));
    count=$('moves').textContent;key('ArrowLeft');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);
    $('undo-defeat').click();await settled(ref.undo());equalFrame(before);dispatch(last);doRef(last);await flush();$('reset-defeat').click();await settled(ref.reset());assert.equal($('defeat').hidden,true);
    report.defeatCoverage.push({level:fatal.level,cause:fatal.cause,actions:fatal.actions.length,frames:failed.frames.length,frameDurationsMs:failed.frameDurationsMs,midAnimationUndo:true,overlayAfterLastFrame:true});
  }
  report.checks.push('Real reachable defeats display all movement/combat frames before the terminal overlay, block further commands, and support mid-animation Undo plus defeat-panel Undo/Reset');
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{await window.happyDOM.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
