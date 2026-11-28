import test from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIES, generateCase, signature, shiftOrigin } from '../scripts/sic-p14/generator.mjs';
import { createEnvironment } from '../scripts/sic-p14/environment.mjs';
import { createOracleWorld } from '../scripts/sic-p14/oracle.mjs';

function renamed(spec) {
  const copy = structuredClone(spec);
  const channels = new Map(copy.public.channels.map((id, i) => [id, `sensor-${i}`]));
  const actions = new Map(copy.public.actions.map((action, i) => [action.id, `button-${i}`]));
  copy.public.channels = copy.public.channels.map(id => channels.get(id)).reverse();
  copy.public.actions = copy.public.actions.map(action => ({ ...action, id: actions.get(action.id),
    ...(action.gates ? { gates: action.gates.map(id => channels.get(id)) } : {}),
    ...(action.targets ? { targets: action.targets.map(id => channels.get(id)) } : {}),
    ...(action.perturbs ? { perturbs: action.perturbs.map(id => channels.get(id)) } : {}) })).reverse();
  copy.worlds = copy.worlds.map(world => ({
    channels: Object.fromEntries(Object.entries(world.channels).map(([id, channel]) => [channels.get(id), channel])),
    ...(world.replacements ? { replacements: Object.fromEntries(Object.entries(world.replacements).map(([action, entries]) =>
      [actions.get(action), Object.fromEntries(Object.entries(entries).map(([id, channel]) => [channels.get(id), channel]))])) } : {}),
  })).reverse();
  return copy;
}
function smallSpec(actions, channel, extra = {}) {
  return { version: 1, id: 'evaluation-only-id', family: 'evaluation-only-family', origin: 453,
    budget: { actions: 10, ticks: 20, states: 100 },
    public: { channels: ['gate'], initial: 0, goal: 1, actions },
    worlds: [{ channels: { gate: channel }, ...extra }] };
}

test('P14 generation is deterministic and its deduplication ignores names, presentation and clock origin', () => {
  for (const family of FAMILIES) {
    const spec = generateCase(family, 7, 26112814);
    assert.deepEqual(spec, generateCase(family, 7, 26112814));
    assert.equal(signature(spec), signature(shiftOrigin(spec, 86400)));
    assert.equal(signature(spec), signature(renamed(spec)));
    const changed = structuredClone(spec);
    changed.public.actions.find(action => action.kind === 'move').duration++;
    assert.notEqual(signature(spec), signature(changed), 'travel duration is a real temporal dependency');
  }
});

test('all generated worlds begin indistinguishably; shifted clocks preserve actual observations', () => {
  for (const family of FAMILIES) {
    const spec = generateCase(family, 17, 26112814);
    const a = createEnvironment(spec, 0), other = createEnvironment(spec, 1), shifted = createEnvironment(shiftOrigin(spec, -1234), 0);
    assert.deepEqual(a.observation(), other.observation());
    assert.deepEqual(a.observation(), shifted.observation());
    const inspect = spec.public.actions.find(action => action.kind === 'inspect');
    for (let i = 0; i < 3; i++) assert.deepEqual(a.step(inspect.id), shifted.step(inspect.id));
  }
});

test('ordered observations can end identically while intermediate events distinguish the worlds', () => {
  for (let index = 0; index < 12; index++) {
    const spec = generateCase('ordered_intermediates', index, 26112814);
    const inspect = spec.public.actions.find(action => action.kind === 'inspect');
    const a = createEnvironment(spec, 0).step(inspect.id), b = createEnvironment(spec, 1).step(inspect.id);
    assert.deepEqual(a.frames.at(-1), b.frames.at(-1));
    assert.notDeepEqual(a.frames.slice(0, -1), b.frames.slice(0, -1));
    assert.equal(a.tick, inspect.duration);
    assert.equal(a.frames.length, inspect.duration);
  }
});

test('an opening at departure does not cover travel beyond expiration, while a finite hold can cover it', () => {
  const spec = smallSpec([
    { id: 'cross', kind: 'move', duration: 2, from: 0, to: 1, gates: ['gate'] },
    { id: 'hold', kind: 'hold', duration: 1, targets: ['gate'], holdTicks: 3, uses: 1 },
  ], { kind: 'clock', prefix: [], cycle: [1, 1, 0, 0, 0], phase: 0 });
  const tooLate = createEnvironment(spec);
  assert.equal(tooLate.observation().frames[0].values.gate, 1);
  assert.equal(tooLate.step('cross').terminal, 'failed');
  const held = createEnvironment(spec);
  assert.equal(held.step('hold').uses.hold, 0);
  const crossed = held.step('cross');
  assert.equal(crossed.terminal, 'crossed');
  assert.equal(crossed.position, 1);
  assert.equal(crossed.tick, 3);
});

