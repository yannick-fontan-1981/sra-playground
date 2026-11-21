import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeProgramRegistry } from '../src/logos-engine/v6-native-types.ts';
import { measureDeliveryPassage } from '../src/sic/delivery-passage.ts';
import { createSicVerifyOrientedDelivery } from '../src/sic/oriented-delivery.ts';
import { measureSectorNetwork } from '../src/sic/sector-delivery.ts';

test('an observed carrier can justify a handoff during the level where its movement was learned', async () => {
  const pitch = 4, rows = Array.from({ length: 36 }, () => Array<number>(44).fill(1));
  function paint(x: number, y: number, ink: (dx: number, dy: number) => number) {
    for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
      rows[y * pitch + dy]![x * pitch + dx] = ink(dx, dy);
    }
  }
  const parts: NativePoint[] = [[3, 6], [4, 4]];
  for (const y of [2, 3, 5]) paint(4, y, dx => dx === 0 ? 7 : 1);
  for (const [x, y] of parts) paint(x, y, (dx, dy) => dx === 0 || dy === 0 || dx === 3 || dy === 3 ? 4 : 9);
  paint(1, 4, dx => dx === 3 ? 0 : 14);
  paint(6, 4, () => 15);
  const targets: NativePoint[] = [];
  for (const x of [8, 9]) for (const y of [3, 4, 5, 6]) {
    targets.push([x, y]);
    paint(x, y, () => 9);
  }
  const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: 'observed-room',
    level: 1, levels_completed: 0, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'] }, 8);
  const carrier = observation.entities.find(e => e.palette_value === 15)!;
  const state = { epoch: observation.level_epoch, color: 14, held: null, invitation: null, free: {}, loaded: {},
    tried: [], refs: [observation.observation_ref], count: 6, geometry: {
      pitch, phase: [0, 0], background: 1, core: 9, rest_shell: 4, targets, initial_boxes: parts,
    } };
  const provider = createSicVerifyOrientedDelivery();
  await provider.attachPrograms?.({
    registerProgram: async () => ({ run: async () => ({ result: 'P05', receipt: {} }) }),
  } as unknown as NativeProgramRegistry);
  provider.restore({ state });
  const direct = await provider.propose(observation, rows, [], 80);
  assert.ok(direct);
  assert.equal(direct.local.relay, undefined);
  provider.restore({ state: { ...state, sharedEvidence: 'observed-other-carrier', transportCarriers: [carrier.signature] } });
  const joint = await provider.propose(observation, rows, [], 80);
  assert.ok(joint?.local.relay);
  assert.equal(joint.local.relay.carrier, carrier.signature);
  assert.deepEqual(joint.local.relay.evidence, ['observed-other-carrier', observation.observation_ref]);
});

test('local receivers coexist with a relay to a separate sector that has a carrier', () => {
  const targets: NativePoint[] = [[1, 1], [5, 1]];
  const actor: NativePoint = [1, 2];
  const rows = Array.from({ length: 8 }, () => Array.from({ length: 14 }, (_, x) => x === 7 ? 0 : 1));
  const geometry = { pitch: 2, phase: [0, 0] as const, background: 1, core: 9, targets };
  const network = measureSectorNetwork(rows, geometry, actor, [[2, 1]], [[5, 2]]);
  assert.deepEqual(network?.localTargets, [[1, 1]]);
  assert.deepEqual(network?.receiving.map(sector => sector.targets), [[[5, 1]]]);
  assert.ok(network?.receiving[0]?.ports.some(port => port.cell[0] === 3 && port.face[0] === 1));
  assert.ok(!network?.sending.includes('3,1'));
  assert.equal(measureSectorNetwork(rows, geometry, actor, [[2, 1]], []), null);
});

test('delivery passage uses the visible opening and separates the two work areas', () => {
  const targets: NativePoint[] = [[1, 2], [1, 3], [1, 4]];
  const actor: NativePoint = [8, 4], peer: NativePoint = [3, 4];
  const parts: NativePoint[] = [[7, 5], [8, 2]];
  const rows = Array.from({ length: 9 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => x === 5 && y !== 4 && y !== 5 ? 0 : 1));
  const geometry = { pitch: 1, phase: [0, 0] as const, background: 1, targets };
  const passage = measureDeliveryPassage(rows, geometry, actor, parts, [peer]);
  assert.deepEqual(passage?.mouths, [[6, 4], [6, 5]]);
  assert.ok(passage?.floor.includes('5,5'));
  assert.ok(!passage?.floor.includes('5,3'));
  assert.ok(!passage?.source.includes('5,5'));
  assert.ok(passage?.source.includes('7,5'));
  assert.equal(measureDeliveryPassage(rows, geometry, actor, parts, [[7, 4]]), null);

  const transpose = ([x, y]: NativePoint): NativePoint => [y, x];
  const columns = rows[0]!.map((_, x) => rows.map(row => row[x]!));
  const vertical = measureDeliveryPassage(columns, { ...geometry, targets: targets.map(transpose) },
    transpose(actor), parts.map(transpose), [transpose(peer)]);
  assert.deepEqual(vertical?.mouths, [[4, 6], [5, 6]]);
});

