import test from 'node:test';
import assert from 'node:assert/strict';
import {markedPoseMotion} from '../src/sic/marked-pose-motion.ts';
import type {NativeBox} from '../src/logos-engine/v6-native-types.ts';

test('a rotated marked foreground identifies its new site while a third object enters the parked tile',()=>{
  const source={box:[2,4,4,6] as NativeBox,ink:5},target={box:[8,4,10,6] as NativeBox,ink:7};
  const grid=()=>Array.from({length:14},()=>Array<number>(16).fill(2));
  function set(rows:number[][],x:number,y:number,rotated:boolean){
    rows[y]![x]=9;rows[y+1]![x]=7;rows[y-1]![x+(rotated?-1:1)]=7;
  }
  const a=grid(),b=grid();
  a[5]![3]=b[5]![3]=5;b[4]![3]=6;
  set(a,9,5,false);set(b,9,8,true);
  assert.deepEqual(markedPoseMotion(a,b,source,target,9),{box:[8,7,10,9],dx:0,dy:3});
  set(b,12,5,true);
  assert.equal(markedPoseMotion(a,b,source,target,9),undefined);
  b[5]![3]=2;
  assert.equal(markedPoseMotion(a,b,source,target,9),undefined);
});
