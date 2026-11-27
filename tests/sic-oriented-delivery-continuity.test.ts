import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativePoint, NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { createSicVerifyOrientedDelivery } from '../src/sic/oriented-delivery.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

async function witnessedRoom(rotated = false) {
  const pitch = rotated ? 3 : 4, phase: NativePoint = rotated ? [2, 1] : [0, 0];
  const background = rotated ? 2 : 1, core = rotated ? 10 : 9, shell = rotated ? 8 : 4;
  const actor = rotated ? 12 : 14, faceInk = rotated ? 11 : 0, carrier = rotated ? 7 : 15;
  const peerShell = rotated ? 13 : 5;
  const interferingInk = rotated ? 3 : 10;
  const at = ([x, y]: NativePoint): NativePoint => rotated ? [10 - y, x + 1] : [x, y];
  const direction: NativePoint = rotated ? [0, 1] : [1, 0];
  const command = rotated ? 'ACTION1' : 'ACTION4';
  const targets = [[8, 2], [9, 2], [9, 5], [10, 5]].map(site => at(site as NativePoint));
  const geometry = { pitch, phase, background, core, rest_shell: shell, targets,
    initial_boxes: [at([1, 2]), at([3, 5])] };
  const paint = (rows: number[][], site: NativePoint, pixels: (x: number, y: number) => number) => {
    const [u, v] = at(site);
    for (let y = 0; y < pitch; y++) for (let x = 0; x < pitch; x++)
      rows[phase[1] + v * pitch + y]![phase[0] + u * pitch + x] = pixels(x, y);
  };
  function frame(tick: number, options: { blocked?: boolean; ambiguous?: boolean; lostCargo?: boolean; unpairedShift?: boolean; targetTaken?: boolean; secondOwner?: boolean; interference?: boolean; distantCargo?: boolean } = {}) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(background));
    const receiverTiles: NativePoint[] = [[8, 2], [9, 2], [9, 5], [10, 5]];
    for (const site of receiverTiles) paint(rows, site, (x, y) => {
      const cell = at(site), adjacent = (dx: number, dy: number) => targets.some(target => target[0] === cell[0] + dx && target[1] === cell[1] + dy);
      const edge = x === 0 && !adjacent(-1, 0) || x === pitch - 1 && !adjacent(1, 0)
        || y === 0 && !adjacent(0, -1) || y === pitch - 1 && !adjacent(0, 1);
      return edge ? core : rotated ? 1 : 2;
    });
    const own = (x: number, y: number) => (rotated ? y === pitch - 1 : x === pitch - 1) ? faceInk : actor;
    const part = (ink: number) => (x: number, y: number) => x === 0 || y === 0 || x === pitch - 1 || y === pitch - 1 ? ink : core;
    paint(rows, [tick, 2], own);
    paint(rows, options.distantCargo ? [7, 2] : [tick + 1, 2], part(options.lostCargo || options.distantCargo ? shell : faceInk));
    paint(rows, [2 + tick - Number(!!options.unpairedShift), 5], () => carrier);
    paint(rows, options.targetTaken ? [8, 2] : [3 + tick, 5], part(peerShell));
    if (options.blocked) paint(rows, [tick + 2, 2], () => rotated ? 0 : 6);
    if (options.secondOwner) paint(rows, [3 + tick, 6], () => rotated ? 0 : 6);
    if (options.ambiguous) paint(rows, [0, 8], own);
    if (options.interference) paint(rows, [0, 9], () => interferingInk);
    return rows;
  }
  const packet = (rows: number[][]): GameObservation => ({ gameCode: 'PUBLIC', frame: rows, frames: [rows], state: 'NOT_FINISHED',
    level: 1, levelCount: 2, levelsCompleted: 0, availableActionIds: [1, 2, 3, 4, 5],
    canUndo: false, canSelectLevel: true, defaultFps: 10 });
  const observe = (rows: number[][], revision: number) => measureNativeObservation({ frame_rows: rows, frame_hash: String(revision),
    state: 'NOT_FINISHED', level: 1, levels_completed: 0, available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'] }, revision, 'learned-room');
  const family = createSicVerifyOrientedDelivery();
  await family.attachPrograms?.({ registerProgram: async () => ({ run: async ({ situation }: { situation: { routeSupported: boolean } }) =>
    ({ result: situation.routeSupported ? 'P07' : 'P05', receipt: {} }) }) } as unknown as NativeProgramRegistry);
  family.restore({ state: { epoch: 1, geometry, color: actor, held: at([1, 2]), invitation: null,
    free: { [command]: direction }, loaded: {}, tried: [], refs: ['previous-free-translation'], count: 0 } });
  for (let tick = 0; tick < 2; tick++) {
    const first = frame(tick), second = frame(tick + 1);
    const before = await observe(first, tick + 1), after = await observe(second, tick + 2);
    const proposal = await family.propose(before, first, [], 32);
    assert.ok(proposal);
    assert.equal(proposal.actions[0]?.action_ref, command);
    await family.record(before, after, proposal.actions[0]!, first, second, proposal, 0, []);
  }
  const learned = family.state().state as Record<string, any>;
  assert.deepEqual(learned.loaded[command], direction, 'The carried translation must be acquired from its public return');
  assert.ok(learned.sharedEvidence && learned.transportCarriers.length === 1,
    'Two joint movements must establish the other carrier before its crate can vary during a route');
  return { family, frame, packet, observe, command, direction, at, learned, interferingInk };
}

async function settledParallelRoom(rotated = false) {
  const room = await witnessedRoom(rotated);
  room.family.restore({ state: { ...room.learned, count: 71,
    parallel: { ink: room.interferingInk, ref: 'previous-interfering-carrier-removal', returns: {}, probes: {}, approach: [], waits: {} } } });
  return room;
}

for (const parallel of [false, true]) for (const rotated of [false, true]) test('native tickets continue witnessed transport while a separate carrier moves'
  + (parallel ? ' after the interfering forms disappear beyond the ordinary local horizon' : '')
  + (rotated ? ' with rotated cells, recoloring and remapped controls' : ''), async () => {
  const room = await (parallel ? settledParallelRoom(rotated) : witnessedRoom(rotated));
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'observed-cooperative-translation', maxPointOccurrences: 250 }));
  const sessionId = 'cooperative-route-' + parallel + '-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  const tickets = [];
  let count = 0;
  while (result.ticket) {
    tickets.push(result.ticket);
    assert.equal(result.ticket.actionRef, room.command);
    count++;
    assert.ok(count <= 16);
    result = await service.handle({ type: 'advance', sessionId, sequence: count, ticketId: result.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(2 + count)), count) });
  }
  assert.equal(count, 5, 'The whole current known route should use one native decision');
  assert.deepEqual(tickets.map(ticket => ticket.actionIndex), [0, 1, 2, 3, 4]);
  assert.equal(new Set(tickets.map(ticket => ticket.decisionRevision)).size, 1);
  const trace = result.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, count);
  assert.ok(trace.filter(event => event.kind === 'actual_outcome').every(event => event.matched === true));
  const state = room.family.state().state as Record<string, any>;
  assert.deepEqual(state.held, room.at([8, 2]));
  if (!parallel) assert.deepEqual(state.transports[0].box, room.at([10, 5]), 'Acquire the actual other-carrier positions in order');
  else {
    assert.equal(state.count, 76, 'Acquire every executed movement after the parallel local count has passed 70');
    assert.equal(state.refs.length, 6);
    assert.equal(new Set(state.refs).size, 6, 'Retain the ordered distinct actual returns');
    assert.deepEqual(state.loaded, room.learned.loaded, 'Reuse the loaded effect without relearning it');
    assert.deepEqual(state.transportCarriers, room.learned.transportCarriers, 'Keep the independently witnessed peer identity');
    assert.deepEqual(state.parallel.approach, []);
  }
  assert.equal(state.sharedEvidence, room.learned.sharedEvidence, 'Keep the original transport proof');
});

