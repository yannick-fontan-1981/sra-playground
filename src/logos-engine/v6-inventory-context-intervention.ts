/** Original observed_inventory/context_intervention.py: observed regional questions. */
import { enclosed, xybox } from './v6-inventory-endpoints.ts';
import { pixels } from './v6-inventory-local-contact.ts';
import { locate } from './v6-inventory-measurements.ts';
import { symbolicDigest } from './v6-hash.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(v: T): T => structuredClone(v);
export const digest = (value: unknown): string => symbolicDigest(value);

export function record(methods: R[], proposal: R | null, index: number, before: R, after: R,
  first: NativeRows, second: NativeRows, maximum_regions: number): R | null {
  if (!truth(proposal) || !truth(proposal!.inventory_plan) || before.level_epoch !== after.level_epoch) return null;
  const offer = proposal!.inventory_plan.offer, step = proposal!.steps[index], kind = offer.kind;
  if (step.expected_after != null || !['local_contact_probe_candidate', 'local_contact_recall_candidate', 'context_reconfiguration_candidate'].includes(kind)) return null;
  const body = step.body_before, site = offer.target.source_bbox, scene = offer.scene, domain = scene.support_effect_scope;
  if (!truth(domain) || !eq(locate(first, offer.core), body) || !eq(locate(second, offer.core), body)) return null;
  if (kind === 'context_reconfiguration_candidate') {
    const context = offer.target.context_question, prior = methods.find(m => eq(m.id ?? null, context.association_ref));
    if (!prior) return null;
    const outcomes = (prior.regions as R[]).map(r => ({ region_ref: r.ref, equals_prior: eq(pixels(second, r.bbox), r.before), equals_pre_probe: eq(pixels(second, r.bbox), pixels(first, r.bbox)) }));
    const samples: number[][] = [];
    for (const r of prior.regions as R[]) for (let y = r.bbox[1]; y <= r.bbox[3]; y++) for (let x = r.bbox[0]; x <= r.bbox[2]; x++)
      if (!enclosed([x, y, x, y], body)) samples.push([x, y, first[y]![x]!]);
    const result = { status: 'context_intervention_observed', context_key: context.context_key, evidence: [before.observation_ref, after.observation_ref],
      regional_outcomes: outcomes, context_visible_samples: samples, official_level_delta: after.levels_completed - before.levels_completed,
      unknown: ['mechanical_identity', 'hidden_effect', 'causal_law', 'repeatability', 'terminal_necessity'] };
    (prior.attempts ??= []).push(result); prior.attempts = prior.attempts.slice(-16); return result;
  }
  const [l, t, r, b] = site, anchor: number[][] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (!enclosed([x, y, x, y], body)) anchor.push([x, y, first[y]![x]!]);
  if (!anchor.length || anchor.some(([x, y, value]) => second[y!]![x!] !== value)) return null;
  const regions: R[] = [];
  for (const cell of scene.grids[0].cells as R[]) {
    const box = xybox(cell);
    if (!enclosed(box, domain.bbox) || eq(box, site) || enclosed(body, box)) continue;
    const a = pixels(first, box), z = pixels(second, box);
    if (!eq(a, z)) regions.push({ ref: `region:${digest([before.level_epoch, box]).slice(0, 20)}`, cell: [cell.row, cell.col], bbox: box,
      before: a, after: z, before_nonuniform: new Set(a.flat()).size > 1 });
  }
  if (!(2 <= regions.length && regions.length <= maximum_regions)) return null;
  const evidence = [before.observation_ref, after.observation_ref], ident = `context-association:${digest([evidence, step.action, regions])}`;
  if (methods.some(m => m.id === ident)) return null;
  const association = { id: ident, status: 'observed_multi_region_context_association', level_epoch: before.level_epoch,
    source_cell: copy(offer.target.source_cell), source_bbox: copy(site), site_anchor: anchor, body_signature: scene.body_signature,
    action: copy(step.action), regions, evidence, predictive_use_allowed: false, attempts: [],
    unknown: ['segmentation_or_appearance_change', 'mechanical_identity', 'common_cause', 'operator_law', 'inverse', 'terminal_necessity'] };
  methods.push(association); methods.splice(0, Math.max(0, methods.length - 16));
  return { status: 'regional_association_retained', association_ref: ident, regions: regions.length, evidence, prediction_authorized: false };
}

export function unchanged_visible_context(attempt: R, rows: NativeRows, body: number[]): boolean {
  const samples = (attempt.context_visible_samples ?? []).filter(([x, y]: number[]) => !enclosed([x!, y!, x!, y!], body));
  return samples.length > 0 && samples.every(([x, y, value]: number[]) => rows[y!]![x!] === value);
}

