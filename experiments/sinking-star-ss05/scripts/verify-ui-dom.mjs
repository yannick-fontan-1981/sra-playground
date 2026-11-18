/** Targeted checks of the actual standalone inline script in Happy DOM.
 * This is a DOM/keyboard/canvas-buffer test, not a visual browser test.
 * Pass HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js when external.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {BardPuzzleSession,PALETTE} from '../dist/core.js';
import {SS05_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const window=new Window({settings:{enableJavaScriptEvaluation:true}});
window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
const captures=[];
let pixels=new Uint8ClampedArray(64*64*4);
window.HTMLCanvasElement.prototype.getContext=()=>({
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
  putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);},
});
// A controlled timer queue exercises every animation callback without wall-clock waits.
let timerId=0;
const timers=[],waits=[];
window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
const flush=async()=>{
  for(let n=0;n<200;n++){
    await Promise.resolve();
    if(!timers.length){await Promise.resolve();if(!timers.length)return;}
    const next=timers.shift();next.callback(...next.args);
  }
  throw new Error('Animation did not settle within 200 timer callbacks');
};
const html=readFileSync(resolve(root,'dist/SS05-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
const report={success:false,environment:'happy-dom with a canvas pixel buffer and controlled animation timer queue',visualBrowserTest:false,checks:[]};
const ref=new BardPuzzleSession(SS05_LEVELS);
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const rgb=parseInt(PALETTE[c].slice(1),16);return[rgb>>>16,(rgb>>>8)&255,rgb&255,255];})));
const $=id=>window.document.getElementById(id);
const key=value=>$('board').dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
const actionKeys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const equalFrame=observation=>assert.deepEqual(pixels,rgba(observation.frame));
const settled=async observation=>{await flush();equalFrame(observation);assert.equal($('board').dataset.busy,'false');};
let witnessMode=false,witnessActions=0,witnessFrames=0;
const replay=async actions=>{for(const action of actions){
  const start=captures.length,waitStart=waits.length;
  key(actionKeys[action]);const next=ref.action(action);
  if(next.frames.length>1&&next.state!=='NOT_FINISHED'){
    assert.equal($('victory').hidden,true,'Victory must not cover the final animation');
    assert.equal($('defeat').hidden,true,'Defeat must not cover the final animation');
  }
  await settled(next);
  for(let i=0;i<next.frames.length;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),`Presented frame ${i+1}/${next.frames.length}`);
  assert.deepEqual(waits.slice(waitStart),(next.frameDurationsMs??next.frames.map(()=>70)).slice(0,-1),'Every frame uses its engine-specified display duration');
  if(witnessMode){witnessActions++;witnessFrames+=next.frames.length;}
}};
const choose=level=>{$('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));equalFrame(ref.selectLevel(level));};
const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
const actionsFor=level=>{const actions=witnesses.find(w=>w.level===level)?.actions;assert.ok(actions?.length,`Level ${level} has a witness`);return actions;};
try{
  assert.equal(scripts.length,1);window.eval(scripts[0]);equalFrame(ref.observe());
  if(process.env.SS05_UI_CAPTURE_DIR){mkdirSync(process.env.SS05_UI_CAPTURE_DIR,{recursive:true});writeFileSync(resolve(process.env.SS05_UI_CAPTURE_DIR,'ss05-ui-initial.rgba'),pixels);}
  assert.equal($('board').dataset.level,'1');assert.equal($('tutorial').open,true);assert.equal($('tutorial').hidden,false);
  assert.equal($('piston-help').hidden,!LEVEL_INFO[0].piston);assert.equal($('defeat').hidden,true);
  assert.ok(window.document.title.startsWith('SS05'));
  report.checks.push('The complete compiled inline script loads level 1 with its tutorial open and exact engine pixels');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4,5]);
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),['move','song','anchor','platform','mirror','gate']);
  assert.ok(!window.document.body.textContent.includes('Espace'));
  const countBefore=$('moves').textContent;key(' ');equalFrame(ref.observe());assert.equal($('moves').textContent,countBefore);
  report.checks.push('Four directions and the X reflection control exist; Space does not change game pixels or the action counter');

  const tutorial=actionsFor(1),probe=new BardPuzzleSession(SS05_LEVELS);
  let firstAnimation=-1;
  for(let i=0;i<tutorial.length;i++){const next=probe.action(tutorial[i]);if(next.level===1&&next.frames.length>1){firstAnimation=i;break;}}
  assert.ok(firstAnimation>=0,'Tutorial must animate a movement before its exit');
  await replay(tutorial.slice(0,firstAnimation));
  const action=tutorial[firstAnimation],captureStart=captures.length;
  key(actionKeys[action]);const first=ref.action(action);
  assert.equal($('board').dataset.busy,'true');
  const busyCount=$('moves').textContent;key('ArrowRight');key('x');assert.equal($('moves').textContent,busyCount);
  await settled(first);
  for(let i=0;i<first.frames.length;i++)assert.deepEqual(captures[captureStart+i],rgba(first.frames[i]),`Animation frame ${i+1}`);
  report.checks.push('Directional movement shows every engine animation frame and ignores concurrent input');

  $('undo').click();equalFrame(ref.undo());
  key(actionKeys[action]);ref.action(action);assert.equal($('board').dataset.busy,'true');
  $('undo').click();const undone=ref.undo();await settled(undone);
  report.checks.push('Undo during animation restores the complete pre-action observation and cancels stale frames');

  window.document.querySelector(`[data-action="${action}"]`).click();ref.action(action);assert.equal($('board').dataset.busy,'true');
  $('reset').click();await settled(ref.reset());assert.equal($('moves').textContent,'0 actions');
  assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')));
  report.checks.push('A direction button acts; Reset during animation restores the room, counter and lesson checklist');

  await replay(tutorial.slice(0,firstAnimation));key(actionKeys[action]);ref.action(action);assert.equal($('board').dataset.busy,'true');
  choose(SS05_LEVELS.length);await settled(ref.observe());assert.equal($('tutorial').hidden,true);
  $('restart').click();await settled(ref.restart());assert.equal($('tutorial').hidden,false);
  report.checks.push('Changing level and returning to the tutorial cancel pending presentation callbacks');

  for(let level=1;level<=SS05_LEVELS.length;level++){
    choose(level);assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal($('tutorial').hidden,level!==1);
    assert.equal($('source-link').hidden,!LEVEL_INFO[level-1].url);
    if(LEVEL_INFO[level-1].url)assert.equal($('source-link').href,LEVEL_INFO[level-1].url);
  }
  assert.ok($('monster-help').textContent.includes('suivent le chant'));
  assert.ok($('mirror-help').textContent.includes('gris clair'));
  assert.ok($('tutorial').textContent.includes('X cyan'));
  assert.ok(window.document.querySelector('.rule-card').textContent.includes('5 × 5'));
  assert.ok(window.document.querySelector('.rule-card').textContent.includes('traverse les murs'));
  assert.ok($('monster-help').textContent.includes('s’éliminent mutuellement'));
  assert.ok($('piston-help').textContent.includes('ils doivent être occupés ensemble'));
  report.checks.push('Every room displays its own source and piston help; Bard aura, mobile platforms, reflection, cardinal-monster and shared-button rules are explained');

  $('restart').click();await settled(ref.restart());
  witnessMode=true;
  const reflectionIndex=tutorial.indexOf(5);assert.ok(reflectionIndex>=0,'Tutorial has an actual reflection');
  await replay(tutorial.slice(0,reflectionIndex));
  const reflectionStart=captures.length,reflectionWaitStart=waits.length;
  window.document.querySelector('[data-action="5"]').click();const reflected=ref.action(5);
  assert.ok(reflected.frames.length>=3,'The reflection animates');
  await settled(reflected);
  assert.deepEqual(waits.slice(reflectionWaitStart),reflected.frameDurationsMs.slice(0,-1));
  witnessActions++;witnessFrames+=reflected.frames.length;
  for(let i=0;i<reflected.frames.length;i++)assert.deepEqual(captures[reflectionStart+i],rgba(reflected.frames[i]),`Reflection frame ${i+1}`);
  await replay(tutorial.slice(reflectionIndex+1));
  report.checks.push('The reflection button dispatches ACTION5 and presents every teleport frame; keyboard X is exercised by the other routes');
  assert.equal(ref.observe().levelsCompleted,1);assert.equal(ref.observe().level,2);
  for(const lesson of ['move','song','anchor','platform','mirror','gate'])assert.ok(window.document.querySelector(`[data-lesson="${lesson}"]`).classList.contains('done'),`${lesson} is learned through public pixels and real input`);
  report.checks.push('The complete tutorial witness earns all six lessons through real keyboard input and advances to level 2');

  for(let level=2;level<=SS05_LEVELS.length;level++){
    assert.equal(ref.observe().level,level);const before=ref.observe().levelsCompleted;
    await replay(actionsFor(level));assert.equal(ref.observe().levelsCompleted,before+1);
  }
  witnessMode=false;
  report.witnessCoverage={levels:SS05_LEVELS.length,actions:witnessActions,frames:witnessFrames,frameDurationsVerified:true};
  assert.equal(witnessActions,witnesses.reduce((sum,w)=>sum+w.actions.length,0));
  assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);
  assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>b.disabled));
  const wonCount=$('moves').textContent;key('ArrowDown');key('x');assert.equal($('moves').textContent,wonCount);
  report.checks.push('All eight verified routes show every animation frame through the actual interface; WIN requires all rooms and blocks further directional and reflection input');

  $('undo').click();await settled(ref.undo());assert.equal($('victory').hidden,true);
  assert.equal(ref.observe().levelsCompleted,SS05_LEVELS.length-1);assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>!b.disabled));
  $('restart').click();await settled(ref.restart());assert.equal(ref.observe().levelsCompleted,0);assert.equal(ref.observe().level,1);
  report.checks.push('Undo can leave the final victory; Restart clears completion and returns to the open tutorial');

  // This actual-room mistake reflects the Bard into open water in level 6.
  // Engine unit tests cover monster combat; this real UI route covers the common defeat flow.
  const fatal={level:6,actions:[4,4,4,5],cause:'reflection into unsupported water'};
  const fatalProbe=new BardPuzzleSession(SS05_LEVELS);fatalProbe.selectLevel(fatal.level);
  for(const action of fatal.actions)fatalProbe.action(action);
  assert.equal(fatalProbe.observe().state,'GAME_OVER','The authored fatal route must remain an actual reachable defeat');
  choose(fatal.level);await replay(fatal.actions);assert.equal(ref.observe().state,'GAME_OVER');assert.equal($('defeat').hidden,false);
  assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>b.disabled));
  const deadCount=$('moves').textContent;key('ArrowUp');key('x');assert.equal($('moves').textContent,deadCount);
  $('undo-defeat').click();await settled(ref.undo());assert.equal($('defeat').hidden,true);assert.equal(ref.observe().state,'NOT_FINISHED');
  await replay([fatal.actions.at(-1)]);assert.equal($('defeat').hidden,false);
  $('reset-defeat').click();await settled(ref.reset());assert.equal($('defeat').hidden,true);
  report.gameOverCoverage={status:'verified-through-real-ui',level:fatal.level,actions:fatal.actions,cause:fatal.cause};
  report.checks.push('A reachable reflection-into-water defeat waits for the last animation frame before GAME_OVER, disables directions, and supports Undo and Reset from the defeat panel');

  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
  await window.happyDOM.close();mkdirSync(resolve(root,'validation'),{recursive:true});
  writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
