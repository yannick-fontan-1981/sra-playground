/** V6 parent_return.py: measured means returned to an open parent, no authority. */
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import { translated_mask, support_collisions } from './v6-reactive-contact-geometry.ts';
import { project, _mask } from './v6-reactive-contact-escape.ts';
type R = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const refs = (values: string[]): string[] => [...new Set(values)];
const shift = (box: number[], delta: number[]): number[] => box.map((v, i) => v + delta[i % 2]!);

export function _members(scene: R): R[] {
  const result: R[] = [];
  for (const e of [...scene.stones, ...(scene.current_entities ?? [])]) {
    if (!result.some(old => eq(e.id ?? null, old.id ?? null) && eq(e.signature ?? null, old.signature ?? null) && eq(e.bbox, old.bbox))) result.push(e);
  }
  return result;
}
export function _binding(scene: R | null, question: R | null, recipe: R | null, epoch: number): [R | null, string | null] {
  if (!truth(scene) || !truth(question) || !truth(question!.id) || !truth(question!.evidence)) return [null, 'durable_parent_or_current_scene_missing'];
  if (['satisfied', 'closed', 'refuted'].includes(question!.status)) return [null, 'parent_not_open'];
  if (!truth(recipe) || recipe!.status !== 'observed_nonpushing_common_translation') return [null, 'common_translation_not_observed'];
  if (recipe!.scope !== epoch || !truth(recipe!.evidence)) return [null, 'recipe_scope_or_evidence_missing'];
  const body = scene!.body, matches = _members(scene!).filter(s => eq(s.bbox, recipe!.subject_box) && eq(s.palette_value, recipe!.subject_value));
  if (matches.length !== 1) return [null, 'current_member_not_unique'];
  const subject = matches[0]!;
  if (eq(subject.bbox, body.bbox) || eq(subject.bbox, scene!.peer.bbox)) return [null, 'service_member_is_control_or_pursued_peer'];
  if (!eq([0, 1].map(i => subject.bbox[i] - body.bbox[i]), recipe!.offset)) return [null, 'current_member_relation_contradicts_recipe'];
  return [subject, null];
}

export function offers(scene: R | null, question: R | null, recipe: R | null, directions: Record<string, number[]>,
  remaining: number, observation_ref: string, epoch: number): [R[], R] {
  const [subject, refusal] = _binding(scene, question, recipe, epoch);
  if (refusal) return [[], { status: 'abstain', reason: refusal }];
  const s = scene!, q = question!, r = recipe!, member = subject!, projection = project(s, r, observation_ref, epoch),
    evidence = refs([observation_ref, ...q.evidence, ...r.evidence]), rows: R[] = [];
  for (const placement of projection.placements ?? []) {
    const geometry = placement.geometry ?? {}; if (!truth(geometry.removed_peer_destinations)) continue;
    let keys: string[] = [...(placement.route_keys ?? [])]; if (keys.length && keys[0] === s.bodykey) keys = keys.slice(1);
    let previous: string = s.bodykey, valid = keys.length > 0;
    const actions: R[] = [], expected: number[][] = [], parts: number[][] = [];
    for (const k of keys) {
      const a = s.tiles[previous].box, b = s.tiles[k].box, delta = [b[0] - a[0], b[1] - a[1]],
        candidates = Object.entries(directions).filter(([, vector]) => eq(vector.map(v => v * s.pitch), delta)).map(([name]) => name);
      if (candidates.length !== 1) { valid = false; break; }
      actions.push({ action_ref: candidates[0] }); expected.push(shift(expected.at(-1) ?? s.body.bbox, delta));
      parts.push(shift(parts.at(-1) ?? member.bbox, delta)); previous = k;
    }
    if (!valid || actions.length > remaining) continue;
    const prefix = Math.min(16, actions.length), context = symbolicDigest([epoch, s.grid, s.body.bbox, member.bbox,
      s.peer.bbox, r.evidence, placement.subject_box]), prior = q.parent_experiments?.[context];
    if (truth(prior) && ['contradicted', 'observed_no_domain_change'].includes(prior.status)) continue;
    rows.push({ kind: 'parent_escape_configuration_access', subject: copy(member), actions: actions.slice(0, prefix),
      expected: expected.slice(0, prefix), expected_subjects: parts.slice(0, prefix), expected_subject: parts[prefix - 1],
      expected_peer: [...s.peer.bbox], cost: prefix, peer_distance: geometry.peer_degree_after ?? 0,
      route: keys.slice(0, prefix), full_access_cost: actions.length, access_complete_in_prefix: prefix === actions.length,
      body: copy(s.body), parent: copy(q), context, evidence, recipe_binding: copy(r), epoch,
      preserved_subjects: s.stones.filter((stone: R) => !eq(stone.bbox, member.bbox)).map((stone: R) => ({ bbox: [...stone.bbox], value: stone.palette_value })),
      facts: { current_control_bound: true, counteracted_approach_observed: true, subject_current_unique: true, retreat_exists: true,
        current_scope_and_input: false, parent_dependency_satisfied: true, geometric_exit_change_predicted: true },
      calculation: { consumer: q.id, dependency: 'observed_common_translation', projection: copy(geometry), domain_binding: projection.binding ?? null,
        target_configuration: { body_box: placement.body_box, subject_box: placement.subject_box },
        conditional_model: ['rigid_translation_retains_offset', 'peer_stays_at_current_pose_during_access'],
        conditional_return_access: [s.bodykey, ...keys.slice(0, prefix)].reverse(),
        falsifiers: ['body_or_part_arrival_differs', 'peer_response', 'other_subject_changed', 'scope_changed'],
        unknown: ['flee_policy', 'response_order', 'detach_effect', 'capture_law'], alternatives: copy(q.alternatives ?? []),
        capture_or_complete_escape_closure_proved: false, prefix_cut_reason: prefix < actions.length ? 'release_limit' : 'access_then_reobserve_peer' } });
  }
  return [rows, { status: rows.length ? 'candidates' : 'abstain', reason: rows.length ? 'current_parent_configuration_question' : 'no_current_reachable_exit_change',
    projection_status: projection.status ?? null, unknowns: projection.unknowns ?? [], absence_is_not_impossibility: true }];
}

