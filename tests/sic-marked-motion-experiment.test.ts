import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { assessMarkedMotion, proposeMarkedMotion } from '../src/sic/marked-motion-experiment.ts';
import { initialMemory, measureEffect, type Edge } from '../src/sic/preparation-experiments.ts';
import { observedEdit } from '../src/sic/relative-edits.ts';
import { nativePlanReceipt } from '../src/sic/native-plan-receipt.ts';

test('a witnessed motor separates a fixed change from one transported by the same subject',async()=>{
  const board=(bodyX:number,partX:number,ink:number)=>{
    const rows=Array.from({length:6},()=>Array<number>(8).fill(0));
    rows[1]![bodyX]=2;
    rows[4]![partX]=ink;
    return rows;
  };
  const bare=board(1,3,4), marked=board(1,3,8), control=board(2,3,4);
  const fixed=board(2,3,8), transported=board(2,4,8);
  const view=async(rows:number[][])=>measureNativeObservation({frame_rows:rows,frame_hash:JSON.stringify(rows),
    level:1,state:'NOT_FINISHED',levels_completed:0,available_action_refs:['ACTION2','ACTION4']},1);
  const [at,b,c]=await Promise.all([view(marked),view(bare),view(control)]);
  const oldMotion=measureEffect(b,c,bare,control);
  assert.equal(oldMotion.moves.length,1);
  const edge=(cmd:string,t:number,after:number[][]):Edge=>({s:0,t,ref:t,cmd,stable:true,anchors:{},
    manipulation:{edit:observedEdit(bare,after)!,moves:[],patients:[],changedClasses:[]},
    effect:t===1?{key:'edit',moves:[]}:oldMotion});
  const m=initialMemory(1);
  m.edges=[edge('ACTION2',1,marked),edge('ACTION4',2,control)];
  m.markedMotion={edit:0,results:[]};
  const proposal=proposeMarkedMotion(m,1,at,marked)!;
  assert.equal(proposal.b,'ACTION4');
  assert.deepEqual(proposal.refs,[1,2]);
  const trial=proposal.markedMotion!;
  assert.equal(trial.distinguishingPixels,2);
  const forecast={...trial,outcomes:['mark_stays_fixed','mark_follows_measured_subject']};
  const receipt=nativePlanReceipt('sic_test_prepared_effects',{kind:'sic_test_prepared_effects',status:'proposed',
    actions:[{action_ref:proposal.b,data:{}}],markedMotionForecast:forecast},at,0);
  assert.deepEqual(receipt.markedMotionForecast,forecast);
  for(const [after,expected] of [[fixed,'mark_stayed_at_its_previous_position'],
    [transported,'mark_followed_the_measured_motion'],[marked,'comparison_movement_unconfirmed']] as const){
    assert.equal(assessMarkedMotion(m,trial,marked,after,measureEffect(at,await view(after),marked,after)),expected);
  }
  m.markedMotion.results.push({trial,result:'mark_followed_the_measured_motion',ref:3});
  assert.equal(proposeMarkedMotion(m,1,at,marked),null);
  assert.equal(proposeMarkedMotion(m,0,at,bare),null);
});
