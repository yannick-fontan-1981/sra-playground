import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {measureNativeObservation} from '../src/logos-engine/v6-native-observer.ts';
import {createPreparedEffects} from '../src/sic/test-prepared-effects.ts';
import {evidencedPlanGroup, recurrentExperimentGroup} from '../src/sic/experiment-arbitration.ts';
import {compileInformationPreference} from '../src/sic/information-preference.ts';
import {motorStudy,proposeMotorTest,recordMotorContext,useMeasuredControl} from '../src/sic/positional-motor-test.ts';
import type {CursorTrial} from '../src/sic/marked-cursor-selection.ts';

function scene(actor: number, selected=false, peer=18) {
  const frame=Array.from({length:19},()=>Array<number>(32).fill(0));
  for (let y=5;y<8;y++) {
    frame[y]!.fill(1,actor,actor+3);
    frame[y]!.fill(selected?5:2,peer,peer+2);
  }
  frame[6]![10]=4;
  frame[7]![peer+2]=selected?5:2;
  return frame;
}
function observe(rows:number[][], revision:number, click:boolean) {
  return measureNativeObservation({frame_rows:rows, frame_hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    state:'NOT_FINISHED',level:1,levels_completed:0,step_index:revision,
    available_action_refs:click?['ACTION3','ACTION4','ACTION6']:['ACTION3','ACTION4']},revision,'positional');
}
const choice = {strategy:'motion_contrast',mode:'active',minimumOutcomes:2} as const;
const active = compileInformationPreference({...choice,motorExperiment:'measure_positional_baseline'});

test('the declared experiment asks if motion repeats on changed terrain, with or without selection',async()=>{
  for (const click of [false,true]) {
    const rows=[scene(2),scene(5),scene(5),scene(5,true),scene(5,true,21)];
    const [a,b,c,d,e]=await Promise.all(rows.map((r,i)=>observe(r,i+1,click)));
    const baseline=createPreparedEffects(choice), candidate=createPreparedEffects(active);
    for (const family of [baseline,candidate])
      await family.observePublicOutcome!(a!,b!,{action_ref:'ACTION4',data:{}},rows[0]!,rows[1]!);
    assert.ok(!(await candidate.proposeInGroup!(evidencedPlanGroup,b!,rows[1]!,[],12,{}))?.motorBaselineForecast);
    const control=await baseline.proposeInGroup!(recurrentExperimentGroup,b!,rows[1]!,[],12,{});
    if (click) assert.equal(control?.actions[0]?.action_ref,'ACTION6');
    assert.ok(!control?.motorBaselineForecast);
    const exp=await candidate.proposeInGroup!(recurrentExperimentGroup,b!,rows[1]!,[],12,{});
    assert.equal(exp?.actions[0]?.action_ref,'ACTION4');
    assert.equal(exp?.motorBaselineForecast.basis,'different_entry_surface');
    assert.deepEqual(exp?.motorBaselineForecast.evidence,[a!.observation_ref,b!.observation_ref]);
    const measured=await candidate.record!(b!,c!,exp.actions[0]!,rows[1]!,rows[2]!,exp);
    assert.equal(measured.events[0]?.result,'same_subject_stays');
    const after=await candidate.proposeInGroup!(recurrentExperimentGroup,c!,rows[2]!,[],11,{});
    assert.ok(!after?.motorBaselineForecast);
    if (!click) continue;
    assert.equal(after?.actions[0]?.action_ref,'ACTION6');
    const comparison=after.cursorSelectionForecast.contrast;
    assert.deepEqual(comparison.outcomes,['both_subjects_stay','selected_subject_moves']);
    assert.equal(comparison.measuredWithoutSelection.observation,c!.observation_ref);
    await candidate.record!(c!,d!,after.actions[0],rows[2]!,rows[3]!,after);
    const verify=await candidate.proposeInGroup!(evidencedPlanGroup,d!,rows[3]!,[],10,{});
    assert.equal(verify.actions[0].action_ref,'ACTION4');
    const result=await candidate.record!(d!,e!,verify.actions[0],rows[3]!,rows[4]!,verify);
    assert.equal(result.events[0]?.result,'new_cursor_moved_while_previous_cursor_stayed');
  }
});

test('an unrecognized positional experiment cannot be imported',()=>{
  assert.throws(()=>compileInformationPreference({...choice,motorExperiment:'guess'}),/motor experiment/);
});

