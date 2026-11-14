import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonical } from '../src/logos-engine/canonical.ts';
import { Kernel } from '../src/logos-engine/kernel.ts';
import { decodeNativeState, encodeNativeState, NativeKnowledgeStore } from '../src/logos-engine/v6-knowledge-store.ts';
import { hydrateNativeState, isNativeStateGraph } from '../src/logos-engine/v6-native-state-graph.ts';
import { NativeReasoningMemory } from '../src/logos-engine/v6-reasoning-memory.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativeGraphEdit, NativeRecord } from '../src/logos-engine/v6-native-types.ts';
import { nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';
import { VisualSequences } from '../src/logos-engine/v6-visual-sequences.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { BrowserV6Agent } from '../src/runtime/v6-agent.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { V6AgentOperation, V6AgentResult, V6AgentTransport } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

const WORKFLOW = 'v6.composition_strategy.choose';
const CAUSE = { workflow: 'test.store', step: 'test', statement: 'write' };
const NO_WAIT = { yieldControl: async () => {} };

test('native Float64 leaves round-trip fractional evidence, negative zero and reserved object keys', () => {
  const value = { confidence: 0.125, negative: -0, large: 2 ** 60, plain: 7,
    nested: [{ $v6_float64: 'literal-user-value' }, { $v6_object: ['literal'] }, JSON.parse('{"__proto__":null}')] };
  const encoded = encodeNativeState(value);
  assert.doesNotThrow(() => canonical(encoded));
  const decoded = decodeNativeState(encoded) as typeof value;
  assert.deepEqual(decoded, value);
  assert.ok(Object.is(decoded.negative, -0));
  assert.ok(Object.isFrozen(decoded));
  assert.ok(Object.isFrozen(decoded.nested));
  assert.throws(() => canonical(value), /safe integers/);
});

test('native state rejects executable/nonfinite input and malformed tagged values', () => {
  for (const value of [NaN, Infinity, { callback() {} }, { value: undefined }, { [Symbol('hidden')]: 3 }]) {
    assert.throws(() => encodeNativeState(value));
  }
  let called = false;
  assert.throws(() => encodeNativeState({ get value() { called = true; return 1; } }));
  assert.equal(called, false);
  for (const value of [{ $v6_float64: '7ff0000000000000' }, { $v6_float64: 'invalid' },
    { $v6_float64: '3ff0000000000000', extra: 1 }, { $v6_object: [['a', 1], ['a', 2]] }]) {
    assert.throws(() => decodeNativeState(value));
  }
});

test('the larger native Kernel profile leaves the ordinary V7 ceiling unchanged', () => {
  const logos = { kinds: {}, node_fields: [], statuses: [] };
  const drm = { templates: {}, limits: { nodes: 513 } };
  assert.throws(() => new Kernel(logos, drm, 'reference'), /1\.\.512/);
  assert.doesNotThrow(() => new Kernel(logos, drm, 'reference', { maxDeclaredNodes: 16_384 }));
  assert.throws(() => new Kernel(logos, drm, 'reference', { maxDeclaredNodes: 1_000_001 }), /ceiling/);
});

test('native store commits actual V7 revisions and rolls back a failed multi-node transaction', async () => {
  const store = new NativeKnowledgeStore('test-native-source', 'test-scope');
  await store.commit([{ id: 'family_state:a', kind: 'family_state', family: 'a', value: { count: 0, fraction: 0.5 } }], CAUSE);
  const first = store.memory;
  assert.equal(first.nodes['family_state:a']!.revision, 1);
  assert.equal(first.deltas[0]!.source_digest, 'test-native-source');
  assert.deepEqual(store.value('family_state:a'), { count: 0, fraction: 0.5 });
  await assert.rejects(store.commit([
    { id: 'family_state:a', kind: 'family_state', family: 'a', value: { count: 1 } },
    { id: 'bad', kind: 'family_state', value: {} },
  ], CAUSE), /Logos contract/);
  assert.equal(store.memory, first);
  await assert.rejects(store.commit([{ id: 'family_state:a', kind: 'family_state', value: { count: 2 } }], CAUSE, 'stale'), /graph changed/);
  assert.equal(store.memory, first);
  await store.commit([{ id: 'family_state:a', kind: 'family_state', value: { count: 1, fraction: 0.5 } }], CAUSE);
  assert.equal(store.node('family_state:a').revision, 2);
  assert.equal(store.memory.deltas[1]!.previous, first.chain);
  assert.notEqual(store.graphChain, first.chain);
  assert.ok(Object.isFrozen(store.memory.nodes));
});

test('native state fragments retain an entire large episode and reuse immutable frames across revisions', async () => {
  const store = new NativeKnowledgeStore('large-native-source', 'large-episode');
  const rows = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => (x + y) % 16));
  const episode = Array.from({ length: 300 }, (_, revision) => ({ revision, frame: rows, score: revision / 8 }));
  const write = { id: 'family_state:long', kind: 'family_state' as const, family: 'long', value: { episode, count: 300 } };
  await store.commit([write], CAUSE);
  assert.ok(isNativeStateGraph(store.node(write.id).value));
  const fragments = Object.values(store.memory.nodes).filter(node => node.kind === 'state_fragment');
  assert.ok(fragments.length > 0);
  assert.deepEqual(store.stateValue(write.id), write.value);
  const before = store.memory;
  await store.commit([{ ...write, value: { episode, count: 301 } }], CAUSE);
  assert.equal(store.node(write.id).revision, 2);
  assert.equal(Object.values(store.memory.nodes).filter(node => node.kind === 'state_fragment').length, fragments.length);
  for (const fragment of fragments) assert.equal(store.node(fragment.id), before.nodes[fragment.id]);
  rows[0]![0] = 99;
  const retained = store.stateValue(write.id) as { episode: { frame: readonly (readonly number[])[] }[]; count: number };
  assert.equal(retained.episode.length, 300); assert.equal(retained.episode[299]!.frame[0]![0], 0);
  assert.equal(retained.count, 301);
  assert.ok(Object.isFrozen(retained.episode[299]!.frame));
  const current = store.memory;
  await assert.rejects(store.commit([
    { ...write, value: { another: rows } },
    { id: 'malformed', kind: 'family_state', value: {} },
  ], CAUSE), /Logos contract/);
  assert.equal(store.memory, current, 'A failing transaction must not leak staged fragment nodes');
});

