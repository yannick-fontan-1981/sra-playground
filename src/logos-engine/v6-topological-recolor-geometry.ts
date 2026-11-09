/** Consumed V5 pocket flood and pinned V6 topological_recolor/geometry.py.
 * Supports are measured in public rasters. Closed visible pockets never assert
 * complete topology for a shell clipped by the current field boundary.
 */
import { geometricComponents, validateRows } from './v6-native-observer.ts';
import { symbolicDigest } from './v6-hash.ts';
import { supportCompare } from './v6-support-measurements.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

export type RecolorRecord = Record<string, any>;
type R = RecolorRecord;
type Point = readonly [number, number];
const key = (p: readonly number[]): string => p.join(',');
const point = (s: string): [number, number] => s.split(',').map(Number) as [number, number];
export const digest = symbolicDigest;

/** The V6 caller uses a SimpleNamespace, not a DMechanicalRequest validator. */
export class RecolorWorkBudget {
  readonly request: { node_bound: number; time_bound_ms: number; domain_bound: number };
  readonly started: number;
  examined = 0;
  private readonly now: () => number;
  constructor(request = { node_bound: 50_000, time_bound_ms: 1_000, domain_bound: 20_000 }, now = () => performance.now()) {
    this.request = { ...request }; this.now = now; this.started = now();
  }
  visit(frontier: R = {}): void {
    if (this.examined >= this.request.node_bound) throw new RecolorComputationInterrupted('NODE_BOUND', frontier);
    if (this.now() - this.started >= this.request.time_bound_ms) throw new RecolorComputationInterrupted('TIME_BOUND', frontier);
    this.examined++;
  }
  finish(): void {
    if (this.now() - this.started >= this.request.time_bound_ms) throw new RecolorComputationInterrupted('TIME_BOUND', {});
  }
}
export class RecolorComputationInterrupted extends Error {
  readonly cause: string;
  readonly frontier: R;
  constructor(cause: string, frontier: R) {
    super(cause); this.name = 'DComputationInterrupted'; this.cause = cause; this.frontier = structuredClone(frontier);
  }
}
export class RecolorPrerequisite extends Error {
  constructor(message: string) { super(message); this.name = 'RecolorPrerequisite'; }
}

/** Exact V5 _components ordering: row/column seed, then bounded digital BFS. */
export function pocketComponents(points: readonly Point[], connectivity: 4 | 8, budget: RecolorWorkBudget): number[][][] {
  const remaining = new Set(points.map(key)), out: number[][][] = [];
  while (remaining.size) {
    const seed = [...remaining].map(point).sort(supportCompare)[0]!, queue: Point[] = [seed], component: number[][] = [];
    remaining.delete(key(seed));
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!; component.push([...p]); budget.visit({ flood_point: p });
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!(dr || dc) || connectivity !== 8 && Math.abs(dr) + Math.abs(dc) !== 1) continue;
        const q: Point = [p[0] + dr, p[1] + dc], k = key(q);
        if (remaining.has(k)) { remaining.delete(k); queue.push(q); }
      }
    }
    out.push(component.sort(supportCompare));
  }
  return out;
}

/** RecolorRegion's consumed fields and _pockets; no full V5 paint planner. */
export function enclosedPockets(region: R, connectivity: 4 | 8, budget: RecolorWorkBudget): R {
  if (region.clipped || !region.boundary_complete) throw new RecolorPrerequisite('REGION_CLIPPED_OR_BOUNDARY_NOT_COMPLETE');
  const support = new Set<string>(region.support.map(key));
  if (support.size !== region.support.length) throw new RecolorPrerequisite('STRUCTURAL_SUPPORT_NOT_UNIQUE');
  if (!support.size) throw new TypeError('A RecolorRegion requires nonempty support');
  const points = [...support].map(point), top = Math.min(...points.map(p => p[0])) - 1,
    bottom = Math.max(...points.map(p => p[0])) + 1, left = Math.min(...points.map(p => p[1])) - 1,
    right = Math.max(...points.map(p => p[1])) + 1;
  if ((bottom - top + 1) * (right - left + 1) > budget.request.domain_bound) {
    throw new RecolorComputationInterrupted('EXPANDED_COMPLEMENT_DOMAIN_BOUND', { region_ref: region.region_ref });
  }
  const complement: Point[] = [];
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    budget.visit({ region_ref: region.region_ref });
    if (!support.has(key([row, col]))) complement.push([row, col]);
  }
  let exterior = 0; const masks: number[][][] = [];
  for (const component of pocketComponents(complement, connectivity, budget)) {
    if (component.some(([r, c]) => r === top || r === bottom || c === left || c === right)) exterior++;
    else masks.push(component);
  }
  return { region_ref: region.region_ref, evidence_ref: region.evidence_ref, connectivity,
    pocket_masks: masks, pocket_areas: masks.map(m => m.length), pocket_count: masks.length, exterior_component_count: exterior };
}

