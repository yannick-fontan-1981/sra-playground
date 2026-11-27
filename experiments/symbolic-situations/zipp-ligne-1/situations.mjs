import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
export const freeze='d0e7527ca8033bd805a6d7a8bb021eff62e87021',candidate='16f3c5e8d300903e475400fb9b67a513f2834663';
const file=(sha,path)=>execFileSync('git',['show',sha+':tests/fixtures/'+path]);
const zipp=file(candidate,'sic-control-zipp-public.json.gz');
assert.equal(createHash('sha256').update(zipp).digest('hex'),'a0a7abca1db77e434c2c56d0afbf27465b2ec4858b85b103db999abfcc7e8d06');
export const historical=JSON.parse(gunzipSync(zipp));
const morphology=JSON.parse(gunzipSync(file(freeze,'v6-morphology-measurements-reference.json.gz')));
export function squareWorld(mode,seed){
  const dx=seed?5+seed[1]%4:2,dy=seed?7+seed[2]%4:3;
  const vector=seed?[seed[0]%2?1:-1,1]:[0,2];
  const scene=morphology.scenes[morphology.family.current].rows;
  let pixels=Array.from({length:64},(_,y)=>Array.from({length:64},(_,x)=>scene[y-dy]?.[x-dx]??0)),steps=0;
  const packet=()=>({frame:structuredClone(pixels),frames:[structuredClone(pixels)],availableActionIds:[1,2,3,4,5],
    state:'NOT_FINISHED',level:1,levelsCompleted:0,stepIndex:steps});
  return {vector,initial:packet(),budgets:{targetLevels:3,levelActionCaps:[20,20,20]},step(command){
    assert.ok([1,2,3,4,5].includes(Number(command.actionRef.slice(6))));
    let scale=1;if(mode==='aucun' || steps && mode==='stable')scale=0;if(steps && mode==='inverse')scale=-1;
    const square=pixels.flatMap((r,y)=>r.flatMap((v,x)=>v===9?[[x,y]]:[]));assert.equal(square.length,4);
    const next=structuredClone(pixels);for(const [x,y] of square)next[y][x]=0;
    for(const [x,y] of square){const nx=x+scale*vector[0],ny=y+scale*vector[1];assert.equal(next[ny][nx],0);next[ny][nx]=9;}
    pixels=next;steps++;return packet();
  }};
}