test('reasoning dynamic restore preserves the real catalog and rolls back malformed table updates', () => {
  const memory = new NativeReasoningMemory({ clock: () => 42 }); memory.importCatalog();
  memory.put('run', 'actual', { seen: 1 }, 'observation:1', 1);
  memory.trace('run', 'actual', { acquired: true });
  const first = memory.state(), dynamic = memory.dynamicState();
  assert.deepEqual(dynamic, { facts: first.facts, traces: first.traces });
  memory.put('run', 'actual', { seen: 2 }, 'observation:2', 2);
  memory.restoreDynamic(dynamic); assert.deepEqual(memory.state(), first);
  assert.throws(() => memory.restoreDynamic({ facts: [...dynamic.facts, ...dynamic.facts], traces: [] }), /Duplicate/);
  assert.deepEqual(memory.state(), first);
  assert.throws(() => memory.restoreDynamic({ facts: [], traces: [...dynamic.traces, ...dynamic.traces] }), /trace sequence/);
  assert.deepEqual(memory.state(), first);
  dynamic.facts[0]!.value.seen = 999;
  assert.equal(memory.get('run', 'actual').value.seen, 1, 'Restored tables must own their values');
});

class CounterFamily implements NativeFamily {
  readonly id = 'counter';
  count = 0;
  fraction = 0.125;
  seen: number[] = [];
  readonly prefixLength: number;
  constructor(prefixLength = 1) { this.prefixLength = prefixLength; }
  propose() {
    this.seen.push(this.count);
    const action = { action_ref: `ACTION${this.count % 5 + 1}`, data: {} };
    return { status: 'proposed', kind: 'counter-test', actions: Array.from({ length: this.prefixLength }, () => action), steps: Array.from({ length: this.prefixLength }, () => ({})) };
  }
  before() { return { admitted: true, reason: 'public_test' }; }
  after() { return { matched: true, seal_prefix: false, reason: 'public_witness' }; }
  record() { this.count += 1; this.fraction += 0.125; return { events: [{ kind: 'actual', count: this.count }] }; }
  state() { return { count: this.count, fraction: this.fraction, seen: [...this.seen] }; }
  restore(state: NativeRecord) { this.count = state.count as number; this.fraction = state.fraction as number; this.seen = [...state.seen as number[]]; }
}

