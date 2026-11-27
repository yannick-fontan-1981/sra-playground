import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import type { NativeFamily, NativePoint, NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { createSicVerifyOrientedDelivery } from '../src/sic/oriented-delivery.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
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
  function frame(tick: number, options: { blocked?: boolean; ambiguous?: boolean; lostCargo?: boolean; unpairedShift?: boolean; targetTaken?: boolean; secondOwner?: boolean; interference?: boolean; distantCargo?: boolean; duplicatePeer?: boolean; ambiguousPeers?: boolean; peerTick?: number; peerReleased?: boolean; unfamiliarPeerShell?: boolean; ambiguousPeerCargo?: boolean; peerFloor?: boolean;
    ownPose?: NativePoint; ownFace?: NativePoint; ownCargo?: NativePoint; ownShell?: number; extraBoxes?: NativePoint[]; peerShell?: number;
    contact?: { site: NativePoint; shell: number }; otherCarrier?: NativePoint; omitPeer?: boolean } = {}) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(background));
    const receiverTiles: NativePoint[] = [[8, 2], [9, 2], [9, 5], [10, 5]];
    for (const site of receiverTiles) paint(rows, site, (x, y) => {
      const cell = at(site), adjacent = (dx: number, dy: number) => targets.some(target => target[0] === cell[0] + dx && target[1] === cell[1] + dy);
      const edge = x === 0 && !adjacent(-1, 0) || x === pitch - 1 && !adjacent(1, 0)
        || y === 0 && !adjacent(0, -1) || y === pitch - 1 && !adjacent(0, 1);
      return edge ? core : rotated ? 1 : 2;
    });
    const vector = options.ownFace ?? [1, 0], face = rotated ? [-vector[1]!, vector[0]!] : vector;
    const own = (x: number, y: number) => (face[0] === 1 ? x === pitch - 1 : face[0] === -1 ? x === 0
      : face[1] === 1 ? y === pitch - 1 : y === 0) ? faceInk : actor;
    const part = (ink: number) => (x: number, y: number) => x === 0 || y === 0 || x === pitch - 1 || y === pitch - 1 ? ink : core;
    paint(rows, options.ownPose ?? [tick, 2], own);
    paint(rows, options.ownCargo ?? (options.distantCargo ? [7, 2] : [tick + 1, 2]),
      part(options.ownShell ?? (options.lostCargo || options.distantCargo ? shell : faceInk)));
    for (const site of options.extraBoxes ?? []) paint(rows, site, part(shell));
    const peerTick = options.peerTick ?? tick;
    if (!options.omitPeer) {
      paint(rows, [2 + peerTick - Number(!!options.unpairedShift), 5], () => carrier);
      paint(rows, options.targetTaken ? [8, 2] : [3 + peerTick, 5],
        part(options.peerShell ?? (options.unfamiliarPeerShell ? rotated ? 14 : 6 : options.peerReleased ? shell : peerShell)));
    }
    if (options.contact) paint(rows, options.contact.site, part(options.contact.shell));
    if (options.otherCarrier) paint(rows, options.otherCarrier, () => carrier);
    if (options.ambiguousPeerCargo) paint(rows, [2 + peerTick, 6], part(peerShell));
    if (options.peerFloor) paint(rows, [5, 6], () => rotated ? 1 : 2);
    if (options.duplicatePeer) {
      paint(rows, [12 - tick, 8], () => carrier);
      paint(rows, [13 - tick, 8], part(peerShell));
    }
    if (options.ambiguousPeers) {
      paint(rows, [7 - tick, 6], () => carrier);
      paint(rows, [8 - tick, 6], part(peerShell));
    }
    if (options.blocked) paint(rows, [tick + 2, 2], () => rotated ? 0 : 6);
    if (options.secondOwner) paint(rows, [3 + peerTick, 6], () => rotated ? 0 : 6);
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
  await family.attachPrograms?.({ registerProgram: async () => ({ run: async ({ situation }: { situation: { routeSupported: boolean; knownInteraction: boolean } }) =>
    ({ result: situation.routeSupported ? 'P07' : situation.knownInteraction ? 'P02' : 'P05', receipt: {} }) }) } as unknown as NativeProgramRegistry);
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
  return { family, frame, packet, observe, command, direction, at, learned, interferingInk, shell, peerShell,
    contactInk: rotated ? 14 : 3, vector: ([x, y]: NativePoint): NativePoint => rotated ? [-y, x] : [x, y],
    inverseVector: ([x, y]: NativePoint): NativePoint => rotated ? [y, -x] : [x, y] };
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
  assert.deepEqual(state.transports[0].box, room.at([10, 5]), 'Acquire the actual other-carrier positions in order');
  if (parallel) {
    assert.equal(state.count, 76, 'Acquire every executed movement after the parallel local count has passed 70');
    assert.equal(state.refs.length, 6);
    assert.equal(new Set(state.refs).size, 6, 'Retain the ordered distinct actual returns');
    assert.deepEqual(state.loaded, room.learned.loaded, 'Reuse the loaded effect without relearning it');
    assert.deepEqual(state.transportCarriers, room.learned.transportCarriers, 'Keep the independently witnessed peer identity');
    assert.deepEqual(state.parallel.approach, []);
  }
  assert.equal(state.sharedEvidence, room.learned.sharedEvidence, 'Keep the original transport proof');
});

