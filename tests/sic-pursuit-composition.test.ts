import test from 'node:test';
import assert from 'node:assert/strict';
import {captureRanks,choosePursuit,observePursuit,type PursuitMemory} from '../src/sic/pursuit-composition.ts';
import {newPreviewLearning,type VisualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import type {XY} from '../src/sic/access-terrain.ts';

test('works backwards through every escape in a corridor and distinguishes a loop in which only some replies permit contact',()=>{
  const line:XY[]=[[0,0],[1,0],[2,0],[3,0],[4,0]];
  const paths=[[1],[0,2],[1,3],[2,4],[3]];
  assert.equal(captureRanks(line,paths,paths,true)[2],4);
  const loop:XY[]=[[0,0],[1,0],[1,1],[0,1]],ring=[[1,3],[0,2],[1,3],[0,2]];
  assert.equal(captureRanks(loop,ring,ring,true)[2],0);
  assert.equal(captureRanks(loop,ring,ring,false)[2],2);
});
test('tracks the identifiable response of one copy without treating the stationary copy as a second movement',()=>{
  const layout=(a:XY,bs:XY[]):VisualLayout=>{
    const p=(at:XY,form:string)=>({at,box:[at[0],at[1],at[0],at[1]],form});
    return {a:[p(a,'one')],b:bs.map(b=>p(b,'two'))};
  };
  const m:PursuitMemory={pairs:{}};
  observePursuit(m,layout([0,0],[[4,0],[4,4]]),layout([2,0],[[6,0],[4,4]]),'ACTION4','r1');
  const r=m.pairs['a/b/2']!;assert.equal(r.away,1);assert.equal(r.toward,0);
  assert.equal(r.samples.length,2);assert.deepEqual(r.responses,['2,0']);
});

test('a contradicted immediate contact yields to another approach from the same image',()=>{
  const part=(at:XY,form:string)=>({at,box:[at[0],at[1],at[0],at[1]],form});
  const view:VisualLayout={actor:[part([4,0],'actor')],target:[part([6,0],'target'),part([0,0],'target')]};
  const memory:PursuitMemory={pairs:{sample:{actor:'actor',peer:'target',pitch:2,away:3,toward:0,
    responses:['2,0','-2,0'],sites:['0,0','2,0','4,0','6,0','8,0'],refs:['motion'],samples:[]}}};
  const learned=newPreviewLearning();
  const stroke=(d:XY)=>({d,count:1,last:'after',first:'before'});
  learned.partMotion={actor:{axes:{ACTION3:{left:stroke([-2,0])},ACTION4:{right:stroke([2,0])}},sites:{'2,0':1},substrate:{}}};
  const available=new Set(['ACTION3','ACTION4']),pixels=[[0,0,0,0,0]];
  const choose=(refutations?:Record<string,string>)=>choosePursuit(memory,learned,view,pixels,available,{},undefined,refutations);
  assert.equal(choose()?.input,'ACTION4');
  const alternative=choose({ACTION4:'unmoved after contact'});
  assert.equal(alternative?.input,'ACTION3');
  assert.ok(alternative.refs.includes('unmoved after contact'));
  assert.equal(choose({ACTION3:'left blocked',ACTION4:'right blocked'}),null);
  assert.equal(choose()?.input,'ACTION4');
});
