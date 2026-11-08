/**
 * Pinned labeled_sequence_observation.py: paired geometric example panels,
 * scale-normalized ordered tokens and currently revalidated label controls.
 * Their labels and semantic roles remain geometric hypotheses.
 */
import { geometricComponents } from './v6-native-observer.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;

export function labeledSequenceInside(inner: readonly number[], outer: readonly number[]): boolean {
  return outer[0]! < inner[0]! && inner[0]! <= inner[2]! && inner[2]! < outer[2]!
    && outer[1]! < inner[1]! && inner[1]! <= inner[3]! && inner[3]! < outer[3]!;
}

/** Largest uniform square occurrences, ordered by row and then by column. */
export function labeledSequences(frame: readonly number[], solids: readonly R[]): R | null {
  const groups = new Map<number, R[]>();
  for (const component of solids) {
    const [left, top, right, bottom] = component.bbox, width = right - left + 1, height = bottom - top + 1;
    if (width !== height || width <= 1 || !labeledSequenceInside(component.bbox, frame)) continue;
    if (!groups.has(width)) groups.set(width, []);
    groups.get(width)!.push(component);
  }
  if (!groups.size) return null;
  const scale = Math.max(...groups.keys()), byRow = new Map<number, R[]>();
  for (const component of groups.get(scale)!) {
    const top = component.bbox[1];
    if (!byRow.has(top)) byRow.set(top, []);
    byRow.get(top)!.push(component);
  }
  const words: R[] = [], pitches = new Set<number>();
  for (const [, members] of [...byRow].sort(([a], [b]) => a - b)) {
    const items = [...members].sort((a, b) => a.bbox[0] - b.bbox[0]);
    const differences = items.slice(1).map((item, index) => item.bbox[0] - items[index]!.bbox[0]);
    if (new Set(differences).size > 1 || differences.some(value => value <= scale)) return null;
    for (const difference of differences) pitches.add(difference);
    words.push({ values: items.map(component => component.color), boxes: items.map(component => component.bbox) });
  }
  if (pitches.size > 1) return null;
  return { scale, words, pitch: pitches.size ? pitches.values().next().value! : null };
}

/** Consumed revalidate_frame branch: no occlusion and equal corner/edge values. */
function currentUniformControl(rows: NativeRows, box: readonly number[], value: number): boolean {
  const [left, top, right, bottom] = box as [number, number, number, number];
  if (left < 0 || top < 0 || bottom >= rows.length || right >= rows[0]!.length) return false;
  let corners = 0, measured = 0;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x !== left && x !== right && y !== top && y !== bottom) continue;
    if (rows[y]![x] !== value) return false;
    measured++;
    if ((x === left || x === right) && (y === top || y === bottom)) corners++;
  }
  if (corners < 2 || measured < right - left + bottom - top) return false;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (rows[y]![x] !== value) return false;
  return true;
}

export function measureLabeledSequence(rows: NativeRows, priorControls: readonly R[] | null = null): R | null {
  const solids: R[] = [], frames: R[] = [];
  for (const component of geometricComponents(rows)) {
    const [left, top, right, bottom] = component.bbox, width = right - left + 1, height = bottom - top + 1;
    if (component.area === width * height) solids.push(component);
    if (width < 3 || height < 3) continue;
    const edge = new Set<number>();
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if (y === top || y === bottom || x === left || x === right) edge.add(rows[y]![x]!);
    }
    if (edge.size === 1) frames.push({ bbox: component.bbox, label: edge.values().next().value! });
  }
  const candidates: R[] = [];
  for (const frame of frames) {
    const value = labeledSequences(frame.bbox, solids);
    if (value && value.words.length >= 2) candidates.push({ ...frame, ...value });
  }
  const pairs: R[][] = [];
  for (const [index, a] of candidates.entries()) for (const b of candidates.slice(index + 1)) {
    const ab = a.bbox, bb = b.bbox;
    const same = ab[2] - ab[0] === bb[2] - bb[0] && ab[3] - ab[1] === bb[3] - bb[1];
    const apart = ab[2] < bb[0] || bb[2] < ab[0];
    if (same && apart && a.label !== b.label && a.scale === b.scale) pairs.push([a, b].sort((x, y) => x.bbox[0] - y.bbox[0]));
  }
  if (pairs.length !== 1) return null;
  const panels = pairs[0]!, palette = new Set<number>();
  for (const panel of panels) for (const word of panel.words as R[]) for (const value of word.values as number[]) palette.add(value);
  if (panels.some(panel => palette.has(panel.label))) return null;
  let queries: R[] = [];
  for (const frame of frames) {
    if (panels.some(panel => equal(frame.bbox, panel.bbox) || labeledSequenceInside(frame.bbox, panel.bbox))) continue;
    const value = labeledSequences(frame.bbox, solids);
    if (value && value.words.length === 1 && (value.words[0].values as number[]).every(item => palette.has(item))) queries.push({ ...frame, ...value });
  }
  queries = queries.filter(query => !queries.some(other => other !== query && labeledSequenceInside(other.bbox, query.bbox) && equal(other.words, query.words)));
  if (queries.length !== 1) return null;
  const buttons: R[] = [];
  for (const panel of panels) {
    let found = solids.filter(component => component.color === panel.label && !panels.some(candidate => labeledSequenceInside(component.bbox, candidate.bbox)));
    if (found.length !== 1 && priorControls?.length) {
      found = [];
      for (const prior of priorControls.filter(control => control.label === panel.label)) {
        if (currentUniformControl(rows, prior.bbox, prior.label)) found.push({ bbox: prior.bbox, color: prior.label });
      }
    }
    if (found.length !== 1) return null;
    const [left, top, right, bottom] = found[0]!.bbox;
    buttons.push({ label: panel.label, bbox: [left, top, right, bottom], point: [Math.floor((left + right) / 2), Math.floor((top + bottom) / 2)] });
  }
  const scene: R = { panels, query: queries[0]!, buttons, palette: [...palette].sort((a, b) => a - b) };
  scene.context_ref = identity([panels, buttons]);
  return scene;
}
