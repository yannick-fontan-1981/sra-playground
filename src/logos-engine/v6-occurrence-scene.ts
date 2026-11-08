/** Native transfer of occurrence_scene.py at the pinned V6 source revision.
 * All foreground/enclosure extents are observed hypotheses. Palette meanings,
 * fixed HUD crops, game identifiers and private object identities are absent.
 */
import { geometricComponents } from './v6-native-observer.ts';
import type { GeometricComponent } from './v6-native-observer.ts';
import type { NativeRows, NativePoint } from './v6-native-types.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual } from './v6-operations.ts';

export type OccurrenceRecord = Record<string, any>;
const pointKey = (x: number, y: number): string => `${x},${y}`;
const comparePoint = (a: readonly number[], b: readonly number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};
const count = <T>(values: Iterable<T>): Map<T, number> => {
  const result = new Map<T, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};

export function measureOccurrenceScene(rows: NativeRows, observation: OccurrenceRecord,
  previousCalibration: OccurrenceRecord | null = null): OccurrenceRecord | null {
  const height = rows.length, width = rows[0]!.length, parts = geometricComponents(rows);
  const background = [...count(rows.flat())].sort((a, b) => b[1] - a[1])[0]![0];
  let outlines: GeometricComponent[] = [];
  for (const part of parts) {
    const [x, y, right, bottom] = part.bbox, w = right - x + 1, h = bottom - y + 1;
    if (part.color === background || Math.min(w, h) < 3) continue;
    const mask = new Set(part.mask.map(([a, b]) => pointKey(a, b))), exterior = new Set([pointKey(-1, -1)]);
    const queue: NativePoint[] = [[-1, -1]];
    while (queue.length) {
      const [a, b] = queue.pop()!;
      for (const [u, v] of [[a - 1, b], [a + 1, b], [a, b - 1], [a, b + 1]] as NativePoint[]) {
        const key = pointKey(u, v);
        if (-1 <= u && u <= w && -1 <= v && v <= h && !mask.has(key) && !exterior.has(key)) {
          exterior.add(key); queue.push([u, v]);
        }
      }
    }
    const inside = new Set<number>();
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
      const key = pointKey(u, v); if (!mask.has(key) && !exterior.has(key)) inside.add(rows[y + v]![x + u]!);
    }
    if (inside.has(background) && [...inside].some(color => color !== background && color !== part.color)) outlines.push(part);
  }
  let calibration = previousCalibration;
  if (calibration !== null && Object.hasOwn(calibration, 'outline_extent')) {
    outlines = outlines.filter(part => pythonEqual([part.bbox[2] - part.bbox[0] + 1, part.bbox[3] - part.bbox[1] + 1], calibration!.outline_extent));
  } else {
    outlines = outlines.filter(part => !outlines.some(other => other !== part && other.bbox[0] < part.bbox[0]
      && other.bbox[1] < part.bbox[1] && other.bbox[2] > part.bbox[2] && other.bbox[3] > part.bbox[3]));
  }
  if (calibration === null) {
    if (outlines.length !== 1) return null;
    const outline = outlines[0]!, [x, y, right, bottom] = outline.bbox;
    const inner = parts.filter(part => part.color !== background && part.color !== outline.color
      && x < part.bbox[0] && part.bbox[2] < right && y < part.bbox[1] && part.bbox[3] < bottom);
    if (!inner.length || new Set(inner.map(part => part.color)).size !== 1) return null;
    const left = Math.min(...inner.map(part => part.bbox[0])), top = Math.min(...inner.map(part => part.bbox[1]));
    const r = Math.max(...inner.map(part => part.bbox[2])), b = Math.max(...inner.map(part => part.bbox[3]));
    calibration = { max_width: r - left + 1, max_height: b - top + 1, outline_extent: [right - x + 1, bottom - y + 1],
      evidence: [observation.observation_ref], status: 'foreground_and_enclosure_extents_hypotheses_from_one_occurrence' };
  }
  const groups = new Map<string, GeometricComponent[]>();
  for (const part of parts) if (part.rectangular) {
    const [x, y, right, bottom] = part.bbox, key = JSON.stringify([y, bottom, right - x + 1]);
    if (!groups.has(key)) groups.set(key, []); groups.get(key)!.push(part);
  }
  const indicators: OccurrenceRecord[] = [], excluded = new Set<string>();
  if (!Object.hasOwn(calibration, 'indicator_boxes')) {
    for (const group of groups.values()) {
      group.sort((a, b) => a.bbox[0] - b.bbox[0]);
      if (group.length >= 3 && group.at(-1)!.bbox[2] - group[0]!.bbox[0] + 1 >= width / 2) {
        for (const part of group) { excluded.add(part.id); indicators.push({ bbox: part.bbox, value: part.color }); }
      }
    }
    calibration = { ...calibration, indicator_boxes: indicators.map(part => part.bbox) };
  } else {
    for (const box of calibration.indicator_boxes as readonly number[][]) {
      const matching = parts.filter(part => part.rectangular && pythonEqual(part.bbox, box));
      if (matching.length !== 1) return null;
      excluded.add(matching[0]!.id); indicators.push({ bbox: box, value: matching[0]!.color });
    }
  }
  for (const part of outlines) excluded.add(part.id);
  const pending = parts.filter(part => !excluded.has(part.id) && part.color !== background
    && part.bbox[2] - part.bbox[0] + 1 <= calibration!.max_width && part.bbox[3] - part.bbox[1] + 1 <= calibration!.max_height);
  const occurrences: OccurrenceRecord[] = [], ambiguous: OccurrenceRecord[] = [];
  while (pending.length) {
    const cluster = [pending.shift()!]; let changed = true;
    while (changed) {
      changed = false;
      for (const part of [...pending]) {
        if (part.color !== cluster[0]!.color) continue;
        const boxes = [...cluster, part].map(item => item.bbox);
        const x = Math.min(...boxes.map(box => box[0])), y = Math.min(...boxes.map(box => box[1]));
        const right = Math.max(...boxes.map(box => box[2])), bottom = Math.max(...boxes.map(box => box[3]));
        if (right - x + 1 <= calibration.max_width && bottom - y + 1 <= calibration.max_height) {
          cluster.push(part); pending.splice(pending.indexOf(part), 1); changed = true;
        }
      }
    }
    const pixelMap = new Map<string, NativePoint>();
    for (const part of cluster) for (const [x, y] of part.mask) {
      const point: NativePoint = [part.bbox[0] + x, part.bbox[1] + y]; pixelMap.set(pointKey(...point), point);
    }
    const pixels = [...pixelMap.values()], left = Math.min(...pixels.map(p => p[0])), top = Math.min(...pixels.map(p => p[1]));
    const right = Math.max(...pixels.map(p => p[0])), bottom = Math.max(...pixels.map(p => p[1]));
    if (right - left + 1 !== calibration.max_width || bottom - top + 1 !== calibration.max_height) {
      ambiguous.push({ bbox: [left, top, right, bottom], reason: 'outside_current_foreground_extent_hypothesis' }); continue;
    }
    const enclosing = outlines.filter(part => part.bbox[0] < left && part.bbox[1] < top && part.bbox[2] > right && part.bbox[3] > bottom);
    const mask = pixels.map(([x, y]) => [x - left, y - top]).sort(comparePoint), shape = identity([right - left + 1, bottom - top + 1, mask]);
    const distance = ([x, y]: NativePoint): number => (2 * x - left - right) ** 2 + (2 * y - top - bottom) ** 2;
    const point = [...pixels].sort((a, b) => distance(a) - distance(b) || comparePoint(a, b))[0]!;
    const value: OccurrenceRecord = { bbox: [left, top, right, bottom], mask, shape, color: cluster[0]!.color, point: [...point], marked: enclosing.length > 0 };
    value.id = `occurrence:${identity([observation.observation_ref, value]).slice(0, 24)}`; occurrences.push(value);
  }
  occurrences.sort((a, b) => comparePoint(a.bbox, b.bbox)); indicators.sort((a, b) => comparePoint(a.bbox, b.bbox));
  const scene: OccurrenceRecord = { occurrences, indicators, background, calibration, unknowns: ambiguous,
    source_ref: observation.observation_ref, epoch: observation.level_epoch };
  scene.key = identity([scene.epoch, occurrences.map(part => [part.shape, part.color, part.bbox]), indicators]); return scene;
}

export function occurrenceCandidates(scene: OccurrenceRecord, context: OccurrenceRecord | null,
  seen: readonly OccurrenceRecord[], relation: string, comparison: string): string[] {
  if (context === null) return [];
  const previous = context.previous.occurrences as OccurrenceRecord[], chosen = context.chosen;
  const references = relation === 'previous_all' ? previous : relation === 'previous_chosen' ? previous.filter(part => part.id === chosen)
    : relation === 'previous_unchosen' ? previous.filter(part => part.id !== chosen) : seen;
  return (scene.occurrences as OccurrenceRecord[]).filter(part => references.some(peer => part.shape === peer.shape
    && (comparison === 'exact_mask' || part.color === peer.color))).map(part => part.id);
}

export function occurrenceContextScope(context: OccurrenceRecord): 'singleton_antecedent' | 'plural_antecedent' {
  return context.previous.occurrences.length === 1 ? 'singleton_antecedent' : 'plural_antecedent';
}
