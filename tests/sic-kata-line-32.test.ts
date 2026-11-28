import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_KATA_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { NativePreviewPacking }: typeof import('../src/logos-engine/v6-preview-packing.ts') = await import(moduleURL('src/logos-engine/v6-preview-packing.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const gz = (path: string) => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))).toString());
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = gz('../docs/migration/lot6a-evidence/integrated-final-02/kata-public-trace.json.gz').packets;
const alternative = gz('./fixtures/sic-kata-alternate-returns.json.gz');
const sessionId = 'sra-v6-' + alternative.session;
const family = 'preview_packing';
function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
async function start(limit: number, live = false) {
  const backend = live && process.env.SIC_KATA_GAME_ROOT ? await sourceBackend(process.env.SIC_KATA_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const { palette, ...actual } = toV6PublicObservation(backend.dispatch(request), n);
    assert.deepEqual(actual, expected, 'official KATA return ' + n);
    return { ...actual, palette };
  }
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'KATA', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: limit } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')!;
      assert.deepEqual([reply.snapshot.lastDecision, p.kind, guard.admitted, guard.reason], [family, family, true, 'current_preview_binding']);
      return { p, guard, plan: p.preview_packing_plan, command: reply.command! };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const { actionRef, data } = reply.command!;
      const observation = observe({ type: 'action', actionId: Number(actionRef.slice(6)), ...(data?.x === undefined ? {} : { data }) }, expected, ++sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
type Game = Awaited<ReturnType<typeof start>>;
function historical(d: Awaited<ReturnType<Game['decision']>>, n: number) {
  assert.deepEqual([d.command.actionRef, d.command.data], [archive[n].command.action_ref, archive[n].command.data ?? {}]);
}
async function prefix(game: Game, count: number) {
  for (let n = 1; n <= count; n++) {
    historical(await game.decision(), n);
    await game.advance();
  }
}
test('32 binds a measured preview, learns controls, and selects the next unplaced member after the first in N3', async t => {
  const record = t.mock.method(NativePreviewPacking.prototype, 'record'), game = await start(33, true);
  const refs = new Map<number, string>(), eventsByTurn = new Map<number, Row>();
  const selections = new Map([[1, ['piece:2', 14, [0, 1], { x: 29, y: 4 }]], [9, ['piece:2', 8, [0, 1], { x: 29, y: 4 }]],
    [17, ['piece:2', 9, [2, 0], { x: 34, y: 4 }]], [26, ['piece:3', 12, [2, 1], { x: 44, y: 24 }]]]);
  for (let n = 1; n <= 33; n++) {
    const d = await game.decision(), p = d.plan;
    historical(d, n);
    if (selections.has(n)) {
      const chosen = p.model.pieces.find((x: Row) => x.id === p.chosen);
      assert.deepEqual([p.mode, p.chosen, chosen.color, p.target.anchor, d.command.data, p.expected], ['select', ...selections.get(n)!, [null]]);
      assert.equal(p.model.pieces.filter((x: Row) => x.movable).length, n < 17 ? 1 : 2);
      if (n < 26) assert.deepEqual([p.model.selected, p.model.preview_color], [null, null]);
    }
    if (n === 6 || n === 18) {
      assert.deepEqual([p.mode, p.model.selected, p.model.preview_color, p.expected[0].anchor],
        ['edit', 'piece:2', 0, n === 6 ? [0, 3] : [1, 6]]);
      assert.ok(d.p.question.hypothesis_refs.includes(refs.get(n - 1)));
    }
    const mark = record.mock.callCount(), out = await game.advance();
    refs.set(n, out.observation_ref);
    for (const call of record.mock.calls.slice(mark)) {
      for (const event of call.result?.events ?? []) {
        const [turn] = [...refs].find(([, id]) => id === event.detail.after) ?? [];
        if (turn !== undefined) eventsByTurn.set(turn, event);
      }
    }
    if (selections.has(n)) {
      const e = eventsByTurn.get(n)!;
      assert.deepEqual([e.detail.selection_observed, e.model.selected, e.model.preview_color, e.detail.after, out.matched],
        [true, p.chosen, 0, out.observation_ref, null]);
    }
    if ([8, 16, 33].includes(n)) assert.deepEqual([out.reason, packet(n).levelsCompleted], ['boundary', n === 8 ? 1 : n === 16 ? 2 : 3]);
    if (n === 18) assert.equal(out.matched, true);
  }
  assert.deepEqual(eventsByTurn.get(2)!.controls, {});
  assert.deepEqual(eventsByTurn.get(5)!.controls.ACTION3, { kind: 'translation', delta: [0, -1], evidence: [refs.get(4), refs.get(5)] });
  const finalFirstMember = eventsByTurn.get(25)!.model.pieces.find((p: Row) => p.id === 'piece:2');
  assert.deepEqual(finalFirstMember.anchor, [2, 0]);
});
test('32 the same first selection without a preview return does not authorize the edit', async t => {
  const record = t.mock.method(NativePreviewPacking.prototype, 'record'), game = await start(16);
  const before = await game.decision();
  historical(before, 1);
  const frame = packet(0).frame, out = await game.advance({ ...packet(1), frame, frames: [frame] });
  const e = record.mock.calls.at(-1)!.result!.events[0]!;
  assert.deepEqual([e.detail.selection_observed, e.model.selected, e.model.preview_color, e.detail.after],
    [false, null, null, out.observation_ref]);
  const next = await game.decision();
  assert.deepEqual([next.plan.mode, next.plan.chosen, next.command.data], ['select', before.plan.chosen, before.command.data]);
});
test('32 withdrawing retained transport at the same preview replaces the route with a real calibration and then resumes', async t => {
  const propose = NativePreviewPacking.prototype.propose;
  let measured: Row | null = null;
  t.mock.method(NativePreviewPacking.prototype, 'propose', async function (this: NativePreviewPacking, ...args: Parameters<typeof propose>) {
    if (args[0].revision !== 18) return propose.apply(this, args);
    const state = this.sourceState();
    assert.ok(Object.hasOwn(state.packing_controls, 'ACTION2'));
    const comparison = await propose.apply(this, args);
    assert.equal(comparison?.status, 'proposed');
    measured = comparison;
    const shadow = new NativePreviewPacking({ limits: this.limits });
    shadow.restoreSourceState({ ...state, packing_controls: {} });
    return propose.apply(shadow, args);
  });
  const record = t.mock.method(NativePreviewPacking.prototype, 'record'), game = await start(23, true);
  await prefix(game, 17);
  const trial = await game.decision();
  assert.ok(measured);
  assert.deepEqual([trial.plan.model.selected, trial.plan.model.preview_color, trial.plan.expected, trial.command.actionRef],
    ['piece:2', 0, [null], 'ACTION1']);
  assert.deepEqual([measured!.actions[0].action_ref, measured!.preview_packing_plan.expected[0].anchor], ['ACTION2', [1, 6]]);
  const out = await game.advance(alternative.observations[0]);
  const e = record.mock.calls.at(-1)!.result!.events[0]!;
  assert.deepEqual([out.matched, e.detail.observed_pose?.anchor, e.detail.after], [null, [0, 6], out.observation_ref]);
  const next = await game.decision();
  assert.deepEqual([next.command.actionRef, next.plan.expected[0].anchor], ['ACTION2', [1, 6]]);
  assert.equal((await game.advance(alternative.observations[1])).matched, true);
});
