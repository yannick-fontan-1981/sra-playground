import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { retainNativeJson } from '../src/logos-engine/v6-native-owned.ts';
import { checkContactPrediction, observeContactExperiment, type ContactMemory } from '../src/sic/contact-transfer.ts';
import { observeCoverage, type CoverageLearning } from '../src/sic/observed-coverage.ts';
import { chooseSeparationTrial, type ObservedTravel } from '../src/sic/observed-travel-frontier.ts';
import { createSicPublicInputExploration } from '../src/sic/public-input-exploration.ts';

const body = [8,8,8,8,2,8,8,8,8];
const actor = [0,6,0,6,6,6,0,6,0];
const target = [1,1,1,1,0,1,1,1,1];
const control = [0,3,0,3,3,3,0,3,0];
const command = { action_ref: 'ACTION4', data: {} };
const transfer = { epoch: 2, motion: 'pull' as const, exitPattern: target.join(','), ref: 'previous-win' };
const pulled: CoverageLearning = { motion: 'pull', body: body.join(','), supports: [], walls: {}, refs: ['moved'], recovered: [],
  lastPull: { from: '9,3', to: '6,3', actor: '3,3', ref: 'moved' } };

function scene(tiles: Record<string, number[]>) {
  const rows = Array.from({length: 15}, () => Array<number>(21).fill(0));
  for (const [cell, pixels] of Object.entries(tiles)) {
    const [x,y] = cell.split(',').map(Number) as [number,number];
    pixels.forEach((ink,i) => { rows[y + Math.floor(i/3)]![x + i%3] = ink; });
  }
  return rows;
}
function travel(at: string, delta: [number,number]): ObservedTravel {
  return { grid: { pitch: 3, phase: [0,0], ink: 6, floor: 0 }, actor: at, moves: { ACTION4: { delta, ref: 'measured-direction' } },
    supports: [], visited: [at], tested: {}, altered: [], controls: [], completed: [], switches: {}, refs: ['seen'], stalled: 0 };
}

test('a measured departure distinguishes following from independent motion and retires a completed probe', () => {
  const before = scene({'6,3': actor, '9,3': body, '15,9': body});
  const source = travel('6,3', [-3,0]), returned = travel('3,3', [-3,0]);
  const trial = chooseSeparationTrial(source, before, [command], []);
  assert.equal(trial?.purpose, 'separate_object');
  assert.deepEqual(trial?.target, [9,3]);
  assert.deepEqual(trial?.command, command);
  assert.equal(chooseSeparationTrial(source, before, [command], [trial!.experiment!]), undefined);

  const measured = (bodyAt: string) => observeCoverage(undefined, source, returned, before,
    scene({'3,3': actor, [bodyAt]: body, '15,9': body}), command, 'independent-return');
  assert.equal(measured('9,3')?.motion, undefined);
  assert.equal(measured('6,3')?.lastPull?.ref, 'independent-return');
});

test('remote transport requires an observed control and tracks a piece through a changed surface', () => {
  const before = scene({'3,9': actor, '3,6': control, '9,3': body, '15,9': body, '18,6': target});
  const after = scene({'3,6': actor, '12,3': [3,8,3,8,2,8,3,8,3], '15,9': body, '18,6': target});
  const oldTravel = travel('3,9', [0,-3]), newTravel = travel('3,6', [0,-3]);
  const local: ContactMemory = { exit: '18,6', features: {}, ref: 'seen', bodies: ['9,3','15,9'],
    effects: [{ control: '3,6', site: '9,3', ref: 'control-return' }], tested: [], blocked: {} };
  const observe = (memory: ContactMemory | undefined, rows = before) =>
    observeContactExperiment(memory, transfer, pulled, oldTravel, newTravel, rows, after, command, 'moved-remotely');
  assert.deepEqual(observe(local)?.transfers, [{control:'3,6', site:'9,3', landing:'12,3', ref:'moved-remotely'}]);
  assert.deepEqual(observe(local)?.bodies, ['12,3','15,9']);
  assert.deepEqual(observe({...local,effects: []})?.transfers, []);
  assert.equal(observe(undefined, scene({'18,6':target, '18,9':target})), undefined);
  const prediction = { command, purpose: 'couple_effect' as const, experiment: 'test', actor: '3,6', bodies: ['12,3','15,9'], final:true, evidence:[] };
  assert.ok(checkContactPrediction(prediction, oldTravel, pulled, after));
  assert.equal(checkContactPrediction({...prediction,bodies:['9,3','15,9']}, oldTravel, pulled, after), false);
});

test('recording travel after a push transfer keeps the native checkpoint valid without contact evidence', async () => {
  const beforeRows = scene({'6,3': actor, '9,3': body, '18,6': target});
  const afterRows = scene({'3,3': actor, '9,3': body, '18,6': target});
  const inputs = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4'];
  const observe = (rows: number[][], revision: number) => measureNativeObservation({
    frame_rows: rows, frame_hash: `board-${revision}`, level: 3, levels_completed: 2,
    available_action_refs: inputs, state: 'NOT_FINISHED',
  }, revision);
  const before = await observe(beforeRows, 1), after = await observe(afterRows, 2);
  const family = createSicPublicInputExploration(true);
  family.restore({ epoch: 3, experiments: 0, transitions: {}, options: {}, lastChange: null, recheck: null,
    travel: travel('6,3', [-3,0]), coverage: { ...pulled, motion: 'push' }, coverageTransfer: { ...transfer, motion: 'push' } });

  await family.record(before, after, command, beforeRows, afterRows, {
    status: 'proposed', kind: family.id, actions: [command], source: 'entry', candidates: inputs, needId: 'observe-travel',
  }, 0);
  const checkpoint = retainNativeJson(family.state());
  assert.equal(Object.hasOwn(checkpoint, 'contactMemory'), false);
  assert.equal(checkpoint.travel?.actor, '3,3');
  assert.equal(checkpoint.coverageTransfer?.motion, 'push');
});
