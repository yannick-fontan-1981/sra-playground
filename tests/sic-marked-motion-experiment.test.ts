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

test('a transported change motivates a new control experiment followed by a physical independence check', async () => {
  const {proposeTransportControl, assessTransportControl} = await import('../src/sic/retest-transported-mark.ts');
  const board = (actor: number, part: number, color: number) => {
    const rows = Array.from({length:7}, () => Array<number>(9).fill(0));
    rows[1]![actor] = 2;
    rows[4]![part] = color;
    return rows;
  };
  const view = (rows:number[][]) => measureNativeObservation({frame_rows:rows,frame_hash:JSON.stringify(rows),
    level:1,state:'NOT_FINISHED',levels_completed:0,available_action_refs:['ACTION2','ACTION4']},1);
  const bare = board(1,3,4), marked = board(1,3,8), control = board(2,3,4), moved = board(2,4,8);
  const restored = board(2,4,4);
  const [b, a, c, d, e] = await Promise.all([bare,marked,control,moved,restored].map(view));
  const edge = (s:number,t:number,cmd:string,from:number[][],to:number[][],effect:Edge['effect']):Edge =>
    ({s,t,cmd,ref:t,effect,stable:true,anchors:{},manipulation:{edit:observedEdit(from,to)!,moves:[],patients:[],changedClasses:[]}});
  const m = initialMemory(1);
  m.edges = [edge(0,1,'ACTION2',bare,marked,measureEffect(b,a,bare,marked)),
    edge(0,2,'ACTION4',bare,control,measureEffect(b,c,bare,control))];
  m.markedMotion={edit:0,results:[]};
  const motion = proposeMarkedMotion(m,1,a,marked)!.markedMotion!;
  m.edges.push(edge(1,3,'ACTION4',marked,moved,measureEffect(a,d,marked,moved)));
  assert.equal(proposeTransportControl(m,3,d,moved),null);
  m.markedMotion.results.push({trial:motion,result:'mark_followed_the_measured_motion',ref:3});
  const repeat = proposeTransportControl(m,3,d,moved)!;
  assert.deepEqual([repeat.phase,repeat.b,repeat.refs],['testTransportControl','ACTION2',[1,2,3]]);
  const trial = repeat.transportControl!;
  const actual = assessTransportControl(m,trial,moved,restored,measureEffect(d,e,moved,restored));
  assert.equal(actual,'original_appearance_restored_at_the_landing');
  assert.equal(assessTransportControl(m,trial,moved,moved,measureEffect(d,d,moved,moved)),'mark_remains_at_the_landing');
  assert.equal(assessTransportControl(m,trial,moved,bare,measureEffect(d,b,moved,bare)),'transport_comparison_unresolved');
  m.edges.push(edge(3,4,'ACTION2',moved,restored,measureEffect(d,e,moved,restored)));
  m.transportControls=[{trial,result:actual,ref:4,site:4}];
  assert.equal(proposeTransportControl(m,3,d,moved),null);
  const follow = proposeTransportControl(m,4,e,restored)!;
  assert.deepEqual([follow.phase,follow.b,follow.refs],['testReleasedMotion','ACTION4',[1,2,3,4]]);
  const probe = follow.transportControl!;
  for (const [frame,expected] of [[board(3,4,4),'part_remains_at_the_release_site'],
    [board(3,5,4),'part_still_follows_the_carrier'],[restored,'transport_comparison_unresolved']] as const) {
    assert.equal(assessTransportControl(m,probe,restored,frame,measureEffect(e,await view(frame),restored,frame)),expected);
  }
  m.transportControls.push({trial:probe,result:'part_remains_at_the_release_site',ref:5,site:5});
  assert.equal(proposeTransportControl(m,4,e,restored),null);
});
