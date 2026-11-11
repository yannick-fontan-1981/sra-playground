import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AddressedMaterial } from '../src/logos-engine/v6-addressed-material.ts';
import { createNativeV6Runtime, NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeV6Declarations } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeExecution, NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { decodeNativeState } from '../src/logos-engine/v6-knowledge-store.ts';

type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const source = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/', import.meta.url);
const declarations = {
  common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', source), 'utf8')),
  strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', source), 'utf8')),
} as NativeV6Declarations;
const ID = 'public_addressed_material', ENTRY = 'observed_addressed_material', OWNER = `family_state:${ID}`;
const execution: NativeExecution = { yieldControl: async () => {}, now: () => 0, deadlineMs: 360_000 };
const budgets = { targetLevels: 3, levelActionCaps: [8, 8, 8], maxActions: 24 };
function owners(runtime: NativeV6Runtime): { registered: NativeFamily[]; fields: AddressedMaterial } {
  const inner = runtime as unknown as R;
  return { registered: inner.families, fields: inner.acquisitionFamilies.fields };
}
function retained(runtime: NativeV6Runtime, id: string): R {
  const graph = runtime.inspectKnowledge();
  assert.ok(graph.nodes[id], `Missing authoritative node ${id}`);
  const raw = graph.nodes[id]!.value;
  return (isNativeStateGraph(raw) ? hydrateNativeState(raw, key => graph.nodes[key]!.value) : decodeNativeState(raw)) as R;
}
function facts(runtime: NativeV6Runtime): R[] {
  return (retained(runtime, 'reasoning:memory').facts as string[]).map(id => retained(runtime, id));
}
async function blank(step = 0, epoch = 1, score = 0): Promise<NativePublicObservation> {
  const rows = Array.from({ length: 8 }, () => Array(8).fill(0));
  return { frame_rows: rows, frame_packet: [rows], frame_hash: await publicFrameHash(rows),
    available_action_refs: ['ACTION1'], level: epoch, levels_completed: score,
    state: 'NOT_FINISHED', step_index: step };
}
function instrument(owner: AddressedMaterial) {
  const records: { selected: boolean; before: R; after: R; result: R }[] = [];
  const restores: { input: R; after: R }[] = [];
  const record = owner.recordSource.bind(owner), restore = owner.restoreNative.bind(owner);
  owner.recordSource = (...args: Parameters<AddressedMaterial['recordSource']>) => {
    const result = record(...args);
    records.push({ selected: args[5] != null, before: copy(args[0]), after: copy(args[1]), result: copy(result) });
    return result;
  };
  owner.restoreNative = state => {
    restore(state); restores.push({ input: copy(state), after: copy(owner.nativeState()) });
  };
  return { records, restores };
}

test('addressed acquisition rejects an absent owner and a second object with the same owner id', async () => {
  const production = await createNativeV6Runtime(declarations, { now: () => 0 }), o = owners(production);
  try {
    const configuration = { sourceDigest: 'addressed-single-owner-contract', now: () => 0,
      families: o.registered, groups: [{ id: 'factored_material_return', families: [ID], entryPoints: [ENTRY] }],
      maxPointOccurrences: declarations.common.input_domain.max_point_occurrences,
      authorityPolicy: declarations.common, callerStrategy: declarations.strategy.declarations[0]!.configuration,
      acquisitionFamilies: (production as unknown as R).acquisitionFamilies };
    assert.throws(() => new NativeV6Runtime({ ...configuration, families: o.registered.filter(f => f.id !== ID) }),
      /Passive acquisition requires the registered common caller families/);
    const other = new AddressedMaterial();
    assert.throws(() => new NativeV6Runtime({ ...configuration,
      families: o.registered.map(f => f.id === ID ? other : f) }),
    /Addressed material passive acquisition requires its single registered owner/);
  } finally { production.close('addressed-single-owner-checked'); }
});