for (const rotated of [false, true]) test('independently matched carriers retain the learned transport role outside a sector layout'
  + (rotated ? ' with rotated geometry and remapped commands' : ''), async () => {
  const room = await settledParallelRoom(rotated);
  room.family.restore({ state: { ...room.family.state().state as Record<string, any>,
    geometry: { ...room.learned.geometry, initial_boxes: [...room.learned.geometry.initial_boxes, room.at([11, 8])] } } });
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'unique-observed-carrier-pairs', maxPointOccurrences: 250 }));
  const sessionId = 'paired-peer-route-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { duplicatePeer: true }))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(result.ticket, JSON.stringify({ reason: result.snapshot.reason, message: result.snapshot.message, trace: result.snapshot.trace }));
  const indices: number[] = [];
  while (result.ticket) {
    const ticket = result.ticket;
    indices.push(ticket.actionIndex);
    assert.ok(indices.length <= 16);
    result = await service.handle({ type: 'advance', sessionId, sequence: indices.length, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(2 + indices.length, { duplicatePeer: true })), indices.length) });
  }
  assert.deepEqual(indices, [0, 1, 2, 3, 4]);
  const state = room.family.state().state as Record<string, any>;
  assert.equal(state.sectorNetwork, undefined);
  assert.deepEqual(state.transports.map((item: any) => item.box).sort(), [room.at([10, 5]), room.at([6, 8])].sort());
  assert.ok(state.transports.every((item: any) => item.sources.length === 2));
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 5);
});

for (const rotated of [false, true]) test('crossing appearances cannot assign two equally close peer transports'
  + (rotated ? ' with rotated geometry and remapped commands' : ''), async () => {
  const room = await settledParallelRoom(rotated);
  room.family.restore({ state: { ...room.family.state().state as Record<string, any>,
    geometry: { ...room.learned.geometry, initial_boxes: [...room.learned.geometry.initial_boxes, room.at([6, 6])] } } });
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'ambiguous-observed-carrier-pairs', maxPointOccurrences: 250 }));
  const sessionId = 'crossing-peer-route-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { ambiguousPeers: true }))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(result.ticket);
  const remembered = structuredClone((room.family.state().state as Record<string, any>).transportCarriers);
  result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(3, { ambiguousPeers: true })), 1) });
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.deepEqual((room.family.state().state as Record<string, any>).transportCarriers, remembered);
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

