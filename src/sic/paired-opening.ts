import { supportParts } from '../logos-engine/v6-support-measurements.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

/** A rectangular slot between equal visible sides. Its role is initially unknown. */
export function pairedOpenings(rows: NativeRows, parts = supportParts(rows)): NativeBox[] {
  const rectangles = parts.filter(({ bbox, area, touches_frame_boundary }) => !touches_frame_boundary
    && bbox.width >= 2 && bbox.height >= 2 && bbox.width * bbox.height === area);
  const sizes = new Set(rectangles.filter(({ bbox }) => bbox.width === bbox.height).map(({ bbox }) => bbox.width));
  const byOrigin = new Map(rectangles.map(part => [`${part.bbox.left},${part.bbox.top}`, part]));
  const candidates: NativeBox[] = [];
  for (const { bbox: { left, top, width, height }, value } of rectangles) {
    for (const horizontal of [true, false]) {
      const pitch = horizontal ? width : height;
      if (!sizes.has(pitch)) continue;
      const x = horizontal ? left + width : left, y = horizontal ? top : top + height;
      const peer = byOrigin.get(`${horizontal ? x + pitch : x},${horizontal ? y : y + pitch}`);
      if (!peer || peer.value !== value || peer.bbox.width !== width || peer.bbox.height !== height) continue;
      const fill = rows[y]?.[x];
      if (fill === value || fill === undefined || rectangles.every(part => part.bbox.width !== pitch || part.bbox.height !== pitch
        || (part.bbox.left === x && part.bbox.top === y))) continue;
      const visibleSlot = rows.slice(y, y + pitch).every(row => row.slice(x, x + pitch).every(pixel => pixel === fill));
      if (visibleSlot) candidates.push([x, y, x + pitch - 1, y + pitch - 1]);
    }
  }
  return candidates;
}
