/** Portable measured stencils and conditional local compositions from pinned
 * V6 facet_examples/compound.py. Cached search results are not acquired state. */
import { sha256Bytes, symbolicDigest as identity } from './v6-hash.ts';
import { canonical as sourceCanonical, pythonEqual as equal } from './v6-operations.ts';
import { facetBackground, facetBox, facetCenter, facetCounts, facetInside, facetLexicographic, facetPointKey,
  facetRectangles, facetShape, type FacetPoint, type FacetProjection, type FacetTriple } from './v6-facet-examples-geometry.ts';
import { facetBounds, facetCandidates, facetImagePoints, facetRender,
  type FacetFace, type FacetImage, type FacetSearchResult, type FacetStencilSolution } from './v6-facet-examples-stencils.ts';
import type { NativeBox, NativeEntity, NativeObservation, NativeRecord, NativeRows } from './v6-native-types.ts';

export interface FacetCompoundConfiguration {
  maximum_units: number; maximum_states: number; lateral_rule: string;
  requires_observed_seed_and_vertical_effect_and_boundary: boolean; question: string;
  maximum_sample_denominator: number; sample_offsets: number[];
}
export interface FacetExampleModel {
  world: NativeBox; control: NativeBox; active_marker: number; parts: readonly NativeEntity[];
  stamp: number[][]; faces: FacetFace[]; background: number; palette: number[];
  unit_box: [number, number, number, number];
}
export interface FacetPortableMethod extends NativeRecord {
  schema: 'observed_2d_stencil_method.v1'; stamp: number[][]; faces: FacetFace[]; palette: number[];
  background: number; active_marker: number; cap_value: number; seed_face_shape: FacetPoint[];
  seed_support_size: FacetPoint; source_epoch: number; evidence: string[]; claim: string;
  up_shift?: FacetPoint; boundary_ref?: string;
}
export interface FacetReferenceGroup { box: [number, number, number, number]; rows: number[][] }
export interface FacetCompoundProjection {
  model_ref: string; prefix: number; anchor: FacetPoint; solution: FacetStencilSolution; source_method: FacetPortableMethod;
  port_status: string; palette: number[]; reference: FacetReferenceGroup; expected_colored_pixels: FacetTriple[];
  state_bound: number; falsifiers: string[]; limits: string[];
}
export type FacetCompoundCache = Map<string, FacetSearchResult>;
const sameImage = (a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): boolean =>
  a.size === b.size && [...a].every(([point, value]) => b.get(point) === value);
const colored = (image: ReadonlyMap<string, number>, palette: ReadonlySet<number>): FacetImage =>
  new Map([...image].filter(([, value]) => palette.has(value)));

export function facetExample(obs: NativeObservation, rows: NativeRows): FacetExampleModel | null {
  const frames = facetRectangles(obs);
  if (frames.length < 2) return null;
  frames.sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])
    - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));
  const world = frames[0]!.bbox, background = facetBackground(rows), found: FacetExampleModel[] = [];
  for (const control of frames.slice(1)) {
    if (facetInside(control.bbox, world)) continue;
    const parts = obs.entities.filter(e => facetInside(e.bbox, control.bbox)
      && ![background, control.palette_value, frames[0]!.palette_value].includes(e.palette_value) && e.area >= 3);
    if (parts.length < 3 || new Set(parts.map(e => e.palette_value)).size !== parts.length) continue;
    const [l, t, r, b] = facetBox(parts), unitbox: [number, number, number, number] = [l - 1, t - 1, r + 1, b + 1];
    if (!facetInside(unitbox, control.bbox)) continue;
    const stamp = rows.slice(t - 1, b + 2).map(row => [...row.slice(l - 1, r + 2)]);
    const faces = parts.map((e): FacetFace => ({ value: e.palette_value,
      pixels: facetShape(e).map(([x, y]): FacetPoint => [e.bbox[0] + x - l + 1, e.bbox[1] + y - t + 1]),
      point: [facetCenter(e)[0] - l + 1, facetCenter(e)[1] - t + 1] }));
    found.push({ world, control: control.bbox, active_marker: control.palette_value, parts, stamp, faces, background,
      palette: parts.map(e => e.palette_value).sort((a, b) => a - b), unit_box: unitbox });
  }
  return found.length === 1 ? found[0]! : null;
}