for (const rotated of [false, true]) test('known peer coupling changes preserve the actually executed own route'
  + (rotated ? ' after rotated geometry and recolored coupling' : ''), async () => {
  const room = await settledParallelRoom(rotated);
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'observed-peer-coupling', maxPointOccurrences: 250 }));
  room.family.restore({ state: { ...room.family.state().state as Record<string, any>,
    geometry: { ...room.learned.geometry, insetFill: rotated ? 1 : 2 } } });
  const sessionId = 'peer-coupling-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { peerFloor: true }))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  const indices: number[] = [];
  while (result.ticket) {
    const ticket = result.ticket;
    indices.push(ticket.actionIndex);
    assert.ok(indices.length <= 5);
    const tick = 2 + indices.length;
    result = await service.handle({ type: 'advance', sessionId, sequence: indices.length, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(tick,
        { peerTick: Math.max(2, tick - 2), peerReleased: tick === 3, peerFloor: true })), indices.length) });
  }
  assert.deepEqual(indices, [0, 1, 2, 3, 4], 'The stationary release and renewed attachment have their acquired meanings');
  const state = room.family.state().state as Record<string, any>;
  assert.deepEqual(state.held, room.at([8, 2]));
  assert.deepEqual(state.transports[0].box, room.at([8, 5]));
  assert.ok(result.snapshot.trace.filter(event => event.kind === 'actual_outcome').every(event => event.matched === true));
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 5);
});

for (const rotated of [false, true]) test('a newly attached part immediately reuses the witnessed carrier role'
  + (rotated ? ' with a changed palette and controller' : ''), async () => {
  const room = await settledParallelRoom(rotated);
  const propose = room.family.propose.bind(room.family);
  room.family.propose = (observation, rows, inputs, remaining, execution) => propose(observation, rows, inputs, Math.min(remaining, 2), execution);
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'reused-peer-coupling', maxPointOccurrences: 250 }));
  const sessionId = 'peer-coupling-reuse-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  for (let count = 1; count <= 2; count++) {
    assert.ok(result.ticket, 'Both declared commands must actually be issued');
    result = await service.handle({ type: 'advance', sessionId, sequence: count, ticketId: result.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(2 + count, { peerTick: 2, peerReleased: count === 1 })), count) });
  }
  assert.equal(result.kind, 'boundary');
  const state = room.family.state().state as Record<string, any>;
  assert.equal(state.transports[0].sources.length, 1, 'The new attachment supplies one current association, without two repeated translations');
  const currentProof = state.transports[0].sources[0];
  result = await service.handle({ type: 'resume', sessionId, sequence: 2 });
  assert.ok(result.ticket);
  const proposal = result.snapshot.proposal as Record<string, any>;
  assert.equal(proposal.sicSituationCard.reservedParts.length, 1);
  assert.ok(proposal.route_refs.includes(currentProof));
  assert.ok(proposal.route_refs.includes(room.learned.sharedEvidence));
  result = await service.handle({ type: 'advance', sessionId, sequence: 3, ticketId: result.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(5, { peerTick: 3 })), 3) });
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
});

for (const condition of ['secondOwner', 'unfamiliarPeerShell', 'ambiguousPeerCargo'] as const) test('a peer coupling return closes on ' + condition, async () => {
  const room = await settledParallelRoom();
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'peer-coupling-refutation', maxPointOccurrences: 250 }));
  const sessionId = 'peer-coupling-refutation-' + condition;
  if (condition === 'ambiguousPeerCargo') room.family.restore({ state: { ...room.family.state().state as Record<string, any>,
    geometry: { ...room.learned.geometry, initial_boxes: [...room.learned.geometry.initial_boxes, room.at([4, 6])] } } });
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { secondOwner: condition === 'secondOwner', ambiguousPeerCargo: condition === 'ambiguousPeerCargo' }))),
    budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(result.ticket);
  result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(3, { peerTick: 2, peerReleased: true, [condition]: true })), 1) });
  assert.equal(result.ticket, null);
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
  assert.equal((room.family.state().state as Record<string, any>).sharedEvidence, room.learned.sharedEvidence);
});

