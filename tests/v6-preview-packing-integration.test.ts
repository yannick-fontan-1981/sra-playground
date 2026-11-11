import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativePreviewPacking } from '../src/logos-engine/v6-preview-packing.ts';
import { createNativeV6Runtime, NativeV6Runtime, previewPackingFamily, rawNativePreviewPacking } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativeRuntimeYield } from '../src/logos-engine/v6-native-types.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';
import { capturePreviewPacking } from './helpers/capture-preview-packing.ts';

type R = Record<string, any>;
const read = (name: string) => readFileSync(new URL(name, import.meta.url));
const fixture = JSON.parse(gunzipSync(read('./fixtures/v6-preview-packing/reference.json.gz')).toString());
const source = '../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/';
const declarations: NativeV6Declarations = {
  common: JSON.parse(read(source + 'laya_proto/common_frontier_policy.drm.json').toString()),
  strategy: JSON.parse(read(source + 'morphology_policy/strategy.drm').toString()),
};
const execution = { yieldControl: async () => {} }, budgets = { targetLevels: 3, levelActionCaps: [80, 80, 80] };
const copy = <T>(value: T): T => structuredClone(value);
function graphValue(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge(), raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function sourceFact(runtime: NativeV6Runtime): R {
  const facts = graphValue(runtime, 'reasoning:memory').facts.map((id: string) => graphValue(runtime, id));
  const result = facts.find((row: R) => row.key === 'preview_packing_state');
  assert.ok(result, 'The acquired source state must be retained by the real common caller');
  return result.value;
}
function rebind(value: any, references: Map<string, string>): any {
  if (typeof value === 'string' && value.startsWith(fixture.provenance.observationScope + ':')) {
    assert.ok(references.has(value), `Unwitnessed original observation ${value}`); return references.get(value);
  }
  if (Array.isArray(value)) return value.map(item => rebind(item, references));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebind(v, references)]));
  return value;
}
function owner(runtime: NativeV6Runtime) {
  const internal = runtime as unknown as R, wrappers = internal.families.filter((item: NativeFamily) => item.id === 'preview_packing');
  assert.equal(wrappers.length, 1);
  const raw = rawNativePreviewPacking(wrappers[0]); assert.ok(raw);
  assert.equal(internal.acquisitionFamilies.preview, raw);
  return { raw, wrapper: wrappers[0] as NativeFamily };
}

test('production factory installs one Preview owner at its declared goal entry without a new SRC program', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const { raw } = owner(runtime), snapshot = runtime.snapshot() as R;
    const goal = snapshot.coverage.sourceGroups.find((group: R) => group.id === 'goal_access');
    const index = goal.families.indexOf('preview_packing');
    assert.deepEqual(goal.families.slice(index - 1, index + 3), ['subset_diagnosis', 'preview_packing', 'selected_rigid', 'invited_reduction']);
    assert.equal(goal.entryPoints[index], 'preview_packing');
    assert.equal(snapshot.coverage.registeredFamilies.filter((id: string) => id === 'preview_packing').length, 1);
    assert.equal(snapshot.coverage.fullV6Parity, false);
    assert.deepEqual(raw.sourceState(), { packing_events: [], packing_model: null, packing_controls: {}, _packing_scene_cache: {} });
    assert.equal(raw.hasRetainedModel(), false);
    assert.equal((raw as R).attachPrograms, undefined);
  } finally { runtime.close('preview_factory_test_complete'); }
});

