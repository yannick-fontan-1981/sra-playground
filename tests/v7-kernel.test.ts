import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonical, digest, equal, immutableJson } from '../src/logos-engine/canonical.ts';
import { blockers, difference, emptyMemory, extreme, intersection, Kernel, less, matching, substitute, unify } from '../src/logos-engine/kernel.ts';
import { V7Runtime } from '../src/logos-engine/v7-runtime.ts';
import type { DeltaCause, KnowledgeMemory, KnowledgeNode } from '../src/logos-engine/kernel.ts';
import type { JsonObject } from '../src/logos-engine/ir.ts';

const bundle = JSON.parse(await readFile(new URL('../reference/v7/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/bundle.json', import.meta.url), 'utf8'));
const configuration = { ...bundle.knowledge, ...bundle.programs, sourceDigest: 'test:typescript-v7' };
const cause: DeltaCause = { workflow: 'prototype.test', step: 'prototype.test.step', statement: 'prototype.test.step.s0000' };

test('canonical bytes match Python, preserving Unicode order and typed scalars', async () => {
  const input = { '\u{10000}': 2, '\ue000': 1, é: true, a: 'line\n"' };
  assert.equal(canonical(input), '{"a":"line\\n\\\"","é":true,"\ue000":1,"𐀀":2}');
  // Python 3 json.dumps(ensure_ascii=False, sort_keys=True, separators=(',', ':')).
  assert.equal(await digest(input), 'e007125c4f3681b0ff239d11d6a9a7495a19d05f8336022af47d4d6a161802bb');
  assert.equal(equal(true, 1), false);
  assert.equal(equal({ present: false }, {}), false);
  assert.equal(equal({ present: null }, { present: false }), false);
  for (const unsupported of [0.5, -0, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, '\ud800']) {
    assert.throws(() => canonical(unsupported));
  }
  assert.deepEqual(immutableJson({ unusedMetadata: 0.5 }), { unusedMetadata: 0.5 });
});

test('immutable JSON rejects executable/accessor data and shares trusted subtrees', () => {
  const shared = immutableJson({ a: [1, true] });
  const combined = immutableJson({ left: shared, right: shared });
  assert.equal(combined.left, shared);
  assert.equal(combined.right, shared);
  assert.ok(Object.isFrozen(shared.a));
  const getterArray = [1];
  Object.defineProperty(getterArray, '0', { get: () => { throw new Error('Must not execute'); }, enumerable: true });
  assert.throws(() => immutableJson(getterArray), /data properties/);
  assert.throws(() => canonical(getterArray), /data properties/);
  assert.throws(() => immutableJson(Object.defineProperty({}, 'hidden', { value: 1 })), /data properties/);
  assert.throws(() => immutableJson({ [Symbol('hidden')]: 1 }), /symbol/);
  assert.throws(() => immutableJson([, 1]), /Sparse/);
  const cyclic: unknown[] = []; cyclic.push(cyclic);
  assert.throws(() => immutableJson(cyclic), /Cyclic/);
});

test('graph revisions retain history and provenance without copying unchanged nodes', async () => {
  const kernel = new Kernel(configuration.logos, configuration.drm, configuration.sourceDigest);
  const observation = bundle.scenarios[0].events[0].event.after;
  const identity = await kernel.identity('observation', [['observation', observation]]);
  const initial = emptyMemory();
  const first = await kernel.emit(initial, 'observation', [['observation', observation]], cause);
  assert.equal(first.nodes[identity].revision, 1);
  assert.equal(first.nodes[identity].origin.statement, cause.statement);
  assert.deepEqual(first.deltas[0].cause, cause);
  assert.equal(first.deltas[0].previous, null);
  assert.deepEqual(initial, { nodes: {}, deltas: [], chain: null });
  assert.equal(await kernel.emit(first, 'observation', [['observation', observation]], cause), first);
  assert.equal(await kernel.assign(first, identity, 'status', 'observed', cause), first);
  const nextObservation = { ...observation, id: `${observation.id}:other` };
  const second = await kernel.emit(first, 'observation', [['observation', nextObservation]], cause);
  assert.equal(second.nodes[identity], first.nodes[identity]);
  assert.equal(second.deltas[0], first.deltas[0]);
  const revised = await kernel.appendUnique(second, identity, 'evidence', 'witness:1', cause);
  assert.equal(revised.nodes[identity].revision, 2);
  assert.deepEqual(first.nodes[identity].evidence, []);
  assert.equal(await kernel.appendUnique(revised, identity, 'evidence', 'witness:1', cause), revised);
  const delta = revised.deltas.at(-1)!;
  const { digest: recorded, ...payload } = delta;
  assert.equal(recorded, await digest(payload));
  assert.equal(delta.previous, second.chain);
  assert.ok(Object.isFrozen(revised.nodes[identity]));
  assert.throws(() => { (revised.nodes[identity] as unknown as Record<string, unknown>).status = 'contradicted'; }, TypeError);
  for (const field of ['id', 'kind', 'revision', 'origin', 'scope']) {
    await assert.rejects(kernel.assign(revised, identity, field, 'invalid', cause), /Immutable/);
  }
  await assert.rejects(kernel.assign(revised, identity, 'newField', true, cause), /Undeclared/);
  await assert.rejects(kernel.assign(revised, identity, 'status', 'truth', cause), /Logos contract/);
});

