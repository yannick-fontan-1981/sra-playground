import assert from 'node:assert/strict';
import test from 'node:test';
import { executeOperation } from '../src/logos-engine/v6-operations.ts';

function state() {
  return {
    focus: 'B', observation_revision: 1,
    facts: { free: true, color: 'blue' }, preserve: { color: 'blue' }, preserve_refs: ['A'],
    compositions: [
      { id: 'A', requires: {}, effect: { free: true }, observed: true },
      { id: 'B', requires: { free: true, key: true }, effect: { color: 'blue' }, observed: false, open_question: 'what happens?', candidate_objective: true, feasibility: 'unknown' },
      { id: 'C', requires: { color: 'blue' }, effect: { door: 'open' }, depends_on: ['B'] },
    ],
    alternatives: [['A', 'B'], ['A', 'C']], alternatives_complete: true,
    bundles: [{ id: 'bundle', composition_ref: 'B', admitted: true, actions: ['ACTION1'] }],
    accesses: [{ id: 'route', target: 'B', constraints_verified: true }],
    permutations: [{ id: 'swap', target: 'B', constraints_verified: true, preserved_refs: ['A'] }],
    expected_properties: { orientation: 1, color: 'blue', door: 'open' },
    observed_properties: { orientation: 1, color: 'red' },
    knowledge_updates: [
      { composition_ref: 'B', property: 'color', value: 'red', revision: 1, evidence: 'obs1' },
      { composition_ref: 'B', property: 'door', value: 'open', revision: 0, evidence: 'old' },
    ],
    objective_assessments: [{ composition_ref: 'G', satisfied: false, feasible: 'unknown', new_evidence: ['obs1'] }],
  };
}

test('OP03 preserves unknown instead of turning missing evidence into false', () => {
  assert.deepEqual(executeOperation('OP03', state()).value, {
    composition: 'B', preconditions: { free: true, key: 'unknown' },
  });
});

test('OP09 requires a complete alternative domain', () => {
  const s = state();
  assert.deepEqual(executeOperation('OP09', s).value, ['A']);
  s.alternatives_complete = false;
  const incomplete = executeOperation('OP09', s);
  assert.equal(incomplete.status, 'incomplete');
  assert.deepEqual(incomplete.value, { mandatory: null, reason: 'alternative domain not proven complete' });
});

test('OP18 and OP28 select only an open question and an admitted non-empty bundle', () => {
  assert.deepEqual(executeOperation('OP18', state()).value, ['B']);
  assert.deepEqual(executeOperation('OP28', state()).value, ['bundle']);
});

test('OP29 distinguishes confirmed, refuted and unknown', () => {
  assert.deepEqual(executeOperation('OP29', state()).value, {
    orientation: { expected: 1, observed: 1, status: 'confirmed' },
    color: { expected: 'blue', observed: 'red', status: 'refuted' },
    door: { expected: 'open', observed: undefined, status: 'unknown' },
  });
});

test('OP30 filters stale updates and OP31 preserves unknown feasibility', () => {
  assert.deepEqual(executeOperation('OP30', state()).value, [
    { composition_ref: 'B', property: 'color', value: 'red', revision: 1, evidence: 'obs1' },
  ]);
  assert.deepEqual(executeOperation('OP31', state()).value, [
    { composition_ref: 'G', satisfied: false, feasible: 'unknown', new_evidence: ['obs1'] },
  ]);
});


test('OP08 finds only compositions whose effects satisfy a requirement of the focus', () => {
  assert.deepEqual(executeOperation('OP08', state()).value, ['A']);
});

test('OP12 preserves unknown requirements while traversing declared dependencies', () => {
  const s = state();
  s.compositions[1] = { ...s.compositions[1], depends_on: ['C'] };
  assert.deepEqual(executeOperation('OP12', s).value, {
    unknowns: { B: ['key'] },
    visited: ['B', 'C'],
  });
});

test('OP26 selects only verified accesses targeting the focused composition', () => {
  const s = state();
  s.accesses = [
    { id: 'route', target: 'B', constraints_verified: true },
    { id: 'unverified', target: 'B', constraints_verified: false },
    { id: 'other-target', target: 'C', constraints_verified: true },
  ];
  assert.deepEqual(executeOperation('OP26', s).value, ['route']);
});


test('OP02 keeps incomplete paths out of proven equivalence groups', () => {
  const s = state();
  Object.assign(s, {
    paths: [
      { id: 'p1', post_state_complete: true, post_state: { room: 2 }, constraints_verified: true },
      { id: 'p2', post_state_complete: true, post_state: { room: 2 }, constraints_verified: true },
      { id: 'p3', post_state_complete: false, post_state: { room: 2 }, constraints_verified: true },
    ],
  });
  const result = executeOperation('OP02', s);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.value, [['p1', 'p2'], ['p3']]);
});

test('OP05 exposes same-effect ambiguity without choosing a winner', () => {
  const s = state();
  s.compositions[2] = { ...s.compositions[2], effect: { color: 'blue' } };
  assert.deepEqual(executeOperation('OP05', s).value, [['B', 'C']]);
});

test('OP10 and OP15 distinguish terminal goals from ready intermediate goals', () => {
  const s = state();
  Object.assign(s, {
    goals: [
      { id: 'G-final', composition: 'G', terminal: true, completed: false, requires: {} },
      { id: 'G-mid', composition: 'B', terminal: false, completed: false, requires: { free: true } },
      { id: 'G-unmet', composition: 'C', terminal: false, completed: false, requires: { missing: true } },
      { id: 'G-done', composition: 'A', terminal: false, completed: true, requires: { free: true } },
    ],
  });
  assert.deepEqual(executeOperation('OP10', s).value, ['G']);
  assert.deepEqual(executeOperation('OP15', s).value, ['G-mid']);
});

test('OP25 retains non-refuted candidate objectives but does not prove feasibility', () => {
  const s = state();
  s.compositions[2] = { ...s.compositions[2], candidate_objective: true, feasibility: 'refuted' };
  assert.deepEqual(executeOperation('OP25', s).value, ['B']);
});