export function targets(scene: R, obs: R, rows: NativeRows, memories: R[], methods: R[], ordinary_targets: any[]): any[] {
  if (ordinary_targets.length || (scene.grids ?? []).length !== 1) return [];
  const out: any[] = [];
  for (const method of methods) {
    if (method.status !== 'observed_multi_region_context_association' || method.level_epoch !== obs.level_epoch
      || !eq(method.body_signature, scene.body_signature) || !obs.available_action_refs.includes(method.action.action_ref)) continue;
    const cell = (scene.grids[0].cells as R[]).find(c => eq([c.row, c.col], method.source_cell));
    if (!cell || !eq(xybox(cell), method.source_bbox)) continue;
    if ((method.site_anchor as number[][]).some(([x, y, value]) => !enclosed([x!, y!, x!, y!], scene.body) && rows[y!]![x!] !== value)) continue;
    const unanswered: R[] = [];
    for (const region of method.regions as R[]) {
      const known = memories.filter(m => m.level_epoch === obs.level_epoch && eq(m.source_bbox, region.bbox)
        && eq(m.cell_pixels ?? null, region.before) && !truth(m.contact_attempted));
      if (known.length && truth(region.before_nonuniform) && eq(pixels(rows, region.bbox), region.after) && !eq(region.after, region.before))
        unanswered.push({ region_ref: region.ref, bbox: region.bbox, prior_patch_sha256: digest(region.before), current_patch_sha256: digest(region.after),
          prior_observation: method.evidence[0], mechanical_identity: 'unknown' });
    }
    if (!unanswered.length) continue;
    const current = (method.regions as R[]).map(region => pixels(rows, region.bbox));
    const key = digest([method.id, current, (method.site_anchor as number[][]).map(([x, y]) => [x, y, rows[y!]![x!]])]);
    if ((method.attempts ?? []).some((a: R) => a.context_key === key || unchanged_visible_context(a, rows, scene.body))) continue;
    const relations = unanswered.map(u => [u.region_ref, 'prior_appearance_available_under_unknown_context', method.id]);
    const question = { association_ref: method.id, context_key: key, unanswered_regions: unanswered, relations,
      blocking_unknown: 'previously_distinct_unexamined_regions_do_not_match_their_current_appearances', frontier_scope: 'currently_examined_contributions_only',
      predictions: { prior_appearances_reappear: { matched_prior_regions: unanswered.map(u => u.region_ref) },
        unchanged_visible_configuration: { matched_prior_regions: [] }, different_configuration: { matched_prior_regions: 'other_or_partial' } },
      risks: ['unknown_effect_on_other_compositions', 'return_not_proven', 'changed_appearance_does_not_prove_object_identity'], evidence: [...method.evidence, obs.observation_ref] };
    out.push([method.source_cell, { observed_context_association_current: true, unexamined_prior_regions_currently_different: true, no_current_ordinary_contribution: true },
      { source_cell: copy(method.source_cell), source_bbox: copy(method.source_bbox), method_action: copy(method.action), context_question: question,
        evidence: question.evidence, level_epoch: obs.level_epoch, endpoint_role: 'unknown', cell_pixels: pixels(rows, method.source_bbox) }]);
  }
  return out;
}

export function decorate(proposal: R, obs: R): void {
  const offer = proposal.inventory_plan.offer, question = offer.target.context_question;
  if (!truth(question)) return;
  const target = `composition:context-question:${digest([obs.level_epoch, question.association_ref, question.unanswered_regions]).slice(0, 24)}`;
  const focus = proposal.compositions[0]; focus.properties.context_question = copy(question); focus.relations.push(`accesses:${target}`);
  proposal.compositions.push({ id: target, role: 'information_objective', observed: false, things: (question.unanswered_regions as R[]).map(u => u.region_ref),
    properties: { tested_relations: question.relations, blocking_unknown: question.blocking_unknown, frontier_scope: question.frontier_scope,
      predictions_are_unconfirmed_alternatives: question.predictions }, relations: [`contributes_to:${proposal.bundle_template.objective_ref}`] });
  proposal.question.information_target = target;
  if (proposal.actions.length === 1 && proposal.steps[0].expected_after === null) {
    focus.relations.push(`investigates:${target}`);
    proposal.question.context_intervention = { association_ref: question.association_ref, context_key: question.context_key,
      reconciliation_owner: 'observed_inventory.context_intervention.record', observation_ref: obs.observation_ref, level_epoch: obs.level_epoch,
      action: copy(proposal.actions[0]), distinct_outcomes: 3, relations: question.relations, predictions: question.predictions,
      evidence: question.evidence, risks: question.risks, return_steps: null, tree_key: 'composition.priority.information_value',
      question: 'Can a currently revalidated intervention expose previously unexamined appearances? No inverse or repeatability is assumed.' };
  }
}
