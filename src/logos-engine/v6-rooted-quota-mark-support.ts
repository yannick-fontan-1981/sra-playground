/**
 * Explicit native extension of the source's one-cell-pitch mark window.
 *
 * Grid/chain geometry and the near-grid unit shapes are measured by the faithful
 * source port. This reader checks the whole visible aligned margin for one
 * unambiguous continuation of those units. It never consults quota propagation,
 * a desired fill, an official score, a game identity or a level number.
 */
import { geometricComponents } from './v6-native-observer.ts';
import { measureRootedQuota } from './v6-rooted-quota-observation.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Part = ReturnType<typeof geometricComponents>[number];
type Box = [number, number, number, number];

export interface NativeRootedQuotaOptions {
  /** Descriptive native measurement, separate from the unchanged source path. */
  extendedMarkSupport?: boolean;
}

export interface RootedMarkSupportMeasurement {
  status: 'measured' | 'unavailable' | 'refused';
  reason: string;
  scene: R | null;
  receipt: R | null;
}

export interface RootedMarkSupportRevalidation {
  admitted: boolean;
  measurement: RootedMarkSupportMeasurement;
}

const contained = (part: Part, box: readonly number[]): boolean => box[0]! <= part.bbox[0] && part.bbox[2] <= box[2]!
  && box[1]! <= part.bbox[1] && part.bbox[3] <= box[3]!;
const shapeOf = (part: Part): number[] => [part.bbox[2] - part.bbox[0] + 1, part.bbox[3] - part.bbox[1] + 1];
const fullUnit = (part: Part, shape: readonly number[]): boolean => equal(shapeOf(part), shape)
  && part.area === shape[0]! * shape[1]!;
const support = (part: Part): R => ({ bbox: [...part.bbox], palette_value: part.color,
  pixels: part.mask.map(([x, y]) => [x + part.bbox[0], y + part.bbox[1]]) });
const rectanglePixels = (rows: NativeRows, box: readonly number[]): number[][] => {
  const out: number[][] = [];
  for (let y = box[1]!; y <= box[3]!; y++) for (let x = box[0]!; x <= box[2]!; x++) out.push([x, y, rows[y]![x]!]);
  return out;
};
const zeroShell = (part: Part, rows: NativeRows): boolean => {
  const [l, t, r, b] = part.bbox;
  return r - l === b - t && part.area === (r - l + 1) ** 2 - 1
    && rows[Math.floor((t + b) / 2)]![Math.floor((l + r) / 2)] !== part.color;
};

/** A complete series may recolor as a whole; its measured unit ownership may not. */
function structuralSupport(value: any, key = ''): any {
  if (Array.isArray(value)) {
    if (key === 'pixels' || key === 'support_pixels') return value.map(point => point.slice(0, 2));
    return value.map(child => structuralSupport(child));
  }
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([name]) => !['palette_value', 'palette_values', 'support_ref', 'structure_ref', 'geometry_ref'].includes(name))
    .map(([name, child]) => [name, structuralSupport(child, name)]));
  return value;
}

function identified(value: R, field: string): boolean {
  if (typeof value[field] !== 'string') return false;
  const body = { ...value }; delete body[field];
  return identity(body) === value[field];
}

/**
 * The source observation remains the seed, not a fallback after ambiguity.
 * Unchanged counts return that exact scene. A wider reading carries its full
 * descriptive receipt in the scene identity and later in real acquisition.
 */
