import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_RE86_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { ConstellationCover, ConstellationEvidence }: typeof import('../src/logos-engine/v6-constellation-cover.ts') =
  await import(moduleURL('src/logos-engine/v6-constellation-cover.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gz = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gz('../docs/migration/native-campaigns-v54/baseline-re86/re86-public-trace.json.gz').packets;
const alternative = gz('./fixtures/sic-re86-alternate-returns.json.gz');
const sessionId = 'sra-v6-' + alternative.session;
const cover = 'constellation_cover';

function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_RE86_GAME_ROOT ? await sourceBackend(process.env.SIC_RE86_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official RE86 return ' + n);
    return { ...actual, palette };
  }
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'RE86', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([reply.snapshot.lastDecision, p.kind, p.program_subquestion, guard.admitted, guard.reason],
        [cover, 'controlled_constellation_cover', 'controlled_constellation_cover', true, 'bind_control_focus_and_registered_composite']);
      return { p, step: p.steps[guard.index], model: p.constellation_plan, action: reply.command!.actionRef };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const observed = observe({ type: 'action', actionId: Number(reply.command!.actionRef.slice(6)) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation: observed });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
test('7 from cold probes to a two-owner cover, then a second owner selection and official progression', async t => {
  const record = t.mock.method(ConstellationEvidence.prototype, 'record'), game = await start(30, true);
  const refs = new Map<number, string>(), acquired = new Map<number, Row>();
  for (let n = 1; n <= 27; n++) {
    const d = await game.decision();
    assert.equal(d.action, archive[n].command.action_ref);
    if (n === 1) assert.deepEqual([d.step.mode, d.step.expected_after, d.model.acquired_bodies, d.model.control_vectors, d.model.selector],
      ['acquire', null, 0, {}, null]);
    if (n <= 8) assert.equal(d.model.ownership_complete, false);
    if (n === 9 || n === 21) {
      const poses = n === 9 ? [[36, 45], [18, 24]] : [[48, 24], [18, 24]];
      assert.deepEqual([d.model.acquired_bodies, d.model.ownership_complete, d.model.active, d.step.mode, d.step.poses],
        [2, true, n === 9 ? 0 : 1, 'move', poses]);
      assert.ok(d.p.question.hypothesis_refs.includes(refs.get(n - 1)));
    }
    if (n === 20) assert.deepEqual([d.action, d.step.mode, d.step.expected_after, d.model.selector], ['ACTION5', 'cycle', null, 'ACTION5']);
    if (n === 27) assert.deepEqual([d.model.acquired_bodies, d.model.ownership_complete, d.step.mode], [0, false, 'acquire']);
    const mark = record.mock.callCount(), out = await game.advance();
    refs.set(n, out.observation_ref);
    for (const call of record.mock.calls.slice(mark)) {
      const event = await call.result!;
      const [turn] = [...refs].find(([, ref]) => ref === event.ref) ?? [];
      if (turn !== undefined) acquired.set(turn, event);
    }
    if (n <= 8) assert.equal(out.matched, null);
    if (n >= 9 && n <= 25 && n !== 20) assert.deepEqual([out.matched, out.reason], [true, 'compare_frozen_joint_supports']);
    if (n === 26) assert.deepEqual([out.matched, out.reason, packet(n).levelsCompleted], [null, 'official_boundary', 1]);
  }
  assert.deepEqual([1, 2, 3, 4].map(n => acquired.get(n)!.measured_vector), [[0, -3], [0, 3], [-3, 0], [3, 0]]);
  assert.deepEqual(acquired.get(4)!.acquired_supports.map((s: Row) => [s.owner, s.palette_value, s.relative_support_pixels.length]), [[0, 9, 53]]);
  assert.deepEqual(acquired.get(8)!.acquired_supports.map((s: Row) => [s.owner, s.palette_value, s.relative_support_pixels.length]), [[1, 11, 45]]);
  assert.ok(acquired.get(8)!.acquired_supports[0].evidence_refs.includes(refs.get(8)));
  assert.deepEqual([5, 8, 20].map(n => acquired.get(n)!.selection_local_occlusion_observed), [true, true, true]);
  assert.equal(acquired.get(26)!.status, 'official_boundary');
});
test('7 an unchanged return for the first probe advances exploration without adding a vector or support', async t => {
  const record = t.mock.method(ConstellationEvidence.prototype, 'record'), game = await start(16);
  const first = await game.decision();
  assert.equal(first.action, 'ACTION1');
  const frame = packet(0).frame, out = await game.advance({ ...packet(1), frame, frames: [frame] });
  const call = record.mock.calls.at(-1)!, event = await call.result!;
  assert.deepEqual([event.ref, event.measured_vector, event.acquired_bodies, out.matched],
    [out.observation_ref, undefined, 0, null]);
  const next = await game.decision();
  assert.deepEqual([next.action, next.model.control_vectors, next.step.mode], ['ACTION2', {}, 'acquire']);
});
test('7 the live provider consumes the alternate initial command and covers from a different registered owner pose', async t => {
  const propose = ConstellationCover.prototype.propose;
  t.mock.method(ConstellationCover.prototype, 'propose', function (this: ConstellationCover, ...args: Parameters<typeof propose>) {
    const [observation, rows, inputs, remaining] = args;
    if (observation.revision !== 1) return propose.apply(this, args);
    assert.ok(inputs.some(action => action.action_ref === 'ACTION1' && !Object.keys(action.data ?? {}).length));
    return propose.call(this, observation, rows, inputs.filter(action => action.action_ref !== 'ACTION1'), remaining);
  });
  const record = t.mock.method(ConstellationEvidence.prototype, 'record'), game = await start(32, true);
  let firstRef: string;
  for (let n = 1; n <= alternative.commands.length; n++) {
    const d = await game.decision();
    assert.equal(d.action, 'ACTION' + alternative.commands[n - 1].id);
    if (n === 1 || n === 2) assert.deepEqual([d.action, d.step.mode, d.model.control_vectors],
      n === 1 ? ['ACTION2', 'acquire', {}] : ['ACTION1', 'acquire', { ACTION2: [0, 3] }]);
    if (n === 2) assert.ok(d.p.question.hypothesis_refs.includes(firstRef!));
    if (n === 9) assert.deepEqual([d.model.ownership_complete, d.model.active, d.step.mode, d.step.poses],
      [true, 0, 'move', [[36, 45], [18, 30]]]);
    const out = await game.advance(alternative.observations[n - 1]);
    if (n === 1) {
      firstRef = out.observation_ref;
      assert.deepEqual((await record.mock.calls.at(-1)!.result!).measured_vector, [0, 3]);
    }
    if (n === 9) assert.equal(out.matched, true);
    if (n === 28) assert.deepEqual([out.reason, alternative.observations[n - 1].levelsCompleted], ['official_boundary', 1]);
    if (n === 29) assert.equal(d.model.acquired_bodies, 0);
  }
});
