/** Executes the actual standalone HTML. DOM/keyboard/canvas-buffer checks, not native-browser QA. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {DuoPuzzleSession,PALETTE} from '../dist/core.js';
import {SS08_LEVELS} from '../dist/levels.js';
import {LEVEL_INFO} from '../dist/level-info.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const tutorialOnly=process.argv.includes('--tutorial-only');
const TUTORIAL_LEVEL=4;
const inspectedLevels=tutorialOnly?[1,TUTORIAL_LEVEL]:Array.from({length:SS08_LEVELS.length},(_,i)=>i+1);
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const window=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
window.Option=function(text,value){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;};
const captures=[],timers=[],waits=[];let pixels=new Uint8ClampedArray(64*64*4),timerId=0;
window.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{pixels=new Uint8ClampedArray(image.data);captures.push(pixels);}});
window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:512,bottom:512,width:512,height:512,toJSON(){return this;}});
window.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.push({id,callback,delay,args});waits.push(delay);return id;};
window.clearTimeout=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
const advanceTimer=async()=>{await Promise.resolve();assert.ok(timers.length,'Expected an intermediate animation timer');const next=timers.shift();next.callback(...next.args);await Promise.resolve();};
const flush=async()=>{for(let i=0;i<300;i++){await Promise.resolve();if(!timers.length){await Promise.resolve();if(!timers.length)return;}const next=timers.shift();next.callback(...next.args);}throw new Error('Animation did not settle');};
const html=readFileSync(resolve(root,'dist/SS08-demo.html'),'utf8');
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
const heroes=frame=>{const all=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+x*3,py=2+y*3,c=frame[py+1][px+1],arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];if((c===12||c===15)&&arms.filter(v=>v===c).length>=3)all.push({color:c,selected:arms.includes(0),data:{x:px+1,y:py+1}});}return all;};
const goalCount=frame=>{let count=0;for(let y=0;y<20;y++)for(let x=0;x<20;x++){const px=2+x*3,py=2+y*3;if([frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]].every(c=>c===11))count++;}return count;};
const checkPartyUI=()=>{
  assert.equal($('hero-switch').hidden,false);
  for(const role of ['merchant','wizard'])assert.equal(window.document.querySelector(`[data-hero="${role}"]`).hidden,false);
  for(const node of window.document.querySelectorAll('[data-duo-only]'))assert.equal(node.hidden,false);
  assert.equal($('goal-label').textContent,'Destination · deux à occuper');
  assert.ok($('goal-rule').textContent.includes('Les deux contours'));
  assert.ok($('defeat-message').textContent.includes('Les deux héros'));
  assert.ok($('roles-help').textContent.includes('Changer de personnage'));
  assert.ok($('board').getAttribute('aria-label').includes('1 : Marchand'));
  assert.ok($('board').getAttribute('aria-label').includes('2 : Magicien'));
  assert.ok($('campaign-subtitle').textContent.includes('Marchand + Magicien'));
};
const report={success:false,scope:tutorialOnly?'tutorial-only':'full-campaign',environment:'Happy DOM, canvas pixel buffer and controlled animation timer queue',visualBrowserTest:false,checks:[]};
let witnessMode=false,witnessActions=0,witnessFrames=0,selectionActions=0;
const visiblePlatformStates=new Map();
const inspectPlatforms=(level,frame)=>{
  const spec=SS08_LEVELS[level-1],ox=Math.floor((20-spec.rows[0].length)/2),oy=Math.floor((20-spec.rows.length)/2);
  for(const platform of spec.platforms??[]){
    const px=2+(platform.at.x+ox)*3,py=2+(platform.at.y+oy)*3;
    const corners=[frame[py][px],frame[py][px+2],frame[py+2][px],frame[py+2][px+2]];
    const arms=[frame[py][px+1],frame[py+1][px],frame[py+1][px+2],frame[py+2][px+1]];
    if(!corners.every(c=>c===7))continue; // An actor or reflection preview may cover the platform.
    const state=arms.every(c=>c===7)?'active':arms.every(c=>c===9)?'inactive':null;
    if(!state)continue;
    const key=`${level}:${platform.circuit}:${platform.at.x},${platform.at.y}`;
    if(!visiblePlatformStates.has(key))visiblePlatformStates.set(key,new Set());
    visiblePlatformStates.get(key).add(state);
  }
};
const replay=async actions=>{for(const a of actions){const start=captures.length,waitStart=waits.length;dispatch(a);const next=doRef(a);if(next.frames.length>1&&next.state!=='NOT_FINISHED'){assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);}await settled(next);for(let i=0;i<next.frames.length;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),`Engine frame ${i+1}/${next.frames.length}`);assert.deepEqual(waits.slice(waitStart),(next.frameDurationsMs??next.frames.map(()=>70)).slice(0,-1));if(witnessMode){inspectPlatforms(next.level,next.frame);witnessActions++;witnessFrames+=next.frames.length;if(normal(a).id===6)selectionActions++;}}};
const choose=level=>{$('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));equalFrame(ref.selectLevel(level));};
const witnesses=JSON.parse(readFileSync(resolve(root,'tests/witnesses.json'),'utf8'));
const actionsFor=level=>{const actions=witnesses.find(w=>w.level===level)?.actions;assert.ok(actions?.length,`Missing witness ${level}`);return actions;};
const lessonIds=['select','wizard-swap','move','merchant-push','platform','gate','mirror-motion','wizard-bend','mirror','goals'];
/** Keep the compiled engine/UI intact; replace only the session's first room in memory. */
const checkReflectionFixtures=async()=>{
  const entry='const session = new DuoPuzzleSession(SS08_LEVELS);';
  assert.equal(scripts[0].split(entry).length,2,'Exactly one compiled session entry is required for UI fixture data');
  const cases=[
    {name:'near hero with farther blocked landing',blockedFar:true,crate:false,tie:false},
    {name:'near crate with farther valid landing',blockedFar:false,crate:true,tie:false},
    {name:'equal-distance heroes exchange',blockedFar:false,crate:false,tie:true},
  ];
  const result=[];
  for(const fixture of cases){
    const cells=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));
    cells[2][4]=fixture.crate?'o':'M';cells[4][fixture.tie?6:7]='W';cells[4][4]='1';
    if(fixture.crate)cells[6][1]='M';if(fixture.blockedFar)cells[1][4]='#';cells[7][1]='g';cells[7][2]='g';
    const spec={id:'ss08-reflection-ui',title:fixture.name,rows:cells.map(row=>row.join(''))};
    const ui=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}}),pending=[],delays=[];
    let buffer=new Uint8ClampedArray(64*64*4),id=0;
    ui.Option=function(text,value){const option=ui.document.createElement('option');option.textContent=text;option.value=value;return option;};
    ui.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{buffer=new Uint8ClampedArray(image.data);}});
    ui.setTimeout=(callback,delay=0,...args)=>{const token=++id;pending.push({token,callback,args});delays.push(delay);return token;};
    ui.clearTimeout=token=>{const i=pending.findIndex(t=>t.token===token);if(i>=0)pending.splice(i,1);};
    const drain=async()=>{for(let i=0;i<100;i++){await Promise.resolve();if(!pending.length){await Promise.resolve();if(!pending.length)return;}const next=pending.shift();next.callback(...next.args);}throw new Error('Fixture animation did not settle');};
    const colors=new Map(PALETTE.map((hex,i)=>[parseInt(hex.slice(1),16),i]));
    const frame=()=>Array.from({length:64},(_,y)=>Array.from({length:64},(_,x)=>{const p=(y*64+x)*4;return colors.get((buffer[p]<<16)|(buffer[p+1]<<8)|buffer[p+2]);}));
    const tile=(x,y)=>{const f=frame(),px=2+(x+5)*3,py=2+(y+5)*3;return f.slice(py,py+3).map(row=>row.slice(px,px+3));};
    const heroCells=()=>heroes(frame()).map(h=>({color:h.color,x:(h.data.x-3)/3-5,y:(h.data.y-3)/3-5})).sort((a,b)=>a.color-b.color);
    try{
      ui.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
      ui.eval(scripts[0].replace(entry,`const session = new DuoPuzzleSession([${JSON.stringify(spec)}, ...SS08_LEVELS.slice(1)]);`));
      const before=new Uint8ClampedArray(buffer),board=ui.document.getElementById('board');
      if(!fixture.tie){
        assert.deepEqual(tile(6,4),fixture.crate?[[1,1,1],[1,3,1],[1,1,1]]:[[3,1,3],[1,1,1],[3,1,3]],`${fixture.name}: only the near actor has the correct preview`);
        const farColor=fixture.blockedFar?4:3;
        assert.deepEqual(tile(4,1),Array.from({length:3},()=>[farColor,farColor,farColor]),`${fixture.name}: no farther preview`);
      }
      const event=new ui.KeyboardEvent('keydown',{key:' ',bubbles:true,cancelable:true});
      assert.equal(board.dispatchEvent(event),false);assert.equal(board.dataset.busy,'true');
      await drain();assert.equal(board.dataset.busy,'false');assert.equal(board.dataset.state,'NOT_FINISHED');
      assert.deepEqual(delays,[70,90],`${fixture.name}: all three teleport frames are timed`);
      assert.deepEqual(heroCells(),fixture.tie?[{color:12,x:6,y:4},{color:15,x:4,y:2}]:fixture.crate?[{color:12,x:1,y:6},{color:15,x:7,y:4}]:[{color:12,x:6,y:4},{color:15,x:7,y:4}],`${fixture.name}: public hero positions`);
      if(fixture.crate)assert.deepEqual(tile(6,4),[[13,13,13],[13,5,13],[13,13,13]],'The nearer crate reaches its outlined destination');
      assert.ok(ui.document.getElementById('feedback').textContent.includes('priorité au plus proche'));
      ui.document.getElementById('undo').click();await drain();assert.deepEqual(buffer,before,`${fixture.name}: exact visual Undo`);
      result.push({case:fixture.name,previewVerified:!fixture.tie,publicPositionsVerified:true,teleportFrames:3,exactVisualUndo:true});
    }finally{await ui.happyDOM.close();}
  }
  return result;
};
/** Exercise directional swaps through the compiled event handlers, not a mock renderer. */
const checkWizardFixtures=async()=>{
  const entry='const session = new DuoPuzzleSession(SS08_LEVELS);',result=[];
  const cases=[
    {name:'first aligned crate',wizard:[2,4],merchant:[1,6],stone:[6,4],action:4,to:[6,4],swap:true,bent:false},
    {name:'white face bends the ray',wizard:[4,2],merchant:[1,6],stone:[6,4],mirror:[4,4],action:2,to:[6,4],swap:true,bent:true},
    {name:'companion is the first target',wizard:[2,4],merchant:[6,4],action:4,to:[6,4],swap:true,bent:false},
    {name:'no target walks one cell',wizard:[2,4],merchant:[1,6],action:4,to:[3,4],swap:false,bent:false},
    {name:'black back blocks targeting',wizard:[2,4],merchant:[1,6],stone:[4,2],mirror:[4,4],action:4,to:[3,4],swap:false,bent:false},
    {name:'water refusal is immediate and teaches no movement or support',wizard:[2,4],merchant:[1,6],water:[3,4],action:4,to:[2,4],swap:false,bent:false,blocked:true},
    {name:'three-mirror loop returns without teaching a move or swap',wizard:[3,3],merchant:[1,6],mirrors:[[7,3,'3'],[7,7,'4'],[3,7,'1']],action:4,to:[3,3],swap:false,bent:false,loop:true},
  ];
  for(const fixture of cases){
    const cells=Array.from({length:9},(_,y)=>Array.from({length:9},(_,x)=>x===0||y===0||x===8||y===8?'#':'.'));
    cells[fixture.wizard[1]][fixture.wizard[0]]='W';cells[fixture.merchant[1]][fixture.merchant[0]]='M';
    if(fixture.stone)cells[fixture.stone[1]][fixture.stone[0]]='o';
    if(fixture.mirror)cells[fixture.mirror[1]][fixture.mirror[0]]='1';
    if(fixture.water)cells[fixture.water[1]][fixture.water[0]]='~';
    if(fixture.mirrors)for(const [x,y,facing] of fixture.mirrors)cells[y][x]=facing;
    cells[7][1]='g';cells[7][2]='g';
    const spec={id:'ss08-wizard-ui',title:fixture.name,rows:cells.map(row=>row.join(''))};
    const ui=new Window({settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}}),pending=[],delays=[],painted=[];
    let buffer=new Uint8ClampedArray(64*64*4),id=0;
    ui.Option=function(text,value){const option=ui.document.createElement('option');option.textContent=text;option.value=value;return option;};
    ui.HTMLCanvasElement.prototype.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),putImageData:image=>{buffer=new Uint8ClampedArray(image.data);painted.push(buffer);}});
    ui.setTimeout=(callback,delay=0,...args)=>{const token=++id;pending.push({token,callback,args});delays.push(delay);return token;};
    ui.clearTimeout=token=>{const i=pending.findIndex(t=>t.token===token);if(i>=0)pending.splice(i,1);};
    const drain=async()=>{for(let i=0;i<100;i++){await Promise.resolve();if(!pending.length){await Promise.resolve();if(!pending.length)return;}const next=pending.shift();next.callback(...next.args);}throw new Error('Wizard fixture animation did not settle');};
    const fixtureRef=new DuoPuzzleSession([...SS08_LEVELS.slice(0,TUTORIAL_LEVEL-1),spec,...SS08_LEVELS.slice(TUTORIAL_LEVEL)]);fixtureRef.selectLevel(TUTORIAL_LEVEL);
    try{
      ui.document.write(html.replace(/<script>[\s\S]*?<\/script>/g,''));
      ui.eval(scripts[0].replace(entry,'const session = new DuoPuzzleSession([...SS08_LEVELS.slice(0,'+(TUTORIAL_LEVEL-1)+'),'+JSON.stringify(spec)+',...SS08_LEVELS.slice('+TUTORIAL_LEVEL+')]); session.selectLevel('+TUTORIAL_LEVEL+');'));
      assert.deepEqual(buffer,rgba(fixtureRef.observe().frame));
      ui.document.querySelector('[data-hero="wizard"]').click();
      fixtureRef.action(6,{x:3+(fixture.wizard[0]+5)*3,y:3+(fixture.wizard[1]+5)*3});
      assert.deepEqual(buffer,rgba(fixtureRef.observe().frame));
      const before=new Uint8ClampedArray(buffer),start=painted.length,board=ui.document.getElementById('board');
      const event=new ui.KeyboardEvent('keydown',{key:actionKeys[fixture.action],bubbles:true,cancelable:true});
      assert.equal(board.dispatchEvent(event),false);assert.equal(board.dataset.busy,fixture.blocked?'false':'true');
      const expected=fixtureRef.action(fixture.action);await drain();
      assert.equal(expected.frames.length,fixture.loop?8:fixture.blocked?1:3);assert.equal(board.dataset.busy,'false');
      for(let i=0;i<expected.frames.length;i++)assert.deepEqual(painted[start+i],rgba(expected.frames[i]),`${fixture.name} frame ${i}`);
      assert.deepEqual(buffer,rgba(expected.frame));assert.deepEqual(delays,expected.frameDurationsMs.slice(0,-1));
      const violet=heroes(expected.frame).find(h=>h.color===15);
      assert.deepEqual(violet.data,{x:3+(fixture.to[0]+5)*3,y:3+(fixture.to[1]+5)*3});
      assert.equal(ui.document.querySelector('[data-lesson="wizard-swap"]').classList.contains('done'),fixture.swap);
      assert.equal(ui.document.querySelector('[data-lesson="wizard-bend"]').classList.contains('done'),fixture.bent);
      if(fixture.blocked){assert.equal(ui.document.querySelector('[data-lesson="move"]').classList.contains('done'),false);assert.equal(ui.document.querySelector('[data-lesson="platform"]').classList.contains('done'),false);assert.ok(!ui.document.getElementById('feedback').textContent.includes('Eau sans appui'));assert.equal(delays.length,0);}
      if(fixture.loop){assert.equal(ui.document.getElementById('feedback').textContent,'Le rayon revient sur le Magicien : la téléportation le laisse sur place.');for(const lesson of lessonIds.filter(id=>id!=='select'))assert.equal(ui.document.querySelector('[data-lesson="'+lesson+'"]').classList.contains('done'),false,'A visible loop grants no false discovery');}
      if(fixture.swap)assert.ok(ui.document.getElementById('feedback').textContent.includes(fixture.bent?'rayon dévié':'Transposition'));
      ui.document.getElementById('undo').click();await drain();assert.deepEqual(buffer,before,`${fixture.name}: exact visual Undo`);
      result.push({case:fixture.name,exactFrames:expected.frames.length,publicLessonDetection:true,exactVisualUndo:true});
    }finally{await ui.happyDOM.close();}
  }
  return result;
};