export function acquireFacetSeed(before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows,
  projection: FacetProjection): FacetPortableMethod | null {
  const model = facetExample(before, first);
  if (!model) return null;
  const colors = new Set(model.palette), parts = after.entities.filter(e => facetInside(e.bbox, model.world) && colors.has(e.palette_value));
  const counts = facetCounts(parts.map(e => e.palette_value));
  if (counts.size !== model.palette.length || model.palette.some(value => counts.get(value) !== 1)) return null;
  const [l, t] = facetBox(parts), anchor: FacetPoint = [l - 1, t - 1];
  const painted = colored(facetRender(model.stamp, [anchor], model.background), colors), actual: FacetImage = new Map();
  for (let y = model.world[1] + 1; y < model.world[3]; y++) for (let x = model.world[0] + 1; x < model.world[2]; x++) {
    const value = second[y]![x]!;
    if (colors.has(value)) actual.set(facetPointKey(x, y), value);
  }
  if (!sameImage(painted, actual)) return null;
  const support = projection.offer.support, cap = model.parts.find(e => equal(facetShape(e), facetShape(support)));
  if (!cap) return null;
  return { schema: 'observed_2d_stencil_method.v1', stamp: model.stamp, faces: model.faces, palette: model.palette,
    background: model.background, active_marker: model.active_marker, cap_value: cap.palette_value, seed_face_shape: facetShape(cap),
    seed_support_size: [cap.bbox[2] - cap.bbox[0] + 1, cap.bbox[3] - cap.bbox[1] + 1], source_epoch: before.level_epoch,
    evidence: [before.observation_ref, after.observation_ref],
    claim: 'pointing_a_congruent_empty_face_produced_this_visible_colored_stencil; outline_is_a_template_hypothesis' };
}

export function facetReferenceGroup(rows: NativeRows, model: FacetExampleModel): FacetReferenceGroup | null {
  const palette = new Set(model.palette), world = model.world, control = model.control, pending = new Map<string, FacetPoint>();
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y]!.length; x++) {
    if (palette.has(rows[y]![x]!) && !(world[0] <= x && x <= world[2] && world[1] <= y && y <= world[3])
      && !(control[0] <= x && x <= control[2] && control[1] <= y && y <= control[3])) pending.set(facetPointKey(x, y), [x, y]);
  }
  const groups: FacetPoint[][] = [];
  while (pending.size) {
    const first = [...pending.values()].sort(facetLexicographic)[0]!; pending.delete(facetPointKey(...first));
    const todo = [first], group: FacetPoint[] = [];
    while (todo.length) {
      const [x, y] = todo.pop()!; group.push([x, y]);
      for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
        const point: FacetPoint = [x + dx, y + dy], key = facetPointKey(...point);
        if (pending.has(key)) { pending.delete(key); todo.push(point); }
      }
    }
    const values = new Set(group.map(([x, y]) => rows[y]![x]!));
    if (values.size === palette.size && [...values].every(value => palette.has(value))) groups.push(group);
  }
  if (groups.length !== 1) return null;
  const [l, t, r, b] = facetBounds(groups[0]!);
  return { box: [l, t, r, b], rows: rows.slice(t, b + 1).map(row => [...row.slice(l, r + 1)]) };
}

/** Python json.dumps sorts integer dictionary keys numerically before encoding
 * them as strings. Configuration retains its authored fractional offsets. */
