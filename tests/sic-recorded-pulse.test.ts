import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativeObservation, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { beginRecording, chooseRecording, observeRecording, type RecordingScene } from '../src/sic/recorded-replay-access.ts';

const start: NativePoint = [1, 1], entrance: NativePoint = [4, 1], landing: NativePoint = [10, 1];
const goal: NativePoint = [13, 1];
const scene: RecordingScene = {
  body: { signature: 'carrier', start, floor: 1, size: [2, 2], quantum: 3, mask: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  goal, nodes: [], slots: [[1, 5, 1, 5], [3, 5, 3, 5], [5, 5, 5, 5]],
  transfer: { contact: entrance, frames: [entrance, landing], channel: [7, 1, 9, 2] },
};
const observation = ([x, y]: NativePoint) => ({
  observation_ref: 'seen', entities: [{ signature: 'carrier', bbox: [x, y, x + 1, y + 1] }],
}) as NativeObservation;
const rows = Array.from({ length: 6 }, (_, y) =>
  Array.from({ length: 16 }, (_, x) => y >= 1 && y <= 2 && (x >= 1 && x <= 5 || x >= 10 && x <= 14) ? 1 : 0));
const startRecording = () => beginRecording(scene, 1, { ACTION1: [0, -3], ACTION2: [0, 3],
  ACTION3: [-3, 0], ACTION4: [3, 0] }, 'ACTION5', ['start'], rows)!;

test('the planner uses the entry at the recorded tick and does not turn the pulse into a permanent edge', () => {
  const contribution = { path: [start, [1, 4] as NativePoint], contact: entrance, changed: [], evidence: ['first'] };
  const second = { ...contribution, contact: [13, 4] as NativePoint };
  const withPulse = (tick: number) => ({ ...startRecording(), paths: [{ ...contribution, pulse: { tick, ref: 'pulse' } }, second] });
  const crossing = chooseRecording(observation(start), rows, withPulse(1));
  assert.deepEqual(crossing?.entry, entrance);
  assert.deepEqual(crossing?.expected, landing);
  assert.equal(chooseRecording(observation(start), rows, withPulse(0)), null);
});

test('a contact must produce an animated change inside the link to be recorded as a pulse', () => {
  const choice = chooseRecording(observation(start), rows, startRecording())!;
  assert.deepEqual(choice.expected, entrance);
  assert.equal(observeRecording(choice, observation(entrance), rows, rows, [rows, rows]), null);
  const pulse = rows.map(row => [...row]);
  pulse[1]![7] = 3;
  pulse[1]![8] = 3;
  const seen = observeRecording(choice, observation(entrance), rows, rows, [rows, pulse, pulse, rows]);
  assert.equal(seen?.pendingPulse?.tick, 1);
  assert.equal(seen?.pending.length, 0);
});

test('a second visible link cannot certify the first contact with its own animation', () => {
  const initial = startRecording();
  const choice = chooseRecording(observation(start), rows, initial)!;
  const first = scene.transfer!;
  const second = { contact: [4, 4], frames: [[4, 4], [10, 4]], channel: [7, 4, 9, 5] } as const;
  const recording = { ...choice.recording, scene: { ...scene, transfer: undefined, transfers: [second, first] } };
  const candidate = { ...choice, recording };
  const flash = (y: number) => {
    const frame = structuredClone(rows);
    frame[y]![7] = 3;
    frame[y]![8] = 3;
    return [rows, frame, frame, rows];
  };

  assert.equal(observeRecording(candidate, observation(entrance), rows, rows, flash(4)), null);
  assert.equal(observeRecording(candidate, observation(entrance), rows, rows, flash(1))?.pendingPulse?.tick, 1);
});

test('one recording preserves distinct ticks for two obstacle shifts before holding a contact', () => {
  const cells = ([x, y]: NativePoint): NativePoint[] => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
  const firstBlock = cells([7, 1]), secondBlock = cells([10, 4]);
  const firstContact: NativePoint = [1, 4], secondContact: NativePoint = [4, 4], heldContact: NativePoint = [7, 4];
  const field = structuredClone(rows);
  const paint = (grid: number[][], points: NativePoint[], ink: number) => {
    for (const [x, y] of points) grid[y]![x] = ink;
  };
  for (const contact of [firstContact, secondContact, heldContact]) paint(field, cells(contact), 1);
  paint(field, firstBlock, 7);
  paint(field, secondBlock, 8);
  const initial = beginRecording({ ...scene, slots: [[0, 0, 0, 0], [1, 0, 1, 0], [2, 0, 2, 0]], nodes: [
    { position: firstContact, peer_support: firstBlock },
    { position: secondContact, peer_support: secondBlock },
    { position: heldContact, peer_support: [[13, 0]] },
  ] }, 1, startRecording().vectors, 'ACTION5', ['start'], field)!;
  const first = chooseRecording(observation(start), field, initial)!;
  assert.deepEqual(first.expected, firstContact);
  const firstShift = structuredClone(field);
  paint(firstShift, firstBlock, 1);
  paint(firstShift, cells([10, 1]), 7);
  const prepared = observeRecording(first, { ...observation(firstContact), observation_ref: 'first-shift' }, field, firstShift)!;

  const second = chooseRecording(observation(firstContact), firstShift, prepared)!;
  assert.deepEqual(second.expected, secondContact);
  assert.equal(observeRecording(second, observation(secondContact), firstShift, firstShift), null);
  const secondShift = structuredClone(firstShift);
  paint(secondShift, secondBlock, 1);
  paint(secondShift, cells([13, 4]), 8);
  const both = observeRecording(second, { ...observation(secondContact), observation_ref: 'second-shift' }, firstShift, secondShift)!;
  const hold = chooseRecording(observation(secondContact), secondShift, both)!;
  assert.deepEqual(hold.expected, heldContact);
  const opened = structuredClone(secondShift);
  opened[0]![13] = 1;
  const held = observeRecording(hold, observation(heldContact), secondShift, opened)!;

  const commit = chooseRecording(observation(heldContact), opened, held)!;
  assert.equal(commit.intent, 'commit');
  const rewound = structuredClone(field);
  rewound[0]![0] = 2;
  const saved = observeRecording(commit, observation(start), opened, rewound);
  assert.deepEqual(saved?.paths[0]?.preparations?.map(effect => [effect.tick, effect.ref, effect.retained]),
    [[1, 'first-shift', true], [2, 'second-shift', true]]);
  assert.equal(saved?.paths[0]?.changed.length, 1);
});

test('track an independent lane operator separately and verify its change to a linked block', () => {
  const player: NativePoint = [1, 4], auxiliary: NativePoint = [1, 13], switchPosition: NativePoint = [4, 13];
  const contact: NativePoint = [4, 4], block: NativePoint = [7, 4], otherBlock: NativePoint = [13, 4];
  const field = Array.from({ length: 17 }, () => Array<number>(20).fill(0));
  const patch = (rows: number[][], [x, y]: NativePoint, ink: number) => {
    for (let i = y; i < y + 2; i++) rows[i]!.fill(ink, x, x + 2);
  };
  const pixels = ([x, y]: NativePoint): NativePoint[] => [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
  patch(field, player, 9);
  patch(field, auxiliary, 10);
  patch(field, switchPosition, 1);
  patch(field, [7, 13], 1);
  patch(field, contact, 1);
  patch(field, block, 7);
  patch(field, otherBlock, 8);
  const layout: RecordingScene = { body: { ...scene.body, start: player }, goal: [16, 4], slots: scene.slots, nodes: [
    { position: contact, peer_support: [[4, 0]] },
    { position: switchPosition, peer_support: pixels(block) },
    { position: [10, 4], peer_support: pixels(otherBlock) },
  ] };
  const observed = (actor: NativePoint, [x, y]: NativePoint) => {
    const value = observation(actor);
    return { ...value, entities: [...value.entities,
      { bbox: [x, y, x + 1, y + 1], signature: 'independent', mask: scene.body.mask } as NativeObservation['entities'][number]] };
  };
  const initial = beginRecording(layout, 1, startRecording().vectors, 'ACTION5', ['start'], field, observed(player, auxiliary));
  assert.ok(initial);
  assert.deepEqual(initial.lane?.points, [auxiliary, switchPosition, [7, 13]]);
  const choice = chooseRecording(observed(player, auxiliary), field, initial);
  assert.ok(choice);
  assert.deepEqual(choice.expected, contact);

  const returned = structuredClone(field);
  returned[0]![4] = 1;
  patch(returned, block, 1);
  assert.equal(observeRecording(choice, observed(contact, auxiliary), field, returned), null);
  const accepted = observeRecording(choice, observed(contact, switchPosition), field, returned);
  assert.equal(accepted?.lane?.switches[0]?.closed, false);
  assert.equal(accepted?.pending.length, 1);
});