test('a public contradiction supplies two measurable destinations for a one-action experiment',async()=>{
  const candidate=compileInformationPreference({...choice,motorExperiment:'distinguish_observed_displacements'});
  for (const [last,expected] of [[7,'latest_displacement_repeated'],[9,'earlier_displacement_returned'],[6,'neither_observed_displacement'],[9,'subject_unresolved']] as const) {
    const rows=[2,5,6,last].map(x=>scene(x));
    if (expected==='earlier_displacement_returned') rows[3]![6]![10]=1;
    const [a,b,c,d]=await Promise.all(rows.map((r,i)=>observe(r,i+1,false)));
    for (const preference of [active,candidate]) {
      const family=createPreparedEffects(preference);
      await family.observePublicOutcome!(a!,b!,{action_ref:'ACTION4',data:{}},rows[0]!,rows[1]!);
      const first=await family.proposeInGroup!(recurrentExperimentGroup,b!,rows[1]!,[],2,{});
      assert.equal(first.motorBaselineForecast.basis,'different_entry_surface');
      const measured=await family.record!(b!,c!,first.actions[0],rows[1]!,rows[2]!,first);
      assert.equal(measured.events[0].result,'different_displacement');
      assert.ok(!(await family.proposeInGroup!(evidencedPlanGroup,c!,rows[2]!,[],1,{}))?.motorBaselineForecast);
      const next=await family.proposeInGroup!(recurrentExperimentGroup,c!,rows[2]!,[],1,{});
      if (preference===active) {assert.ok(!next?.motorBaselineForecast);continue;}
      assert.deepEqual(measured.events[0].motorDelta,[1,0]);
      assert.equal(next.actions[0].action_ref,'ACTION4');
      assert.equal(next.motorBaselineForecast.basis,'two_observed_displacements');
      assert.deepEqual(next.motorBaselineForecast.delta,[1,0]);
      assert.deepEqual(next.motorBaselineForecast.rivalDelta,[3,0]);
      assert.deepEqual(next.motorBaselineForecast.evidence,[a!.observation_ref,b!.observation_ref,c!.observation_ref]);
      assert.equal(next.sicSituationCard.mode,'exploration');
      const outcome=await family.record!(c!,d!,next.actions[0],rows[2]!,rows[3]!,next);
      assert.equal(outcome.events[0].result,expected);
      assert.deepEqual(outcome.events[0].motorDelta,expected==='subject_unresolved'?undefined:[last-6,0]);
    }
  }
});

test('an unexpected displacement is usable as a no-selection control at the same public placement',async()=>{
  const rows=[2,5,6].map(x=>scene(x));
  const [a,b,c]=await Promise.all(rows.map((r,i)=>observe(r,i+1,true)));
  const study=motorStudy();
  recordMotorContext(study,a!,b!,'ACTION4',rows[0]!,rows[1]!);
  const first=proposeMotorTest(study,b!,rows[1]!);
  assert.ok(first);
  recordMotorContext(study,b!,c!,'ACTION4',rows[1]!,rows[2]!,first,true);
  const actor=b!.entities.find(e=>e.signature===first.actor)!;
  const select:CursorTrial={
    stage:'select',command:'ACTION6:18,6',source:{ink:actor.palette_value,box:actor.bbox},
    target:{ink:2,box:[18,5,20,7]},point:[18,6],offsets:[],ink:5,shape:'peer',evidence:[],
    contrast:{strategy:'motion_contrast',mode:'exploration',minimumOutcomes:2,motor:'ACTION4',
      baselineDelta:[3,0],evidence:b!.observation_ref,outcomes:['previous_subject_moves','selected_subject_moves']},
  };
  const reused=useMeasuredControl(study,b!,select);
  assert.equal(reused.contrast?.measuredWithoutSelection?.result,'different_displacement');
  assert.deepEqual(reused.contrast?.measuredWithoutSelection?.delta,[1,0]);
  assert.deepEqual(reused.evidence,[c!.observation_ref]);
  assert.equal(useMeasuredControl(study,c!,select),select);
  const wrongInk={...select,source:{...select.source,ink:2}};
  assert.equal(useMeasuredControl(study,b!,wrongInk),wrongInk);
  assert.ok(!proposeMotorTest(study,{...c!,available_action_refs:['ACTION3']},rows[2]!));
  recordMotorContext(study,c!,c!,'ACTION6:18,6',rows[2]!,rows[2]!);
  assert.ok(!proposeMotorTest(study,c!,rows[2]!));
});

test('one remaining command completes a measured comparison at a newly reached arrangement',async()=>{
  const base=scene(2), prepared=scene(5), moved=scene(5,true,20);
  const [a,b,c,d]=await Promise.all([base,base,prepared,moved].map((r,i)=>observe(r,i+1,false)));
  for (const enabled of [false,true]) {
    const pack=compileInformationPreference({...choice,...(enabled?{earlyControl:'complete_an_observed_pair'}:{})});
    const family=createPreparedEffects(pack);
    await family.observePublicOutcome!(a!,b!,{action_ref:'ACTION3',data:{}},base,base);
    await family.observePublicOutcome!(b!,c!,{action_ref:'ACTION4',data:{}},base,prepared);
    const plan=await family.proposeInGroup!(recurrentExperimentGroup,c!,prepared,[],1,{});
    if (!enabled) {assert.ok(!plan?.matchedControlForecast);continue;}
    assert.equal(plan.actions[0].action_ref,'ACTION3');
    assert.deepEqual(plan.matchedControlForecast.evidence,[c!.revision,b!.revision]);
    assert.equal(plan.matchedControlForecast.bareEffect,'still');
    assert.equal(plan.matchedControlForecast.preparedScene,c!.frame_hash);
    assert.equal(plan.sicSituationCard.mode,'exploration');
    const tested=await family.record!(c!,d!,plan.actions[0],prepared,moved,plan);
    assert.equal(tested.events[0].result,'differential');
    assert.equal(tested.events[0].bareEffect,'still');
    assert.notEqual(tested.events[0].actual,'still');
    assert.ok(!(await family.proposeInGroup!(recurrentExperimentGroup,d!,moved,[],0,{}))?.matchedControlForecast);
  }
  assert.throws(()=>compileInformationPreference({...choice,earlyControl:'always_replay'}),/controlled experiment/);
});
