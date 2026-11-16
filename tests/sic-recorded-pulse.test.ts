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
