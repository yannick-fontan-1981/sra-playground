import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_SP80_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { CellPlacementMemory }: typeof import('../src/logos-engine/v6-cell-placement.ts') = await import(moduleURL('src/logos-engine/v6-cell-placement.ts'));
const { projectCellPatch, cellPatchChanges }: typeof import('../src/logos-engine/v6-cell-patch-observation.ts') =
  await import(moduleURL('src/logos-engine/v6-cell-patch-observation.ts'));
type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const archive = JSON.parse(gunzipSync(readFileSync(new URL('../docs/migration/native-campaigns-v46/tict-public-trace.json.gz', import.meta.url))).toString()).packets;
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const cold = 'test_pointed_cell_patch_and_dated_response', learned = 'prepare_visible_line_under_observed_local_and_remote_additions';
function packet(n: number): V6PublicObservation {
  const p = archive[n].packet;
  return { frame: p.frame_rows, frames: p.frame_packet, level: p.level, levelsCompleted: p.levels_completed,
    state: p.state, stepIndex: p.step_index, availableActionIds: p.available_action_refs.map((key: string) => Number(key.slice(6))) };
}
function statusOnly(n: number): V6PublicObservation {
  // Reproduce the location and resulting palette of the two SP80 T12 HUD changes on TICT's own board.
  const frame = packet(n - 1).frame.map(row => [...row]);
  for (const x of [4, 5]) {
    assert.equal(frame[63]![x], 4);
    frame[63]![x] = 0;
  }
  return { ...packet(n), frame, frames: [frame] };
}
async function start(live = false) {
  const backend = live && process.env.SIC_SP80_GAME_ROOT ? await sourceBackend(process.env.SIC_SP80_GAME_ROOT) : null;
  function observe(request: object, expected: V6PublicObservation, n: number) {
    if (!backend) return expected;
    const actual = toV6PublicObservation(backend.dispatch(request), n), { palette, ...archivedFields } = actual;
    assert.deepEqual(archivedFields, expected, 'official TICT return ' + n);
    return actual;
  }
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: observe({ type: 'load', code: 'TICT', level: 1 }, packet(0), 0),
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      const p = reply.snapshot.proposal as Row, guard = (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard');
      assert.deepEqual([reply.kind, reply.snapshot.lastDecision, p.kind, p.field_subquestion, guard?.admitted, reply.command!.actionRef],
        ['action', 'public_occurrence_recall', 'cell_patch_placement', 'cell_patch_composition', true, 'ACTION6']);
      return { plan: p.cell_placement_plan, reason: p.question.reason, point: reply.command!.data, refs: p.question.hypothesis_refs };
    },
    async advance(expected: V6PublicObservation = packet(sequence + 1)) {
      const command = reply.command!;
      reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket!.id, executionMs: 0,
        observation: observe({ type: 'action', actionId: 6, data: command.data }, expected, sequence) });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}
test('41 TICT releases all 16 catalogue tickets and consumes the dated local and remote motifs at T2', async t => {
  const dated = t.mock.method(CellPlacementMemory.prototype, 'recordPacket');
  const game = await start(true);
  let model: Row | undefined;
  for (let n = 1; n <= 16; n++) {
    const d = await game.decision();
    assert.deepEqual(d.point, archive[n].command.data);
    if (n === 1) {
      assert.deepEqual([d.reason, d.plan.point, d.plan.model, d.plan.expected_motif], [cold, [1, 1], null, null]);
      assert.deepEqual(d.plan.field.geometry, { origin: [9, 6], shape: [3, 3], pitch: [16, 16], size: [14, 14] });
      const changes = packet(n).frames.map(rows => cellPatchChanges(d.plan.field, projectCellPatch(rows, d.plan.field.geometry)!)!.map(c => c.slice(0, 2)));
      assert.deepEqual(changes, [[[1, 1]], [[1, 1]], [[1, 1], [1, 2]], [[1, 1], [1, 2]], [[1, 1], [1, 2]]]);
    }
    if (n === 2) {
      assert.deepEqual([d.point, d.reason, d.plan.model, d.plan.expected_motif], [{ x: 15, y: 12 }, learned, model, model!.own]);
      assert.ok(d.plan.search);
      assert.ok(model!.evidence.every((ref: string) => d.refs.includes(ref)));
    }
    const out = await game.advance();
    assert.equal(out.family, 'public_occurrence_recall');
    assert.equal(out.matched, [1, 3, 4, 7, 11, 15, 16].includes(n) ? null : true);
    if (n === 1) {
      const event = dated.mock.calls.at(-1)!.result![0]!;
      model = Object.values(event.models)[0] as Row;
      const field = projectCellPatch(packet(1).frame, d.plan.field.geometry)!;
      assert.deepEqual([model.status, model.field_ref, model.epoch, model.evidence, model.ordered_frames, model.own, model.other],
        ['candidate', d.plan.field.ref, d.plan.epoch, [d.plan.observation_ref, out.observation_ref], [0, 2], field.grid[1][1], field.grid[2][1]]);
      assert.notEqual(model.own, model.other);
    }
    if (n === 3) assert.deepEqual([out.reason, packet(3).level, packet(3).levelsCompleted], ['official_boundary_or_terminal', 2, 1]);
  }
});
for (const endpoint of [false, true]) {
  test('41 TICT keeps its original cold ticket but acquires no role from ' + (endpoint ? 'the real endpoint alone' : 'a status-line change'), async t => {
    const record = t.mock.method(CellPlacementMemory.prototype, 'record'), dated = t.mock.method(CellPlacementMemory.prototype, 'recordPacket');
    const game = await start(), first = await game.decision(), after = endpoint ? { ...packet(1), frames: [packet(1).frame] } : statusOnly(1);
    assert.deepEqual([first.point, first.plan.point, first.reason], [{ x: 31, y: 28 }, [1, 1], cold]);
    const out = await game.advance(after), event = record.mock.calls.at(-1)!.result![0]!;
    assert.deepEqual([out.matched, event.detail.before_ref, event.detail.after_ref, event.detail.canonical_unchanged, event.models, event.refused],
      [null, first.plan.observation_ref, out.observation_ref, false, {}, []]);
    assert.deepEqual(dated.mock.calls.at(-1)!.result, []);
    const next = await game.decision();
    assert.deepEqual([next.point, next.reason, next.plan.model, next.plan.expected_motif, next.plan.search, next.refs],
      [endpoint ? { x: 15, y: 12 } : first.point, cold, null, null, null, [out.observation_ref]]);
  });
}
test('41 TICT refutes an already predicted placement when only the status line changes', async t => {
  const record = t.mock.method(CellPlacementMemory.prototype, 'record');
  const game = await start();
  await game.decision();
  await game.advance();
  const second = await game.decision();
  assert.deepEqual([second.point, second.plan.model.status, second.reason], [{ x: 15, y: 12 }, 'candidate', learned]);
  const out = await game.advance(statusOnly(2)), event = record.mock.calls.at(-1)!.result![0]!;
  assert.equal(out.matched, false);
  const model = event.models[second.plan.epoch + ':' + second.plan.field.ref];
  assert.deepEqual([model.status, model.counterexample], ['refuted', out.observation_ref]);
  const third = await game.decision();
  assert.deepEqual([third.point, third.reason, third.plan.model.status, third.plan.expected_motif, third.plan.search],
    [second.point, cold, 'refuted', null, null]);
});
