/** Consumed exact V5 concentric measurements from pinned source 786dcf51.
 * Public integer palette rasters only. These measurements assign no role and
 * carry no action authorization. The unused additions-history updater is not
 * part of this port. */
import { supportParts, type SupportRecord } from './v6-support-measurements.ts';
import { validateRows } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

export type RC = readonly [row: number, column: number];
export type XY = readonly [x: number, y: number];
export type FrameIdentity = readonly [top: number, left: number, bottom: number, right: number, value: number];
export type PointCandidate = { readonly point: RC | null };
export type Measurement = Record<string, any>;
export const MAX_AREA = 4096;
export const MAX_COMPONENTS = 512;
export const MAX_FRAMES = 32;

/** Immutable counterpart of the two declared fields of Python FrameGrid. */
export class FrameGrid {
  readonly rows: NativeRows;
  readonly schema_version = 'yf_arc3_v5.frame_grid.v1';
  constructor(rows: NativeRows) {
    validateRows(rows);
    this.rows = Object.freeze(rows.map(row => Object.freeze([...row])));
    Object.freeze(this);
  }
  get height(): number { return this.rows.length; }
  get width(): number { return this.rows[0]!.length; }
}

export class ConcentricGeometryBoundExceeded extends Error {
  constructor(message: string) { super(message); this.name = 'ConcentricGeometryBoundExceeded'; }
}

export class ConcentricFrame {
  readonly outer_ref: string;
  readonly outer_value: number;
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
  readonly inner_refs: readonly string[];
  readonly maximum_equal_padding: number;
  constructor(outer_ref: string, outer_value: number, top: number, left: number,
    bottom: number, right: number, inner_refs: readonly string[], maximum_equal_padding: number) {
    this.outer_ref = outer_ref; this.outer_value = outer_value;
    this.top = top; this.left = left; this.bottom = bottom; this.right = right;
    this.inner_refs = Object.freeze([...inner_refs]); this.maximum_equal_padding = maximum_equal_padding;
    Object.freeze(this);
  }
  get center(): RC { return [Math.floor((this.top + this.bottom) / 2), Math.floor((this.left + this.right) / 2)]; }
  get identity(): FrameIdentity { return [this.top, this.left, this.bottom, this.right, this.outer_value]; }
}

export const sameRC = (a: RC | null, b: RC): boolean => a !== null && a[0] === b[0] && a[1] === b[1];
const isAdded = (f: ConcentricFrame, additions: readonly FrameIdentity[]): boolean =>
  additions.some(a => a.length === 5 && f.identity.every((value, index) => value === a[index]));

// Identity keys belong to deeply frozen FrameGrid values created above. Keep
// the source's eight-entry bound and return only frozen measurements.
const frameCache = new Map<FrameGrid, readonly ConcentricFrame[]>();
export function measureConcentricFrames(frame: FrameGrid): readonly ConcentricFrame[] {
  const cached = frameCache.get(frame);
  if (cached) { frameCache.delete(frame); frameCache.set(frame, cached); return cached; }
  if (frame.height * frame.width > MAX_AREA)
    throw new ConcentricGeometryBoundExceeded('concentric frame raster area exceeds bound');
  const components = supportParts(frame.rows);
  if (components.length > MAX_COMPONENTS)
    throw new ConcentricGeometryBoundExceeded('concentric frame component count exceeds bound');
  const result: ConcentricFrame[] = [];
  for (const outer of components) {
    const box = outer.bbox;
    if (Math.min(box.height, box.width) < 3 || outer.area !== 2 * (box.height + box.width) - 4) continue;
    if (!outer.relative_pixels.every(([r, c]: RC) => r === 0 || r === box.height - 1 || c === 0 || c === box.width - 1)) continue;
    const inners: string[] = [], paddings: number[] = [];
    for (const inner of components) {
      const ib = inner.bbox;
      if (Math.min(ib.height, ib.width) < 2) continue;
      const gaps = [ib.top - box.top, ib.left - box.left, box.bottom - ib.bottom, box.right - ib.right];
      if (Math.min(...gaps) > 0 && new Set(gaps).size === 1) {
        inners.push(inner.component_id); paddings.push(gaps[0]!);
      }
    }
    if (inners.length) {
      result.push(new ConcentricFrame(outer.component_id, outer.value, box.top, box.left,
        box.bottom, box.right, inners, Math.max(...paddings)));
      if (result.length > MAX_FRAMES) return retain(frame, []);
    }
  }
  return retain(frame, result);
}
function retain(frame: FrameGrid, result: ConcentricFrame[]): readonly ConcentricFrame[] {
  const frozen = Object.freeze(result);
  // Plain caller-owned lookalikes do not acquire an immutable cache contract.
  if (frame instanceof FrameGrid && Object.isFrozen(frame) && Object.isFrozen(frame.rows)
      && frame.rows.every(row => Object.isFrozen(row))) {
    frameCache.set(frame, frozen);
    if (frameCache.size > 8) frameCache.delete(frameCache.keys().next().value!);
  }
  return frozen;
}

function backgroundValue(frame: FrameGrid): number {
  const counts = new Map<number, number>();
  for (const row of frame.rows) for (const value of row) counts.set(value, (counts.get(value) ?? 0) + 1);
  let selected = 0, maximum = -1;
  for (const [value, count] of counts) if (count > maximum) { selected = value; maximum = count; }
  return selected; // Counter.most_common keeps first raster occurrence on ties.
}
function nonbackgroundRuns(row: readonly number[], background: number): readonly (readonly [number, number])[] {
  const result: [number, number][] = []; let start: number | null = null;
  for (let col = 0; col < row.length; col++) {
    if (row[col] !== background && start === null) start = col;
    if (row[col] === background && start !== null) { result.push([start, col - 1]); start = null; }
  }
  if (start !== null) result.push([start, row.length - 1]);
  return result;
}
function runContaining(runs: readonly (readonly [number, number])[], col: number): readonly [number, number] | null {
  return runs.find(([left, right]) => left <= col && col <= right) ?? null;
}
const sameRun = (a: readonly [number, number], b: readonly [number, number] | null): boolean =>
  b !== null && a[0] === b[0] && a[1] === b[1];

