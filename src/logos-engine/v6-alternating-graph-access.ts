/** AlternatingGraphAccess's own unchanged-source layer.
 * The shared owner calls the inherited record first, then this layer, then the
 * coupled-pair layers. No inherited event or graph policy is inferred here.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';
import { alternatingHistogram as histogram, alternatingOverlays as overlays, measureAlternatingGraph as measure } from './v6-alternating-graph-observation.ts';
import { alternatingTopology as topology, instrumentalAlternatingContact as instrumentalContact } from './v6-alternating-graph-questions.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Box = readonly [number, number, number, number];
export interface AlternatingGraphState {
  readonly graph_samples: readonly R[];
  readonly graph_refused: readonly string[];
  readonly graph_terminal: readonly R[];
  readonly graph_events: readonly R[];
  readonly graph_calibration: R | null;
  readonly graph_contacts: readonly R[];
  readonly graph_removals: readonly R[];
}
const copy = <T>(value: T): T => structuredClone(value);
function lastWhere<T>(values: readonly T[], predicate: (value: T) => boolean): T | undefined {
  for (let index = values.length - 1; index >= 0; index--) if (predicate(values[index]!)) return values[index];
  return undefined;
}
// Source event snapshots own their cumulative fields independently. Internal
// immutable sharing must not introduce mutable aliases in a public snapshot.
function independent<T>(value: T): T {
  if (Array.isArray(value)) return value.map(independent) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, independent(child)])) as T;
  return value;
}
export function alternatingGraphSignature(actor: R): string { return identity([actor.size, actor.histogram]); }
const boxAt = (position: readonly number[], size: number): Box => [position[0]!, position[1]!, position[0]! + size - 1, position[1]! + size - 1];
function points(box: Box): string[] {
  const result: string[] = [];
  for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) result.push(`${y},${x}`);
  return result;
}
function pixel(rows: NativeRows, row: number, column: number): number {
  const value = rows.at(row)?.at(column);
  if (value === undefined) throw new RangeError('Alternating graph observation index is outside its public frame');
  return value;
}
function graphStep(plan: R, index: number): R {
  const step = plan.steps.at(index);
  if (step === undefined) throw new RangeError('list index out of range');
  return step;
}
export { boxAt as alternatingGraphBoxAt, points as alternatingGraphPoints };

/** Source graph-plan branch only; the shared owner dispatches other plans. */
export function alternatingGraphBefore(proposal: R, index: number, rows: NativeRows,
  meta: { epoch: number; score: number; observation_ref: string; available: readonly string[] }): R {
  const plan = proposal.graph_access_plan;
  if (!truth(plan)) throw new TypeError('Alternating graph admission requires a graph_access_plan');
  const step = graphStep(plan, index), box = boxAt(step.from, plan.actor.size);
  let admitted = equal([meta.epoch, meta.score], [plan.epoch, plan.score]) && equal(proposal.actions, plan.commands)
    && equal(proposal.bundle_template.actions, proposal.actions) && meta.available.includes(step.action_ref)
    && equal(histogram(rows, box), plan.actor.histogram);
  if (index === 0) admitted = admitted && identity(rows) === plan.initial_digest && meta.observation_ref === plan.observation_ref;
  return { admitted, reason: admitted ? 'current_graph_actor_and_command_bound' : 'graph_context_or_payload_changed' };
}

export function alternatingGraphAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows,
  meta: { epoch: number; score: number; state: string }): R {
  const plan = proposal.graph_access_plan;
  if (!truth(plan)) throw new TypeError('Alternating graph outcome requires a graph_access_plan');
  if (!equal([meta.epoch, meta.score], [plan.epoch, plan.score]) || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const step = graphStep(plan, index), size = plan.actor.size, old = boxAt(step.from, size), destination = boxAt(step.to, size);
  const allowed = new Set([...points(old), ...points(destination)]);
  let extra = 0;
  for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[0]!.length - 1; x++) {
    if (pixel(rows, y, x) !== pixel(later, y, x) && !allowed.has(`${y},${x}`)) extra++;
  }
  const moved = equal(histogram(later, destination), plan.actor.histogram);
  const vacated = equal(histogram(later, old), [[plan.measurement.alternating_material_first_value, size * size]]);
  const matched = moved && vacated && extra === 0;
  return { matched: truth(step.ordinary_support) ? matched : null, seal_prefix: !matched || !truth(step.ordinary_support),
    reason: matched ? 'conditional_graph_displacement' : 'graph_displacement_or_extra_effect_diverged', extra_effect_count: extra,
    contact_effect_unknown: !truth(step.ordinary_support) };
}

