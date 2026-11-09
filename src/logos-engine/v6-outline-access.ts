/** Native extension: approach one currently announced cell to inspect a
 * unique body/marker/perimeter correspondence. The morphological motif comes
 * from V5; neither its exact rejoin rule nor its selection order is changed.
 * This is one goal-directed experiment, never a planned or safe-floor route. */
import { detectV5Components, validateRows } from './v6-native-observer.ts';
import type { V5BoundingBox, V5Component } from './v6-native-observer.ts';
import type { NativeRows, NativeRecord } from './v6-native-types.ts';
import type { OutlineFields } from './v6-outline-geometry.ts';
import { compareUnicode } from './canonical.ts';
import { symbolicDigest } from './v6-hash.ts';

type Box = readonly [left: number, top: number, right: number, bottom: number];
type Delta = readonly [row: number, column: number];
type R = Record<string, any>;
interface ShapeParts { bodies: readonly V5Component[]; markers: readonly V5Component[]; perimeters: readonly V5Component[] }
interface Motif { body: V5Component; marker: V5Component; perimeter: V5Component; markerCell: Box; bodyOrigin: readonly [number, number]; announcement: Delta }
const ACCESS_GOAL = 'goal.accompany_mobile_entity_to_compatible_hollow_perimeter';
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const bbox = (value: unknown): Box | null => {
  if (Array.isArray(value) && value.length === 4 && value.every(Number.isSafeInteger)
    && value[0] <= value[2] && value[1] <= value[3]) return value as unknown as Box;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as V5BoundingBox; return bbox([v.left, v.top, v.right, v.bottom]);
  }
  return null;
};
const fromComponent = (component: V5Component): Box => [component.bbox.left, component.bbox.top, component.bbox.right, component.bbox.bottom];
const equalBox = (a: Box, b: Box): boolean => a.every((coordinate, index) => coordinate === b[index]);
const fits = (value: Box, rows: NativeRows): boolean => value[0] >= 0 && value[1] >= 0 && value[2] < rows[0]!.length && value[3] < rows.length;
const cardinal = ([dr, dc]: Delta): boolean => (dr === 0) !== (dc === 0);
const exactPerimeter = (component: V5Component, width: number, height: number): boolean => component.bbox.width === width && component.bbox.height === height
  && component.area === 2 * (width + height) - 4
  && component.relative_pixels.every(([row, col]) => row === 0 || col === 0 || row === height - 1 || col === width - 1);
const measuredComponent = (component: V5Component): R => ({ component_ref: component.component_id, bbox: fromComponent(component),
  value: component.value, area: component.area, pixels_sha256: symbolicDigest(component.pixels),
  qualification: 'current connected monochrome component; physical role remains hypothetical' });
const motionRows = (value: unknown): ReadonlyMap<string, Delta> | null => {
  if (!Array.isArray(value) || value.length > 64) return null;
  const result = new Map<string, Delta>();
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== 3 || !nonempty(row[0]) || !Number.isSafeInteger(row[1]) || !Number.isSafeInteger(row[2])) return null;
    const delta: Delta = [row[1], row[2]], old = result.get(row[0]);
    // Contradictory simultaneous mappings cannot provide a unique motion.
    if (old && (old[0] !== delta[0] || old[1] !== delta[1])) return null;
    result.set(row[0], delta);
  }
  return result;
};

function shapeParts(all: readonly V5Component[], width: number, height: number): ShapeParts | null {
  if (all.length > 512) return null;
  const components = all.filter(component => !component.touches_frame_boundary);
  const bodies = components.filter(component => component.bbox.width === width - 1 && component.bbox.height === height - 1
    && component.area === (width - 1) * (height - 1));
  const markers = components.filter(component => component.area === 1);
  const perimeters = components.filter(component => exactPerimeter(component, width, height));
  // Uniqueness is never obtained by dropping excess alternatives.
  return bodies.length > 64 || markers.length > 64 || perimeters.length > 64 ? null : { bodies, markers, perimeters };
}

