/** Conditional source offers from guarded_binding/planning.py. Every target
 * and movement comes from the current public observation or acquired tracker. */
import { find_body, center, correspondence, near, digest, revalidate_frame, enclosing_contours } from './v6-object-binding-geometry.ts';
import { bindingClone as clone, bindingEqual as same, bindingUnique as unique,
  type BindingRecord as R, type BindingWork } from './v6-object-binding-common.ts';
import type { BindingTracker } from './v6-object-binding-tracker.ts';
import type { NativeRows } from './v6-native-types.ts';

export function distance(a: readonly number[], b: readonly number[]): number {
  let total = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) total += Math.abs(a[i]! - b[i]!); return total;
}
export function shift(box: readonly number[], delta: readonly number[]): number[] {
  return [box[0]! + delta[0]!, box[1]! + delta[1]!, box[2]! + delta[0]!, box[3]! + delta[1]!];
}
export function offers(tracker: BindingTracker, obs: R, rows: NativeRows, remaining: number, config: R, work?: BindingWork): R[] {
  work?.node(); if (tracker.epoch !== obs.level_epoch || !tracker.core || remaining < 1) return [];
  const body = find_body(obs, tracker.core.signature, work); if (!body) return [];
  if (tracker.pending_reception) return separation_offers(tracker, obs, rows, remaining, config, body, work);
  const targets: R[] = [];
  if (tracker.held) {
    if (tracker.held.status === 'transport_identity_ambiguous') return [];
    const frame = revalidate_frame(tracker.held.frame, rows, [body.bbox, tracker.held.bbox], enclosing_contours(obs, body, work), work);
    if (!frame) return [];
    targets.push({ ref: tracker.held.ref, bbox: frame.interior_bbox, center: frame.center, frame,
      mode: 'reception', evidence: tracker.held.evidence });
  } else for (const pair of correspondence(obs, rows, tracker.core.signature, Object.values(tracker.observed_frames), work)) {
    targets.push({ ...pair.object, ref: pair.ref, frame: pair.frame, mode: 'binding', evidence: pair.evidence });
  }
  const result: R[] = [], pose = center(body.bbox), available: string[] = obs.available_action_refs.filter((action: string) => !['RESET', 'ACTION6'].includes(action));
  for (const target of targets) {
    work?.node(); const context = digest([obs.level_epoch, pose, target.ref, target.bbox, tracker.held && tracker.held.status], [[1, 0], [1, 1]]),
      failed = new Set(tracker.failed.filter(item => item.context === context).map(item => item.action));
    const base: R = { target, context, evidence: unique([...tracker.core.evidence, ...target.evidence, obs.observation_ref]),
      unknown: ['pickup_metric_and_radius', 'release_position_law', 'directed_threats', 'protective_field_effect', 'capacity_beyond_current_one_object'],
      risks: ['interaction_may_change_control_or_object', 'unobserved_passage_or_hazard', 'no_proven_return_for_first_probe'],
      falsifiers: ['body_identity_changes', 'frame_correspondence_changes', 'other_object_moves', 'predicted_displacement_differs', 'interaction_has_no_expected_object_effect'],
      preserve: ['nonselected_object_centres_when_currently_observable', 'current_body_identity'], distance: distance(pose, target.center) };
    if (near(body.bbox, target.bbox)) {
      const controls: [string, string[], string][] = [];
      if (tracker.interaction) controls.push([tracker.interaction.action, tracker.interaction.evidence, 'current_observed_interaction']);
      else if (tracker.methods.length) {
        const methods = tracker.methods.filter(method => available.includes(method.interaction)), actions = new Set<string>(methods.map(method => method.interaction));
        if (actions.size === 1) controls.push([[...actions][0]!, methods.flatMap(method => method.evidence), 'portable_interaction_currently_probed']);
      }
      for (const [action, evidence, status] of controls) {
        work?.tick(); if (failed.has(action)) continue;
        result.push({ ...clone(base), kind: tracker.held ? 'probe_reception' : 'probe_observed_binding', actions: [{ action_ref: action }],
          poses: [pose], conditional: true, control_status: status, evidence: unique([...base.evidence, ...evidence]), hypotheses: config.interaction_models[target.mode] });
      }
      if (!tracker.held) for (const action of available) {
        work?.tick(); if (!tracker.tried.includes(action) && !failed.has(action)) result.push({ ...clone(base), kind: 'probe_unknown_contact_control',
          actions: [{ action_ref: action }], poses: [pose], conditional: true, hypotheses: config.interaction_models.binding });
      }
    }
    for (const [action, method] of Object.entries(tracker.moves) as [string, R][]) {
      work?.node(); if (!available.includes(action)) continue;
      const delta = method.delta, poses: number[][] = [], actions: R[] = []; let box: number[] = [...body.bbox];
      for (let i = 0; i < Math.min(remaining, config.maximum_prefix); i++) {
        work?.node(); const here = center(box), next = shift(box, delta);
        if (tracker.blocked.some(item => { work?.tick(); return item.action === action && same(item.pose, here); })) break;
        if (Math.min(next[0]!, next[1]!) < 0 || next[2]! >= rows[0]!.length || next[3]! >= rows.length) break;
        if (distance(center(next), target.center) >= distance(here, target.center)) break;
        poses.push(here); actions.push({ action_ref: action }); box = next;
        if (near(box, target.bbox)) break;
      }
      if (actions.length) result.push({ ...clone(base), kind: tracker.held ? 'approach_reception' : 'approach_correspondence', actions, poses,
        delta, conditional: true, evidence: unique([...base.evidence, ...method.evidence]),
        hypotheses: ['locally_observed_displacement_extends_over_currently_unentered_support'], residual_distance: distance(center(box), target.center) });
    }
    for (const action of available) {
      work?.tick(); if (!tracker.tried.includes(action) && !failed.has(action)) result.push({ ...clone(base), kind: 'probe_control_for_correspondence',
        actions: [{ action_ref: action }], poses: [pose], conditional: true,
        hypotheses: ['control_may_enable_access_to_the_visible_correspondence', 'control_may_have_nonmovement_effect_or_no_effect'] });
    }
  }
  return result;
}
export function separation_offers(tracker: BindingTracker, obs: R, rows: NativeRows, _remaining: number, config: R, body: R, work?: BindingWork): R[] {
  const pending = tracker.pending_reception!, pose = center(body.bbox), frame = pending.frame,
    other = correspondence(obs, rows, tracker.core!.signature, Object.values(tracker.observed_frames), work),
    goals = other.filter(pair => pair.frame.ref !== frame.ref).map(pair => pair.object.center), result: R[] = [];
  for (const [action, method] of Object.entries(tracker.moves) as [string, R][]) {
    work?.node(); const delta = method.delta, nextBox = shift(body.bbox, delta), nextPose = center(nextBox);
    if (!obs.available_action_refs.includes(action) || Math.min(nextBox[0]!, nextBox[1]!) < 0 || nextBox[2]! >= rows[0]!.length || nextBox[3]! >= rows.length) continue;
    if (tracker.blocked.some(item => { work?.tick(); return item.action === action && same(item.pose, pose); })) continue;
    if (distance(nextPose, frame.center) <= distance(pose, frame.center)) continue;
    const target = { ref: pending.object_ref, frame, bbox: frame.interior_bbox, center: frame.center, mode: 'separation', evidence: pending.evidence };
    result.push({ target, context: digest([obs.level_epoch, pose, pending.ref], [[1, 0], [1, 1]]), kind: 'probe_reception_separation',
      actions: [{ action_ref: action }], poses: [pose], delta, conditional: true, hypotheses: config.reception_models,
      evidence: unique([...pending.evidence, ...method.evidence, obs.observation_ref]),
      unknown: ['release_identity_until_current_separation', 'directed_threats', 'protective_field_effect'],
      risks: ['candidate_release_may_still_be_bound', 'unobserved_passage_or_hazard'],
      falsifiers: ['object_translates_with_body', 'reception_site_unobservable', 'body_motion_not_locally_revalidated'],
      preserve: ['nonselected_object_centres_when_currently_observable', 'current_body_identity', 'candidate_reception_site_occupancy'],
      distance: distance(pose, frame.center), residual_distance: goals.length ? Math.min(...goals.map(goal => distance(nextPose, goal))) : 0,
      pending_reception: pending, secondary_access: other.filter(pair => pair.frame.ref !== frame.ref && distance(nextPose, pair.object.center) < distance(pose, pair.object.center))
        .map(pair => ({ frame_ref: pair.frame.ref, current_distance: distance(pose, pair.object.center), after_distance: distance(nextPose, pair.object.center) })) });
  }
  return result;
}
