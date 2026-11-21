import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  NativeEntity,
  NativeObservation,
  NativeCommand,
  NativeBox,
} from '../src/logos-engine/v6-native-types.ts';
import {
  createCompositionTrials,
  cycleGroup,
  exhaustedGroup,
  followCompositionGroup,
  chooseSequence,
} from '../src/sic/test-observed-compositions.ts';
import { actionRelation, type Step } from '../src/sic/composition-context.ts';

const control = (id: number): NativeCommand => ({ action_ref: 'ACTION' + id, data: {} });
const inputs = [1, 2, 3, 4, 5].map(control);
const frame = Array.from({ length: 10 }, () => Array(10).fill(0));
function entity(signature: string, x: number): NativeEntity {
  const box: NativeBox = [x, 3, x, 3];
  return {
    id: signature,
    signature,
    position: [x, 3],
    bbox: box,
    area: 1,
    scale: 1,
    mask: [[0, 0]],
    palette_value: 1,
    rectangular: true,
    identity_ambiguous: false,
    identity_scope: 'measured',
  };
}
function observation(key: string, x = 0): NativeObservation {
  return {
    revision: 0,
    level_epoch: 1,
    frame_hash: key,
    observation_ref: 'public:revision:' + key,
    coordinate_basis: 'screen',
    entities: [entity('moving', x), entity('other', 8)],
    available_action_refs: inputs.map((c) => c.action_ref),
    state: 'NOT_FINISHED',
    levels_completed: 0,
    unknowns: [],
    provenance: 'public',
  };
}
test('a directional cycle opens an untried continuation, with no point input', async () => {
  const family = createCompositionTrials();
  const a = observation('a', 1),
    b = observation('b', 2);
  for (let i = 0; i < 3; i++) {
    await family.observePublicOutcome!(a, b, control(4), frame, frame);
    await family.observePublicOutcome!(b, a, control(3), frame, frame);
  }
  const offer = await family.proposeInGroup!(cycleGroup, a, frame, inputs, 30);
  assert.ok(offer);
  assert.notEqual(offer.actions[0]!.action_ref, 'ACTION4');
  assert.ok(offer.question);
  assert.equal(await family.proposeInGroup!(cycleGroup, { ...a, level_epoch: 2 }, frame, inputs, 30), null);
});
test('a measured control can be recombined with a different object and refuted by its public return', async () => {
  const family = createCompositionTrials(),
    a = observation('a', 1),
    b = observation('b', 2),
    c = observation('c', 3);
  await family.observePublicOutcome!(a, b, control(4), frame, frame);
  const first = await family.proposeInGroup!(exhaustedGroup, b, frame, inputs, 20);
  assert.ok(first);
  await family.record(b, b, first.actions[0]!, frame, frame, first, 0, []);
  const approach = await family.proposeInGroup!(exhaustedGroup, b, frame, inputs, 19);
  assert.ok(approach?.goal);
  assert.equal(approach.actions[0]!.action_ref, 'ACTION4');
  assert.equal((await family.after(approach, 0, b, c, frame, frame)).matched, true);
  assert.equal((await family.after(approach, 0, b, b, frame, frame)).matched, false);
});
test('different observed routes back to the same scene can also trigger a composition trial', async () => {
  const family = createCompositionTrials();
  const root = observation('root');
  for (let i = 0; i < 6; i++) {
    const other = observation('different' + i);
    await family.observePublicOutcome!(root, other, control(4), frame, frame);
    await family.observePublicOutcome!(other, root, control(3), frame, frame);
  }
  assert.ok(await family.proposeInGroup!(cycleGroup, root, frame, inputs, 10));
});
test('an addressed action distinguishes a new region from repeating the same command', () => {
  assert.equal(actionRelation('ACTION6:1,1', 'ACTION6:8,2'), 'change_target');
  const h: Step[] = [
    { source: 'x', target: 'x', key: 'ACTION6:1,1', effect: 'unchanged', repeated: false, evidence: 'ref' },
  ];
  const click = (x: number): NativeCommand => ({ action_ref: 'ACTION6', data: { x, y: 1 } });
  assert.deepEqual(chooseSequence(h, 'x', [click(1), click(4)]), click(4));
});

test('executes one inferred link at a time and retains a verified prefix on refutation',async()=>{
  const family=createCompositionTrials(),start=observation('start'),other=observation('elsewhere');
  const initialRows=[[0,0]];
  for(let i=0;i<4;i++){
    await family.observePublicOutcome!(start,other,control(4),initialRows,initialRows);
    await family.observePublicOutcome!(other,start,control(3),initialRows,initialRows);
  }
  const steps=[
    {op:'ACTION1',ref:5,count:1,size:1,changes:[[0,0,1]]},
    {op:'ACTION2',ref:2,count:1,size:2,changes:[[0,1,0],[1,0,1]]},
    {op:'ACTION3',ref:7,count:1,size:1,changes:[[1,1,2]]},
    {op:'ACTION4',ref:4,count:1,size:1,changes:[[1,2,3]]},
  ];
  family.restore({...family.state(),rewrites:steps});
  let b=start,rows=initialRows,group=cycleGroup;
  for(const [i,result] of [[[1,0]],[[0,1]],[[0,1]]].entries()){
    const proposal=await family.proposeInGroup!(group,b,rows,inputs,20);
    assert.ok(proposal?.program);
    assert.equal(proposal.program.index,i);
    const command=proposal.actions[0]!,a=observation('future'+i);
    assert.equal(command.action_ref,steps[i]!.op);
    assert.equal((await family.after(proposal,0,b,a,rows,result)).matched,i<2);
    await family.record(b,a,command,rows,result,proposal,0,[]);
    b=a;rows=result;group=followCompositionGroup;
  }
  assert.equal(await family.proposeInGroup!(followCompositionGroup,b,rows,inputs,20),null);
  assert.deepEqual((family.state().verifiedPrograms as {op:string}[][])[0]!.map(s=>s.op),['ACTION1','ACTION2']);
});
