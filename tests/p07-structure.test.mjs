import assert from 'node:assert/strict';
import test from 'node:test';
import { families, generateScenario, seededDraw, structuralSignature, transformScenario } from '../scripts/p07-access/generator.mjs';
import { identifyInView } from '../scripts/p07-access/runtime.mjs';

const clone = value => structuredClone(value);
const eq = (variable, value) => ({ variable, eq: value });

function sample(family, offset = 0) {
  const seed = 91073 + families.indexOf(family) * 100 + offset;
  return generateScenario(family, seededDraw(seed), { seed, index: offset });
}

// A schema-preserving alpha-renaming, independent of the fingerprint algorithm.
// Position numbers are categorical route vertices, not distances or costs.
function relabel(spec) {
  const out = clone(spec);
  const names = new Map(spec.variables.map((variable, index) => [variable.id, `unfamiliar-variable-${79 - 3 * index}`]));
  const positions = new Set(spec.variables.filter(variable => variable.role === 'position').map(variable => variable.id));
  const node = value => 4501 - 31 * value;
  function predicate(p) {
    if (p.all) return { all: p.all.map(predicate).reverse() };
    if (p.any) return { any: p.any.map(predicate).reverse() };
    if (p.not) return { not: predicate(p.not) };
    const result = { ...p, variable: names.get(p.variable) };
    if (positions.has(p.variable)) {
      assert.ok('eq' in p, 'The fixture only permits equality predicates for categorical positions');
      result.eq = node(p.eq);
    }
    return result;
  }
  const update = change => {
    const result = { ...change, variable: names.get(change.variable) };
    if (positions.has(change.variable)) {
      assert.ok('set' in change, 'Position relabeling must not change an arithmetic motion model');
      result.set = node(change.set);
    }
    return result;
  };
  const event = item => ({ ...item,
    ...(item.actor ? { actor: names.get(item.actor) } : {}),
    ...(item.variable ? { variable: names.get(item.variable) } : {}),
    ...(item.kind === 'crossing' && positions.has(item.actor) ? { from: node(item.from), to: node(item.to) } : {}),
    ...(item.subject ? { subject: `renamed-subject:${item.subject}` } : {}),
    ...(item.dependency ? { dependency: `renamed-proof:${item.dependency}` } : {}),
    ...(item.segment ? { segment: `renamed-segment:${item.segment}` } : {}),
  });
  out.initial = spec.initial.map(state => Object.fromEntries(Object.entries(state).reverse()
    .map(([name, value]) => [names.get(name), positions.has(name) ? node(value) : value]))).reverse();
  out.variables = spec.variables.map(variable => ({ ...variable, id: names.get(variable.id),
    ...(variable.visibleWhen ? { visibleWhen: predicate(variable.visibleWhen) } : {}) })).reverse();
  out.actions = spec.actions.map((action, index) => ({ ...action, id: `unfamiliar-command-${977 - index * 11}`,
    requires: predicate(action.requires), updates: action.updates.map(update),
    ...(action.throughout ? { throughout: predicate(action.throughout) } : {}),
    ...(action.events ? { events: action.events.map(event) } : {}),
    ...(action.branches ? { branches: action.branches.map(branch => ({ ...branch,
      when: predicate(branch.when), updates: branch.updates.map(update),
      ...(branch.events ? { events: branch.events.map(event) } : {}),
    })).reverse() } : {}),
  })).reverse();
  for (const key of ['goal', 'invariant', 'parentInvariant']) out[key] = predicate(spec[key]);
  if (out.view) {
    out.view.assignment = names.get(spec.view.assignment);
    out.view.revealedWhen = predicate(spec.view.revealedWhen);
  }
  return out;
}

function removeWins(spec) {
  const out = clone(spec);
  for (const action of out.actions) {
    if (action.events) action.events = action.events.filter(event => event.kind !== 'official-win');
    for (const branch of action.branches ?? []) {
      if (branch.events) branch.events = branch.events.filter(event => event.kind !== 'official-win');
    }
  }
  return out;
}