const pixelFrame=()=>{
 const colors=new Map(PALETTE.map((hex,i)=>[parseInt(hex.slice(1),16),i]));
 return Array.from({length:64},(_,y)=>Array.from({length:64},(_,x)=>{const at=(y*64+x)*4;return colors.get((pixels[at]<<16)|(pixels[at+1]<<8)|pixels[at+2]);}));
};
const checkActualMirrorButtons=async()=>{
 const level=5,spec=SS08_LEVELS[level-1],design=JSON.parse(readFileSync(resolve(root,'reference/level5-design.json'),'utf8'));
 const ox=Math.floor((20-spec.rows[0].length)/2),oy=Math.floor((20-spec.rows.length)/2);
 const buttons=(spec.circuits??[]).flatMap(c=>c.buttons.map(p=>({x:p.x+ox,y:p.y+oy})));
 const checkpoints=design.stages.filter(s=>s.mirrors.some(m=>buttons.some(b=>b.x===m.at.x&&b.y===m.at.y)));
 assert.ok(checkpoints.length>=2,'The real L5 witness places both working mirrors on buttons');
 choose(level);let cursor=0;const result=[];
 for(const stage of checkpoints){
  await replay(actionsFor(level).slice(cursor,stage.turn));cursor=stage.turn;
  const frame=pixelFrame();
  for(const mirror of stage.mirrors.filter(m=>buttons.some(b=>b.x===m.at.x&&b.y===m.at.y))){
   const px=2+mirror.at.x*3,py=2+mirror.at.y*3,f=mirror.facing;
   for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const diagonal=f==='NW'||f==='SE'?x+y===2:x===y;
    const back=f==='NE'?y>x:f==='SW'?x>y:f==='NW'?x+y>2:x+y<2;
    if(diagonal)assert.equal(frame[py+y][px+x],0,'L5 mirror white diagonal survives button and preview overlays');
    else if(back)assert.equal(frame[py+y][px+x],5,'L5 mirror black back survives button and preview overlays');
   }
   result.push({turn:stage.turn,at:mirror.at,facing:f,whiteDiagonal:true,blackBack:true});
  }
  if(process.env.SS08_UI_CAPTURE_DIR)writeFileSync(resolve(process.env.SS08_UI_CAPTURE_DIR,'ss08-level5-mirror-button.rgba'),pixels);
 }
 return result;
};
const checkActualWaterRefusal=async()=>{
 const prefix='LLLLUUUUDDDDCUUURRR',witness=witnesses.find(w=>w.level===8);
 assert.ok(witness.commands.startsWith(prefix),'The invalid water step belongs to the real L8 route');
 choose(8);await replay(witness.actions.slice(0,prefix.length));
 const before=ref.observe(),positions=heroes(before.frame).map(h=>({color:h.color,data:h.data}));
 const lessons=[...window.document.querySelectorAll('[data-lesson]')].map(e=>e.classList.contains('done'));
 const tile=frame=>frame.slice(14,17).map(row=>row.slice(23,26));
 const perform=async()=>{
  const start=captures.length,waitStart=waits.length;assert.equal(key('ArrowUp'),false);
  const next=ref.action(1);assert.equal($('board').dataset.busy,'false');await settled(next);
  assert.equal(next.frames.length,1);assert.deepEqual(next.frames[0],next.frame);
  if(next.frameDurationsMs)assert.deepEqual(next.frameDurationsMs,[0]);
  assert.deepEqual(captures[start],rgba(next.frame));assert.deepEqual(waits.slice(waitStart),[]);assert.equal(timers.length,0);
  assert.deepEqual(tile(next.frame),tile(before.frame),'Water cell remains unmarked');
  assert.deepEqual(heroes(next.frame).map(h=>({color:h.color,data:h.data})),positions,'Refused water step moves neither hero');
  assert.equal(next.state,'NOT_FINISHED');assert.ok(!$('feedback').textContent.includes('Eau sans appui'));
  assert.ok($('feedback').textContent.includes('Aucun échange possible'));
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.classList.contains('done')),lessons,'Refusal grants no discovery');
  return next;
 };
 const first=await perform(),again=await perform();assert.deepEqual(again.frame,first.frame,'Repeated refusal remains a clean immediate frame');
 $('undo').click();await settled(ref.undo());equalFrame(before);
 return {level:8,prefixActions:prefix.length,targetCell:{x:7,y:4},frames:1,immediate:true,noAnimationTimers:true,noWaterMarks:true,repeatedRefusalUnchanged:true,exactUndo:true,noHeroMotion:true,noDiscovery:true};
};