export function measureRootedQuotaWithMarkSupport(rows: NativeRows, contentPalette: number | null = null): RootedMarkSupportMeasurement {
  const source = measureRootedQuota(rows, contentPalette);
  if (source === null) return { status: 'unavailable', reason: 'source_grid_chain_or_mark_seed_unavailable', scene: null, receipt: null };
  const parts = geometricComponents(rows), axes: R[] = [];
  const refuse = (reason: string, details: R): RootedMarkSupportMeasurement => ({ status: 'refused', reason, scene: null,
    receipt: { kind: 'native_aligned_mark_support_refusal', source_geometry_ref: source.geometry_ref,
      reason, ...details, scope: 'Ambiguous or incomplete visible mark ownership. No quota count is released.' } });
  const palettes = new Set<number>(), zeroForms = new Set<string>();
  let expanded = false;
  for (const axis of [0, 1]) {
    const lines: number[] = axis === 0 ? source.y_lines : source.x_lines;
    const gridPitch = lines[1]! - lines[0]!, edge = source.bbox[axis], shape: number[] = source.mark_unit_shapes[axis];
    const sourceCounts: number[] = axis === 0 ? source.row_marks : source.column_marks;
    const groups: R[] = [], anchors = new Set<number>(), alignments = new Set<number>(), seedPitches = new Set<number>();
    const name = axis === 0 ? 'row' : 'column';
    for (let index = 0; index < lines.length - 1; index++) {
      const mid = Math.floor((lines[index]! + lines[index + 1]!) / 2);
      // A part cannot be shared by two stripes: each tolerance is strictly less
      // than half the distance between their observed cell centers.
      const aligned = parts.filter(part => {
        const [l, t, r, b] = part.bbox;
        return axis === 0 ? r < edge && Math.abs((t + b) / 2 - mid) < gridPitch / 4
          : b < edge && Math.abs((l + r) / 2 - mid) < gridPitch / 4;
      });
      const near = aligned.filter(part => part.bbox[axis]! >= edge - gridPitch);
      if (!aligned.length || !near.length) return refuse('mark_seed_missing', { axis: name, index });
      if (aligned.some(part => part.bbox[axis] === 0)) return refuse('visible_support_touches_raster_boundary', { axis: name, index });
      const hollow = aligned.filter(part => zeroShell(part, rows));
      if (sourceCounts[index] === 0) {
        if (hollow.length !== 1 || !near.includes(hollow[0]!) || aligned.some(part => !contained(part, hollow[0]!.bbox))) {
          return refuse('zero_symbol_has_competing_aligned_support', { axis: name, index });
        }
        const shell = hollow[0]!, box = shell.bbox;
        anchors.add(edge - box[axis + 2]!);
        zeroForms.add(identity([shapeOf(shell), shell.mask]));
        groups.push({ index, cell_center: mid, kind: 'hollow_zero', count: 0, source_count: 0,
          palette_value: shell.color,
          shell: support(shell), contained_components: aligned.filter(part => part !== shell).map(support),
          support_bbox: [...box], support_pixels: rectanglePixels(rows, box) });
        continue;
      }
      if (hollow.length || aligned.some(part => !fullUnit(part, shape))) {
        return refuse('competing_aligned_shape', { axis: name, index });
      }
      if (new Set(aligned.map(part => part.color)).size !== 1) return refuse('mixed_aligned_unit_palettes', { axis: name, index });
      if (near.length !== sourceCounts[index]) return refuse('source_seed_count_changed', { axis: name, index });
      for (const part of aligned) palettes.add(part.color);
      const ordered = [...aligned].sort((a, b) => b.bbox[axis + 2]! - a.bbox[axis + 2]!);
      const seed = ordered.filter(part => near.includes(part));
      const distances = ordered.map(part => edge - part.bbox[axis + 2]!);
      anchors.add(distances[0]!);
      for (const part of ordered) {
        // Exact doubled coordinates preserve half-pixel centers in portable
        // integer-only Kernel evidence; no rounding chooses an alignment.
        const transverse = axis === 0 ? part.bbox[1] + part.bbox[3] : part.bbox[0] + part.bbox[2];
        alignments.add(transverse - 2 * mid);
      }
      for (let i = 1; i < seed.length; i++) seedPitches.add(seed[i - 1]!.bbox[axis + 2]! - seed[i]!.bbox[axis + 2]!);
      const box: Box = [Math.min(...ordered.map(part => part.bbox[0])), Math.min(...ordered.map(part => part.bbox[1])),
        Math.max(...ordered.map(part => part.bbox[2])), Math.max(...ordered.map(part => part.bbox[3]))];
      groups.push({ index, cell_center: mid, kind: 'repeated_units', count: ordered.length, source_count: near.length,
        palette_value: ordered[0]!.color,
        units: ordered.map(support), inward_distances: distances, seed_unit_count: seed.length,
        support_bbox: box, support_pixels: rectanglePixels(rows, box) });
      expanded ||= ordered.length > near.length;
    }
    if (anchors.size !== 1) return refuse('inward_anchor_ambiguous', { axis: name, anchors: [...anchors] });
    if (alignments.size !== 1) return refuse('transverse_alignment_ambiguous', { axis: name, alignments: [...alignments] });
    if (seedPitches.size > 1) return refuse('seed_spacing_ambiguous', { axis: name, pitches: [...seedPitches] });
    const pitch: number | null = [...seedPitches][0] ?? null;
    const positive = groups.filter(group => group.kind === 'repeated_units');
    if (pitch === null && positive.some(group => group.count > group.source_count)) return refuse('extension_pitch_not_observed', { axis: name });
    if (pitch !== null) {
      if (pitch <= shape[axis]!) return refuse('unit_pitch_does_not_separate_components', { axis: name, pitch });
      for (const group of positive) {
        const distances: number[] = group.inward_distances;
        if (distances.some((distance, i) => i > 0 && distance - distances[i - 1]! !== pitch)) {
          return refuse('aligned_series_has_gap_or_second_phase', { axis: name, index: group.index, pitch, distances });
        }
        // At least one expected unit slot beyond the last measured unit must be
        // fully visible and empty. A screen edge does not establish termination.
        const last = group.units.at(-1).bbox as Box, next = [...last] as Box;
        next[axis] = next[axis]! - pitch; next[axis + 2] = next[axis + 2]! - pitch;
        if (next[0] < 0 || next[1] < 0 || next[2] >= rows[0]!.length || next[3] >= rows.length) {
          return refuse('outward_series_end_not_visible', { axis: name, index: group.index, next_slot: next });
        }
        const pixels = rectanglePixels(rows, next);
        if (pixels.some(([, , value]) => value === group.units[0].palette_value)) {
          return refuse('outward_slot_has_unattributed_unit_pixels', { axis: name, index: group.index, next_slot: next });
        }
        group.outward_empty_slot = { bbox: next, pixels };
      }
    }
    axes.push({ axis: name, grid_lines: [...lines], grid_edge: edge, grid_pitch: gridPitch,
      source_band_minimum: edge - gridPitch, outward_direction: axis === 0 ? [-1, 0] : [0, -1],
      unit_shape: [...shape], inward_anchor: [...anchors][0], transverse_offset_doubled: [...alignments][0],
      repetition_pitch: pitch, groups });
  }
  if (zeroForms.size > 1) return refuse('zero_symbol_identity_ambiguous', {});
  const counts = { rows: axes[0]!.groups.map((group: R) => group.count), columns: axes[1]!.groups.map((group: R) => group.count) };
  const receipt: R = { schema: 'logos-engine.native-aligned-mark-support.v1', kind: 'native_aligned_mark_support',
    source_geometry_ref: source.geometry_ref, source_counts: { rows: [...source.row_marks], columns: [...source.column_marks] },
    counts, palette_values: [...palettes].sort((a, b) => a - b), axes,
    method: 'unique_near_grid_units_then_complete_visible_aligned_regular_series',
    scope: 'Current pixel support only. Counts as quotas, hollow symbol as zero, root and prefix semantics remain conditional; no solver-selected reading or terminal law.' };
  receipt.structure_ref = identity(structuralSupport(receipt));
  receipt.support_ref = identity(receipt);
  if (!expanded) return { status: 'measured', reason: 'complete_visible_support_matches_source_counts', scene: source, receipt };
  const scene: R = { ...source, row_marks: counts.rows, column_marks: counts.columns, native_mark_support: receipt };
  delete scene.geometry_ref; scene.geometry_ref = identity(scene);
  return { status: 'measured', reason: 'complete_visible_support_extends_source_counts', scene, receipt };
}

/** Runtime opt-in is required; deleting a proposal annotation cannot downgrade it. */
export function revalidateRootedMarkSupport(rows: NativeRows, expected: R, allowSeriesRecoloring = false): RootedMarkSupportRevalidation {
  const measured = measureRootedQuotaWithMarkSupport(rows, expected.empty_content_palette);
  if (measured.status !== 'measured' || !identified(expected, 'geometry_ref')) return { admitted: false, measurement: measured };
  const support = expected.native_mark_support;
  if (Object.hasOwn(expected, 'native_mark_support') && (support === null || typeof support !== 'object'
    || !identified(support, 'support_ref') || support.structure_ref !== identity(structuralSupport(support)))) {
    return { admitted: false, measurement: measured };
  }
  const admitted = allowSeriesRecoloring ? equal(structuralSupport(measured.scene), structuralSupport(expected)) : equal(measured.scene, expected);
  return { admitted, measurement: measured };
}

export function currentRootedMarkSupportMatches(rows: NativeRows, expected: R, allowSeriesRecoloring = false): boolean {
  return revalidateRootedMarkSupport(rows, expected, allowSeriesRecoloring).admitted;
}
