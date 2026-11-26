import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeFamily, NativeObservation, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { createSicPivotCargo } from '../src/sic/pivot-cargo.ts';

test('a checked attachment separates touching loads and keeps both delivery obligations', async () => {
  const actor: NativePoint = [1, 1], adjacent: NativePoint = [2, 1], resting: NativePoint = [3, 1];
  const at = { actor, cargo: [[adjacent, resting]], held: -1, delivered: 0 };
  const pitch = 3, floor = Array.from({ length: 30 }, (_, cell) => [cell % 6, Math.floor(cell / 6)].join(','));
  const destinations = [['3,3', '4,3']], actorColor = 10, freeColor = 7, heldColor = 6, core = 0;
  const layout = { origin: [0, 0], pitch, floor, destinations, pivot: [], actorColor, core, initial: at,
    freeColors: [freeColor], receiverColors: [13] };
  const action = { action_ref: 'ACTION5', data: {} };
  const family = createSicPivotCargo();
  family.restore!({ witness: null, state: { epoch: 1, layout, at, refs: [], moves: true, interactions: [], failed: false,
    steps: [{ input: action.action_ref, intent: 'attach', subject: 0, next: { ...at, held: 0 } }] } });
  const rows = Array.from({ length: 5 * pitch }, () => Array<number>(6 * pitch).fill(5));
  function token(frame: number[][], [x, y]: NativePoint, color: number) {
    for (let i = 0; i < pitch; i++) frame[y * pitch + i]!.fill(color, x * pitch, (x + 1) * pitch);
    frame[y * pitch + 1]![x * pitch + 1] = core;
  }
  token(rows, actor, actorColor);
  token(rows, adjacent, freeColor);
  token(rows, resting, freeColor);
  const next = rows.map(row => row.slice());
  token(next, adjacent, heldColor);
  const observation = (revision: number): NativeObservation => ({
    revision, frame_hash: 'frame-' + revision, observation_ref: 'board:revision:' + revision, level_epoch: 1,
    coordinate_basis: 'screen', entities: [], available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
    state: 'NOT_FINISHED', levels_completed: 0, unknowns: [], provenance: 'fixture',
  });
  const before = observation(1), after = observation(2);
  const probe = await family.propose(before, rows, [], 50);
  assert.ok(probe);

  const changedTerrain = next.map(row => row.slice());
  changedTerrain[0]![0] = 8;
  const contradicted = await family.after(probe, 0, before, after, rows, changedTerrain);
  assert.equal(contradicted.matched, false);

  const confirmed = await family.after(probe, 0, before, after, rows, next);
  assert.equal(confirmed.reason, 'attachment_distinguishes_touching_loads');
  assert.equal(confirmed.seal_prefix, true);
  await family.record(before, after, action, rows, next, probe, 0);
  const replanned = await family.propose(after, next, [], 49);
  assert.ok(replanned);
  assert.deepEqual(replanned.local.at, { ...at, held: 0, cargo: [[adjacent], [resting]] });
  assert.deepEqual(replanned.local.layout.destinations, [destinations[0], destinations[0]]);
  assert.equal(replanned.local.steps.filter(step => step.intent === 'drop').length, 2);
});

