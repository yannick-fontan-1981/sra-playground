import assert from 'node:assert/strict';
import test from 'node:test';
import {measureDisplacedDestination} from '../src/sic/displaced-destination.ts';
import {observeLandmarks,observePlacement,type LandmarkTrial} from '../src/sic/paired-landmark-placement.ts';
import {localAccessBody} from '../src/sic/seek-indicated-access.ts';
import type {XY} from '../src/sic/access-terrain.ts';

const part=(x:number,y:number)=>({at:[2*x,2*y] as XY,box:[x,y,x,y],form:'fixture'});
const before={body:[part(2,4)],partner:[part(2,7)],pair:[part(4,4),part(4,7)],goal:[part(7,4),part(7,7)]};
const after={...before,body:[part(4,4)],pair:[part(6,4),part(4,7)]};
const pitch:XY=[4,4],site=before.pair[0]!.at,guard=before.partner[0]!.at;
test('a witnessed push revises the goal and attributes the moving instance',()=>{
  const s=measureDisplacedDestination(before,after,'pair',site,'body','partner',guard,pitch,'observed')!;
  assert.deepEqual(s.to,[12,8]);
  const c={actor:'body',parked:'partner',home:guard,goal:[14,8] as XY,pitch,displaced:s};
  assert.deepEqual(localAccessBody(after,'pair',c)?.at,s.to);
  assert.equal(localAccessBody({...after,pair:[part(6,4),part(3,7)]},'pair',c),undefined);
  const m=observeLandmarks(undefined,before,after,'start');m.reconsiderDestination=true;
  const t={stage:'place_before_selection',actor:'body',peer:'partner',pair:{role:'pair',sites:before.pair.map(p=>p.at),ref:'initial'},
    home:site,other:before.pair[1]!.at,pitch,from:before.body[0]!.at,expected:site,guard,command:'ACTION4',basis:'observed',firstRef:'begin'} as LandmarkTrial;
  assert.equal(observePlacement(m,t,after,undefined,undefined,before,undefined,'observed'),'destination_moved_with_subject');
  assert.equal(m.active,undefined);assert.equal(m.redirect?.displaced.ref,'observed');
});
test('occlusion alone and unrelated or simultaneous displacements cannot attest a push',()=>{
  for(const pair of [[part(4,7)],[part(6,3),part(4,7)],[part(6,4),part(6,7)]]){
    assert.equal(measureDisplacedDestination(before,{...after,pair},'pair',site,'body','partner',guard,pitch,'bad'),undefined);
  }
});