export function measureConcentricContext(frames: readonly ConcentricFrame[], additions: readonly FrameIdentity[],
  white_value: number, frame: FrameGrid | null = null): Measurement {
  const added_tight = frames.filter(f => f.maximum_equal_padding === 1 && isAdded(f, additions));
  const geometry: Measurement = {
    added_tight_rect_wider_lower_span_present: false,
    added_tight_rect_distinct_horizontal_peer_span_count: 0,
    added_tight_rect_wider_horizontal_peer_span_count: 0,
    added_tight_rect_narrower_horizontal_peer_span_count: 0,
  };
  if (frame !== null && added_tight.length === 1) {
    const tight = added_tight[0]!, background = backgroundValue(frame), width = tight.right - tight.left + 1;
    const [row, col] = tight.center, runs = nonbackgroundRuns(frame.rows[row]!, background);
    const own = runContaining(runs, col), peers = runs.filter(run => !sameRun(run, own));
    const lower_row = tight.bottom + 1;
    const lower = lower_row < frame.height ? runContaining(nonbackgroundRuns(frame.rows[lower_row]!, background), col) : null;
    const peer_widths = peers.map(([left, right]) => right - left + 1);
    geometry.added_tight_rect_wider_lower_span_present = lower !== null && lower[0] > 0
      && lower[1] < frame.width - 1 && lower[1] - lower[0] + 1 > width;
    geometry.added_tight_rect_distinct_horizontal_peer_span_count = peers.length;
    geometry.added_tight_rect_wider_horizontal_peer_span_count = peer_widths.filter(w => w > width).length;
    geometry.added_tight_rect_narrower_horizontal_peer_span_count = peer_widths.filter(w => w < width).length;
  }
  return {
    spaced_rect_count: frames.filter(f => f.maximum_equal_padding > 1).length,
    spaced_rect_palette_white_count: frames.filter(f => f.maximum_equal_padding > 1 && f.outer_value === white_value).length,
    added_spaced_rect_count: frames.filter(f => f.maximum_equal_padding > 1 && isAdded(f, additions)).length,
    added_tight_rect_count: added_tight.length, ...geometry,
  };
}

export function measureConcentricCandidate(frames: readonly ConcentricFrame[], candidate: PointCandidate,
  additions: readonly FrameIdentity[] = [], white_value = 0, frame: FrameGrid | null = null): Measurement {
  const point = candidate.point, added_tight = frames.filter(f => f.maximum_equal_padding === 1 && isAdded(f, additions));
  let local_span_width = 0, local_span_is_unique_widest_distinct_peer = false;
  if (frame !== null && added_tight.length === 1 && point !== null) {
    const background = backgroundValue(frame), [row, col] = point;
    if (0 <= row && row < frame.height) {
      const runs = nonbackgroundRuns(frame.rows[row]!, background), run = runContaining(runs, col);
      if (run !== null) {
        local_span_width = run[1] - run[0] + 1;
        const own = runContaining(runs, added_tight[0]!.center[1]);
        const widths = runs.filter(peer => !sameRun(peer, own)).map(([left, right]) => right - left + 1);
        local_span_is_unique_widest_distinct_peer = widths.length > 0 && local_span_width === Math.max(...widths)
          && widths.filter(width => width === local_span_width).length === 1;
      }
    }
  }
  const tight_width = added_tight.length === 1 ? added_tight[0]!.right - added_tight[0]!.left + 1 : 0;
  return {
    spaced_rect_point_center_count: frames.filter(f => sameRC(point, f.center) && f.maximum_equal_padding > 1).length,
    spaced_rect_point_palette_white_count: frames.filter(f => sameRC(point, f.center) && f.maximum_equal_padding > 1 && f.outer_value === white_value).length,
    tight_rect_point_palette_white_count: frames.filter(f => sameRC(point, f.center) && f.maximum_equal_padding === 1 && f.outer_value === white_value).length,
    added_spaced_rect_point_center_count: frames.filter(f => sameRC(point, f.center) && f.maximum_equal_padding > 1 && isAdded(f, additions)).length,
    added_tight_rect_point_center_count: added_tight.filter(f => sameRC(point, f.center)).length,
    unique_added_tight_rect_distinct_horizontal_peer: added_tight.length === 1 && point !== null
      && Math.abs(point[0] - added_tight[0]!.center[0]) < added_tight[0]!.bottom - added_tight[0]!.top + 1
      && Math.abs(point[1] - added_tight[0]!.center[1]) > added_tight[0]!.right - added_tight[0]!.left + 1,
    candidate_local_horizontal_span_width: local_span_width,
    candidate_local_horizontal_span_is_narrower_than_added_tight_rect: local_span_width > 0 && tight_width > 0 && local_span_width < tight_width,
    candidate_local_horizontal_span_is_unique_widest_distinct_peer: local_span_is_unique_widest_distinct_peer,
  };
}

export const measure_concentric_frames = measureConcentricFrames;
export const measure_concentric_context = measureConcentricContext;
export const measure_concentric_candidate = measureConcentricCandidate;
export type V5Component = SupportRecord;
