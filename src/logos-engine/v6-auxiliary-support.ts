/** AuxiliarySupportAccess's own source layer, after coupled-pair acquisition.
 * Ancestors and the single common journal remain owned by SharedSeries.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';
import { coupledPairAfter } from './v6-coupled-pair-evidence.ts';
import {
  auxiliarySupportPatch as patch, auxiliarySupportTranslate as translate, auxiliarySupportInside as inside,
  auxiliarySupportSelectQuestion as selectQuestion, auxiliarySupportParkingRoute as parkingRoute,
  auxiliarySupportCurrentPair as currentPair, auxiliarySupportGroupControlQuestion as groupControlQuestion,
  auxiliarySupportGroupControlResponse as groupControlResponse,
} from './v6-auxiliary-support-preparation.ts';
import {
  auxiliarySupportRecall as recall, auxiliarySupportObservedModel as observedModel,
  auxiliarySupportPrefix as prefix, auxiliarySupportCachedRoute as cachedRoute,
  auxiliarySupportRetainSuffix as retainSuffix,
} from './v6-auxiliary-support-continuation.ts';
import type { CoupledPairBox } from './v6-coupled-pair-observation.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
interface SupportMeta { epoch: number; score: number; state: string }
export interface AuxiliarySupportState {
  readonly support_state: R | null;
  readonly support_events: readonly R[];
  readonly support_models: Readonly<Record<string, R>>;
}

/** This function handles the auxiliary plan branch only; the owner dispatches ancestors. */
export function auxiliarySupportBefore(proposal: R, index: number, rows: NativeRows,
  meta: { epoch: number; score: number; observation_ref: string; available: readonly string[] }): R {
  const plan = proposal.support_preparation_plan;
  if (!truth(plan)) throw new TypeError('Auxiliary support admission requires a support_preparation_plan');
  const commands = Object.hasOwn(plan, 'commands') ? plan.commands : [plan.action];
  let admitted = equal([meta.epoch, meta.score], [plan.epoch, plan.score]) && equal(proposal.actions, commands)
    && equal(proposal.bundle_template.actions, proposal.actions) && meta.available.includes(commands.at(index).action_ref);
  if (index === 0) admitted = admitted && meta.observation_ref === plan.observation_ref && identity(rows) === plan.frame_digest;
  if (plan.mode === 'move' && truth(plan.motion_steps)) {
    const detail = plan.detail, step = plan.motion_steps.at(index), pair = detail.preserved_pair;
    admitted = admitted && equal(patch(rows, step.from), detail.selected_patch)
      && patch(rows, step.to).every(row => row.every(value => value === detail.floor))
      && pair.boxes.every((box: CoupledPairBox) => patch(rows, box).every(row => row.every(value => value === pair.value)));
  } else if (index) admitted = false;
  return { admitted, reason: admitted ? 'current_point_or_control_bound' : 'support_context_or_payload_changed' };
}

export function auxiliarySupportAfter(proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: SupportMeta): R {
  const plan = proposal.support_preparation_plan;
  if (!truth(plan)) throw new TypeError('Auxiliary support outcome requires a support_preparation_plan');
  if (!equal([meta.epoch, meta.score], [plan.epoch, plan.score]) || ['WIN', 'GAME_OVER'].includes(meta.state)) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  if (plan.mode === 'move') {
    const detail = plan.detail, step = truth(plan.motion_steps) ? plan.motion_steps.at(index) : detail.step;
    const old = step.from as CoupledPairBox, destination = step.to as CoupledPairBox, allowed = new Set<string>();
    for (const box of [old, destination]) for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) allowed.add(`${y},${x}`);
    let extra = 0;
    for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[0]!.length - 1; x++) if (!allowed.has(`${y},${x}`) && rows[y]![x] !== later[y]![x]) extra++;
    const vacated = !Object.hasOwn(detail, 'floor') || patch(later, old).every(row => row.every(value => value === detail.floor));
    const matched = equal(patch(later, destination), detail.selected_patch) && extra === 0 && vacated;
    const known = truth(Object.hasOwn(step, 'mapping_covered') ? step.mapping_covered : step.mapping_observed);
    return { matched: known ? matched : null, seal_prefix: !matched || !known, candidate_prediction_matched: matched,
      extra_effect_count: extra, vacated_support_matches: vacated,
      reason: known && matched ? 'conditional_selected_occurrence_continuation' : 'selected_occurrence_response_requires_reconciliation' };
  }
  if (plan.mode === 'verify_group') return { matched: null, seal_prefix: true,
    candidate_prediction: groupControlResponse(rows, later, plan.detail), reason: 'physical_group_control_test' };
  return { matched: null, seal_prefix: true, reason: 'selection_or_return_effect_unknown' };
}