test('production keeps one cold addressed owner at the original material subquestion position', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  try {
    const o = owners(runtime);
    assert.equal(o.registered.filter(f => f.id === ID).length, 1);
    assert.deepEqual(o.fields.sourceState(), new AddressedMaterial().sourceState());
    const result = await runtime.initialize({ sessionId: 'synthetic:addressed-registration', observation: await blank(), budgets }, execution);
    const material = (result.snapshot.coverage as R).sourceGroups.find((g: R) => g.id === 'factored_material_return');
    const index = material.entryPoints.indexOf(ENTRY);
    assert.ok(index >= 0); assert.equal(material.families[index], ID);
    assert.equal(material.families.filter((id: string) => id === ID).length, 1);
    const order = declarations.strategy.declarations[0]!.configuration.factored_material_return.ordered_subquestions;
    const entries = material.entryPoints.filter((entry: string | null) => entry !== null);
    assert.deepEqual(entries, [...entries].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    assert.ok(index > material.entryPoints.indexOf('reactive_contact_continuation'));
    assert.ok(index < material.entryPoints.indexOf('observed_ranked_workshop'));
    const graph = runtime.inspectKnowledge();
    assert.deepEqual(Object.values(graph.nodes).filter(n => n.kind === 'family_state' && n.family === ID).map(n => n.id), [OWNER]);
    assert.equal(result.snapshot.levelsCompleted, 0, 'Synthetic geometry is not a completed game level');
  } finally { runtime.close('addressed-registration-checked'); }
});

test('a foreign no-effect return retains the entire unresolved source envelope once and restores its actual checkpoint', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owner = owners(runtime).fields, observed = instrument(owner), cold = owner.state();
  try {
    const first = await runtime.initialize({ sessionId: 'synthetic:addressed-passive', observation: await blank(), budgets }, execution);
    assert.equal(first.kind, 'action', first.reason); assert.notEqual(first.snapshot.lastDecision, ID);
    assert.ok(first.authorization); assert.equal(observed.records.length, 0);
    const returned = await runtime.advance({ command: first.command!, observation: await blank(1), executionMs: 0 }, execution);
    assert.equal(returned.kind, 'boundary'); assert.equal(returned.snapshot.actions, 1);
    assert.equal(observed.records.length, 1); assert.equal(observed.records[0]!.selected, false);
    const raw = observed.records[0]!.result;
    assert.deepEqual(raw, { status: 'field_unresolved', events: [] });
    const events = facts(runtime).filter(f => f.key === 'addressed_material_event:1');
    assert.equal(events.length, 1); assert.deepEqual(events[0]!.value, raw);
    assert.equal(facts(runtime).some(f => f.key === 'addressed_material_state'), false,
      'The Python caller has no extra addressed source-state fact');
    assert.deepEqual(retained(runtime, OWNER), owner.nativeState());
    assert.ok(observed.restores.length > 0, 'Observe real common restoreNative calls');
    for (const restoration of observed.restores) assert.deepEqual(restoration.after, restoration.input);
    const acquired = copy(owner.sourceState());
    owner.restore(cold);
    await runtime.resume(execution);
    assert.deepEqual(owner.sourceState(), acquired, 'The authoritative graph restores the acquired state before choice');
    assert.equal(observed.records.length, 1, 'Selection and restoration do not acquire the prior return again');
    assert.equal(facts(runtime).filter(f => f.key === 'addressed_material_event:1').length, 1);
  } finally { runtime.close('addressed-passive-checked'); }
});

test('a foreign official boundary retains its field envelope without inventing a learned prior', async () => {
  const runtime = await createNativeV6Runtime(declarations, { now: () => 0 });
  const owner = owners(runtime).fields, observed = instrument(owner);
  try {
    const first = await runtime.initialize({ sessionId: 'synthetic:addressed-boundary', observation: await blank(), budgets }, execution);
    assert.equal(first.kind, 'action', first.reason); assert.notEqual(first.snapshot.lastDecision, ID);
    const returned = await runtime.advance({ command: first.command!, observation: await blank(1, 2, 1), executionMs: 0 }, execution);
    assert.equal(returned.snapshot.actions, 1); assert.equal(returned.snapshot.levelsCompleted, 1);
    assert.equal(observed.records.length, 1); assert.equal(observed.records[0]!.selected, false);
    assert.deepEqual(observed.records[0]!.result, { status: 'field_official_boundary', events: [], official_boundary: 1 });
    assert.deepEqual(facts(runtime).find(f => f.key === 'addressed_material_event:1')!.value, observed.records[0]!.result);
    assert.equal(owner.sourceState().prior, null);
    assert.equal(owner.sourceState().epoch, 2);
  } finally { runtime.close('addressed-boundary-checked'); }
});
