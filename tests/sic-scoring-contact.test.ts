import test from 'node:test';
import assert from 'node:assert/strict';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning,observePreviewBindings,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {offerTerminalContact,measureTerminalContact} from '../src/sic/terminal-contact.ts';
import {witnessedObjective} from '../src/sic/experiment-arbitration.ts';
import type {Memory} from '../src/sic/preparation-experiments.ts';

const inputs=['ACTION1','ACTION2','ACTION3','ACTION4'];
async function scene(x:number,y:number,revision:number,duplicate=false){
  const rows=Array.from({length:10},()=>Array<number>(15).fill(0));
  for(const [left,top,ink] of [[x,y,9],[7,3,4],...(duplicate?[[11,3,4]]:[])] as [number,number,number][]){
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)rows[top+dy]![left+dx]=ink;
  }
  const o=await measureNativeObservation({frame_rows:rows,frame_hash:await publicFrameHash(rows),
    level:2,levels_completed:0,state:'LIVE',available_action_refs:inputs},revision,'source-contact');
  return {rows,o};
}
test('two measured moves can set up an untested contact without an earlier scored level',async()=>{
  const learn=newPreviewLearning(),available=new Set(inputs);
  let previous=await scene(1,3,0);
  for(const [i,[x,y,op]] of ([[3,3,'ACTION4'],[3,5,'ACTION2'],[3,3,'ACTION1'],[5,3,'ACTION4'],[3,3,'ACTION3']] as const).entries()){
    const next=await scene(x,y,i+1);
    observePreviewBindings(learn,previous.o,next.o,visualLayout(previous.o,previous.rows),visualLayout(next.o,next.rows),op);
    previous=next;
  }
  const m={previewLearning:learn} as Memory;
  assert.equal(offerTerminalContact(m,5,previous.o,previous.rows,available),null);
  const proposal=offerTerminalContact(m,5,previous.o,previous.rows,available,true)!;
  assert.equal(proposal.phase,'testScoringContact');assert.equal(proposal.terminalContact?.distance,2);
  assert.equal(proposal.a,'ACTION4');assert.equal(witnessedObjective(proposal),false);
  const repeated=await scene(3,3,6,true);
  assert.equal(offerTerminalContact(m,6,repeated.o,repeated.rows,available,true),null);
});

test('a visible but different landing invalidates the proposed displacement until it is observed again',async()=>{
  const learn=newPreviewLearning(),available=new Set(inputs);
  let previous=await scene(1,3,0);
  for(const [i,[x,y,op]] of ([[3,3,'ACTION4'],[3,5,'ACTION2'],[3,3,'ACTION1'],[5,3,'ACTION4'],[3,3,'ACTION3']] as const).entries()){
    const next=await scene(x,y,i+1);
    observePreviewBindings(learn,previous.o,next.o,visualLayout(previous.o,previous.rows),visualLayout(next.o,next.rows),op);
    previous=next;
  }
  const state={previewLearning:learn} as Memory;
  const trial=offerTerminalContact(state,5,previous.o,previous.rows,available,true)!.terminalContact!;
  assert.equal(trial.op,'ACTION4');
  const blocked=structuredClone(learn);
  const localState={previewLearning:blocked} as Memory;
  const still=measureTerminalContact(blocked,trial,previous.o,previous.o,trial.op,visualLayout(previous.o,previous.rows));
  assert.equal(still.matched,false);
  assert.deepEqual(still.actual,trial.from);
  const remoteChange={...previous.o,frame_hash:'remote_change'};
  assert.equal(offerTerminalContact(localState,6,remoteChange,previous.rows,available,true),null);
  const changedLanding=previous.rows.map(row=>[...row]);
  changedLanding[3]![5]=6;
  assert.equal(offerTerminalContact(localState,6,{...remoteChange,frame_hash:'changed_landing'},changedLanding,available,true)?.a,'ACTION4');
  const slide=await scene(11,3,6);
  const verdict=measureTerminalContact(learn,trial,previous.o,slide.o,trial.op,visualLayout(slide.o,slide.rows));
  assert.equal(verdict.matched,false);
  assert.ok(verdict.actual);
  // A changed frame with the same geometrical command still uses the refuted stroke.
  const forecast=offerTerminalContact(state,7,{...previous.o,frame_hash:'unrelated_change'},previous.rows,available,true);
  assert.equal(forecast,null);
  const start=await scene(1,5,8),end=await scene(3,5,9);
  observePreviewBindings(learn,start.o,end.o,visualLayout(start.o,start.rows),visualLayout(end.o,end.rows),'ACTION4');
  assert.equal(offerTerminalContact(state,9,{...previous.o,frame_hash:'revalidated_context'},previous.rows,available,true)?.a,'ACTION4');
});
