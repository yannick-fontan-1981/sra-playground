import test from 'node:test';
import assert from 'node:assert/strict';
import {
  openCapacityQuestion,
  offerCapacityWord,
  recordCapacityWord,
} from '../src/sic/probe-territorial-capacity.ts';
import { initialMemory } from '../src/sic/preparation-experiments.ts';
const sig = { signature: 'marker', fixed: [] },
  publicActions = ['ACTION1', 'ACTION2', 'ACTION3'];
const entity = (signature, x) => ({ signature, position: [x, 1], identity_ambiguous: false });
const obs = (revision, hash, p = 1, r = 2) => ({
  revision,
  frame_hash: hash,
  state: 'PLAY',
  level_epoch: 1,
  levels_completed: 0,
  entities: [entity('patient', p), entity('marker', r)],
  available_action_refs: publicActions,
});
test('an unsuccessful placement can start a controlled experiment and transfer a selectively acquired ability', () => {
  const m = initialMemory(1),
    available = new Set(publicActions),
    goal = { actor: 'patient', from: [1, 1], foothold: [8, 1], home: [[10, 7]], width: 10, stride: [1, 1] };
  m.edges.push({ stable: true, cmd: 'ACTION3', anchors: { patient: { at: '1,1' } }, effect: { moves: [] } });
  const t = {
    goal,
    plan: { site: sig, ideal: [5, 1], program: [{ op: 'ACTION2', stage: 'displace' }] },
    choices: [],
    cursor: 0,
  };
  const root = obs(1, 'root'),
    prepared = obs(2, 'prepared');
  openCapacityQuestion(m, t, root, prepared);
  let word = offerCapacityWord(m, prepared, available);
  assert.equal(word.capacity.arm, 'prepared');
  assert.deepEqual(word.capacity.word, ['ACTION1']);
  recordCapacityWord(m, word, prepared, obs(3, 'moved', 1, 3), false, false);
  const bare = obs(4, 'root');
  word = offerCapacityWord(m, bare, available);
  assert.equal(word.capacity.arm, 'bare');
  recordCapacityWord(m, word, bare, obs(5, 'still'), false, false);
  const repeat = obs(6, 'root');
  word = offerCapacityWord(m, repeat, available);
  assert.equal(word.capacity.arm, 'durationControl');
  assert.deepEqual(
    word.plan.program.map((v) => v.op),
    ['ACTION3', 'ACTION1']
  );
  const clock = obs(7, 'clock');
  word = recordCapacityWord(m, word, repeat, clock, false, false);
  assert.equal(word.cursor, 1);
  recordCapacityWord(m, word, clock, obs(8, 'still'), false, false);
  const laws = Object.values(m.territory.words.problems)[0].laws;
  assert.equal(laws.length, 1);
  const reuse = offerCapacityWord(m, obs(9, 'elsewhere', 2, 3), available);
  assert.equal(reuse.capacity.arm, 'reuse');
  assert.deepEqual(reuse.plan.ideal, [4, 1]);
  assert.deepEqual(
    reuse.plan.program.map((v) => v.op),
    ['ACTION2', 'ACTION1']
  );
});
