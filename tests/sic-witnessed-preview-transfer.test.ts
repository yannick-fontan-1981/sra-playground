import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createPreparedEffects } from '../src/sic/test-prepared-effects.ts';
import {observedSituatedOperations,retainSituatedOperations} from '../src/sic/situated-preparation.ts';
import {initialMemory} from '../src/sic/preparation-experiments.ts';
import {offerTerminalContact,measureTerminalContact} from '../src/sic/terminal-contact.ts';
import {splitNativeState} from '../src/logos-engine/v6-native-state-graph.ts';
import {
  acceptPreviewCarry,
  carryPreviewBindings,
  checkWitnessedPreview,
  newPreviewLearning,
  observePreviewBindings,
  offerWitnessedPreview,
  visualLayout,
} from '../src/sic/witnessed-preview-transfer.ts';

type Point = [number, number];
async function scene(
  level: number,
  revision: number,
  subjects: Point[],
  marker: Point | null,
  scope = 'public-campaign'
) {
  const rows = Array.from({ length: 20 }, () => Array<number>(28).fill(0));
  for (const [x, y] of subjects)
    for (const [dx, dy] of [
      [0, 0],
      [0, 1],
      [1, 1],
    ] as const)
      rows[y + dy]![x + dx] = 9;
  if (marker) rows[marker[1]]![marker[0]] = 4;
  const o = await measureNativeObservation(
    {
      frame_rows: rows,
      frame_hash: await publicFrameHash(rows),
      level,
      levels_completed: level - 1,
      state: 'NOT_FINISHED',
      available_action_refs: ['ACTION2', 'ACTION5', 'ACTION6'],
    },
    revision,
    scope
  );
  return { o, rows, layout: visualLayout(o, rows) };
}
const q: NativeCommand = { action_ref: 'ACTION5', data: {} };
test('the active pack seeks a cue after failed uses, then measures the rediscovered operation', async()=>{
  const move:NativeCommand={action_ref:'ACTION2',data:{}};
  const frames=await Promise.all([
    scene(1,1,[[3,4]],null),scene(1,2,[[5,4]],[17,4]),scene(1,3,[[17,4]],null),
    scene(2,4,[[3,7]],null),scene(2,5,[[3,7]],null),scene(2,6,[[5,7]],null),
    scene(2,7,[[5,7]],null),scene(2,8,[[7,7]],[19,7]),scene(2,9,[[19,7]],null),
  ]);
  for(const mode of ['active','shadow'] as const){
    const family=createPreparedEffects({mode,minimumOutcomes:2,strategy:'motion_contrast'});
    const step=async(i:number,c:NativeCommand)=>{const u=frames[i]!,v=frames[i+1]!;
      await family.observePublicOutcome!(u.o,v.o,c,u.rows,v.rows);};
    for(const [i,c] of [move,q,move,q,move,q].entries())await step(i,c);
    const probe=await family.proposeInGroup!('continue_or_test_a_witnessed_effect',frames[6]!.o,frames[6]!.rows,[move,q],20,{});
    if(mode==='shadow'){assert.ok(!probe?.cueSearchForecast);continue;}
    assert.equal(probe?.experiment.phase,'seekMissingCue');assert.equal(probe?.actions[0]?.action_ref,'ACTION2');
    assert.equal(probe?.sicSituationCard.mode,'exploration');assert.equal(probe?.cueSearchForecast.blocked.length,2);
    const result=await family.record!(frames[6]!.o,frames[7]!.o,move,frames[6]!.rows,frames[7]!.rows,probe);
    assert.equal(result.events[0]?.result,'cue_became_visible');
    const use=await family.proposeInGroup!('continue_or_test_a_witnessed_effect',frames[7]!.o,frames[7]!.rows,[move,q],19,{});
    assert.equal(use?.experiment.rule,'use_the_rediscovered_cue');assert.equal(use.actions[0]?.action_ref,'ACTION5');
    const measured=await family.record!(frames[7]!.o,frames[8]!.o,q,frames[7]!.rows,frames[8]!.rows,use);
    assert.equal(measured.events[0]?.result,'preview_realized');
    assert.equal(family.state!().previewLearning.cueSearch.seeking,undefined);
  }
});
test('a winning boundary transfers the relative pose for an operation and tests the feature at a different site',async()=>{
  const frames=await Promise.all([1,3,5].map((x,i)=>scene(1,i+1,[[x,4]],[8,4])));
  const used=await scene(1,4,[[5,4]],null);
  const learn=newPreviewLearning();
  for(let i=1;i<frames.length;i++){
    const u=frames[i-1]!,v=frames[i]!;
    observePreviewBindings(learn,u.o,v.o,u.layout,v.layout,'ACTION2');
  }
  const at=frames[2]!;
  const observed=observedSituatedOperations(learn,at.o,used.o,at.layout,used.layout,'ACTION5');
  assert.ok(observed.length);
  retainSituatedOperations(learn,observed);
  const entered=await scene(2,5,[[9,7]],[14,7]),ready=await scene(2,6,[[11,7]],[14,7]),opened=await scene(2,7,[[11,7]],null);
  const carry=carryPreviewBindings(learn,used.o,entered.o);
  assert.ok(carry);
  assert.equal(acceptPreviewCarry(carry,(await scene(2,5,[[9,7]],[14,7],'another-game')).o).inheritedPreparations,undefined);
  const m=initialMemory(2),available=new Set(entered.o.available_action_refs);
  m.previewLearning=acceptPreviewCarry(carry,entered.o);
  const approach=offerTerminalContact(m,0,entered.o,entered.rows,available,'positioned')!;
  assert.doesNotThrow(() => splitNativeState(approach, 'preparation'));
  assert.equal(approach.phase,'positionForOperation');
  assert.equal(approach.a,'ACTION2');
  const motion=measureTerminalContact(m.previewLearning,approach.terminalContact!,entered.o,ready.o,approach.a,ready.layout);
  assert.equal(motion.matched,true);
  const use=offerTerminalContact(m,1,ready.o,ready.rows,available,'positioned')!;
  assert.equal(use.phase,'usePositionedOperation');
  assert.equal(use.a,'ACTION5');
  const noEffect=measureTerminalContact(structuredClone(m.previewLearning),use.terminalContact!,ready.o,ready.o,use.a,ready.layout);
  assert.equal(noEffect.matched,false);
  const result=measureTerminalContact(m.previewLearning,use.terminalContact!,ready.o,opened.o,use.a,opened.layout);
  assert.equal(result.matched,true);
  assert.equal(result.won,false);
  assert.equal(offerTerminalContact(m,1,ready.o,ready.rows,available,'positioned'),null);
});
test('one measured arrival binds the moving individual despite a matching stationary peer', async () => {
  const before = await scene(
      1,
      1,
      [
        [3, 4],
        [20, 4],
      ],
      [11, 9]
    ),
    after = await scene(
      1,
      2,
      [
        [11, 9],
        [20, 4],
      ],
      null
    );
  const mem = newPreviewLearning();
  observePreviewBindings(mem, before.o, after.o, before.layout, after.layout, q.action_ref);
  const rules = Object.values(mem.bindings);
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0]!.witnesses[0]!.from, [7, 9]);
  assert.deepEqual(rules[0]!.witnesses[0]!.peers, [[41, 9]]);
  assert.deepEqual(rules[0]!.witnesses[0]!.indicated, [22, 18]);
  const still = await scene(
      1,
      3,
      [
        [11, 9],
        [20, 4],
      ],
      null
    ),
    ambiguous = await scene(
      1,
      4,
      [
        [11, 9],
        [8, 14],
      ],
      null
    );
  const other = newPreviewLearning();
  observePreviewBindings(other, after.o, still.o, after.layout, still.layout, q.action_ref);
  observePreviewBindings(other, before.o, ambiguous.o, before.layout, ambiguous.layout, q.action_ref);
  assert.deepEqual(other.bindings, {});
});
test('the family restores the witnessed relation across an official completion and reads the current mark before acting', async () => {
  const family = createPreparedEffects(),
    before = await scene(
      1,
      1,
      [
        [3, 4],
        [20, 4],
      ],
      [11, 9]
    ),
    after = await scene(
      1,
      2,
      [
        [11, 9],
        [20, 4],
      ],
      null
    );
  await family.observePublicOutcome!(before.o, after.o, q, before.rows, after.rows);
  const next = await scene(2, 3, [[4, 6]], [16, 3]);
  await family.observePublicOutcome!(
    after.o,
    next.o,
    { action_ref: 'ACTION2', data: {} },
    after.rows,
    next.rows
  );
  const restored = createPreparedEffects();
  restored.restore!(family.state!());
  const proposal = await restored.proposeInGroup!('explore', next.o, next.rows, [], 20);
  assert.equal(proposal?.experiment.phase, 'witnessedPreview');
  const read = proposal!.experiment.witnessedPreview!;
  assert.equal(read.basis, 'observed_in_previous_level');
  assert.equal(read.before, next.o.observation_ref);
  assert.deepEqual(read.indicated, [32, 6]);
  assert.equal(read.witness.before, before.o.observation_ref);
  const result = await scene(2, 4, [[16, 3]], null);
  const rec = await restored.record(next.o, result.o, q, next.rows, result.rows, proposal!, 0, []);
  assert.equal(rec?.events?.[0]?.result, 'preview_realized');
});
test('a reset or another campaign cannot supply a prior witness, and the next action can refute it', async () => {
  const a = await scene(1, 1, [[3, 4]], [11, 9]),
    b = await scene(1, 2, [[11, 9]], null),
    c = await scene(2, 3, [[7, 3]], [16, 7]);
  const mem = newPreviewLearning();
  observePreviewBindings(mem, a.o, b.o, a.layout, b.layout, 'ACTION6:11,9');
  assert.equal(carryPreviewBindings(mem, a.o, b.o), null);
  const carry = carryPreviewBindings(mem, b.o, c.o)!;
  assert.deepEqual(
    acceptPreviewCarry(carry, (await scene(2, 3, [[7, 3]], [16, 7], 'foreign')).o).bindings,
    {}
  );
  const inherited = acceptPreviewCarry(carry, c.o);
  assert.equal(
    offerWitnessedPreview(inherited, c.o, c.layout, new Set(['ACTION2']))?.command,
    'ACTION6:16,7'
  );
  const read = offerWitnessedPreview(inherited, c.o, c.layout, new Set(['ACTION6:16,7']))!;
  const miss = await scene(2, 4, [[7, 4]], [16, 7]);
  assert.equal(
    checkWitnessedPreview(inherited, read, c.o, miss.o, c.layout, miss.layout, 'ACTION5').status,
    'inapplicable'
  );
  assert.equal(
    checkWitnessedPreview(inherited, read, c.o, miss.o, c.layout, miss.layout, read.command).status,
    'contradicted'
  );
  assert.equal(offerWitnessedPreview(inherited, c.o, c.layout, new Set([read.command])), null);
});
test('another identical individual reaching the indicated site refutes the named arrival', async () => {
  const a = await scene(
      1,
      1,
      [
        [3, 4],
        [20, 4],
      ],
      [11, 9]
    ),
    b = await scene(
      1,
      2,
      [
        [11, 9],
        [20, 4],
      ],
      null
    );
  const mem = newPreviewLearning();
  observePreviewBindings(mem, a.o, b.o, a.layout, b.layout, 'ACTION5');
  const c = await scene(
      1,
      3,
      [
        [11, 9],
        [20, 4],
      ],
      [7, 14]
    ),
    d = await scene(
      1,
      4,
      [
        [11, 9],
        [7, 14],
      ],
      null
    );
  const forecast = offerWitnessedPreview(mem, c.o, c.layout, new Set(['ACTION5']))!;
  const answer = checkWitnessedPreview(mem, forecast, c.o, d.o, c.layout, d.layout, 'ACTION5');
  assert.equal(answer.status, 'contradicted');
  assert.deepEqual(answer.actual, [23, 19]);
});
test('a single command weighs all competing predictions using distinct prior images', async () => {
  const o1 = (await scene(1, 1, [[3, 4]], [11, 9])).o;
  const obs = (i: number) => ({
    ...o1,
    revision: i,
    frame_hash: 'f' + i,
    observation_ref: 'competition:epoch:1:revision:' + i + ':frame:f' + i,
  });
  const shape = (x: number, y: number) => ({
    at: [2 * x, 2 * y] as [number, number],
    box: [x, y, x, y],
    form: 'form',
  });
  const layout = (bad: number, good: number, m1: number, m2: number) => ({
    bad: [shape(bad, 2)],
    good: [shape(good, 8)],
    m1: [shape(m1, 2)],
    m2: [shape(m2, 8)],
  });
  const mem = newPreviewLearning(),
    a = layout(1, 2, 4, 6),
    b = layout(4, 6, 8, 9);
  observePreviewBindings(mem, obs(1), obs(2), a, b, 'ACTION5');
  const opts = new Set(['ACTION5']);
  assert.equal(offerWitnessedPreview(mem, obs(2), b, opts)!.actor, 'bad');
  const c = layout(4, 9, 11, 15);
  observePreviewBindings(mem, obs(2), obs(3), b, c, 'ACTION5');
  const next = offerWitnessedPreview(mem, obs(3), c, opts)!;
  assert.equal(next.actor, 'good');
  assert.equal(next.command, 'ACTION5');
  assert.equal(next.calibration!.hit, 1);
  assert.equal(Object.values(mem.bindings).find((x) => x.actor === 'bad')!.calibration!.miss, 1);
  const d = layout(5, 10, 12, 16);
  observePreviewBindings(mem, obs(3), obs(4), c, d, 'ACTION2');
  assert.equal(
    Object.values(mem.bindings).find((x) => x.actor === 'good' && x.gesture.op === 'ACTION5')!.calibration!
      .rivalMiss,
    1
  );
  observePreviewBindings(mem, obs(2), obs(3), b, c, 'ACTION5');
  assert.equal(
    Object.values(mem.bindings).find((x) => x.actor === 'good' && x.gesture.op === 'ACTION5')!.calibration!
      .hit,
    1
  );
  assert.equal(next.calibration!.rivalMiss, 0);
});