function board(pixel = 0): GameObservation {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(pixel));
  return { gameCode: 'PUBLIC', frame, frames: [frame], state: 'NOT_FINISHED', availableActionIds: [1, 2, 3, 4, 5, 6],
    level: 1, levelCount: 3, levelsCompleted: 0, canUndo: false, canSelectLevel: true, defaultFps: 10 };
}

async function setup(prefixLength = 1, familyAgenda?: 'active' | 'shadow') {
  const family = new CounterFamily(prefixLength);
  const runtime = new NativeV6Runtime({ sourceDigest: 'native-store-reference', families: [family], maxPointOccurrences: 250, now: () => 0, familyAgenda });
  const service = new V6AgentService(() => runtime);
  const first = await service.handle({ type: 'init', sessionId: 'store-test', sequence: 0, observation: toV6PublicObservation(board()), budgets: { targetLevels: 3, levelActionCaps: [600, 600, 600] } });
  return { family, runtime, service, first };
}
async function advance(service: V6AgentService, pending: V6AgentResult, sequence = 1) {
  return service.handle({ type: 'advance', sessionId: 'store-test', sequence, ticketId: pending.ticket!.id,
    observation: toV6PublicObservation(board(sequence), sequence), executionMs: 0 });
}
function activation(chain: string, enabled: boolean): NativeGraphEdit {
  return { expectedGraphChain: chain, reason: 'Test the executable family switch', changes: [{ type: 'set_family_enabled', familyId: 'counter', enabled }] };
}
function editedModule() {
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === WORKFLOW)!.module);
  // The actual tree now stops after families.begin; no family callback runs.
  const next = module.workflows[0]!.steps[0]!.statements[1]! as unknown as Record<string, unknown>;
  next.kind = 'STOP';
  next.expression = { kind: 'reference', value: 'session', arguments: [], items: [] };
  return module;
}

test('family state is read from the Kernel graph before the next real plan', async () => {
  const { family, runtime, service, first } = await setup();
  const boundary = await advance(service, first);
  const graph = runtime.inspectKnowledge();
  const stored = hydrateNativeState(graph.nodes['family_state:counter']!.value!, id => graph.nodes[id]!.value) as Record<string, unknown>;
  assert.equal(stored.count, 1); assert.equal(stored.fraction, 0.25);
  assert.ok(graph.nodes['prefix_evidence:1']);
  assert.equal(boundary.snapshot.nodeCount, Object.keys(graph.nodes).length);
  assert.equal(boundary.snapshot.graphChain, graph.chain);
  family.count = 999; family.fraction = 999; family.seen = [999];
  const next = await service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
  assert.equal(next.command!.actionRef, 'ACTION2');
  assert.deepEqual(family.seen, [0, 1]);
  assert.equal(family.fraction, 0.25);
  assert.equal(next.ticket!.graphChain, graph.chain);
  assert.equal(next.ticket!.nativeExecutionDigest, next.snapshot.nativeExecutionDigest);
});

test('the family agenda shadows multiple decisions and an active session honors a stored SRC replacement', async () => {
  const shadow = await setup(1, 'shadow');
  for (let sequence = 0, result = shadow.first; sequence < 2; sequence++) {
    assert.equal(result.snapshot.sicFamilySelection?.matchesSource, true);
    assert.equal(result.snapshot.sicFamilySelection?.selected, 'counter');
    if (sequence === 0) {
      await advance(shadow.service, result);
      result = await shadow.service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
    }
  }
  const active = await setup(1, 'active');
  assert.deepEqual(active.first.command, shadow.first.command);
  assert.equal(active.first.snapshot.sicFamilySelection?.mode, 'active');
  assert.equal((active.first.snapshot as Record<string, unknown>).srcDecision, null);
  const boundary = await advance(active.service, active.first);
  await active.service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: {
    expectedGraphChain: boundary.snapshot.graphChain!, reason: 'Run the replacement selection workflow',
    changes: [{ type: 'replace_program', programId: WORKFLOW, module: editedModule() }],
  } });
  const result = await active.service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
  assert.equal(result.kind, 'stopped');
  assert.equal(result.snapshot.sicFamilySelection, undefined);
  assert.equal((result.snapshot as Record<string, any>).srcDecision.edited, true);
});

