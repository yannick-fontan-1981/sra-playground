import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { createSicLinkOpenings } from '../src/sic/link-openings.ts';

const scene = {
  actorColor: 1, actorMask: '0,0;0,1;1,0;1,1;2,1', goal: [55, 47, 58, 54], footGap: 2,
  endpoints: [{ box: [8, 55, 15, 55], point: [11, 55], button: [4, 2, 11, 4], color: 9 },
    { box: [51, 35, 51, 42], point: [51, 38], button: [17, 2, 24, 4], color: 12 }],
  plateLink: { button: [52, 1, 60, 5], idle: 3, pixels: [[1, 1, 1], [1, 10, 1], [1, 1, 1]],
    departure: [4, 11, 26, 54], receiving: [30, 11, 50, 54], firingPlate: [20, 54, 24, 54], exitPlate: [40, 54, 45, 54],
    shutter: [27, 50, 29, 53], closed: Array.from({ length: 4 }, () => [2, 2, 2]),
    exitGate: [51, 50, 52, 53], floor: 55, passage: 4 },
};

const refs = ['ACTION2', 'ACTION3', 'ACTION4', 'ACTION6'];
function frame(x: number, shutterClosed: boolean, keepLink = true) {
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(4));
  rows[52]![x] = 1;
  rows[52]![x + 1] = 1;
  rows[53]![x] = 1;
  rows[53]![x + 1] = 10;
  rows[53]![x + 2] = 1;
  rows[1]![52] = 10;
  rows[55]!.fill(9, 8, 16);
  for (let y = 35; y <= 42; y++) rows[y]![51] = keepLink ? 12 : 0;
  for (let y = 50; y <= 53; y++) rows[y]!.fill(shutterClosed ? 2 : 11, 27, 30);
  return rows;
}

test('the carried cube keeps its sprite binding while the portal pair survives shutter closure', async () => {
  const family = createSicLinkOpenings();
  family.restore({ retained: null, state: { epoch: 2, scene, held: true, selected: 1,
    refs: [], walkRef: 'prior-walk', crossed: false, rejected: [] } });
  const first = frame(21, false);
  const observation = (rows: number[][], revision: number) => measureNativeObservation({
    frame_rows: rows, frame_hash: 'frame-' + revision, level: 2, levels_completed: 1, available_action_refs: refs, state: 'NOT_FINISHED',
  }, revision);
  const before = await observation(first, 1), proposal = await family.propose(before, first, [], 10);
  assert.ok(proposal);
  assert.equal(proposal.actions[0]?.action_ref, 'ACTION3');
  assert.deepEqual(proposal.actor, [21, 52, 23, 53]);

  const visible = frame(17, true);
  const matched = await family.after(proposal, 0, before, await observation(visible, 2), first, visible);
  assert.equal(matched.matched, true);
  assert.equal(matched.reason, 'portal_pair_survives_shutter_closure');

  const missing = frame(17, true, false);
  const contradicted = await family.after(proposal, 0, before, await observation(missing, 2), first, missing);
  assert.equal(contradicted.matched, false);
});
