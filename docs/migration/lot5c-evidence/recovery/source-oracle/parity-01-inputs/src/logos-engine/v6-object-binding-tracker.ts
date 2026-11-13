/** Transfer of guarded_binding/tracker.py. Updates replace only changed
 * branches so an interrupted native transaction can discard its fork. */
import { unchanged, compatible } from './v6-object-binding-identity.ts';
import { arrival, separation } from './v6-object-binding-reception.ts';
import { moved_core, find_body, center, correspondence, empty_frames, digest, contains, enclosing_contours } from './v6-object-binding-geometry.ts';
import { bindingClone as clone, bindingEqual as same, bindingTruthy as truth, bindingUnique as unique,
  type BindingRecord as R, type BindingWork } from './v6-object-binding-common.ts';
import type { NativeRows } from './v6-native-types.ts';

export const BINDING_TRACKER_FIELDS = ['epoch', 'core', 'moves', 'tried', 'blocked', 'held', 'interaction', 'methods', 'events',
  'failed', 'goal_evidence', 'correspondence_context', 'context_refutations', 'pending_reception', 'reception_receipts', 'observed_frames'] as const;

export class BindingTracker {
  epoch: number | null = null;
  core: R | null = null;
  moves: R = {};
  tried: string[] = [];
  blocked: R[] = [];
  held: R | null = null;
  interaction: R | null = null;
  methods: R[] = [];
  events: R[] = [];
  failed: R[] = [];
  goal_evidence: R[] = [];
  correspondence_context: R | null = null;
  context_refutations: R[] = [];
  pending_reception: R | null = null;
  reception_receipts: R[] = [];
  observed_frames: R = {};
  // Python state/restore exposes __dict__ and accepts extra source keys.
  // The native checkpoint validator separately rejects this source-only annex.
  private extra: R = {};