test('edits reject an active prefix even when its caller is paused', async () => {
  const { runtime, service, first } = await setup(2);
  const chain = first.snapshot.graphChain!;
  await assert.rejects(service.handle({ type: 'edit', sessionId: 'store-test', sequence: 0, edit: activation(chain, false) }), error => (error as { code: string }).code === 'busy_edit');
  assert.equal(runtime.inspectKnowledge().chain, chain);
  const second = await advance(service, first);
  assert.equal(second.kind, 'action');
  await assert.rejects(runtime.edit(activation(chain, false), NO_WAIT), error => (error as { code: string }).code === 'busy_edit');
  assert.equal((await advance(service, second, 2)).kind, 'boundary');
});

test('a boundary activation edit changes actual selection without resetting evidence', async () => {
  const { runtime, service, first, family } = await setup();
  const boundary = await advance(service, first), oldGraph = runtime.inspectKnowledge();
  const changed = await service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: activation(boundary.snapshot.graphChain!, false) });
  assert.equal(changed.kind, 'boundary'); assert.equal(changed.ticket, null);
  assert.equal(changed.snapshot.actions, 1);
  assert.notEqual(changed.snapshot.graphChain, boundary.snapshot.graphChain);
  assert.notEqual(changed.snapshot.nativeExecutionDigest, boundary.snapshot.nativeExecutionDigest);
  assert.deepEqual(runtime.inspectKnowledge().nodes['family_state:counter'], oldGraph.nodes['family_state:counter']);
  const next = await service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
  assert.equal(next.kind, 'stopped'); assert.equal(next.reason, 'no_applicable_transferred_family');
  assert.equal(next.command, null); assert.deepEqual(family.seen, [0]);
});

test('stored SRC edits execute the revised tree and preserve separate original provenance', async () => {
  const { runtime, service, first, family } = await setup();
  const boundary = await advance(service, first);
  const original = runtime.inspectKnowledge().nodes[`program:${WORKFLOW}`]!;
  const changed = await service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: {
    expectedGraphChain: boundary.snapshot.graphChain!, reason: 'Stop before issuing a family offer',
    changes: [{ type: 'replace_program', programId: WORKFLOW, module: editedModule() }],
  } });
  const replacement = runtime.inspectKnowledge().nodes[`program:${WORKFLOW}`]!;
  assert.deepEqual(replacement.definition, original.definition);
  assert.equal(replacement.revision, original.revision + 1);
  assert.notEqual(changed.snapshot.nativeExecutionDigest, boundary.snapshot.nativeExecutionDigest);
  const next = await service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
  assert.equal(next.kind, 'stopped'); assert.deepEqual(family.seen, [0]);
  const receipt = (next.snapshot as unknown as Record<string, any>).srcDecision;
  assert.equal(receipt.edited, true);
  assert.equal(receipt.instructions, 2);
  assert.equal(receipt.source_definition_hash, (original.definition as Record<string, unknown>).transitive_source_hash);
  assert.equal(receipt.src_hash, receipt.native_execution_hash);
  assert.notEqual(receipt.src_hash, receipt.source_definition_hash);
  assert.deepEqual(receipt.executed_statements, [`${WORKFLOW}.open.s0000`, `${WORKFLOW}.open.s0001`]);
});

test('a family-internal SRC program reads its actual edited node from the same store', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-sequence-reference.json', import.meta.url), 'utf8'));
  const item = fixture.synthetic.find((candidate: any) => candidate.proposal !== null);
  assert.ok(item, 'A qualified public visual sequence is required');
  const visual = new VisualSequences(), store = new NativeKnowledgeStore('visual-native-test', 'visual');
  await visual.attachPrograms(store);
  const original = await visual.propose(item.initial.observation, item.initial.public.frame_rows, item.inputs, 100);
  assert.deepEqual(original, item.proposal);
  const workflow = 'v6.visual_sequences.choose';
  const module = structuredClone(nativeProgramDescriptions().find(program => program.id === workflow)!.module);
  const next = module.workflows[0]!.steps[0]!.statements[1]! as unknown as Record<string, unknown>;
  next.kind = 'STOP'; next.expression = { kind: 'reference', value: 'measured', arguments: [], items: [] };
  const staged = await store.programReplacement(workflow, module);
  await store.commit([staged], CAUSE);
  assert.equal(await visual.propose(item.initial.observation, item.initial.public.frame_rows, item.inputs, 100), null);
  assert.equal(store.node(`program:${workflow}`).revision, 2);
});

