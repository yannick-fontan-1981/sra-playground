/** Bounded visible-stencil composition from pinned V6 facet_examples/stencils.py.
 * Every rational sampling alternative and the incomplete-search result survive. */
import { facetLexicographic, facetPointKey, type FacetPoint } from './v6-facet-examples-geometry.ts';
import type { NativeRows } from './v6-native-types.ts';

export type FacetImage = Map<string, number>;
export interface FacetFace { value: number; pixels: FacetPoint[]; point: FacetPoint }
export interface FacetStencilAction {
  owner_origin: FacetPoint; port_value: number; offset: FacetPoint; destination: FacetPoint; point: FacetPoint;
}
export interface FacetSamplingComparison {
  scale: FacetPoint; sample_offset: FacetPoint; uncertain_contour_samples: number;
  claim: 'compatible_sampled_correspondence_not_exact_renderer_identification';
}
export interface FacetStencilSolution {
  placements: FacetPoint[]; actions: FacetStencilAction[]; comparisons: FacetSamplingComparison[];
}
export interface FacetSearchResult {
  status: 'bounded_incomplete' | 'compatible_minimal_within_model' | 'no_compatible_composition';
  examined: number; solutions: FacetStencilSolution[]; model_limit?: string;
}
export function facetImagePoints(image: ReadonlyMap<string, number>): FacetPoint[] {
  return [...image.keys()].map(key => key.split(',').map(Number) as FacetPoint);
}
export function facetRender(stamp: NativeRows, placements: readonly (readonly [number, number])[], background: number): FacetImage {
  const out: FacetImage = new Map();
  for (const [dx, dy] of placements) for (let y = 0; y < stamp.length; y++) for (let x = 0; x < stamp[y]!.length; x++) {
    const value = stamp[y]![x]!;
    if (value !== background) out.set(facetPointKey(x + dx, y + dy), value);
  }
  return out;
}
export function facetBounds(points: Iterable<readonly [number, number]>): [number, number, number, number] {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  if (left === Infinity) throw new RangeError('A stencil bound requires visible points');
  return [left, top, right, bottom];
}
const gcd = (first: number, second: number): number => {
  while (second) [first, second] = [second, first % second];
  return first;
};

export function facetCompare(reference: NativeRows, image: ReadonlyMap<string, number>, stamp: NativeRows,
  placements: readonly (readonly [number, number])[], background: number, palette: readonly number[],
  maxDenominator = 8, sampleOffsets: readonly number[] = [-0.5, 0, 0.5]): FacetSamplingComparison[] {
  const rh = reference.length, rw = reference[0]!.length, sh = stamp.length, sw = stamp[0]!.length;
  const l = Math.min(...placements.map(p => p[0])), t = Math.min(...placements.map(p => p[1]));
  const r = Math.max(...placements.map(p => p[0])) + sw - 1, b = Math.max(...placements.map(p => p[1])) + sh - 1;
  const width = r - l + 1, height = b - t + 1, ratios = new Map<string, FacetPoint>();
  // Fraction reduces equal rationals before the source sorts them by value.
  for (let d = 1; d <= maxDenominator; d++) for (let n = 1; n <= d; n++) {
    if (Math.floor(width * n / d) !== rw || Math.floor(height * n / d) !== rh) continue;
    const divisor = gcd(n, d), ratio: FacetPoint = [n / divisor, d / divisor];
    ratios.set(`${ratio[0]}/${ratio[1]}`, ratio);
  }
  const possible = [...ratios.values()].sort((a, b) => a[0] * b[1] - b[0] * a[1]);
  const models: FacetSamplingComparison[] = [], colors = new Set(palette);
  for (const ratio of possible) for (const ox of sampleOffsets) for (const oy of sampleOffsets) {
    const scale = ratio[0] / ratio[1]; let mismatch = false, uncertain = 0;
    for (let y = 0; y < reference.length; y++) {
      for (let x = 0; x < reference[y]!.length; x++) {
        const value = reference[y]![x]!, px = l + Math.floor((x + 0.5) / scale + ox), py = t + Math.floor((y + 0.5) / scale + oy);
        const got = image.get(facetPointKey(px, py)) ?? background;
        let allowed: Set<number>;
        if (!colors.has(got) && got !== background) {
          allowed = new Set(); uncertain++;
          for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
            const neighbor = image.get(facetPointKey(px + dx, py + dy)) ?? background;
            if (colors.has(neighbor) || neighbor === background) allowed.add(neighbor);
          }
        } else allowed = new Set([got]);
        if (!allowed.has(value)) { mismatch = true; break; }
      }
      if (mismatch) break;
    }
    if (!mismatch) models.push({ scale: [...ratio], sample_offset: [ox, oy], uncertain_contour_samples: uncertain,
      claim: 'compatible_sampled_correspondence_not_exact_renderer_identification' });
  }
  return models;
}

export function facetCandidates(reference: NativeRows, stamp: NativeRows, faces: readonly FacetFace[],
  steps: ReadonlyMap<number, readonly [number, number]>, background: number, palette: readonly number[],
  maxUnits = 5, maxStates = 512, maxDenominator = 8, sampleOffsets: readonly number[] = [-0.5, 0, 0.5]): FacetSearchResult {
  type State = { placements: FacetPoint[]; actions: FacetStencilAction[] };
  let states: State[] = [{ placements: [[0, 0]], actions: [] }];
  const seen = new Set<string>(), results: FacetStencilSolution[] = []; let examined = 0;
  for (let count = 1; count <= maxUnits; count++) {
    const following: State[] = [];
    for (const state of states) {
      const image = facetRender(stamp, state.placements, background);
      const sortedPixels = [...image].map(([key, value]) => [key.split(',').map(Number), value] as const)
        .sort((a, b) => facetLexicographic(a[0], b[0]));
      const signature = JSON.stringify([sortedPixels, [...state.placements].sort(facetLexicographic)]);
      if (seen.has(signature)) continue;
      seen.add(signature); examined++;
      if (examined > maxStates) return { status: 'bounded_incomplete', examined: examined - 1, solutions: results };
      const fitted = facetCompare(reference, image, stamp, state.placements, background, palette, maxDenominator, sampleOffsets);
      if (fitted.length) { results.push({ ...state, comparisons: fitted }); continue; }
      if (count === maxUnits) continue;
      for (const origin of state.placements) for (const face of faces) {
        const step = steps.get(face.value);
        if (!step) continue;
        const destination: FacetPoint = [origin[0] + step[0], origin[1] + step[1]];
        if (state.placements.some(p => p[0] === destination[0] && p[1] === destination[1])) continue;
        const pixels = face.pixels.map(([x, y]): FacetPoint => [origin[0] + x, origin[1] + y]);
        if (pixels.some(([x, y]) => image.get(facetPointKey(x, y)) !== face.value)) continue;
        const action: FacetStencilAction = { owner_origin: [...origin], port_value: face.value, offset: [...step],
          destination: [...destination], point: [origin[0] + face.point[0], origin[1] + face.point[1]] };
        following.push({ placements: [...state.placements, destination], actions: [...state.actions, action] });
      }
    }
    if (results.length) return { status: 'compatible_minimal_within_model', examined, solutions: results,
      model_limit: 'No hidden duplicate origins; new stencil overlays measured visible support.' };
    states = following;
  }
  return { status: 'no_compatible_composition', examined, solutions: [] };
}