async function contactAppearanceRoom(rotated: boolean) {
  const room = await settledParallelRoom(rotated);
  const state = room.family.state().state as Record<string, any>;
  room.family.restore({ state: { ...state, geometry: { ...state.geometry,
    targets: [...state.geometry.targets, room.at([3, 2])],
    initial_boxes: [...state.geometry.initial_boxes, room.at([8, 6])] } } });
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'acquire-contact-display', maxPointOccurrences: 250 }));
  const sessionId = 'contact-display-learning-' + rotated;
  const first = room.frame(2, { extraBoxes: [[8, 6]] });
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(first)), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(result.ticket);
  assert.equal(result.ticket.actionRef, 'ACTION5', 'Actually release the part already on the current observed target');
  assert.equal((room.family.state().state as Record<string, any>).contactAppearance, undefined);
  result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(room.frame(2, { ownShell: room.contactInk, extraBoxes: [[8, 6]] })), 1) });
  assert.equal(result.kind, 'boundary');
  const pending = room.family.state().state as Record<string, any>;
  assert.ok(pending.releasedContact, 'The executed release records only a pending contact appearance');
  assert.equal(pending.contactAppearance, undefined, 'A release alone does not prove a reversible display relation');
  result = await service.handle({ type: 'resume', sessionId, sequence: 1 });
  assert.ok(result.ticket);
  const commands: Record<string, NativePoint> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0], ...room.learned.free };
  const vector = room.inverseVector(commands[result.ticket.actionRef]!);
  const pose: NativePoint = [2 + vector[0], 2 + vector[1]];
  const returned = room.frame(2, { ownPose: pose, ownFace: vector, ownCargo: [3, 2], ownShell: room.shell, extraBoxes: [[8, 6]] });
  result = await service.handle({ type: 'advance', sessionId, sequence: 2, ticketId: result.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(room.packet(returned), 2) });
  assert.equal(result.kind, 'boundary');
  const learned = room.family.state().state as Record<string, any>;
  assert.equal(learned.contactAppearance.ink, room.contactInk);
  assert.equal(learned.contactAppearance.sources.length, 3, 'Release and withdrawal retain all three actual observation references');
  assert.equal(learned.releasedContact, undefined);
  room.family.restore({ state: { ...state, held: null, tried: [], contactAppearance: learned.contactAppearance,
    geometry: { ...state.geometry, initial_boxes: [room.at([9, 4]), room.at([5, 5])] } } });
  return { ...room, contact: learned.contactAppearance };
}

for (const rotated of [false, true]) test('native peer transport reuses an actually acquired reversible contact display'
  + (rotated ? ' with rotated cells, changed colors and remapped translation' : ''), async () => {
  const room = await contactAppearanceRoom(rotated);
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'reuse-contact-display', maxPointOccurrences: 250 }));
  const sessionId = 'contact-display-transfer-' + rotated;
  let result = await service.handle({ type: 'init', sessionId, sequence: 0,
    observation: toV6PublicObservation(room.packet(room.frame(2, { ownPose: [5, 4], ownFace: [0, 1], ownCargo: [9, 4], ownShell: room.shell,
      peerShell: room.contactInk }))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
  assert.ok(result.ticket);
  const proposal = result.snapshot.proposal as Record<string, any>;
  assert.ok(room.contact.sources.every((ref: string) => proposal.route_refs.includes(ref)));
  const indices: number[] = [];
  for (let index = 0; index < 2; index++) {
    assert.ok(result.ticket, 'The known display relation permits the next actual ticket');
    assert.equal(result.ticket.actionRef, room.command);
    indices.push(result.ticket.actionIndex);
    result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(3 + index, { ownPose: [6 + index, 4], ownFace: [1, 0], ownCargo: [9, 4],
        ownShell: room.shell })), index + 1) });
    assert.equal(result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
  }
  assert.deepEqual(indices, [0, 1]);
  assert.equal(result.kind, 'boundary');
  assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 2);
  assert.deepEqual((room.family.state().state as Record<string, any>).contactAppearance, room.contact);
});

