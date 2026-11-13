/** Original observed_inventory/local_contact.py: current regional contrasts. */
import { enclosed } from './v6-inventory-endpoints.ts';
import { pythonEqual as eq, pythonTruthy as truth } from './v6-operations.ts';
import type { NativeRows } from './v6-native-types.ts';
type R = Record<string, any>;
const copy = <T>(v: T): T => structuredClone(v);
const distinct = <T>(values: T[]): T[] => [...new Set(values)];
export function pixels(rows: NativeRows, box: readonly number[]): number[][] {
  const [l, t, r, b] = box; return rows.slice(t, b! + 1).map(row => [...row.slice(l, r! + 1)]);
}

export function targets(scene: R, obs: R, rows: NativeRows, memories: R[], methods: R[], prior: R): any[] {
  const out: any[] = [];
  for (const item of memories) {
    const arrival = item.arrival, box = item.source_bbox;
    if (!truth(arrival) || item.level_epoch !== obs.level_epoch || !enclosed(scene.body, box)) continue;
    if (!eq(pixels(rows, box), arrival.current_pixels) || truth(item.contact_attempted) || truth(arrival.context_question_pending) || truth(arrival.context_question_returned)) continue;
    const compatible = methods.filter(m => m.status === 'observed_local_operator_change' && truth(m.evidence) && obs.available_action_refs.includes(m.action.action_ref));
    if (new Set(compatible.map(m => m.action.action_ref)).size > 1) continue;
    const method = compatible.at(-1) ?? null, cmd = method ? method.action.action_ref : prior.interaction;
    if (!obs.available_action_refs.includes(cmd) || Object.hasOwn(prior.directions, cmd)) continue;
    out.push([item.source_cell, { current_changed_endpoint: arrival.changed_outside_control > 0,
      current_nonreactive_selected_endpoint: arrival.status === 'distinct_endpoint_reached_without_outside_response',
      declared_local_operator_available: method === null, observed_local_operator_revalidated: method !== null },
    { ...copy(item), method_action: { action_ref: cmd }, method: method ?? {}, evidence: [...arrival.evidence, ...(method?.evidence ?? [])],
      other_available_nondirectional_inputs: (obs.available_action_refs as string[]).filter(a => !Object.hasOwn(prior.directions, a) && a !== cmd), endpoint_contact: true }]);
  }
  return out;
}

