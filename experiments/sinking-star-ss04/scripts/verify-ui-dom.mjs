/** Targeted checks of the actual standalone inline script in Happy DOM.
 * This is a DOM/keyboard/canvas-buffer test, not a visual browser test.
 * Pass HAPPY_DOM_MODULE=/absolute/path/to/happy-dom/lib/index.js when external.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {WizardPuzzleSession,PALETTE} from '../dist/core.js';
import {SS04_LEVELS} from '../dist/levels.js';
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
const timers=[];
window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});return id;};
window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
const flush=async()=>{
  for(let n=0;n<200;n++){
    await Promise.resolve();
    if(!timers.length){await Promise.resolve();if(!timers.length)return;}
    const next=timers.shift();next.callback(...next.args);
  }
  throw new Error('Animation did not settle within 200 timer callbacks');
};
const html=readFileSync(resolve(root,'dist/SS04-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
const report={success:false,environment:'happy-dom with a canvas pixel buffer and controlled animation timer queue',visualBrowserTest:false,checks:[]};
const ref=new WizardPuzzleSession(SS04_LEVELS);
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const rgb=parseInt(PALETTE[c].slice(1),16);return[rgb>>>16,(rgb>>>8)&255,rgb&255,255];})));
const $=id=>window.document.getElementById(id);
const key=value=>$('board').dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
const actionKeys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const equalFrame=observation=>assert.deepEqual(pixels,rgba(observation.frame));
const settled=async observation=>{await flush();equalFrame(observation);assert.equal($('board').dataset.busy,'false');};
const replay=async actions=>{for(const action of actions){
  const start=captures.length;
  key(actionKeys[action]);const next=ref.action(action);
  if(next.frames.length>1&&next.state!=='NOT_FINISHED'){
    assert.equal($('victory').hidden,true,'Victory must not cover the final animation');
    assert.equal($('defeat').hidden,true,'Defeat must not cover the final animation');
  }
  await settled(next);
  for(let i=0;i<next.frames.length;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),`Presented frame ${i+1}/${next.frames.length}`);
}};
const choose=level=>{$('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));equalFrame(ref.selectLevel(level));};
const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
const actionsFor=level=>{const actions=witnesses.find(w=>w.level===level)?.actions;assert.ok(actions?.length,`Level ${level} has a witness`);return actions;};
try{
  assert.equal(scripts.length,1);window.eval(scripts[0]);equalFrame(ref.observe());
  assert.equal($('board').dataset.level,'1');assert.equal($('tutorial').open,true);assert.equal($('tutorial').hidden,false);
  assert.equal($('piston-help').hidden,!LEVEL_INFO[0].piston);assert.equal($('defeat').hidden,true);
  assert.ok(window.document.title.startsWith('SS04'));
  report.checks.push('The complete compiled inline script loads level 1 with its tutorial open and exact engine pixels');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4]);
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),['move','swap','platform','mirror','place','gate']);
  assert.ok(!window.document.body.textContent.includes('Espace'));
  const countBefore=$('moves').textContent;key(' ');equalFrame(ref.observe());assert.equal($('moves').textContent,countBefore);
  report.checks.push('Only four directional controls exist; Space does not change game pixels or the action counter');

  const tutorial=actionsFor(1),probe=new WizardPuzzleSession(SS04_LEVELS);
  let firstAnimation=-1;
  for(let i=0;i<tutorial.length;i++){const next=probe.action(tutorial[i]);if(next.level===1&&next.frames.length>1){firstAnimation=i;break;}}
  assert.ok(firstAnimation>=0,'Tutorial must animate an exchange before its exit');
  await replay(tutorial.slice(0,firstAnimation));
  const action=tutorial[firstAnimation],captureStart=captures.length;
  key(actionKeys[action]);const first=ref.action(action);
  assert.equal($('board').dataset.busy,'true');
  const busyCount=$('moves').textContent;key('ArrowRight');assert.equal($('moves').textContent,busyCount);
  await settled(first);
  for(let i=0;i<first.frames.length;i++)assert.deepEqual(captures[captureStart+i],rgba(first.frames[i]),`Animation frame ${i+1}`);
  report.checks.push('Directional exchange shows every engine animation frame and ignores concurrent directional input');

  $('undo').click();equalFrame(ref.undo());
  key(actionKeys[action]);ref.action(action);assert.equal($('board').dataset.busy,'true');
  $('undo').click();const undone=ref.undo();await settled(undone);
  report.checks.push('Undo during animation restores the complete pre-action observation and cancels stale frames');

  window.document.querySelector(`[data-action="${action}"]`).click();ref.action(action);assert.equal($('board').dataset.busy,'true');
  $('reset').click();await settled(ref.reset());assert.equal($('moves').textContent,'0 actions');
  assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')));
  report.checks.push('A direction button acts; Reset during animation restores the room, counter and lesson checklist');

  await replay(tutorial.slice(0,firstAnimation));key(actionKeys[action]);ref.action(action);assert.equal($('board').dataset.busy,'true');
  choose(SS04_LEVELS.length);await settled(ref.observe());assert.equal($('tutorial').hidden,true);
  $('restart').click();await settled(ref.restart());assert.equal($('tutorial').hidden,false);
  report.checks.push('Changing level and returning to the tutorial cancel pending presentation callbacks');

  for(let level=1;level<=SS04_LEVELS.length;level++){
    choose(level);assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal($('tutorial').hidden,level!==1);
    assert.equal($('source-link').hidden,!LEVEL_INFO[level-1].url);
    if(LEVEL_INFO[level-1].url)assert.equal($('source-link').href,LEVEL_INFO[level-1].url);
  }
  assert.ok($('monster-help').textContent.includes('restent immobiles'));
  assert.ok($('monster-help').textContent.includes('s’éliminent mutuellement'));
  assert.ok($('piston-help').textContent.includes('ils doivent être occupés ensemble'));
  report.checks.push('Every room displays its own source and piston help; mirror, cardinal-monster and shared-button rules are explained');

  $('restart').click();await settled(ref.restart());
  await replay(tutorial);
  assert.equal(ref.observe().levelsCompleted,1);assert.equal(ref.observe().level,2);
  for(const lesson of ['move','swap','platform','mirror','place','gate'])assert.ok(window.document.querySelector(`[data-lesson="${lesson}"]`).classList.contains('done'),`${lesson} is learned through public pixels and real input`);
  report.checks.push('The complete tutorial witness earns all six lessons through real keyboard input and advances to level 2');

  for(let level=2;level<=SS04_LEVELS.length;level++){
    assert.equal(ref.observe().level,level);const before=ref.observe().levelsCompleted;
    await replay(actionsFor(level));assert.equal(ref.observe().levelsCompleted,before+1);
  }
  assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);
  assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>b.disabled));
  const wonCount=$('moves').textContent;key('ArrowDown');assert.equal($('moves').textContent,wonCount);
  report.checks.push('All eight verified routes show every animation frame through the actual interface; WIN requires all rooms and blocks further directional input');

  $('undo').click();await settled(ref.undo());assert.equal($('victory').hidden,true);
  assert.equal(ref.observe().levelsCompleted,SS04_LEVELS.length-1);assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>!b.disabled));
  $('restart').click();await settled(ref.restart());assert.equal(ref.observe().levelsCompleted,0);assert.equal(ref.observe().level,1);
  report.checks.push('Undo can leave the final victory; Restart clears completion and returns to the open tutorial');

  // Find a short reachable death using only the session API, then replay that exact path in the UI.
  let fatal=null;
  for(let level=1;level<=SS04_LEVELS.length&&!fatal;level++){
    const start=new WizardPuzzleSession(SS04_LEVELS);const initial=start.selectLevel(level);
    const hasMonster=initial.frame.some((row,y)=>row.some((c,x)=>c===8&&initial.frame[y-1]?.[x]===5&&initial.frame[y+1]?.[x]===5&&row[x-1]===5&&row[x+1]===5));
    if(!hasMonster)continue;
    const queue=[[]],seen=new Set();
    for(let index=0;index<queue.length&&index<1500&&!fatal;index++){
      const route=queue[index];const trial=new WizardPuzzleSession(SS04_LEVELS);trial.selectLevel(level);
      let observation=trial.observe();for(const a of route)observation=trial.action(a);
      if(observation.state==='GAME_OVER'){fatal={level,actions:route};break;}
      if(observation.level!==level||observation.state!=='NOT_FINISHED'||route.length>=8)continue;
      const hash=JSON.stringify(observation.frame);if(seen.has(hash))continue;seen.add(hash);
      for(const a of [1,2,3,4])queue.push([...route,a]);
    }
  }
  assert.ok(fatal,'A reachable monster death should be exercised in the UI');
  choose(fatal.level);await replay(fatal.actions);assert.equal(ref.observe().state,'GAME_OVER');assert.equal($('defeat').hidden,false);
  assert.ok([...window.document.querySelectorAll('[data-action]')].every(b=>b.disabled));
  const deadCount=$('moves').textContent;key('ArrowUp');assert.equal($('moves').textContent,deadCount);
  $('undo-defeat').click();await settled(ref.undo());assert.equal($('defeat').hidden,true);assert.equal(ref.observe().state,'NOT_FINISHED');
  await replay([fatal.actions.at(-1)]);assert.equal($('defeat').hidden,false);
  $('reset-defeat').click();await settled(ref.reset());assert.equal($('defeat').hidden,true);
  report.gameOverCoverage={status:'verified-through-real-ui',level:fatal.level,actions:fatal.actions};
  report.checks.push('A reachable monster defeat waits for the last animation frame before GAME_OVER, disables directions, and supports Undo and Reset from the defeat panel');

  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
  await window.happyDOM.close();mkdirSync(resolve(root,'validation'),{recursive:true});
  writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