for (const condition of ['unlearned', 'offFace', 'ambiguousCoupling', 'contradictedShell', 'protectedTarget'] as const)
  test('the observed contact display remains scoped on ' + condition, async () => {
    const room = await contactAppearanceRoom(false), state = room.family.state().state as Record<string, any>;
    if (condition === 'unlearned') delete state.contactAppearance;
    if (condition === 'ambiguousCoupling') state.transportCouplings.push({ ...state.transportCouplings[0], shell: 6 });
    room.family.restore({ state });
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'refute-contact-display', maxPointOccurrences: 250 }));
    const sessionId = 'contact-display-refutation-' + condition;
    const result = await service.handle({ type: 'init', sessionId, sequence: 0,
      observation: toV6PublicObservation(room.packet(room.frame(2, { ownPose: [5, 4], ownFace: condition === 'offFace' ? [1, 0] : [0, 1],
        ownCargo: [9, 4], ownShell: room.shell, peerShell: room.contactInk }))), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
    assert.ok(result.ticket);
    const next = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(room.frame(3, { ownPose: [6, 4], ownFace: [1, 0], ownCargo: [9, 4], ownShell: condition === 'protectedTarget' ? room.contactInk : room.shell,
        ...(condition === 'contradictedShell' ? { unfamiliarPeerShell: true } : {}) })), 1) });
    assert.equal(next.ticket, null);
    assert.equal(next.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, false);
    assert.equal(next.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
    assert.deepEqual((room.family.state().state as Record<string, any>).loaded, room.learned.loaded,
      'An unrelated own movement fact survives the peer contradiction');
  });

for (const variant of ['ordinary', 'cooperative', 'ambiguous-owner', 'contradictory-shell', 'protected-target'] as const)
  test('native withdrawal reuses acquired contact appearance: ' + variant, async () => {
    const cooperative = variant !== 'ordinary';
    const room = await contactAppearanceRoom(cooperative), state = room.family.state().state as Record<string, any>;
    const site: NativePoint = [8, 2], cargo: NativePoint = [12, 3];
    if (!cooperative) delete state.sharedEvidence;
    if (cooperative) state.free = { ...state.free, ACTION2: [0, -1] };
    delete state.parallel;
    state.count = 10;
    state.geometry = { ...state.geometry, initial_boxes: [room.at(site), room.at(cargo), ...(cooperative ? [room.at([9, 5])] : [])] };
    room.family.restore({ state });
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [room.family], sourceDigest: 'withdraw-contact', maxPointOccurrences: 250 }));
    const sessionId = 'withdraw-contact-' + variant;
    const first = room.frame(2, { ownPose: [8, 3], ownFace: [0, -1], ownCargo: cargo, ownShell: room.shell,
      contact: { site, shell: room.contactInk }, omitPeer: !cooperative, peerTick: 6,
      ...(variant === 'ambiguous-owner' ? { otherCarrier: [7, 2] as const } : {}) });
    let result = await service.handle({ type: 'init', sessionId, sequence: 0,
      observation: toV6PublicObservation(room.packet(first)), budgets: { targetLevels: 2, levelActionCaps: [40, 40] } });
    assert.ok(result.ticket, result.snapshot.reason);
    assert.equal(result.ticket.actionRef, room.command);
    assert.ok(room.contact.sources.every((ref: string) => (result.snapshot.proposal as Record<string, any>).route_refs.includes(ref)));
    assert.deepEqual((room.family.state().state as Record<string, any>).contactAppearance, room.contact);
    for (let index = 0; index < 2; index++) {
      assert.ok(result.ticket, 'Each continuation requires the previous actual return');
      assert.equal(result.ticket.actionIndex, index);
      assert.equal(result.ticket.actionRef, room.command);
      const returned = room.frame(2, { ownPose: [9 + index, 3], ownFace: [1, 0], ownCargo: cargo, ownShell: room.shell,
        contact: { site, shell: variant === 'contradictory-shell' ? room.contactInk : room.shell },
        omitPeer: !cooperative, peerTick: variant === 'protected-target' ? 7 : 6,
        ...(variant === 'ambiguous-owner' ? { otherCarrier: [7, 2] as const } : {}) });
      result = await service.handle({ type: 'advance', sessionId, sequence: index + 1, ticketId: result.ticket.id, executionMs: 1,
        observation: toV6PublicObservation(room.packet(returned), index + 1) });
      const matched = result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched;
      if (variant !== 'ordinary' && variant !== 'cooperative') {
        assert.equal(matched, false);
        assert.equal(result.ticket, null);
        assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 1);
        const reconciled = room.family.state().state as Record<string, any>;
        assert.equal(reconciled.count, state.count + 1);
        assert.deepEqual(reconciled.contactAppearance, variant === 'contradictory-shell' ? undefined : room.contact);
        assert.deepEqual(reconciled.loaded, state.loaded);
        return;
      }
      assert.equal(matched, true);
    }
    assert.equal(result.kind, 'boundary');
    assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sealed_prefix')?.acquired_actions, 2);
    assert.equal((room.family.state().state as Record<string, any>).count, state.count + 2);
    assert.deepEqual((room.family.state().state as Record<string, any>).contactAppearance, room.contact);
  });

