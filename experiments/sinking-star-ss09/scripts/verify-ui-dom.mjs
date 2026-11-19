/** Actual compiled HTML, DOM input, canvas pixel buffers and controlled timers. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS09_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const fixturesOnly=process.argv.includes('--fixtures-only');
const tutorialOnly=process.argv.includes('--tutorial-only');
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const html=readFileSync(resolve(root,'dist/SS09-demo.html'),'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,1);
const entry='const session = new DuoPuzzleSession(SS09_LEVELS);';
assert.equal(scripts[0].split(entry).length,2);
const lessonIds=['select','move','merchant-push','bard-song','partner-song','selective-song','platform','support-slide','mirror-motion','mirror','gate','goals'];
const keys=[null,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight','x'];
const normal=a=>typeof a==='number'?{id:a}:{id:a.id??a.actionId??a.action,data:a.data};
const rgba=frame=>Uint8ClampedArray.from(frame.flatMap(row=>row.flatMap(c=>{const n=parseInt(PALETTE[c].slice(1),16);return[n>>>16,(n>>>8)&255,n&255,255];})));
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===12||c===6)&&arms.filter(v=>v===c).length>=3)all.push({color:c,x,y,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const goalCount=frame=>{let n=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+3*x,py=2+3*y;if([frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]].every(c=>c===11))n++;}return n;};
const dataAt=(spec,x,y)=>({x:3+3*(x+Math.floor((20-spec.rows[0].length)/2)),y:3+3*(y+Math.floor((20-spec.rows.length)/2))});
const tile=(frame,spec,x,y)=>{const p=dataAt(spec,x,y);return frame.slice(p.y-1,p.y+2).map(r=>r.slice(p.x-1,p.x+2));};
const colorCount=(frame,c)=>frame.reduce((n,row)=>n+row.filter(v=>v===c).length,0);
const makeArena=(name,placements,options={})=>{const cells=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));cells[7][1]='g';cells[7][2]='g';for(const [x,y,c] of placements)cells[y][x]=c;return{id:'ss09-ui-'+name,title:name,rows:cells.map(r=>r.join('')),...options};};
const createHarness=spec=>{
 const levels=spec?[spec,...SS09_LEVELS.slice(1)]:SS09_LEVELS;
 const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
 const captures=[],timers=[],waits=[];let pixels=new Uint8ClampedArray(64*64*4),timerId=0;
 window.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);}});
 window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:512,bottom:512,width:512,height:512,toJSON(){return this;}});
 window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
 window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
 const advance=async()=>{await Promise.resolve();assert.ok(timers.length,'Expected intermediate timer');const t=timers.shift();t.callback(...t.args);await Promise.resolve();};
 const flush=async()=>{for(let i=0;i<500;i++){await Promise.resolve();if(!timers.length){await Promise.resolve();if(!timers.length)return;}const t=timers.shift();t.callback(...t.args);}throw new Error('Animation did not settle');};
 window.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
 window.eval(spec?scripts[0].replace(entry,`const session = new DuoPuzzleSession([${JSON.stringify(spec)}, ...SS09_LEVELS.slice(1)]);`):scripts[0]);
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
const report={success:false,scope:fixturesOnly?'fixtures-only':tutorialOnly?'tutorial-only':'full-campaign',environment:'Happy DOM, compiled standalone HTML, canvas pixel buffer and controlled animation queue',visualBrowserTest:false,checks:[]};
const checkBardFixtures=async()=>{
 const cases=[
  {name:'near crate follows one step',placements:[[2,4,'B'],[7,7,'M'],[4,4,'o']],id:4,bard:[3,4],stone:[5,4],song:true},
  {name:'song crosses an intervening wall',placements:[[2,4,'B'],[7,7,'M'],[4,4,'o'],[3,3,'#'],[3,4,'#'],[3,5,'#']],id:1,bard:[2,3],stone:[4,3],song:true},
  {name:'diagonal corner is within radius two',placements:[[2,4,'B'],[7,7,'M'],[4,6,'o']],id:1,bard:[2,3],stone:[4,5],song:true},
  {name:'blocked member stays while another follows',placements:[[2,5,'B'],[7,7,'M'],[4,4,'o'],[4,6,'o'],[5,4,'#']],id:4,bard:[3,5],stone:[5,6],heldStone:[4,4],song:true,selective:true},
  {name:'inactive Merchant joins without extra pushing',placements:[[2,4,'B'],[4,4,'M']],id:4,bard:[3,4],merchant:[5,4],partner:true},
  {name:'sunken support slides over water',placements:[[2,3,'B'],[7,7,'M'],[4,3,'s'],[5,3,'~'],[6,3,'~']],id:4,bard:[3,3],support:[5,3],song:true,slid:true},
  {name:'sung crate becomes a support',placements:[[2,4,'B'],[7,7,'M'],[4,4,'o'],[5,4,'~']],id:4,bard:[3,4],support:[5,4],song:true,created:true},
  {name:'blocked Bard cancels the complete song',placements:[[2,4,'B'],[7,7,'M'],[3,4,'#'],[4,3,'o']],id:4,bard:[2,4],stone:[4,3],blocked:true},
  {name:'out of range crate does not follow',placements:[[2,4,'B'],[7,7,'M'],[5,4,'o']],id:4,bard:[3,4],stone:[5,4]},
  {name:'Merchant pushes Bard without a song',placements:[[2,4,'M'],[3,4,'B'],[4,3,'o']],id:4,bard:[4,4],merchant:[3,4],stone:[4,3],role:'merchant',push:true},
  {name:'song brings monsters into reciprocal combat',placements:[[2,4,'B'],[7,7,'M'],[4,3,'m'],[6,3,'m']],id:4,bard:[3,4],song:true,combat:true}
 ];
 const result=[];
 for(const f of cases){
  const spec=makeArena(f.name,f.placements),h=createHarness(spec);
  try{
   if(f.role!=='merchant'){const bard=heroes(h.ref.observe().frame).find(p=>p.color===6);await h.action({id:6,data:bard.data});assert.ok(colorCount(h.ref.observe().frame,6)>5,'Selected Bard displays its dotted aura');}
   else assert.ok(colorCount(h.ref.observe().frame,6)<=5,'Inactive Bard does not show an aura');
   const before=h.ref.observe();const next=await h.action(f.id);
   assert.equal(next.frames.length,f.blocked?1:f.combat?8:3);
   const bard=heroes(next.frame).find(p=>p.color===6);assert.deepEqual(bard.data,dataAt(spec,...f.bard));
   if(f.merchant)assert.deepEqual(heroes(next.frame).find(p=>p.color===12).data,dataAt(spec,...f.merchant));
   if(f.stone){const t=tile(next.frame,spec,...f.stone);assert.equal(t[1][1],5);for(const [x,y]of[[1,0],[0,1],[2,1],[1,2]])assert.equal(t[y][x],13);}
   if(f.heldStone)assert.equal(tile(next.frame,spec,...f.heldStone)[1][1],5);
   if(f.support){const t=tile(next.frame,spec,...f.support);for(const [x,y]of[[0,0],[2,0],[1,1],[0,2],[2,2]])assert.equal(t[y][x],10);}
   const learned=h.learned();assert.equal(learned['bard-song'],!!f.song,f.name+': song lesson');assert.equal(learned['partner-song'],!!f.partner,f.name+': partner lesson');assert.equal(learned['selective-song'],!!f.selective,f.name+': selective lesson');assert.equal(learned['support-slide'],!!f.slid,f.name+': slide lesson');assert.equal(learned.platform,!!f.created,f.name+': creation lesson');assert.equal(learned['merchant-push'],!!f.push,f.name+': push lesson');assert.equal(learned.move,!f.blocked,f.name+': move lesson');
   if(f.blocked)assert.ok(h.$('feedback').textContent.includes('chant entier est annulé'));
   if(f.combat){assert.equal(next.state,'NOT_FINISHED');assert.equal(colorCount(next.frame,8),0);assert.deepEqual(next.frameDurationsMs.slice(3),[80,90,100,110,0]);}
   await h.reset('undo');h.equal(before);
   result.push({case:f.name,frames:next.frames.length,exactPixelsAndTiming:true,publicLessons:true,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkReflectionFixtures=async()=>{
 const result=[];
 for(const f of [{name:'near hero ignores farther blocked arrival',farBlocked:true},{name:'near crate has a square outline',crate:true},{name:'equal distances exchange both heroes',tie:true}]){
  const placements=[[4,2,f.crate?'o':'M'],[f.tie?6:7,4,'B'],[4,4,'1']];if(f.crate)placements.push([1,6,'M']);if(f.farBlocked)placements.push([4,1,'#']);
  const spec=makeArena(f.name,placements),h=createHarness(spec);
  try{
   const before=h.ref.observe();
   if(!f.tie)assert.deepEqual(tile(before.frame,spec,6,4),f.crate?[[1,1,1],[1,3,1],[1,1,1]]:[[3,1,3],[1,1,1],[3,1,3]]);
   const start=h.captures.length;assert.equal(h.key(' '),false);const next=h.ref.action(5);await h.settled(next);
   assert.equal(next.frames.length,3);for(let i=0;i<3;i++)assert.deepEqual(h.captures[start+i],rgba(next.frames[i]));
   assert.ok(h.$('feedback').textContent.includes('priorité au plus proche'));
   assert.equal(h.learned().mirror,true);assert.equal(h.learned()['bard-song'],false);assert.equal(h.learned()['partner-song'],false);
   if(f.tie){assert.deepEqual(heroes(next.frame).find(p=>p.color===12).data,dataAt(spec,6,4));assert.deepEqual(heroes(next.frame).find(p=>p.color===6).data,dataAt(spec,4,2));}
   else assert.deepEqual(heroes(next.frame).find(p=>p.color===6).data,dataAt(spec,7,4));
   await h.reset('undo');h.equal(before);result.push({case:f.name,teleportFrames:3,preview:true,noSong:true,exactUndo:true});
  }finally{await h.close();}
 }
 return result;
};
const checkMirrorButton=async()=>{
 const spec=makeArena('mirror remains legible over button',[[2,4,'M'],[7,7,'B']],{mirrors:[{at:{x:3,y:4},facing:'NE'}],circuits:[{id:'pink',buttons:[{x:4,y:4}],color:7}],gates:[{at:{x:7,y:6},circuit:'pink',direction:'S',closedWhen:'pressed'}]});
 const h=createHarness(spec);try{
  const next=await h.action(4),t=tile(next.frame,spec,4,4);for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===y)assert.equal(t[y][x],0);else if(y>x)assert.equal(t[y][x],5);}
  assert.equal(h.learned()['mirror-motion'],true);assert.equal(h.learned().gate,true);return{mirrorAboveButton:true,mirrorMotionLesson:true,gateLesson:true,frames:next.frames.length};
 }finally{await h.close();}
};
let h;
try{
 report.bardCoverage=await checkBardFixtures();report.checks.push('Eleven compiled-HTML Bard cases verify song, radius, walls, selective blocking, partner escort, moving supports, water conversion, refusal, forced Bard motion and reciprocal combat');
 report.reflectionCoverage=await checkReflectionFixtures();report.checks.push('Nearest-source and equal-distance reflection fixtures preserve previews, pixels, no-song behavior and Undo');
 report.mirrorButtonCoverage=await checkMirrorButton();report.checks.push('Moving a mirror onto a button keeps its white diagonal and black back above device markings');
 if(tutorialOnly){
  const design=JSON.parse(readFileSync(resolve(root,'reference/level1-design.json'),'utf8'));h=createHarness(design.spec);
  for(const action of design.actions)await h.action(action);
  assert.equal(h.ref.observe().levelsCompleted,1);
  for(const id of lessonIds)assert.equal(h.learned()[id],true,'Real tutorial acquisition: '+id);
  report.tutorialCoverage={level:1,actions:design.actions.length,discoveries:[...lessonIds]};
  report.checks.push('The actual level 1 design earns all twelve discoveries through its public pixels');
 }
 if(!fixturesOnly&&!tutorialOnly){
  assert.equal(SS09_LEVELS.length,8);const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));assert.equal(witnesses.length,8);
  const actionsFor=level=>{const a=witnesses.find(w=>w.level===level)?.actions;assert.ok(a?.length);return a;};
  h=createHarness();const {$,key,ref}=h;
  assert.equal(h.board.dataset.level,'1');assert.equal($('tutorial').hidden,false);assert.equal($('tutorial').open,true);assert.equal($('tutorial-title').textContent,'Niveau 1 · '+SS09_LEVELS[0].title);
  assert.ok($('campaign-subtitle').textContent.includes('Marchand + Barde'));assert.ok(h.board.getAttribute('aria-label').includes('2 : Barde'));assert.deepEqual([...h.window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),lessonIds);assert.ok(!$('song-help').textContent.includes('Magicien'));
  report.checks.push('The actual HTML opens level 1 with its twelve-discovery tutorial, Merchant/Bard role controls and accurate song/mirror help');
  let other=heroes(ref.observe().frame).find(p=>!p.selected),count=$('moves').textContent;await h.action({id:6,data:other.data});assert.equal($('moves').textContent,count);assert.equal(h.board.dataset.selected,'bard');
  other=heroes(ref.observe().frame).find(p=>!p.selected);assert.equal(key('Tab'),false);await h.settled(ref.action(6,other.data));assert.equal(h.board.dataset.selected,'merchant');assert.equal(key('Tab',{shiftKey:true}),true);
  other=heroes(ref.observe().frame).find(p=>!p.selected);key('2');await h.settled(ref.action(6,other.data));other=heroes(ref.observe().frame).find(p=>!p.selected);h.window.document.querySelector('[data-hero="merchant"]').click();await h.settled(ref.action(6,other.data));assert.equal($('moves').textContent,count);
  h.click({x:-1,y:10});h.click({x:64,y:10});h.equal(ref.observe());$('level').dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));h.equal(ref.observe());
  report.checks.push('Clicks, Tab, numbers and role buttons select without a turn; Shift+Tab exits and outside/selector input is ignored');
  await h.reset('restart');const tutorial=actionsFor(1),probe=new DuoPuzzleSession(SS09_LEVELS);let first=-1;
  for(let i=0;i<tutorial.length;i++){const a=normal(tutorial[i]);if(probe.action(a.id,a.data).frames.length>1){first=i;break;}}assert.ok(first>=0);
  for(const a of tutorial.slice(0,first))await h.action(a);
  const a=tutorial[first],normalized=normal(a);h.dispatch(a);const animated=ref.action(normalized.id,normalized.data);count=$('moves').textContent;key('ArrowRight');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);await h.settled(animated);
  await h.reset('undo');h.dispatch(a);ref.action(normalized.id,normalized.data);$('undo').click();const undone=ref.undo(),stopped=h.captures.length;await h.settled(undone);assert.equal(h.captures.length,stopped);
  h.dispatch(a);ref.action(normalized.id,normalized.data);await h.reset('reset');assert.equal($('moves').textContent,'0 actions');assert.ok(Object.values(h.learned()).every(v=>!v));
  for(const action of tutorial.slice(0,first))await h.action(action);h.dispatch(a);ref.action(normalized.id,normalized.data);await h.choose(8);await h.reset('restart');assert.equal($('tutorial').hidden,false);
  report.checks.push('Animation locks normal commands while Undo, Reset, Restart and room selection cancel old callbacks and restore exact public states');
  for(let level=1;level<=8;level++){
   await h.choose(level);const initial=ref.observe();assert.deepEqual(heroes(initial.frame).map(p=>p.color).sort((a,b)=>a-b),[6,12]);assert.equal(goalCount(initial.frame),2);assert.equal($('tutorial').hidden,level!==1);assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);assert.equal($('source-link').href,new URL(LEVEL_INFO[level-1].url).href);
   const platforms=!!SS09_LEVELS[level-1].platforms?.length;for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])assert.equal($(id).hidden,!platforms);
   if(process.env.SS09_UI_CAPTURE_DIR){mkdirSync(process.env.SS09_UI_CAPTURE_DIR,{recursive:true});writeFileSync(resolve(process.env.SS09_UI_CAPTURE_DIR,'ss09-level-'+level+'-initial.rgba'),h.pixels);}
  }
  report.checks.push('All eight rooms display the duo, two goals, level-specific sources and platform/press help; only level 1 has the tutorial');
  await h.reset('restart');let actions=0,frames=0,selections=0,reflectionKeyChecked=false;
  for(let level=1;level<=8;level++){
   assert.equal(ref.observe().level,level);
   for(const action of actionsFor(level)){
    const na=normal(action);
    if(!reflectionKeyChecked&&na.id===5){
     const before=ref.observe(),start=h.captures.length;assert.equal(key(' '),false);const expected=ref.action(5);await h.settled(expected);for(let i=0;i<expected.frames.length;i++)assert.deepEqual(h.captures[start+i],rgba(expected.frames[i]));await h.reset('undo');h.equal(before);
     h.window.document.querySelector('[data-action="5"]').click();const button=ref.action(5);await h.settled(button);assert.deepEqual(button.frames,expected.frames);await h.reset('undo');h.equal(before);reflectionKeyChecked=true;
    }
    const next=await h.action(action);actions++;frames+=next.frames.length;selections+=+(na.id===6);
   }
   assert.equal(ref.observe().levelsCompleted,level);
   if(level===1){for(const id of lessonIds)assert.equal(h.learned()[id],true,'Tutorial acquisition: '+id);report.tutorialCoverage={level:1,actions:actionsFor(1).length,discoveries:[...lessonIds]};}
  }
  assert.ok(reflectionKeyChecked);assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);assert.ok([...h.window.document.querySelectorAll('[data-action],[data-hero]')].every(e=>e.disabled));count=$('moves').textContent;key('ArrowDown');key('2');assert.equal($('moves').textContent,count);
  report.witnessCoverage={levels:8,actions,frames,selections,allPixelsAndDurationsCompared:true};report.checks.push('All eight campaign witnesses replay through the compiled HTML with exact frames and durations; all twelve tutorial lessons and Space/button/X equivalence pass');
  await h.reset('undo');assert.equal($('victory').hidden,true);assert.equal(ref.observe().levelsCompleted,7);await h.reset('restart');assert.equal(ref.observe().levelsCompleted,0);assert.equal(ref.observe().level,1);
  report.checks.push('WIN disables actions, Undo exits final victory and Restart restores the whole campaign at level 1');
  const path=resolve(root,'tests/failures.json');assert.ok(existsSync(path),'Reachable defeat witnesses required');const failures=JSON.parse(readFileSync(path,'utf8'));assert.ok(failures.length);report.defeatCoverage=[];
  for(const fatal of failures){
   await h.choose(fatal.level);for(const action of fatal.actions.slice(0,-1))await h.action(action);const before=ref.observe(),last=fatal.actions.at(-1),na=normal(last);h.dispatch(last);let dead=ref.action(na.id,na.data);assert.equal(dead.state,'GAME_OVER');assert.equal($('defeat').hidden,true);assert.ok(dead.frames.length>1);await h.advance();assert.equal($('defeat').hidden,true);
   $('undo').click();const restored=ref.undo(),stop=h.captures.length;await h.settled(restored);h.equal(before);assert.equal(h.captures.length,stop);
   const start=h.captures.length;h.dispatch(last);dead=ref.action(na.id,na.data);for(let i=0;i<dead.frames.length;i++){if(i)await h.advance();assert.deepEqual(h.captures[start+i],rgba(dead.frames[i]));assert.equal($('defeat').hidden,i<dead.frames.length-1);}await h.settled(dead);
   count=$('moves').textContent;key('ArrowDown');key('Tab');assert.equal($('moves').textContent,count);$('undo-defeat').click();await h.settled(ref.undo());h.equal(before);h.dispatch(last);ref.action(na.id,na.data);await h.flush();$('reset-defeat').click();await h.settled(ref.reset());assert.equal($('defeat').hidden,true);
   report.defeatCoverage.push({level:fatal.level,cause:fatal.cause,actions:fatal.actions.length,frames:dead.frames.length,midAnimationUndo:true,overlayAfterLastFrame:true});
  }
  report.checks.push('Actual reachable defeats show all terminal frames before the panel, block controls and support mid-animation Undo and panel Undo/Reset');
 }
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{if(h)await h.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,fixturesOnly?'validation/fixtures-ui-report.json':tutorialOnly?'validation/tutorial-ui-report.json':'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
