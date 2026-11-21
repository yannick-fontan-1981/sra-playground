import assert from 'node:assert/strict';
import test from 'node:test';
import { measureAnimatedCells, returningTranslation } from '../src/sic/observed-animation.ts';
import { createSicAnimationContact, learnAnimationContactId } from '../src/sic/animation-contact.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

const points = [[0, 0], [1, 0], [2, 0]] as const;
const still = [[0, 0, 0]];
const first = [[7, 0, 0]];
const both = [[7, 7, 0]];

test('SIC measures a translated silhouette that returns while its centre stays occupied', () => {
  const start = [[0, 3, 3, 3, 0, 0]];
  const moving = [[0, 0, 3, 3, 3, 0]];
  const body = [[1, 0], [2, 0], [3, 0]] as const;
  assert.deepEqual(measureAnimatedCells(start, start, [moving, start], [body[1]]), []);
  assert.deepEqual(returningTranslation(start, start, [moving, start], body), [1, 0]);
  assert.equal(returningTranslation(start, moving, [moving, moving], body), null);
  assert.equal(returningTranslation(start, start, [[[0, 0, 3, 0, 0, 0]], start], body), null);
});

test('SIC requires a unique displacement of the specified component among equal copies', () => {
  const start = [[0, 2, 0, 0, 2, 0, 0]];
  const body = [[1, 0]] as const;
  assert.deepEqual(returningTranslation(start, start, [[[0, 0, 2, 0, 2, 0, 0]], start], body), [1, 0]);
  assert.equal(returningTranslation(start, start, [[[0, 2, 0, 0, 2, 0, 2]], start], body), null);
  assert.equal(returningTranslation(start, start, [[[0, 0, 2, 0, 0, 0, 2]], start], body), null);
});

test('SIC measures cells activated only during a returned animation', () => {
  assert.deepEqual(measureAnimatedCells(still, still, [first, both, first, still], points), [0, 1]);
  assert.deepEqual(measureAnimatedCells(still, both, [first, both], points), []);
  assert.deepEqual(measureAnimatedCells(still, still, [both, [[0, 0, 7]], still], points), []);
});

test('SIC proposes an untried animated contact only from the current return', async () => {
  const rows = Array.from({ length: 12 }, () => Array<number>(12).fill(0));
  rows[6]![6] = 1;
  const observation = await measureNativeObservation({
    frame_rows: rows, frame_hash: 'board', level: 1, levels_completed: 0,
    available_action_refs: ['ACTION6'], state: 'NOT_FINISHED',
  }, 2);
  const family = createSicAnimationContact(learnAnimationContactId);
  const receipt = { point: [6, 6], contact: [5, 6], disclosure: null, source: null, peer: null, frames: 5,
    family: 'exploration', beforeRef: 'previous-observation', afterRef: observation.observation_ref, levelEpoch: observation.level_epoch } as const;
  const execution = { yieldControl: async () => {}, readAnimatedContact: () => receipt };
  const proposal = await family.propose(observation, rows, [], 3, execution);
  assert.equal(proposal?.sicSituationCard.strategy, 'test_transient_contact');
  assert.deepEqual(proposal?.actions[0]?.data, { x: 5, y: 6 });
  assert.equal(await family.propose({ ...observation, observation_ref: 'later' }, rows, [], 3, execution), null);
  const retry = { ...execution, readAnimatedContact: () => ({ ...receipt, contact: receipt.point }) };
  assert.equal(await family.propose(observation, rows, [], 3, retry), null);
});