test('stale and invalid multi-node edits roll back and preserve a usable session', async () => {
  const { runtime, service, first } = await setup();
  const boundary = await advance(service, first), graph = runtime.inspectKnowledge();
  const valid = activation(boundary.snapshot.graphChain!, false);
  const invalid = { ...valid, changes: [...valid.changes, { type: 'replace_program' as const, programId: WORKFLOW, module: {} }] };
  await assert.rejects(service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: invalid }), error => (error as { code: string }).code === 'invalid_edit');
  assert.equal(runtime.inspectKnowledge(), graph);
  const unregistered = structuredClone(nativeProgramDescriptions().find(program => program.id === WORKFLOW)!.module);
  (unregistered.workflows[0]!.steps[0]!.statements[0]!.expression as unknown as Record<string, unknown>).value = 'host.dispatch';
  await assert.rejects(service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: { ...valid,
    changes: [{ type: 'replace_program', programId: WORKFLOW, module: unregistered }] } }), error => (error as { code: string }).code === 'invalid_edit');
  assert.equal(runtime.inspectKnowledge(), graph);
  await assert.rejects(service.handle({ type: 'edit', sessionId: 'store-test', sequence: 1, edit: activation(first.snapshot.graphChain!, false) }), error => (error as { code: string }).code === 'stale_edit');
  assert.equal(runtime.inspectKnowledge(), graph);
  const next = await service.handle({ type: 'resume', sessionId: 'store-test', sequence: 1 });
  assert.equal(next.kind, 'action'); assert.equal(next.command!.actionRef, 'ACTION2');
});

test('the browser edit/inspection API changes no game state and resumes from revised nodes', async () => {
  const family = new CounterFamily();
  const service = new V6AgentService(() => new NativeV6Runtime({ sourceDigest: 'native-browser-edit', families: [family], maxPointOccurrences: 250 }));
  let current = board(), dispatched = 0;
  const operations: V6AgentOperation[] = [];
  const transport: V6AgentTransport = { request: operation => { operations.push(operation); return service.handle(operation); }, reset() { assert.fail('No session reset'); }, dispose() {} };
  const agent = new BrowserV6Agent({ transport, getObservation: () => current, canDispatch: () => true, onState() {},
    dispatch: async () => { dispatched += 1; current = board(dispatched); return { observation: current, executionMs: 0 }; } });
  await agent.step();
  const session = agent.snapshot.sessionId, graph = await agent.inspectKnowledge();
  assert.equal(agent.snapshot.busy, false);
  await assert.rejects(agent.edit(activation('bad-graph', false)), error => (error as { code: string }).code === 'stale_edit');
  assert.equal(agent.snapshot.requiresNewSession, false);
  await agent.edit(activation(graph.chain!, false));
  assert.equal(agent.snapshot.sessionId, session); assert.equal(dispatched, 1);
  await agent.step();
  assert.equal(dispatched, 1); assert.equal(agent.snapshot.reason, 'no_applicable_transferred_family');
  assert.ok(operations.some(operation => operation.type === 'edit'));
});

test('an action ticket from another graph never reaches the native game', async () => {
  const service = new V6AgentService(() => new NativeV6Runtime({ sourceDigest: 'native-ticket-graph', families: [new CounterFamily()], maxPointOccurrences: 250 }));
  const current = board(); let dispatched = 0;
  const transport: V6AgentTransport = { async request(operation) {
    const result = await service.handle(operation);
    return result.ticket ? { ...result, ticket: { ...result.ticket, graphChain: '0'.repeat(64) } } : result;
  }, reset() {}, dispose() {} };
  const agent = new BrowserV6Agent({ transport, getObservation: () => current, canDispatch: () => true, onState() {}, dispatch: async () => { dispatched += 1; return current; } });
  await agent.step();
  assert.equal(dispatched, 0); assert.equal(agent.snapshot.status, 'error');
});
