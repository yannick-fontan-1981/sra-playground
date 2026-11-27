import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicNavigateRevealedGrid } from '../src/sic/navigate-revealed-grid.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';

type Family = ReturnType<typeof createSicNavigateRevealedGrid>;
type Proposal = Parameters<Family['after']>[0];
type Grid = Proposal['local']['grid'];
type Packet = Pick<GameObservation, 'frame' | 'level' | 'levelsCompleted' | 'state' | 'availableActionIds'>;
type Transition = { before: Packet; after: Packet; action: number; family: string };
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-grid-mechanism-reassociation-public.json.gz', import.meta.url))).toString()) as {
  learning: Transition[]; foreign: Transition[]; grid: Grid; acquired: { state: Proposal['local'] };
  readings: { before: Proposal['local']['last']; after: Proposal['local']['last'] };
};
const grid = fixture.grid;
const tile = (model: Grid, cell: number) => [model.box[0] + cell % model.columns * model.pitch,
  model.box[1] + Math.floor(cell / model.columns) * model.pitch] as const;
const packet = (value: Packet): GameObservation => ({ ...value, gameCode: 'PUBLIC', levelCount: 5,
  frames: [value.frame], canUndo: false, canSelectLevel: false, defaultFps: 10 });

function transformed(value: Packet, variant: boolean): Packet {
  if (!variant) return structuredClone(value);
  const rows = value.frame, output = rows.map(row => [...row]);
  if (value.level === fixture.foreign[0]!.before.level) {
    for (let cell = 0; cell < grid.size; cell++) {
      const [x, y] = tile(grid, cell), [u, v] = tile(grid, grid.size - 1 - cell);
      for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) output[v + dy]![u + dx] = rows[y + dy]![x + dx]!;
      if (grid.actorPixels!.every(([dx, dy]) => rows[y + dy]?.[x + dx] === grid.actor)) {
        for (const [dx, dy] of grid.actorPixels!) output[v + dy]![u + dx] = grid.base;
        for (const [dx, dy] of [[2, 1], [1, 2], [2, 2]] as const) output[v + dy]![u + dx] = grid.actor;
      }
    }
  }
  return { ...value, frame: output.map(row => row.map(ink => (ink * 5 + 3) % 16)) };
}

function paintCarrier(rows: number[][], model: Grid, from: number, to: number) {
  for (const cell of [from, to]) {
    const [x, y] = tile(model, cell);
    for (let dy = 0; dy < model.pitch; dy++) for (let dx = 0; dx < model.pitch; dx++) rows[y + dy]![x + dx] = model.tint;
  }
  const [x, y] = tile(model, to);
  for (const [dx, dy] of model.actorPixels!) rows[y + dy]![x + dx] = model.actor;
}