test('a traversal intervention changes the arrival observation, before its old phase can be reused', () => {
  const spec = smallSpec([
    { id: 'enter', kind: 'move', duration: 1, from: 0, to: 1, gates: ['gate'], perturbs: ['gate'] },
    { id: 'inspect', kind: 'inspect', duration: 1 },
  ], { kind: 'clock', prefix: [], cycle: [1, 1, 1, 0], phase: 0 }, {
    replacements: { enter: { gate: { kind: 'clock', prefix: [0], cycle: [1, 0], phase: 0 } } },
  });
  spec.public.goal = 2;
  const env = createEnvironment(spec);
  const arrived = env.step('enter');
  assert.equal(arrived.position, 1);
  assert.equal(arrived.frames.at(-1).values.gate, 0);
  assert.deepEqual(arrived.receipt.interventions, ['gate']);
  assert.equal(env.step('inspect').frames.at(-1).values.gate, 1);
});

test('the public boundary exposes observed values and accessible commands, never private parameters', () => {
  const spec = generateCase('delayed_command', 0, 26112814), env = createEnvironment(spec);
  const initial = env.observation();
  assert.deepEqual(Object.keys(initial).sort(), ['enabled', 'frames', 'holds', 'position', 'receipt', 'terminal', 'tick', 'uses']);
  assert.deepEqual(Object.keys(initial.frames[0]).sort(), ['intermediate', 'ref', 'reliable', 'tick', 'values']);
  assert.deepEqual(Object.keys(initial.frames[0].values).sort(), [...spec.public.channels].sort());
  for (const forbidden of ['family', 'origin', 'worlds', 'phase', 'cycle', 'prefix', 'delay', 'width', 'solution']) {
    assert.equal(Object.hasOwn(initial, forbidden), false);
    assert.equal(Object.hasOwn(initial.frames[0], forbidden), false);
  }
  const trigger = spec.public.actions.find(action => action.kind === 'trigger');
  const first = env.step(trigger.id);
  const pulse = trigger.targets[0];
  assert.equal(first.frames[0].values[pulse], 0, 'an initial stationary return does not mean no delayed effect');
  assert.equal(first.enabled.includes(trigger.id), false, 'the public button is busy while its delayed effect is pending');
});

test('closed gates do not leak into enabled commands; invalid and over-budget commands cannot consume hidden time', () => {
  const spec = smallSpec([
    { id: 'cross', kind: 'move', duration: 1, from: 0, to: 1, gates: ['gate'] },
    { id: 'long', kind: 'wait', duration: 3 },
  ], { kind: 'clock', prefix: [], cycle: [0], phase: 0 });
  spec.budget.ticks = 2;
  const env = createEnvironment(spec);
  assert.equal(env.observation().enabled.includes('cross'), true);
  assert.equal(env.observation().enabled.includes('long'), false);
  const invalid = env.step('long');
  assert.equal(invalid.terminal, 'failed');
  assert.equal(invalid.tick, 0);
  assert.deepEqual(invalid.frames, []);
  assert.equal(createEnvironment(spec).step('cross').terminal, 'failed');
});


test('independently implemented oracle and environment agree on public timed observations', () => {
  for (const family of FAMILIES) for (let world = 0; world < 2; world++) {
    const spec = generateCase(family, 7, 26112814);
    const actual = createEnvironment(spec, world), independent = createOracleWorld(spec, world);
    assert.deepEqual(actual.observation(), independent.observation());
    for (let index = 0; index < 8; index++) {
      const observation = actual.observation();
      if (observation.terminal) break;
      const enabled = spec.public.actions.filter(action => observation.enabled.includes(action.id));
      const action = enabled.find(action => action.kind === 'trigger')
        ?? enabled.find(action => action.kind === (index % 2 ? 'inspect' : 'wait')) ?? enabled[0];
      assert.deepEqual(actual.step(action.id), independent.step(action.id));
    }
  }
});