for (const parallel of [false, true])
  for (const condition of (parallel ? ['blocked', 'ambiguous', 'lostCargo', 'unpairedShift', 'targetTaken', 'interference'] as const
    : ['blocked', 'ambiguous', 'lostCargo', 'unpairedShift', 'targetTaken'] as const))
  test((parallel ? 'a settled parallel' : 'a cooperative') + ' route closes on ' + condition + ' without issuing a second ticket', async () => {
    const room = await (parallel ? settledParallelRoom() : witnessedRoom());
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'cooperative-route-refutation', maxPointOccurrences: 250 }));
    const sessionId = 'cooperative-stop-' + parallel + '-' + condition;
    const first = await service.handle({ type: 'init', sessionId, sequence: 0,
      observation: toV6PublicObservation(room.packet(room.frame(2))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
    assert.ok(first.ticket);
    const result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: first.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(3, { [condition]: true })), 1) });
    assert.equal(result.ticket, null);
    assert.equal(result.kind, 'boundary');
    const trace = result.snapshot.trace as Record<string, any>[];
    assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
    if (condition === 'blocked') {
      assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
      assert.equal(trace.findLast(event => event.kind === 'before_guard')?.admitted, false);
    } else assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  });

test('a settled parallel route uses the remaining action budget beyond its ordinary local horizon', async () => {
  const room = await settledParallelRoom();
  const rows = room.frame(2), observation = await room.observe(rows, 4);
  const proposal = await room.family.propose(observation, rows, [], 3);
  assert.ok(proposal);
  assert.equal(proposal.actions.length, 3);
  assert.ok(proposal.actions.every(action => action.action_ref === room.command));
});

