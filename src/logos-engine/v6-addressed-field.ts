/** Literal consumed port of common_addressed_field.py at the pinned V6 source.
 * The calibrated field is conditional: a transient contour is not a range law,
 * a centered homologue is not an official goal, and an interrupted search is
 * never an acquired counterexample. */
import { ObservedInputDomain } from './v6-native-observer.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { supportResidualCorrespondences, supportUnchanged } from './v6-support-measurements.ts';
import { FieldStock } from './v6-field-stock.ts';
import { addressedClone as clone, addressedCompare as compare, addressedContains as contains,
  addressedDigest as digest, addressedEqual as equal, addressedFilled as filled, addressedKey as key,
  type AddressedRecord as R, type AddressedPoint as Point, type AddressedWork } from './v6-addressed-material-common.ts';
import type { NativeAfterResult, NativeBeforeResult, NativeCommand, NativeExecution, NativeMaybePromise, NativeObservation,
  NativePublicObservation, NativeRows } from './v6-native-types.ts';

export interface AddressedFieldPolicy extends R { enabled: boolean }
export const ADDRESSED_FIELD_SOURCE_POLICY: AddressedFieldPolicy = Object.freeze({
  enabled: true,
  identity: 'Retain unchanged same-signature occurrences, then compare one residual visible shape. Multiple residuals and insufficient visible support remain ambiguous; revealed or covered guide pixels do not establish motion.',
  applicability: 'A pointed input relocates one bounded rectangular occurrence onto its anchor while a same-shape exemplar remains stationary. A centered enclosed homologue supplies a goal hypothesis.',
  experiments: 'First distinguish click alignment, fixed displacement, bounded approach and no effect with a non-collinear offset at the same measured support distance. A contracting graphic supplies probe locations only; compare stable responses just outside and on its measured extent before using a range interval.',
  planning: 'Compose a conditional access through points inside the empirically accepted support-distance bound. Isotropy and monotonic locality are explicit revisable hypotheses. Preserve exemplar and goal observations; revalidate the actual receiver at every step.',
  domain: 'A bounded derived locus may supplement occurrence-centroid samples through an exact public support pixel, provenance and per-step pixel guard. The locus is a question, without an asserted outcome.',
  scope: 'Single observed receiver and visible homologous enclosure. Type synthesis, several simultaneously affected receivers and interactions remain open until separately observed.',
});

export const center = (box: readonly number[]): Point => [(box[0]! + box[2]!) / 2, (box[1]! + box[3]!) / 2];
export function support(entity: R): Set<string> {
  const [x, y] = entity.position;
  return new Set((entity.mask as Point[]).map(([dx, dy]) => key([x + dx, y + dy])));
}
export function distanceSquared(point: Point, pixels: Iterable<string | Point>, work?: AddressedWork): number {
  let distance = Infinity;
  for (const item of pixels) { work?.tick(); const [x, y] = typeof item === 'string' ? JSON.parse(item) as Point : item;
    distance = Math.min(distance, (point[0] - x) ** 2 + (point[1] - y) ** 2); }
  if (distance === Infinity) throw new RangeError('Addressed support is empty');
  return distance;
}
export function targetCandidates(observation: R, mobile: R, rows: NativeRows, work?: AddressedWork): R[] {
  const result: R[] = [], pattern = new Set((mobile.mask as Point[]).map(key));
  for (const shadow of observation.entities as R[]) {
    work?.tick(); const shadowPattern = new Set((shadow.mask as Point[]).map(key));
    if (shadow.palette_value === mobile.palette_value || shadowPattern.size !== pattern.size || [...shadowPattern].some(p => !pattern.has(p))) continue;
    for (const enclosure of observation.entities as R[]) {
      work?.tick(); const [left, top, right, bottom] = enclosure.bbox;
      if (left === 0 || top === 0 || right === rows[0]!.length - 1 || bottom === rows.length - 1) continue;
      if (!contains(enclosure.bbox, shadow.bbox) || !equal(center(enclosure.bbox), center(shadow.bbox)) || equal(enclosure.bbox, shadow.bbox)) continue;
      const wall = new Set((enclosure.mask as Point[]).map(key)), inside = filled(wall, right - left + 1, bottom - top + 1, work);
      for (const p of wall) inside.delete(p);
      if ([...support(shadow)].every(p => { const [x, y] = JSON.parse(p) as Point; return inside.has(key([x - left, y - top])); })) result.push({ shadow, enclosure });
    }
  }
  return result;
}
/** Public animation pixels only; the measured contour never supplies a law. */
export function transientContour(first: NativeRows, frames: readonly NativeRows[] | null | undefined, point: Point): R | null {
  if (!frames?.length) return null;
  const changes = new Map<number, Point[]>();
  for (let y = 0; y < frames[0]!.length; y++) for (let x = 0; x < frames[0]![y]!.length; x++) {
    const value = frames[0]![y]![x]!;
    if (value !== first[y]![x]) { if (!changes.has(value)) changes.set(value, []); changes.get(value)!.push([x, y]); }
  }
  const candidates: R[] = [];
  for (const [value, pixels] of changes) {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [x, y] of pixels) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
    if (right - left !== bottom - top || left + right !== 2 * point[0] || top + bottom !== 2 * point[1]) continue;
    if (right - left < 2 || pixels.some(([x, y]) => frames.at(-1)![y]![x] === value)) continue;
    candidates.push({ palette: value, axis_extent: Math.floor((right - left) / 2), first_box: [left, top, right, bottom], transient_pixels: pixels.length,
      qualification: 'transient graphic only; physical influence remains a separate hypothesis' });
  }
  return candidates.reduce<R | null>((best, item) => !best || item.transient_pixels > best.transient_pixels ? item : best, null);
}

