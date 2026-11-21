import test from 'node:test';
import assert from 'node:assert/strict';
import type {XY} from '../src/sic/access-terrain.ts';
import type {VisualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {newIndicatedMemory,learnIndicatedAccess,chooseIndicatedAccess} from '../src/sic/seek-indicated-access.ts';
const c={actor:'selected',parked:'partner',home:[0,0] as XY,goal:[30,0] as XY,pitch:[4,4] as XY};
const motors=[{op:'ACTION1',d:[4,0] as XY},{op:'ACTION2',d:[-4,0] as XY}];
const ops=['ACTION1','ACTION2','ACTION5'];
function view(x:number,mark?:number):VisualLayout{
  const part=(x:number,form:string)=>({at:[x,0] as XY,form,box:[x/2,0,x/2,0]});
  return {partner:[part(0,'p')],selected:[part(x,'s')],...(mark===undefined?{}:{cue:[part(mark,'m')]})};
}
test('after a refutation SIC uses a measured production to set up an indication on previously traversed ground',()=>{
  const m=newIndicatedMemory(),limits={maxDepth:10,maxNodes:100};
  const context={...c,goal:[32,0] as XY};
  learnIndicatedAccess(m,context,'early','start',view(8),view(4),'ACTION2','e1');
  learnIndicatedAccess(m,context,'start','display',view(4),view(8,16),'ACTION1','e2');
  learnIndicatedAccess(m,context,'display','far',view(8,16),view(20),'ACTION1','e3');
  learnIndicatedAccess(m,context,'far','stuck',view(20),view(8),'ACTION2','e4',[16,0]);
  const q=chooseIndicatedAccess(m,context,'stuck',motors,ops,limits)!;
  assert.equal(q.purpose,'seek_preparation');assert.equal(q.command,'ACTION1');assert.deepEqual(q.destination,[20,0]);
  learnIndicatedAccess(m,context,'stuck','ready',view(8),view(12,20),'ACTION1','e5',q.expected,q);
  const read=chooseIndicatedAccess(m,context,'ready',motors,ops,limits)!;
  assert.equal(read.purpose,'test_indication');assert.equal(read.command,'ACTION5');assert.deepEqual(read.expected,[20,0]);
  learnIndicatedAccess(m,context,'ready','arrived',view(12,20),view(20,12),'ACTION5','e6',read.expected,read);
  assert.equal(m.readings['ACTION5/cue']?.hits,1);assert.equal(m.repair,false);
});
test('a displaced partner invalidates the experiment and adjacent disclosed substrate does not create a remote cue',()=>{
  const m=newIndicatedMemory();
  learnIndicatedAccess(m,c,'before','after',view(4),view(8,4),'ACTION1','e');
  assert.equal(m.productions.length,0);
  m.repair=true;
  const probe=chooseIndicatedAccess(m,c,'after',motors,ops,{maxDepth:6,maxNodes:8})!;
  assert.deepEqual(probe,JSON.parse(JSON.stringify(probe)));
  const moved=view(12,20);moved.partner![0]!.at=[4,0];
  learnIndicatedAccess(m,c,'after','lost',view(8),moved,'ACTION1','f');
  assert.equal(m.scenes.lost,undefined);
});
