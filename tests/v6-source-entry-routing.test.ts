import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativePublicObservation } from '../src/logos-engine/v6-native-types.ts';
import { rowsDigest } from '../src/logos-engine/v6-native-observer.ts';

// These are adapter-contract cases. The real graph planner and common WHY/ACT
// caller are exercised separately against unchanged-source observations.
const rows = Array.from({ length: 8 }, () => Array<number>(8).fill(0));
const packet: NativePublicObservation = {
  frame_rows: rows, frame_packet: [rows], frame_hash: await rowsDigest(rows),
  level: 1, levels_completed: 0, state: 'NOT_FINISHED', step_index: 0,
  available_action_refs: ['ACTION1'],
};
const execution = { yieldControl: async () => {} };

function shared(refusal = false) {
  const visited: string[] = [], records: number[] = [];
  const family: NativeFamily = {
    id: 'shared-source-owner',
    propose: () => { assert.fail('An explicit source entry must use its subquestion adapter'); },
    proposeInGroup: () => { assert.fail('A group fallback must not replace an explicit source entry'); },
    proposeInSubquestion: (group, question) => {
      assert.equal(group, 'goal_access'); visited.push(question);
      if (refusal) return { status: 'abstained', kind: 'causal_refusal', actions: [], block_unrelated_probe: true };
      if (question === 'first_source_question') return null;
      return { status: 'proposed', kind: 'adapter_contract', actions: [{ action_ref: 'ACTION1', data: {} }], steps: [{}] };
    },
    before: () => ({ admitted: true, reason: 'current' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'witnessed' }),
    record: (_before, _after, _command, _rows, _later, _proposal, index) => { records.push(index); return { events: [] }; },
    state: () => ({ records: [...records] }),
    restore: state => { records.splice(0, records.length, ...(state.records as number[])); },
  };
  return { family, visited, records };
}
function make(family: NativeFamily, groups: { id: string; families: string[]; entryPoints?: (string | null)[] }[]) {
  return new NativeV6Runtime({ sourceDigest: 'source-entry-routing-contract-v36', now: () => 0,
    families: [family], groups, maxPointOccurrences: 64 });
}
function entries(id: string) {
  return [{ id: 'goal_access', families: [id, id], entryPoints: ['first_source_question', 'second_source_question'] }];
}
function initialize(runtime: NativeV6Runtime, sessionId: string) {
  return runtime.initialize({ sessionId, observation: packet, budgets: { targetLevels: 1, levelActionCaps: [3], maxActions: 3 } }, execution);
}

test('two source entries preserve priority while sharing one acquisition and one retained owner', async () => {
  const { family, visited, records } = shared(), runtime = make(family, entries(family.id));
  const first = await initialize(runtime, 'source-entry-order');
  assert.equal(first.kind, 'action');
  assert.deepEqual(visited, ['first_source_question', 'second_source_question']);
  assert.deepEqual(records, [], 'Offering both entries must not learn a transition');
  const coverage = first.snapshot.coverage as Record<string, any>;
  assert.deepEqual(coverage.registeredFamilies, [family.id]);
  assert.deepEqual(Object.keys(first.snapshot.familyStateRefs as object), [family.id]);
  const after = await runtime.advance({ command: first.command!, observation: { ...packet, step_index: 1 }, executionMs: 1 }, execution);
  assert.equal(after.kind, 'boundary');
  assert.deepEqual(records, [0], 'One physical transition is acquired once, despite two selection entries');
  assert.equal(after.snapshot.acquiredRecords, 1);
});

test('a refusal at the earlier source entry stops the later entry', async () => {
  const { family, visited, records } = shared(true), runtime = make(family, entries(family.id));
  const result = await initialize(runtime, 'source-entry-refusal');
  assert.equal(result.kind, 'stopped'); assert.equal(result.reason, 'frontier_abstained');
  assert.deepEqual(visited, ['first_source_question']);
  assert.deepEqual(records, []); assert.equal(result.snapshot.actions, 0);
});

test('source-entry wiring rejects missing adapters, misalignment and malformed entries', () => {
  const { family } = shared();
  assert.throws(() => make({ ...family, proposeInSubquestion: undefined }, entries(family.id)), /aligned subquestion adapter/);
  for (const entryPoints of [[], ['first_source_question'], ['first_source_question', ''], ['first_source_question', 7]]) {
    assert.throws(() => make(family, [{ id: 'goal_access', families: [family.id, family.id], entryPoints: entryPoints as string[] }]), /aligned subquestion adapter/);
  }
});
