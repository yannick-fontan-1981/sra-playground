/** Targeted UI logic checks in a DOM simulator; not a visual browser test.
 * Install happy-dom outside the game and pass HAPPY_DOM_MODULE=/absolute/path/to/lib/index.js.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PushPuzzleSession, PALETTE } from '../dist/core.js';
import { SS02_LEVELS } from '../dist/levels.js';

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
const html = readFileSync(resolve(root,'dist/SS02-demo.html'),'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
const report = {success:false,environment:'happy-dom with a canvas pixel buffer stub',visualBrowserTest:false,checks:[]};
const ref = new PushPuzzleSession(SS02_LEVELS);
const rgba = frame => Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{
  const rgb=parseInt(PALETTE[c].slice(1),16);return [rgb>>>16,(rgb>>>8)&255,rgb&255,255];
})));
const $ = id => window.document.getElementById(id);
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const key = value => $('board').dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
const equalFrame = observation => assert.deepEqual(pixels,rgba(observation.frame));
try {
  assert.equal(scripts.length,1);
  window.eval(scripts[0]);
  equalFrame(ref.observe());
  assert.equal($('board').dataset.level,'1');
  assert.equal($('tutorial').open,true);
  report.checks.push('Exact compiled inline script initializes level 1 and the open tutorial; canvas pixels match the engine');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4]);
  assert.equal(window.document.querySelector('[data-lesson="preview"]'),null);
  assert.ok(!window.document.body.textContent.includes('Espace'));
  report.checks.push('Only four directional controls; no preview lesson or Space instruction');

  const countBefore=$('moves').textContent;
  key(' ');
  equalFrame(ref.observe());
  assert.equal($('moves').textContent,countBefore);
  report.checks.push('Space leaves both game pixels and action counter unchanged');

  key('ArrowRight');
  const firstMove=ref.action(4);
  equalFrame(firstMove);
  assert.ok(window.document.querySelector('[data-lesson="move"]').classList.contains('done'));
  report.checks.push('Directional keyboard input moves the Warrior and updates the movement lesson');

  key('ArrowRight');
  const chain=ref.action(4);
  assert.equal($('board').dataset.busy,'true');
  assert.ok(window.document.querySelector('[data-lesson="chain"]').classList.contains('done'));
  assert.equal($('feedback').textContent,'Poussée réussie.');
  await wait(180);
  equalFrame(chain);
  assert.equal($('board').dataset.busy,'false');
  report.checks.push('A second directional key pushes the chain directly, animates, and completes the chain lesson');

  $('undo').click();ref.undo();equalFrame(ref.observe());
  key('ArrowRight');ref.action(4);
  $('undo').click();ref.undo();
  await wait(180);equalFrame(ref.observe());
  report.checks.push('Undo during a directional push cancels pending animation frames');

  window.document.querySelector('[data-action="4"]').click();ref.action(4);
  assert.equal($('board').dataset.busy,'true');
  $('reset').click();ref.reset();
  await wait(180);equalFrame(ref.observe());
  assert.equal($('moves').textContent,'0 actions');
  report.checks.push('Direction button pushes; Reset during animation restores the initial pixels and counter');

  $('level').value='8';$('level').dispatchEvent(new window.Event('change'));
  equalFrame(ref.selectLevel(8));assert.equal($('tutorial').hidden,true);
  $('restart').click();equalFrame(ref.restart());assert.equal($('tutorial').hidden,false);
  report.checks.push('Level selection and return to the tutorial restore matching engine pixels');

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