test('real common caller selects, learns once, keeps a multi-action prefix and restores the original state through a natural boundary', async () => {
  const session = fixture.sessions.find((row: R) => row.id === 'selection-unit-translation-and-official-boundary');
  assert.ok(session);
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const { raw } = owner(runtime), events: R[] = [], references = new Map<string, string>();
  capturePreviewPacking(raw, events);
  try {
    let result: NativeRuntimeYield = await runtime.initialize({ sessionId: 'preview-real-common-caller',
      observation: copy(session.steps[0].beforePublic), budgets }, execution);
    const steps = session.steps.filter((row: R) => row.command);
    let retainedPrefix = false;
    for (const row of steps) {
      if (result.kind === 'boundary') result = await runtime.resume(execution);
      assert.equal(result.kind, 'action', result.reason ?? 'expected source action');
      const offered = result.snapshot as R;
      assert.equal(offered.lastDecision, 'preview_packing');
      assert.equal(offered.whyAct.decision.decision.status, 'action_set_released');
      assert.equal(offered.srcDecision.workflow, 'v6.composition_strategy.choose');
      assert.equal(offered.proposal.strategy_receipt.selected, 'goal_access');
      assert.deepEqual(result.command, row.command);
      if (offered.proposal.actions.length > 1) retainedPrefix = true;
      references.set(row.beforeObservation.observation_ref, result.authorization!.observation_ref);
      result = await runtime.advance({ command: result.command!, observation: copy(row.afterPublic), executionMs: 0 }, execution);
      const transition = (result.snapshot as R).trace.findLast((item: R) => item.kind === 'actual_outcome');
      assert.ok(transition); references.set(row.afterObservation.observation_ref, transition.observation_ref);
      if (result.kind === 'boundary') {
        const expected = rebind(row.stateAfter, references);
        assert.deepEqual(raw.sourceState(), expected);
        assert.deepEqual(sourceFact(runtime), expected);
        const envelope = graphValue(runtime, 'family_state:preview_packing');
        assert.equal(envelope.schema, 'native.preview_packing.v1');
        const { schema: _schema, ...sourceState } = envelope;
        assert.deepEqual(sourceState, expected);
      }
    }
    assert.equal(retainedPrefix, true);
    assert.equal(result.snapshot.actions, steps.length);
    assert.equal(result.snapshot.levelsCompleted, 1);
    const records = events.filter(row => row.method === 'record');
    assert.equal(records.length, steps.length, 'Every selected physical return is acquired exactly once');
    assert.ok(records.every(row => row.arguments[5].preview_packing_plan));
    assert.equal(records.at(-1)!.result.boundary, true);
    assert.deepEqual(records.at(-1)!.result.events, []);
    assert.ok(events.some(row => row.method === 'restoreSourceState' && row.returnedNormally));
    assert.ok(events.some(row => row.method === 'restoreNative' && row.returnedNormally));
    assert.ok(events.every(row => row.returnedNormally && row.observationErrors.length === 0));
    assert.ok(raw.sourceState().packing_controls.ACTION1, 'Acquired control survives the epoch boundary');
  } finally { runtime.close('preview_common_caller_test_complete'); }
});

test('foreign Word return does not invoke Preview acquisition and still restores its installed owner', async () => {
  const words = JSON.parse(read('./fixtures/v6-interface-families-reference.json').toString());
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const { raw } = owner(runtime), events: R[] = []; capturePreviewPacking(raw, events);
  try {
    const first = await runtime.initialize({ sessionId: 'preview-foreign-word',
      observation: { ...copy(words.scenes['word:initial'].public), step_index: 0 }, budgets }, execution);
    assert.equal(first.kind, 'action'); assert.equal(first.snapshot.lastDecision, 'word_interface');
    const returned = await runtime.advance({ command: first.command!,
      observation: { ...copy(words.scenes['word:editA'].public), step_index: 1 }, executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary');
    assert.equal(events.filter(row => row.method === 'record').length, 0);
    assert.ok(events.some(row => row.method === 'restoreNative' && row.returnedNormally));
    assert.equal(raw.hasRetainedModel(), false);
    assert.deepEqual(raw.sourceState().packing_events, []);
    assert.deepEqual(raw.sourceState().packing_controls, {});
  } finally { runtime.close('preview_foreign_return_test_complete'); }
});

test('a Preview blocking unknown closes the entire selection before a later group is consulted', async () => {
  const raw = new NativePreviewPacking(); let lowerCalls = 0;
  raw.propose = async () => ({ status: 'unknown', block_unrelated_probe: true, reason: 'packing_control_or_preparation_missing' });
  const preview = previewPackingFamily(raw);
  const fallback: NativeFamily = { id: 'later_provider', propose: () => { lowerCalls++; return null; },
    state: () => ({}), restore: () => {}, before: () => ({ admitted: true, reason: 'synthetic' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'synthetic' }), record: () => ({ events: [] }) };
  const runtime = new NativeV6Runtime({ sourceDigest: 'preview-blocking-adapter-contract', families: [preview, fallback],
    groups: [{ id: 'goal_access', families: [preview.id], entryPoints: ['preview_packing'] }, { id: 'later', families: [fallback.id] }],
    maxPointOccurrences: 128, now: () => 0 });
  try {
    const result = await runtime.initialize({ sessionId: 'preview-global-refusal',
      observation: copy(fixture.sessions[0].steps[0].beforePublic), budgets }, execution);
    assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'frontier_unknown');
    assert.equal(result.command, null); assert.equal(result.snapshot.actions, 0);
    assert.equal(lowerCalls, 0);
    const refusal = (result.snapshot as R).trace.find((row: R) => row.kind === 'native_proposal_refusal');
    assert.equal(refusal.family, 'preview_packing'); assert.equal(refusal.refusal.release_authority, false);
  } finally { runtime.close('preview_global_refusal_test_complete'); }
});