/** Reuse one current component extractor, preserving source absolute XY order. */
export function components(rows: NativeRows, box: readonly number[] | null = null): R[] {
  validateRows(rows);
  const [x0, y0, x1, y1] = box ?? [0, 0, rows[0]!.length - 1, rows.length - 1];
  if (![x0, y0, x1, y1].every(Number.isSafeInteger) || x0! < 0 || y0! < 0 || x1! < x0! || y1! < y0!
    || x1! >= rows[0]!.length || y1! >= rows.length) throw new TypeError('Recolor component box outside current raster');
  const selected = box ? rows.slice(y0, y1! + 1).map(r => r.slice(x0, x1! + 1)) : rows;
  return geometricComponents(selected, 4).map(c => ({ value: c.color,
    cells: c.mask.map(([x, y]) => [x + c.bbox[0] + x0!, y + c.bbox[1] + y0!]).sort(supportCompare),
    bbox: [c.bbox[0] + x0!, c.bbox[1] + y0!, c.bbox[2] + x0!, c.bbox[3] + y0!] }));
}

export function pockets(c: R, ref: string, box: readonly number[] | null = null): R {
  if (box && c.cells.some(([x, y]: number[]) => x === box[0] || x === box[2] || y === box[1] || y === box[3])) {
    const [x0, y0, x1, y1] = c.bbox, left = Math.max(box[0]!, x0 - 1), right = Math.min(box[2]!, x1 + 1),
      top = Math.max(box[1]!, y0 - 1), bottom = Math.min(box[3]!, y1 + 1),
      support = new Set<string>(c.cells.map(([x, y]: number[]) => key([y!, x!]))), empty: Point[] = [];
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (!support.has(key([y, x]))) empty.push([y, x]);
    const masks = pocketComponents(empty, 4, new RecolorWorkBudget())
      .filter(component => !component.some(([y, x]) => y === top || y === bottom || x === left || x === right));
    return { region_ref: 'visible_region:' + digest(c), evidence_ref: ref, connectivity: 4, pocket_masks: masks,
      pocket_areas: masks.map(m => m.length), pocket_count: masks.length, scope: 'closed_visible_pockets_only',
      complete_object_topology: false, unobserved_beyond_field: true };
  }
  return enclosedPockets({ region_ref: 'region:' + digest(c), support: c.cells.map(([x, y]: number[]) => [y, x]),
    evidence_ref: ref, clipped: false, boundary_complete: true }, 4, new RecolorWorkBudget());
}

function onBoundary(c: R, box: readonly number[]): boolean {
  return c.cells.some(([x, y]: number[]) => x === box[0] || x === box[2] || y === box[1] || y === box[3]);
}
function containsCorners(c: R, box: readonly number[]): boolean {
  const cells = new Set<string>(c.cells.map(key));
  return [[box[0]!, box[1]!], [box[0]!, box[3]!], [box[2]!, box[1]!], [box[2]!, box[3]!]].every(p => cells.has(key(p)));
}