  sourceReferences(): R {
    return Object.fromEntries([...BINDING_TRACKER_FIELDS.map(name => [name, this[name]] as const), ...Object.entries(this.extra)]);
  }
  references(): readonly unknown[] { return [...BINDING_TRACKER_FIELDS.map(name => this[name]), this.extra]; }
  sourceState(): R { return clone(this.sourceReferences()); }
  state(): R { return this.sourceState(); }
  restore(state: R): void {
    const value = clone(state), remaining: [string, unknown][] = Object.entries(this.extra);
    for (const [name, item] of Object.entries(value)) {
      if ((BINDING_TRACKER_FIELDS as readonly string[]).includes(name)) (this as unknown as R)[name] = item;
      else { const index = remaining.findIndex(([key]) => key === name); if (index < 0) remaining.push([name, item]); else remaining[index] = [name, item]; }
    }
    this.extra = Object.fromEntries(remaining);
  }
  /** Internal transaction fork: its algorithms replace arrays/maps/records. */
  fork(): BindingTracker {
    const result = new BindingTracker();
    for (const name of BINDING_TRACKER_FIELDS) (result as unknown as R)[name] = this[name];
    result.extra = this.extra; return result;
  }
  install(other: BindingTracker): void {
    for (const name of BINDING_TRACKER_FIELDS) (this as unknown as R)[name] = other[name];
    this.extra = other.extra;
  }
  installSourceReferences(source: R): void {
    for (const name of BINDING_TRACKER_FIELDS) (this as unknown as R)[name] = source[name];
    this.extra = Object.fromEntries(Object.entries(source).filter(([name]) => !(BINDING_TRACKER_FIELDS as readonly string[]).includes(name)));
  }
  reset(epoch: number): void {
    const methods = clone(this.methods), goals = clone(this.goal_evidence);
    this.install(new BindingTracker()); this.epoch = epoch; this.methods = methods; this.goal_evidence = goals;
  }
  has_transport_context(): boolean {
    return truth(this.correspondence_context) || truth(this.held) || truth(this.interaction) || truth(this.methods) || truth(this.goal_evidence);
  }
  admit_context(observation: R, rows: NativeRows, work?: BindingWork): boolean {
    work?.node(); if (this.epoch !== null && this.epoch !== observation.level_epoch) return false;
    this.revalidate_context(observation, rows, work);
    if (this.has_transport_context()) return true;
    const refused = new Set(this.context_refutations.map(item => item.pair_ref));
    const pairs = correspondence(observation, rows, this.core?.signature ?? null, [], work).filter(pair => !refused.has(pair.ref));
    if (!pairs.length) return false;
    this.epoch = observation.level_epoch;
    this.correspondence_context = { level_epoch: this.epoch, pairs: pairs.map(pair => pair.ref),
      frames: Object.fromEntries(pairs.map(pair => [pair.ref, pair.frame])), evidence: [observation.observation_ref],
      status: 'observed_correspondence_hypothesis_not_liaison_fact' };
    return true;
  }
  frame_contradiction(frame: R, observation: R, rows: NativeRows, work?: BindingWork): number[][] | null {
    const body = this.core ? find_body(observation, this.core.signature, work) : null,
      occluders = [...(body ? [body.bbox] : []), ...(this.held ? [this.held.bbox] : [])],
      contours = body ? enclosing_contours(observation, body, work) : [];
    return corner_contradiction(frame, rows, occluders, contours, work);
  }
  revalidate_context(observation: R, rows: NativeRows, work?: BindingWork): void {
    const context = this.correspondence_context; if (!context) return;
    const body = this.core ? find_body(observation, this.core.signature, work) : null,
      occluders = [...(body ? [body.bbox] : []), ...(this.held ? [this.held.bbox] : [])],
      contours = body ? enclosing_contours(observation, body, work) : [], retained: string[] = [], refutations: R[] = [];
    for (const pairRef of context.pairs as string[]) {
      work?.node(); const frame = context.frames?.[pairRef], contradiction = frame ? corner_contradiction(frame, rows, occluders, contours, work) : null;
      if (contradiction) refutations.push({ pair_ref: pairRef, frame_ref: frame.ref, reason: 'anchored_frame_corner_contradiction',
        changed_corners: contradiction, evidence: [observation.observation_ref], prior_evidence: context.evidence });
      else retained.push(pairRef);
    }
    if (refutations.length) this.context_refutations = [...this.context_refutations, ...refutations];
    if (!retained.length) this.correspondence_context = null;
    else if (retained.length !== context.pairs.length) this.correspondence_context = { ...context, pairs: retained,
      frames: Object.fromEntries(Object.entries(context.frames ?? {}).filter(([name]) => retained.includes(name))) };
  }
  record(before: R, after: R, command: R, first: NativeRows, second: NativeRows, proposal?: R | null, _index = 0, work?: BindingWork): R | null {
    work?.node(); if (this.epoch !== before.level_epoch) this.reset(before.level_epoch);
    const action = command.action_ref, evidence = [before.observation_ref, after.observation_ref];
    if (before.level_epoch !== after.level_epoch || after.levels_completed > before.levels_completed) {
      if (this.held && proposal?.binding_plan?.offer?.kind === 'probe_reception') {
        const method = { ref: 'binding_method:' + digest(evidence), interaction: action, source_epoch: this.epoch,
          scope: 'same_appearance_frame_reception_hypothesis', evidence,
          goal: 'released_corresponding_object_at_visible_frame_boundary', pickup_evidence: this.held.evidence,
          status: 'boundary_support_not_universal_sufficiency' };
        this.methods = [...this.methods, method]; this.goal_evidence = [...this.goal_evidence, method];
      }
      this.reset(after.level_epoch); return { status: 'scope_changed_preserving_conditional_methods', evidence };
    }
    if (!this.admit_context(before, first, work) && !this.admit_context(after, second, work)) return null;
    for (const frame of [...empty_frames(before, first, work), ...empty_frames(after, second, work)]) {
      if (!same(this.observed_frames[frame.ref], frame)) this.observed_frames = { ...this.observed_frames, [frame.ref]: frame };
    }
    if (!this.tried.includes(action)) this.tried = [...this.tried, action];
    const motion = moved_core(before, after, 4, null, work);
    if (this.core === null && motion) {
      const core: R = { signature: motion.signature, area: motion.area, palette_value: motion.palette_value, evidence },
        [l, t, r, b] = motion.bbox, offsets: number[][] = [];
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) { work?.tick(); if (second[y]![x] === core.palette_value) offsets.push([x - l, y - t]); }
      core.offsets = offsets; this.core = core;
    }
    if (!this.core) return null;
    const a = find_body(before, this.core.signature, work), b = find_body(after, this.core.signature, work);
    if (!a || !b) return { status: 'body_identity_unbound', evidence };
    const p = center(a.bbox), q = center(b.bbox), delta = q.map((value, index) => value - p[index]!); let event: R | null = null;
    if (this.pending_reception && delta.some(Boolean)) {
      const proof = separation(this.pending_reception, second, after, b, delta, this.moves[action]?.delta, evidence, work);
      if (proof.status === 'reception_confirmed_by_separation') {
        this.reception_receipts = [...this.reception_receipts, proof];
        this.methods = [...this.methods, { ref: 'binding_method:' + digest(proof.evidence), interaction: this.interaction!.action,
          source_epoch: this.epoch, scope: 'selected_site_reception_observed_after_separation', evidence: proof.evidence,
          status: 'local_relation_not_universal_sufficiency' }];
        this.pending_reception = null; this.held = null; this.events = [...this.events, proof].slice(-32); return proof;
      }
      if (proof.status === 'reception_refuted_object_moves_with_body') {
        this.events = [...this.events, proof].slice(-32); this.pending_reception = null;
        this.held = { ...this.held!, status: 'joint_transport_observed' };
      } else return proof;
    }
    if (delta.some(Boolean)) {
      const old = this.moves[action];
      if (old && !same(old.delta, delta)) event = { status: 'nonlocal_or_contextual_motion', action, expected: old.delta, observed: delta, evidence };
      else this.moves = { ...this.moves, [action]: { delta, evidence, status: 'observed_local_displacement' } };
      if (this.held) {
        // Preserve source order. The frame test is repeated per eligible entity
        // exactly as a measurement, never replaced by a game-specific filter.
        const pieces = (after.entities as R[]).filter(entity => { work?.tick(); return entity.palette_value === this.held!.palette_value
          && entity.area >= 4 && !empty_frames(after, second, work).some(frame => contains(frame.bbox, entity.bbox)); });
        const extent = 4 * Math.max(b.bbox[2] - b.bbox[0] + 1, b.bbox[3] - b.bbox[1] + 1), bodyCenter = center(b.bbox);
        const plausible = pieces.filter(entity => { work?.tick(); return Math.min(entity.bbox[2] - entity.bbox[0], entity.bbox[3] - entity.bbox[1]) > 0
          && center(entity.bbox).reduce((sum, value, index) => sum + Math.abs(value - bodyCenter[index]!), 0) <= extent; });
        if (plausible.length === 1) {
          this.held = { ...this.held, bbox: plausible[0]!.bbox, status: 'joint_transport_observed', evidence: unique([...this.held.evidence, ...evidence]) };
          event = { status: 'object_remains_locally_bound_after_motion', relative_pose_is_not_rigid: true, evidence };
        } else { this.held = { ...this.held, status: 'transport_identity_ambiguous' }; event = { status: 'transport_identity_ambiguous', evidence }; }
      }
    } else if (Object.hasOwn(this.moves, action)) {
      this.blocked = [...this.blocked, { action, pose: center(a.bbox), evidence }]; event = { status: 'motion_no_effect_contextual', evidence };
    } else {
      if (this.held && proposal?.binding_plan?.offer?.kind === 'probe_reception') {
        const plan = proposal.binding_plan.offer, pending = arrival(this.held, first, second, a, b, plan.preservation_regions ?? [], evidence, work);
        if (pending) { this.pending_reception = pending; this.held = { ...this.held, status: 'reception_separation_pending' };
          return { status: 'arrival_at_selected_site_requires_separation', frame_ref: pending.frame.ref, evidence }; }
      }
      const matches = correspondence(before, first, this.core.signature, [], work), changed: [R, R, R, R][] = [], ambiguities: R[] = [];
      const bodyCenter = center(b.bbox), extent = 4 * Math.max(b.bbox[2] - b.bbox[0] + 1, b.bbox[3] - b.bbox[1] + 1);
      for (const match of matches) {
        work?.node(); const object = match.object;
        if (unchanged(object, after, work)) continue;
        const candidates = (after.entities as R[]).filter(entity => { work?.tick(); return entity.palette_value === object.palette_value && entity.area >= 4
          && !unchanged(entity, before, work) && !empty_frames(after, second, work).some(frame => contains(frame.bbox, entity.bbox)); });
        const local: [R, R][] = [];
        for (const candidate of candidates) {
          work?.node(); if (center(candidate.bbox).reduce((sum, value, i) => sum + Math.abs(value - bodyCenter[i]!), 0) > extent) continue;
          const identity = compatible(object, candidate, first, second, before, after, a, b, work); if (identity) local.push([candidate, identity]);
        }
        if (local.length !== 1) {
          if (candidates.length) ambiguities.push({ source_bbox: object.bbox, candidate_bboxes: candidates.map(entity => entity.bbox),
            compatible_count: local.length, reason: local.length > 1 ? 'multiple_compatible_relocations' : 'changed_occurrences_not_visibly_compatible' });
          continue;
        }
        const [other, identity] = local[0]!;
        if (same(center(other.bbox), object.center)) continue;
        if (center(other.bbox).reduce((sum, value, i) => sum + Math.abs(value - bodyCenter[i]!), 0) > extent) continue;
        changed.push([object, other, match.frame, identity]);
      }
      if (!this.held && changed.length === 1) {
        const [object, other, frame, identity] = changed[0]!;
        this.held = { ref: 'bound_object:' + digest([before.level_epoch, object.palette_value, object.bbox]), palette_value: object.palette_value,
          bbox: other.bbox, original_bbox: object.bbox, frame, status: 'local_attachment_hypothesis', identity_binding: identity, evidence };
        this.interaction = { action, evidence }; event = { status: 'local_attachment_hypothesis',
          alternatives: ['attachment', 'remote_relocation_then_independent_object'], identity_binding: identity, evidence };
      } else if (ambiguities.length || changed.length > 1) event = { status: 'identity_binding_unresolved', ambiguities, compatible_source_count: changed.length, evidence };
      else if (proposal && Object.hasOwn(proposal, 'binding_plan')) {
        this.failed = [...this.failed, { action, context: proposal.binding_plan.offer.context, evidence }];
        event = { status: 'interaction_no_observed_identity_effect', evidence };
      }
    }
    if (event) this.events = [...this.events, event].slice(-32);
    return event;
  }
}

export function corner_contradiction(frame: R, rows: NativeRows, occluders: readonly number[][],
  contours: readonly number[], work?: BindingWork): number[][] | null {
  const [l, t, r, b] = frame.bbox;
  if (l < 0 || t < 0 || b >= rows.length || r >= rows[0]!.length) return null;
  let equalCorners = 0, edges = 0; const changed: number[][] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
    work?.tick(); if (x !== l && x !== r && y !== t && y !== b) continue;
    if (occluders.some(([a, d, c, e]) => a! <= x && x <= c! && d! <= y && y <= e!) || contours.includes(rows[y]![x]!)) continue;
    if ((x === l || x === r) && (y === t || y === b)) { if (rows[y]![x] === frame.corner_value) equalCorners++; else changed.push([x, y]); }
    else { if (rows[y]![x] !== frame.palette_value) return null; edges++; }
  }
  return equalCorners >= 2 && edges > 0 && changed.length ? changed : null;
}
