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

function directionFromExampleScale(layouts: readonly R[]): R | undefined {
  const [first, second] = layouts;
  if (layouts.length !== 2 || !first || !second
    || !equal(first.field, second.legend) || !equal(first.legend, second.field)) return undefined;
  const oriented = layouts.filter(layout => (layout.bodies as R[]).every(body => {
    if (body.relation_kind !== 'shell') return true;
    const [left, top, right, bottom] = body.bbox;
    const [exampleLeft, exampleTop, exampleRight, exampleBottom] = body.example;
    return (right - left + 1) * (bottom - top + 1) > (exampleRight - exampleLeft + 1) * (exampleBottom - exampleTop + 1);
  }));
  return oriented.length === 1 ? oriented[0] : undefined;
}

function uniformPocketColor(rows: NativeRows, topology: R, palette: ReadonlySet<number>): number | null {
  const pixels = new Set<number>();
  for (const mask of topology.pocket_masks as Point[][]) for (const [row, col] of mask) pixels.add(rows[row]![col]!);
  const hue = pixels.values().next().value;
  return pixels.size === 1 && hue !== undefined && palette.has(hue) ? hue : null;
}

type PocketStrip = { bbox: number[]; lane: number; pitch: number; count: number; topMargin: number; bottomMargin: number };

function pocketStrip(example: R, topology: R): PocketStrip | null {
  const masks = topology.pocket_masks as Point[][];
  if (masks.length < 2 || masks.some(mask => mask.length !== 1)) return null;
  const [left, top, right, bottom] = example.bbox as [number, number, number, number];
  const sites = masks.map(mask => mask[0]!).sort(([a], [b]) => a - b);
  const [first, lane] = sites[0]!, pitch = sites[1]![0] - first;
  if (pitch < 2 || 2 * lane !== left + right || sites.some(([y, x], i) => x !== lane || y !== first + pitch * i)) return null;
  return { bbox: example.bbox, lane, pitch, count: sites.length, topMargin: first - top, bottomMargin: bottom - sites.at(-1)![0] };
}

/** Paired visible strips constrain the geometry of pockets in a contour that shares the backdrop. */
function examplesOnBackdrop(rows: NativeRows, samples: R[], topologies: ReadonlyMap<R, R>, backdrop: R) {
  const strips = samples.flatMap(example => {
    const strip = pocketStrip(example, topologies.get(example)!);
    return strip ? [strip] : [];
  }).sort((a, b) => a.bbox[1]! - b.bbox[1]!);
  const inferred: { bbox: number[]; dots: R[]; count: number; color: number }[] = [];
  for (let i = 1; i < strips.length; i++) {
    const above = strips[i - 1]!, below = strips[i]!, { lane, pitch, topMargin, bottomMargin } = above;
    if (lane !== below.lane || pitch !== below.pitch || topMargin !== below.topMargin || bottomMargin !== below.bottomMargin
      || above.bbox[0] !== below.bbox[0] || above.bbox[2] !== below.bbox[2] || Math.abs(above.count - below.count) < 2) continue;
    const dots = samples.filter(item => item.cells.length === 1 && item.bbox[0] === lane
      && item.bbox[1] > above.bbox[3]! && item.bbox[1] < below.bbox[1]!).sort((a, b) => a.bbox[1] - b.bbox[1]);
    if (dots.length <= Math.min(above.count, below.count) || dots.length >= Math.max(above.count, below.count)) continue;
    const [x, y] = dots[0]!.cells[0] as Point, color = dots[0]!.value as number;
    if (dots.some((dot, j) => dot.value !== color || dot.bbox[1] !== y + j * pitch)) continue;
    const left = above.bbox[0]!, right = above.bbox[2]!, top = y - topMargin, bottom = dots.at(-1)!.bbox[1] + bottomMargin;
    if (top <= above.bbox[3]! || bottom >= below.bbox[1]!) continue;
    const cavities = new Set(dots.map(dot => key(dot.cells[0])));
    let matches = true;
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      if (rows[row]?.[col] !== (col === x && cavities.has(key([col, row])) ? color : backdrop.value)) matches = false;
    }
    if (matches) inferred.push({ bbox: [left, top, right, bottom], dots, count: dots.length, color });
  }
  return inferred;
}

