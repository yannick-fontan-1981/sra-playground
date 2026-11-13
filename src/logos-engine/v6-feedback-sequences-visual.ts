/** V6 feedback_sequences/visual.py: measured uniform rows and public response marks. */
import { canonical } from './canonical.ts';
import { v6Digest } from './v6-native-observer.ts';
import type { NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

export interface FeedbackSlotRow { y: number; count: number; empty: number }
export interface FeedbackLayout {
  epoch: number; ref: string; size: [number, number]; pitch: number; xs: number[];
  palette_y: number; alphabet: number[]; slot_rows: FeedbackSlotRow[]; count: number;
}
export interface FeedbackCellGroup { y: number; w: number; h: number; cells: [number, number][] }
export interface FeedbackHistoryRow extends NativeRecord {
  y?: number; values: number[]; marks: string[]; ref: string; before?: string;
}
const equal = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const groupKey = (y: number, w: number, h: number): string => `${y},${w},${h}`;

/** Map iteration retains the source entity/group order; cells use Python tuple ordering. */
export function feedbackGroups(obs: NativeObservation): Map<string, FeedbackCellGroup> {
  const groups = new Map<string, FeedbackCellGroup>();
  for (const entity of obs.entities) {
    const [x, y, r, b] = entity.bbox, w = r - x + 1, h = b - y + 1;
    if (w !== h || w < 2 || entity.area !== w * h) continue;
    const key = groupKey(y, w, h), group = groups.get(key) ?? { y, w, h, cells: [] };
    group.cells.push([x, entity.palette_value]); groups.set(key, group);
  }
  for (const group of groups.values()) group.cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return groups;
}

export function initialFeedbackLayout(obs: NativeObservation): FeedbackLayout | null {
  const groups = feedbackGroups(obs), fits: FeedbackLayout[] = [];
  for (const { y, w, h, cells } of groups.values()) {
    const xs = cells.map(([x]) => x), values = cells.map(([, value]) => value);
    if (xs.length < 3 || new Set(values).size !== values.length) continue;
    const pitch = xs[1]! - xs[0]!;
    if (pitch < w || xs.slice(1).some((x, i) => x - xs[i]! !== pitch)) continue;
    const slots: FeedbackSlotRow[] = [];
    for (const other of groups.values()) {
      if (other.y === y || other.w !== w || other.h !== h || other.cells.length < 3) continue;
      if (!equal(other.cells.map(([x]) => x), xs.slice(0, other.cells.length))
        || new Set(other.cells.map(([, value]) => value)).size !== 1) continue;
      slots.push({ y: other.y, count: other.cells.length, empty: other.cells[0]![1] });
    }
    if (slots.length === 2 && slots[0]!.count === slots[1]!.count) {
      fits.push({ epoch: obs.level_epoch, ref: obs.observation_ref, size: [w, h], pitch, xs,
        palette_y: y, alphabet: values, slot_rows: slots, count: slots[0]!.count });
    }
  }
  return fits.length === 1 ? fits[0]! : null;
}

/** Native safety adaptation: a missing current pixel is an unmeasured row, never a value. */
export function feedbackValues(rows: NativeRows, layout: Pick<FeedbackLayout, 'size' | 'xs'>, y: number, count?: number): number[] | null {
  const [w, h] = layout.size, out: number[] = [];
  for (const x of layout.xs.slice(0, count || layout.xs.length)) {
    const sample = rows[y]?.[x];
    if (sample === undefined || x < 0 || y < 0) return null;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (rows[j]?.[i] !== sample) return null;
    out.push(sample);
  }
  return out;
}

export function feedbackPalette(obs: NativeObservation, layout: FeedbackLayout): [number, number][] | null {
  const parts = feedbackGroups(obs).get(groupKey(layout.palette_y, ...layout.size))?.cells ?? [];
  if (parts.some(([, value]) => !layout.alphabet.includes(value)) || new Set(parts.map(([, value]) => value)).size !== parts.length) return null;
  return equal(parts.map(([x]) => x), layout.xs.slice(0, parts.length)) ? parts : null;
}

export function feedbackBorder(rows: NativeRows, x: number, y: number, w: number, _h: number): number[] | null {
  if (y < 1 || rows[y - 1] === undefined) return null;
  return rows[y - 1]!.slice(x, x + w);
}
export async function feedbackMark(rows: NativeRows, x: number, y: number, w: number, h: number): Promise<string | null> {
  const style = feedbackBorder(rows, x, y, w, h);
  return style?.length && new Set(style).size === 1 ? `style:${(await v6Digest(style)).slice(0, 16)}` : null;
}
export async function feedbackSnapshotSignature(rows: NativeRows, layout: FeedbackLayout): Promise<string> {
  const [w, h] = layout.size, regions: number[][] = [];
  for (const y of [layout.palette_y, ...layout.slot_rows.map(row => row.y)]) {
    for (let j = Math.max(0, y - 1); j < y + h + 1; j++) {
      if (rows[j] === undefined) throw new TypeError('Feedback snapshot region is outside the observed raster');
      regions.push(rows[j]!.slice(Math.max(0, layout.xs[0]! - 1), layout.xs.at(-1)! + w + 1));
    }
  }
  return v6Digest(regions);
}
export async function feedbackMatches(rows: NativeRows, obs: NativeObservation, layout: FeedbackLayout,
  trial: readonly number[]): Promise<{ y: number; values: number[]; marks: string[] }[]> {
  const matches: { y: number; values: number[]; marks: string[] }[] = [], [w, h] = layout.size;
  const excluded = new Set([layout.palette_y, ...layout.slot_rows.map(row => row.y)]);
  for (const group of feedbackGroups(obs).values()) {
    if (excluded.has(group.y) || group.w !== w || group.h !== h) continue;
    const byX = new Map(group.cells);
    if (layout.xs.slice(0, trial.length).some((x, i) => byX.get(x) !== trial[i])) continue;
    const marks = await Promise.all(layout.xs.slice(0, trial.length).map(x => feedbackMark(rows, x, group.y, w, h)));
    if (marks.every((mark): mark is string => mark !== null)) matches.push({ y: group.y, values: [...trial], marks });
  }
  return matches;
}
