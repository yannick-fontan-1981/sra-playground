import assert from 'node:assert/strict';
import test from 'node:test';
import { nextConfiguration, newConfigurationMemory, observeConfiguration } from '../src/sic/configuration-trials.ts';

const board = (left: number, right: number) => [[left, 3, 3, 3, right]];
const left = 'ACTION6:0,0', right = 'ACTION6:4,0';
function observedPair() {
  const memory = newConfigurationMemory();
  observeConfiguration(memory, board(3,3), board(8,3), left, 'left-out');
  observeConfiguration(memory, board(8,3), board(3,3), left, 'left-back');
  observeConfiguration(memory, board(3,3), board(3,6), right, 'right-out');
  observeConfiguration(memory, board(8,3), board(3,3), left, 'left-back');
  return memory;
}

test('predicts an unseen conjunction from independent changes with their public evidence', () => {
  const memory = observedPair();
  const trial = nextConfiguration(memory, board(3,6), ['ACTION6']);
  assert.ok(trial);
  assert.deepEqual([trial.action, trial.from, trial.expected, trial.target], [left, '01', '11', '11']);
  assert.deepEqual(trial.evidence, ['left-out', 'left-back', 'right-out']);
  observeConfiguration(memory, board(3,6), board(8,6), left, 'combined', trial);
  assert.equal(nextConfiguration(memory, board(8,6), ['ACTION6']), null);
});

test('records interference in its context and preserves a route from a different configuration', () => {
  const memory = observedPair();
  const trial = nextConfiguration(memory, board(3,6), ['ACTION6'])!;
  observeConfiguration(memory, board(3,6), board(8,3), left, 'interference', trial);
  assert.deepEqual(memory.failures, ['01/'+left]);
  assert.equal(nextConfiguration(memory, board(3,6), ['ACTION6'])?.action, right);
  assert.equal(nextConfiguration(memory, board(8,3), ['ACTION6'])?.action, right);
});

test('requires two distinct controls, an available command and a known local value', () => {
  const memory = newConfigurationMemory();
  observeConfiguration(memory, board(3,3), board(8,3), left, 'left-out');
  observeConfiguration(memory, board(8,3), board(3,6), right, 'interfering-change');
  assert.equal(memory.factors.length, 1);
  assert.equal(nextConfiguration(memory, board(3,6), ['ACTION6']), null);
  const pair = observedPair();
  assert.equal(nextConfiguration(pair, board(3,6), ['ACTION1']), null);
  assert.equal(nextConfiguration(pair, board(0,6), ['ACTION6']), null);
});
