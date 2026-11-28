import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';
import type { V6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';

const root = process.env.SIC_GIGO_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { FieldServiceMemory, fieldServiceBefore }: typeof import('../src/logos-engine/v6-field-service-access.ts') =
  await import(moduleURL('src/logos-engine/v6-field-service-access.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_GIGO_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const gigoPoint = { x: 26, y: 20 };
const available = ['ACTION6'];

async function start(code: 'GIGO' | 'VALV', initial?: (o: V6PublicObservation) => V6PublicObservation) {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch({ type: 'load', code, level: 1 }), sequence);
  if (initial) observation = initial(observation);
  let reply = await service.handle({ type: 'init', sessionId, sequence, observation,
    budgets: { targetLevels: 6, levelActionCaps: Array(6).fill(600), maxActions: 16 } });
  return {
    get observation() { return observation; },
    get reply() { return reply; },
    async decision() {
      if (reply.kind === 'boundary') reply = await service.handle({ type: 'resume', sessionId, sequence });
      assert.equal(reply.kind, 'action');
      return { command: reply.command!, proposal: reply.snapshot.proposal as Row, family: reply.snapshot.lastDecision,
        guard: (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'before_guard')! };
    },
    async advance(unchanged = false) {
      const { actionRef, data } = reply.command!;
      const actionId = Number(actionRef.slice(6));
      sequence++;
      observation = unchanged ? { ...observation, stepIndex: sequence, frames: [observation.frame] }
        : toV6PublicObservation(backend.dispatch({ type: 'action', actionId, ...(actionId === 6 ? { data } : {}) }), sequence);
      reply = await service.handle({ type: 'advance', sessionId, sequence, ticketId: reply.ticket!.id, executionMs: 0, observation });
      return (reply.snapshot.trace as Row[]).findLast(e => e.kind === 'actual_outcome')!;
    },
  };
}

test('53 offers the unique measured GIGO core and stops on a mixed local and remote response', async t => {
  const record = t.mock.method(FieldServiceMemory.prototype, 'record');
  const game = await start('GIGO');
  const d = await game.decision(), p = d.proposal.nested_control_plan;
  assert.deepEqual([d.family, d.proposal.field_subquestion, d.proposal.kind, d.command.actionRef, d.command.data, d.guard.admitted, d.guard.reason,
    p.selected.bbox, p.selected.core_area, p.selected.core_palette, p.alternative_enclosures, p.expected_effect, d.proposal.steps[0].expected_after],
    ['public_occurrence_recall', 'field_service_composition', 'nested_control_experiment', 'ACTION6', gigoPoint, true,
      'current_nested_core_exact_point', [24, 18, 29, 23], 16, 5, [], 'unknown', null]);
  const before = game.observation.frame, out = await game.advance();
  const results = record.mock.calls.flatMap(c => c.result || []);
  const events = results.filter((e: Row) => e.evidence?.at(-1) === out.observation_ref);
  assert.deepEqual(events.map((e: Row) => e.kind), ['nested_control_response']);
  const e = events[0]!;
  assert.deepEqual([out.matched, out.reason, e.changed_pixels, e.changed_inside_control, e.changed_outside_control, e.official_progress,
    e.evidence, e.same_epoch, game.observation.levelsCompleted],
    [null, 'unknown_control_response_observed', 420, 20, 400, false, [p.observation_ref, out.observation_ref], true, 0]);
  assert.notDeepEqual(game.observation.frame, before);
  assert.equal(game.reply.reason, 'nested_control_effect_requires_composition');
});

test('53 distinguishes tied enclosures and a stale point from a single current minimum', async t => {
  const nominal = await start('GIGO'), d = await nominal.decision(), p = d.proposal.nested_control_plan;
  const question = t.mock.method(FieldServiceMemory.prototype, 'nestedQuestion');
  const tied = await start('GIGO', observation => {
    const frame = observation.frame.map(row => [...row]);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) frame[2 + y]![2 + x] = frame[18 + y]![24 + x]!;
    const stale = fieldServiceBefore(d.proposal, 0, frame, { epoch: p.epoch, score: p.score, observation_ref: p.observation_ref, available });
    assert.deepEqual(stale, { admitted: false, reason: 'nested_context_or_payload_changed' });
    return { ...observation, frame, frames: [frame] };
  });
  assert.ok(question.mock.calls.length > 0);
  assert.ok(question.mock.calls.every(c => c.result === null));
  assert.notEqual((tied.reply.snapshot.proposal as Row | null)?.kind, 'nested_control_experiment');
});

test('53 seals a synthetic unchanged return as a context-local negative and replaces the nested offer', async t => {
  const record = t.mock.method(FieldServiceMemory.prototype, 'record');
  const game = await start('GIGO'), d = await game.decision();
  assert.deepEqual([d.command.actionRef, d.command.data], ['ACTION6', gigoPoint]);
  const out = await game.advance(true);
  const events = record.mock.calls.flatMap(c => c.result || []);
  const e = events.find((event: Row) => event.kind === 'nested_control_response' && event.evidence.at(-1) === out.observation_ref)!;
  assert.deepEqual([e.disposition, e.changed_pixels, e.selection_acquired, e.impossibility_acquired, e.frame_digest],
    ['local_no_visible_effect', 0, false, false, d.proposal.nested_control_plan.frame_digest]);
  const next = await game.decision();
  assert.deepEqual([next.family, next.proposal.kind, next.command.actionRef], ['observed_frontier', 'experiment', 'ACTION1']);
});

test('53 shares the initial VALV nested offer and the outer field phases reuse admission and measurement', async t => {
  const record = t.mock.method(FieldServiceMemory.prototype, 'record');
  const game = await start('VALV');
  const witnesses = new Map<number, [string, number[], string[]]>([
    [1, ['nested_control_experiment', [32, 50], ['nested_control_response', 'envelope_fill_context']]],
    [2, ['envelope_fill_experiment', [32, 50], ['nested_control_response', 'envelope_fill_context']]],
    [5, ['field_service_experiment', [50, 33], ['nested_control_response', 'field_service_context', 'field_service_transfer']]],
    [11, ['field_service_transfer_experiment', [11, 35], ['nested_control_response', 'field_service_transfer']]],
  ]);
  for (let n = 1; n <= 11; n++) {
    const d = await game.decision(), w = witnesses.get(n);
    if (w) {
      const p = d.proposal.nested_control_plan;
      assert.deepEqual([d.family, d.proposal.field_subquestion, d.proposal.kind, d.command.actionRef, [d.command.data.x, d.command.data.y], d.guard.reason],
        ['public_occurrence_recall', 'field_service_composition', w[0], 'ACTION6', w[1], 'current_nested_core_exact_point']);
      if (n === 1) assert.deepEqual([p.selected.bbox, p.selected.core_area, p.alternative_enclosures.map((a: Row) => a.core_area)],
        [[30, 48, 34, 52], 9, [49]]);
    }
    const out = await game.advance();
    if (w) {
      const events = record.mock.calls.flatMap(c => c.result || [])
        .filter((e: Row) => e.evidence?.at(-1) === out.observation_ref);
      assert.deepEqual(events.map((e: Row) => e.kind), w[2]);
      const nested = events[0]!;
      assert.deepEqual([out.matched, nested.evidence[0]], [null, d.proposal.binding.observation_ref]);
      if (n === 1) assert.deepEqual([nested.changed_pixels, nested.changed_inside_control, nested.changed_outside_control], [72, 0, 72]);
    }
  }
  const next = await game.decision();
  assert.equal(next.proposal.kind, 'field_service_transfer_experiment');
});
