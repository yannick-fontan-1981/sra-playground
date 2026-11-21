/** Browser release gate for the actual built Playground; reference commands remain test-only. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { routes } from '../tests/ss01-routes.ts';
import { SinkingStarSession } from '../src/games/sinking-star/core.ts';
import { SS01_LEVELS } from '../src/games/sinking-star/levels.ts';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const out = 'validation/ss01-custom4';
await mkdir(out,{recursive:true});
const server = spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
const url='http://127.0.0.1:4173';
let browser;
const report={sourceCommit:process.env.GITHUB_SHA??null,checks:[],errors:[],nativePythonRequests:[]};
try {
  for(let i=0;i<100;i++) {try {if((await fetch(url)).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{
    window.__ss01qa=[];
    const OriginalWorker=window.Worker;
    window.Worker=class extends OriginalWorker {
      constructor(...args){super(...args);this.addEventListener('message',e=>{
        const r=e.data?.result;if(r?.frame&&r?.availableActionIds)window.__ss01qa.push(r);
      });}
    };
  });
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  let nativePhase=true;
  page.on('request',r=>{if(nativePhase&&/\/(?:python|vendor\/pyodide)\//.test(r.url()))report.nativePythonRequests.push(r.url());});
  const latest=()=>page.evaluate(()=>window.__ss01qa.at(-1));
  const count=()=>page.evaluate(()=>window.__ss01qa.length);
  async function changed(before) {await page.waitForFunction(n=>window.__ss01qa.length>n,before,{timeout:120000});return latest();}
  async function ready(){await page.waitForFunction(()=>!document.querySelector('#space-button').disabled,{timeout:30000});}
  async function command(letter){
    await ready();const n=await count();
    await page.locator('#game-canvas').press({U:'ArrowUp',D:'ArrowDown',L:'ArrowLeft',R:'ArrowRight',X:'Space',C:'c'}[letter]);
    return changed(n);
  }
  async function click(selector){const n=await count();await page.locator(selector).click();return changed(n);}
  await page.goto(`${url}/?game=SS01&level=1#playground`);
  await changed(0);await page.locator('#manual-tab').click();await ready();
  assert.deepEqual(await page.locator('#game-select optgroup[label="Custom 4 · Sinking Star"] option').evaluateAll(opts=>opts.map(o=>o.value)),['SS01','SS02','SS03','SS04','SS05','SS06','SS07','SS08','SS09','SS10','SS11','SS12','SS13','SS14']);
  const initial=await latest();assert.equal(initial.levelCount,8);assert.ok(initial.availableActionIds.includes(6));
  const reference=new SinkingStarSession(SS01_LEVELS);
  assert.deepEqual(initial.frame,reference.observe().frame);
  await page.screenshot({path:`${out}/ss01-initial.png`,fullPage:true});
  await command('C');await ready();await click('#undo-button');await ready();
  assert.deepEqual((await latest()).frame,initial.frame);
  let n=await count();await page.locator('#level-select').selectOption('8');await changed(n);await ready();
  assert.equal((await latest()).level,8);
  await click('#restart-button');await ready();assert.equal((await latest()).level,1);
  report.checks.push('Custom 4 selector, two-Merchant L1, C, Undo, direct L8 and restart');
  let animations=0,actions=0;
  for(const [index,packed] of routes.entries()){
    assert.equal((await latest()).level,index+1);
    for(const letter of packed.replace(/([A-Z])(\d+)/g,(_,c,n)=>c.repeat(Number(n)))){
      const o=await command(letter);
      const expected=letter==='C'?reference.nextMerchant():reference.action({U:1,D:2,L:3,R:4,X:5}[letter]);
      assert.deepEqual(o.frame,expected.frame,`Pixel parity after ${letter} in level ${index+1}`);
      assert.deepEqual(o.frames,expected.frames);
      assert.deepEqual(o.frameDurationsMs,expected.frameDurationsMs);
      assert.equal(o.state,expected.state);
      if(o.frames.length>1)animations++;
      actions++;
    }
  }
  await page.locator('#win-overlay').waitFor({state:'visible'});
  assert.equal((await latest()).state,'WIN');
  assert.equal((await latest()).levelsCompleted,8);
  assert.equal(await page.locator('#win-title').textContent(),'VICTORY');
  await page.screenshot({path:`${out}/ss01-victory.png`,fullPage:true});
  assert.equal(report.nativePythonRequests.length,0);
  report.checks.push(`Eight-level campaign completed through UI: ${actions} commands, ${animations} animated transitions; no Python download`);
  nativePhase=false;
  for(const code of ['CASC','LS20','SS01']){
    n=await count();await page.locator('#game-select').selectOption(code);await changed(n);
    const o=await latest();assert.equal(o.gameCode??o.code,code);assert.equal(o.frame.length,64);
    await page.waitForFunction(()=>!document.querySelector('[data-action="1"]').disabled,{timeout:120000});
    n=await count();await page.locator('#game-canvas').press('ArrowUp');await changed(n);
  }
  report.checks.push('Real Python legacy CASC and LS20 load/action, followed by native SS01 reload');
  await page.goto(`${url}/gallery.html`);
  const section=page.locator('#custom-wave-4');
  assert.deepEqual(await section.locator('[data-gallery-game]').evaluateAll(cards=>cards.map(c=>c.dataset.galleryGame)),['SS01','SS02','SS03','SS04','SS05','SS06','SS07','SS08','SS09','SS10','SS11','SS12','SS13','SS14']);
  const gameCard=section.locator('[data-gallery-game="SS01"]');
  assert.equal(await gameCard.locator('option').count(),8);
  await gameCard.locator('[data-gallery-level]').selectOption('8');
  assert.match(await gameCard.locator('[data-gallery-launch]').getAttribute('href'),/game=SS01&level=8/);
  await section.screenshot({path:`${out}/custom4-gallery.png`});
  await gameCard.locator('[data-gallery-launch]').click();await changed(0);
  assert.equal((await latest()).level,8);assert.equal((await latest()).gameCode, 'SS01');
  await page.locator('#manual-tab').click();await ready();
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal mobile overflow');
  await page.screenshot({path:`${out}/ss01-mobile.png`,fullPage:true});
  report.checks.push('Real eight-level atlas, gallery launch to L8, mobile layout');
  assert.deepEqual(report.errors,[]);
  report.success=true;
} catch(error) {
  report.success=false;report.failure=String(error?.stack??error);throw error;
} finally {
  await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser?.close();server.kill('SIGTERM');
}