test('a retained last-part approach is consumed once per actual return and stays unitary', async () => {
  const room = await settledParallelRoom();
  const state = room.family.state().state as Record<string, any>;
  const approach = [3, 4, 5].map(x => ({ input: room.command,
    prediction: { pose: room.at([x, 2]), face: room.direction, cargo: null } }));
  room.family.restore({ state: { ...state, held: null, parallel: { ...state.parallel, approach } } });
  for (let tick = 2; tick < 4; tick++) {
    const first = room.frame(tick, { distantCargo: true, targetTaken: true });
    const second = room.frame(tick + 1, { distantCargo: true, targetTaken: true });
    const before = await room.observe(first, tick + 2), after = await room.observe(second, tick + 3);
    const proposal = await room.family.propose(before, first, [], 20);
    assert.ok(proposal);
    assert.equal(proposal.actions.length, 1);
    assert.equal(proposal.actions[0]?.action_ref, room.command);
    assert.equal((room.family.state().state as Record<string, any>).parallel.approach.length, 5 - tick,
      'Preparing an unexecuted command must not consume the retained approach');
    await room.family.record(before, after, proposal.actions[0]!, first, second, proposal, 0, []);
    assert.deepEqual((room.family.state().state as Record<string, any>).parallel.approach, approach.slice(tick - 1));
  }
});


test('an acquired passage does not authorize a newly occupied landing already present before planning', async () => {
  const room = await witnessedRoom();
  const floor = Array.from({ length: 16 * 16 }, (_, i) => `${i % 16},${Math.floor(i / 16)}`);
  room.family.restore({ state: { ...room.learned, passage: { floor, source: [], mouths: [], staging: [] } } });
  const rows = room.frame(2, { blocked: true });
  assert.equal(await room.family.propose(await room.observe(rows, 4), rows, [], 40), null,
    'The retained free-cell list cannot turn an unfamiliar current obstacle into a known floor pattern');
});

test('two plausible owners of a moved crate require a new decision', async () => {
  const room = await witnessedRoom();
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'ambiguous-external-ownership', maxPointOccurrences: 250 }));
  const sessionId = 'ambiguous-external-owner';
  const first = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { secondOwner: true }))),
    budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(first.ticket);
  const next = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: first.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(3, { secondOwner: true })), 1) });
  assert.equal(next.ticket, null);
  const trace = next.snapshot.trace as Record<string, any>[];
  assert.equal(trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.equal(trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  const retained = room.family.state().state as Record<string, any>;
  assert.deepEqual(retained.transports, [], 'The ambiguous ownership must not become a new transport fact');
  assert.equal(retained.sharedEvidence, room.learned.sharedEvidence, 'Previously witnessed cooperation remains documented');
  assert.deepEqual(retained.loaded[room.command], room.direction, 'The independent confirmed own translation is retained');
});


test('an unanchored interior carrier cannot supply the receiver floor color', async () => {
  const room = await witnessedRoom();
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(1));
  const paint = (x: number, y: number, value: (dx: number, dy: number) => number) => {
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) rows[y * 4 + dy]![x * 4 + dx] = value(dx, dy);
  };
  const targets: NativePoint[] = [];
  for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) {
    targets.push([x, y]); paint(x, y, () => 6);
  }
  paint(4, 3, (_x, y) => y === 3 ? 0 : 14);
  paint(4, 4, () => 15);
  const parts: NativePoint[] = [[4, 6], [0, 7]];
  for (const [x, y] of parts) paint(x, y, (dx, dy) => dx === 0 || dx === 3 || dy === 0 || dy === 3 ? 4 : 9);
  room.family.restore({ state: { ...room.learned, geometry: { ...room.learned.geometry, targets, initial_boxes: parts },
    held: null, free: { ACTION2: [0, 1] } } });
  assert.equal(await room.family.propose(await room.observe(rows, 4), rows, [], 40), null,
    'With all receiver contours hidden, a central full-cell object is not evidence of traversable receiver fill');
});