const checkActualReturningLoops=async()=>{
 const origins={x:4,y:8},mirrors=SS08_LEVELS[7].mirrors,result=[];
 const cases=[
  {direction:'N',id:1,key:'ArrowUp',corners:[[4,4],[13,4],[13,12],[4,12]],probes:[[4,6],[8,4],[13,8],[8,12],[4,10]]},
  {direction:'S',id:2,key:'ArrowDown',corners:[[4,12],[13,12],[13,4],[4,4]],probes:[[4,10],[8,12],[13,8],[8,4],[4,6]]}
 ];
 const expectedDurations=[90,90,90,90,100,100,80,100,0];
 for(const branch of cases){
  choose(8);
  const wizard=heroes(ref.observe().frame).find(h=>h.color===15);
  window.document.querySelector('[data-hero="wizard"]').click();equalFrame(ref.action(6,wizard.data));
  const before=ref.observe(),positions=heroes(before.frame).map(h=>({color:h.color,data:h.data}));
  const lessons=[...window.document.querySelectorAll('[data-lesson]')].map(e=>e.classList.contains('done'));
  const perform=async()=>{
   const start=captures.length,waitStart=waits.length;assert.equal(key(branch.key),false);
   const next=ref.action(branch.id);assert.equal($('board').dataset.busy,'true');await settled(next);
   assert.equal(next.frames.length,9);assert.deepEqual(next.frameDurationsMs,expectedDurations);
   for(let i=0;i<9;i++)assert.deepEqual(captures[start+i],rgba(next.frames[i]),'Returning loop public frame '+i);
   assert.deepEqual(waits.slice(waitStart),expectedDurations.slice(0,-1));
   for(let i=0;i<5;i++){
    for(let j=0;j<5;j++){
     const [x,y]=branch.probes[j],px=3+3*x,py=3+3*y;
     assert.equal(next.frames[i][py][px],j<=i?15:next.frame[py][px],'Loop segments become visible in traversal order');
    }
    for(const mirror of mirrors){
     const px=2+3*mirror.at.x,py=2+3*mirror.at.y,f=mirror.facing;
     for(let y=0;y<3;y++)for(let x=0;x<3;x++){
      const diagonal=f==='NW'||f==='SE'?x+y===2:x===y;
      const back=f==='NE'?y>x:f==='SW'?x>y:f==='NW'?x+y>2:x+y<2;
      if(diagonal)assert.equal(next.frames[i][py+y][px+x],0,'Progressive ray preserves mirror diagonal');
      else if(back)assert.equal(next.frames[i][py+y][px+x],5,'Progressive ray preserves mirror black back');
      else if(i<4&&mirror.at.x===branch.corners[i][0]&&mirror.at.y===branch.corners[i][1])assert.equal(next.frames[i][py+y][px+x],10,'The current mirror front is highlighted');
     }
    }
   }
   const px=2+3*origins.x,py=2+3*origins.y;
   for(const i of [5,7]){
    for(const [x,y] of [[1,0],[0,1],[1,1],[2,1],[1,2]])assert.equal(next.frames[i][py+y][px+x],0,'The Wizard flashes white at the same origin');
    for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(!(x>=px&&x<px+3&&y>=py&&y<py+3))assert.equal(next.frames[i][y][x],next.frame[y][x],'Only the Wizard cell changes during its blink');
   }
   assert.deepEqual(next.frames[6],next.frame);assert.deepEqual(next.frames[8],next.frame);
   assert.deepEqual(heroes(next.frame).map(h=>({color:h.color,data:h.data})),positions);
   assert.equal(next.state,'NOT_FINISHED');assert.equal(next.levelsCompleted,before.levelsCompleted);
   assert.equal($('feedback').textContent,'Le rayon revient sur le Magicien : la téléportation le laisse sur place.');
   assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.classList.contains('done')),lessons,'Loop animation grants no discovery');
   return next;
  };
  const first=await perform(),repeat=await perform();assert.deepEqual(repeat.frames,first.frames,'Repeated closed ray replays the full animation');
  $('undo').click();await settled(ref.undo());equalFrame(before);
  key(branch.key);ref.action(branch.id);await advanceTimer();await advanceTimer();
  $('undo').click();const canceled=captures.length;await settled(ref.undo());assert.equal(captures.length,canceled,'Undo cancels pending ray/blink frames');equalFrame(before);
  result.push({level:8,direction:branch.direction,origin:origins,mirrorOrder:branch.corners,progressiveSegments:5,frames:9,frameDurationsMs:expectedDurations,whiteBlinksAtOrigin:2,unchangedActors:true,repeatedAnimation:true,exactUndo:true,midAnimationUndo:true,noFalseDiscovery:true});
 }
 return result;
};

