import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { maximumInjectiveMatching, normalizePopulationPhysicalState, PopulationPrerequisite,
  PopulationWorkBudget, PopulationWorkInterrupted, selectedCardinalPopulationStep } from '../src/logos-engine/v5-reference-population-calculus.ts';

type R = Record<string, any>;
const fixture: R = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reference-population-reference.json.gz', import.meta.url))).toString());
const clone = <T>(value: T): T => structuredClone(value);

for (const item of fixture.matchingCases as R[]) {
  test('original V5 injective witness ' + item.id, () => {
    const domains = clone(item.arguments.domains), visits: unknown[] = [];
    assert.deepEqual(maximumInjectiveMatching(domains, (index, reference) => visits.push([index, clone(reference)])), item.expected);
    assert.deepEqual(visits, item.visits, 'each repeated or rejected edge is still charged in source order');
    assert.deepEqual(domains, item.arguments.domains);
  });
}

for (const item of fixture.physicalCases as R[]) {
  test('original consumed V5 population step ' + item.id, () => {
    const args = clone(item.arguments), budget = new PopulationWorkBudget(args.bounds ?? {});
    const invoke = () => selectedCardinalPopulationStep(args.model, args.state, args.primitive, budget);
    if (item.expectedError) {
      assert.throws(invoke, error => {
        assert.ok(error instanceof Error);
        if (item.expectedError.type === 'NeighborhoodPrerequisite') {
          assert.ok(error instanceof PopulationPrerequisite);
          assert.equal(error.message, item.expectedError.message);
        } else if (item.expectedError.type === 'DComputationInterrupted') {
          assert.ok(error instanceof PopulationWorkInterrupted);
          assert.equal(error.cause, item.expectedError.cause ?? item.expectedError.message);
        } else if (item.expectedError.type === 'ValidationError') {
          assert.ok(error instanceof TypeError || error instanceof RangeError,
            'Pydantic invalid models are refused in the separately qualified native portable domain');
        } else assert.fail('Unexpected source exception kind: ' + item.expectedError.type);
        return true;
      });
    } else assert.deepEqual(invoke(), item.expected);
    assert.equal(budget.examined, item.examined);
    assert.deepEqual(args, item.arguments, 'the calculation cannot change supplied evidence');
  });
}

test('maximum witness cardinality agrees with independent exhaustive assignments on all three-by-three domains', () => {
  // Enumerate every bipartite edge set; derive the best size by choosing every
  // legal assignment, independently of an augmenting-path implementation.
  for (let bits = 0; bits < 512; bits++) {
    const domains = Array.from({ length: 3 }, (_, index) => [0, 1, 2].filter(ref => bits & (1 << (index * 3 + ref))));
    let optimum = 0;
    for (const a of [-1, ...domains[0]!]) for (const b of [-1, ...domains[1]!]) for (const c of [-1, ...domains[2]!]) {
      const present = [a, b, c].filter(ref => ref !== -1);
      if (new Set(present).size === present.length) optimum = Math.max(optimum, present.length);
    }
    const [assigned, unfilled] = maximumInjectiveMatching(domains);
    assert.equal(assigned.length, optimum, 'edge set ' + bits);
    assert.equal(new Set(assigned.map(([index]) => index)).size, assigned.length);
    assert.equal(new Set(assigned.map(([, ref]) => ref)).size, assigned.length);
    assert.ok(assigned.every(([index, ref]) => domains[index]!.includes(ref)));
    assert.deepEqual(unfilled, [0, 1, 2].filter(index => !assigned.some(([owner]) => owner === index)));
  }
});

test('matching uses tuple value identity, detaches its witness and propagates interruption without a partial result', () => {
  const domains = [[[2, 10], [-1, 3]], [[2, 10]]], original = clone(domains);
  const [assigned, missing] = maximumInjectiveMatching(domains);
  assert.deepEqual(assigned, [[0, [-1, 3]], [1, [2, 10]]]); assert.deepEqual(missing, []);
  assigned[0]![1][0] = -999; assert.deepEqual(domains, original);
  const interrupted = new PopulationWorkInterrupted('NODE_BOUND', { index: 0 });
  assert.throws(() => maximumInjectiveMatching(domains, () => { throw interrupted; }), error => error === interrupted);
  assert.throws(() => maximumInjectiveMatching([[Number.NaN]]), RangeError);
  assert.throws(() => maximumInjectiveMatching([[Number.MAX_SAFE_INTEGER + 1]]), RangeError);
  const cyclic: any[] = []; cyclic.push(cyclic);
  assert.throws(() => maximumInjectiveMatching([[cyclic]]), TypeError);
});