function currentMotifs(parts: ShapeParts, rows: NativeRows, width: number, height: number, excluded: string | null): Motif[] | null {
  const motifs: Motif[] = [];
  for (const body of parts.bodies) for (const marker of parts.markers) {
    if (body.value !== marker.value) continue;
    const [row, col] = marker.pixels[0]!, dr = row - body.bbox.top, dc = col - body.bbox.left;
    if (!(dr === 0 && Math.abs(dc) === width || dc === 0 && Math.abs(dr) === height)) continue;
    const markerCell: Box = [col - 1, row - 1, col + width - 2, row + height - 2];
    if (!fits(markerCell, rows)) continue;
    const origin: readonly [number, number] = [body.bbox.left - 1, body.bbox.top - 1];
    for (const perimeter of parts.perimeters) {
      if (perimeter.component_id === excluded || perimeter.value !== body.value
        || (perimeter.bbox.left - origin[0]) % width || (perimeter.bbox.top - origin[1]) % height) continue;
      motifs.push({ body, marker, perimeter, markerCell, bodyOrigin: origin, announcement: [dr, dc] });
      if (motifs.length > 1) return null;
    }
  }
  return motifs;
}

/** Validate only the fixed-size component witness against its actual raster.
 * Prior interpretation cannot stand in for a currently visible component. */
function matchesMeasured(value: any, component: V5Component): boolean {
  const box = bbox(value?.bbox);
  return box !== null && value.component_ref === component.component_id && equalBox(box, fromComponent(component))
    && value.value === component.value && value.area === component.area && value.pixels_sha256 === symbolicDigest(component.pixels);
}

