import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Optional author check: HAPPY_DOM_MODULE may point to an existing installation.
// It loads the delivered HTML, observes DOM/pixels, and never imports game state.
const {Window}=await import(process.env.HAPPY_DOM_MODULE??'happy-dom');
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('dist/SS11-demo.html',root),'utf8');
const errors=[],checks=[];
let latestPixels,paints=0;
const window=new Window({url:'http://ss11.local/',width:1280,height:900,settings:{enableJavaScriptEvaluation:true}});
window.addEventListener('error',event=>errors.push(String(event.error??event.message)));
window.addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
const onRejection=error=>errors.push(String(error));
process.on('unhandledRejection',onRejection);
// Happy DOM omits the browser's Option(text,value) convenience constructor.
window.Option=function(text='',value=text,defaultSelected=false,selected=false){
  const option=window.document.createElement('option');
  option.text=text;option.value=value;option.defaultSelected=defaultSelected;option.selected=selected;
  return option;
};
window.HTMLCanvasElement.prototype.getContext=function(kind){
  if(kind!=='2d')return null;
  return {
    createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),
    putImageData:image=>{latestPixels=Uint8Array.from(image.data);paints++;},
  };
};
const check=(name,fn)=>{fn();checks.push({name,status:'passed'});};
const digest=()=>createHash('sha256').update(latestPixels).digest('hex');
let failure;
try{
  window.document.write(html);
  await window.happyDOM.waitUntilComplete();
  const document=window.document,$=id=>document.getElementById(id),canvas=$('board');
  const key=(value,options={})=>canvas.dispatchEvent(new window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...options}));
  const initial=digest();
  check('Standalone HTML and initial level',()=>{
    assert.match(document.title,/SS11.*La Forge des Reflets/);
    assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"]').length,0);
    assert.equal(canvas.width,64);assert.equal(canvas.height,64);
    assert.equal(canvas.dataset.level,'1');assert.equal(canvas.dataset.state,'NOT_FINISHED');
    assert.equal(canvas.dataset.busy,'false');assert.equal($('level').options.length,8);
    assert.equal($('victory').hidden,true);assert.equal($('defeat').hidden,true);
    assert.equal(latestPixels.length,64*64*4);
  });
  check('Tutorial contains twelve lessons at level one',()=>{
    assert.equal($('tutorial').hidden,false);
    assert.equal(document.querySelectorAll('[data-lesson]').length,12);
    assert.equal($('lesson-progress').textContent,'0 / 12 découvertes');
    assert.match($('tutorial-title').textContent,/^Niveau 1/);
  });
  check('Role buttons select without counting an action',()=>{
    assert.equal(canvas.dataset.selected,'warrior');
    document.querySelector('[data-hero="wizard"]').click();
    assert.equal(canvas.dataset.selected,'wizard');
    assert.equal(document.querySelector('[data-hero="wizard"]').getAttribute('aria-pressed'),'true');
    assert.equal($('moves').textContent,'0 actions');
    assert.equal(document.querySelector('[data-lesson="select"]').classList.contains('done'),true);
  });
  check('Tab and numeric shortcuts select the heroes',()=>{
    key('Tab');assert.equal(canvas.dataset.selected,'warrior');
    key('2');assert.equal(canvas.dataset.selected,'wizard');
    key('1');assert.equal(canvas.dataset.selected,'warrior');
    assert.equal($('moves').textContent,'0 actions');
    assert.equal(digest(),initial);
  });
  key('ArrowUp');
  check('Directional movement starts an animation and locks action buttons',()=>{
    assert.equal(canvas.dataset.busy,'true');
    assert.equal(document.querySelector('[data-action="1"]').disabled,true);
    assert.equal($('undo').disabled,false);assert.equal($('reset').disabled,false);
  });
  key('z');
  await window.happyDOM.waitUntilComplete();
  check('Undo interrupts animation without a stale frame',()=>{
    assert.equal(canvas.dataset.busy,'false');assert.equal(digest(),initial);
    assert.equal(document.querySelector('[data-action="1"]').disabled,false);
    assert.match($('feedback').textContent,/annulée/);
  });
  key('ArrowRight');
  assert.equal(canvas.dataset.busy,'true');
  key('r');
  await window.happyDOM.waitUntilComplete();
  check('Reset interrupts animation and restores the tutorial',()=>{
    assert.equal(canvas.dataset.busy,'false');assert.equal(digest(),initial);
    assert.equal($('moves').textContent,'0 actions');
    assert.equal($('lesson-progress').textContent,'0 / 12 découvertes');
    assert.equal($('undo').disabled,true);
  });
  key('ArrowUp');
  await window.happyDOM.waitUntilComplete();
  check('Completed keyboard movement updates pixels and teaching feedback',()=>{
    assert.equal(canvas.dataset.busy,'false');assert.notEqual(digest(),initial);
    assert.equal($('moves').textContent,'1 actions');
    assert.equal(document.querySelector('[data-lesson="move"]').classList.contains('done'),true);
    assert.equal($('undo').disabled,false);
  });
  $('undo').click();
  await window.happyDOM.waitUntilComplete();
  check('Undo button restores the last movement',()=>assert.equal(digest(),initial));
  check('Level picker exposes all eight initialized rooms',()=>{
    for(let level=1;level<=8;level++){
      $('level').value=String(level);$('level').dispatchEvent(new window.Event('change'));
      assert.equal(canvas.dataset.level,String(level));
      assert.equal(canvas.dataset.state,'NOT_FINISHED');
      assert.equal(canvas.dataset.selected,'warrior');
      assert.equal($('tutorial').hidden,level!==1);
      assert.ok($('level-title').textContent.trim());
      assert.ok($('level-objective').textContent.trim());
      assert.ok($('source-label').textContent.trim());
    }
  });
  $('restart').click();
  await window.happyDOM.waitUntilComplete();
  check('Restart returns to the initial tutorial',()=>{
    assert.equal(canvas.dataset.level,'1');assert.equal(digest(),initial);
    assert.equal($('moves').textContent,'0 actions');assert.equal($('tutorial').hidden,false);
  });
  check('No JavaScript exceptions during the targeted checks',()=>assert.deepEqual(errors,[]));
}catch(error){failure=String(error?.stack??error);}
finally{
  const report={
    artifact:'dist/SS11-demo.html',htmlSha256:createHash('sha256').update(html).digest('hex'),
    environment:'Happy DOM with a minimal Canvas 2D pixel-write recorder',
    status:failure?'failed':'passed',checks,paints,errors,...(failure?{failure}:{}),
    limitations:[
      'DOM and JavaScript checks only; no real-browser layout, visual review, audio or GPU rendering.',
      'Canvas records the actual pixel buffers written by the app, without reproducing its rendering logic.',
      'The browser Option constructor is supplied as a minimal shim because this Happy DOM version omits it.',
      'Only initial-room actions and level selection are exercised; no campaign solution, solver or uniqueness check.',
    ],
  };
  await mkdir(new URL('validation/',root),{recursive:true});
  await writeFile(new URL('validation/ui-report.json',root),JSON.stringify(report,null,2)+'\n');
  await window.happyDOM.close();
  process.removeListener('unhandledRejection',onRejection);
  console.log(JSON.stringify({status:report.status,checks:checks.length,paints,errors,...(failure?{failure}:{})},null,2));
  if(failure)process.exitCode=1;
}
