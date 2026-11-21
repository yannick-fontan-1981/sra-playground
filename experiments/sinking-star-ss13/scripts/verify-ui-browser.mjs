/** Native Chromium checks of the shipped standalone HTML; author-only tooling.
 * Prepared for an environment that explicitly permits a local browser.
 * Not executed in the restricted authoring session; no fallback or workaround. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS13_LEVELS} from '../dist/levels.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
let browser;
const htmlPath=resolve(root,'dist/SS13-demo.html');
const html=await readFile(htmlPath);
const witnesses=JSON.parse(await readFile(resolve(root,'tests/witnesses.json'),'utf8'));
const errors=[],network=[];
const report={success:false,browser:null,htmlSha256:createHash('sha256').update(html).digest('hex'),checks:[],levels:[]};
const screenshotDir=process.env.SS13_BROWSER_CAPTURE_DIR;
if(screenshotDir)await mkdir(screenshotDir,{recursive:true});
const frameHash=frame=>createHash('sha256').update(Uint8Array.from(frame.flatMap(row=>row.flatMap(c=>{const n=parseInt(PALETTE[c].slice(1),16);return[n>>>16,(n>>>8)&255,n&255,255];})))).digest('hex');
async function canvasHash(page){return createHash('sha256').update(Uint8Array.from(await page.locator('#board').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,64,64).data)))).digest('hex');}
async function settled(page){await page.locator('#board[data-busy="false"]').waitFor();}
async function send(page,action){
 const board=page.locator('#board');
 if(action.id===6){const box=await board.boundingBox();assert.ok(box);await page.mouse.click(box.x+(action.data.x+.5)*box.width/64,box.y+(action.data.y+.5)*box.height/64);}
 else await board.press({1:'ArrowUp',2:'ArrowDown',3:'ArrowLeft',4:'ArrowRight',5:'x'}[action.id]);
 await settled(page);
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 report.browser=browser.version();
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(htmlPath).href);await settled(page);
 assert.match(await page.title(),/SS13.*L’Ancre Verte/);
 assert.equal(await page.locator('#level option').count(),8);
 if(screenshotDir)await page.screenshot({path:resolve(screenshotDir,'ss13-desktop.png')});
 const session=new DuoPuzzleSession(SS13_LEVELS);
 assert.equal(await canvasHash(page),frameHash(session.observe().frame));
 for(const [index,witness] of witnesses.entries()){
  assert.equal(await page.locator('#board').getAttribute('data-level'),String(index+1));
  if(screenshotDir)await page.locator('.board-stage').screenshot({path:resolve(screenshotDir,`ss13-level-${index+1}.png`)});
  for(const action of witness.actions){await send(page,action);const next=session.action(action.id,action.data);assert.equal(await canvasHash(page),frameHash(next.frame),`L${index+1} action ${action.id}: visible canvas agrees with engine`);}
  if(index===0)assert.equal(await page.locator('[data-lesson].done').count(),14);
  assert.equal(await page.locator('#board').getAttribute('data-completed'),String(index+1));
  report.levels.push({level:index+1,title:SS13_LEVELS[index].title,actions:witness.actions.length,publicInputReplay:true,allFinalPixelsMatch:true});
 }
 assert.equal(await page.locator('#board').getAttribute('data-state'),'WIN');
 assert.equal(await page.locator('#victory').isVisible(),true);
 report.checks.push('All eight authored routes win through actual keyboard and canvas selection events, with matching visible pixels after every input.');
 report.checks.push('All fourteen tutorial discoveries are acquired and the final VICTORY panel is visible.');
 await page.locator('#undo').click();await settled(page);session.undo();assert.equal(await canvasHash(page),frameHash(session.observe().frame));
 assert.equal(await page.locator('#victory').isVisible(),false);
 await page.locator('#restart').click();await settled(page);session.restart();assert.equal(await canvasHash(page),frameHash(session.observe().frame));
 assert.equal(await page.locator('#lesson-progress').textContent(),'0 / 14 découvertes');
 await page.emulateMedia({reducedMotion:'no-preference'});
 const first=witnesses[0].actions[0];await send(page,first);session.action(first.id,first.data);
 assert.equal(await canvasHash(page),frameHash(session.observe().frame));
 await page.locator('#undo').click();await settled(page);session.undo();assert.equal(await canvasHash(page),frameHash(session.observe().frame));
 report.checks.push('Undo restores the winning action; Restart clears progress; normal animation advances and remains undoable.');
 await page.setViewportSize({width:390,height:844});await page.locator('#board').scrollIntoViewIfNeeded();
 const mobile=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,canvasWidth:document.querySelector('#board').getBoundingClientRect().width}));
 assert.ok(mobile.documentWidth<=mobile.viewport,'The mobile document must not overflow horizontally');assert.ok(mobile.canvasWidth>250&&mobile.canvasWidth<=390);
 if(screenshotDir)await page.screenshot({path:resolve(screenshotDir,'ss13-mobile.png'),fullPage:true});
 await page.locator('#level').selectOption('8');await settled(page);assert.equal(await page.locator('#board').getAttribute('data-level'),'8');
 await page.locator('[data-hero="wizard"]').click();await settled(page);assert.equal(await page.locator('#board').getAttribute('data-selected'),'wizard');
 report.mobile={...mobile,levelSelection:true,roleSelection:true};
 assert.deepEqual(network,[],'Playing the standalone file needs no network request');assert.deepEqual(errors,[],'No browser JavaScript error');
 report.checks.push('390px mobile layout has no horizontal overflow and level/role controls work.');
 report.checks.push('The entire browser run performs zero network requests and reports zero JavaScript errors.');
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();await mkdir(resolve(root,'validation'),{recursive:true});await writeFile(resolve(root,'validation/browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
