/** Targeted UI logic checks in a DOM simulator; not a visual browser test.
 * Install happy-dom outside the game and pass HAPPY_DOM_MODULE=/absolute/path/to/lib/index.js.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PullPuzzleSession, PALETTE } from '../dist/core.js';
import { SS03_LEVELS } from '../dist/levels.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { Window } = await import(process.env.HAPPY_DOM_MODULE ?? 'happy-dom');
const window = new Window({settings:{enableJavaScriptEvaluation:true}});
// Happy DOM omits the browser's Option constructor; use its native option element.
window.Option = function(text,value) {
  const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;
};
const captures = [];
let pixels = new Uint8ClampedArray(64 * 64 * 4);
window.HTMLCanvasElement.prototype.getContext = () => ({
  createImageData: (w,h) => ({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
  putImageData: image => {pixels=new Uint8ClampedArray(image.data);captures.push(pixels);},
});
const html = readFileSync(resolve(root,'dist/SS03-demo.html'),'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
const report = {success:false,environment:'happy-dom with a canvas pixel buffer stub',visualBrowserTest:false,checks:[]};
const ref = new PullPuzzleSession(SS03_LEVELS);
const rgba = frame => Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{
  const rgb=parseInt(PALETTE[c].slice(1),16);return [rgb>>>16,(rgb>>>8)&255,rgb&255,255];
})));
const $ = id => window.document.getElementById(id);
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const key = value => $('board').dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
const actionKey = [null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
const equalFrame = observation => assert.deepEqual(pixels,rgba(observation.frame));
const settled = async observation => {
  if (observation.frames.length > 1) await wait((observation.frameDurationsMs ?? observation.frames.map(()=>70)).reduce((a,b)=>a+b,0)+25);
  equalFrame(observation);
  assert.equal($('board').dataset.busy,'false');
};
const replay = async actions => {
  for (const action of actions) {key(actionKey[action]);await settled(ref.action(action));}
};
try {
  assert.equal(scripts.length,1);
  window.eval(scripts[0]);
  equalFrame(ref.observe());
  assert.equal($('board').dataset.level,'1');
  assert.equal($('tutorial').open,true);
  assert.equal($('tutorial').hidden,false);
  assert.ok(window.document.title.startsWith('SS03'));
  report.checks.push('Exact compiled inline script initializes level 1 and the open tutorial; canvas pixels match the engine');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4]);
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),['move','pull','release','place','gate']);
  assert.ok(!window.document.body.textContent.includes('Espace'));
  report.checks.push('Four directional controls and five pulling lessons; no preview or Space instruction');

  const countBefore=$('moves').textContent;
  key(' ');
  equalFrame(ref.observe());
  assert.equal($('moves').textContent,countBefore);
  report.checks.push('Space leaves both game pixels and the action counter unchanged');

  const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
  const tutorial=witnesses.find(w=>w.level===1)?.actions;
  assert.ok(tutorial?.length,'A verified tutorial witness is required for the UI replay');
  const probe=new PullPuzzleSession(SS03_LEVELS);
  let firstPull=-1;
  for (let i=0;i<tutorial.length;i++) {
    const next=probe.action(tutorial[i]);
    if (next.level===1 && next.frames.length===3) {firstPull=i;break;}
  }
  assert.ok(firstPull>=0,'Tutorial must exercise directional pulling before its exit');
  await replay(tutorial.slice(0,firstPull));
  const pullAction=tutorial[firstPull];
  const captureStart=captures.length;
  key(actionKey[pullAction]);
  const first=ref.action(pullAction);
  assert.equal($('board').dataset.busy,'true');
  assert.ok(window.document.querySelector('[data-lesson="move"]').classList.contains('done'));
  assert.ok(window.document.querySelector('[data-lesson="pull"]').classList.contains('done'));
  assert.equal($('feedback').textContent,'Traction réussie : la caisse suit le Voleur.');
  const countBusy=$('moves').textContent;
  key('ArrowRight');
  assert.equal($('moves').textContent,countBusy);
  await settled(first);
  for (let i=0;i<3;i++) assert.deepEqual(captures[captureStart+i],rgba(first.frames[i]));
  report.checks.push('A directional pull updates the lessons and displays all three engine frames; concurrent directions are ignored');

  $('undo').click();equalFrame(ref.undo());
  key(actionKey[pullAction]);ref.action(pullAction);
  assert.equal($('board').dataset.busy,'true');
  $('undo').click();ref.undo();
  await wait(180);equalFrame(ref.observe());
  assert.equal($('board').dataset.busy,'false');
  report.checks.push('Undo during a pull cancels pending animation frames');

  window.document.querySelector(`[data-action="${pullAction}"]`).click();ref.action(pullAction);
  assert.equal($('board').dataset.busy,'true');
  $('reset').click();ref.reset();
  await wait(180);equalFrame(ref.observe());
  assert.equal($('moves').textContent,'0 actions');
  assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')));
  report.checks.push('A direction button pulls; Reset during animation restores the initial pixels, counter, and lesson checklist');

  await replay(tutorial.slice(0,firstPull));
  key(actionKey[pullAction]);ref.action(pullAction);
  assert.equal($('board').dataset.busy,'true');
  $('level').value=String(SS03_LEVELS.length);$('level').dispatchEvent(new window.Event('change'));
  ref.selectLevel(SS03_LEVELS.length);
  await wait(180);equalFrame(ref.observe());
  assert.equal($('tutorial').hidden,true);
  assert.equal($('source-link').hidden,false);
  assert.ok($('source-link').href.startsWith('https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#'));
  $('restart').click();equalFrame(ref.restart());assert.equal($('tutorial').hidden,false);
  report.checks.push('Level selection during an animation cancels stale frames; source reference and return to the tutorial work');

  let checkedGateClosure=false;
  for (const action of tutorial) {
    await replay([action]);
    if (!checkedGateClosure && $('lesson-next').textContent.startsWith('Le passage est ouvert.')) {
      assert.equal(ref.observe().level,1);
      assert.ok(window.document.querySelector('[data-lesson="gate"]').classList.contains('done'));
      $('undo').click();equalFrame(ref.undo());
      assert.ok(!$('lesson-next').textContent.includes('Le passage est ouvert.'));
      assert.ok($('lesson-next').textContent.startsWith('Les trois + roses doivent être occupés ensemble.'));
      assert.ok(window.document.querySelector('[data-lesson="gate"]').classList.contains('done'),'The learned skill stays acquired while the current guidance changes');
      await replay([action]);
      assert.ok($('lesson-next').textContent.startsWith('Le passage est ouvert.'));
      checkedGateClosure=true;
    }
  }
  assert.ok(checkedGateClosure,'The tutorial must visibly open the gate before the exit');
  report.checks.push('Undo after opening the gate updates the current guidance to the closed passage while preserving the acquired lesson');
  assert.equal($('board').dataset.level,'2');
  assert.equal($('board').dataset.completed,'1');
  assert.equal($('tutorial').hidden,true);
  for (const id of ['move','pull','release','place','gate']) assert.ok(window.document.querySelector(`[data-lesson="${id}"]`).classList.contains('done'),`${id} lesson completes through real input and public pixels`);
  report.checks.push('The complete tutorial witness teaches all five lessons and advances automatically to level 2');

  assert.ok(captures.every(frame=>{
    for(let i=0;i<frame.length;i+=4)if(frame[i]===204&&frame[i+1]===204&&frame[i+2]===204)return false;
    return true;
  }));
  report.checks.push('All captured stable and animation frames contain no light-gray preview pixels');
  report.success=true;
} catch(error) {
  report.error=error.stack;process.exitCode=1;
} finally {
  await window.happyDOM.close();
  mkdirSync(resolve(root,'validation'),{recursive:true});
  writeFileSync(resolve(root,'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
