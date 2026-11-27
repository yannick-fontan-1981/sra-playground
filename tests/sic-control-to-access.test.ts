import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativeObservation, NativePoint, NativeProposal, NativePublicObservation, NativeRows } from '../src/logos-engine/v6-native-types.ts';
import { createSicCavityAccess } from '../src/sic/cavity-access.ts';
import { createSicReceptionAccess } from '../src/sic/reception-access.ts';
import { createSicVerifyRemoteReplay } from '../src/sic/replay-access.ts';
import { createNativeV6Runtime, type NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { defaultRecoveryPack } from '../src/sic/active-recovery.ts';

function fixture(name: string) {
  return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString());
}

function decision<P extends NativeProposal>(proposal: P | null) {
  assert.ok(proposal);
  return proposal as P & { sicLocalDecision: { strategy: string }; route_refs: string[] };
}

type View = { observation: NativeObservation; public: NativePublicObservation };
const inputs = (view: View) => view.observation.available_action_refs.map(action_ref => ({ action_ref, data: {} }));

async function withDifferentReturn(view: View, rows: NativeRows): Promise<View> {
  const packet = { ...view.public, frame_rows: rows, frame_packet: [rows], frame_hash: await publicFrameHash(rows) };
  const scope = view.observation.observation_ref.split(':epoch:')[0]!;
  return { public: packet, observation: await measureNativeObservation(packet, view.observation.revision, scope) };
}

function recordProbe<P extends NativeProposal>(family: NativeFamily<P>, proposal: P, before: View, after: View) {
  return family.record(before.observation, after.observation, proposal.actions[0]!, before.public.frame_rows,
    after.public.frame_rows, proposal, 0, after.public.frame_packet);
}

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
      const original = structuredClone(replay.state());
      const actor = after.observation.entities.find(entity => entity.signature === saved().state.scene.body.signature)!;
      const rows = after.public.frame_rows.map(row => [...row]);
      for (const [dx, dy] of actor.mask) {
        rows[8 + dy]![20 + dx] = 5;
        rows[8 + dy]![26 + dx] = actor.palette_value;
      }
      const overshoot = await withDifferentReturn(after, rows);
      const subjects = overshoot.observation.entities.filter(entity => entity.signature === actor.signature);
      assert.deepEqual(subjects.map(entity => entity.position), [[26, 8]]);
      await recordProbe(replay, trial, before, overshoot);
      assert.equal(saved().state.controls.ACTION4, undefined);
      assert.equal(saved().state.controlEvidence?.ACTION4, undefined);
      assert.equal(decision(await offer(overshoot)).sicLocalDecision.strategy, 'P05');
      replay.restore(original);
      const repainted = after.public.frame_rows.map(row => [...row]);
      for (const [dx, dy] of actor.mask) repainted[8 + dy]![20 + dx] = 14;
      const other = await withDifferentReturn(after, repainted);
      assert.ok(other.observation.entities.every(entity => entity.signature !== actor.signature));
      await recordProbe(replay, trial, before, other);
      assert.equal(saved().state.controls.ACTION4, undefined);
      assert.equal(await offer(other), null);
      replay.restore(original);
    }
    await recordProbe(replay, trial, before, after);
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

function receptionPrefix() {
  const url = new URL('../docs/diagnostics/sic-reception-transfer-20261127/fogw-arrival-boundary-a10dde47.json.gz', import.meta.url);
  type Entry = { action: { id: number }; plan: { family: string; strategy: string }; nativeObservation: NativeObservation;
    publicBefore: Omit<V6PublicObservation, 'stepIndex'> };
  return JSON.parse(gunzipSync(readFileSync(url)).toString()).publicEvidence.slice(0, 5) as Entry[];
}