test('read a receiver with a visible outline and a corner hidden by a framed part', async () => {
  const rows = Array.from({ length: 32 }, () => Array<number>(36).fill(1));
  for (let y = 8; y < 16; y++) for (let x = 12; x < 20; x++) {
    rows[y]![x] = x === 12 || x === 19 || y === 8 || y === 15 ? 9 : 2;
  }
  for (const [left, top] of [[12, 12], [24, 20]] as const) {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      rows[top + y]![left + x] = x === 0 || x === 3 || y === 0 || y === 3 ? 4 : 9;
    }
  }
  for (let y = 20; y < 24; y++) rows[y]!.fill(y === 20 ? 0 : 14, 4, 8);
  const provider = createSicVerifyOrientedDelivery();
  const observe = (frame_rows: number[][], revision: number) => measureNativeObservation({
    frame_rows, frame_hash: String(revision), level: 2, levels_completed: 1, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
  }, revision);
  const observation = await observe(rows, 2);
  provider.restore({ state: { epoch: observation.level_epoch - 1, sharedEvidence: 'prior-transport', transportCarriers: [],
    geometry: { pitch: 4, phase: [0, 0], background: 1, core: 9, rest_shell: 4, targets: [], initial_boxes: [] },
    free: { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] }, loaded: {} } });
  await provider.attachPrograms?.({
    registerProgram: async () => ({ run: async () => ({ result: 'P07', receipt: {} }) }),
  } as unknown as NativeProgramRegistry);
  const proposal = await provider.propose(observation, rows, [], 80);
  assert.ok(proposal);
  assert.deepEqual(proposal.local.geometry.targets, [[3, 2], [4, 2], [3, 3], [4, 3]]);
  assert.equal(proposal.step.intercept, undefined);

  const broken = structuredClone(rows);
  broken[8]![15] = 1;
  assert.equal(await provider.propose(await observe(broken, 3), broken, [], 80), null);
});

test('waiting near a delivered part and intercepting a frontal carrier are distinct steps', async () => {
  const rows = Array.from({ length: 28 }, () => Array<number>(32).fill(1));
  for (let y = 12; y < 16; y++) for (let x = 8; x < 12; x++) rows[y]![x] = x === 11 ? 0 : 14;
  for (let y = 16; y < 20; y++) for (let x = 16; x < 20; x++) {
    rows[y]![x] = x === 16 || x === 19 || y === 16 || y === 19 ? 4 : 9;
  }
  for (let y = 16; y < 20; y++) rows[y]!.fill(15, 12, 16);
  const observe = (frame_rows: number[][], revision: number) => measureNativeObservation({
    frame_rows, frame_hash: String(revision), level: 2, levels_completed: 1, state: 'NOT_FINISHED',
    available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
  }, revision);
  const observation = await observe(rows, 1);
  const provider = createSicVerifyOrientedDelivery();
  provider.restore({ state: {
    epoch: observation.level_epoch, color: 14, held: null, invitation: null, free: {}, loaded: {}, tried: [], refs: [], count: 0,
    geometry: { pitch: 4, phase: [0, 0], background: 1, core: 9, rest_shell: 4, insetFill: 2,
      targets: [[1, 2]], initial_boxes: [[4, 4]], transferPads: [[4, 4]] },
    interference: { ink: 15, ref: 'observed-carrier' }, transferEvidence: { part: [4, 4], ref: 'observed-transfer' },
  } });
  await provider.attachPrograms?.({
    registerProgram: async () => ({ run: async () => ({ result: 'P05', receipt: {} }) }),
  } as unknown as NativeProgramRegistry);

  const pause = await provider.propose(observation, rows, [], 80);
  assert.ok(pause);
  assert.equal(pause.actions[0]?.action_ref, 'ACTION5');
  assert.equal(pause.step.waitForTransport, true);
  assert.equal(pause.step.intercept, undefined);

  const next = structuredClone(rows);
  for (let y = 16; y < 20; y++) next[y]!.fill(1, 12, 16);
  for (let y = 12; y < 16; y++) for (let x = 12; x < 16; x++) {
    next[y]![x] = x === 12 || x === 15 || y === 12 || y === 15 ? 7 : 15;
  }
  const approached = await observe(next, 2);
  const outcome = await provider.after(pause, 0, observation, approached, rows, next);
  assert.equal(outcome.reason, 'observed_carrier_rendezvous_turn');
  await provider.record?.(observation, approached, pause.actions[0]!, rows, next, pause, 0, []);
  const contact = await provider.propose(approached, next, [], 79);
  assert.ok(contact);
  assert.equal(contact.actions[0]?.action_ref, 'ACTION5');
  assert.equal(contact.step.intercept, true);
  assert.equal(contact.step.waitForTransport, undefined);
});