for (const variant of [false, true]) test('native inherited grid acquires an ordinary blocked return while separate mechanisms remain unchanged'
  + (variant ? ' with moved tiles, another palette, carrier shape and opposite commands' : ''), async () => {
  const family = createSicNavigateRevealedGrid(), used = new Map<number, number>();
  const foreign: NativeFamily = {
    id: preparedEffectsId,
    propose(observation) {
      const commands = observation.levels_completed === 4 ? variant ? [2, 4] : [1, 3]
        : [1, 3].includes(observation.levels_completed) ? [1] : [];
      const actionId = commands[used.get(observation.level_epoch) ?? 0];
      if (actionId === undefined) return null;
      const action = { action_ref: 'ACTION' + actionId, data: {} };
      return { status: 'proposed', kind: this.id, binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch },
        actions: [action], steps: [{ action }], sicLocalDecision: { strategy: 'declared_public_step' } };
    },
    before: () => ({ admitted: true, reason: 'public_fixture_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'public_fixture_returned' }),
    record(before) { used.set(before.level_epoch, (used.get(before.level_epoch) ?? 0) + 1); return { events: [] }; },
    state: () => ({ used: [...used] }), restore(value) { used.clear(); for (const [epoch, count] of value.used as number[][]) used.set(epoch!, count!); },
  };
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family, foreign], sourceDigest: 'ordinary-grid-mechanism-return', maxPointOccurrences: 250,
    groups: [{ id: 'foreign_public_command', families: [foreign.id] }, { id: 'known_grid_access', families: [family.id] }] }));
  const sessionId = 'ordinary-grid-' + variant;
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(packet(transformed(fixture.learning[0]!.before, variant))),
    budgets: { targetLevels: 5, levelActionCaps: [80, 80, 80, 80, 80] } });
  for (const step of fixture.learning) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal(reply.ticket.actionRef, 'ACTION' + step.action);
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(transformed(step.after, variant)), sequence) });
  }
  const inherited = structuredClone(family.state().state) as Proposal['local'];
  assert.equal(inherited.epoch, 4);
  assert.equal(inherited.score, 3);
  let beforeRef = '';
  for (const [index, step] of fixture.foreign.entries()) {
    reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket);
    assert.equal((reply.snapshot.proposal as any).kind, foreign.id);
    assert.equal(reply.ticket.actionRef, 'ACTION' + (variant ? [2, 4][index] : step.action));
    beforeRef = reply.ticket.observationRef;
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(packet(transformed(step.after, variant)), sequence) });
    if (index === 0) assert.deepEqual(family.state().state, inherited, 'The normal first return keeps the established acquisition path');
  }
  const rebound = structuredClone(family.state().state) as Proposal['local'];
  const mapped = (cell: number) => variant ? grid.size - 1 - cell : cell;
  const blocked = mapped(fixture.readings.before.position - 1);
  assert.equal(rebound.epoch, 5);
  assert.equal(rebound.score, 4);
  assert.equal(rebound.last.memory[blocked], 'wall');
  assert.equal(rebound.last.charges, fixture.readings.after.charges);
  assert.ok(rebound.refs.includes(beforeRef));
  assert.ok(inherited.refs.some(ref => rebound.refs.includes(ref)));
  assert.ok(rebound.timing);
  assert.deepEqual(rebound.timing.scannedPads, []);
  assert.deepEqual(rebound.last.landings, {}, 'No pad effect is invented by the ordinary return');
  for (const [before, after] of [[65, 80], [101, 101]])
    assert.ok(rebound.timing.walls.some(track => JSON.stringify(track) === JSON.stringify([mapped(before!), mapped(after!)])));
  for (const [before, after] of [[54, 55], [88, 88]])
    assert.ok(rebound.timing.patrols.some(track => JSON.stringify(track) === JSON.stringify([mapped(before!), mapped(after!)])));
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  assert.ok(reply.ticket);
  const proposal = reply.snapshot.proposal as Proposal;
  assert.equal(proposal.kind, family.id);
  assert.ok(proposal.route_refs?.includes(beforeRef));
  assert.ok(proposal.route_refs?.includes(rebound.refs.at(-1)!));
  assert.equal(proposal.local.last.memory[blocked], 'wall');
  assert.equal(proposal.choice.kind, 'move');
  assert.equal(proposal.local.grid.mechanisms?.pads[proposal.choice.target], undefined);
  assert.equal(proposal.local.grid.mechanisms?.doors[proposal.choice.target], undefined);
  // Declared synthetic return: the carrier executes the actual newly issued
  // ordinary move. Mechanism pixels and the observed wall remain unchanged.
  const returned = transformed(fixture.foreign.at(-1)!.after, variant);
  paintCarrier(returned.frame, rebound.grid, rebound.last.position, proposal.choice.target);
  const revision = reply.ticket.decisionRevision;
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(packet(returned), sequence) });
  const trace = reply.snapshot.trace as any[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  assert.equal(trace.filter(event => event.kind === 'sealed_prefix' && event.family === family.id && event.revision === revision).length, 1);
  assert.equal((family.state().state as Proposal['local']).last.memory[blocked], 'wall');
  await service.handle({ type: 'close', sessionId, sequence });
});

