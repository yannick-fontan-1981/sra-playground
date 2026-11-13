import type { NativeBox, NativeRows } from './v6-native-types.ts';

export function cropReturn(rows: NativeRows, [left, top, right, bottom]: NativeBox, stride: number): NativeRows {
  const pixels: number[][] = [];
  for (let y = top; y <= bottom; y += stride) {
    const row: number[] = [];
    for (let x = left; x <= right; x += stride) row.push(rows[y]![x]!);
    pixels.push(row);
  }
  return pixels;
}

export function previewStride([left, top, right, bottom]: NativeBox, maxSide = 20): number {
  return Math.max(1, Math.ceil(Math.max(right - left + 1, bottom - top + 1) / maxSide));
}

export interface ChangedReturnRegion {
  readonly box: NativeBox;
  readonly pixels: number;
  readonly before: NativeRows;
  readonly after: NativeRows;
  readonly stride: number;
}

export function changedReturnRegions(before: NativeRows, after: NativeRows, excluded: NativeBox,
  window?: NativeBox) {
  const width = before[0]!.length, height = before.length;
  const changed = new Set<number>();
  const [left, top, right, bottom] = excluded;
  const [startX, startY, endX, endY] = window ?? [0, 0, width - 1, height - 1];
  for (let y = startY; y <= endY; y++) for (let x = startX; x <= endX; x++) {
    if (x >= left && x <= right && y >= top && y <= bottom) continue;
    if (before[y]![x] !== after[y]![x]) changed.add(y * width + x);
  }
  const regions: { box: NativeBox; pixels: number }[] = [];
  const totalPixels = changed.size;
  while (changed.size) {
    const start = changed.values().next().value!;
    const pending = [start];
    changed.delete(start);
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < pending.length; i++) {
      const index = pending[i]!, x = index % width, y = Math.floor(index / width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && changed.delete(ny * width + nx)) pending.push(ny * width + nx);
      }
    }
    regions.push({ box: [minX, minY, maxX, maxY], pixels: pending.length });
  }
  const samples: ChangedReturnRegion[] = regions.sort((a, b) => b.pixels - a.pixels).slice(0, 3).map(({ box, pixels }) => {
    const stride = previewStride(box);
    return { box, pixels, stride, before: cropReturn(before, box, stride), after: cropReturn(after, box, stride) };
  });
  return { totalPixels, regionCount: regions.length, samples };
}