for (const scenario of ['divided', 'rotated', 'unlearned-shell', 'ambiguous-peer', 'changed-receiver'] as const)
  test('a directional ticket reassociates visible divided cargo after peer attachment: ' + scenario, async () => {
    const rotated = scenario === 'rotated';
    const room = await witnessedRoom(rotated);
    const prior = room.learned;
    assert.ok(prior.transportCouplings.some((role: { shell: number; sources: string[] }) => role.shell === room.peerShell && role.sources.length === 2));
    const { pitch, phase, core, background } = prior.geometry;
    const bodyInk = rotated ? 7 : 15, faceInk = rotated ? 11 : 0;
    const receiver: NativePoint[] = [[2, 3], [2, 4], [10, 3], [10, 4]];
    const paint = (rows: number[][], [x, y]: NativePoint, ink: (dx: number, dy: number) => number) => {
      for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
        rows[phase[1] + y * pitch + dy]![phase[0] + x * pitch + dx] = ink(dx, dy);
      }
    };
    function frame(pose: NativePoint, face: NativePoint, attached: boolean) {
      const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(background));
      const axis = rotated ? 1 : 0, divider = room.at([7, 0])[axis];
      const size = Math.floor((64 - phase[1 - axis]) / pitch);
      for (let v = 0; v < size; v++) {
        paint(rows, rotated ? [v, divider] : [divider, v], (x, y) => (rotated ? y : x) === 0 ? 6 : background);
      }
      const visibleTargets = (attached && scenario === 'changed-receiver' ? receiver.slice(1) : receiver).map(room.at);
      for (const site of visibleTargets) paint(rows, site, (x, y) => {
        const neighbor = (dx: number, dy: number) => visibleTargets.some(target => target[0] === site[0] + dx && target[1] === site[1] + dy);
        const edge = x === 0 && !neighbor(-1, 0) || x === pitch - 1 && !neighbor(1, 0)
          || y === 0 && !neighbor(0, -1) || y === pitch - 1 && !neighbor(0, 1);
        return edge ? core : 3;
      });
      const direction = room.vector(face);
      paint(rows, room.at(pose), (x, y) => (direction[0] === 1 ? x === pitch - 1 : direction[0] === -1 ? x === 0
        : direction[1] === 1 ? y === pitch - 1 : y === 0) ? faceInk : prior.color);
      const crate = (shell: number) => (x: number, y: number) => x === 0 || y === 0 || x === pitch - 1 || y === pitch - 1 ? shell : core;
      for (const site of [[5, 5], [3, 5]] as NativePoint[]) paint(rows, room.at(site), crate(room.shell));
      paint(rows, room.at([10, 8]), crate(attached ? scenario === 'unlearned-shell' ? 10 : room.peerShell : room.shell));
      paint(rows, room.at([11, 8]), () => bodyInk);
      if (scenario === 'ambiguous-peer') paint(rows, room.at([10, 7]), () => bodyInk);
      return toV6PublicObservation({ ...room.packet(rows), level: 2, levelCount: 3, levelsCompleted: 1 });
    }

    let demonstrated = 0;
    const observationSource: NativeFamily = {
      id: preparedEffectsId,
      propose(observation) {
        if (demonstrated === 2) return null;
        const action = { action_ref: room.command, data: {} };
        return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }],
          sicLocalDecision: { strategy: 'observe_public_input' }, binding: { observation_ref: observation.observation_ref } };
      },
      before: (proposal, _index, _packet, observation) =>
        ({ admitted: proposal.binding?.observation_ref === observation.observation_ref, reason: 'public_direction_bound' }),
      after: () => ({ matched: true, seal_prefix: true, reason: 'public_direction_returned' }),
      record: () => { demonstrated++; return { events: [] }; },
      state: () => ({ demonstrated }), restore(state) { demonstrated = Number(state.demonstrated); },
    };
    const sessionId = 'divided-cargo-' + scenario;
    const service = new V6AgentService(() => new NativeV6Runtime({ families: [observationSource, room.family],
      sourceDigest: 'rebind-divided-cargo', maxPointOccurrences: 250 }));
    let result = await service.handle({ type: 'init', sessionId, sequence: 0,
      observation: toV6PublicObservation({ ...room.packet(room.frame(2)), levelCount: 3 }),
      budgets: { targetLevels: 3, levelActionCaps: [40, 40, 40] } });
    assert.ok(result.ticket);
    result = await service.handle({ type: 'advance', sessionId, sequence: 1, ticketId: result.ticket.id, executionMs: 1,
      observation: { ...frame([3, 6], [1, 0], false), stepIndex: 1 } });
    assert.equal(result.kind, 'boundary');
    result = await service.handle({ type: 'resume', sessionId, sequence: 1 });
    assert.ok(result.ticket);
    assert.equal(result.ticket.actionRef, room.command);
    result = await service.handle({ type: 'advance', sessionId, sequence: 2, ticketId: result.ticket.id, executionMs: 1,
      observation: { ...frame([4, 6], [1, 0], true), stepIndex: 2 } });
    const directionReturn = result.snapshot.trace.findLast(event => event.kind === 'actual_outcome');
    assert.equal(directionReturn?.matched, true);
    assert.equal(result.kind, 'boundary');
    result = await service.handle({ type: 'resume', sessionId, sequence: 2 });
    if (scenario !== 'divided' && scenario !== 'rotated') {
      assert.equal(result.ticket, null);
      assert.equal((room.family.state().state as Record<string, any>).epoch, 1);
      return;
    }
    assert.ok(result.ticket, result.snapshot.reason);
    const nextProposal = result.snapshot.proposal as Record<string, any>;
    assert.equal(result.snapshot.trace.findLast(event => event.kind === 'sic_native_plan')?.family, room.family.id);
    assert.ok(nextProposal.route_refs.includes(directionReturn?.observation_ref));
    assert.ok(prior.transportCouplings[0].sources.every((ref: string) => nextProposal.route_refs.includes(ref)));
    const commands: Record<string, NativePoint> = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0], ...prior.free };
    const direction = room.inverseVector(commands[result.ticket.actionRef]!);
    result = await service.handle({ type: 'advance', sessionId, sequence: 3, ticketId: result.ticket.id, executionMs: 1,
      observation: { ...frame([4 + direction[0], 6 + direction[1]], direction, true), stepIndex: 3 } });
    assert.equal(result.snapshot.trace.findLast(event => event.kind === 'actual_outcome')?.matched, true);
    assert.equal((room.family.state().state as Record<string, any>).epoch, 2);
    assert.equal((room.family.state().state as Record<string, any>).geometry.initial_boxes.length, 3);
  });
