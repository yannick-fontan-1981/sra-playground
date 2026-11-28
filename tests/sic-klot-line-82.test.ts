import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6Command, V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_KLOT_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { NativeSelectedRigid }: typeof import('../src/logos-engine/v6-selected-rigid.ts') =
  await import(moduleURL('src/logos-engine/v6-selected-rigid.ts'));
const { selectedRigidPoint, selectedRigidPoses, selectedRigidScene }: typeof import('../src/logos-engine/v6-selected-rigid-geometry.ts') =
  await import(moduleURL('src/logos-engine/v6-selected-rigid-geometry.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_KLOT_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code: 'KLOT', level: 1 }), sequence);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  async function continuation() {
    if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
    return reply;
  }
  return {
    get observation() { return observation; },
    continuation,
    async decision() {
      await continuation();
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance(returned?: V6PublicObservation) {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      sequence++;
      observation = returned ?? toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

type RigidOwner = InstanceType<typeof NativeSelectedRigid>;
type RigidRecord = NonNullable<ReturnType<RigidOwner['record']>>['events'][number];

function observeRecords(t: TestContext) {
  const original = NativeSelectedRigid.prototype.record;
  const records = new Map<number, RigidRecord>();
  t.mock.method(NativeSelectedRigid.prototype, 'record', function (this: RigidOwner, ...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    if (result) records.set(args[0].revision, result.events[0]);
    return result;
  });
  return records;
}

test('82 learns a receiver from its actual move and binds the same direction to two further selections', async t => {
  const records = observeRecords(t);
  const game = await start();
  const expected = [
    ['ACTION6', { x: 28, y: 31 }], ['ACTION4', undefined], ['ACTION3', undefined],
    ['ACTION4', undefined], ['ACTION2', undefined], ['ACTION6', { x: 20, y: 31 }],
    ['ACTION1', undefined], ['ACTION6', { x: 20, y: 39 }], ['ACTION1', undefined],
  ];
  const poses = new Map<number, ReturnType<typeof selectedRigidPoses>>();
  const verdicts = new Map<number, boolean | null>();
  for (const [i, exact] of expected.entries()) {
    const turn = i + 1;
    const decision = await game.decision();
    const plan = decision.proposal.selected_rigid_plan;
    const entering = selectedRigidScene(game.observation.frame, plan.scene);
    assert.ok(entering);
    assert.deepEqual([decision.command.actionRef, turn === 1 || turn === 6 || turn === 8 ? decision.command.data : undefined], exact);
    assert.deepEqual([decision.family, decision.proposal.kind, decision.guard.admitted, decision.guard.reason],
      ['selected_rigid', 'selected_rigid', true, 'current_rigid_support_and_conditional_path']);
    poses.set(turn, selectedRigidPoses(entering));
    const result = await game.advance();
    verdicts.set(turn, result.matched);
    assert.equal(game.observation.levelsCompleted, 0);
    if (turn === 9) {
      const final = selectedRigidScene(game.observation.frame, plan.scene);
      assert.ok(final);
      poses.set(10, selectedRigidPoses(final));
    }
  }

  for (const [turn, key, changedPixels, models] of [[1, '11', true, 24], [6, '6', true, 1], [8, '12', true, 1]] as const) {
    const { detail, state } = records.get(turn)!;
    assert.notEqual(state.active, null);
    assert.deepEqual([state.scene.bodies[state.active!].key, detail.selection_pixels_changed, detail.role_status, detail.compatible_model_count],
      [key, changedPixels, 'selected_receiver_hypothesis', models]);
    assert.deepEqual(poses.get(turn), poses.get(turn + 1), 'The selection decoration leaves every rigid pose unchanged');
    assert.equal(verdicts.get(turn), true, 'The guard checked the pose, while the receiver is still hypothetical');
  }
  for (const [turn, key, from, to, models, verdict] of [
    [2, '11', [1, 3], [2, 3], 6, null], [7, '6', [0, 3], [0, 2], 1, true], [9, '12', [0, 4], [0, 3], 1, true],
  ] as const) {
    const { detail, state } = records.get(turn)!;
    assert.notEqual(state.active, null);
    const active = state.active!;
    assert.equal(state.scene.bodies[active].key, key);
    assert.deepEqual(poses.get(turn)![active], from);
    const predicted = poses.get(turn)!.map((pose, index) => index === active ? [...to] : pose);
    assert.deepEqual(poses.get(turn + 1), predicted, 'Exactly the selected receiver moves');
    assert.deepEqual([detail.moved, detail.role_status, detail.compatible_model_count, verdicts.get(turn)],
      [true, 'observed_exclusive_receiver', models, verdict]);
    assert.match(detail.before, new RegExp(':revision:' + turn + ':'));
    assert.match(detail.after, new RegExp(':revision:' + (turn + 1) + ':'));
  }
});

test('82 without the selection event reissues the click against the same current rigid observation', async t => {
  const records = observeRecords(t);
  const original = NativeSelectedRigid.prototype.propose;
  let withdrawn = false;
  t.mock.method(NativeSelectedRigid.prototype, 'propose', async function (this: RigidOwner, ...args: Parameters<typeof original>) {
    if (args[0].level_epoch !== 1 || args[0].revision !== 2 || withdrawn) return original.apply(this, args);
    const source = this.sourceState();
    assert.equal(source.events.length, 1);
    assert.equal(source.events[0].state.active, 4);
    assert.equal(source.events[0].detail.after, args[0].observation_ref);
    withdrawn = true;
    this.restoreSourceState({ format: source.format, events: [] });
    try {
      return await original.apply(this, args);
    } finally {
      this.restoreSourceState(source);
    }
  });
  const game = await start();
  assert.equal((await game.decision()).command.actionRef, 'ACTION6');
  await game.advance();
  const before = game.observation;
  const replacement = await game.decision();
  assert.ok(withdrawn);
  assert.equal(game.observation, before);
  assert.deepEqual([replacement.family, replacement.proposal.selected_rigid_plan.mode, replacement.guard.admitted,
    replacement.command.actionRef, replacement.command.data],
  ['selected_rigid', 'select', true, 'ACTION6', { x: 28, y: 31 }]);
  await game.advance();
  assert.equal(records.get(2)?.detail.role_status, 'selected_receiver_hypothesis');
  const resumed = await game.decision();
  assert.deepEqual([resumed.command.actionRef, resumed.proposal.selected_rigid_plan.mode], ['ACTION4', 'probe']);
  await game.advance();
  assert.deepEqual([records.get(3)?.detail.role_status, records.get(3)?.detail.compatible_model_count], ['observed_exclusive_receiver', 6]);
});

for (const [turn, selected, foreign] of [[7, '6', '11'], [9, '12', '6']] as const) {
  test('82 identifies the foreign receiver in the authentic T' + turn + ' return', async t => {
    const records = observeRecords(t);
    const game = await start();
    const prefix: V6Command[] = [];
    for (let i = 1; i < turn; i++) {
      prefix.push((await game.decision()).command);
      await game.advance();
    }

    const decision = await game.decision();
    const plan = decision.proposal.selected_rigid_plan;
    const before = selectedRigidScene(game.observation.frame, plan.scene);
    assert.ok(before);
    assert.deepEqual([decision.family, decision.command.actionRef, before.bodies[plan.active].key], ['selected_rigid', 'ACTION1', selected]);
    assert.equal(prefix.at(-1)?.actionRef, 'ACTION6');

    const alternate = await sourceBackend(assetRoot);
    alternate.dispatch({ type: 'load', code: 'KLOT', level: 1 });
    for (const { actionRef, data } of prefix.slice(0, -1)) {
      const actionId = Number(actionRef.slice(6));
      alternate.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) });
    }
    const other = before.bodies.findIndex(body => body.key === foreign);
    assert.ok(other >= 0);
    const point = selectedRigidPoint(before, other);
    if (turn === 9) assert.deepEqual(point, { x: 20, y: 23 });
    const alternateBefore = alternate.dispatch({ type: 'action', actionId: 6, data: point });
    const alternateAfter = alternate.dispatch({ type: 'action', actionId: 1 });
    const alteredBefore = selectedRigidScene(alternateBefore.frame, plan.scene);
    const alteredAfter = selectedRigidScene(alternateAfter.frame, plan.scene);
    assert.ok(alteredBefore && alteredAfter);
    assert.deepEqual(selectedRigidPoses(alteredBefore), selectedRigidPoses(before));
    const measured = selectedRigidPoses(alteredAfter);
    const changed = selectedRigidPoses(before).flatMap((pose, index) =>
      pose[0] === measured[index][0] && pose[1] === measured[index][1] ? [] : [before.bodies[index].key]);
    assert.deepEqual(changed, [foreign]);

    const compared = await game.advance(toV6PublicObservation(alternateAfter, turn));
    const event = records.get(turn)!;
    assert.deepEqual([compared.matched, event.state.scene.bodies[event.state.active!].key, event.detail.moved, event.models.length,
      event.detail.role_status], [false, selected, true, 0, 'observed_exclusive_receiver']);
    assert.match(event.detail.before, new RegExp(':revision:' + turn + ':'));
    assert.match(event.detail.after, new RegExp(':revision:' + (turn + 1) + ':'));
    const final = await game.continuation();
    assert.deepEqual([final.kind, final.reason, final.ticket], ['stopped', 'rigid_control_or_collision_model_refuted', null]);
  });
}