export function validate_current(scene: R | null, offer: R, index: number, epoch: number): R {
  if (!truth(scene) || epoch !== offer.epoch || index < 0 || index >= offer.actions.length) return { admitted: false, reason: 'scope_or_step_mismatch' };
  const s = scene!, body = index === 0 ? offer.body.bbox : offer.expected[index - 1],
    part = index === 0 ? offer.subject.bbox : offer.expected_subjects[index - 1],
    members = _members(s).filter(member => eq(member.bbox, part) && eq(member.palette_value, offer.subject.palette_value)
      && eq(member.signature, offer.subject.signature)),
    preserved = offer.preserved_subjects.every((p: R) => s.stones.some((stone: R) => eq(stone.bbox, p.bbox) && eq(stone.palette_value, p.value)));
  let admitted = eq(s.body.bbox, body) && eq(s.body.signature, offer.body.signature) && members.length === 1
    && eq(s.peer.bbox, offer.expected_peer) && preserved;
  if (admitted) {
    const terrain = new Map<string, [string, string]>();
    for (const k of s.admitted) for (let x = s.tiles[k].box[0]; x <= s.tiles[k].box[2]; x++) {
      for (let y = s.tiles[k].box[1]; y <= s.tiles[k].box[3]; y++) terrain.set(`${x},${y}`, ['SUPPORTED', offer.evidence[0]]);
    }
    for (const point of _mask(members[0]!)) terrain.set(point.join(','), ['SUPPORTED', offer.evidence[0]]);
    const target = offer.expected[index], delta = [0, 1].map(i => target[i] - s.body.bbox[i]),
      obstacles = s.stones.filter((stone: R) => !eq(stone.bbox, part)).flatMap((stone: R) => _mask(stone)),
      [blocked, unknown] = support_collisions(translated_mask(_mask(s.body), delta), translated_mask(_mask(members[0]!), delta),
        terrain, [...obstacles, ..._mask(s.peer)]);
    admitted = !truth(blocked) && !truth(unknown);
  }
  return { admitted, reason: 'current_parent_rigid_members_peer_and_preservations', parent_ref: offer.parent.id, method_evidence: offer.recipe_binding.evidence };
}

export function reconcile(question: R, recipe: R, offer: R, index: number, scene: R | null, observation_ref: string, epoch: number): R {
  const q = copy(question), r = copy(recipe), prior = q.last_parent_consumption ?? {};
  if (prior.offer_context === offer.context && prior.executed_index === index && prior.observation_ref === observation_ref) {
    return { question: q, recipe: r, receipt: copy(prior) };
  }
  const expectedBody = offer.expected[index], expectedPart = offer.expected_subjects[index],
    matched = Boolean(scene && epoch === offer.epoch && eq(scene.body.bbox, expectedBody) && eq(scene.body.signature, offer.body.signature)
      && _members(scene).filter(member => eq(member.bbox, expectedPart) && eq(member.palette_value, r.subject_value)
        && eq(member.signature, offer.subject.signature)).length === 1),
    peerSame = Boolean(scene && eq(scene.peer.bbox, offer.expected_peer));
  if (matched) { r.subject_box = [...expectedPart]; r.evidence = refs([...r.evidence, observation_ref]); }
  const receipt = { status: matched ? 'conditional_access_step_observed' : 'contradicted', parent_ref: q.id,
    offer_context: offer.context, observation_ref, executed_index: index, rigid_translation_matched: matched,
    peer_stationary_matched: peerSame, parent_goal_satisfied: false, seal_prefix: !matched || !peerSame || index + 1 === offer.actions.length };
  q.status = matched ? 'active_with_observed_rigid_transport_method' : 'active_needs_binding_revalidation';
  q.last_parent_consumption = receipt; q.parent_experiments ??= {}; q.parent_experiments[offer.context] = copy(receipt); q.available_method = copy(r);
  return { question: q, recipe: r, receipt };
}

export const validateCurrent = validate_current;