export class AlternatingGraphMemory {
  private samples: R[] = [];
  private refused = new Set<string>();
  private terminal: R[] = [];
  private events: R[] = [];
  private calibration: R | null = null;
  private contacts: R[] = [];
  private removals: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }

  applyEvent(event: R): void {
    if (event.kind !== 'alternating_graph_evidence') throw new TypeError(`Outside alternating graph layer: ${String(event.kind)}`);
    if (!Array.isArray(event.samples) || !Array.isArray(event.refused) || !Array.isArray(event.terminal)) {
      throw new TypeError('Alternating graph evidence lacks its complete current projection');
    }
    const owned = retainNativeJson(event);
    this.version++; this.samples = owned.samples; this.refused = new Set(owned.refused); this.terminal = owned.terminal;
    this.calibration = owned.calibration ?? null; this.contacts = owned.contacts ?? []; this.removals = owned.removals ?? [];
    this.events.push(owned);
  }

  emitGraph(detail: R): R {
    const event = { kind: 'alternating_graph_evidence', samples: this.samples, refused: [...this.refused].sort(compareUnicode),
      terminal: this.terminal, calibration: this.calibration, contacts: this.contacts, removals: this.removals, detail };
    this.applyEvent(event);
    return independent(event);
  }

  proposeGraph(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R): R {
    const cfg = config.alternating_graph_question;
    if (!truth(cfg) || maxPrefix < 1) return { status: 'abstained', reason: 'graph_question_not_enabled' };
    const offers: R[] = [];
    let unresolved = false;
    for (const actor of overlays(rows)) {
      const signature = alternatingGraphSignature(actor), samples = this.samples.filter(sample => sample.signature === signature);
      const by = new Map<string, number[][]>();
      for (const sample of samples) {
        const deltas = by.get(sample.action) ?? [];
        if (!deltas.some(delta => equal(delta, sample.delta))) deltas.push(sample.delta);
        by.set(sample.action, deltas);
      }
      const controls: Record<string, readonly number[]> = Object.fromEntries([...by]
        .filter(([action, deltas]) => deltas.length === 1 && observation.available_action_refs.includes(action)).map(([action, deltas]) => [action, deltas[0]!]));
      const vectors = Object.values(controls);
      if (vectors.length < 2 || !vectors.some(delta => !equal(delta, vectors[0]))) continue;
      let evidence = samples.flatMap(sample => sample.evidence);
      const last = lastWhere(samples, sample => Object.hasOwn(controls, sample.action))?.action ?? null;
      let measurement = measure(rows, observation, actor, controls, evidence, last, truth(cfg.marker_precaution_hypothesis ?? false));
      let route: readonly string[] = measurement.alternating_material_first_shortest_action_refs ?? [], instrumental: R | null = null;
      const pending = lastWhere(this.contacts, contact => contact.epoch === observation.level_epoch
        && contact.status === 'occlusion_or_removal_unknown' && truth(contact.requires_revalidation)
        && equal(contact.bbox, actor.bbox) && contact.actor_signature === signature);
      if (pending && truth(this.calibration)) {
        const delta = [pending.entry_from[0] - actor.bbox[0], pending.entry_from[1] - actor.bbox[1]];
        const reverse = Object.keys(controls).filter(action => equal(controls[action], delta));
        if (reverse.length === 1) {
          route = reverse; measurement = copy(this.calibration!); measurement.alternating_material_measurement_frame_ref = observation.observation_ref;
          instrumental = { validation_departure: true, evidence: pending.evidence,
            scope: 'Return once to the observed entry support and inspect the previously covered occurrence before depending on its absence.' };
          evidence = [...evidence, ...pending.evidence];
        } else { unresolved = true; continue; }
      }
      if ((!truth(route) || !truth(measurement.translated_overlay_matches_alternating_pitch_and_edge)) && truth(this.calibration)) {
        if (truth(topology(rows, actor, this.calibration!))) {
          unresolved = true;
          instrumental = instrumentalContact(rows, actor, controls, this.calibration!, this.removals,
            Object.hasOwn(config, 'remaining_level_actions') ? config.remaining_level_actions : 40);
          if (truth(instrumental)) {
            const raw = measurement; measurement = copy(this.calibration!);
            Object.assign(measurement, { alternating_material_measurement_frame_ref: observation.observation_ref,
              alternating_material_graph_node_count: instrumental!.node_count, alternating_material_graph_edge_count: instrumental!.edge_count,
              static_current_measurement: raw });
            route = instrumental!.prefix.map((step: R) => step.action_ref); evidence = [...evidence, ...instrumental!.evidence];
          }
        }
      }
      if (!truth(route)) continue;
      const size = actor.size, steps: R[] = [];
      let position = actor.bbox.slice(0, 2);
      const trial = identity([observation.level_epoch, signature, position, rows, route[0]]);
      if (this.refused.has(trial)) continue;
      for (const action of route.slice(0, maxPrefix)) {
        const delta = controls[action]!, destination = [position[0]! + delta[0]!, position[1]! + delta[1]!];
        const histogramValue = histogram(rows, boxAt(destination, size));
        const ordinary = equal(histogramValue, [[measurement.alternating_material_first_value, size * size]]);
        steps.push({ action_ref: action, from: position, to: destination, destination_histogram: histogramValue, ordinary_support: ordinary });
        position = destination; if (!ordinary) break;
      }
      if (!steps.length) continue;
      offers.push({ epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
        initial_digest: identity(rows), actor, signature, steps, measurement, evidence, trial, instrumental_contact: instrumental,
        scope: 'Conditional measured lattice access. Exceptional uniform overlay is a possible objective; directional-marker exclusion is a supplied precaution hypothesis, not acquired reaction physics. Contact closes the set. Border signal changes are observed but do not certify resource semantics.' });
    }
    if (offers.length !== 1) return { status: 'abstained', reason: unresolved ? 'graph_change_question_unresolved' : 'graph_access_absent_or_ambiguous', block_unrelated_probe: unresolved };
    const plan = offers[0]!, actions = plan.steps.map((step: R) => ({ action_ref: step.action_ref }));
    // The source identity precedes insertion of the committed command list.
    const ref = 'C_graph_access_' + identity(plan).slice(0, 18);
    const why = truth(plan.instrumental_contact) && Object.hasOwn(cfg, 'instrumental_question') ? cfg.instrumental_question : cfg.question;
    const facts = { current_alternating_graph_measured: true, action_conditioned_overlay_bound: true, reaction_and_terminal_roles_remain_conditional: true };
    const evidence = [observation.observation_ref, ...plan.evidence]; plan.commands = copy(actions);
    return { status: 'proposed', kind: 'alternating_graph_access', proposal_id: ref, graph_access_plan: plan, actions,
      steps: actions.map((action: R, index: number) => ({ action, expected_after: { actor_position: plan.steps[index].to,
        contact_effect: truth(plan.steps[index].ordinary_support) ? 'conditional_support_arrival' : 'unknown' } })), facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'reuse_measured_multimaterial_graph_access', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** Own source record only; the owner has already acquired the parent layer. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.graph_access_plan, detail: R = { before: before.observation_ref, after: after.observation_ref, action: command.action_ref };
    let changed = false;
    if (truth(plan) && truth(plan.measurement.unique_alternating_material_graph_description_present)) {
      const calibration = copy(plan.measurement); delete calibration.static_current_measurement;
      this.version++; this.calibration = retainNativeJson(calibration); changed = true;
    }
    if (equal([before.level_epoch, before.levels_completed], [after.level_epoch, after.levels_completed])) {
      const first = overlays(rows), second = overlays(later), pairs: { first: R; second: R; delta: number[] }[] = [];
      for (const actor of first) {
        const signature = alternatingGraphSignature(actor), matches = second.filter(next => alternatingGraphSignature(next) === signature);
        if (matches.length === 1 && first.filter(other => alternatingGraphSignature(other) === signature).length === 1) {
          const next = matches[0]!, delta = [next.bbox[0] - actor.bbox[0], next.bbox[1] - actor.bbox[1]];
          if ((delta[0] === 0) !== (delta[1] === 0)) pairs.push({ first: actor, second: next, delta });
        }
      }
      if (pairs.length === 1) {
        const { first: actor, second: next, delta } = pairs[0]!, signature = alternatingGraphSignature(actor);
        this.version++; this.samples = [...this.samples, retainNativeJson({ signature, histogram: actor.histogram, size: actor.size,
          action: command.action_ref, delta, epoch: before.level_epoch, from: actor.bbox.slice(0, 2), to: next.bbox.slice(0, 2),
          evidence: [before.observation_ref, after.observation_ref] })];
        changed = true; detail.observed_translation = delta;
        if (truth(this.calibration)) {
          const added = first.filter(guard => equal(guard.bbox, next.bbox) && alternatingGraphSignature(guard) !== signature).map(guard => retainNativeJson({
            epoch: before.level_epoch, guard_histogram: guard.histogram, size: guard.size, bbox: guard.bbox, actor_signature: signature,
            entry_from: actor.bbox.slice(0, 2), evidence: [before.observation_ref, after.observation_ref], status: 'occlusion_or_removal_unknown',
            requires_revalidation: truth(plan) && truth(plan.instrumental_contact) }));
          let contacts = [...this.contacts, ...added], removals = this.removals;
          contacts = contacts.map(contact => {
            if (contact.epoch !== after.level_epoch || contact.status !== 'occlusion_or_removal_unknown' || equal(contact.bbox, next.bbox)) return contact;
            const current = histogram(later, contact.bbox);
            if (equal(current, [[this.calibration!.alternating_material_first_value, contact.size ** 2]])) {
              const revealed = retainNativeJson({ ...contact, status: 'ordinary_support_revealed_after_departure', evidence: [...contact.evidence, after.observation_ref] });
              removals = [...removals, revealed]; detail.revealed_contact_support = contact.bbox; return revealed;
            }
            return equal(current, contact.guard_histogram) ? retainNativeJson({ ...contact, status: 'occlusion_confirmed_no_removal' }) : contact;
          });
          this.contacts = contacts; this.removals = removals;
        }
      }
      if (truth(plan)) {
        const outcome = alternatingGraphAfter(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
        detail.outcome = outcome;
        if (outcome.matched === false) { this.version++; this.refused.add(plan.trial); changed = true; }
      }
    } else if (truth(plan) && after.levels_completed > before.levels_completed) {
      this.version++; this.terminal = [...this.terminal, retainNativeJson({ epoch: before.level_epoch,
        destination_histogram: graphStep(plan, index).destination_histogram, evidence: [before.observation_ref, after.observation_ref],
        scope: 'observed completion witness; no universal terminal predicate' })]; changed = true;
    }
    return changed ? [this.emitGraph(detail)] : [];
  }

  state(): AlternatingGraphState {
    return independent({ graph_samples: this.samples, graph_refused: [...this.refused].sort(compareUnicode), graph_terminal: this.terminal,
      graph_events: this.events, graph_calibration: this.calibration, graph_contacts: this.contacts, graph_removals: this.removals });
  }
  retainedDigest(parentDigest: string): string {
    return identity([parentDigest, this.samples, [...this.refused].sort(compareUnicode), this.terminal, this.events, this.calibration, this.contacts, this.removals]);
  }
  restore(state: AlternatingGraphState): void {
    if (!state || !Array.isArray(state.graph_events) || !Array.isArray(state.graph_samples) || !Array.isArray(state.graph_refused)
      || !Array.isArray(state.graph_terminal) || !Object.hasOwn(state, 'graph_calibration') || !Array.isArray(state.graph_contacts) || !Array.isArray(state.graph_removals)) {
      throw new TypeError('Incomplete alternating graph memory');
    }
    const rebuilt = new AlternatingGraphMemory();
    for (const event of state.graph_events) rebuilt.applyEvent(event);
    if (identity(rebuilt.state()) !== identity(state)) throw new TypeError('Alternating graph state differs from its complete event journal');
    this.samples = rebuilt.samples; this.refused = rebuilt.refused; this.terminal = rebuilt.terminal; this.events = rebuilt.events;
    this.calibration = rebuilt.calibration; this.contacts = rebuilt.contacts; this.removals = rebuilt.removals; this.version++;
  }
}