test('all 22 pure operations are registered and mutation provenance comes from actual CALL context', async () => {
  const kernel = new Kernel(configuration.logos, configuration.drm, configuration.sourceDigest);
  assert.equal(Object.keys(kernel.primitives).length, 22);
  const context = { workflowId: 'source.workflow', stepId: 'source.workflow.step', statementId: 'source.workflow.step.s0014' };
  const observation = bundle.scenarios[0].events[0].event.after;
  const memory = await kernel.primitives['v7.emit']({ memory: emptyMemory(), template: 'observation', bindings: [['observation', observation]] }, context) as KnowledgeMemory;
  assert.deepEqual(memory.deltas[0].cause, { workflow: context.workflowId, step: context.stepId, statement: context.statementId });
  await assert.rejects(async () => kernel.primitives['v7.emit']({ memory, template: 'observation', bindings: [], cause: {} }, context), /requires exactly/);
  assert.equal(await kernel.primitives['v7.contains']({ items: [true], value: 1 }, context), false);
  assert.equal(await kernel.primitives['v7.absent']({ memory, identity: 'missing' }, context), true);
  assert.equal(await kernel.primitives['v7.nonempty']({ items: {} }, context), false);
  assert.equal(await kernel.primitives['v7.count_matching']({ items: [{ a: true }, { a: 1 }, {}], selectors: [['a', true]] }, context), 1);
  assert.deepEqual(await kernel.primitives['v7.concatenate']({ left: [1], right: [2] }, context), [1, 2]);
  assert.equal(await kernel.primitives['v7.get']({ mapping: { a: false }, key: 'a' }, context), false);
  await assert.rejects(async () => kernel.primitives['v7.get']({ mapping: {}, key: 'a' }, context), /Missing/);
});

test('unknown fields stay unknown; matching, ordering and substitution preserve scalar types', () => {
  assert.deepEqual(difference({ a: false, b: 0 }, { a: false, b: 1 }), { b: 1 });
  assert.throws(() => difference({ a: false }, {}), /Changing observation field domain/);
  assert.deepEqual(intersection({ a: true, b: 0 }, { a: 1, b: 0 }), { b: 0 });
  assert.deepEqual(matching([{ key: false }, {}, { key: 0 }], [['key', false]]), [{ key: false }]);
  assert.equal(less([2, 'a'], [2, 'b']), true);
  assert.equal(less('\ue000', '\u{10000}'), true);
  assert.throws(() => less(true, 1), /compatible/);
  assert.deepEqual(extreme([{ n: 1 }, { n: 2, tie: 'a' }, { n: 2, tie: 'b' }], 'n', true), [{ n: 2, tie: 'a' }, { n: 2, tie: 'b' }]);
  assert.deepEqual(extreme([{ n: true }, { n: 1 }], 'n', true), [{ n: true }]);
  assert.deepEqual(substitute({ nested: ['$item.active', '$empty'] }, [['item', { active: false }], ['empty', null]]), { nested: [false, null] });
  assert.throws(() => substitute('$item.absent', [['item', {}]]), /Missing/);
});

test('unification has separate namespaces, typed constants, and an occurs check', () => {
  assert.deepEqual(unify({ variable: 'x' }, { variable: 'x' }), { matched: true, bindings: [['first.x', ['variable', 'second.x']]] });
  assert.deepEqual(unify({ variable: 'x' }, [1, 2]), { matched: true, bindings: [['first.x', ['sequence', [['constant', 'int', 1], ['constant', 'int', 2]]]]] });
  assert.deepEqual(unify([true], [1]), { matched: false, bindings: [] });
  // x = y and x = f(y) would create a cycle across the two namespaces.
  assert.deepEqual(unify([{ variable: 'x' }, { variable: 'x' }], [{ variable: 'y' }, [{ variable: 'y' }]]), { matched: false, bindings: [] });
});

test('availability follows only declared dependencies, terminates cycles, and does not change truth', () => {
  const node = (id: string, kind: string, members: string[], evidence: string[] = []): KnowledgeNode => ({
    id, kind, revision: 1, status: 'candidate', scope: 'test', origin: {}, evidence, members,
  });
  const memory = immutableJson({ nodes: {
    a: node('a', 'composition', ['b'], ['missingEvidence']),
    b: node('b', 'composition', ['a', 'missingDependency']),
    h: node('h', 'hypothesis', []),
  }, deltas: [], chain: null }) as KnowledgeMemory;
  const dependencies = { composition: ['members'] };
  assert.deepEqual(blockers(memory, 'a', { disabled_nodes: [], disabled_kinds: [] }, dependencies), [{ node: 'missingDependency', reason: 'missing_dependency' }]);
  assert.deepEqual(blockers(memory, 'a', { disabled_nodes: ['b'], disabled_kinds: [] }, dependencies), [{ node: 'b', reason: 'disabled_node' }]);
  assert.deepEqual(blockers(memory, 'h', { disabled_nodes: [], disabled_kinds: ['hypothesis'] }, dependencies), [{ node: 'h', reason: 'disabled_kind' }]);
  assert.equal(memory.nodes.a.status, 'candidate');
});

