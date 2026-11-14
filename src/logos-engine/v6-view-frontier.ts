/** Native common_view_frontier.py: public view registration and bounded information access. */
import { applyEmpiricalRule } from './v6-transition-learning.ts';
import { v6Digest } from './v6-native-observer.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as same, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows, NativePublicObservation } from './v6-native-types.ts';
import { selectViewStrategy, viewStrategies, viewStrategyGraph, type ViewNeedSituation, type ViewStrategy } from '../sic/view-strategy.ts';
type R = Record<string, any>;
type P = readonly [number, number];
type Cells = Map<string, P>;
type ViewOffer = { actions: R[]; steps: R[]; details: R; reason: string };
const key = (value: unknown) => JSON.stringify(value);
const copy = <T>(value: T): T => structuredClone(value);
const cmp = (a: P, b: P) => a[0] - b[0] || a[1] - b[1];
const points = (cells: Cells): P[] => [...cells.values()].sort(cmp);
const cellsOf = (values: Iterable<P>): Cells => new Map([...values].map(p => [key(p), p]));
const difference = (a: Cells, b: Cells): Cells => new Map([...a].filter(([k]) => !b.has(k)));
const union = (values: Iterable<Cells>): Cells => new Map([...values].flatMap(c => [...c]));
const support = (entity: R): Cells => cellsOf(entity.mask.map(([x, y]: P) => [x + entity.position[0], y + entity.position[1]]));

export function uniqueViewEntities(obs: R): R {
  const counts = new Map<string, number>(); for (const entity of obs.entities) counts.set(entity.signature, (counts.get(entity.signature) ?? 0) + 1);
  return Object.fromEntries(obs.entities.filter((entity: R) => counts.get(entity.signature) === 1).map((entity: R) => [entity.signature, entity]));
}
export function viewRectangle(origin: P, width: number, height: number): Cells {
  const result: P[] = []; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) result.push([origin[0] + x, origin[1] + y]); return cellsOf(result);
}
export function shiftedViewCells(cells: Cells, vector: P): Cells { return cellsOf([...cells.values()].map(([x, y]) => [x + vector[0], y + vector[1]])); }
export function viewMotionKey(actionRef: string, signatures: Iterable<string>, vector: P, cells: Cells): any[] {
  if (!cells.size) throw new RangeError('Motion support is empty');
  const x0 = Math.min(...[...cells.values()].map(p => p[0])), y0 = Math.min(...[...cells.values()].map(p => p[1]));
  return [actionRef, [...signatures].sort(compareUnicode), [...vector], [...cells.values()].map(([x, y]): P => [x - x0, y - y0]).sort(cmp)];
}

export function globalViewRegistration(before: R, after: R, first: NativeRows, second: NativeRows): R {
  if (!first.length || !Array.isArray(first[0]) || first.length !== second.length || first.some((row, i) => row.length !== second[i]?.length)) return { status: 'unknown_dimensions', offset: null };
  const height = first.length, width = first[0]!.length, one = uniqueViewEntities(before), two = uniqueViewEntities(after);
  const offsets = cellsOf(Object.keys(one).filter(k => Object.hasOwn(two, k)).map(k => [two[k].position[0] - one[k].position[0], two[k].position[1] - one[k].position[1]]));
  const candidates: { ratio: number; dx: number; dy: number; count: number; gains: number[] }[] = [];
  for (const [dx, dy] of offsets.values()) {
    if (!dx && !dy) continue;
    const left = Math.max(0, -dx), top = Math.max(0, -dy), right = Math.min(width, width - dx), bottom = Math.min(height, height - dy), count = (right - left) * (bottom - top);
    if (count < height * width / 2 || Math.min(right - left, bottom - top) < 2) continue;
    const gains: number[] = [], h = bottom - top, w = right - left;
    for (const [ys, ye] of [[0, Math.floor(h / 2)], [Math.floor(h / 2), h]]) {
      for (const [xs, xe] of [[0, Math.floor(w / 2)], [Math.floor(w / 2), w]]) {
        const palette = new Set<number>(); let gain = 0;
        for (let y = ys!; y < ye!; y++) for (let x = xs!; x < xe!; x++) {
          const value = first[top + y]![left + x]!; palette.add(value);
          gain += Number(value === second[top + y + dy]![left + x + dx]) - Number(value === second[top + y]![left + x]);
        }
        if (palette.size < 2) break;
        gains.push(gain);
      }
    }
    if (gains.length === 4 && Math.min(...gains) > 0) candidates.push({ ratio: gains.reduce((sum, v) => sum + v, 0) / count, dx, dy, count, gains });
  }
  candidates.sort((a, b) => b.ratio - a.ratio || b.dx - a.dx || b.dy - a.dy || b.count - a.count);
  const best = candidates[0];
  if (best && (candidates.length === 1 || best.ratio > candidates[1]!.ratio)) return { status: 'supported_bulk_offset', offset: [best.dx, best.dy], overlap_pixels: best.count,
    quadrant_gains: best.gains, other_supported_offsets: candidates.slice(1).map(c => [c.dx, c.dy]), frame_identity_not_world_identity: true };
  let changed = 0; for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (first[y]![x] !== second[y]![x]) changed++;
  if (!candidates.length && changed * 8 <= height * width) return { status: 'locally_stable_projection', offset: [0, 0], changed_pixels: changed };
  return { status: 'ambiguous_or_unregistered_scene', offset: null, changed_pixels: changed };
}