function smallRoute() {
  const crossing = (id, from, to, guard = { all: [] }) => ({
    id, kind: 'move', requires: { all: [eq('traveler', from), guard] },
    updates: [{ variable: 'traveler', set: to }],
    events: [{ kind: 'crossing', actor: 'traveler', from, to, dependency: 'route' }],
  });
  return {
    protocol: 'sic-p07-access-v1', id: 'independent-small-graph', family: 'topology-fixture', seed: 0,
    variables: [{ id: 'traveler', role: 'position' }, { id: 'gate', role: 'opening' },
      { id: 'reserve', role: 'resource' }],
    initial: [{ traveler: 0, gate: 0, reserve: 2 }],
    actions: [crossing('approach', 0, 1),
      { id: 'open', kind: 'interact', requires: eq('traveler', 1),
        updates: [{ variable: 'gate', set: 1 }], events: [{ kind: 'support', dependency: 'opening' }] },
      crossing('threshold', 1, 2, eq('gate', 1)), crossing('finish', 2, 3), crossing('trap', 1, 4)],
    goal: eq('traveler', 3), invariant: { all: [] }, parentInvariant: { variable: 'reserve', min: 1 },
    budget: { commands: 12, states: 1000 },
    structure: {}, presentation: { rotation: 0, offset: [0, 0], palette: [1, 2] },
  };
}

test('all eight families deduplicate arbitrary variable, command, evidence and route-vertex names', () => {
  for (const family of families) {
    const spec = sample(family);
    assert.equal(structuralSignature(relabel(spec)), structuralSignature(spec), family);
  }
  const independent = smallRoute();
  assert.equal(structuralSignature(relabel(independent)), structuralSignature(independent));
});

test('scenario identity, seed, presentation, declared family and hand-written structure do not create situations', () => {
  for (const family of families) {
    const spec = sample(family, 1);
    const changed = { ...clone(spec), id: 'totally-different-id', seed: 390017,
      family: 'external-family-name', structure: { arbitrary: 'annotation', counterfeitNewCase: true },
      presentation: { rotation: 3, offset: [109, -840], palette: [15, 1, 14, 2] } };
    assert.equal(structuralSignature(changed), structuralSignature(spec), family);
  }
});

test('action, variable, hypothesis and conjunction enumeration orders do not create situations', () => {
  for (const family of families) {
    const spec = sample(family, 2), changed = clone(spec);
    changed.actions.reverse();
    changed.variables.reverse();
    changed.initial.reverse();
    for (const action of changed.actions) if (action.requires.all) action.requires.all.reverse();
    assert.equal(structuralSignature(changed), structuralSignature(spec), family);
  }
});

test('official victory annotations are measured separately from the access structure', () => {
  for (const family of families) {
    const spec = removeWins(sample(family, 3));
    const changed = clone(spec);
    changed.actions[0].events = [...changed.actions[0].events ?? [], { kind: 'official-win' }];
    const conditional = changed.actions.find(action => action.branches?.length);
    if (conditional) conditional.branches[0].events = [...conditional.branches[0].events ?? [], { kind: 'official-win' }];
    assert.equal(structuralSignature(changed), structuralSignature(spec), family);
  }
});

test('camera rotations and translations preserve both structural identity and the target correspondence', () => {
  const spec = sample('F2-viewpoint', 4);
  const beforeClaim = identifyInView(spec.view);
  assert.notEqual(beforeClaim, null);
  for (const variant of [1, 2, 3, 5]) {
    const changed = transformScenario(spec, variant);
    assert.equal(structuralSignature(changed), structuralSignature(spec));
    assert.equal(identifyInView(changed.view), beforeClaim);
  }
});

test('changing an access dependency changes the structural identity even with the same route vertices', () => {
  const spec = smallRoute(), changed = clone(spec);
  const threshold = changed.actions.find(action => action.id === 'threshold');
  threshold.requires = eq('traveler', 1);
  assert.notEqual(structuralSignature(changed), structuralSignature(spec));
});

test('rewiring a one-way trap into an alternate entrance changes the structural identity', () => {
  const spec = smallRoute(), changed = clone(spec);
  const trap = changed.actions.find(action => action.id === 'trap');
  trap.updates[0].set = 2;
  trap.events[0].to = 2;
  assert.notEqual(structuralSignature(changed), structuralSignature(spec));
});

test('consumable resource quantities and temporal margins remain meaningful structural differences', () => {
  const resource = smallRoute(), fewer = clone(resource);
  fewer.initial[0].reserve = 1;
  assert.notEqual(structuralSignature(fewer), structuralSignature(resource));
  const timed = sample('F5-temporary-opening', 5), smaller = clone(timed);
  const opening = smaller.actions.flatMap(action => action.updates)
    .find(update => update.variable === 'window' && 'set' in update && update.set > 1);
  assert.ok(opening);
  opening.set--;
  assert.notEqual(structuralSignature(smaller), structuralSignature(timed));
});