export function reconcile(memories: R[], methods: R[], proposal: R | null, index: number, before: R, after: R,
  first: NativeRows, second: NativeRows, outcome: R, underlays: Map<string, R> | null = null): R | null {
  if (!truth(proposal) || !Object.hasOwn(proposal!, 'inventory_plan') || before.level_epoch !== after.level_epoch) return null;
  const offer = proposal!.inventory_plan.offer, kind = offer.kind, target = offer.target, step = proposal!.steps[index];
  const position_matched = Object.hasOwn(outcome, 'body_position_matched') ? outcome.body_position_matched : outcome.matched ?? null;
  if (['endpoint_approach_candidate', 'context_reconfiguration_candidate'].includes(kind) && step.expected_after != null
    && position_matched === true && eq(step.to_cell, offer.route.target_cell)) {
    const discrepancy = outcome.matched === true ? null : { status: 'other_expectations_not_confirmed', body_position_matched: true,
      matched: outcome.matched ?? null, preservation_matched: outcome.preservation_matched ?? null };
    const box = target.source_bbox, body = step.expected_after.body_bbox, old = step.body_before, [l, t, r, b] = box;
    const changed: number[][] = [];
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++)
      if (first[y]![x] !== second[y]![x] && !enclosed([x, y, x, y], body) && !enclosed([x, y, x, y], old)) changed.push([x, y]);
    const distinct_unchanged = !changed.length && target.endpoint_role === 'unknown' && truth(target.cell_pixels)
      && new Set((target.cell_pixels as number[][]).flat()).size > 1 && eq(pixels(first, box), target.cell_pixels) && enclosed(body, box) && !enclosed(old, box);
    if (!changed.length && !distinct_unchanged) return null;
    const status = changed.length ? 'changed_endpoint_reached' : 'distinct_endpoint_reached_without_outside_response';
    for (const item of memories) if (item.level_epoch === after.level_epoch && eq(item.source_cell, target.source_cell)) {
      item.arrival = { status, selected_region_preimage: copy(target.cell_pixels ?? null), unknown: ['effect_under_control', 'nonlocal_effect', 'operator_role'],
        evidence: [before.observation_ref, after.observation_ref], changed_outside_control: changed.length, current_pixels: pixels(second, box), body_bbox: body,
        remote_effects: copy(outcome.remote_effects ?? null), effect_scope_reconciliation: copy(outcome.effect_scope_reconciliation ?? null) };
      delete item.contact_attempted;
      if (discrepancy) item.arrival.prediction_discrepancy = copy(discrepancy);
      if (kind === 'context_reconfiguration_candidate') item.arrival.context_question_pending = copy(target.context_question);
      const under = underlays?.get((old as number[]).join(',')) ?? {}, source_box = under.cell_bbox, patch = under.patch;
      if (under.epoch === before.level_epoch && truth(source_box) && truth(patch) && truth(under.evidence)) {
        const [sl, st, sr, sb] = source_box; let agrees = patch.length === sb - st + 1 && patch.every((row: number[]) => row.length === sr - sl + 1);
        if (agrees) for (let y = st; y <= sb; y++) for (let x = sl; x <= sr; x++)
          if (!enclosed([x, y, x, y], old) && first[y]![x] !== patch[y - st][x - sl]) agrees = false;
        if (agrees) item.arrival.entered_support = { cell_bbox: copy(source_box), patch: copy(patch), evidence: copy(under.evidence), control_signature: offer.scene.body_signature };
      }
    }
    const event: R = { status, local_changed_pixels: changed.length, remote_effects: copy(outcome.remote_effects ?? null),
      effect_scope_reconciliation: copy(outcome.effect_scope_reconciliation ?? null), evidence: [before.observation_ref, after.observation_ref], role: 'unknown' };
    if (discrepancy) event.prediction_discrepancy = copy(discrepancy);
    return event;
  }
  if (kind === 'context_reconfiguration_candidate' && step.expected_after == null) {
    const question = target.context_question ?? {}, box = target.source_bbox;
    for (const item of memories) {
      const arrival = truth(item.arrival) ? item.arrival : {}, pending = truth(arrival.context_question_pending) ? arrival.context_question_pending : {};
      if (item.level_epoch !== after.level_epoch || !eq(item.source_cell, target.source_cell)
        || !eq(pending.association_ref ?? null, question.association_ref ?? null) || !eq(pending.context_key ?? null, question.context_key ?? null)) continue;
      delete arrival.context_question_pending;
      arrival.context_question_returned = { association_ref: question.association_ref, context_key: question.context_key,
        evidence: [before.observation_ref, after.observation_ref], local_contact_site_unchanged: eq(pixels(first, box), pixels(second, box)),
        other_compositions_preserved: outcome.preservation_matched === true };
      if (eq(pixels(first, box), pixels(second, box))) { arrival.current_pixels = pixels(second, box); arrival.current_revalidation_evidence = [before.observation_ref, after.observation_ref]; }
    }
    return null;
  }
  if (!['local_contact_probe_candidate', 'local_contact_recall_candidate'].includes(kind)) return null;
  const box = target.source_bbox, changed = !eq(pixels(first, box), pixels(second, box)), preserved = outcome.preservation_matched === true;
  let outside_changes = 0;
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++)
    if (first[y]![x] !== second[y]![x] && !enclosed([x, y, x, y], box)) outside_changes++;
  for (const item of memories) if (item.level_epoch === before.level_epoch && eq(item.source_cell, target.source_cell))
    item.contact_attempted = { after: after.observation_ref, changed, other_compositions_preserved: preserved, current_pixels: pixels(second, box) };
  const event = { status: changed && preserved ? 'observed_local_operator_change' : 'local_contact_no_supported_effect', action: copy(step.action),
    evidence: [before.observation_ref, after.observation_ref], level_epoch: before.level_epoch, local_changed: changed,
    visible_changes_outside_contact: outside_changes, hidden_or_delayed_effect: 'unknown', other_compositions_preserved: preserved,
    remote_effects: copy(outcome.remote_effects ?? null), effect_scope_reconciliation: copy(outcome.effect_scope_reconciliation ?? null),
    unknown: ['object_role', 'terminal_rule', 'utility', 'other_input_effects', 'effect_under_control', 'delayed_effect', 'missing_precondition', 'nonlocal_effect'] };
  if (changed && preserved) { methods.push(copy(event)); methods.splice(0, Math.max(0, methods.length - 16)); }
  return event;
}