for (const reflected of [false, true]) test('a cargo series checks known contact effects and landings' + (reflected ? ' after a reflected placement' : ''), async () => {
  const point = (x: number, y: number): NativePoint => [reflected ? 5 - x : x, y];
  const pitch = reflected ? 4 : 3, actorColor = reflected ? 12 : 10, freeColor = reflected ? 8 : 7;
  const heldColor = 6, floorColor = 5, core = 0;
  const cargo = (x: number) => reflected ? [point(x, 1), point(x, 2)] : [point(x, 1)];
  const at = { actor: point(1, 1), cargo: [cargo(3)], held: -1, delivered: 0 };
  const approached = { ...at, actor: point(2, 1) };
  const held = { ...approached, held: 0 };
  const translated = { ...held, actor: point(3, 1), cargo: [cargo(4)] };
  const delivered = { ...translated, held: -1, delivered: 1 };
  const direction = reflected ? 'ACTION3' : 'ACTION4';
  const steps = [
    { input: direction, intent: 'move', subject: -1, next: approached },
    { input: 'ACTION5', intent: 'attach', subject: 0, next: held },
    { input: direction, intent: 'move', subject: 0, next: translated },
    { input: 'ACTION5', intent: 'drop', subject: 0, next: delivered },
  ];
  const layout = { origin: [0, 0], pitch, floor: Array.from({ length: 30 }, (_, i) => [i % 6, Math.floor(i / 6)].join(',')),
    destinations: [cargo(4).map(p => p.join(','))], pivot: [], actorColor, core, initial: at, freeColors: [freeColor] };
  const board = (state: typeof at) => {
    const rows = Array.from({ length: 5 * pitch }, () => Array<number>(6 * pitch).fill(floorColor));
    const paint = ([x, y]: NativePoint, color: number) => {
      for (let row = y * pitch; row < (y + 1) * pitch; row++) rows[row]!.fill(color, x * pitch, (x + 1) * pitch);
      rows[y * pitch + Math.floor(pitch / 2)]![x * pitch + Math.floor(pitch / 2)] = core;
    };
    paint(state.actor, actorColor);
    for (const tile of state.cargo[0]!) paint(tile, state.held < 0 ? freeColor : heldColor);
    return rows;
  };
  const observation = (revision: number) => ({
    revision, observation_ref: 'board:' + revision, level_epoch: 1, state: 'NOT_FINISHED', levels_completed: 0,
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
  }) as NativeObservation;
  const family = createSicPivotCargo();
  const initial = { state: { epoch: 1, layout, at, refs: ['earlier-return'], moves: true, steps, failed: false }, witness: null };
  family.restore({ ...initial, state: { ...initial.state, interactions: ['attach'] } });
  assert.deepEqual((await family.propose(observation(0), board(at), [], 16))?.actions.map(c => c.action_ref),
    [direction, 'ACTION5', direction]);

  family.restore({ ...initial, state: { ...initial.state, interactions: ['attach', 'drop'] } });
  const plan = await family.propose(observation(0), board(at), [], 16);
  assert.ok(plan);
  assert.deepEqual(plan.actions.map(c => c.action_ref), [direction, 'ACTION5', direction, 'ACTION5']);
  const blocked = board(held), [x, y] = point(4, 1);
  blocked[y * pitch]![x * pitch] = freeColor;
  const guard = await family.before(plan, 2, { frame_rows: blocked } as Parameters<NativeFamily['before']>[2], observation(2));
  assert.equal(guard.admitted, false);

  const poses = [at, approached, held, translated, delivered];
  for (const [index, command] of plan.actions.entries()) {
    const first = board(poses[index]!), second = board(poses[index + 1]!);
    const before = observation(index), after = observation(index + 1);
    const outcome = await family.after(plan, index, before, after, first, second);
    assert.equal(outcome.matched, true);
    assert.equal(outcome.seal_prefix, index === plan.actions.length - 1);
    await family.record(before, after, command, first, second, plan, index, []);
  }
  assert.deepEqual((family.state().state as { at: unknown }).at, delivered);

  const returning = reflected ? 'ACTION4' : 'ACTION3';
  const back = { ...held, actor: at.actor, cargo: [cargo(2)] };
  family.restore({ ...initial, state: { ...initial.state, interactions: ['attach'], steps: [
    ...steps.slice(0, 2), { input: returning, intent: 'move', subject: 0, next: back },
  ] } });
  const revisit = await family.propose(observation(0), board(at), [], 16);
  assert.ok(revisit);
  assert.deepEqual(revisit.actions.map(command => command.action_ref), [direction, 'ACTION5', returning]);

  const exposed = board(held);
  const checkLanding = (frame_rows: number[][]) =>
    family.before(revisit, 2, { frame_rows } as Parameters<NativeFamily['before']>[2], observation(2));
  assert.equal((await checkLanding(exposed)).admitted, true);
  const [vacatedX, vacatedY] = at.actor;
  exposed[vacatedY * pitch]![vacatedX * pitch] = 14;
  assert.equal((await checkLanding(exposed)).admitted, false);
});
