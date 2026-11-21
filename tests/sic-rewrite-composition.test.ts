import assert from 'node:assert/strict';
import test from 'node:test';
import {composeRewrites,joinPrograms,primitiveProgram,type Rewrite} from '../src/sic/rewrite-composition.ts';

function rule(op:string,ref:number,changes:Rewrite['changes']):Rewrite {
  return {op,ref,changes,count:1,size:changes.length};
}
const unlock=rule('A',10,[[0,0,1]]), relay=rule('B',3,[[0,1,0],[1,0,1]]),
  move=rule('C',8,[[1,1,2],[2,0,1]]),use=rule('D',15,[[2,1,0],[3,0,1]]);
const bank=[use,unlock,move,relay],inputs=['A','B','C','D'],rows=[[0,0,0,0]];
test('joins independently learned programs and propagates external conditions through the intermediate states',()=>{
  const first=joinPrograms(primitiveProgram(unlock),primitiveProgram(relay))!;
  const second=joinPrograms(primitiveProgram(move),primitiveProgram(use))!;
  const result=joinPrograms(first,second)!;
  assert.deepEqual(result.steps.map(r=>r.op),inputs);
  assert.deepEqual([...result.requires].sort(),[[0,0],[1,0],[2,0],[3,0]]);
  assert.deepEqual([...result.produces].sort(),[[0,0],[1,2],[2,0],[3,1]]);
  assert.equal(joinPrograms(first,primitiveProgram(use))?.requires.get(2),1);
  assert.equal(joinPrograms(primitiveProgram(unlock),primitiveProgram(unlock)),null);
});
test('synthesizes a four-command demand through three intermediate conditions and preserves protected facts at every step',()=>{
  const request={length:4,target:{site:3,value:1}};
  const chosen=composeRewrites(bank,rows,[],inputs,new Set(),request);
  assert.deepEqual(chosen?.steps.map(r=>r.op),inputs);
  assert.equal(composeRewrites(bank,rows,[],inputs,new Set(),{...request,preserve:new Map([[0,0]])}),null);
  assert.equal(composeRewrites(bank,rows,inputs,inputs,new Set(),request),null);
  assert.equal(composeRewrites(bank,rows,[],inputs.slice(1),new Set(),request),null);
});
test('combines two independently reachable effects for a joint demand and can use a previously verified block',()=>{
  const left=rule('Q',8,[[0,0,1]]),right=rule('R',2,[[1,0,1]]);
  assert.deepEqual(composeRewrites([left,right],[[0,0]],[],['Q','R'],new Set(),
    {length:2,targets:[{site:0,value:1},{site:1,value:1}]})?.steps.map(s=>s.op),['Q','R']);
  const assembled=composeRewrites([move,use],rows,[],inputs,new Set(),{length:4,target:{site:3,value:1},verified:[[unlock,relay]]});
  assert.deepEqual(assembled?.steps.map(s=>s.op),inputs);
});