try{
  assert.ok(SS08_LEVELS.length>=TUTORIAL_LEVEL,'The rich tutorial is now level 4');
  if(!tutorialOnly)assert.equal(SS08_LEVELS.length,8,'The SS08 release contains eight rooms');
  ref=new DuoPuzzleSession(SS08_LEVELS);
  assert.equal(scripts.length,1);window.eval(scripts[0]);equalFrame(ref.observe());
  assert.equal($('board').dataset.level,'1');assert.equal($('tutorial').open,true);assert.equal($('tutorial').hidden,true);assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);
  assert.equal($('tutorial-title').textContent,'Niveau 4 · '+SS08_LEVELS[3].title);
  assert.ok(window.document.title.startsWith('SS08'));assert.deepEqual(heroes(ref.observe().frame).map(h=>h.color).sort((a,b)=>a-b),[12,15]);
  assert.equal($('restart').textContent,'Repartir du niveau 1');assert.equal($('play-again').textContent,'Repartir du niveau 1');
  checkPartyUI();assert.equal(goalCount(ref.observe().frame),2);
  if(process.env.SS08_UI_CAPTURE_DIR){mkdirSync(process.env.SS08_UI_CAPTURE_DIR,{recursive:true});writeFileSync(resolve(process.env.SS08_UI_CAPTURE_DIR,'ss08-ui-initial.rgba'),pixels);}
  report.checks.push('The compiled HTML starts on the new level 1; the rich ten-discovery tutorial follows its room to level 4 and Restart explicitly returns to level 1');

  assert.deepEqual([...window.document.querySelectorAll('[data-action]')].map(b=>Number(b.dataset.action)).sort(),[1,2,3,4,5]);
  assert.deepEqual([...window.document.querySelectorAll('[data-lesson]')].map(e=>e.dataset.lesson),lessonIds);
  assert.ok($('mirror-help').textContent.includes('+ gris clair'));assert.ok($('mirror-help').textContent.includes('contour carré gris clair'));
  assert.ok($('mirror-help').textContent.includes('seul le plus proche du miroir traverse'));assert.ok($('mirror-help').textContent.includes('À la même distance, les deux échangent leurs places'));
  assert.ok($('monster-help').textContent.includes('s’éliminent mutuellement'));assert.ok($('piston-help').textContent.includes('ils doivent être occupés ensemble'));
  assert.ok(window.document.body.textContent.includes('Appui dans l’eau · fixe'));
  assert.ok($('swap-help').textContent.includes('La première cible compte'));assert.ok($('swap-help').textContent.includes('Les flèches transposent ; Espace active les reflets'));assert.ok($('swap-help').textContent.includes('aucune prévisualisation permanente'));
  assert.ok(!$('swap-help').textContent.includes('un X cyan puis rouge'));assert.ok($('swap-help').textContent.includes('Une boucle illumine tout le trajet'));
  report.checks.push('Controls and global help distinguish directional swaps, mirror reflections, support, circuits and monster combat');

  report.wizardCoverage=await checkWizardFixtures();
  report.checks.push('Seven compiled-HTML Wizard fixtures cover exchanges, walking, obstruction, immediate water refusal and an eight-frame returning loop without false discoveries');
  report.reflectionPriorityCoverage=await checkReflectionFixtures();
  report.checks.push('Three compiled-HTML reflection fixtures preserve nearest-source previews, blocked-farther independence, equal-distance exchange and exact visual Undo');

  let other=heroes(ref.observe().frame).find(h=>!h.selected),count=$('moves').textContent;
  clickPixel(other.data);equalFrame(ref.action(6,other.data));assert.equal($('moves').textContent,count);assert.equal($('board').dataset.selected,'wizard');assert.equal(timers.length,0);
  other=heroes(ref.observe().frame).find(h=>!h.selected);assert.equal(key('Tab'),false);equalFrame(ref.action(6,other.data));assert.equal($('board').dataset.selected,'merchant');
  assert.equal(key('Tab',{shiftKey:true}),true,'Shift+Tab remains an accessible exit from the canvas');
  other=heroes(ref.observe().frame).find(h=>!h.selected);key('2');equalFrame(ref.action(6,other.data));
  other=heroes(ref.observe().frame).find(h=>!h.selected);window.document.querySelector('[data-hero="merchant"]').click();equalFrame(ref.action(6,other.data));
  assert.equal($('moves').textContent,count);
  report.checks.push('Canvas clicks, Tab, number keys and role buttons select through ACTION6 without a game tick or movement-counter increment; Shift+Tab exits');

  const unchanged=ref.observe();clickPixel({x:64,y:12});clickPixel({x:-1,y:12});equalFrame(unchanged);
  $('level').dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));equalFrame(unchanged);
  report.checks.push('Out-of-canvas clicks are ignored and keys in the level selector do not dispatch game actions');
  $('restart').click();await settled(ref.restart());choose(TUTORIAL_LEVEL);
  const tutorial=actionsFor(TUTORIAL_LEVEL),probe=new DuoPuzzleSession(SS08_LEVELS);probe.selectLevel(TUTORIAL_LEVEL);let firstAnimation=-1;
  for(let i=0;i<tutorial.length;i++){const a=normal(tutorial[i]),next=probe.action(a.id,a.data);if(next.level===TUTORIAL_LEVEL&&next.frames.length>1){firstAnimation=i;break;}}
  assert.ok(firstAnimation>=0);await replay(tutorial.slice(0,firstAnimation));
  const firstAction=tutorial[firstAnimation];dispatch(firstAction);const first=doRef(firstAction);assert.equal($('board').dataset.busy,'true');
  count=$('moves').textContent;key('ArrowRight');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);await settled(first);
  report.checks.push('All movement frames and durations display; directions, reflection and selection are blocked during animation while Space prevents scrolling');

  $('undo').click();equalFrame(ref.undo());dispatch(firstAction);doRef(firstAction);assert.equal($('board').dataset.busy,'true');
  $('undo').click();const undone=ref.undo(),canceled=captures.length;await settled(undone);assert.equal(captures.length,canceled,'Canceled frames cannot repaint');
  report.checks.push('Undo during an animation restores both heroes and cancels stale callbacks');

  dispatch(firstAction);doRef(firstAction);$('reset').click();await settled(ref.reset());assert.equal($('moves').textContent,'0 actions');assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')));
  await replay(tutorial.slice(0,firstAnimation));dispatch(firstAction);doRef(firstAction);choose(SS08_LEVELS.length);await settled(ref.observe());
  $('restart').click();await settled(ref.restart());assert.equal($('tutorial').hidden,true);
  report.checks.push('Reset, level changes and return to level 1 cancel pending animation callbacks and reset counters');

  for(const level of inspectedLevels){choose(level);assert.equal($('piston-help').hidden,!LEVEL_INFO[level-1].piston);const hasPlatforms=!!SS08_LEVELS[level-1].platforms?.length;for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])assert.equal($(id).hidden,!hasPlatforms);assert.equal($('tutorial').hidden,level!==TUTORIAL_LEVEL);assert.equal($('source-link').hidden,!LEVEL_INFO[level-1].url);if(LEVEL_INFO[level-1].url)assert.equal($('source-link').href,LEVEL_INFO[level-1].url);}
  report.checks.push(inspectedLevels.length+' inspected rooms display their source attribution and relevant help; rich tutorial appears only in level 4');

  for(const level of inspectedLevels){
    choose(level);checkPartyUI();assert.deepEqual(heroes(ref.observe().frame).map(h=>h.color).sort((a,b)=>a-b),[12,15]);assert.equal(goalCount(ref.observe().frame),2);
    if(process.env.SS08_UI_CAPTURE_DIR){
     writeFileSync(resolve(process.env.SS08_UI_CAPTURE_DIR,'ss08-level-'+level+'-initial.rgba'),pixels);
     if(level===TUTORIAL_LEVEL)writeFileSync(resolve(process.env.SS08_UI_CAPTURE_DIR,'ss08-tutorial-initial.rgba'),pixels);
    }
    const initial=ref.observe(),countBefore=captures.length,movesBefore=$('moves').textContent;
    const selected=heroes(initial.frame).find(h=>h.selected);clickPixel(selected.data);key(selected.color===12?'1':'2');
    equalFrame(initial);assert.equal(captures.length,countBefore);assert.equal($('moves').textContent,movesBefore);assert.equal(timers.length,0);assert.equal($('undo').disabled,true);
    inspectPlatforms(level,initial.frame);
  }
  report.checks.push('Every inspected room retains the orange/violet duo and two goals; reselecting the active hero creates no action or Undo entry');

  if(!tutorialOnly){
   report.mirrorButtonCoverage=await checkActualMirrorButtons();
   report.checks.push('The real L5 witness keeps each mirror’s white diagonal and black back visible while it holds a button');
   report.returningLoopCoverage=await checkActualReturningLoops();
   report.checks.push('Initial L8 Up and Down visibly traverse all four mirrors in opposite orders, return to the fixed Wizard, blink twice, replay and allow mid-animation Undo without false discoveries');
   report.waterRefusalCoverage=await checkActualWaterRefusal();
   report.checks.push('The real L8 invalid water step returns one clean immediate frame, starts no timer, adds no mark, repeats unchanged, moves no hero and supports exact Undo');
  }
  $('restart').click();await settled(ref.restart());choose(TUTORIAL_LEVEL);
  const reflectionIndex=tutorial.findIndex(a=>normal(a).id===5);assert.ok(reflectionIndex>=0);await replay(tutorial.slice(0,reflectionIndex));
  const beforeReflection=ref.observe(),start=captures.length,waitStart=waits.length;assert.equal(key(' '),false);const reflected=ref.action(5);assert.ok(reflected.frames.length>=3);await settled(reflected);
  for(let i=0;i<reflected.frames.length;i++)assert.deepEqual(captures[start+i],rgba(reflected.frames[i]));assert.deepEqual(waits.slice(waitStart),reflected.frameDurationsMs.slice(0,-1));
  $('undo').click();await settled(ref.undo());equalFrame(beforeReflection);
  window.document.querySelector('[data-action="5"]').click();const button=ref.action(5);await settled(button);assert.deepEqual(button.frames,reflected.frames);
  $('undo').click();await settled(ref.undo());key('x');const xReflection=ref.action(5);await settled(xReflection);assert.deepEqual(xReflection.frames,reflected.frames);
  report.checks.push('Space, X and the Reflet button perform the same real reflection and preserve every teleport frame');

  $('restart').click();await settled(ref.restart());choose(TUTORIAL_LEVEL);witnessMode=true;await replay(tutorial);witnessMode=false;
  assert.equal(ref.observe().levelsCompleted,1);assert.equal(ref.observe().level,1,'After manual tutorial completion, the first unfinished room is level 1');
  for(const id of lessonIds)assert.ok(window.document.querySelector('[data-lesson="'+id+'"]').classList.contains('done'),id+' learned through public pixels and input');
  report.checks.push('The rich tutorial in level 4 earns all ten discoveries through its unchanged real witness');
  report.tutorialCoverage={level:TUTORIAL_LEVEL,actions:tutorial.length,frames:witnessFrames,selectionActions,discoveries:[...lessonIds]};
  witnessActions=0;witnessFrames=0;selectionActions=0;
  if(!tutorialOnly){
   $('restart').click();await settled(ref.restart());witnessMode=true;
   for(let level=1;level<=SS08_LEVELS.length;level++){
    assert.equal(ref.observe().level,level);const completed=ref.observe().levelsCompleted;await replay(actionsFor(level));assert.equal(ref.observe().levelsCompleted,completed+1);
    if(level<TUTORIAL_LEVEL)assert.ok([...window.document.querySelectorAll('[data-lesson]')].every(e=>!e.classList.contains('done')),'Earlier rooms do not complete level 4’s checklist');
    if(level===TUTORIAL_LEVEL)for(const id of lessonIds)assert.ok(window.document.querySelector('[data-lesson="'+id+'"]').classList.contains('done'));
   }
   witnessMode=false;
   const switchedPlatformCircuits=new Set([...visiblePlatformStates].filter(([,states])=>states.size===2).map(([key])=>key.split(':').slice(0,2).join(':')));
   const specifiedPlatformCount=SS08_LEVELS.reduce((n,spec)=>n+(spec.platforms?.length??0),0);
   report.platformCoverage={circuitsWithBothVisibleStates:[...switchedPlatformCircuits],visibleCells:visiblePlatformStates.size,specifiedPlatformCount};
   report.witnessCoverage={levels:SS08_LEVELS.length,actions:witnessActions,frames:witnessFrames,selectionActions,allFrameDurationsVerified:true};
   assert.equal(witnessActions,witnesses.reduce((n,w)=>n+w.actions.length,0));assert.equal(ref.observe().state,'WIN');assert.equal($('victory').hidden,false);
   checkPartyUI();assert.equal($('feedback').textContent,'Les deux destinations sont occupées. Salle terminée !');
   assert.ok([...window.document.querySelectorAll('[data-action],[data-hero]')].every(b=>b.disabled));
   count=$('moves').textContent;key('ArrowDown');key('Tab');key('1');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);
   report.checks.push('All eight witnesses replay in the new order with exact frames/timing; final victory disables further controls');

   $('undo').click();await settled(ref.undo());assert.equal($('victory').hidden,true);assert.equal(ref.observe().levelsCompleted,SS08_LEVELS.length-1);
   $('restart').click();await settled(ref.restart());assert.equal(ref.observe().level,1);assert.equal(ref.observe().levelsCompleted,0);assert.equal($('tutorial').hidden,true);
   checkPartyUI();
   report.checks.push('Undo exits final victory; Restart returns to the new level 1 with zero completions and the rich tutorial reserved for level 4');

   const failurePath=resolve(root,'tests/failures.json');
   assert.ok(existsSync(failurePath),'A real reachable defeat route is required');
   const failures=JSON.parse(readFileSync(failurePath,'utf8'));assert.ok(Array.isArray(failures)&&failures.length>0);report.defeatCoverage=[];
   for(const fatal of failures){
    choose(fatal.level);await replay(fatal.actions.slice(0,-1));const before=ref.observe(),last=fatal.actions.at(-1);
    dispatch(last);let failed=doRef(last);assert.equal(failed.state,'GAME_OVER');assert.ok(failed.frames.length>1);
    assert.equal($('defeat').hidden,true);const middle=Math.max(1,Math.floor((failed.frames.length-1)/2));
    for(let i=1;i<=middle;i++){await advanceTimer();assert.deepEqual(pixels,rgba(failed.frames[i]));assert.equal($('defeat').hidden,true);}
    $('undo').click();const restored=ref.undo();equalFrame(before);const stoppedAt=captures.length;await settled(restored);assert.equal(captures.length,stoppedAt);assert.equal($('defeat').hidden,true);
    const from=captures.length,waitFrom=waits.length;dispatch(last);failed=doRef(last);
    for(let i=0;i<failed.frames.length;i++){if(i)await advanceTimer();assert.deepEqual(captures[from+i],rgba(failed.frames[i]));assert.equal($('defeat').hidden,i<failed.frames.length-1);}
    await settled(failed);assert.deepEqual(waits.slice(waitFrom),failed.frameDurationsMs.slice(0,-1));
    checkPartyUI();assert.equal($('defeat-title').textContent,'Un personnage a été perdu');
    count=$('moves').textContent;key('ArrowLeft');key('Tab');key('2');assert.equal(key(' '),false);assert.equal($('moves').textContent,count);
    $('undo-defeat').click();await settled(ref.undo());equalFrame(before);dispatch(last);doRef(last);await flush();$('reset-defeat').click();await settled(ref.reset());assert.equal($('defeat').hidden,true);
    report.defeatCoverage.push({level:fatal.level,cause:fatal.cause,actions:fatal.actions.length,frames:failed.frames.length,frameDurationsMs:failed.frameDurationsMs,midAnimationUndo:true,overlayAfterLastFrame:true});
   }
   report.checks.push('Reordered reachable defeats show every terminal frame before the overlay, block commands and support mid-animation Undo plus panel Undo/Reset');
  }
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{await window.happyDOM.close();mkdirSync(resolve(root,'validation'),{recursive:true});writeFileSync(resolve(root,tutorialOnly?'validation/tutorial-ui-report.json':'validation/ui-dom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
