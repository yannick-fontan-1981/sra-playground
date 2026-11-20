/** Bounded visible-stencil composition from pinned V6 facet_examples/stencils.py.
 * Every rational sampling alternative and the incomplete-search result survive. */
import { facetLexicographic, facetPointKey, type FacetPoint, type FacetTriple } from './v6-facet-examples-geometry.ts';
import type { NativeRows } from './v6-native-types.ts';

export type FacetImage = Map<string, number>;
export interface FacetFace { value: number; pixels: FacetPoint[]; point: FacetPoint }
export interface FacetStencilAction {
  owner_origin: FacetPoint; port_value: number; offset: FacetPoint; destination: FacetPoint; point: FacetPoint;
}
export interface FacetSamplingComparison {
  scale: FacetPoint; sample_offset: FacetPoint; uncertain_contour_samples: number;
  trimmed_contour?: FacetPoint;
  claim: 'compatible_sampled_correspondence_not_exact_renderer_identification';
}
export interface FacetStencilSolution {
  placements: FacetPoint[]; actions: FacetStencilAction[]; comparisons: FacetSamplingComparison[];
  paint_order?: number[];
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
export function facetRenderPrefix(stamp: NativeRows, solution: FacetStencilSolution, prefix: number,
  background: number, anchor: FacetPoint = [0, 0]): FacetImage {
  const placements = solution.paint_order
    ? solution.paint_order.filter(index => index < prefix).map(index => solution.placements[index]!)
    : solution.placements.slice(0, prefix);
  return facetRender(stamp, placements.map(([x, y]) => [x + anchor[0], y + anchor[1]]), background);
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

function fitsSampledSize(width: number, height: number, referenceWidth: number, referenceHeight: number,
  numerator: number, denominator: number, maximumExtra: number) {
  const extraWidth = Math.floor(width * numerator / denominator) - referenceWidth;
  const extraHeight = Math.floor(height * numerator / denominator) - referenceHeight;
  return extraWidth >= 0 && extraWidth <= maximumExtra && extraHeight >= 0 && extraHeight <= maximumExtra;
}

export function facetCompare(reference: NativeRows, image: ReadonlyMap<string, number>, stamp: NativeRows,
  placements: readonly (readonly [number, number])[], background: number, palette: readonly number[],
  maxDenominator = 8, sampleOffsets: readonly number[] = [-0.5, 0, 0.5], allowTrimmedContour = false): FacetSamplingComparison[] {
  const rh = reference.length, rw = reference[0]!.length, sh = stamp.length, sw = stamp[0]!.length;
  const l = Math.min(...placements.map(p => p[0])), t = Math.min(...placements.map(p => p[1]));
  const r = Math.max(...placements.map(p => p[0])) + sw - 1, b = Math.max(...placements.map(p => p[1])) + sh - 1;
  const width = r - l + 1, height = b - t + 1, ratios = new Map<string, FacetPoint>();
  // Fraction reduces equal rationals before the source sorts them by value.
  for (let d = 1; d <= maxDenominator; d++) for (let n = 1; n <= d; n++) {
    if (!fitsSampledSize(width, height, rw, rh, n, d, allowTrimmedContour ? 1 : 0)) continue;
    const divisor = gcd(n, d), ratio: FacetPoint = [n / divisor, d / divisor];
    ratios.set(`${ratio[0]}/${ratio[1]}`, ratio);
  }
  const possible = [...ratios.values()].sort((a, b) => a[0] * b[1] - b[0] * a[1]);
  const models: FacetSamplingComparison[] = [], colors = new Set(palette);
  for (const ratio of possible) for (const ox of sampleOffsets) for (const oy of sampleOffsets) {
    const scale = ratio[0] / ratio[1]; let mismatch = false, uncertain = 0;
    const sampledWidth = Math.floor(width * ratio[0] / ratio[1]), sampledHeight = Math.floor(height * ratio[0] / ratio[1]);
    for (let y = 0; y < sampledHeight; y++) {
      for (let x = 0; x < sampledWidth; x++) {
        const px = l + Math.floor((x + 0.5) / scale + ox), py = t + Math.floor((y + 0.5) / scale + oy);
        const got = image.get(facetPointKey(px, py)) ?? background;
        if (x >= rw || y >= rh) {
          if (colors.has(got)) { mismatch = true; break; }
          continue;
        }
        const value = reference[y]![x]!;
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
      ...(sampledWidth > rw || sampledHeight > rh ? { trimmed_contour: [sampledWidth - rw, sampledHeight - rh] } : {}),
      claim: 'compatible_sampled_correspondence_not_exact_renderer_identification' });
  }
  return models;
}

export function facetCandidates(reference: NativeRows, stamp: NativeRows, faces: readonly FacetFace[],
  steps: ReadonlyMap<number, readonly [number, number]>, background: number, palette: readonly number[],
  maxUnits = 5, maxStates = 512, maxDenominator = 8, sampleOffsets: readonly number[] = [-0.5, 0, 0.5],
  allowTrimmedContour = false): FacetSearchResult {
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
      const fitted = facetCompare(reference, image, stamp, state.placements, background, palette, maxDenominator, sampleOffsets, allowTrimmedContour);
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

export function facetLayeredCandidates(reference: NativeRows, stamp: NativeRows, faces: readonly FacetFace[],
  steps: ReadonlyMap<number, FacetPoint>, background: number, palette: readonly number[],
  maxUnits: number, maxStates: number, maxDenominator: number, sampleOffsets: readonly number[],
  workspace: FacetPoint): FacetSearchResult {
  type Extent = [number, number, number, number];
  type State = { units: FacetTriple[]; placements: FacetPoint[]; actions: FacetStencilAction[]; extent: Extent };
  const ports = faces.filter(face => steps.has(face.value)).sort((a, b) => facetLexicographic(a.point, b.point));
  // Exactly three distinct extrusion axes projecting to a closed triangle give
  // a viewing ray. Moving along all three axes returns to the same image origin.
  const displacements = ports.map(face => steps.get(face.value)!);
  const [a, b, c] = displacements;
  if (ports.length !== 3 || !a || !b || !c || a[0] * b[1] === a[1] * b[0]
    || a[0] + b[0] + c[0] !== 0 || a[1] + b[1] + c[1] !== 0) {
    return { status: 'no_compatible_composition', examined: 0, solutions: [] };
  }
  const stencil = stamp.flatMap((row, y) => row.flatMap((value, x) => value === background ? [] : [{ x, y, value }]));
  const stampWidth = stamp[0]!.length, stampHeight = stamp.length;
  const [xStride, yStride] = ([0, 1] as const).map(axis => displacements.reduce((stride, shift) => gcd(stride, Math.abs(shift[axis])), 0));
  const finalSizes = new Set<string>(), heightLimit = Array<number>(workspace[0] + 2).fill(0);
  const referenceWidth = reference[0]!.length, referenceHeight = reference.length;
  for (let width = stampWidth; width <= workspace[0]; width += xStride!) {
    for (let height = stampHeight; height <= workspace[1]; height += yStride!) {
      for (let d = 1; d <= maxDenominator; d++) for (let n = 1; n <= d; n++) {
        if (fitsSampledSize(width, height, referenceWidth, referenceHeight, n, d, 1)) {
          finalSizes.add(facetPointKey(width, height));
          heightLimit[width] = height;
        }
      }
    }
  }
  // Adding a unit can expand the rendered extent but cannot shrink it.
  for (let width = workspace[0]; width >= stampWidth; width--) {
    heightLimit[width] = Math.max(heightLimit[width]!, heightLimit[width + 1]!);
  }
  const unitKey = ([a, b, c]: FacetTriple) => (a * maxUnits + b) * maxUnits + c;
  const depth = ([a, b, c]: FacetTriple) => a + b + c;
  const paintOrder = (units: FacetTriple[]) => units.map((_, index) => index)
    .sort((i, j) => depth(units[i]!) - depth(units[j]!) || facetLexicographic(units[i]!, units[j]!));
  const facePixels = ports.map(face => {
    const distance = ([x, y]: FacetPoint) => (x - face.point[0]) ** 2 + (y - face.point[1]) ** 2;
    return face.pixels.filter(([x, y]) => stamp[y]?.[x] !== undefined && stamp[y]![x] !== background)
      .sort((a, b) => distance(a) - distance(b));
  });
  let states: State[] = [{ units: [[0, 0, 0]], placements: [[0, 0]], actions: [], extent: [0, 0, 0, 0] }];
  let examined = 0;
  for (let count = 1; count <= maxUnits && states.length; count++) {
    const solutions: FacetStencilSolution[] = [];
    for (const { units, placements, actions, extent: [left, top, right, bottom] } of states) {
      if (examined >= maxStates) return { status: 'bounded_incomplete', examined, solutions };
      examined++;
      if (!finalSizes.has(facetPointKey(right - left + stampWidth, bottom - top + stampHeight))) continue;
      const paint_order = paintOrder(units), image: FacetImage = new Map();
      for (const index of paint_order) {
        const [dx, dy] = placements[index]!;
        for (const { x, y, value } of stencil) image.set(facetPointKey(x + dx, y + dy), value);
      }
      const comparisons = facetCompare(reference, image, stamp, placements, background, palette, maxDenominator, sampleOffsets, true);
      if (comparisons.length) solutions.push({ placements, actions, comparisons, paint_order });
    }
    if (solutions.length) return { status: 'compatible_minimal_within_model', examined, solutions,
      model_limit: 'Distinct logical origins can share one projected origin; later checks verify each visible effect.' };
    if (count === maxUnits) break;
    const following: State[] = [], seen = new Set<string>();
    for (const { units, placements, actions, extent: [left, top, right, bottom] } of states) {
      const occupied = units.map(unitKey), order = paintOrder(units);
      for (const [index, origin] of placements.entries()) for (const [axis, face] of ports.entries()) {
        const unit = [...units[index]!] as FacetTriple;
        unit[axis] = unit[axis]! + 1;
        const id = unitKey(unit);
        if (occupied.includes(id)) continue;
        const key = [...occupied, id].sort((a, b) => a - b).join(',');
        if (seen.has(key)) continue;
        const offset = displacements[axis]!, destination: FacetPoint = [origin[0] + offset[0], origin[1] + offset[1]];
        const extent: Extent = [Math.min(left, destination[0]), Math.min(top, destination[1]),
          Math.max(right, destination[0]), Math.max(bottom, destination[1])];
        const width = extent[2] - extent[0] + stampWidth, height = extent[3] - extent[1] + stampHeight;
        if (height > (heightLimit[width] ?? 0)) continue;
        const front = order.slice(order.indexOf(index) + 1);
        const pixel = facePixels[axis]!.find(([x, y]) => front.every(other => {
          const [dx, dy] = placements[other]!;
          const ink = stamp[origin[1] + y - dy]?.[origin[0] + x - dx];
          return ink === undefined || ink === background;
        }));
        if (!pixel) continue;
        seen.add(key);
        const action: FacetStencilAction = { owner_origin: origin, port_value: face.value, offset, destination,
          point: [origin[0] + pixel[0], origin[1] + pixel[1]] };
        following.push({ units: [...units, unit], placements: [...placements, destination], actions: [...actions, action], extent });
      }
    }
    states = following;
  }
  return { status: 'no_compatible_composition', examined, solutions: [] };
}
