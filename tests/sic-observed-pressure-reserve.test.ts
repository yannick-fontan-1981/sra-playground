import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeCommand } from '../src/logos-engine/v6-native-types.ts';
import { createGameDispatcher } from '../src/runtime/native-game-dispatcher.ts';
import { createSicPublicInputExploration } from '../src/sic/public-input-exploration.ts';
import { assessPressurePlan, choosePressureReserve, observePressureReserve, retainPressureReserve,
  type PressurePlan, type PressureReserve } from '../src/sic/observed-pressure-reserve.ts';
import { annotateTravelMarks, observedTravelActor, observeTravel, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';

test('a proved shortage restores a weight when the crossing is observed before gate closure', async context => {
  await verifyPressureRecovery(context, {
    opening: [1, 2, 3, 4, 2, 4, 1, 1, 1, 1, 3, 3, 3],
    trigger: 2,
    gateClosedAt: 14,
    crossingAt: 6,
  });
});

test('a proved shortage restores a weight when gate closure is observed before the crossing', async context => {
  await verifyPressureRecovery(context, {
    opening: [1, 3, 1, 1, 3, 2, 4, 2, 2, 2, 4],
    trigger: 4,
    gateClosedAt: 6,
    crossingAt: 12,
  });
});

async function verifyPressureRecovery(context: TestContext, { opening, trigger, gateClosedAt, crossingAt }: {
  opening: readonly number[];
  trigger: number;
  gateClosedAt: number;
  crossingAt: number;
}) {
  const game = createGameDispatcher(async () => { throw new Error('Expected a native game'); });
  let board = await game.dispatch({ type: 'load', code: 'SS05', level: 1 });
  let travel: ObservedTravel | undefined, model: PressureReserve | undefined, sequence = 0;
  const recolored = gateClosedAt < crossingAt;
  const picture = (rows: typeof board.frame) => recolored ? rows.map(row => row.map(ink => (ink + 5) % 16)) : rows;
  const input = (id: number): NativeCommand => ({ action_ref: `ACTION${id}`, data: {} });
  const inputs = board.availableActionIds.map(input);
  const family = createSicPublicInputExploration();
  const initialFamily = family.state();
  const recoveryPlans: PressurePlan[] = [];
  const observation = (rows: typeof board.frame) => measureNativeObservation({
    frame_rows: rows, frame_hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    level: board.level, levels_completed: board.levelsCompleted, state: board.state,
    available_action_refs: inputs.map(command => command.action_ref),
  }, sequence + 1, 'pressure-recovery');

  async function move(command: NativeCommand, plan?: PressurePlan) {
    const before = picture(board.frame), ref = `return:${++sequence}`;
    board = await game.dispatch({ type: 'action', actionId: Number(command.action_ref.slice(6)) });
    if (board.levelsCompleted) return;
    const after = picture(board.frame);
    if (plan && model && travel) assert.equal(assessPressurePlan(model, travel, after, plan), true);
    travel = annotateTravelMarks(observeTravel(travel, before, after, command, ref), before);
    model = observePressureReserve(model, travel, before, after, command, ref, plan);
  }
  for (const action of opening) {
    await move(input(action));
    assert.equal(model?.shortage, undefined);
  }
  assert.ok(model?.gate && travel);
  const release = choosePressureReserve(model, travel, picture(board.frame), inputs);
  if (gateClosedAt > crossingAt) {
    assert.equal(release?.goal, 'verify_gate_release');
    assert.equal(release?.command.action_ref, input(trigger).action_ref);
  } else {
    assert.equal(release, undefined);
  }
  await move(input(trigger), release);
  assert.equal(model?.gate?.closedRef, `return:${gateClosedAt}`);
  assert.equal(model?.bridge?.ref, `return:${crossingAt}`);
  assert.equal(model?.shortage, `return:${sequence}`);

  board = await game.dispatch({ type: 'reset' });
  model = retainPressureReserve(model!);
  assert.equal(model.shortage, undefined);
  const actor = observedTravelActor(travel, picture(board.frame))!;
  travel = { ...travel, actor, visited: [actor], supports: [], tested: {}, altered: [], controls: [], completed: [], switches: {}, stalled: 0 };
  assert.equal(choosePressureReserve({ ...model, gate: { ...model.gate!, closedRef: undefined } },
    travel, picture(board.frame), inputs), undefined);
  let crossed = false;
  let checkedContradiction = false;
  const goals = new Set<PressurePlan['goal']>();
  for (let i = 0; i < 45 && !board.levelsCompleted; i++) {
    const before = picture(board.frame), observedBefore = await observation(before);
    const evidence = model!.refs.slice();
    const plan = choosePressureReserve(model, travel, before, inputs);
    assert.ok(plan);
    family.restore({ ...initialFamily, epoch: observedBefore.level_epoch, pressureReserve: model, travel });
    const proposal = await family.propose(observedBefore, before, inputs, 45 - i);
    assert.ok(proposal?.pressurePlan);
    assert.deepEqual(proposal.pressurePlan, plan);
    assert.deepEqual(proposal.actions, [plan.command]);
    goals.add(plan.goal);
    recoveryPlans.push(plan);
    if (plan.goal === 'cross_to_exit') {
      assert.ok(plan.expected.pieces.includes(model!.gate!.mark));
      crossed ||= plan.expected.supports.includes(plan.expected.actor);
    }
    const previous = model!, travelBefore = travel;
    await move(plan.command, plan);
    if (!board.levelsCompleted) {
      const after = picture(board.frame), observedAfter = await observation(after);
      const confirmed = await family.after(proposal, 0, observedBefore, observedAfter, before, after);
      assert.equal(confirmed.matched, true);
      assert.equal(confirmed.seal_prefix, true);
      assert.equal(confirmed.reason, 'pressure_projection_confirmed');
      if (!checkedContradiction) {
        const altered = { ...plan, expected: { ...plan.expected, actor: observedTravelActor(travelBefore, before)! } };
        const contradicted = await family.after({ ...proposal, pressurePlan: altered }, 0, observedBefore, observedAfter, before, after);
        assert.equal(contradicted.matched, false);
        assert.equal(contradicted.seal_prefix, true);
        assert.equal(contradicted.reason, 'pressure_projection_contradicted');
        const refused = observePressureReserve(previous, travelBefore, before, after, plan.command, observedAfter.observation_ref, altered);
        assert.ok(refused);
        assert.deepEqual(refused.refs, evidence);
        assert.equal(refused.refused.length, previous.refused.length + 1);
        assert.notEqual(choosePressureReserve(refused, travelBefore, before, inputs)?.command.action_ref, plan.command.action_ref);
        checkedContradiction = true;
      }
    }
    assert.equal(model?.shortage, undefined);
  }
  assert.ok(crossed && checkedContradiction);
  assert.deepEqual([...goals], ['reserve_weight', 'build_crossing', 'cross_to_exit']);
  assert.equal(board.levelsCompleted, 1);
  context.diagnostic(JSON.stringify({ gateClosedAt, crossingAt, recolored, actions: recoveryPlans.length, goals: [...goals],
    commandsSHA256: createHash('sha256').update(JSON.stringify(recoveryPlans.map(plan => plan.command.action_ref))).digest('hex'),
    projectionsSHA256: createHash('sha256').update(JSON.stringify(recoveryPlans)).digest('hex') }));
}
