import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeObservation, NativePoint, NativeProposal, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { createSicCavityAccess } from '../src/sic/cavity-access.ts';
import { createSicVerifyRemoteReplay } from '../src/sic/replay-access.ts';

function fixture(name: string) {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString());
}

function decision<P extends NativeProposal>(proposal: P | null) {
  assert.ok(proposal);
  return proposal as P & { sicLocalDecision: { strategy: string }; route_refs: string[] };
}

type View = { observation: NativeObservation; public: NativePublicObservation };
const inputs = (view: View) => view.observation.available_action_refs.map(action_ref => ({ action_ref, data: {} }));

test('AS66 measures ACTION2 before the last probe and reuses its direction on the fourth ticket', async () => {
  const steps: { before: View; after: View; remaining: number }[] =
    fixture('v6-sliding-cavity-reference.json.gz').games.find((game: { code: string }) => game.code === 'AS66').steps;
  const cavity = createSicCavityAccess();
  const offer = (turn: number) => {
    const { before, remaining } = steps[turn - 1]!;
    return cavity.propose(before.observation, before.public.frame_rows, inputs(before), remaining);
  };
  const actions = ['ACTION1', 'ACTION2', 'ACTION3'];
  for (const [index, action] of actions.entries()) {
    const { before, after } = steps[index]!;
    const trial = decision(await offer(index + 1));
    assert.equal(trial.sicLocalDecision.strategy, 'learn_slide_control');
    assert.deepEqual(trial.actions[0], { action_ref: action, data: {} });
    if (index === 2) {
      // Counterfactual: ask at the fourth board before acquiring the third return.
      const next = decision(await offer(4));
      assert.equal(next.sicLocalDecision.strategy, 'follow_measured_slide');
      assert.deepEqual(next.actions[0], { action_ref: 'ACTION2', data: {} });
    }
    await cavity.record(before.observation, after.observation, trial.actions[0]!, before.public.frame_rows,
      after.public.frame_rows, trial, 0, after.public.frame_packet);
  }
  const measured = steps[1]!.after.observation.observation_ref, current = steps[3]!.before.observation.observation_ref;
  const state = cavity.state() as { body: unknown; directions: Record<string, unknown>; stop: { claim_ref: string } };
  assert.deepEqual(state.body, [8, 4, 4]);
  assert.deepEqual(state.directions.ACTION2, { action: 'ACTION2', delta: [1, 0], ref: measured });
  const route = decision(await offer(4));
  assert.equal(route.sicLocalDecision.strategy, 'follow_measured_slide');
  assert.deepEqual(route.actions[0], { action_ref: 'ACTION2', data: {} });
  assert.ok(route.route_refs.includes(measured));
  assert.equal(route.binding?.observation_ref, current);
  const fourth = steps[3]!.before;
  assert.equal((await cavity.before(route, 0, fourth.public, fourth.observation)).admitted, true);
  const earlier = steps[1]!.before; // ACTION2 was already available on this board.
  assert.equal((await cavity.before(route, 0, earlier.public, earlier.observation)).admitted, false);
  // Keep the same board, the proved stop (which cites the same return), and every other measurement.
  assert.equal(state.stop.claim_ref, measured);
  const withoutDirection = structuredClone(state);
  delete withoutDirection.directions.ACTION2;
  cavity.restore(withoutDirection);
  const alternative = decision(await offer(4));
  assert.equal(alternative.sicLocalDecision.strategy, 'learn_slide_control');
  assert.ok(alternative.route_refs.includes(measured));
});