async function currentObservedBodyAccess(rows: NativeRows, fields: OutlineFields, current: ShapeParts,
  width: number, height: number, controlled: V5Component): Promise<R | null> {
  const context = fields.previous_public_transition, previous = fields.previous_action_observed_frame;
  if (!context || !Array.isArray(previous) || !Number.isSafeInteger(fields.current_level_epoch) || !Number.isSafeInteger(fields.current_revision)) return null;
  try { validateRows(previous); } catch { return null; }
  const before = context.before, after = context.after;
  if (!before || !after || !nonempty(before.observation_ref) || before.level_epoch !== fields.current_level_epoch
    || after.level_epoch !== fields.current_level_epoch || before.levels_completed !== after.levels_completed
    || !Number.isSafeInteger(before.revision) || before.revision + 1 !== after.revision || after.revision !== fields.current_revision
    || after.observation_ref !== fields.current_observation_ref || context.before_rows_sha256 !== symbolicDigest(previous)
    || context.after_rows_sha256 !== symbolicDigest(rows) || before.frame_hash !== context.before_rows_sha256.slice(0, 16)
    || after.frame_hash !== context.after_rows_sha256.slice(0, 16) || previous.length !== rows.length || previous[0]!.length !== rows[0]!.length) return null;
  const oldAll = (await detectV5Components(previous, 4)).components, old = shapeParts(oldAll, width, height);
  if (!old) return null;
  let priorBody: V5Component | null = null, priorPerimeter: V5Component | null = null, priorMarker: V5Component | null = null;
  let priorBasis: string, selectedProposal: string | null = null;
  const selected = context.selected_outline, retained = selected?.access_relation;
  if (retained) {
    const supportedKind = retained.kind === 'current_announced_cell_access_question' || retained.kind === 'current_observed_body_access_question';
    const expectedMeaning = retained.kind === 'current_announced_cell_access_question'
      ? 'native_current_announced_access_hypothesis' : 'native_current_observed_body_access_hypothesis';
    if (!supportedKind || retained.schema !== 'logos-engine.native.outline-announced-access.v1'
      || retained.observation_ref !== before.observation_ref || retained.current_rows_sha256 !== context.before_rows_sha256
      || !Array.isArray(retained.evidence_refs) || !retained.evidence_refs.includes(before.observation_ref)
      || selected.meaning_kind !== expectedMeaning || selected.active_goal_ref !== ACCESS_GOAL || selected.active_terminal_goal_ref !== ACCESS_GOAL
      || selected.guard_admitted !== true || selected.action_index !== 0 || !nonempty(selected.proposal_ref)
      || selected.observation_ref !== before.observation_ref || selected.level_epoch !== before.level_epoch || selected.frame_hash !== before.frame_hash
      || !nonempty(context.command?.action_ref) || retained.action_ref !== context.command.action_ref
      || selected.command?.action_ref !== context.command.action_ref
      || symbolicDigest(selected.command?.data ?? {}) !== symbolicDigest(context.command.data ?? {})) return null;
    const bodies = old.bodies.filter(component => matchesMeasured(retained.relation?.compact_body, component));
    const perimeters = old.perimeters.filter(component => matchesMeasured(retained.relation?.hollow_perimeter, component));
    const oldLeads = oldAll.filter(component => exactPerimeter(component, width, height) && matchesMeasured(retained.relation?.controlled_outline, component));
    if (bodies.length !== 1 || perimeters.length !== 1 || oldLeads.length !== 1
      || !bbox(retained.control_bbox) || !equalBox(bbox(retained.control_bbox)!, fromComponent(oldLeads[0]!))) return null;
    priorBody = bodies[0]!; priorPerimeter = perimeters[0]!;
    // The retained relation must still be unique in the actual previous frame.
    if (old.bodies.filter(component => component.value === priorBody!.value).length !== 1
      || old.perimeters.filter(component => component.value === priorBody!.value && component.component_id !== oldLeads[0]!.component_id).length !== 1) return null;
    if (retained.kind === 'current_announced_cell_access_question') {
      const markers = old.markers.filter(component => matchesMeasured(retained.relation?.cardinal_marker, component));
      if (markers.length !== 1) return null;
      const motifs = currentMotifs(old, previous, width, height, oldLeads[0]!.component_id);
      if (!motifs || motifs.length !== 1 || motifs[0]!.body !== priorBody || motifs[0]!.perimeter !== priorPerimeter || motifs[0]!.marker !== markers[0]) return null;
      priorMarker = markers[0]!;
    } else if (retained.relation?.cardinal_marker !== null || retained.marker_cell_bbox !== null) return null;
    priorBasis = 'actual_selected_access_relation_revalidated_against_previous_public_raster';
    selectedProposal = selected.proposal_ref;
  } else {
    const previousMotifs = currentMotifs(old, previous, width, height, null);
    if (!previousMotifs || previousMotifs.length !== 1) return null;
    priorBody = previousMotifs[0]!.body; priorPerimeter = previousMotifs[0]!.perimeter; priorMarker = previousMotifs[0]!.marker;
    priorBasis = 'unique_announced_relation_remeasured_in_previous_public_raster';
  }
  if (priorBody.value !== priorPerimeter.value) return null;
  const bodies = current.bodies.filter(component => component.value === priorBody!.value);
  const perimeters = current.perimeters.filter(component => component.value === priorPerimeter!.value && component.component_id !== controlled.component_id);
  if (bodies.length !== 1 || perimeters.length !== 1) return null;
  const body = bodies[0]!, perimeter = perimeters[0]!;
  const currentMarkers = current.markers.filter(marker => {
    if (marker.value !== body.value) return false;
    const [row, col] = marker.pixels[0]!, dr = row - body.bbox.top, dc = col - body.bbox.left;
    return dr === 0 && Math.abs(dc) === width || dc === 0 && Math.abs(dr) === height;
  });
  if (currentMarkers.length) return null; // An actually visible announcement belongs to the current-motif mode.
  const dr = body.bbox.top - priorBody.bbox.top, dc = body.bbox.left - priorBody.bbox.left;
  const unchanged = dr === 0 && dc === 0;
  const destinationMarkers = old.markers.filter(marker => marker.value === body.value && marker.pixels[0]![0] === body.bbox.top && marker.pixels[0]![1] === body.bbox.left);
  const sourceAnnouncement = !unchanged && dr % height === 0 && dc % width === 0
    && Math.abs(dr) / height + Math.abs(dc) / width === 1 && destinationMarkers.length === 1
    && old.bodies.filter(component => component.value === body.value
      && (body.bbox.top - component.bbox.top) % height === 0 && (body.bbox.left - component.bbox.left) % width === 0
      && Math.abs(body.bbox.top - component.bbox.top) / height + Math.abs(body.bbox.left - component.bbox.left) / width === 1).length === 1;
  if (!unchanged && !sourceAnnouncement) return null;
  const target: Box = [body.bbox.left - 1, body.bbox.top - 1, body.bbox.left + width - 2, body.bbox.top + height - 2];
  if (!fits(target, rows) || (perimeter.bbox.left - target[0]) % width || (perimeter.bbox.top - target[1]) % height) return null;
  return { body, perimeter, marker: null, bodyOrigin: [target[0], target[1]], target,
    temporal: { previous_observation_ref: before.observation_ref, current_observation_ref: after.observation_ref,
      level_epoch: after.level_epoch, previous_revision: before.revision, current_revision: after.revision,
      previous_rows_sha256: context.before_rows_sha256, current_rows_sha256: context.after_rows_sha256,
      relation_basis: priorBasis, selected_proposal_ref: selectedProposal,
      previous_body: measuredComponent(priorBody), previous_perimeter: measuredComponent(priorPerimeter),
      previous_cardinal_marker: priorMarker ? measuredComponent(priorMarker) : null,
      current_body_binding: unchanged ? 'same_exact_current_visible_body' : 'actual_previous_singleton_became_current_visible_body',
      current_body_delta_row_column: [dr, dc], current_marker_present: false,
      qualification: 'Only the actual immediately preceding public raster and the current solid body are used. A missing current marker is not reconstructed or treated as a future announcement.' } };
}

