/** Native Chromium verification of the delivered file:// HTML through real UI events. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const playwright=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const chromium=playwright.chromium??playwright.default.chromium;
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS10_LEVELS} from '../dist/levels.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const reportPath=resolve(root,'validation/browser-report.json');
const htmlPath=resolve(root,'dist/SS10-demo.html');
const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
const failures=JSON.parse(readFileSync(resolve(root,'tests/failures.json'),'utf8'));
const lessonIds=['move','select','warrior-push','chain','thief-pull','single-pull','release','mirror-motion','platform','mirror','gate','goals'];
const report={success:false,environment:'Native /usr/bin/chromium, Playwright, file:// standalone HTML',htmlSha256:createHash('sha256').update(readFileSync(htmlPath)).digest('hex'),checks:[],campaign:{levels:0,actions:0,frames:0,selections:0,finalFramesComparedByteForByte:0},networkRequests:[],consoleErrors:[],pageErrors:[],screenshots:[]};
const rgb=PALETTE.map(c=>parseInt(c.slice(1),16));
const rgba=frame=>Uint8Array.from(frame.flatMap(row=>row.flatMap(c=>[rgb[c]>>>16,(rgb[c]>>>8)&255,rgb[c]&255,255])));
function digest(data){let h=2166136261;for(const x of data){h^=x;h=Math.imul(h,16777619);}return(h>>>0).toString(16);}
const keyNames={1:'ArrowUp',2:'ArrowDown',3:'ArrowLeft',4:'ArrowRight',5:'Space'};
let browser;
async function newPage({width=1280,height=1000,reducedMotion='reduce'}={}){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion});
 const page=await context.newPage();
 page.on('request',request=>{if(/^https?:/.test(request.url()))report.networkRequests.push(request.url());});
 page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
 page.on('pageerror',error=>report.pageErrors.push(error.message));
 await page.addInitScript(()=>{
  window.__ss10Paints=[];window.__ss10FullCaptures=false;
  const original=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(image,...args){
   if(this.canvas.id==='board'){
    let hash=2166136261;for(const v of image.data){hash^=v;hash=Math.imul(hash,16777619);}
    window.__ss10Paints.push({at:performance.now(),hash:(hash>>>0).toString(16),...(window.__ss10FullCaptures?{data:Array.from(image.data)}:{})});
   }
   return original.call(this,image,...args);
  };
 });
 await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'load'});
 await page.waitForFunction(()=>document.querySelector('#board')?.dataset.busy==='false');
 return {context,page,ref:new DuoPuzzleSession(SS10_LEVELS),selectionCount:0};
}
async function clearPaints(h){await h.page.evaluate(()=>{window.__ss10Paints=[];});}
async function check(h,expected,{frames=true,label='frame'}={}){
 await h.page.waitForFunction(()=>document.querySelector('#board').dataset.busy==='false');
 const actual=await h.page.evaluate(()=>{const canvas=document.querySelector('#board');return{data:Array.from(canvas.getContext('2d').getImageData(0,0,64,64).data),dataset:{...canvas.dataset},paints:window.__ss10Paints.splice(0),moves:document.querySelector('#moves').textContent};});
 assert.deepEqual(Uint8Array.from(actual.data),rgba(expected.frame),label+': exact final RGBA');
 assert.equal(actual.dataset.level,String(expected.level),label+': level');assert.equal(actual.dataset.completed,String(expected.levelsCompleted),label+': completion');assert.equal(actual.dataset.state,expected.state,label+': state');
 if(frames){assert.equal(actual.paints.length,expected.frames.length+1,label+': one paint per animation frame and settled repaint');for(let i=0;i<expected.frames.length;i++)assert.equal(actual.paints[i].hash,digest(rgba(expected.frames[i])),label+': animation frame '+i);}
 return actual;
}
async function input(h,action,selectionMethod){
 const {page}=h;
 if(action.id!==6){await page.locator('#board').focus();await page.keyboard.press(keyNames[action.id]);return;}
 const method=selectionMethod??['click','Tab','number','button'][h.selectionCount++%4];
 const color=h.ref.observe().frame[action.data.y][action.data.x],kind=color===8?'warrior':'thief';
 if(method==='click'){
  const canvas=page.locator('#board');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();assert.ok(box);
  await canvas.click({position:{x:(action.data.x+.5)*box.width/64,y:(action.data.y+.5)*box.height/64}});
 }else if(method==='button')await page.locator('[data-hero="'+kind+'"]').click();
 else{await page.locator('#board').focus();await page.keyboard.press(method==='number'?(kind==='warrior'?'1':'2'):'Tab');}
}
async function action(h,a,options={}){
 await clearPaints(h);await input(h,a,options.selectionMethod);const expected=h.ref.action(a.id,a.data),actual=await check(h,expected,{label:options.label??('ACTION'+a.id)});
 return {expected,actual};
}
async function reset(h,kind='reset',selector){await clearPaints(h);await h.page.locator(selector??'#'+kind).click();const expected=h.ref[kind]();await check(h,expected,{label:kind});return expected;}
async function choose(h,level){await clearPaints(h);await h.page.locator('#level').selectOption(String(level));const expected=h.ref.selectLevel(level);await check(h,expected,{label:'select level '+level});}
async function selectNext(h,method){const frame=h.ref.observe().frame;let data;
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if([8,14].includes(c)&&arms.filter(v=>v===c).length===4)data={x:px+1,y:py+1};}
 assert.ok(data,'Unselected hero is visible');return action(h,{id:6,data},{selectionMethod:method});}
try{
 mkdirSync(resolve(root,'validation/visual'),{recursive:true});
 assert.equal(SS10_LEVELS.length,8);assert.equal(witnesses.length,8);
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 report.chromiumVersion=browser.version();
 const h=await newPage();
 await check(h,h.ref.observe(),{label:'initial'});
 assert.equal(await h.page.locator('#tutorial').isVisible(),true);assert.equal(await h.page.locator('#tutorial').getAttribute('open'),'');
 assert.equal(await h.page.locator('#lesson-progress').textContent(),'0 / 12 découvertes');
 assert.match(await h.page.locator('#campaign-subtitle').textContent(),/Guerrier \+ Voleur/);
 await h.page.screenshot({path:resolve(root,'validation/visual/desktop-initial.png'),fullPage:false});report.screenshots.push('validation/visual/desktop-initial.png');
 for(const method of ['click','Tab','number','button']){const count=await h.page.locator('#moves').textContent();await selectNext(h,method);assert.equal(await h.page.locator('#moves').textContent(),count);}
 await h.page.locator('#board').focus();await h.page.keyboard.press('Shift+Tab');assert.notEqual(await h.page.evaluate(()=>document.activeElement.id),'board');
 report.checks.push('Initial level1 tutorial is open; pixel click, Tab,1/2 and hero buttons select without incrementing movement counter; Shift+Tab exits canvas.');
 await reset(h,'restart');
 for(let level=1;level<=8;level++){
  assert.equal(h.ref.observe().level,level);
  const route=witnesses.find(w=>w.level===level);assert.ok(route?.actions?.length,'Witness actions for '+level);
  for(let i=0;i<route.actions.length;i++){
   const a=route.actions[i],r=await action(h,a,{label:`L${level} action${i+1}`});
   report.campaign.actions++;report.campaign.frames+=r.expected.frames.length;report.campaign.selections+=+(a.id===6);report.campaign.finalFramesComparedByteForByte++;
  }
  report.campaign.levels++;
  if(level===1){const found=await h.page.locator('[data-lesson].done').evaluateAll(nodes=>nodes.map(n=>n.dataset.lesson));assert.deepEqual([...found].sort(),[...lessonIds].sort());report.tutorial={actions:route.actions.length,discoveries:found,count:found.length};}
 }
 assert.equal(h.ref.observe().state,'WIN');assert.equal(await h.page.locator('#victory').isVisible(),true);assert.equal(await h.page.locator('#victory strong').textContent(),'VICTORY');
 assert.equal(await h.page.locator('#progress').textContent(),'8 / 8 terminés');
 report.checks.push('All eight witnesses finish through real keyboard/pixel events; all final canvas frames match native reference RGBA byte-for-byte and all animation-frame hashes agree.');
 report.checks.push('All twelve level1 tutorial discoveries are earned by its real winning route; final campaign shows VICTORY and8/8.');
 await reset(h,'restart');assert.equal(await h.page.locator('#moves').textContent(),'0 actions');assert.equal(await h.page.locator('#lesson-progress').textContent(),'0 / 12 découvertes');
 for(const route of failures){
  await choose(h,route.level);let beforeLast;
  for(let i=0;i<route.actions.length;i++){if(i===route.actions.length-1)beforeLast=h.ref.observe();await action(h,route.actions[i],{label:`defeat L${route.level} action${i+1}`});}
  assert.equal(h.ref.observe().state,'GAME_OVER');assert.equal(await h.page.locator('#defeat').isVisible(),true);assert.equal(await h.page.locator('[data-action="1"]').isDisabled(),true);
  await reset(h,'undo','#undo-defeat');assert.deepEqual(h.ref.observe().frame,beforeLast.frame);assert.equal(await h.page.locator('#defeat').isVisible(),false);
  await action(h,route.actions.at(-1));assert.equal(await h.page.locator('#defeat').isVisible(),true);
  await reset(h,'reset','#reset-defeat');assert.equal(h.ref.observe().state,'NOT_FINISHED');assert.equal(await h.page.locator('#moves').textContent(),'0 actions');
 }
 report.checks.push('Reachable defeat route displays GAME_OVER, disables play, and supports panel Undo and Reset with exact restoration.');
 await h.context.close();
 const n=await newPage({reducedMotion:'no-preference'});await check(n,n.ref.observe());
 await n.page.evaluate(()=>{window.__ss10FullCaptures=true;});
 await clearPaints(n);await input(n,{id:3});const expected=n.ref.action(3);assert.equal(expected.frames.length,3);
 assert.equal(await n.page.locator('#board').getAttribute('data-busy'),'true');
 const count=await n.page.locator('#moves').textContent();await n.page.keyboard.press('ArrowRight');await n.page.keyboard.press('Tab');assert.equal(await n.page.locator('#moves').textContent(),count);
 const motion=await check(n,expected,{label:'normal three-frame motion'});
 for(let i=0;i<3;i++)assert.deepEqual(Uint8Array.from(motion.paints[i].data),rgba(expected.frames[i]),'Normal movement frame'+i);
 const intervals=[motion.paints[1].at-motion.paints[0].at,motion.paints[2].at-motion.paints[1].at];assert.ok(intervals[0]>=45&&intervals[1]>=65,'Real animation delays respected');report.normalAnimation={frames:3,intervalsMs:intervals,expectedDelayMs:[60,80]};
 await reset(n,'reset');
 for(const interrupt of ['undo','reset','level']){
  await clearPaints(n);await input(n,{id:3});n.ref.action(3);assert.equal(await n.page.locator('#board').getAttribute('data-busy'),'true');
  await clearPaints(n);
  if(interrupt==='level'){await n.page.locator('#level').selectOption('2');await check(n,n.ref.selectLevel(2),{label:'interrupt level'});}
  else{await n.page.keyboard.press(interrupt==='undo'?'z':'r');await check(n,n.ref[interrupt](),{label:'interrupt '+interrupt});}
  const snapshot=n.ref.observe();await n.page.waitForTimeout(220);await check(n,snapshot,{frames:false,label:'stale animation cancellation '+interrupt});
  await reset(n,'restart');
 }
 report.checks.push('Normal three-frame movement renders1/2/3pixel advances with real delays; commands are locked while busy; Undo,Reset and level selection cancel stale animations.');
 // A defeat must remain hidden until its animation finishes and Undo can interrupt it.
 await n.page.emulateMedia({reducedMotion:'reduce'});const failure=failures[0];await choose(n,failure.level);
 for(const a of failure.actions.slice(0,-1))await action(n,a);
 const previous=n.ref.observe();await n.page.emulateMedia({reducedMotion:'no-preference'});await clearPaints(n);await input(n,failure.actions.at(-1));n.ref.action(failure.actions.at(-1).id,failure.actions.at(-1).data);
 assert.equal(await n.page.locator('#board').getAttribute('data-busy'),'true');assert.equal(await n.page.locator('#defeat').isVisible(),false);
 await clearPaints(n);await n.page.keyboard.press('z');await check(n,n.ref.undo(),{label:'interrupt defeat'});assert.deepEqual(n.ref.observe().frame,previous.frame);
 await n.page.waitForTimeout(300);await check(n,n.ref.observe(),{frames:false,label:'defeat stale cancellation'});assert.equal(await n.page.locator('#defeat').isVisible(),false);
 report.checks.push('Death overlay waits for the real teleport animation; mid-animation Undo restores the living frame and no stale death repaint occurs.');
 await n.context.close();
 const m=await newPage({width:375,height:900});await check(m,m.ref.observe());
 const mobile=await m.page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,canvas:document.querySelector('#board').getBoundingClientRect().width}));
 assert.ok(mobile.document<=mobile.viewport&&mobile.body<=mobile.viewport,'No horizontal overflow at375px');assert.ok(mobile.canvas>250&&mobile.canvas<=375);
 await selectNext(m,'click');await action(m,{id:1});await reset(m,'reset');
 await m.page.evaluate(()=>scrollTo(0,0));await m.page.screenshot({path:resolve(root,'validation/visual/mobile-375.png'),fullPage:true});report.screenshots.push('validation/visual/mobile-375.png');report.mobile=mobile;
 report.checks.push('375px mobile layout has no horizontal overflow and scaled canvas pixel selection, movement and Reset work.');
 await m.context.close();
 assert.deepEqual(report.networkRequests,[],'Standalone game makes no HTTP requests');assert.deepEqual(report.consoleErrors,[]);assert.deepEqual(report.pageErrors,[]);
 report.success=true;
}catch(error){report.error={message:error.message,stack:error.stack};process.exitCode=1;}
finally{if(browser)await browser.close();writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