export function departure_support(scene: R, obs: R, rows: NativeRows, memories: R[], equivalence: R | null = null): R | null {
  const candidates: R[] = [], descriptions: R[] = [];
  for (const item of memories) {
    const arrival = truth(item.arrival) ? item.arrival : {}, source = arrival.entered_support, box = item.source_bbox, attempt = item.contact_attempted;
    if (item.level_epoch !== obs.level_epoch || !truth(source) || !truth(source.evidence) || !truth(arrival.evidence) || !enclosed(scene.body, box)) continue;
    if (!eq(source.control_signature, scene.body_signature) || truth(attempt) && !truth(attempt.other_compositions_preserved)) continue;
    const current = truth(attempt) ? attempt.current_pixels : arrival.current_pixels;
    if (!eq(pixels(rows, box), current) || !eq(pixels(rows, source.cell_bbox), source.patch)) continue;
    const patch = source.patch, [l, t, r, b] = box, [sl, st, sr, sb] = source.cell_bbox, [bl, bt, br, bb] = scene.body;
    if (!eq([r - l, b - t], [sr - sl, sb - st]) || eq(box, source.cell_bbox)) continue;
    const exterior: number[][] = [];
    for (let y = 0; y <= b - t; y++) for (let x = 0; x <= r - l; x++)
      if (!(bl <= l + x && l + x <= br && bt <= t + y && t + y <= bb)) exterior.push([x, y]);
    const candidate: R = { level_epoch: obs.level_epoch, body_bbox: [...scene.body], cell_bbox: [...box],
      prior_exterior: exterior.map(([x, y]) => [x, y, patch[y!][x!]]), current_exterior: exterior.map(([x, y]) => [x, y, rows[t + y!]![l + x!]]),
      evidence: distinct([...source.evidence, ...arrival.evidence, ...(arrival.current_revalidation_evidence ?? []), ...(truth(attempt) ? [attempt.after] : []), obs.observation_ref]),
      source_cell_bbox: source.cell_bbox, qualification: 'entered_support_and_current_endpoint_revalidated_departure_still_conditional' };
    candidates.push(candidate);
    if (truth(equivalence)) {
      const excluded = equivalence!.descriptive_fields ?? [];
      candidate.current_witness_context = Object.fromEntries(Object.entries(item).filter(([k]) => !excluded.includes(k)).map(([k, v]) => [k, copy(v)]));
      descriptions.push(Object.fromEntries(excluded.filter((k: string) => Object.hasOwn(item, k)).map((k: string) => [k, copy(item[k])])));
    }
  }
  if (truth(equivalence) && equivalence!.mode === 'identical_current_support_witnesses') {
    const unique: R[] = []; for (const candidate of candidates) if (!unique.some(v => eq(v, candidate))) unique.push(candidate);
    if (unique.length === 1 && candidates.length > 1) return { ...unique[0], equivalent_witnesses: { declaration_ref: equivalence!.id,
      descriptions_preserved: candidates.length, retained_descriptions: descriptions, all_current_facts_equal: true, physical_object_identity_asserted: false } };
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

export function equivalent_current_contact_offers(options: R[], declaration: R, digest: (value: unknown) => string): R[] {
  const groups = new Map<string, R[]>(), unchanged: R[] = [];
  for (const option of options) {
    const target = option.target, scene = option.scene, arrival = truth(target.arrival) ? target.arrival : {};
    if (!(declaration.kinds ?? []).includes(option.kind) || !truth(target.endpoint_contact) || !truth(arrival.current_pixels)
      || !truth(arrival.evidence) || arrival.evidence.at(-1) !== scene.observation_ref || target.level_epoch !== scene.level_epoch) { unchanged.push(option); continue; }
    const meaning = copy(option); for (const field of declaration.descriptive_fields) delete meaning.target[field];
    const k = digest(meaning); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(option);
  }
  for (const [k, items] of groups) {
    if (items.length === 1) { unchanged.push(items[0]!); continue; }
    const chosen = copy(items[0]!); chosen.target.equivalent_descriptions = items.map(item => copy(item.target));
    chosen.target.equivalence = { declaration_ref: declaration.id, current_continuation_digest: k, meaning: declaration.meaning, physical_object_identity_asserted: false };
    chosen.target.evidence = distinct(items.flatMap(item => [...(item.target.evidence ?? []), item.target.observed_at]));
    unchanged.push(chosen);
  }
  return unchanged;
}
