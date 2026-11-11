import { measureNativeObservation, publicFrameHash } from '../../src/logos-engine/v6-native-observer.ts';
import type { NativePublicObservation } from '../../src/logos-engine/v6-native-types.ts';

/** Independent geometric contract, built from the pinned stem/receiver/marker
 * definitions. No retained game raster, trace, trained state or game host is
 * read. The two profiles and two receivers have the same three-rank format. */
export function syntheticWorkshopRows(held: boolean, invitation = false): number[][] {
  const rows = Array.from({ length: 40 }, () => Array(44).fill(0));
  for (const stem of [10, 27]) {
    for (let x = 5; x <= 11; x++) rows[stem]![x] = 4;
    for (const [index, height] of [1, 3, 2].entries()) {
      for (let dy = 1; dy <= height; dy++) rows[stem - dy]![5 + index * 3] = 4;
    }
  }
  for (const [top, left, side] of [[5, 3, 'tl'], [5, 12, 'tr'], [11, 3, 'bl'], [11, 12, 'br']] as const) {
    const y = side[0] === 't' ? 0 : 1, x = side[1] === 'l' ? 0 : 1;
    for (let d = 0; d < 2; d++) { rows[top + y]![left + d] = 2; rows[top + d]![left + x] = 2; }
  }
  if (held) rows[8]![6] = 2;
  for (const top of [4, 21]) {
    const bottom = top + 10, left = 30, right = 38, reference = top + 3;
    for (let x = left; x <= right; x++) { rows[top]![x] = 7; rows[bottom]![x] = 7; }
    for (let y = top; y <= bottom; y++) { rows[y]![left] = 7; rows[y]![right] = 7; }
    for (const [index, offset] of [1, 3, 2].entries()) {
      const x = 31 + index * 3, seam = reference + offset;
      for (let y = top + 1; y < bottom; y++) rows[y]![x] = y < seam ? 8 : y === seam ? 6 : 9;
    }
    for (const x of [29, 32, 35, 39]) rows[reference]![x] = 5;
  }
  if (invitation) for (let offset = -2; offset <= 2; offset++) { rows[17 + offset]![21] = 3; rows[17]![21 + offset] = 3; }
  return rows;
}

export async function syntheticWorkshopPublicState(held: boolean, revision: number, epoch = 1,
  available: string[] = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'], invitation = false) {
  const rows = syntheticWorkshopRows(held, invitation), publicPacket: NativePublicObservation = {
    frame_rows: rows, frame_packet: [rows], frame_hash: await publicFrameHash(rows), level: epoch,
    levels_completed: epoch - 1, state: 'NOT_FINISHED', step_index: revision - 1,
    available_action_refs: available,
  };
  const observation = await measureNativeObservation(publicPacket, revision, 'workshop:independent-contract');
  return { rows, publicPacket, observation };
}