test('FOGW learns the carrier’s single step before using it to reach a support', async () => {
  const entries = receptionPrefix();
  const views: View[] = entries.map(({ nativeObservation: obs, publicBefore }, index) => ({
    observation: obs, public: { frame_rows: publicBefore.frame, frame_packet: publicBefore.frames,
      level: obs.level_epoch, levels_completed: obs.levels_completed, state: obs.state, step_index: index,
      available_action_refs: obs.available_action_refs, frame_hash: obs.frame_hash },
  }));
  const family = createSicReceptionAccess();
  const offer = (v: View) => family.propose(v.observation, v.public.frame_rows, inputs(v), 20);
  const saved = () => family.state() as { state: { controls: Record<string, NativePoint>; evidence: string[] } };
  for (const [index, action] of ['ACTION1', 'ACTION2', 'ACTION4'].entries()) {
    const before = views[index]!, after = views[index + 1]!;
    const trial = decision(await offer(before));
    assert.equal(trial.kind, entries[index]!.plan.family);
    assert.equal(trial.sicLocalDecision.strategy, 'P05');
    assert.deepEqual(trial.actions[0], { action_ref: action, data: {} });
    if (index === 2) {
      const original = structuredClone(family.state());
      // Attribute the real arrival two steps away to this single command.
      const overshoot = await withDifferentReturn(after, views[4]!.public.frame_rows);
      await recordProbe(family, trial, before, overshoot);
      assert.equal(saved().state.controls.ACTION4, undefined);
      assert.ok(saved().state.evidence.includes(overshoot.observation.observation_ref));
      const retry = decision(await offer(overshoot));
      assert.deepEqual(retry.from, [38, 42]);
      assert.equal(retry.sicLocalDecision.strategy, 'P05');
      family.restore(original);
      const repainted = after.public.frame_rows.map(row => [...row]);
      assert.notEqual(repainted[42]![34], 14);
      for (const dy of [0, 3]) for (const dx of [0, 3]) repainted[42 + dy]![34 + dx] = 14;
      const other = await withDifferentReturn(after, repainted);
      await recordProbe(family, trial, before, other);
      assert.deepEqual(saved().state.controls.ACTION4, [4, 0]);
      assert.equal(decision(await offer(other)).sicLocalDecision.strategy, 'P07');
      family.restore(original);
    }
    await recordProbe(family, trial, before, after);
    if (index < 2) assert.deepEqual(saved().state.controls, {});
  }

  const current = views[3]!, ref = current.observation.observation_ref;
  assert.deepEqual(saved().state.controls.ACTION4, [4, 0]);
  const route = decision(await offer(current));
  assert.equal(route.kind, 'sic_reception_access');
  assert.equal(route.sicLocalDecision.strategy, entries[3]!.plan.strategy);
  assert.equal(route.sicLocalDecision.strategy, 'P07');
  assert.deepEqual(route.actions[0], { action_ref: 'ACTION' + entries[3]!.action.id, data: {} });
  assert.deepEqual(route.steps?.[0]?.expected_after, [38, 42]);
  assert.ok(route.route_refs.includes(ref));
  assert.equal((await family.before(route, 0, current.public, current.observation)).admitted, true);
  assert.equal((await family.before(route, 0, views[4]!.public, views[4]!.observation)).admitted, false);

  // Place a second copy of the four-corner carrier on the next free cell.
  const two = current.public.frame_rows.map(row => [...row]);
  for (const dy of [0, 3]) for (const dx of [0, 3]) two[42 + dy]![38 + dx] = two[42 + dy]![34 + dx]!;
  const ambiguous = await withDifferentReturn(current, two);
  const recovery = decision(await offer(ambiguous));
  assert.equal(recovery.from, null);
  assert.equal(recovery.sicLocalDecision.strategy, 'P05');
  assert.deepEqual(recovery.actions[0], { action_ref: 'ACTION3', data: {} });

  const withoutVector = structuredClone(saved());
  delete withoutVector.state.controls.ACTION4;
  family.restore(withoutVector);
  const probe = decision(await offer(current));
  assert.equal(probe.sicLocalDecision.strategy, 'P05');
  assert.ok(probe.route_refs.includes(ref));
});

test('the native SIC pack selects the four recorded FOGW tickets from public observations', async () => {
  const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
  const declarations: NativeV6Declarations = {
    common: JSON.parse(readFileSync(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
    strategy: JSON.parse(readFileSync(new URL('morphology_policy/strategy.drm', source), 'utf8')),
  };
  const service = new V6AgentService(recovery => createNativeV6Runtime(declarations, { recovery }));
  const sessionId = 'fogw-four-tickets';
  let ticketId = '';
  for (const [sequence, entry] of receptionPrefix().slice(0, 4).entries()) {
    const observation = { ...entry.publicBefore, palette: entry.nativeObservation.palette, stepIndex: sequence };
    let reply = await service.handle(sequence === 0
      ? { type: 'init', sessionId, sequence: 0, observation, recovery: { ...defaultRecoveryPack, solver: 'sic' },
        budgets: { targetLevels: 1, levelActionCaps: [80] } }
      : { type: 'advance', sessionId, sequence, ticketId, executionMs: 1, observation });
    if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.actionRef, 'ACTION' + entry.action.id);
    assert.equal(reply.snapshot.proposal?.kind, entry.plan.family);
    assert.equal(reply.snapshot.proposal?.sicLocalDecision?.strategy, entry.plan.strategy);
    ticketId = reply.ticket.id;
  }
});
