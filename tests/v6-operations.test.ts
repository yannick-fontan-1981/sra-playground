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
      { composition_ref: 'B', property: 'empty-proof', value: true, revision: 1, evidence: [] },
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


test('OP06 detects attributed effect exceptions without inventing a cause', () => {
  const s = state();
  Object.assign(s, {
    observations: [
      { composition: 'B', after: { color: 'red' } },
      { composition: 'B', after: { color: 'blue' } },
      { composition: 'C', after: { door: 'closed' } },
    ],
  });
  assert.deepEqual(executeOperation('OP06', s).value, [
    { composition: 'B', after: { color: 'red' } },
  ]);
});

test('OP07 selects only reachable unvisited frontiers linked to an open goal', () => {
  const s = state();
  Object.assign(s, {
    frontiers: [
      { id: 'f1', reachable: true, visited: false, open_goal_evidence: ['g'] },
      { id: 'f2', reachable: false, visited: false, open_goal_evidence: ['g'] },
      { id: 'f3', reachable: true, visited: true, open_goal_evidence: ['g'] },
      { id: 'f4', reachable: true, visited: false, open_goal_evidence: [] },
    ],
  });
  assert.deepEqual(executeOperation('OP07', s).value, [
    { id: 'f1', reachable: true, visited: false, open_goal_evidence: ['g'] },
  ]);
});

test('OP13 preserves unknown extent beyond observed effects', () => {
  const s = state();
  Object.assign(s, {
    observations: [
      { composition: 'B', after: { color: 'red' } },
      { composition: 'C', after: { door: 'open' } },
    ],
  });
  assert.deepEqual(executeOperation('OP13', s).value, {
    observed_effects: [{ color: 'red' }],
    unobserved_extent: 'unknown',
  });
});

test('OP20 and OP21 expose only unknown utility hypotheses', () => {
  const s = state();
  Object.assign(s, {
    entities: [
      { id: 'e1', utility: 'unknown', question: 'useful?' },
      { id: 'e2', utility: 'known', question: 'irrelevant' },
    ],
    spaces: [
      { id: 's1', utility: 'unknown', question: 'worth exploring?' },
      { id: 's2', utility: 'known' },
    ],
  });
  assert.deepEqual(executeOperation('OP20', s).value, [
    { entity: 'e1', status: 'utility_hypothesis', question: 'useful?' },
  ]);
  assert.deepEqual(executeOperation('OP21', s).value, [
    { space: 's1', status: 'utility_hypothesis', question: 'worth exploring?' },
  ]);
});

test('OP22 retains only remote effects with an observation', () => {
  const s = state();
  Object.assign(s, {
    remote_effects: [
      { id: 'r1', observation: 'obs-1', effect: 'door-open' },
      { id: 'r2', effect: 'light-change' },
    ],
  });
  assert.deepEqual(executeOperation('OP22', s).value, [
    { id: 'r1', observation: 'obs-1', effect: 'door-open' },
  ]);
});

test('OP23 predicts only proved cycles and keeps unproved autonomy unknown', () => {
  const s = state();
  Object.assign(s, {
    entities: [
      { id: 'clock', cycle: ['a', 'b', 'c'], cycle_proof: 'obs-cycle', phase: 0 },
      { id: 'wanderer', autonomous: true },
      { id: 'empty-cycle', cycle: [], cycle_proof: 'claimed' },
      { id: 'static' },
    ],
  });
  assert.deepEqual(executeOperation('OP23', s).value, [
    { entity: 'clock', next: 'b', evidence: 'obs-cycle' },
    { entity: 'wanderer', next: 'unknown', evidence: undefined },
  ]);
});

test('OP16 accepts only proved global deadlocks and states its completeness limit', () => {
  const s = state();
  Object.assign(s, {
    deadlocks: [
      { id: 'd1', proof: 'p', scope: 'global' },
      { id: 'd2', proof: 'p', scope: 'local' },
      { id: 'd3', scope: 'global' },
    ],
  });
  const result = executeOperation('OP16', s);
  assert.deepEqual(result.value, [{ id: 'd1', proof: 'p', scope: 'global' }]);
  assert.equal(result.completeness, 'only supplied proved deadlocks; absence does not prove safety');
});

test('OP17 accepts only authorized recoveries with verified preservation', () => {
  const s = state();
  Object.assign(s, {
    recovery: [
      { id: 'r1', authorized: true, preserve_verified: true },
      { id: 'r2', authorized: true, preserve_verified: false },
      { id: 'r3', authorized: false, preserve_verified: true },
    ],
  });
  assert.deepEqual(executeOperation('OP17', s).value, [
    { id: 'r1', authorized: true, preserve_verified: true },
  ]);
});

test('OP19 returns only the proved forced prefix and becomes incomplete at the first gap', () => {
  const s = state();
  Object.assign(s, {
    forced: [
      { action: 'ACTION1', proof: 'p1', constraints_verified: true },
      { action: 'ACTION2', proof: '', constraints_verified: true },
      { action: 'ACTION3', proof: 'p3', constraints_verified: true },
    ],
  });
  const result = executeOperation('OP19', s);
  assert.equal(result.status, 'incomplete');
  assert.deepEqual(result.value, ['ACTION1']);
});

test('OP24 selects only verified paths reaching the desired post-state', () => {
  const s = state();
  Object.assign(s, {
    desired_post_state: { room: 2 },
    paths: [
      { id: 'p1', post_state: { room: 2 }, constraints_verified: true },
      { id: 'p2', post_state: { room: 2 }, constraints_verified: false },
      { id: 'p3', post_state: { room: 3 }, constraints_verified: true },
    ],
  });
  assert.deepEqual(executeOperation('OP24', s).value, ['p1']);
});

test('OP27 requires target, verified constraints and every protected reference', () => {
  const s = state();
  s.preserve_refs = ['A', 'C'];
  s.permutations = [
    { id: 'ok', target: 'B', constraints_verified: true, preserved_refs: ['A', 'C'] },
    { id: 'missing', target: 'B', constraints_verified: true, preserved_refs: ['A'] },
    { id: 'unverified', target: 'B', constraints_verified: false, preserved_refs: ['A', 'C'] },
    { id: 'other', target: 'C', constraints_verified: true, preserved_refs: ['A', 'C'] },
  ];
  assert.deepEqual(executeOperation('OP27', s).value, ['ok']);
});


test('OP01 groups compositions only when the full declared structural signature matches', () => {
  const s = state();
  s.compositions.push({
    id: 'A2',
    requires: {},
    effect: { free: true },
    observed: false,
  });
  const groups = executeOperation('OP01', s).value as string[][];
  assert.ok(groups.some(group => group.includes('A') && group.includes('A2')));
  assert.equal(groups.some(group => group.includes('A') && group.includes('B')), false);
});

test('OP04 reports compositions opened by the focused effect without claiming realizability', () => {
  const s = state();
  assert.deepEqual(executeOperation('OP04', s).value, {
    composition: 'B',
    opens: ['C'],
  });
});

test('OP11 exposes the supplied effect-to-requirement links without authorizing a plan', () => {
  const s = state();
  assert.deepEqual(executeOperation('OP11', s).value, {
    A: ['B'],
    B: ['C'],
  });
});