export class ViewFrontier {
  epoch: number | null = null; origin: P = [0, 0]; segment = 0; coverage: Cells = new Map();
  offsets = new Map<string, Cells>(); offsetSource = new Map<string, string>();
  footprints = new Map<string, Map<string, number[]>>(); passRefs = new Map<string, string[]>();
  block: R | null = null; followup: R | null = null; tested = new Set<string>(); accessTrials = new Map<string, number>();
  knownSignatures = new Set<string>(); reveals: R[] = []; engaged = false; visibleHypotheses = new Map<string, string>();
  private offsetSet(action: string): Cells { if (!this.offsets.has(action)) this.offsets.set(action, new Map()); return this.offsets.get(action)!; }
  private footprintSet(path: string): Map<string, number[]> { if (!this.footprints.has(path)) this.footprints.set(path, new Map()); return this.footprints.get(path)!; }
  initialize(obs: R, rows: NativeRows): void {
    if (this.epoch === obs.level_epoch) return;
    const fresh = new ViewFrontier(); this.restore(fresh.state());
    this.epoch = obs.level_epoch; this.coverage = viewRectangle(this.origin, rows[0]!.length, rows.length); this.knownSignatures = new Set(obs.entities.map((e: R) => e.signature));
  }
  hasObservedViewQuestion(): boolean { return !!this.block || this.reveals.length > 0; }

  continuityEvidence(): readonly string[] {
    return [...new Set<string>([...(this.block?.refs ?? []), ...(this.reveals.length ? [this.reveals.at(-1)!.source] : [])])];
  }