export class AddressedField {
  readonly policy: AddressedFieldPolicy;
  epoch: number | null = null; model: R | null = null; samples: R[] = []; indicator: R | null = null;
  lower_squared = 0; upper_squared: number | null = null; calibration = 'different_offset'; events: R[] = []; passed: R[] = [];
  prior: R | null = null; stock: FieldStock | null = null;
  protected stateRevision = 0;
  constructor(policy: AddressedFieldPolicy = ADDRESSED_FIELD_SOURCE_POLICY) {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy) || typeof policy.enabled !== 'boolean') throw new TypeError('Invalid addressed field policy');
    this.policy = retainNativeJson(policy);
  }
  protected changed(): void { this.stateRevision++; }
  ensureStock(observation: R, rows: NativeRows, work?: AddressedWork): FieldStock | null {
    if (this.model === null && this.prior && this.stock === null) {
      const stock = FieldStock.create(this.prior, observation, rows, work);
      if (stock !== null) { this.stock = stock; this.changed(); }
    }
    return this.stock;
  }
  preservationObligations(observation: R, rows: NativeRows): R[] {
    const stock = this.ensureStock(observation, rows); return stock ? stock.preservationObligations(observation, rows) : [];
  }
  body(observation: R): R | null {
    if (!this.model) return null;
    const model = this.model, candidates = (observation.entities as R[]).filter(entity => entity.signature === model.signature && equal(entity.position, model.position));
    return candidates.length === 1 ? candidates[0]! : null;
  }
  fit(before: R, after: R, command: R, first: NativeRows, second: NativeRows, frames?: readonly NativeRows[]): void {
    const point = command.data ?? {};
    if (!equal(Object.keys(point).sort(), ['x', 'y'])) return;
    const comparison = supportResidualCorrespondences(before, after, first, second), options: { candidate: R; goal: R; offset: Point; size: Point }[] = [];
    for (const candidate of comparison.candidates as R[]) {
      const old = candidate.before, next = candidate.after;
      if (!old.rectangular || !candidate.stationary_same_signature.length) continue;
      const goals = targetCandidates(before, old, first);
      if (goals.length !== 1) continue;
      const offset: Point = [point.x - next.position[0], point.y - next.position[1]], width = next.bbox[2] - next.bbox[0] + 1, height = next.bbox[3] - next.bbox[1] + 1;
      if (!(0 <= offset[0] && offset[0] < width && 0 <= offset[1] && offset[1] < height)) continue;
      options.push({ candidate, goal: goals[0]!, offset, size: [width, height] });
    }
    if (options.length !== 1) return;
    const { candidate, goal, offset, size } = options[0]!, old = candidate.before, next = candidate.after;
    this.changed();
    this.model = { signature: next.signature, palette: next.palette_value, mask: retainNativeJson(next.mask), size: retainNativeJson(size), offset: retainNativeJson(offset),
      position: retainNativeJson(next.position), exemplar: retainNativeJson(candidate.stationary_same_signature[0]), goal: retainNativeJson(goal), action_ref: command.action_ref, source_ref: before.observation_ref };
    this.indicator = retainNativeJson(transientContour(first, frames, [point.x, point.y]));
    this.events.push(retainNativeJson({ kind: 'addressed_field_candidate', before: before.observation_ref, after: after.observation_ref,
      mobile_before: old.bbox, mobile_after: next.bbox, stationary_exemplar: this.model.exemplar.bbox, goal_shadow: goal.shadow.bbox,
      identity: candidate.identity_status, unresolved_residual_count: comparison.unresolved.length, indicator: this.indicator, goal_status: 'centered_homologue_hypothesis' }));
  }
  /** Exact source return, including truthy unresolved envelopes with events=[]. */
  recordSource(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal?: R, _index?: number, frames?: readonly NativeRows[]): R {
    this.changed(); this.events = [];
    if (this.epoch !== before.level_epoch) {
      this.model = null; this.samples = []; this.indicator = null; this.lower_squared = 0; this.upper_squared = null; this.calibration = 'different_offset'; this.epoch = before.level_epoch;
    }
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed) {
      if (after.levels_completed > before.levels_completed) {
        if (this.stock) {
          this.prior = retainNativeJson(this.stock.retainedHypotheses(after.observation_ref));
          this.passed.push(retainNativeJson({ score: after.levels_completed, evidence: after.observation_ref }));
        } else if (this.model) {
          this.passed.push(retainNativeJson({ score: after.levels_completed, evidence: after.observation_ref }));
          const enclosure = this.model.goal.enclosure, [left, top, right, bottom] = enclosure.bbox, size: Point = [right - left + 1, bottom - top + 1];
          this.prior = retainNativeJson({ action_ref: this.model.action_ref, lower_squared: this.lower_squared, upper_squared: this.upper_squared, boundary: after.observation_ref,
            request_row: Math.trunc(center(this.model.exemplar.bbox)[1]),
            goal_region: { size, envelope: [...filled(new Set((enclosure.mask as Point[]).map(key)), ...size)].map(p => JSON.parse(p)).sort(compare) },
            class_templates: { [String(this.model.palette)]: { size: this.model.size, offset: this.model.offset, mask: this.model.mask,
              alignment_supported: this.samples.filter(sample => sample.moved_to_anchor).length >= 2 } },
            qualification: 'retained local hypothesis; new occurrence and field require revalidation' });
        }
      }
      this.model = null; this.stock = null; this.epoch = after.level_epoch; this.samples = []; this.indicator = null;
      this.lower_squared = 0; this.upper_squared = null; this.calibration = 'different_offset';
      return { status: 'field_official_boundary', events: this.events, official_boundary: after.levels_completed };
    }
    const stock = this.ensureStock(before, first);
    if (stock) { const result = stock.record(before, after, command, first, second, proposal, _index); this.events = result.events; return result; }
    if (!this.model) this.fit(before, after, command, first, second, frames);
    if (!this.model || command.action_ref !== this.model.action_ref || !equal(Object.keys(command.data ?? {}).sort(), ['x', 'y'])) return { status: 'field_unresolved', events: this.events };
    const model = this.model, priorCandidates = (before.entities as R[]).filter(entity => entity.signature === model.signature && !supportUnchanged(entity, after));
    const old = priorCandidates.length === 1 ? priorCandidates[0]! : this.body(before);
    if (old === null) return { events: this.events, status: 'occurrence_unresolved' };
    const same = (after.entities as R[]).filter(entity => entity.signature === old.signature && equal(entity.bbox, old.bbox));
    let next: R;
    if (same.length) next = same[0]!;
    else {
      const comparison = supportResidualCorrespondences(before, after, first, second), matches = (comparison.candidates as R[]).filter(item => equal(item.before.bbox, old.bbox)).map(item => item.after);
      if (matches.length !== 1) return { events: this.events, status: 'occurrence_unresolved' };
      next = matches[0]!;
    }
    const point: Point = [command.data.x, command.data.y], anchor: Point = [next.position[0] + model.offset[0], next.position[1] + model.offset[1]],
      moved = !equal(next.position, old.position), distance = distanceSquared(point, support(old)), aligned = equal(anchor, point) && moved;
    if (aligned) this.lower_squared = Math.max(this.lower_squared, distance);
    else if (!moved && distance > this.lower_squared) this.upper_squared = this.upper_squared === null ? distance : Math.min(this.upper_squared, distance);
    else {
      this.events.push(retainNativeJson({ kind: 'addressed_field_counterexample', before: before.observation_ref, after: after.observation_ref,
        point, actual_anchor: anchor, scope: 'alignment_hypothesis_refuted' })); this.model = null;
      return { status: 'field_refuted', events: this.events };
    }
    const sample = retainNativeJson({ before: before.observation_ref, after: after.observation_ref, point, old_position: old.position, new_position: next.position,
      distance_squared: distance, moved_to_anchor: aligned, stationary: !moved });
    this.samples.push(sample); this.events.push(retainNativeJson({ kind: 'addressed_field_response', ...sample }));
    if (proposal?.field_plan?.rival_predictions && Object.keys(proposal.field_plan.rival_predictions).length) {
      const rivals = proposal.field_plan.rival_predictions;
      this.events.push(retainNativeJson({ kind: 'field_rival_comparison', observation: after.observation_ref, actual_anchor: anchor,
        compatible: Object.keys(rivals).filter(name => equal(rivals[name], anchor)), refuted_here: Object.keys(rivals).filter(name => !equal(rivals[name], anchor)) }));
    }
    model.position = retainNativeJson(next.position);
    if (proposal?.field_plan && Object.keys(proposal.field_plan).length) {
      const experiment = proposal.field_plan.experiment;
      if (experiment === 'different_offset') this.calibration = aligned && this.indicator ? 'outside_indicator' : 'navigation';
      else if (experiment === 'outside_indicator') this.calibration = !moved ? 'indicator_edge' : 'navigation';
      else if (experiment === 'indicator_edge') this.calibration = 'navigation';
    }
    return { status: 'field_response_recorded', events: this.events };
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal?: R, index?: number, frames?: readonly NativeRows[]): R {
    return this.recordSource(before, after, command, first, second, proposal, index, frames);
  }
  pointOptions(rows: NativeRows, pose: Point, lower: number, equalDistance = false, work?: AddressedWork): Point[] {
    const [width, height] = this.model!.size, [ox, oy] = this.model!.offset,
      pixels = (this.model!.mask as Point[]).map(([x, y]): Point => [pose[0] + x, pose[1] + y]), options: Point[] = [];
    for (let y = oy; y < rows.length - height + oy + 1; y++) for (let x = ox; x < rows[0]!.length - width + ox + 1; x++) {
      work?.node(); const distance = distanceSquared([x, y], pixels, work);
      if (equalDistance ? distance === lower : 0 < distance && distance <= lower) options.push([x, y]);
    }
    return options;
  }
  propose(observation: R, rows: NativeRows, inputs: readonly NativeCommand[] | readonly R[], remaining: number, _execution?: NativeExecution): Promise<R | null> {
    return this.proposeSource(observation, rows, inputs, remaining);
  }
  async proposeSource(observation: R, rows: NativeRows, _inputs: readonly NativeCommand[] | readonly R[], remaining: number, work?: AddressedWork): Promise<R | null> {
    if (!this.policy.enabled || remaining <= 0) return null;
    const stock = this.ensureStock(observation, rows, work);
    if (stock) return stock.propose(observation, rows, remaining, work);
    if (!this.policy.enabled || !this.model || remaining <= 0) return null;
    const body = this.body(observation), model = this.model;
    if (body === null || !observation.available_action_refs.includes(model.action_ref)) return null;
    const offset: Point = model.offset, pose: Point = body.position, anchor: Point = [pose[0] + offset[0], pose[1] + offset[1]], shadow = model.goal.shadow,
      target: Point = [shadow.position[0] + offset[0], shadow.position[1] + offset[1]], experiment = this.calibration;
    let alternatives: Point[] = [], points: Point[], why: string;
    const toward = (point: Point): number => (point[0] - target[0]) ** 2 + (point[1] - target[1]) ** 2;
    if (experiment === 'different_offset') {
      const first = this.samples[0]!, original: Point = [first.new_position[0] - first.old_position[0], first.new_position[1] - first.old_position[1]];
      points = this.pointOptions(rows, pose, first.distance_squared, true, work).filter(point =>
        Math.max(Math.abs(point[0] - anchor[0]), Math.abs(point[1] - anchor[1])) > Math.max(...original.map(Math.abs)) && toward(point) < toward(anchor));
      if (!points.length) return null;
      let best = Infinity; for (const point of points) best = Math.min(best, toward(point));
      alternatives = points.filter(point => toward(point) === best).sort(compare); points = [alternatives[0]!];
      why = 'Contrast click alignment with the former displacement and an axis-limited approach at another bound locus.';
    } else if (experiment === 'outside_indicator' || experiment === 'indicator_edge') {
      const radius = this.indicator!.axis_extent, axis = Math.abs(target[0] - anchor[0]) >= Math.abs(target[1] - anchor[1]) ? 0 : 1,
        direction = target[axis] >= anchor[axis] ? 1 : -1, reach = direction > 0 ? model.size[axis] - 1 - offset[axis] : offset[axis],
        delta = radius + reach + Number(experiment === 'outside_indicator'), point: [number, number] = [anchor[0], anchor[1]];
      point[axis] += direction * delta;
      if (!(radius <= point[0] && point[0] < rows[0]!.length - radius && radius <= point[1] && point[1] < rows.length - radius)) return null;
      points = [point]; why = 'Test the transient graphic boundary against a stable receiver response; the graphic alone does not establish range.';
    } else {
      points = []; let projected = pose;
      for (let i = 0; i < Math.min(16, remaining); i++) {
        await work?.yield(); const current: Point = [projected[0] + offset[0], projected[1] + offset[1]];
        if (equal(current, target)) break;
        const options = this.pointOptions(rows, projected, this.lower_squared, false, work).filter(point => toward(point) < toward(current));
        if (!options.length) break;
        const point = options.reduce((best, item) => compare([toward(item), item], [toward(best), best]) < 0 ? item : best);
        points.push(point); projected = [point[0] - offset[0], point[1] - offset[1]];
      }
      why = 'Compose conditional locally supported field accesses toward the centered homologous enclosure.';
    }
    if (!points.length) return null;
    const steps: R[] = []; let projected = pose;
    const evidence = [observation.observation_ref, ...this.samples.slice(-3).map(sample => sample.after)];
    for (const [index, point] of points.entries()) {
      await work?.yield(); const action = { action_ref: model.action_ref, data: { x: point[0], y: point[1] } },
        destination: Point | null = experiment === 'navigation' ? [point[0] - offset[0], point[1] - offset[1]] : null,
        witness = await ObservedInputDomain.makeLocusWitness(observation as NativeObservation, rows, point, { reason: why, evidence });
      work?.check(); steps.push({ action, from: projected, to: destination, locus_witness: witness,
        expected_before: { level_epoch: observation.level_epoch, frame_hash: index === 0 ? observation.frame_hash : null },
        expected_after: { position: destination, question: experiment } });
      if (destination !== null) projected = destination;
    }
    const actions = steps.map(step => step.action), reference = 'C_field_' + digest([observation.observation_ref, actions]).slice(0, 16),
      facts = { visible_residual_occurrence_bound: true, stationary_same_shape_reference: true, field_law_is_conditional: true, goal_role_is_hypothesis: true }, frozenModel = clone(model);
    frozenModel.goal.enclosure = Object.fromEntries(Object.entries(frozenModel.goal.enclosure).filter(([name]) => ['id', 'signature', 'bbox', 'palette_value'].includes(name)));
    const rivals: R = {};
    if (experiment !== 'navigation') {
      const first = this.samples[0]!, oldDelta: Point = [first.new_position[0] - first.old_position[0], first.new_position[1] - first.old_position[1]], point = points[0]!, limit = oldDelta.map(Math.abs);
      Object.assign(rivals, { click_alignment: point, fixed_displacement: [anchor[0] + oldDelta[0], anchor[1] + oldDelta[1]],
        former_axis_limited_approach: [0, 1].map(i => anchor[i]! + Math.max(-limit[i]!, Math.min(limit[i]!, point[i]! - anchor[i]!))), no_effect: anchor });
      if (this.indicator) rivals.graphic_extent_as_range = distanceSquared(point, support(body), work) <= this.indicator.axis_extent ** 2 ? point : anchor;
      steps[0]!.expected_after.rival_anchors = rivals;
    }
    const plan = { experiment, steps, model: frozenModel, alternatives, rival_predictions: rivals, accepted_distance_squared: this.lower_squared,
      rejected_distance_squared: this.upper_squared, falsifiers: ['mobile does not reach predicted anchor', 'reference changes', 'unpredicted type or multiplicity change'],
      rivals: ['local alignment', 'fixed displacement', 'bounded approach', 'no effect outside an unknown domain'] };
    return { status: 'proposed', kind: 'addressed_local_field', field_plan: plan, actions, steps, facts,
      compositions: [{ id: reference, role: 'information_question', observed: false, open_question: why, properties: { terminal_relevance: 'hypothesized_homologue' }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: reference, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why,
        preconditions: facts, evidence, actions, frozen_field_plan: clone(plan), outcome_guard: { path: ['value'], contains: reference } } };
  }
  bind(proposal: R, _domain: ObservedInputDomain): void { for (const step of proposal.steps) step.point_binding = step.locus_witness; }
  static footprintMatches(rows: NativeRows, model: R, position: Point): boolean {
    const [x, y] = position;
    return (model.mask as Point[]).every(([dx, dy]) => 0 <= y + dy && y + dy < rows.length && 0 <= x + dx && x + dx < rows[0]!.length && rows[y + dy]![x + dx] === model.palette);
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation | R, observation: R): NativeMaybePromise<NativeBeforeResult> {
    if (proposal.field_plan.stock) return this.stock!.before(proposal, index, publicPacket, observation) as NativeBeforeResult;
    const model = proposal.field_plan.model, step = proposal.steps[index], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed
      && (index > 0 || observation.observation_ref === bound.observation_ref) && publicPacket.available_action_refs.includes(step.action.action_ref)
      && AddressedField.footprintMatches(publicPacket.frame_rows, model, step.from)
      && [model.exemplar, model.goal.shadow].every(entity => [...support(entity)].every(p => { const [x, y] = JSON.parse(p) as Point; return publicPacket.frame_rows[y][x] === entity.palette_value; }));
    return { admitted: Boolean(ok), reason: ok ? 'measured_receiver_reference_and_address_bound' : 'field_receiver_or_reference_changed' };
  }
  after(proposal: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): NativeMaybePromise<NativeAfterResult> {
    if (proposal.field_plan.stock) return this.stock!.after(proposal, index, before, after, first, second) as NativeAfterResult;
    if (before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || before.state !== after.state)
      return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const target = proposal.steps[index].to, matched = target === null ? null : AddressedField.footprintMatches(second, proposal.field_plan.model, target);
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_stable_receiver_with_frozen_field_prediction' };
  }
  sourceState(): R {
    return clone({ policy: this.policy, epoch: this.epoch, model: this.model, samples: this.samples, indicator: this.indicator,
      lower_squared: this.lower_squared, upper_squared: this.upper_squared, calibration: this.calibration, events: this.events, passed: this.passed,
      prior: this.prior, stock: this.stock?.sourceState() ?? null });
  }
}