async function foreignReturn(condition = 'valid') {
  const family = createSicNavigateRevealedGrid(), saved = structuredClone(fixture.acquired);
  if (condition !== 'unacquired-role') family.restore(saved);
  const prior = structuredClone(family.state()), first = structuredClone(fixture.foreign[1]!.before), second = structuredClone(fixture.foreign[1]!.after);
  const beforePosition = fixture.readings.before.position, blocked = beforePosition - 1;
  const changeCell = (cell: number) => { const [x, y] = tile(grid, cell); second.frame[y + 1]![x + 1] = (second.frame[y + 1]![x + 1]! + 1) % 16; };
  if (condition === 'wall-absent') {
    const [x, y] = tile(grid, blocked);
    for (let dy = 0; dy < grid.pitch; dy++) for (let dx = 0; dx < grid.pitch; dx++) second.frame[y + dy]![x + dx] = first.frame[y + dy]![x + dx]!;
  }
  if (condition === 'ambiguous-carrier') {
    const [x, y] = tile(grid, 1);
    for (const [dx, dy] of grid.actorPixels!) second.frame[y + dy]![x + dx] = grid.actor;
  }
  if (condition === 'nonlocal-landing') paintCarrier(second.frame, grid, beforePosition, beforePosition + 2);
  if (condition === 'changed-pad') changeCell(Number(Object.keys(grid.mechanisms!.pads)[0]));
  if (condition === 'changed-door') changeCell(Number(Object.keys(grid.mechanisms!.doors)[0]));
  if (condition === 'changed-goal') changeCell(grid.goal);
  if (condition === 'pad-contact' || condition === 'door-contact') {
    const target = Number(Object.keys(condition === 'pad-contact' ? grid.mechanisms!.pads : grid.mechanisms!.doors)[0]);
    paintCarrier(first.frame, grid, beforePosition, target + 1);
    paintCarrier(second.frame, grid, beforePosition, target);
  }
  if (condition === 'charge-change') {
    const charge = grid.charges.find(([x, y]) => second.frame[y]![x] === grid.enemy)!;
    second.frame[charge[1]]![charge[0]] = grid.base;
  }
  if (condition === 'new-level') second.level++;
  if (condition === 'changed-score') second.levelsCompleted++;
  const scope = saved.state.refs[0]!.split(':epoch:')[0]!;
  const observe = (value: Packet, revision: number) => measureNativeObservation({ frame_rows: value.frame,
    frame_hash: 'mechanism-boundary-' + revision, level: value.level, levels_completed: value.levelsCompleted,
    state: value.state, available_action_refs: value.availableActionIds.map(id => 'ACTION' + id) }, revision, scope);
  const before = await observe(first, 98), after = await observe(second, 99);
  const command = { action_ref: condition === 'wrong-command' ? 'ACTION4' : 'ACTION3', data: {} };
  await family.observePublicOutcome!(before, after, command, first.frame, second.frame, [second.frame]);
  return { family, prior, before, after, command, first, second };
}

for (const condition of ['wall-absent', 'ambiguous-carrier', 'nonlocal-landing', 'changed-pad', 'changed-door', 'changed-goal',
  'pad-contact', 'door-contact', 'charge-change', 'wrong-command', 'new-level', 'changed-score', 'unacquired-role'])
  test('ordinary grid reassociation with mechanisms refuses ' + condition + ' and keeps independent evidence', async () => {
    const result = await foreignReturn(condition);
    assert.deepEqual(result.family.state(), result.prior);
  });

test('the reassociated mechanism-grid return acquires each observed peer track only once', async () => {
  const result = await foreignReturn();
  assert.notDeepEqual(result.family.state(), result.prior);
  const once = structuredClone(result.family.state());
  await result.family.observePublicOutcome!(result.before, result.after, result.command, result.first.frame, result.second.frame, [result.second.frame]);
  assert.deepEqual(result.family.state(), once);
});
