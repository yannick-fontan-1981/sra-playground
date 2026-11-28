import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceBackend } from '../scripts/sic-study-source-games.mjs';

const root = process.env.SIC_ISOS_ENGINE_ROOT;
const moduleURL = (path: string) => root ? pathToFileURL(resolve(root, path)).href : new URL('../' + path, import.meta.url).href;
const { V6AgentService }: typeof import('../src/runtime/v6-agent-service.ts') = await import(moduleURL('src/runtime/v6-agent-service.ts'));
const { toV6PublicObservation }: typeof import('../src/runtime/v6-agent-protocol.ts') = await import(moduleURL('src/runtime/v6-agent-protocol.ts'));
const { createNativeV6Runtime }: typeof import('../src/logos-engine/v6-native-runtime.ts') = await import(moduleURL('src/logos-engine/v6-native-runtime.ts'));
const { NativeFacetExamples }: typeof import('../src/logos-engine/v6-facet-examples.ts') =
  await import(moduleURL('src/logos-engine/v6-facet-examples.ts'));

type Row = Record<string, any>;
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const src = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations = { common: read(src + 'laya_proto/common_frontier_policy.drm.json'), strategy: read(src + 'morphology_policy/strategy.drm') };
const assetRoot = process.env.SIC_ISOS_GAME_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const sessionId = 'sra-v6-f8f552d2-2a43-4897-9ef4-aba266fe9c10';
const load = { type: 'load', code: 'ISOS', level: 1 };
const points = [[33, 23], [33, 23], [33, 17], [27, 14], [27, 14], [31, 18], [37, 21],
  [33, 23], [33, 23], [31, 28], [33, 17], [25, 31]];

async function start() {
  const backend = await sourceBackend(assetRoot);
  const service = new V6AgentService(() => createNativeV6Runtime(declarations, { now: () => 0 }));
  let sequence = 0, observation = toV6PublicObservation(backend.dispatch(load), sequence);
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

test('10 distinguishes the seed from the same cap click and rebinds the measured method in two compound worlds', async t => {
  const record = t.mock.method(NativeFacetExamples.prototype, 'record');
  const game = await start(), refs = new Map<number, string>();
  let controlScope: string | undefined;
  for (let n = 1; n <= 12; n++) {
    const d = await game.decision(), p = d.proposal.facet_plan, s = p.projection, [x, y] = points[n - 1]!;
    assert.deepEqual([d.family, d.proposal.program_subquestion, d.proposal.kind, d.command.actionRef, d.command.data,
      d.guard.admitted, d.guard.reason, d.proposal.steps[0].expected_after],
      ['facet_examples', 'facet_example', 'public_facet_example', 'ACTION6', { x, y }, true, 'current_visible_face_bound', null]);
    if (n === 1) {
      controlScope = s.scope_ref;
      assert.deepEqual([s.world, s.example_box, s.scale_hypothesis, s.offer.kind, s.offer.support.bbox, p.method],
        [[0, 0, 63, 43], [2, 45, 18, 59], 0.6, 'probe_congruent_empty_face', [29, 21, 38, 25], null]);
      assert.deepEqual(s.example_parts.map((part: Row) => part.palette_value).sort(), [14, 8, 9]);
      assert.deepEqual(s.reference_parts.map((part: Row) => part.palette_value).sort(), [14, 8, 9]);
    }
    if (n === 2 || n === 3) assert.deepEqual([s.scope_ref, s.offer.kind, p.method?.shift ?? null],
      [controlScope, 'probe_visible_cap', n === 2 ? null : [0, -6]]);
    if (n === 3) assert.ok(d.proposal.route_refs.includes(refs.get(2)));
    if (n === 4 || n === 8) {
      assert.deepEqual([s.offer.kind, s.compound.prefix, s.compound.port_status], ['recall_seed_for_compound_reference', 0, 'observed_seed_method_revalidated_here']);
      assert.ok(d.proposal.route_refs.includes(refs.get(n - 1)));
      assert.notEqual(s.scope_ref, controlScope);
    }
    if (n === 7 || n === 11 || n === 12) assert.deepEqual(p.method.offset, n === 7 ? [6, 3] : n === 11 ? [0, -6] : [-6, 3]);

    const out = await game.advance();
    refs.set(n, out.observation_ref);
    assert.deepEqual([out.family, out.matched, out.reason], ['facet_examples', null, 'observe_current_face_edit_without_assuming_owner']);
    const event = record.mock.calls.map(c => c.result as Row).findLast(r => r?.evidence?.at(-1) === out.observation_ref)!;
    assert.deepEqual(event.evidence, [d.proposal.binding.observation_ref, out.observation_ref]);
    if (n === 1) assert.deepEqual([event.status, event.outside_preserved], ['filled_example_correspondence', true]);
    if (n === 2) assert.deepEqual([event.status, event.cap_shift, event.outside_preserved, event.side_changes.map((side: Row) => side.vertical_extension)],
      ['observed_visible_cap_and_side_change', [0, -6], true, [true, true]]);
    if (n === 4 || n === 8) assert.deepEqual([event.status, event.outside_preserved, event.whole_colored_render_matched],
      ['compound_seed_effect_matched', true, true]);
    if (n === 3 || n === 7 || n === 12) assert.deepEqual([event.status, game.observation.levelsCompleted],
      ['official_boundary', n === 3 ? 1 : n === 7 ? 2 : 3]);
  }
  assert.deepEqual([game.observation.level, (await game.decision()).family], [4, 'observed_frontier']);
});

test('10 preserves the real official boundary but withdraws the compound offer when its boundary reference is absent', async t => {
  const original = NativeFacetExamples.prototype.record;
  let boundaryRef: string | undefined;
  t.mock.method(NativeFacetExamples.prototype, 'record', function (this: InstanceType<typeof NativeFacetExamples>,
    ...args: Parameters<typeof original>) {
    const [before, after] = args, event = original.apply(this, args);
    if (before.level_epoch === 1 && after.level_epoch === 2 && event.status === 'official_boundary') {
      const retained = this.state();
      assert.deepEqual([retained.portable?.boundary_ref, retained.portable?.up_shift], [after.observation_ref, [0, -6]]);
      boundaryRef = after.observation_ref;
      delete retained.portable!.boundary_ref;
      this.restore(retained);
    }
    return event;
  });
  const game = await start();
  for (let n = 1; n <= 3; n++) { assert.equal((await game.decision()).family, 'facet_examples'); await game.advance(); }
  const next = await game.decision();
  assert.ok(boundaryRef);
  assert.deepEqual([game.observation.level, game.observation.levelsCompleted, next.proposal.binding.observation_ref], [2, 1, boundaryRef]);
  assert.notEqual(next.family, 'facet_examples');
});

test('10 suppresses the same seed trial after an unchanged constructed return', async t => {
  const record = t.mock.method(NativeFacetExamples.prototype, 'record');
  const game = await start(), first = await game.decision();
  assert.deepEqual([first.command.actionRef, first.command.data], ['ACTION6', { x: 33, y: 23 }]);
  const out = await game.advance(true);
  const event = record.mock.calls.map(c => c.result as Row).findLast(r => r?.evidence?.at(-1) === out.observation_ref)!;
  assert.deepEqual([event.status, game.observation.levelsCompleted], ['no_visible_effect', 0]);
  const d = await game.decision();
  assert.notEqual(d.family, 'facet_examples');
});