  static async movement(rule: R, obs: R): Promise<readonly [R, R[], P, Cells] | null> {
    const action = rule.conditions?.action ?? {};
    if (!truth(action.action_ref) || truth(action.data)) return null;
    const command = { action_ref: action.action_ref }, prediction = await applyEmpiricalRule(rule, obs as any, command);
    if (prediction.status !== 'prediction') return null;
    const refs = uniqueViewEntities(obs), actors: R[] = [], vectors: Cells = new Map(); let cells: Cells = new Map();
    for (const variable of prediction.predicted_entities) {
      const sig = variable.entity.signature, prev = prediction.position_context[variable.variable], dst = variable.entity.position;
      const vector: P = [dst[0] - prev[0], dst[1] - prev[1]]; if (!vector[0] && !vector[1]) continue;
      if (!Object.hasOwn(refs, sig)) return null;
      vectors.set(key(vector), vector); actors.push({ signature: sig, position: prev }); cells = union([cells, support(refs[sig])]);
    }
    if (vectors.size !== 1 || !actors.length) return null;
    const step = [...vectors.values()][0]!; if (step[0] && step[1]) return null;
    return [command, actors, step, cells];
  }
  async form(obs: R, kind: string, actions: R[], steps: R[], details: R, reason: string): Promise<R> {
    const id = `C_view_${(await v6Digest([obs.observation_ref, kind, actions, reason])).slice(0, 16)}`, preservation = 'C_current_view';
    const facts = { current_observed_view: true, input_bound: actions.every(a => obs.available_action_refs.includes(a.action_ref)) };
    const comp = { id, role: 'information_question', observed: false, open_question: reason, relations: ['contributes_to:G_official_completion'], properties: details };
    const bundle = { operation_key: 'OP18', composition_ref: id, objective_ref: 'G_official_completion', preserve_refs: [preservation], purpose: reason, preconditions: facts,
      evidence: [obs.observation_ref, ...(details.evidence_refs ?? [])], preservation_evidence: { [preservation]: 'Current epoch, occurrence and bound step; seal on changed response or view.' }, actions, outcome_guard: { path: ['value'], contains: id } };
    return { status: 'proposed', kind: 'public_view_frontier', view_plan: { kind, steps, details }, actions, steps, facts,
      compositions: [{ id: preservation, observed: true, role: 'observed_screen', properties: { origin: [...this.origin] } }, comp],
      question: { reason, hypothesis_refs: details.evidence_refs ?? [], terminal_role: 'unknown' }, binding: { level_epoch: obs.level_epoch, levels_completed: obs.levels_completed, observation_ref: obs.observation_ref },
      bundle_template: bundle, route_refs: details.evidence_refs ?? [] };
  }
  async propose(obs: R, rows: NativeRows, inputs: readonly R[], rules: readonly R[], remaining: number,
    authority: 'native' | 'shadow' | 'active' = 'native'): Promise<R | null> {
    this.initialize(obs, rows); const height = rows.length, width = rows[0]!.length, current = uniqueViewEntities(obs);
    const offers: Partial<Record<ViewStrategy, ViewOffer>> = {};
    const situation: ViewNeedSituation = { observationRef: obs.observation_ref, segment: this.segment,
      reopened: null, obstruction: null, edgeAccess: null };
    const propose = async (current: ViewNeedSituation) => {
      const resolution = authority === 'native' ? null : selectViewStrategy(current, {
        test_reopened_access: () => offers.test_reopened_access ?? null,
        confirm_access_obstruction: () => offers.confirm_access_obstruction ?? null,
        test_change_of_witnessed_obstruction: () => offers.test_change_of_witnessed_obstruction ?? null,
        approach_view_edge: () => offers.approach_view_edge ?? null,
      });
      const active = authority === 'active';
      const selected = active ? resolution?.selected : null;
      const strategy = active ? selected?.id : viewStrategyGraph.priorities.find(id => offers[id]);
      const offer = active ? selected?.plan : strategy ? offers[strategy] : null;
      if (!strategy || !offer) return null;
      const proposal = await this.form(obs, strategy, offer.actions, offer.steps, offer.details, offer.reason);
      if (resolution) {
        const movers = offer.details.receiver_poses ?? Object.keys(offer.steps[0]?.expected_poses_before ?? {}).map(signature => ({ signature }));
        const subjects = [...movers.map((mover: R) => ({ ...mover, label: 'Measured mover' })),
          ...(offer.details.carrier ? [{ ...offer.details.carrier, label: 'Observed obstruction' }] : [])].flatMap(witness => {
          const entity = obs.entities.find((item: R) => item.signature === witness.signature && (!witness.position || same(item.position, witness.position)));
          return entity?.bbox ? [{ label: witness.label, box: entity.bbox }] : [];
        }).slice(0, 8);
        proposal.sic_view_decision = { mode: authority, strategy: resolution.selected?.id ?? null,
          agenda: resolution.entries, need: resolution.need, situation: resolution.situation, subjects,
          objective: resolution.selected ? { id: proposal.bundle_template.composition_ref, label: viewStrategies[resolution.selected.id],
            parent: proposal.bundle_template.objective_ref } : null };
      }
      return proposal;
    };
    if (this.followup) {
      const f = this.followup;
      if (f.source === obs.observation_ref && Object.entries(f.poses).every(([k, v]) => Object.hasOwn(current, k) && same(current[k].position, v))) {
        const step = { action: f.command, expected_poses_before: f.poses, expected_after: f.expected, expected_before: { level_epoch: this.epoch, frame_hash: obs.frame_hash } };
        offers.test_reopened_access = { actions: [f.command], steps: [step], details: { evidence_refs: f.refs, exclusive_cause_established: false },
          reason: 'test_access_after_measured_support_change' };
        return propose({ ...situation, reopened: f.refs });
      }
      this.followup = null;
    }
    if (this.block) {
      const block = this.block, witness = obs.entities.find((e: R) => e.signature === block.signature && same(e.position, block.position));
      const posesOk = Object.entries(block.poses).every(([k, v]) => Object.hasOwn(current, k) && same(current[k].position, v));
      if (witness && posesOk && same(this.origin, block.origin) && !this.tested.has(block.key)) {
        let command: R | undefined, kind: ViewStrategy;
        if (block.fail_count === 1) { command = block.command; kind = 'confirm_access_obstruction'; }
        else {
          const candidates = inputs.filter(a => truth(a.data) && support(witness).has(key([a.data.x ?? null, a.data.y ?? null])));
          if (candidates.length === 1) command = candidates[0]!;
          kind = 'test_change_of_witnessed_obstruction';
        }
        if (command) {
          const step = { action: command, expected_before: { level_epoch: this.epoch, frame_hash: obs.frame_hash }, expected_after: null };
          offers[kind] = { actions: [command], steps: [step], reason: kind, details: { evidence_refs: block.refs,
            obstruction_key: block.key, carrier: { signature: block.signature, position: block.position },
            previous_clear_entry: true, stationary_trials: block.fail_count, exclusive_blocking_cause: false } };
        }
        return propose({ ...situation, obstruction: { refs: block.refs, repeated: block.fail_count !== 1 } });
      }
      this.block = null;
    }
    const candidates: R[] = [];
    for (const rule of rules) {
      if (rule.status !== 'mechanism_acquired') continue;
      const move = await ViewFrontier.movement(rule, obs); if (!move) continue;
      const [command, actors, vector, cells] = move, [dx, dy] = vector;
      if (!obs.available_action_refs.includes(command.action_ref)) continue;
      const axis = dx ? 0 : 1, sign = vector[axis] > 0 ? 1 : -1, limit = axis === 0 ? width : height;
      const front = (sign > 0 ? Math.max : Math.min)(...[...cells.values()].map(p => p[axis])), gap = sign > 0 ? limit - 1 - front : front;
      const stepsToEdge = 1 + Math.floor(gap / Math.abs(vector[axis]));
      const observedOffsets = this.offsetSet(command.action_ref), offsets = observedOffsets.size ? observedOffsets : cellsOf([[-dx || 0, -dy || 0]]);
      const alternatives = points(offsets).map(([sx, sy]) => ({ hypothetical_bulk_offset: [sx, sy], unseen_viewport_pixels_if_realized: difference(viewRectangle([this.origin[0] - sx, this.origin[1] - sy], width, height), this.coverage).size }));
      const area = Math.max(...alternatives.map(a => a.unseen_viewport_pixels_if_realized)); if (area <= 0) continue;
      const pathKey = viewMotionKey(command.action_ref, actors.map(a => a.signature), vector, cells), pathString = key(pathKey);
      if ((this.accessTrials.get(key([pathKey, this.origin, points(cells)])) ?? 0) >= 2) continue;
      const steps: R[] = [];
      for (let k = 0; k < Math.min(16, remaining, stepsToEdge); k++) {
        const currentCells = shiftedViewCells(cells, [k * dx, k * dy]), destination = shiftedViewCells(currentCells, vector), entry = difference(destination, currentCells);
        let known: boolean;
        if (!entry.size || [...entry.values()].some(([x, y]) => x < 0 || x >= width || y < 0 || y >= height)) { if (steps.length) break; known = false; }
        else { const signature = points(entry).map(([x, y]) => rows[y]![x]!); known = this.footprintSet(pathString).has(key(signature)); }
        const prior: R = Object.fromEntries(actors.map(a => [a.signature, [a.position[0] + k * dx, a.position[1] + k * dy]]));
        const after = Object.fromEntries(Object.entries(prior).map(([sig, p]) => [sig, [p[0] + dx, p[1] + dy]]));
        steps.push({ action: command, expected_before: { level_epoch: this.epoch, frame_hash: k === 0 ? obs.frame_hash : null }, expected_poses_before: prior, expected_after: after, entry_texture_witnessed: known });
        if (!known) break;
      }
      if (steps.length) candidates.push({ area, cost: stepsToEdge, command, actors, vector, steps, alternatives, rule: rule.rule_id, seen: !!this.offsetSet(command.action_ref).size, rule_refs: (rule.evidence_refs ?? []).slice(-3) });
    }
    if (!candidates.length) return null;
    this.engaged = true; candidates.sort((a, b) => b.area - a.area || a.cost - b.cost || compareUnicode(a.command.action_ref, b.command.action_ref) || compareUnicode(a.rule, b.rule));
    const best = candidates[0]!, ties = candidates.filter(c => c.area === best.area && c.cost === best.cost).map(c => ({ action_ref: c.command.action_ref, vector: [...c.vector], rule: c.rule }));
    const evidence = [best.rule, ...best.rule_refs, ...points(this.offsetSet(best.command.action_ref)).map(t => this.offsetSource.get(key([best.command.action_ref, t]))!)];
    offers.approach_view_edge = { actions: best.steps.map(() => best.command), steps: best.steps, details: {
      evidence_refs: evidence,
      receiver_poses: best.actors, access_vector: [...best.vector], steps_to_projected_screen_edge: best.cost, conditional_new_viewport_pixels: best.area,
      view_shift_previously_seen_for_input: best.seen, camera_hypotheses: best.alternatives, tied_accesses: ties,
      other_accesses: candidates.slice(1).map(c => ({ input: c.command.action_ref, area: c.area, steps: c.cost })), unmodeled_inputs: obs.available_action_refs.filter((a: string) => !candidates.some(c => c.command.action_ref === a)),
      newest_visible_candidates: this.reveals.length ? this.reveals[this.reveals.length - 1]!.new_signature_count : 0,
      retained_visible_hypotheses: [...this.visibleHypotheses].filter(([sig]) => Object.hasOwn(current, sig)).slice(0, 8).map(([sig, ref]) => ({ source_ref: ref, signature: sig, current_entity_ref: current[sig].id, terminal_role: 'unestablished' })),
      qualification: 'projected access and potential screen area; unknown terrain, physical traversability and terminal role',
    }, reason: 'approach_accessible_border_with_largest_conditional_unseen_view' };
    return propose({ ...situation, edgeAccess: evidence });
  }
  before(proposal: R, index: number, publicPacket: NativePublicObservation, observation: R): R {
    const bound = proposal.binding, step = proposal.steps[index];
    let ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref);
    if (index === 0) ok &&= observation.observation_ref === bound.observation_ref;
    const us = uniqueViewEntities(observation); ok &&= Object.entries(step.expected_poses_before ?? {}).every(([k, pos]) => Object.hasOwn(us, k) && same(us[k].position, pos));
    return { admitted: !!ok, reason: ok ? 'bound_view_step' : 'view_or_receiver_changed' };
  }
  after(proposal: R, index: number, before: R, after: R, first: NativeRows, second: NativeRows): R {
    if (before.level_epoch !== after.level_epoch || before.state !== after.state || before.levels_completed !== after.levels_completed) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const registration = globalViewRegistration(before, after, first, second), expected = proposal.steps[index].expected_after;
    if (!same(registration.offset, [0, 0]) || expected === null) return { matched: null, seal_prefix: true, reason: truth(expected) ? registration.status : 'probe_outcome_observed' };
    const us = uniqueViewEntities(after), ok = Object.entries(expected).every(([k, v]) => Object.hasOwn(us, k) && same(us[k].position, v));
    return { matched: ok, seal_prefix: !ok || index + 1 === proposal.steps.length, reason: ok ? 'screen_pose_matched' : 'screen_pose_diverged' };
  }
  async record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal: R, index: number): Promise<R> {
    this.initialize(before, first);
    if (after.level_epoch !== before.level_epoch || after.state !== before.state) { this.initialize(after, second); return { status: 'official_boundary', new_viewport_pixels: null }; }
    const registration = globalViewRegistration(before, after, first, second), offset: P | null = registration.offset, width = second[0]!.length, height = second.length;
    const priorOrigin = this.origin, oldSignatures = new Set(this.knownSignatures); let found: R[] = [], fresh: number | null;
    if (offset === null) { this.segment++; this.origin = [0, 0]; this.coverage = viewRectangle(this.origin, width, height); this.block = null; fresh = null; }
    else {
      this.origin = [this.origin[0] - offset[0], this.origin[1] - offset[1]];
      const window = viewRectangle(this.origin, width, height), revealed = difference(window, this.coverage); this.coverage = union([this.coverage, window]); fresh = revealed.size;
      if (!same(offset, [0, 0])) {
        this.offsetSet(command.action_ref).set(key(offset), offset); this.block = null; this.offsetSource.set(key([command.action_ref, offset]), after.observation_ref);
        found = after.entities.filter((e: R) => !oldSignatures.has(e.signature) && [...support(e).values()].some(([x, y]) => revealed.has(key([x + this.origin[0], y + this.origin[1]]))))
          .map((e: R) => ({ entity_ref: e.id, signature: e.signature, position: e.position }));
        this.reveals.push({ source: after.observation_ref, new_signature_count: new Set(found.map(e => e.signature)).size }); for (const e of found) this.visibleHypotheses.set(e.signature, after.observation_ref);
      }
    }
    for (const entity of after.entities) this.knownSignatures.add(entity.signature);
    const b = uniqueViewEntities(before), a = uniqueViewEntities(after), motions = new Map<string, { vector: P; signatures: string[] }>();
    for (const sig of Object.keys(b).filter(sig => Object.hasOwn(a, sig))) {
      const vector: P = [a[sig].position[0] - b[sig].position[0], a[sig].position[1] - b[sig].position[1]];
      if (!vector[0] && !vector[1]) continue; const id = key(vector); if (!motions.has(id)) motions.set(id, { vector, signatures: [] }); motions.get(id)!.signatures.push(sig);
    }
    if (same(offset, [0, 0]) && !truth(command.data)) for (const { vector, signatures } of motions.values()) {
      const cells = union(signatures.map(sig => support(b[sig]))), entry = difference(shiftedViewCells(cells, vector), cells);
      if (entry.size && [...entry.values()].every(([x, y]) => x >= 0 && x < width && y >= 0 && y < height)) {
        const path = key(viewMotionKey(command.action_ref, signatures, vector, cells)), texture = points(entry).map(([x, y]) => first[y]![x]!);
        this.footprintSet(path).set(key(texture), texture); this.passRefs.set(path, [...(this.passRefs.get(path) ?? []), after.observation_ref].slice(-3));
      }
    }
    const view = proposal.view_plan ?? {}, kind = view.kind;
    if (kind === 'test_change_of_witnessed_obstruction') {
      this.tested.add(view.details.obstruction_key);
      if (this.block && same(offset, [0, 0])) {
        const block = this.block, carrier = before.entities.find((e: R) => e.signature === block.signature && same(e.position, block.position));
        if (carrier && [...support(carrier).values()].some(([x, y]) => first[y]![x] !== second[y]![x])) this.followup = { source: after.observation_ref, command: block.command, poses: block.poses, expected: block.expected, refs: [...block.refs, after.observation_ref] };
      }
      this.block = null;
    } else if (kind === 'test_reopened_access') this.followup = null;
    else if (kind === 'confirm_access_obstruction' && this.block) {
      const stopped = same(offset, [0, 0]) && Object.entries(this.block.poses).every(([k, p]) => Object.hasOwn(a, k) && same(a[k].position, p));
      if (stopped) { this.block.fail_count++; this.block.refs.push(after.observation_ref); } else this.block = null;
    } else if (kind === 'approach_view_edge' && same(offset, [0, 0])) {
      const step = view.steps[index], poses = step.expected_poses_before, vector = view.details.access_vector as P;
      const cells = union(Object.keys(poses).filter(sig => Object.hasOwn(b, sig)).map(sig => support(b[sig]))), entry = difference(shiftedViewCells(cells, vector), cells);
      const motion = viewMotionKey(command.action_ref, Object.keys(poses), vector, cells), path = key(motion), trial = key([motion, priorOrigin, points(cells)]);
      this.accessTrials.set(trial, (this.accessTrials.get(trial) ?? 0) + 1);
      const stopped = Object.entries(poses).every(([sig, pos]) => Object.hasOwn(a, sig) && same(a[sig].position, pos));
      if (stopped && entry.size && this.footprintSet(path).size && [...entry.values()].every(([x, y]) => x >= 0 && x < width && y >= 0 && y < height)) {
        const texture = points(entry).map(([x, y]) => first[y]![x]!);
        if (!this.footprintSet(path).has(key(texture))) {
          const contacts = cellsOf([...cells.values()].flatMap(([x, y]): P[] => [[x, y + 1], [x, y - 1], [x + 1, y], [x - 1, y]]));
          const unlike = points(entry).filter((_, i) => [...this.footprintSet(path).values()].every(old => old[i] !== texture[i]));
          const witnesses = before.entities.filter((e: R) => !Object.hasOwn(poses, e.signature) && unlike.some(p => contacts.has(key(p))) && unlike.every(p => support(e).has(key(p))));
          if (witnesses.length === 1) {
            const carrier = witnesses[0], blockKey = await v6Digest([this.epoch, this.segment, priorOrigin, command, carrier.signature, carrier.position, poses]);
            if (!this.tested.has(blockKey)) this.block = { signature: carrier.signature, position: carrier.position, origin: priorOrigin, command, poses, expected: step.expected_after, fail_count: 1,
              refs: [...(this.passRefs.get(path) ?? []), before.observation_ref, after.observation_ref], key: blockKey };
          }
        }
      }
    }
    const decision = proposal.sic_view_decision;
    return { status: registration.status, registration, source_ref: before.observation_ref, after_ref: after.observation_ref, segment: this.segment, previous_origin: [...priorOrigin], registered_origin: [...this.origin],
      new_viewport_pixels: fresh, coverage_pixels: this.coverage.size, newly_visible_distinct_occurrences: found, blockage_question: this.block === null ? null : { key: this.block.key, stationary_trials: this.block.fail_count },
      ...(decision?.mode === 'active' ? { sic_view_return: { need: decision.need.id, objective: decision.objective.id,
        status: fresh === null ? 'unregistered' : fresh > 0 ? 'expanded' : 'no_new_area', newPixels: fresh, evidence: after.observation_ref } } : {}),
      qualification: 'screen-coverage estimate; foreground and fixed overlays can contribute' };
  }
  state(): R {
    const entries = <T>(value: Map<string, T>) => [...value].sort(([a], [b]) => compareUnicode(a, b));
    return copy({ epoch: this.epoch, origin: this.origin, segment: this.segment, coverage: points(this.coverage), offsets: Object.fromEntries(entries(this.offsets).map(([k, v]) => [k, points(v)])),
      offset_source: entries(this.offsetSource).map(([k, v]) => [JSON.parse(k), v]), footprints: entries(this.footprints).map(([k, v]) => [JSON.parse(k), [...v.values()].sort((a, b) => compareUnicode(key(a), key(b)))]),
      pass_refs: entries(this.passRefs).map(([k, v]) => [JSON.parse(k), v]), block: this.block, followup: this.followup, tested: [...this.tested].sort(compareUnicode),
      access_trials: entries(this.accessTrials).map(([k, v]) => [JSON.parse(k), v]), known_signatures: [...this.knownSignatures].sort(compareUnicode), reveals: this.reveals, engaged: this.engaged, visible_hypotheses: Object.fromEntries(this.visibleHypotheses) });
  }
  restore(state: R): void {
    const s = copy(state); this.epoch = s.epoch; this.origin = s.origin; this.segment = s.segment; this.coverage = cellsOf(s.coverage);
    this.offsets = new Map(Object.entries(s.offsets).map(([k, v]) => [k, cellsOf(v as P[])])); this.offsetSource = new Map(s.offset_source.map(([k, v]: [any, string]) => [key(k), v]));
    this.footprints = new Map(s.footprints.map(([k, v]: [any, number[][]]) => [key(k), new Map(v.map(texture => [key(texture), texture]))]));
    this.passRefs = new Map(s.pass_refs.map(([k, v]: [any, string[]]) => [key(k), v])); this.block = s.block; this.followup = s.followup; this.tested = new Set(s.tested);
    this.accessTrials = new Map(s.access_trials.map(([k, v]: [any, number]) => [key(k), v])); this.knownSignatures = new Set(s.known_signatures); this.reveals = s.reveals; this.engaged = s.engaged; this.visibleHypotheses = new Map(Object.entries(s.visible_hypotheses));
  }
}
