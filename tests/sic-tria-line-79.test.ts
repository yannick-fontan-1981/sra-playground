import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_TRIA_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { RelativeArrangements }: typeof import('../src/logos-engine/v6-relative-arrangements.ts') =
  await import(moduleURL('src/logos-engine/v6-relative-arrangements.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_TRIA_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';


type Packet = ReturnType<typeof toV6PublicObservation>;

async function start(project: (observation: Packet) => Packet = observation => observation) {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = project(toV6PublicObservation(backend.dispatch({ type: 'load', code: 'TRIA', level: 1 }), sequence));
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    get observation() { return observation; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance() {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      observation = project(toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), ++sequence));
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

const points = [[28,20],[11,53],[4,29],[11,53],[25,53],[39,53],[7,53],[46,8],
  [3,57],[21,57],[35,57],[35,49],[3,53],[31,26],[7,49],[40,23]];
type RelativeOwner = InstanceType<typeof RelativeArrangements>;

function observeEffects(t: TestContext) {
  const original = RelativeArrangements.prototype.record;
  const records = new Map<number, Row>();
  t.mock.method(RelativeArrangements.prototype, 'record', function (this: RelativeOwner, ...args: Parameters<typeof original>) {
    const result = original.apply(this, args);
    records.set(args[0].revision, result);
    return result;
  });
  return records;
}

test('79 follows the relative goal, selection and measured actuator returns across official boards', async t => {
  const records = observeEffects(t);
  const game = await start();
  for (const [i, [x, y]] of points.entries()) {
    const turn = i + 1;
    const d = await game.decision(), plan = d.proposal.arrangement_plan;
    assert.deepEqual([d.family, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.admitted, d.guard.reason],
      ['relative_arrangements', 'public_relative_arrangement', 'ACTION6', { x, y }, true, 'current_arrangement_and_control_locus']);
    if (turn === 1) {
      assert.deepEqual([plan.offer.kind, plan.offer.move, plan.offer.goal.target.add],
        ['select_participant', { from: [8,6], to: [9,6], value: 9 }, [[9,6,9]]]);
    }
    if (turn === 3) assert.deepEqual(plan.offer.move, { from: [0,9], to: [12,9], value: 9 });
    if (turn === 8) assert.deepEqual(plan.offer.move, { from: [14,2], to: [13,10], value: 9 });
    if (turn === 12) assert.ok(plan.offer.model_evidence.length > 0);
    const outcome = await game.advance();
    assert.equal(outcome.matched, null);
    const event = records.get(turn)!;
    if (turn === 1 || turn === 3 || turn === 8) assert.equal(event.status, 'selection_observed');
    if (turn === 9) {
      assert.deepEqual([event.status, event.from, event.to, event.delta, event.object_value],
        ['single_object_and_actuator_displacement', [14,2], [13,3], [-1,1], 9]);
      assert.match(event.selection_ref, /:revision:9:/);
      assert.deepEqual(event.preserved_objects, [[12,9,9], [12,11,9]]);
    }
    if (turn === 2 || turn === 13) {
      assert.equal(event.status, 'official_boundary');
      assert.equal(game.observation.levelsCompleted, turn === 2 ? 1 : 2);
    }
  }
});

function overlayMovedParticipant(packet: Packet): Packet {
  if (packet.level !== 2) return packet;
  function move(raster: Packet['frame']) {
    const source = raster.slice(28, 31).flatMap(row => row.slice(3, 6));
    const target = raster.slice(28, 31).flatMap(row => row.slice(39, 42));
    if (!source.every(pixel => pixel === 9) || target.some(pixel => pixel !== target[0] || pixel === 9)) return raster;
    const result = raster.map(row => [...row]);
    for (const [i, value] of source.entries()) {
      const dx = i % 3, dy = Math.floor(i / 3);
      result[28 + dy][3 + dx] = target[i];
      result[28 + dy][39 + dx] = value;
    }
    return result;
  }
  return { ...packet, frame: move(packet.frame), frames: packet.frames.map(move) };
}

test('79 changes participant when another participant moves with its local appearance intact', async t => {
  const records = observeEffects(t);
  const game = await start(overlayMovedParticipant);
  for (let turn = 1; turn <= 2; turn++) {
    const d = await game.decision();
    assert.deepEqual(d.command.data, { x: points[turn - 1][0], y: points[turn - 1][1] });
    await game.advance();
  }
  assert.equal(game.observation.level, 2);
  assert.ok(game.observation.frame.slice(28, 31).flatMap(row => row.slice(39, 42)).every(pixel => pixel === 9));
  const first = await game.decision(), plan = first.proposal.arrangement_plan;
  assert.deepEqual([first.family, first.command.data, plan.offer.kind, plan.offer.move, plan.offer.goal.target.add],
    ['relative_arrangements', { x: 46, y: 8 }, 'select_participant', { from: [14,2], to: [13,10], value: 9 }, [[13,10,9]]]);
  assert.deepEqual(plan.projection.objects.map((item: Row) => [item.xy, item.value]), [[[14,2],9], [[12,9],9], [[12,11],9]]);
  assert.equal((await game.advance()).matched, null);
  assert.equal(records.get(3)?.status, 'selection_observed');

  const next = await game.decision();
  assert.deepEqual([next.family, next.command.data, next.proposal.arrangement_plan.offer.kind],
    ['relative_arrangements', { x: 3, y: 57 }, 'probe_actuator_relation']);
  await game.advance();
  const moved = records.get(4)!;
  assert.deepEqual([moved.status, moved.from, moved.to, moved.preserved_objects],
    ['single_object_and_actuator_displacement', [14,2], [13,3], [[12,9,9], [12,11,9]]]);
  assert.equal(game.observation.levelsCompleted, 1);
});