test('G50T acquires the carrier displacement on the fifth probe and binds the next walk to its return', async () => {
  const sample = fixture('sic-replay-control-g50t-l1.json.gz');
  const views: View[] = await Promise.all(sample.frames.map(async (rows: NativeRows, index: number) => {
    const packet: NativePublicObservation = { frame_rows: rows, frame_packet: [rows], level: sample.level,
      levels_completed: sample.levelsCompleted, state: sample.state, step_index: index, frame_hash: await publicFrameHash(rows),
      available_action_refs: sample.availableActionIds.map((id: number) => 'ACTION' + id) };
    return { public: packet, observation: await measureNativeObservation(packet, index + 1, 'g50t') };
  }));
  const replay = createSicVerifyRemoteReplay();
  const saved = () => replay.state() as { state: { controls: Record<string, NativePoint>;
    controlEvidence?: Record<string, string>; scene: { body: { signature: string } } } };
  await replay.attachPrograms!(new NativeKnowledgeStore('test-source', 'g50t'));
  const offer = (view: View) => replay.propose(view.observation, view.public.frame_rows, inputs(view), 20);
  for (const [index, action] of ['ACTION1', 'ACTION2', 'ACTION1', 'ACTION3', 'ACTION4'].entries()) {
    const before = views[index]!, after = views[index + 1]!;
    const trial = decision(await offer(before));
    assert.equal(trial.sicLocalDecision.strategy, 'P05');
    assert.deepEqual(trial.actions[0], { action_ref: action, data: {} });
    if (index === 4) {
      const guard = await replay.after(trial, 0, before.observation, after.observation, before.public.frame_rows, after.public.frame_rows);
      assert.equal(guard.matched, null);
    }
    await replay.record(before.observation, after.observation, trial.actions[0]!, before.public.frame_rows,
      after.public.frame_rows, trial, 0, after.public.frame_packet);
    const { state } = saved();
    if (index === 0) assert.equal(state.controlEvidence?.ACTION1, undefined);
    if (index === 2) assert.equal(state.controlEvidence?.ACTION1, after.observation.observation_ref);
  }
  const current = views[5]!, ref = current.observation.observation_ref;
  const route = decision(await offer(current));
  assert.equal(route.sicLocalDecision.strategy, 'P07');
  assert.deepEqual(route.actions[0], { action_ref: 'ACTION4', data: {} });
  assert.deepEqual(route.steps?.[0]?.expected_after, [26, 8]);
  assert.deepEqual(saved().state.controls.ACTION4, [6, 0]);
  assert.equal(saved().state.controlEvidence?.ACTION4, ref);
  assert.ok(route.route_refs.includes(ref));
  assert.equal((await replay.before(route, 0, current.public, current.observation)).admitted, true);
  const newer = await measureNativeObservation(current.public, current.observation.revision + 1, 'g50t');
  assert.equal((await replay.before(route, 0, current.public, newer)).admitted, false);
  const signature = saved().state.scene.body.signature;
  const carrier = current.observation.entities.find(entity => entity.signature === signature);
  assert.ok(carrier);
  const twoCarriers = current.public.frame_rows.map(row => [...row]);
  for (const [x, y] of carrier.mask) twoCarriers[8 + y]![26 + x] = carrier.palette_value;
  const changed = { ...current.public, frame_rows: twoCarriers, frame_packet: [twoCarriers], frame_hash: await publicFrameHash(twoCarriers) };
  const ambiguous = await measureNativeObservation(changed, newer.revision, 'g50t');
  assert.equal(ambiguous.entities.filter(entity => entity.signature === signature).length, 2);
  assert.equal(await offer({ public: changed, observation: ambiguous }), null);

  const withoutVector = structuredClone(saved());
  const withoutReceipt = structuredClone(saved());
  delete withoutReceipt.state.controlEvidence?.ACTION4;
  replay.restore(withoutReceipt);
  assert.equal(decision(await offer(current)).sicLocalDecision.strategy, 'P07');
  delete withoutVector.state.controls.ACTION4;
  assert.equal(withoutVector.state.controlEvidence?.ACTION4, ref);
  replay.restore(withoutVector);
  const alternative = decision(await offer(current));
  assert.equal(alternative.sicLocalDecision.strategy, 'P05');
  assert.ok(alternative.route_refs.includes(ref));
});