/** Current control can be reacquired from this epoch's translations, or be
 * the unique currently revalidated recalled hypothesis from V6.scope. Those
 * bases remain separate. Recalled controls require historical evidence and
 * use only revisable priors until a current translation is acquired.
 *
 * A missing current marker can use an exact adjacent public-transition
 * context, never an animation intermediate or a remembered future route. */
export async function measureOutlineAnnouncedAccess(rows: NativeRows, fields: OutlineFields): Promise<NativeRecord | null> {
  validateRows(rows);
  const available = fields.available_action_refs, evidence = fields.current_control_evidence_refs, observation = fields.current_observation_ref;
  const reacquired = fields.current_control_reacquired === true, recalled = !reacquired && fields.current_recalled_control_unique === true;
  const history = fields.historical_control_evidence_refs;
  if ((!reacquired && !recalled) || !nonempty(observation) || !Array.isArray(evidence) || !evidence.length
    || !evidence.every(nonempty) || !evidence.includes(observation) || !Array.isArray(available) || !available.length
    || !available.every(nonempty)) return null;
  if (recalled && (!Array.isArray(history) || !history.length || !history.every(nonempty))) return null;
  const terms = fields.canonical_provisional_control_term_facts, boxes = fields.canonical_provisional_control_geometry_bboxes;
  const outlines = fields.current_action_conditioned_control_outline_bboxes;
  if (!Array.isArray(terms) || terms.length !== 1 || !nonempty(terms[0]?.entity_ref)
    || !Array.isArray(boxes) || boxes.length !== 1 || !Array.isArray(outlines) || outlines.length !== 1) return null;
  const lead = bbox(boxes[0]), currentOutline = bbox(outlines[0]);
  if (!lead || !currentOutline || !equalBox(lead, currentOutline) || !fits(lead, rows)) return null;
  const width = lead[2] - lead[0] + 1, height = lead[3] - lead[1] + 1;
  if (width < 3 || height < 3 || width > 16 || height > 16) return null;
  const known = motionRows(fields.known_action_translation_deltas ?? []);
  const priors = motionRows(fields.interface_action_translation_deltas ?? []);
  if (!known || !priors || (reacquired && ![...known.entries()].some(([action, delta]) => available.includes(action)
    && cardinal(delta) && delta[0] % height === 0 && delta[1] % width === 0)) || (recalled && known.size !== 0)) return null;
  const all = (await detectV5Components(rows, 4)).components;
  if (all.length > 512) return null;
  const leads = all.filter(component => equalBox(fromComponent(component), lead) && exactPerimeter(component, width, height));
  if (leads.length !== 1 || leads[0]!.component_id !== terms[0].entity_ref) return null;
  const parts = shapeParts(all, width, height); if (!parts) return null;
  const motifs = currentMotifs(parts, rows, width, height, leads[0]!.component_id);
  if (!motifs) return null;
  const observed = motifs.length === 0 ? await currentObservedBodyAccess(rows, fields, parts, width, height, leads[0]!) : null;
  if (!motifs.length && !observed) return null;
  const motif = motifs[0], body: V5Component = motif?.body ?? observed!.body, perimeter: V5Component = motif?.perimeter ?? observed!.perimeter;
  const target: Box = motif?.markerCell ?? observed!.target, bodyOrigin: readonly [number, number] = motif?.bodyOrigin ?? observed!.bodyOrigin;
  if ((target[0] - lead[0]) % width || (target[1] - lead[1]) % height || equalBox(lead, target)) return null;
  const distance = (position: Box): number => Math.abs(target[0] - position[0]) / width + Math.abs(target[1] - position[1]) / height;
  const before = distance(lead), choices: R[] = [];
  for (const action of [...new Set(available as string[])].sort(compareUnicode)) {
    const observed = known.get(action), prior = priors.get(action);
    const delta: Delta | null = observed ?? (prior && cardinal(prior) ? [Math.sign(prior[0]) * height, Math.sign(prior[1]) * width] : null);
    // Observed contradictions are retained; a prior never overwrites them.
    if (!delta || !cardinal(delta) || delta[0] % height || delta[1] % width) continue;
    const afterBox: Box = [lead[0] + delta[1], lead[1] + delta[0], lead[2] + delta[1], lead[3] + delta[0]];
    if (!fits(afterBox, rows) || distance(afterBox) >= before) continue;
    choices.push({ action_ref: action, expected_delta: [delta[1], delta[0]], expected_body_bbox: afterBox,
      distance_after: distance(afterBox), motion_basis: observed ? 'current_observed_translation' : 'declared_revisable_interface_prior',
      observed_delta_row_column: observed ?? null, interface_prior_row_column: observed ? null : prior,
      motion_qualification: observed ? 'Measured in the current acquired control scope; the next displacement remains conditional.'
        : 'Unobserved direction uses the declared revisable interface sign and current outline dimensions; suspend on a differing public return.' });
  }
  if (!choices.length) return null;
  choices.sort((a, b) => a.distance_after - b.distance_after || compareUnicode(a.action_ref, b.action_ref));
  const selected = choices[0]!, bodyDistance = (x: number, y: number): number => Math.abs(perimeter.bbox.left - x) / width + Math.abs(perimeter.bbox.top - y) / height;
  const currentKind = motif ? 'current_announced_cell_access_question' : 'current_observed_body_access_question';
  const controlBasis = reacquired ? 'current_reacquired_control' : 'current_unique_revalidated_recalled_control_hypothesis';
  return {
    schema: 'logos-engine.native.outline-announced-access.v1', kind: currentKind,
    ...selected, observation_ref: observation, current_rows_sha256: symbolicDigest(rows), control_bbox: lead,
    control_binding_basis: controlBasis, historical_control_evidence_refs: recalled ? [...new Set(history as string[])] : [],
    marker_cell_bbox: motif ? target : null, body_cell_bbox: motif ? null : target, target_cell_bbox: target,
    target_basis: motif ? 'current_visible_cardinal_marker_cell' : 'current_visible_compact_body_cell',
    distance_before: before, relation_count: 1,
    relation: { controlled_outline: measuredComponent(leads[0]!), compact_body: measuredComponent(body),
      cardinal_marker: motif ? measuredComponent(motif.marker) : null, hollow_perimeter: measuredComponent(perimeter),
      body_origin: bodyOrigin, announced_delta_row_column: motif?.announcement ?? null,
      body_to_perimeter_distance: bodyDistance(bodyOrigin[0], bodyOrigin[1]),
      announced_body_to_perimeter_distance: motif ? bodyDistance(bodyOrigin[0] + motif.announcement[1], bodyOrigin[1] + motif.announcement[0]) : null,
      geometry_qualification: motif
        ? 'Exact current same-value compact body, cardinal one-cell marker and hollow perimeter on one lattice. Their functional correspondence remains a hypothesis.'
        : 'Current solid body and hollow perimeter remain unique. The previously observed relation is revalidated from one actual public transition; no current marker or future body motion is asserted.' },
    temporal_evidence: observed?.temporal ?? null,
    source_motif: { reference_commit: '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e',
      source_path: 'agents/yf_arc3_v5/capabilities/interaction.py',
      source_functions: ['_compact_body_perimeter_marker_accompaniment', '_adjacent_unmarked_compact_body_capture'],
      qualification: 'The body/marker/perimeter morphology and observed-announcement premise originate in V5. Approaching a current marker or a currently reidentified solid body is an explicit native extension, not the original V5 rejoin rule or full source selection.' },
    evidence_refs: [...new Set([...(evidence as string[]), ...(recalled ? history as string[] : []),
      ...(observed ? [observed.temporal.previous_observation_ref] : [])])], primitive_bound: 1, replan_after_each_primitive: true,
    release_authority: false, action_effect_known: false, route_safety_established: false,
    unknown: ['next_displacement', 'cell_passability', 'local_effect', 'autonomous_motion', 'functional_correspondence', 'terminal_rule'],
    qualification: motif
      ? 'Try one currently available direction reducing distance to the current announced cell, then reacquire the public scene. No future route, obstacle-color rule or guaranteed progress is supplied.'
      : 'Try one currently available direction toward the actual current body cell, then reacquire the public scene. Its prior relation motivates inspection but supplies no missing marker, future motion, route or guaranteed progress.',
  };
}