export function measure(rows: NativeRows, obs: R, writes: readonly R[] = []): R | null {
  if (!rows.length || !rows[0]?.length) return null;
  const height = rows.length, width = rows[0].length, cc = components(rows), groups = new Map<string, R[]>();
  for (const c of cc) {
    const [x0, y0, x1, y1] = c.bbox, bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (c.cells.length === bw * bh && bw >= 2 && bh >= 2 && bw < Math.floor(width / 3) && bh < Math.floor(height / 3)) {
      const k = key([y0, y1, bw, bh]), values = groups.get(k) ?? []; values.push(c); groups.set(k, values);
    }
  }
  const wellsGroups = [...groups.values()].filter(g => g.length >= 3 && new Set(g.map(c => c.value)).size === g.length)
    .map(g => [...g].sort((a, b) => a.bbox[0] - b.bbox[0]));
  let layouts: R[] = [];
  for (const wells of wellsGroups) {
    const wy0 = wells[0]!.bbox[1], wy1 = wells[0]!.bbox[3];
    for (let sy = 0; sy < height; sy++) {
      if (new Set(rows[sy]).size !== 1 || wy0 <= sy && sy <= wy1) continue;
      const edge = rows[sy]![0]!, [top, bottom] = sy < wy0 ? [0, sy - 1] : [sy + 1, height - 1];
      if (bottom! - top! < 5) continue;
      for (let sx = 1; sx < width - 1; sx++) {
        if (!rows.slice(top, bottom! + 1).every(r => r[sx] === edge)) continue;
        const left = [0, top!, sx - 1, bottom!], right = [sx + 1, top!, width - 1, bottom!];
        for (const [lb, fb] of [[left, right], [right, left]] as [number[], number[]][]) {
          const palette = new Set(wells.map(c => c.value)), legendParts = components(rows, lb),
            samples = legendParts.filter(c => palette.has(c.value) && !onBoundary(c, lb));
          if (samples.length < 2) continue;
          const mapping: R = {}; let valid = true;
          for (const c of samples) {
            const pk = pockets(c, obs.observation_ref), n = String(pk.pocket_count);
            if (Object.hasOwn(mapping, n) && mapping[n] !== c.value) { valid = false; break; }
            mapping[n] = c.value;
          }
          if (!valid) continue;
          const bodies: R[] = [], parts = components(rows, fb), boundary = parts.filter(c => containsCorners(c, fb)), holes = new Set<string>();
          for (const c of parts) {
            if (boundary.includes(c)) continue;
            const pk = pockets(c, obs.observation_ref, fb);
            for (const mask of pk.pocket_masks) for (const [y, x] of mask) holes.add(key([x, y]));
          }
          for (const c of parts) {
            if (boundary.includes(c) || c.cells.every((p: number[]) => holes.has(key(p)))) continue;
            const pk = pockets(c, obs.observation_ref, fb), n = String(pk.pocket_count);
            if (!Object.hasOwn(mapping, n)) continue;
            bodies.push({ ...c, pocket_count: pk.pocket_count, target: mapping[n], evidence: pk,
              relation_kind: 'shell', partial_topology: pk.complete_object_topology === false });
          }
          if (!bodies.length) continue;
          const legendOuter = legendParts.filter(c => containsCorners(c, lb)), shellsMatch = bodies.every(c => c.value === c.target);
          if (boundary.length === 1 && legendOuter.length === 1 && palette.has(legendOuter[0]!.value)
            && !Object.values(mapping).includes(legendOuter[0]!.value)) {
            bodies.push({ ...boundary[0], target: legendOuter[0]!.value, pocket_count: null, relation_kind: 'surround',
              partial_topology: false, shells_currently_match: shellsMatch, evidence: { source_sample: legendOuter[0],
                observation_ref: obs.observation_ref, scope: 'current_surround_correspondence_hypothesis' } });
          }
          const borders = wells.map(c => {
            const [a, b, d, e] = c.bbox, values = new Set<number>();
            for (let y = b - 1; y <= e + 1; y++) for (let x = a - 1; x <= d + 1; x++) {
              if (x >= 0 && x < width && y >= 0 && y < height && (x === a - 1 || x === d + 1 || y === b - 1 || y === e + 1)) values.add(rows[y]![x]!);
            }
            return values.size === 1 ? [...values][0]! : null;
          });
          const counts = new Map<number | null, number>(); for (const v of borders) counts.set(v, (counts.get(v) ?? 0) + 1);
          const active = wells.filter((_c, i) => borders[i] !== null && counts.get(borders[i]!) === 1
            && Math.max(...counts.values()) === wells.length - 1).map(c => c.value);
          layouts.push({ field: fb, legend: lb, wells, mapping, bodies, active: active.length === 1 ? active[0] : null,
            selection_signature: borders, separator: [sx, sy, edge], evidence: [obs.observation_ref] });
        }
      }
    }
  }
  if (layouts.length > 1) {
    layouts = layouts.filter(m => writes.some(receipt => {
      const mask = receipt.changed_mask ?? [];
      if (receipt.source_epoch !== obs.level_epoch || !receipt.only_target_pigment || receipt.outside_count !== 0
        || !mask.length || (receipt.evidence ?? []).length !== 2) return false;
      const binding = Object.fromEntries(['field', 'legend', 'separator', 'mapping'].map(k => [k, m[k]]));
      if (!equal(receipt.partition_binding ?? {}, binding)) return false;
      const [x0, y0, x1, y1] = m.field;
      return mask.every(([x, y]: number[]) => x0 <= x! && x! <= x1 && y0 <= y! && y! <= y1);
    }));
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

export function selectionSupportSignature(m: R): R {
  const wells = m.wells as R[], xbase = Math.min(...wells.map(c => c.bbox[0])), ybase = Math.min(...wells.map(c => c.bbox[1]));
  return { wells: wells.map(c => [c.bbox[0] - xbase, c.bbox[1] - ybase, c.bbox[2] - c.bbox[0] + 1, c.bbox[3] - c.bbox[1] + 1]),
    one_distinct_indicator: m.active !== null, uniform_well_bodies: wells.every(c => c.cells.length === (c.bbox[2] - c.bbox[0] + 1) * (c.bbox[3] - c.bbox[1] + 1)) };
}
