import assert from 'node:assert/strict';
import test from 'node:test';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import type { CatalogueSlot, SlottedCatalogue } from '../src/sic/catalogue-slots.ts';
import { recordJointCatalogue, type JointCatalogue, type JointCatalogueAction } from '../src/sic/joint-catalogue-views.ts';

const card = (mask: NativePoint[], extent: NativePoint): CatalogueSlot => ({ bbox: [2, 6, 4, 8], point: [3, 7], mask, extent });
const narrow = card([[0, 0], [0, 1]], [1, 2]);
const wide = card([[0, 0], [0, 1], [1, 1]], [2, 2]);
const square = card([[0, 0], [1, 0], [0, 1], [1, 1]], [2, 2]);
const scene: SlottedCatalogue = {
  field: [0, 0, 7, 5], background: 5, palette: 9, selectedCard: null, cards: [square],
  controls: [{ palette: 8, bbox: [0, 0, 1, 1], point: [0, 0] }, { palette: 9, bbox: [4, 0, 5, 1], point: [4, 0] }],
};

function view(frontX: number): number[][] {
  const rows = Array.from({ length: 9 }, () => Array<number>(8).fill(5));
  rows[2]![2] = rows[3]![2] = 8;
  rows[2]![frontX] = rows[2]![frontX + 1] = rows[3]![frontX] = rows[3]![frontX + 1] = 9;
  return rows;
}

test('a foreground translation can reject one model of a stationary background shape', () => {
  const local: JointCatalogue = { epoch: 1, lastRef: 'first', step: null, tried: [], evidence: [], submitted: [], stopped: false,
    subjects: [
      { palette: 8, origin: [2, 2], scale: 1, cards: [narrow, wide], options: [{ card: 0, above: 0 }, { card: 1, above: 2 }] },
      { palette: 9, origin: [3, 2], scale: 1, cards: [square], options: [{ card: 0, above: 0 }] },
    ] };
  const action: JointCatalogueAction = { kind: 'move', action: { action_ref: 'ACTION4', data: {} }, palette: 9, box: [3, 2, 4, 3] };
  const result = recordJointCatalogue(local, scene, scene, view(3), view(4), action, 'second', 'right');
  assert.equal(result.matched, true);
  assert.equal(result.local.step, 1);
  assert.deepEqual(result.local.subjects[0]?.origin, [2, 2]);
  assert.deepEqual(result.local.subjects[0]?.options, [{ card: 0, above: 0 }]);
});