export function facetCompoundModelIdentity(stamp: NativeRows, reference: NativeRows,
  steps: ReadonlyMap<number, readonly [number, number]>, configuration: FacetCompoundConfiguration): string {
  const stepText = `{${[...steps].sort(([a], [b]) => a - b).map(([value, step]) => `${JSON.stringify(String(value))}:${sourceCanonical(step)}`).join(',')}}`;
  const text = `[${sourceCanonical(stamp)},${sourceCanonical(reference)},${stepText},${sourceCanonical(configuration)}]`;
  return sha256Bytes(new TextEncoder().encode(text));
}

export function facetCompoundPlan(obs: NativeObservation, rows: NativeRows, portable: FacetPortableMethod | null,
  cache: FacetCompoundCache, configuration: FacetCompoundConfiguration): FacetProjection | null {
  if (configuration.lateral_rule !== 'conditional_stencil_sharing_measured_face_edges'
    || configuration.requires_observed_seed_and_vertical_effect_and_boundary !== true) throw new Error('Unsupported compound stencil contract');
  if (!portable || !portable.up_shift?.length || !portable.boundary_ref) return null;
  const model = facetExample(obs, rows);
  if (!model || (['stamp', 'faces', 'palette', 'background', 'active_marker'] as const).some(key => !equal(model[key], portable[key]))) return null;
  const reference = facetReferenceGroup(rows, model);
  if (!reference) return null;
  const cap = model.faces.find(face => face.value === portable.cap_value);
  if (!cap) throw new Error('A portable stencil cap is absent from its revalidated example');
  const width = model.stamp[0]!.length, capHeight = Math.max(...cap.pixels.map(p => p[1])) - Math.min(...cap.pixels.map(p => p[1])) + 1;
  const steps = new Map<number, FacetPoint>([[cap.value, portable.up_shift]]);
  const statuses = new Map<number, string>([[cap.value, 'observed_previous_scope_revalidated_example']]);
  for (const face of model.faces) {
    if (face.value === cap.value) continue;
    if (face.point[0] === cap.point[0]) return null;
    // Floor is applied after the sign, exactly as Python's negative // does.
    steps.set(face.value, [Math.floor((face.point[0] < cap.point[0] ? -1 : 1) * (width - 1) / 2), Math.floor((capHeight + 1) / 2)]);
    statuses.set(face.value, 'shared_face_extrusion_hypothesis_not_observed');
  }
  const key = facetCompoundModelIdentity(model.stamp, reference.rows, steps, configuration);
  if (!cache.has(key)) cache.set(key, facetCandidates(reference.rows, model.stamp, model.faces, steps, model.background, model.palette,
    configuration.maximum_units, configuration.maximum_states, configuration.maximum_sample_denominator, configuration.sample_offsets));
  const result = cache.get(key)!;
  if (result.status !== 'compatible_minimal_within_model' || result.solutions.length !== 1) return null;
  const solution = result.solutions[0]!, world = model.world, palette = new Set(model.palette), actual: FacetImage = new Map();
  for (let y = world[1] + 1; y < world[3]; y++) for (let x = world[0] + 1; x < world[2]; x++) {
    const value = rows[y]![x]!;
    if (palette.has(value)) actual.set(facetPointKey(x, y), value);
  }
  let support: NativeEntity, anchor: FacetPoint, point: FacetPoint, prefix: number, kind: string, claim: string;
  if (!actual.size) {
    const full = facetRender(model.stamp, solution.placements, model.background), [l, t, r, b] = facetBounds(facetImagePoints(full));
    const seeds: { margin: number; centered: number; entity: NativeEntity; anchor: FacetPoint }[] = [];
    for (const entity of obs.entities) {
      if (entity.palette_value !== model.background || !facetInside(entity.bbox, world) || !equal(facetShape(entity), portable.seed_face_shape)) continue;
      const seedAnchor: FacetPoint = [entity.bbox[0] - Math.min(...cap.pixels.map(p => p[0])), entity.bbox[1] - Math.min(...cap.pixels.map(p => p[1]))];
      const margin = Math.min(seedAnchor[0] + l - world[0] - 1, seedAnchor[1] + t - world[1] - 1,
        world[2] - seedAnchor[0] - r - 1, world[3] - seedAnchor[1] - b - 1);
      if (margin < 1) continue;
      seeds.push({ margin, centered: -Math.abs(2 * seedAnchor[0] + l + r - world[0] - world[2]), entity, anchor: seedAnchor });
    }
    if (!seeds.length) return null;
    const rank = (seed: typeof seeds[number]): number[] => [seed.margin, seed.centered, -seed.entity.bbox[0]];
    let selected = seeds[0]!;
    for (const seed of seeds.slice(1)) if (facetLexicographic(rank(seed), rank(selected)) > 0) selected = seed;
    support = selected.entity; anchor = selected.anchor; point = facetCenter(support); prefix = 0;
    kind = 'recall_seed_for_compound_reference'; claim = 'observed_seed_method_revalidated_here';
  } else {
    const matches: [number, FacetPoint][] = [], [al, at] = facetBounds(facetImagePoints(actual));
    for (let index = 1; index <= solution.placements.length; index++) {
      const image = colored(facetRender(model.stamp, solution.placements.slice(0, index), model.background), palette);
      const [l, t] = facetBounds(facetImagePoints(image)), candidateAnchor: FacetPoint = [al - l, at - t];
      const placed: FacetImage = new Map([...image].map(([pointKey, value]) => {
        const [x, y] = pointKey.split(',').map(Number) as FacetPoint;
        return [facetPointKey(x + candidateAnchor[0], y + candidateAnchor[1]), value];
      }));
      if (sameImage(placed, actual)) matches.push([index, candidateAnchor]);
    }
    if (matches.length !== 1) return null;
    [prefix, anchor] = matches[0]!;
    if (prefix === solution.placements.length) return null;
    const action = solution.actions[prefix - 1]!;
    point = [anchor[0] + action.point[0], anchor[1] + action.point[1]];
    claim = statuses.get(action.port_value)!; kind = 'probe_compound_continuation';
    const found = obs.entities.find(e => e.palette_value === action.port_value
      && facetShape(e).some(([x, y]) => x === point[0] - e.bbox[0] && y === point[1] - e.bbox[1]));
    if (!found) return null;
    support = found;
  }
  const scope = identity([obs.level_epoch, world, model.control, reference.box, reference.rows, key]);
  const relativeNext = solution.placements.slice(0, prefix + 1);
  const predicted = facetRender(model.stamp, relativeNext.map(([x, y]): FacetPoint => [x + anchor[0], y + anchor[1]]), model.background);
  const predictedColors: FacetTriple[] = [...predicted].filter(([, value]) => palette.has(value)).map(([key, value]) => {
    const [x, y] = key.split(',').map(Number) as FacetPoint; return [x, y, value];
  });
  predictedColors.sort(facetLexicographic);
  return { world, example_box: model.control, example_parts: model.parts, reference_parts: [], scale_hypothesis: null, scope_ref: scope,
    observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
    compound: { model_ref: key, prefix, anchor, solution, source_method: portable, port_status: claim,
      palette: model.palette, reference, expected_colored_pixels: predictedColors, state_bound: result.examined,
      falsifiers: ['whole_current_visible_render_differs', 'local_edit_not_predicted_stencil', 'other_interface_changes', 'final_visible_correspondence_without_score'],
      limits: ['bounded_2d_stencils_not_hidden_3d_occupancy', 'contour_sampling_alternatives_retained', 'lateral_offsets_are_conditional_until_observed'] },
    offer: { kind, point, support, assumptions: [claim, 'new_stencil_overlays_visible_support'],
      risks: ['return_not_proven', 'reference_sampling_uncertain', 'owner_is_visible_support_not_hidden_voxel'] } };
}