test('node budget fails closed without a partially appended revision', async () => {
  const drm = { ...bundle.knowledge.drm, limits: { ...bundle.knowledge.drm.limits, nodes: 1 } };
  const kernel = new Kernel(bundle.knowledge.logos, drm, 'test');
  const observation = bundle.scenarios[0].events[0].event.after;
  const first = await kernel.emit(emptyMemory(), 'observation', [['observation', observation]], cause);
  await assert.rejects(kernel.emit(first, 'observation', [['observation', { ...observation, id: 'second' }]], cause), /node budget/);
  assert.equal(first.deltas.length, 1);
  assert.equal(Object.keys(first.nodes).length, 1);
});

test('observation boundary rejects private extras, floats, missing domains, and identity rebinding', async () => {
  const runtime = new V7Runtime(configuration);
  const first = bundle.scenarios[0].events[0].event;
  await assert.rejects(runtime.advance({ ...first, gameSource: 'private' }), /exactly/);
  await assert.rejects(runtime.advance({ ...first, after: { ...first.after, values: { a: null } } }), /null is unknown/);
  await assert.rejects(runtime.advance({ ...first, after: { ...first.after, values: { a: 0.25 } } }), /safe integers/);
  await runtime.advance(first);
  const committed = runtime.memory;
  await assert.rejects(runtime.advance({ ...first, after: { ...first.after, values: { ...first.after.values, 'measure.a': 9 } } }), /identity was rebound/);
  assert.equal(runtime.memory, committed);
  assert.equal(runtime.sequence, 1);
  assert.equal(runtime.receipts.length, 1);
});

test('budget failure and cancellation retain the committed graph; successful trace is from actual IR', async () => {
  const runtime = new V7Runtime(configuration);
  const event = bundle.scenarios[0].events[0].event;
  const initial = runtime.memory;
  await assert.rejects(runtime.advance(event, { maxInstructions: 3 }), /instruction limit/i);
  assert.equal(runtime.memory, initial);
  assert.equal(runtime.sequence, 0);
  assert.equal(runtime.receipts.length, 0);
  assert.ok(runtime.lastTrace.length <= 3);
  const controller = new AbortController();
  const pending = runtime.advance(event, { signal: controller.signal, yieldEvery: 1 });
  controller.abort();
  await assert.rejects(pending, /cancel/i);
  assert.equal(runtime.memory, initial);
  assert.equal(runtime.sequence, 0);
  const receipt = await runtime.advance(event);
  assert.equal(receipt.instructions, receipt.trace.length);
  const ids = new Set(bundle.programs.generators.source_map.map((entry: { node_id: string }) => entry.node_id));
  assert.ok(receipt.trace.every(entry => ids.has(entry.statementId) && entry.status === 'completed'));
  assert.ok(runtime.memory.deltas.every(delta => ids.has(delta.cause.statement)));
});

test('activation preserves retained evidence and rolls back both configuration and reconsideration on failure', async () => {
  const runtime = new V7Runtime(configuration);
  for (const { event } of bundle.scenarios[0].events.slice(0, 3)) await runtime.advance(event);
  const hypothesis = Object.values(runtime.memory.nodes).find(node => node.kind === 'hypothesis')!;
  const composition = Object.values(runtime.memory.nodes).find(node => node.kind === 'composition')!;
  const before = runtime.memory;
  // Four instructions finish configuration; reconsideration then exhausts the same bound.
  await assert.rejects(runtime.setActivation({ disabledNodes: [hypothesis.id], reason: 'Bounded failed ablation' }, { maxInstructions: 4 }), /instruction limit/i);
  assert.equal(runtime.memory, before);
  assert.equal(runtime.sequence, 3);
  assert.equal(runtime.activationReceipts.length, 0);
  const receipt = await runtime.setActivation({ disabledNodes: [hypothesis.id], reason: 'Inspect one dependency' });
  assert.ok(receipt.reconsideration);
  assert.equal(runtime.memory.nodes[hypothesis.id], hypothesis);
  const view = await runtime.availability();
  const blocked = (view.nodes as readonly JsonObject[]).find(node => node.id === composition.id)!;
  assert.deepEqual(blocked.blockers, [{ node: hypothesis.id, reason: 'disabled_node' }]);
  await runtime.setActivation({ reason: 'Restore availability' });
  const restored = await runtime.availability();
  assert.deepEqual((restored.nodes as readonly JsonObject[]).find(node => node.id === composition.id)!.blockers, []);
  assert.equal(runtime.memory.nodes[hypothesis.id].status, 'candidate');
});
