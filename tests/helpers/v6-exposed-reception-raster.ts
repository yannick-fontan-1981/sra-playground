/** Synthetic measured grammar only. No game host, source, solution or trajectory. */
export type ReceptionRasterOptions = {
  pitch?: 4 | 5;
  actor?: [number, number];
  bodies?: { pos: [number, number]; color: number; overlap?: boolean }[];
  slots?: { pos: [number, number]; color: number }[];
  activeDial?: number;
};
export function receptionRaster(options: ReceptionRasterOptions = {}): number[][] {
  const pitch = options.pitch ?? 4, side = pitch - 2, width = 8, height = 6, left = 8, top = 8;
  const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
  const wall = 1, actorColor = 4;
  const tile = (pos: readonly number[]): [number, number] => [left + pos[0]! * pitch, top + pos[1]! * pitch];
  // A repeated wall tile has a horizontal first row. Adjacent tiles make the
  // source grammar's long upper/lower bars; separated side tiles make strips.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (y !== 0 && y !== height - 1 && x !== 0 && x !== width - 1) continue;
    const [px, py] = tile([x, y]);
    for (let dx = 0; dx < pitch; dx++) rows[py]![px + dx] = wall;
  }
  for (const slot of options.slots ?? [{ pos: [5, 2], color: 7 }]) {
    const [px, py] = tile(slot.pos);
    for (const dy of [0, pitch - 1]) for (const dx of [0, pitch - 1]) rows[py + dy]![px + dx] = slot.color;
  }
  for (const body of options.bodies ?? [{ pos: [2, 2], color: 7 }]) {
    const [px, py] = tile(body.pos);
    for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) rows[py + 1 + dy]![px + 1 + dx] = body.color;
    if (side === 3 || body.overlap) rows[py + 1 + Math.floor(side / 2)]![px + 1 + Math.floor(side / 2)] = 0;
  }
  const [ax, ay] = tile(options.actor ?? [1, 2]);
  if (side === 2) {
    rows[ay + 1]![ax + 1] = actorColor; rows[ay + 1]![ax + 2] = actorColor;
    rows[ay + 2]![ax + 1] = 2; rows[ay + 2]![ax + 2] = 3;
  } else {
    for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) rows[ay + 1 + dy]![ax + 1 + dx] = actorColor;
    rows[ay + 1]![ax + 3] = 0; rows[ay + 2]![ax + 2] = 0;
  }
  const centers = [[50, 48], [54, 48], [58, 48], [50, 52], [58, 52], [50, 56], [54, 56], [58, 56]];
  for (const [i, [cx, cy]] of centers.entries()) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dx || dy) rows[cy! + dy]![cx! + dx] = i === (options.activeDial ?? 0) ? 9 : 8;
  }
  return rows;
}