test('portable population state preserves member order, normalizes Ref whitespace and returns detached ownership', () => {
  const state = { occurrences: [{ occurrence_ref: ' b ', cell: [1, 0] }, { occurrence_ref: ' a ', cell: [0, 0] }],
    active_occurrence_ref: ' a ', reserve: 0, terminated: false };
  const normalized = normalizePopulationPhysicalState(state);
  assert.deepEqual(normalized.occurrences.map(item => item.occurrence_ref), ['b', 'a']);
  assert.equal(normalized.active_occurrence_ref, 'a');
  const input = clone(state), model = { movement_cells: [[0, 0], [0, 1], [1, 0]], motion_law_ref: 'collision_checked_cardinal_step' };
  const result = selectedCardinalPopulationStep(model, input, { kind_ref: 'move', delta: [0, 1] });
  assert.deepEqual(result.state.occurrences, [{ occurrence_ref: 'b', cell: [1, 0] }, { occurrence_ref: 'a', cell: [0, 1] }]);
  assert.equal(result.changed_identity_ref, 'a');
  result.state.occurrences[0]!.cell[0] = -999;
  assert.deepEqual(input, state);
  assert.deepEqual(model.movement_cells, [[0, 0], [0, 1], [1, 0]]);
});

test('native work interruption is separate from source node and time ceilings', () => {
  let clock = 10, stop = false;
  const frontier = { occurrence_ref: 'member' }, budget = new PopulationWorkBudget({ now: () => clock, time_bound_ms: 20,
    node_bound: 2, deadlineMs: 25, shouldStop: () => stop });
  budget.visit(frontier); assert.equal(budget.examined, 1);
  clock = 25;
  assert.throws(() => budget.visit(frontier), error => error instanceof PopulationWorkInterrupted && error.cause === 'NATIVE_INTERRUPTION');
  assert.equal(budget.examined, 1);
  const stopped = new PopulationWorkBudget({ now: () => 0, shouldStop: () => true });
  assert.throws(() => stopped.visit(), error => error instanceof PopulationWorkInterrupted && error.cause === 'NATIVE_INTERRUPTION');
  const timed = new PopulationWorkBudget({ now: () => clock, time_bound_ms: 3 });
  clock += 3;
  assert.throws(() => timed.finish(), error => error instanceof PopulationWorkInterrupted && error.cause === 'TIME_BOUND');
  const node = new PopulationWorkBudget({ node_bound: 0, time_bound_ms: 0 });
  assert.throws(() => node.visit(frontier), error => {
    assert.ok(error instanceof PopulationWorkInterrupted); assert.equal(error.cause, 'NODE_BOUND');
    frontier.occurrence_ref = 'changed'; assert.deepEqual(error.frontier, { occurrence_ref: 'member' }); return true;
  });
  assert.equal(node.examined, 0);
});

test('the consumed helper does not pretend to transfer point or cycle selection or Pydantic coercions', () => {
  const state = { occurrences: [{ occurrence_ref: 'member', cell: [0, 0] }], active_occurrence_ref: 'member', reserve: 0, terminated: false };
  const model = { movement_cells: [[0, 0]], motion_law_ref: 'collision_checked_cardinal_step' };
  for (const kind_ref of ['point', 'cycle', 'reset']) {
    assert.throws(() => selectedCardinalPopulationStep(model, state, { kind_ref, cell: [0, 0] }), /PATTERN_EXTERNAL_INPUT_KIND_UNSUPPORTED/);
  }
  for (const invalid of [1.5, Number.POSITIVE_INFINITY, -0, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => normalizePopulationPhysicalState({ ...state, reserve: invalid }), RangeError);
  }
  assert.throws(() => normalizePopulationPhysicalState({ ...state, terminated: 'false' }), TypeError);
  assert.throws(() => normalizePopulationPhysicalState({ ...state, occurrences: [] }), TypeError);
});
