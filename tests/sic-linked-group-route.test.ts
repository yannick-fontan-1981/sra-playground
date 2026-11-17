import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import type { NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { createSicLinkedGroupRoute } from '../src/sic/linked-group-route.ts';

test('a partial pickup updates the linked body only when its previous colors remain', async () => {
  const mask = Array.from({ length: 25 }, (_, i): NativePoint => [i % 5, Math.floor(i / 5)])
    .filter(([x, y]) => !((x === 0 || x === 4) && (y === 0 || y === 4)));
  const outline = mask.filter(([x, y]) => x === 0 || x === 4 || y === 0 || y === 4);
  const anchors = [[9, 6], [17, 6]] as const, point = [9, 20] as const, pickupCenter = [9, 13] as const;
  const render = (phase: 'before' | 'preserved' | 'overwritten') => {
    const rows = Array.from({ length: 32 }, () => Array<number>(32).fill(5));
    const paint = ([x, y]: NativePoint, shape: readonly NativePoint[], left: number, right = left) => {
      for (const [dx, dy] of shape) rows[y + dy - 2]![x + dx - 2] = dx < 2 ? left : right;
    };
    paint(anchors[0], outline, 3);
    paint(phase === 'before' ? anchors[1] : point, outline, 9);
    if (phase === 'before') {
      paint([13, 6], mask, 0, 6);
      paint(pickupCenter, mask, 2, 0);
    } else paint(pickupCenter, mask, 2, phase === 'preserved' ? 6 : 0);
    return rows;
  };
  const observe = (frame_rows: number[][], revision: number) => measureNativeObservation({ frame_rows,
    frame_hash: String(revision), level: 1, levels_completed: 0, available_action_refs: ['ACTION6'], state: 'NOT_FINISHED' }, revision);
  const first = render('before'), before = await observe(first, 1), family = createSicLinkedGroupRoute();
  const pickup = { point: pickupCenter, box: [7, 11, 11, 15] as const, quarters: [2, 0, 2, 0] };
  const group = { color: 0, goal: [25, 24] as const, target: [23, 22, 27, 26] as const, marks: [[22, 21]] as const,
    bodyMask: mask, bodyPattern: mask.map(([x, y]) => [x, y, x < 2 ? 0 : 6] as const),
    pickups: [pickup], anchors, confirmedAt: null, contactAt: null, contactColor: null };
  const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
  const proposal = { status: 'proposed', kind: family.id, actions: [action], index: 0, move: { index: 1, point },
    selecting: false, prediction: pickupCenter, needId: 'test',
    local: { epoch: before.level_epoch, scene: { side: 5, mask: outline, activeColor: 9, band: 0, selectorColors: [3, 9], barriers: [] },
      groups: [group], focus: 0, route: [], denied: [], stopped: false } } as const;
  for (const phase of ['overwritten', 'preserved'] as const) {
    const second = render(phase), after = await observe(second, 2);
    const outcome = await family.after!(proposal, 0, before, after, first, second, []);
    assert.equal(outcome.matched, phase === 'preserved');
  }
});
