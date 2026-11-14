import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

const contains = ([left, top, right, bottom]: NativeBox, box: NativeBox) =>
  left <= box[0] && top <= box[1] && right >= box[2] && bottom >= box[3];

/** A two-piece square and a unique inlaid shape at another site on its apparent grid. */
export function measureInsetContact(rows: NativeRows, parts = geometricComponents(rows)) {
  const rectangles = parts.filter(part => part.rectangular && part.area >= 4);
  const startingSites = new Map<string, { body: NativeBox; target: NativeBox; surface: NativeBox }>();
  for (const a of rectangles) for (const b of rectangles) {
    const [left, top, right, bottom] = a.bbox, [x, y, r, d] = b.bbox;
    const verticallyAdjacent = left === x && right === r && y === bottom + 1;
    const horizontallyAdjacent = top === y && bottom === d && x === right + 1;
    if (!verticallyAdjacent && !horizontallyAdjacent) continue;
    const body: NativeBox = [left, top, Math.max(right, r), Math.max(bottom, d)];
    const pitch = body[2] - left + 1;
    if (pitch <= 2 || body[3] - top + 1 !== pitch) continue;
    const floor = rows[top]?.[left - 1];
    if (floor === undefined || floor === a.color || floor === b.color) continue;
    const surfaces = parts.filter(part => part.color === floor && part.bbox[0] < left && part.bbox[1] < top
      && contains(part.bbox, body) && part.area >= pitch * pitch * 5);
    if (surfaces.length !== 1) continue;
    const surface = surfaces[0]!.bbox;
    const targets = parts.filter(({ bbox: box, color, rectangular }) => {
      if (rectangular || color === floor || !contains(surface, box) || box[2] - box[0] + 1 !== pitch
        || box[3] - box[1] + 1 !== pitch || (box[0] - left) % pitch || (box[1] - top) % pitch) return false;
      const patch = rows.slice(box[1], box[3] + 1).flatMap(row => row.slice(box[0], box[2] + 1));
      return patch.every(pixel => pixel !== floor) && new Set(patch).size >= 2;
    });
    if (targets.length === 1) startingSites.set(body.join(','), { body, target: targets[0]!.bbox, surface });
  }
  return startingSites.size === 1 ? [...startingSites.values()][0]! : null;
}
