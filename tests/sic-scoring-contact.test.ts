import test from 'node:test';
import assert from 'node:assert/strict';
import {measureNativeObservation,publicFrameHash} from '../src/logos-engine/v6-native-observer.ts';
import {newPreviewLearning,observePreviewBindings,visualLayout} from '../src/sic/witnessed-preview-transfer.ts';
import {offerTerminalContact} from '../src/sic/terminal-contact.ts';
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