export class AuxiliarySupportMemory {
  private supportState: R | null = null;
  private supportEvents: R[] = [];
  private supportModels: Record<string, R> = {};
  private version = 0;

  /** Includes direct public event reduction and projection restoration. */
  get nativeRevision(): number { return this.version; }

  applyEvent(event: R): void {
    const owned = retainNativeJson(event);
    if (owned.kind === 'coupled_support_control_model') {
      if (!Object.hasOwn(owned, 'model_ref') || !Object.hasOwn(owned, 'model')) throw new TypeError('Auxiliary control model event is incomplete');
      this.version++; this.supportModels[owned.model_ref] = owned.model;
    } else if (owned.kind === 'coupled_support_preparation') {
      if (!Object.hasOwn(owned, 'state')) throw new TypeError('Auxiliary support event lacks its state');
      this.version++; this.supportState = owned.state;
    } else throw new TypeError(`Outside auxiliary-support layer: ${String(owned.kind)}`);
    // Every producer clones its selected state/model before applying a delta.
    // Public state() and returned record envelopes remain independent copies.
    this.supportEvents.push(owned);
  }

  /** ordinaryCallback executes the actual parent pair planner exactly when the source calls super. */
  proposeGraph(pairState: R | null, observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number,
    config: R, ordinaryCallback: () => R): R {
    const cfg = config.coupled_pair_question ?? {}, state = pairState;
    let aux = this.supportState;
    if (!truth(cfg.prepare_unmatched_supports) || !truth(state) || state!.epoch !== observation.level_epoch) return ordinaryCallback();
    if (truth(aux) && aux!.epoch !== observation.level_epoch) aux = null;
    if (truth(aux) && aux!.phase === 'unresolved') return { status: 'abstained', reason: 'support_control_or_return_requires_evidence',
      block_unrelated_probe: true, unknown: aux!.unknown ?? null };
    const retained = state!, parked = truth(aux) ? clone(aux!.parked) : [], remaining = config.remaining_level_actions ?? 40;
    let mode: string, action: R, detail: R, motionSteps: R[] | null = null;
    if (truth(aux) && aux!.phase === 'verify_group') {
      const question = groupControlQuestion(rows, retained, aux!, observation.available_action_refs);
      if (!question) return { status: 'abstained', reason: 'no_decisive_preserved_group_control_test', block_unrelated_probe: true };
      mode = 'verify_group'; detail = question; action = { action_ref: detail.action_ref };
    } else if (!truth(aux) || aux!.phase === 'group') {
      const ordinary = ordinaryCallback();
      if (ordinary.status === 'proposed' || truth(ordinary.block_unrelated_probe)) return ordinary;
      const question = selectQuestion(rows, retained, observation.available_action_refs, remaining, parked);
      if (!question) return ordinary;
      mode = 'select'; action = { action_ref: 'ACTION6', data: question.item.point }; detail = question;
    } else {
      aux = clone(aux!); aux.recalled_moves = recall(this.supportModels, aux, observation.available_action_refs);
      const route = cachedRoute(aux, rows) ?? parkingRoute(rows, retained, aux, observation.available_action_refs, remaining);
      if (!route) return { status: 'abstained', reason: 'support_parking_context_unresolved', block_unrelated_probe: true };
      if (route.path.length) {
        motionSteps = prefix(route, aux, rows, Math.min(maxPrefix, remaining));
        if (!motionSteps.length) return { status: 'abstained', reason: 'current_physical_support_not_admitted_for_cached_path', block_unrelated_probe: true };
        mode = 'move'; const step = motionSteps[0]!; action = { action_ref: step.action_ref };
        detail = { step, parking: route, selected_patch: aux.selected_patch, box: aux.box, floor: aux.floor,
          preserved_pair: currentPair(rows, retained.pair), control_applications: aux.recalled_moves,
          question: 'Continue the same conditional parking path under current measured or structurally recalled control effects. New cells alone do not seal it. The first uncovered mode/action relation is an experimental final primitive; reconcile once after the sealed set.' };
      } else {
        mode = 'return';
        const mapped = new Set(Object.entries(retained.samples).filter(([, samples]) => (samples as R[]).some(sample => sample.deltas[0].some((value: number) => value !== 0))).map(([action]) => action));
        const choices = (observation.available_action_refs as string[]).filter(action => !mapped.has(action)
          && !['ACTION6', 'RESET', 'ACTION7'].includes(action) && !(aux!.return_tried ?? []).includes(action)).sort(compareUnicode);
        const pair = currentPair(rows, retained.pair);
        const pointReturn = pair && observation.available_action_refs.includes('ACTION6') && !(aux.return_tried ?? []).includes('ACTION6')
          && (truth(aux.return_method) || truth(aux.return_tried));
        if (pointReturn) {
          const box = pair.boxes[0]!; action = { action_ref: 'ACTION6', data: { x: Math.floor((box[1] + box[3]) / 2), y: Math.floor((box[0] + box[2]) / 2) } };
          detail = { box: aux.box, current_pair: pair, return_kind: 'current_pair_point',
            question: 'Reuse the observed point-selection relation as a hypothesis on this currently visible pair occurrence. Restoration of appearance is checked now; actual paired control still requires the next physical paired movement.' };
        } else if (choices.length) {
          action = { action_ref: choices[0] };
          detail = { box: aux.box, return_kind: 'non_translation_input',
            question: 'Test an available non-translation input for returning to the previously observed pair-control context. No return meaning is inferred from the input name.' };
        } else return { status: 'abstained', reason: 'group_return_control_unknown', block_unrelated_probe: true };
      }
    }
    const plan: R = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), mode, action: clone(action), detail, parked, pair_before: clone(retained.pair), evidence: retained.evidence.slice(-24) };
    // Source identity is deliberately computed before commands/motion_steps are appended.
    const ref = 'C_support_prepare_' + identity(plan).slice(0, 18), why = cfg.support_question + ' ' + detail.question;
    const facts = { current_support_occurrence_bound: true, conditional_joint_consumer_measured: true, selection_and_control_remain_experimental: true };
    const evidence = [observation.observation_ref, ...plan.evidence], actions: R[] = motionSteps?.length ? motionSteps.map(step => ({ action_ref: step.action_ref })) : [action];
    plan.motion_steps = motionSteps; plan.commands = clone(actions);
    return { status: 'proposed', kind: 'coupled_support_preparation', proposal_id: ref, support_preparation_plan: plan, actions,
      steps: actions.map((action, index) => ({ action, expected_after: motionSteps?.length ? { selected_occurrence_box: motionSteps[index]!.to }
        : mode === 'verify_group' ? { member_boxes: detail.expected, auxiliary_preserved: true } : null })), facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: ['current pair', 'distinct support occurrence', 'conditional access path'] }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'prepare_conditional_joint_support:' + mode, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /**
   * Run after the source pair record. This applies this layer's own events once.
   * A returned coupled_pair_evidence event must additionally be applied to the
   * pair owner by SharedSeries, preserving its position before the final support event.
   */
  record(pairState: R | null, before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const events: R[] = [], plan = proposal.support_preparation_plan;
    const emit = (event: R): void => { this.applyEvent(event); events.push(event); };
    if (!truth(plan) || before.level_epoch !== after.level_epoch) {
      if (!truth(plan) && truth(proposal.pair_access_plan) && truth(this.supportState) && truth(this.supportState!.return_method)
        && this.supportState!.return_method.status !== 'paired_control_revalidated' && before.level_epoch === after.level_epoch) {
        const outcome = coupledPairAfter(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
        if (outcome.matched === true) {
          const aux = clone(this.supportState!); aux.return_method.status = 'paired_control_revalidated';
          aux.return_method.actual_paired_control_evidence = [before.observation_ref, after.observation_ref];
          emit({ kind: 'coupled_support_preparation', state: aux, mode: 'paired_control_revalidation', evidence: aux.return_method.actual_paired_control_evidence });
        }
      }
      return events;
    }
    const refs = [before.observation_ref, after.observation_ref], detail = plan.detail, mode = plan.mode, known = plan.pair_before;
    let aux = clone(this.supportState); const pair = currentPair(later, known);
    if (mode === 'select') {
      const method = truth(aux) ? clone(aux!.return_method ?? null) : null, box = detail.item.box, selected = patch(later, box);
      let changed = 0;
      for (let y = 0; y < Math.min(rows.length, later.length); y++) for (let x = 0; x < Math.min(rows[y]!.length, later[y]!.length); x++) if (rows[y]![x] !== later[y]![x]) changed++;
      aux = { epoch: after.level_epoch, phase: pair && changed ? 'selected' : 'unresolved', box, selected_patch: selected, floor: detail.floor,
        parked: clone(plan.parked), measured_moves: {}, selection_ref: refs, return_tried: [], return_method: method,
        unknown: pair && changed ? null : 'Point selection not evidenced by preserved pair loci and public change.' };
    } else if (mode === 'move') {
      const selected = aux!, box = selected.box, q = selected.selected_patch.length, matches: CoupledPairBox[] = [];
      for (const delta of [[0, 0], [-q, 0], [q, 0], [0, -q], [0, q]]) {
        const destination = translate(box, delta);
        if (inside(later, destination) && equal(patch(later, destination), selected.selected_patch)) matches.push(destination);
      }
      const outcome = auxiliarySupportAfter(proposal, index, rows, later, { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
      if (matches.length === 1 && pair && !Object.hasOwn(outcome, 'extra_effect_count')) throw new TypeError('Auxiliary move response lacks the source extra-effect measurement');
      if (matches.length === 1 && pair && !outcome.extra_effect_count && (outcome.vacated_support_matches ?? true)) {
        const destination = matches[0]!, delta = [destination[0] - box[0], destination[1] - box[1]];
        if (delta.some(value => value !== 0)) {
          selected.measured_moves[command.action_ref] = delta; selected.box = destination;
          emit(observedModel(this.supportModels, selected, command.action_ref, delta, refs));
          retainSuffix(selected, later, plan, truth(plan.motion_steps) ? index : 0);
        } else {
          selected.phase = 'unresolved'; selected.unknown = 'Selected occurrence stayed under a hypothesized free displacement; current parking premise needs revision.';
        }
      } else {
        selected.phase = 'unresolved'; selected.unknown = 'Selected correspondence, vacated support or preserved pair/scene disagrees; effect cause unknown.';
        delete selected.continuation; emit(observedModel(this.supportModels, selected, command.action_ref, [0, 0], refs, outcome));
      }
    } else if (mode === 'return') {
      const selected = aux!; selected.return_tried.push(command.action_ref);
      const appearanceRestored = !!(pair && pair.value === known.value);
      selected.pending_return = { command, kind: detail.return_kind ?? null, evidence: refs, appearance_restored: appearanceRestored };
      if (pair && (appearanceRestored || detail.return_kind === 'current_pair_point')) {
        selected.phase = 'verify_group'; selected.appearance_return_evidence = appearanceRestored ? refs : null;
        selected.unknown = 'Actual controlled displacement remains untested after return attempt.';
      } else {
        (selected.return_counterexamples ??= []).push({ command, evidence: refs, expected_pair_appearance_restored: false });
        selected.phase = command.action_ref !== 'ACTION6' && after.available_action_refs.includes('ACTION6') && pair ? 'selected' : 'unresolved';
        selected.unknown = 'Proposed return input did not restore the pair appearance; group-control effect unknown.';
      }
    } else if (mode === 'verify_group') {
      const selected = aux!, response = groupControlResponse(rows, later, detail); selected.group_control_test = response;
      if (response.matched) {
        selected.phase = 'group'; selected.parked.push(selected.box); selected.unknown = null;
        selected.return_method = { kind: selected.pending_return.kind === 'current_pair_point' ? 'point_current_pair_occurrence' : 'discrete_return_input',
          evidence: selected.pending_return.evidence, actual_paired_control_evidence: refs, status: 'paired_control_revalidated',
          causal_scope: 'Paired control observed after the recorded return attempts; each input contribution remains unisolated. Revalidate in each new selection context.' };
        const state = clone(pairState!); state.pair = response.pair_after;
        events.push({ kind: 'coupled_pair_evidence', state, evidence: refs });
      } else {
        selected.phase = 'unresolved'; selected.unknown = 'Current mode did not produce the expected paired displacement with auxiliary preservation; actual control remains unresolved.';
      }
    }
    aux!.last_evidence = refs;
    emit({ kind: 'coupled_support_preparation', state: aux, command, mode, evidence: refs,
      scope: 'Observed selection, displacement or return only; no universal helper semantics.' });
    return events;
  }

  state(): AuxiliarySupportState {
    return { support_state: clone(this.supportState), support_events: clone(this.supportEvents), support_models: clone(this.supportModels) };
  }
  retainedDigest(parentDigest: string): string { return identity([parentDigest, this.supportState, this.supportEvents, this.supportModels]); }
  restore(state: AuxiliarySupportState): void {
    if (!state || !Object.hasOwn(state, 'support_state') || !Array.isArray(state.support_events)
      || !state.support_models || typeof state.support_models !== 'object' || Array.isArray(state.support_models)) throw new TypeError('Incomplete auxiliary-support memory');
    const rebuilt = new AuxiliarySupportMemory();
    for (const event of state.support_events) rebuilt.applyEvent(event);
    if (identity(rebuilt.state()) !== identity(state)) throw new TypeError('Auxiliary support state differs from its complete event journal');
    this.supportState = rebuilt.supportState; this.supportEvents = rebuilt.supportEvents; this.supportModels = rebuilt.supportModels;
    this.version++;
  }
}