export function measure(rows: NativeRows, obs: R, writes: readonly R[] = [], options?: { examples?: boolean }): R | null {
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
          const palette = new Set(wells.map(c => c.value)), legendParts = components(rows, lb);
          const samples = legendParts.filter(c => palette.has(c.value) && !onBoundary(c, lb));
          const legendTopology = new Map<R, R>();
          // The legend may use a palette color behind its symbols, including inside their pockets.
          const enclosed = new Set<string>();
          if (options?.examples) for (const component of samples) {
            const topology = pockets(component, obs.observation_ref);
            legendTopology.set(component, topology);
            for (const mask of topology.pocket_masks) for (const [y, x] of mask) enclosed.add(key([x, y]));
          }
          const visibleExamples = options?.examples
            ? samples.filter(component => !component.cells.every((point: number[]) => enclosed.has(key(point)))) : samples;
          if (visibleExamples.length < 2) continue;
          const legendOuter = legendParts.filter(c => containsCorners(c, lb));
          const backdrop = options?.examples && legendOuter.length === 1 && palette.has(legendOuter[0]!.value) ? legendOuter[0] : undefined;
          const inferred = backdrop ? examplesOnBackdrop(rows, visibleExamples, legendTopology, backdrop) : [];
          const dots = new Set(inferred.flatMap(example => example.dots));
          const mapping: R = {}, examples: R = {}, pocketColors = new Map<string, number | null>();
          let valid = true;
          for (const c of visibleExamples) {
            if (dots.has(c)) continue;
            const topology = legendTopology.get(c) ?? pockets(c, obs.observation_ref);
            const n = String(topology.pocket_count);
            if (Object.hasOwn(mapping, n) && mapping[n] !== c.value) { valid = false; break; }
            mapping[n] = c.value;
            if (options?.examples) {
              examples[n] ??= c.bbox;
              const color = uniformPocketColor(rows, topology, palette);
              pocketColors.set(n, pocketColors.has(n) && pocketColors.get(n) !== color ? null : color);
            }
          }
          for (const example of inferred) {
            const n = String(example.count);
            if (Object.hasOwn(mapping, n)) { valid = false; break; }
            mapping[n] = backdrop!.value;
            examples[n] = example.bbox;
            pocketColors.set(n, example.color);
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
            bodies.push({ ...c, pocket_count: pk.pocket_count, target: mapping[n], ...(options?.examples ? { example: examples[n] } : {}), evidence: pk,
              relation_kind: 'shell', partial_topology: pk.complete_object_topology === false });
          }
          if (!bodies.length) continue;
          const shellsMatch = bodies.every(c => c.value === c.target);
          if (boundary.length === 1 && legendOuter.length === 1 && palette.has(legendOuter[0]!.value)
            && (inferred.length || !Object.values(mapping).includes(legendOuter[0]!.value))) {
            bodies.push({ ...boundary[0], target: legendOuter[0]!.value,
              ...(options?.examples ? { example: legendOuter[0]!.bbox } : {}), pocket_count: null, relation_kind: 'surround',
              partial_topology: false, shells_currently_match: shellsMatch, evidence: { source_sample: legendOuter[0],
                observation_ref: obs.observation_ref, scope: 'current_surround_correspondence_hypothesis' } });
          }
          if ([...pocketColors.values()].some(color => color !== null)) {
            const partAt = new Map(parts.flatMap(part => (part.cells as Point[]).map(cell => [key(cell), part] as const)));
            const assigned = new Set<R>();
            for (const shell of [...bodies]) {
              if (shell.relation_kind !== 'shell') continue;
              const target = pocketColors.get(String(shell.pocket_count));
              if (target == null || target === shell.target) continue;
              for (const mask of shell.evidence.pocket_masks as Point[][]) {
                const [row, col] = mask[0]!, region = partAt.get(key([col, row]));
                if (!region || assigned.has(region) || region.cells.length !== mask.length
                  || !mask.every(([y, x]) => partAt.get(key([x, y])) === region)) continue;
                assigned.add(region);
                bodies.push({ ...region, target, pocket_count: null, relation_kind: 'pocket',
                  example: shell.example, partial_topology: shell.partial_topology,
                  evidence: { observation_ref: obs.observation_ref, scope: 'uniform_ink_in_matching_example_pockets' } });
              }
            }
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
    const boundLayouts = layouts.filter(m => writes.some(receipt => {
      const mask = receipt.changed_mask ?? [];
      if (receipt.source_epoch !== obs.level_epoch || !receipt.only_target_pigment || receipt.outside_count !== 0
        || !mask.length || (receipt.evidence ?? []).length !== 2) return false;
      const binding = Object.fromEntries(['field', 'legend', 'separator', 'mapping'].map(k => [k, m[k]]));
      if (!equal(receipt.partition_binding ?? {}, binding)) return false;
      const [x0, y0, x1, y1] = m.field;
      return mask.every(([x, y]: number[]) => x0 <= x! && x! <= x1 && y0 <= y! && y! <= y1);
    }));
    const oriented = options?.examples && !boundLayouts.length ? directionFromExampleScale(layouts) : undefined;
    layouts = oriented ? [{ ...oriented, reduced_examples: true }] : boundLayouts;
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

export function selectionSupportSignature(m: R): R {
  const wells = m.wells as R[], xbase = Math.min(...wells.map(c => c.bbox[0])), ybase = Math.min(...wells.map(c => c.bbox[1]));
  return { wells: wells.map(c => [c.bbox[0] - xbase, c.bbox[1] - ybase, c.bbox[2] - c.bbox[0] + 1, c.bbox[3] - c.bbox[1] + 1]),
    one_distinct_indicator: m.active !== null, uniform_well_bodies: wells.every(c => c.cells.length === (c.bbox[2] - c.bbox[0] + 1) * (c.bbox[3] - c.bbox[1] + 1)) };
}
