import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { captureGridContinuity, observeGridReturn, completeGridContinuity } from '../scripts/sic-grid-continuity.mjs';
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-patrol-terrain-public.json.gz',import.meta.url))));
const ticket={actionIndex:0,actionRef:fixture.proposal.actions[0].action_ref,
  observationRef:fixture.proposal.binding.observation_ref,levelsCompleted:fixture.walk[0].before.levelsCompleted};
const at=(grid,cell)=>[grid.box[0]+cell%grid.columns*grid.pitch,grid.box[1]+Math.floor(cell/grid.columns)*grid.pitch];

test('passive grid measurement binds actual before and after carrier pixels',()=>{
 const captured=captureGridContinuity(fixture.proposal,ticket,fixture.walk[0].before.frame);
 assert.equal(captured.before.actor,captured.expectedFrom);
 const observed=observeGridReturn(captured,fixture.walk[0].after.frame,ticket.levelsCompleted);
 assert.equal(observed.after.actor,observed.expectedTo);assert.equal(observed.after.actorCount,1);
 assert.equal(observed.geometry,undefined);
 const complete=completeGridContinuity(observed,()=>{throw Error('An unsealed prefix must not read acquisition');},{sealCount:0,outcome:{observation_ref:'actual-return'}});
 assert.equal(complete.acquisition,null);assert.equal(complete.afterRef,'actual-return');
});
for(const kind of ['missing','duplicate','unexpected-position'])test('passive grid measurement preserves '+kind+' instead of copying the expected move',()=>{
 const captured=captureGridContinuity(fixture.proposal,ticket,fixture.walk[0].before.frame),grid=fixture.grid,rows=structuredClone(fixture.walk[0].after.frame);
 const [x,y]=at(grid,captured.expectedTo),[u,v]=at(grid,captured.expectedTo+1);
 if(kind!=='duplicate')for(const [dx,dy]of grid.actorPixels)rows[y+dy][x+dx]=grid.base;
 if(kind!=='missing')for(const [dx,dy]of grid.actorPixels)rows[v+dy][u+dx]=grid.actor;
 const observed=observeGridReturn(captured,rows,ticket.levelsCompleted);
 if(kind==='unexpected-position')assert.equal(observed.after.actor,captured.expectedTo+1);
 else {assert.equal(observed.after.actor,null);assert.equal(observed.after.actorCount,kind==='missing'?0:2);}
});

test('passive grid observation preserves an official boundary without inventing a landing',()=>{
 const captured=captureGridContinuity(fixture.proposal,ticket,fixture.walk[0].before.frame);
 const observed=observeGridReturn(captured,[],ticket.levelsCompleted+1);
 assert.equal(observed.boundary,true);assert.equal(observed.after,null);
});
