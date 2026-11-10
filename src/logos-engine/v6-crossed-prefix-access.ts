/** The own CrossedPrefixAccess layer from the pinned V6 source.
 * SharedSeries supplies ancestor dispatch and one common event journal. Current
 * controller/color/address evidence does not establish a terminal or global
 * crossing law; retained crossing pairs remain experimental across epochs.
 */
import { crossedPrefixGeometry, crossedPrefixMeasureControls, crossedPrefixReferencePresent,
  crossedPrefixCell, crossedPrefixSlot } from './v6-crossed-prefix-observation.ts';
import type { CrossedPrefixController, CrossedPrefixLayout } from './v6-crossed-prefix-observation.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface CrossedPrefixState {
  cross_state: R | null;
  cross_pairs: R[];
  cross_axis_inputs: Record<string, string[]>;
  cross_events: R[];
}
export interface CrossedPrefixAssignmentBounds {
  maxControllers?: number;
  maxAssignments?: number;
}
export interface CrossedPrefixQuestionOptions extends CrossedPrefixAssignmentBounds {
  nativeBounds?: boolean;
  deadlineMs?: number | null;
  now?: Clock;
}
export interface CrossedPrefixRecordOptions {
  /** Source self.after dispatch may select a later inherited plan in a mixed envelope. */
  after?: (proposal: R, index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta) => R;
}
export const freshCrossedPrefixMemory = (): CrossedPrefixState => ({
  cross_state: null, cross_pairs: [], cross_axis_inputs: { '0': [], '1': [] }, cross_events: [],
});
export const CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS = Object.freeze({ maxControllers: 128, maxAssignments: 65_536 });

function required(value: R, key: string): any {
  if (!Object.hasOwn(value, key)) throw new TypeError('Crossed-prefix source contract requires ' + key);
  return value[key];
}
const knownOwner = (value: unknown): boolean => equal(value, 0) || equal(value, 1);
const own = (object: R, key: string, fallback: any = null): any => Object.hasOwn(object, key) ? object[key] : fallback;
const pointCommand = (point: readonly number[]): R => ({ action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });

/** Source guard checks the planned action's availability and exact current
 * context. It does not authenticate the whole proposal/action envelope; common
 * physical and WHY/ACT authority are distinct, mandatory checks. */
export function crossedPrefixBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.crossed_prefix_plan;
  if (!truth(plan)) throw new TypeError('Crossed-prefix admission requires crossed_prefix_plan');
  const admitted = equal(index, 0)
    && equal([required(plan, 'epoch'), required(plan, 'score'), required(plan, 'observation_ref')],
      [required(meta, 'epoch'), required(meta, 'score'), required(meta, 'observation_ref')])
    && required(meta, 'available').includes(required(required(plan, 'action'), 'action_ref'))
    && identity(rows) === required(plan, 'frame_digest')
    && crossedPrefixReferencePresent(rows, required(required(plan, 'state_before'), 'layout'));
  return { admitted, reason: admitted ? 'crossed_prefix_bound' : 'crossed_prefix_context_changed' };
}

export function crossedPrefixAfter(proposal: R, _index: number, rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.crossed_prefix_plan;
  if (!truth(plan)) throw new TypeError('Crossed-prefix outcome requires crossed_prefix_plan');
  if (!equal(required(meta, 'epoch'), required(plan, 'epoch')) || !equal(required(meta, 'score'), required(plan, 'score'))
    || ['WIN', 'GAME_OVER'].includes(required(meta, 'state'))) {
    return { matched: null, seal_prefix: true, reason: 'official_boundary_or_terminal' };
  }
  const layout = required(required(plan, 'state_before'), 'layout') as CrossedPrefixLayout;
  if (!crossedPrefixReferencePresent(later, layout)) return { matched: false, seal_prefix: true, reason: 'reference_changed_unexpectedly' };
  if (plan.mode === 'advance') {
    const same = identity(rows) === identity(later), target = required(required(plan, 'intent'), 'cell');
    const changed = !equal(crossedPrefixSlot(rows, layout, target), crossedPrefixSlot(later, layout, target));
    const result: R = { matched: changed, seal_prefix: true, reason: changed ? 'prefix_contribution_observed'
      : same ? 'input_has_no_effect_in_current_crossing' : 'unexplained_nonlocal_control_effect' };
    if (changed && truth(required(plan.intent, 'other_action'))) {
      const pixels = crossedPrefixSlot(later, layout, target);
      const value = pixels[Math.floor(pixels.length / 2)]![Math.floor(pixels[0]!.length / 2)], [x, y] = target;
      result.reference_property_matched = equal(value, layout.reference.values[y]![x]);
      if (!result.reference_property_matched) result.reason = 'prefix_advanced_but_reference_property_unmet';
    }
    return result;
  }
  if (plan.mode === 'recolor') {
    const controls = crossedPrefixMeasureControls(later, layout) ?? [];
    const changed = controls.some(control => equal(control.key, required(plan.controller, 'key'))
      && equal(control.color, required(plan.intent, 'desired_color')));
    return { matched: changed, seal_prefix: true, reason: changed ? 'control_appearance_observed' : 'control_appearance_refuted' };
  }
  return { matched: null, seal_prefix: true, reason: 'selection_is_hypothesis_until_advance' };
}

/** Source event contracts are checked before changing this owner. A malformed
 * journal is a native validation error, never partially acquired knowledge. */
function ownedEvent(event: R): R {
  if (!['crossed_prefix_state', 'crossed_prefix_pair', 'crossed_prefix_input'].includes(event.kind)) {
    throw new TypeError('Outside crossed-prefix layer: ' + String(event.kind));
  }
  const retained = retainNativeJson(event);
  if (retained.kind === 'crossed_prefix_state') {
    // Retain historical state fragments opaquely, as the source reducer does.
    // Their presence is not a claim that later planning fields are available.
    required(retained, 'state');
  } else if (retained.kind === 'crossed_prefix_pair') {
    // Source append-only pair journals already occur in published checkpoints,
    // including {kind, owner}. Do not invent the absent proposal dependencies.
  } else {
    if (!knownOwner(required(retained, 'axis')) || typeof required(retained, 'action') !== 'string') {
      throw new TypeError('Crossed-prefix input requires a measured axis and an action');
    }
  }
  return retained;
}

export class CrossedPrefixMemory {
  private crossState: R | null = null;
  private pairs: R[] = [];
  private axisInputs: Record<string, Set<string>> = { '0': new Set(), '1': new Set() };
  private events: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.events.length; }
  private inputProjection(): Record<string, string[]> {
    return Object.fromEntries(Object.entries(this.axisInputs).map(([key, values]) => [key, [...values].sort(compareUnicode)]));
  }
  currentState(): CrossedPrefixState {
    return structuredClone({ cross_state: this.crossState, cross_pairs: this.pairs,
      cross_axis_inputs: this.inputProjection(), cross_events: this.events });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.crossState, this.pairs, this.inputProjection(), this.events]); }
  private applyOwned(event: R): void {
    if (event.kind === 'crossed_prefix_state') this.crossState = event.state;
    else if (event.kind === 'crossed_prefix_pair') this.pairs.push(event);
    else this.axisInputs[String(Number(event.axis))]!.add(event.action);
    this.events.push(event); this.version++;
  }
  applyEvent(event: R): void { this.applyOwned(ownedEvent(event)); }

  /** Own source proposal. A negative/zero prefix limit is not inspected by the
   * original method; the common wrapper independently requires remaining > 0. */
  propose(observation: R, rows: NativeRows, inputs: readonly R[], _limit: number, config: R, base: R | null = null): R | null {
    if (truth(config.coupled_prefix_reference)) {
      const proposal = this.crossQuestion(observation, rows, inputs);
      if (truth(proposal)) return proposal;
    }
    return base;
  }

  /** Source-compatible own question by default. The production wrapper supplies
   * named native work/deadline bounds for the exponential assignment product.
   * No acquired state is written here, including when that product is cut. */
  crossQuestion(observation: R, rows: NativeRows, _inputs: readonly R[], options: CrossedPrefixQuestionOptions = {}): R | null {
    if (!observation.available_action_refs.includes('ACTION6')) return null;
    let state = this.crossState;
    if (state === null || !equal(state.epoch, observation.level_epoch)) {
      const layout = crossedPrefixGeometry(rows);
      if (layout === null) return null;
      const palette = new Set(layout.reference.palette);
      for (let j = 0; j < layout.shape[1]; j++) for (let i = 0; i < layout.shape[0]; i++) {
        if (crossedPrefixSlot(rows, layout, [i, j]).some(row => row.some(value => palette.has(value)))) return null;
      }
      state = { epoch: observation.level_epoch, layout, progress: Object.fromEntries(layout.controllers.map(control => [control.key, 0])),
        selected: null, actions: {}, blocked: [], questions: [], invalid: false };
    }
    if (truth(required(state, 'invalid')) || !crossedPrefixReferencePresent(rows, required(state, 'layout'))) return null;
    const layout = state.layout as CrossedPrefixLayout, controls = crossedPrefixMeasureControls(rows, layout);
    if (controls === null) return null;
    const bykey = Object.fromEntries(controls.map(control => [control.key, control]));
    const horizontal = Object.fromEntries(controls.filter(control => control.axis === 0).map(control => [control.lane, control]));
    const vertical = Object.fromEntries(controls.filter(control => control.axis === 1).map(control => [control.lane, control]));
    const target = layout.reference.values;
    const choices = controls.map(control => [...new Set([control.color, ...control.alternatives.map(value => value.color)])].sort((a, b) => a - b));
    const cursor = new Array<number>(controls.length).fill(0);
    let best: { cost: number; assignment: Record<string, number> } | null = null, examined = 0;
    const bounded = options.nativeBounds === true;
    const limits = { maxControllers: options.maxControllers ?? CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS.maxControllers,
      maxAssignments: options.maxAssignments ?? CROSSED_PREFIX_NATIVE_ASSIGNMENT_BOUNDS.maxAssignments };
    if (bounded && (!Number.isSafeInteger(limits.maxControllers) || limits.maxControllers < 0
      || !Number.isSafeInteger(limits.maxAssignments) || limits.maxAssignments < 0)) {
      throw new TypeError('Crossed-prefix native work bounds require nonnegative bounded integers');
    }
    const now = options.now ?? (() => performance.now()), deadline = options.deadlineMs ?? Infinity;
    if (bounded && !(typeof deadline === 'number' && !Number.isNaN(deadline))) throw new TypeError('Crossed-prefix deadline must be numeric');
    const interrupted = (bound: string): R => ({ status: 'unknown', block_unrelated_probe: true,
      reason: 'crossed_prefix_assignment_work_bound', exhausted_bound: bound,
      frontier: { complete: false, assignments_examined: examined, controller_count: controls.length,
        next_assignment_indices: [...cursor], max_controllers: limits.maxControllers, max_assignments: limits.maxAssignments,
        deadline_ms: Number.isFinite(deadline) ? deadline : null,
        scope: 'Unfinished controller-appearance assignment, not an acquired impossibility or crossing law.' } });
    if (bounded && controls.length > limits.maxControllers) return interrupted('controllers');
    let more = true, checkCurrentAssignment = true;
    while (more) {
      if (bounded && now() >= deadline) return interrupted('deadline');
      if (bounded && examined >= limits.maxAssignments) return interrupted('assignments');
      // Reusing the currently measured appearances costs zero recolorings.
      // If they satisfy every crossing clause, this is the unique zero-cost
      // assignment and therefore exactly the exhaustive source optimum. It
      // needs no claim about an input's physical effect. Check request bounds
      // first: a zero-work budget or expired deadline still cannot decide.
      // A failed zero-cost check leaves the original enumeration, ordering,
      // request-wide counter and cutoff frontier unchanged.
      if (checkCurrentAssignment) {
        checkCurrentAssignment = false;
        if (target.every((row, j) => row.every((value, i) => equal(value, horizontal[j]!.color)
          || equal(value, vertical[i]!.color)))) {
          examined++;
          best = { cost: 0, assignment: Object.fromEntries(controls.map(control => [control.key, control.color])) };
          break;
        }
      }
      examined++;
      const assignment = Object.fromEntries(controls.map((control, index) => [control.key, choices[index]![cursor[index]!]!]));
      const cost = controls.reduce((sum, control) => sum + Number(!equal(assignment[control.key], control.color)), 0);
      if (best === null || cost < best.cost) {
        const fits = target.every((row, j) => row.every((value, i) => equal(value, assignment[horizontal[j]!.key])
          || equal(value, assignment[vertical[i]!.key])));
        if (fits) best = { cost, assignment };
      }
      let column = cursor.length - 1;
      while (column >= 0) {
        cursor[column] = cursor[column]! + 1;
        if (cursor[column]! < choices[column]!.length) break;
        cursor[column] = 0; column--;
      }
      more = column >= 0;
    }
    if (best === null) return null;
    const assignment = best.assignment;
    let mode: string | null = null, chosen: CrossedPrefixController | null = null, action: R | null = null, intent: R = {};
    for (const controller of controls) {
      if (!equal(assignment[controller.key], controller.color)) {
        const addresses = controller.alternatives.filter(value => equal(value.color, assignment[controller.key])).map(value => value.point);
        if (addresses.length !== 1) return null;
        chosen = controller; mode = 'recolor'; action = pointCommand(addresses[0]!); intent = { desired_color: assignment[controller.key] }; break;
      }
    }
    const known = this.pairs.filter(pair => knownOwner(required(pair, 'owner')));
    if (chosen === null) {
      const pending = own(state, 'questions', []).find((question: R) => required(state!.progress, question.opposite_key) <= question.opposite_index
        && !known.some(pair => equal(pair.inputs[String(question.axis)], question.action)
          && question.desired_owners.some((owner: number) => equal(owner, pair.owner))));
      if (pending) chosen = required(bykey, pending.opposite_key);
      else if (!known.length) {
        const anchors: number[][] = [];
        for (const [j, row] of target.entries()) for (const [i] of row.entries()) {
          if (!equal(horizontal[j]!.color, vertical[i]!.color)) anchors.push([i + j, j, i]);
        }
        if (!anchors.length) return null;
        const [, j, i] = anchors.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!)[0]!;
        const a = horizontal[j!]!, b = vertical[i!]!;
        const needA = a.side < 0 ? i! + 1 : a.length - i!, needB = b.side < 0 ? j! + 1 : b.length - j!;
        chosen = required(state.progress, a.key) < needA ? a : required(state.progress, b.key) < needB ? b : null;
      } else chosen = controls.find(control => required(state!.progress, control.key) < control.length) ?? null;
      if (chosen === null) return null;
      if (!equal(required(state, 'selected'), chosen.key)) {
        mode = 'select'; action = pointCommand(chosen.point);
      } else {
        mode = 'advance'; const k = required(state.progress, chosen.key), [i, j] = crossedPrefixCell(chosen, k, layout);
        const opposite = chosen.axis === 0 ? vertical[i]! : horizontal[j]!;
        let oppositeIndex = opposite.axis === 1 ? j : i;
        if (opposite.side > 0) oppositeIndex = opposite.length - 1 - oppositeIndex;
        const otherAction = own(state.actions, `${opposite.key}:${oppositeIndex}`);
        const desired = [horizontal[j]!, vertical[i]!].filter(control => equal(control.color, target[j]![i])).map(control => control.axis);
        const pairs = known.filter(pair => desired.some(owner => equal(owner, pair.owner))
          && (!truth(otherAction) || equal(pair.inputs[String(opposite.axis)], otherAction)));
        const preferred = [...pairs].reverse().map(pair => pair.inputs[String(chosen!.axis)]);
        const available: string[] = observation.available_action_refs.filter((name: string) => ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'].includes(name));
        const trialContext = [chosen.key, k, otherAction];
        const blocked = new Set<string>(state.blocked.filter((item: R) => equal(item.context, trialContext)).map((item: R) => item.action));
        const contrary = new Set<string>(known.filter(pair => !desired.some(owner => equal(owner, pair.owner))
          && (!truth(otherAction) || equal(pair.inputs[String(opposite.axis)], otherAction))).map(pair => pair.inputs[String(chosen!.axis)]));
        const established = [...this.axisInputs[String(chosen.axis)]!].filter(name => !contrary.has(name)).sort(compareUnicode);
        const exploratory = available.filter(name => !contrary.has(name) && !this.axisInputs[String(1 - chosen!.axis)]!.has(name));
        const ordered: string[] = [...new Set<string>([...preferred, ...established, ...exploratory, ...[...contrary].sort(compareUnicode), ...available])];
        const candidate = ordered.find(name => available.includes(name) && !blocked.has(name));
        if (candidate === undefined) return null;
        action = { action_ref: candidate };
        intent = { index: k, cell: [i, j], opposite_key: opposite.key, opposite_index: oppositeIndex, other_action: otherAction,
          desired_owners: desired, trial_context: trialContext,
          predicted_pair: pairs.find(pair => equal(pair.inputs[String(chosen!.axis)], candidate)) ?? null };
      }
    }
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), mode, controller: chosen, action, intent, state_before: state,
      scope: 'Controller correspondence, one-cell prefix advance and latent crossing compatibility are experimentally tested from public effects; no terminal role is assumed from appearance alone.' };
    const ref = 'C_crossed_prefix_' + identity(plan).slice(0, 18);
    const why: R = { select: 'Bind a measured controller to the unresolved prefix contributing to the visible reference.',
      recolor: 'Test the visible alternative control appearance required by the reference constraints.',
      advance: 'Test the next contribution of a selected prefix and its compatibility with the crossing contribution.' };
    const reason = required(why, mode!);
    const facts = { measured_reference_and_field: true, measured_aligned_controller: true, current_prefix_question: true };
    const evidence = [observation.observation_ref, layout.ref];
    if (truth(intent.predicted_pair)) evidence.push(...required(intent.predicted_pair, 'evidence'));
    return structuredClone({ status: 'proposed', kind: 'coupled_prefix_reference', proposal_id: ref, crossed_prefix_plan: plan,
      actions: [action], steps: [{ action, expected_after: { mode, intent } }], facts,
      compositions: [{ id: ref, observed: false, open_question: reason,
        properties: { controller: chosen!.key, mode, reference_ref: layout.ref }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: 'resolve_reference_through_coupled_prefixes', hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: plan.epoch, observation_ref: plan.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [],
        actions: [action], purpose: reason, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Only the selected own proposal acquires this layer, after inherited
   * acquisition. The return's canonical public pixels, not a simulated future,
   * determine advancement and a possible crossing observation. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number,
    options: CrossedPrefixRecordOptions = {}): R[] {
    const plan = proposal.crossed_prefix_plan;
    if (!truth(plan)) return [];
    const state = structuredClone(required(plan, 'state_before')), extra: R[] = [], mode = plan.mode, controller = plan.controller;
    const outcome = (options.after ?? crossedPrefixAfter)(proposal, index, rows, later,
      { epoch: after.level_epoch, score: after.levels_completed, state: after.state });
    const boundary = !equal(after.level_epoch, before.level_epoch) || !equal(after.levels_completed, before.levels_completed);
    if (mode === 'select') state.selected = controller.key;
    else if (mode === 'recolor') { if (outcome.matched === false) state.invalid = true; }
    else if (mode === 'advance') {
      const intent = plan.intent;
      if (truth(outcome.matched) || boundary) {
        state.progress[controller.key] += 1;
        state.actions[`${controller.key}:${intent.index}`] = command.action_ref;
        extra.push({ kind: 'crossed_prefix_input', axis: controller.axis, action: command.action_ref,
          evidence: after.observation_ref, epoch: before.level_epoch });
        if (!Object.hasOwn(state, 'questions')) state.questions = [];
        state.questions.push({ axis: controller.axis, action: command.action_ref, cell: intent.cell, desired_owners: intent.desired_owners,
          opposite_key: intent.opposite_key, opposite_index: intent.opposite_index, source: after.observation_ref });
        if (outcome.reference_property_matched === false) state.invalid = true;
        if (truth(intent.other_action) && !boundary) {
          const controls = crossedPrefixMeasureControls(later, state.layout) ?? [];
          const bykey = Object.fromEntries(controls.map(control => [control.key, control])), other = own(bykey, intent.opposite_key);
          const pixels = crossedPrefixSlot(later, state.layout, intent.cell);
          const value = pixels[Math.floor(pixels.length / 2)]![Math.floor(pixels[0]!.length / 2)], current = own(bykey, controller.key);
          if (truth(current) && truth(other)) {
            const owners = [current, other].filter(control => equal(control.color, value)).map(control => control.axis);
            extra.push({ kind: 'crossed_prefix_pair', inputs: { [String(controller.axis)]: command.action_ref, [String(other.axis)]: intent.other_action },
              owner: owners.length === 1 ? owners[0] : null, visible_palette: value,
              evidence: [before.observation_ref, after.observation_ref], epoch: before.level_epoch,
              scope: 'Observed compatible intersection and visible appearance; prior-epoch use remains experimental.' });
          }
        }
      } else if (outcome.reason === 'input_has_no_effect_in_current_crossing') {
        state.blocked.push({ context: intent.trial_context, action: command.action_ref, evidence: after.observation_ref });
      } else state.invalid = true;
    }
    extra.push({ kind: 'crossed_prefix_state', state, evidence: after.observation_ref, outcome });
    const retained = extra.map(ownedEvent);
    for (const event of retained) this.applyOwned(event);
    return structuredClone(extra);
  }
}

/** This own question derives its address from the acquired layout and current
 * measured controls; it does not consume its exploratory-input argument. Avoid
 * re-running full geometry merely to append unused candidates. The actual point
 * still receives current observation support and mandatory common binding.
 * The native assignment budget remains one request-wide counter. */
export async function proposeCrossedPrefixCommon(memory: CrossedPrefixMemory, observation: R, rows: NativeRows,
  inputs: readonly R[], remaining: number, deadlineMs: number | null = null, now: Clock = () => performance.now(),
  bounds: CrossedPrefixAssignmentBounds = {}): Promise<R | null> {
  if (remaining < 1) return null;
  const proposal = memory.crossQuestion(observation, rows, inputs,
    { ...bounds, nativeBounds: true, deadlineMs, now });
  if (!truth(proposal) || proposal!.status === 'unknown') return proposal;
  proposal!.steps[0].expected_before = { level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
    levels_completed: observation.levels_completed, state: observation.state };
  if (proposal!.actions[0].action_ref === 'ACTION6') {
    const point = proposal!.actions[0].data, x = point.x, y = point.y, plan = proposal!.crossed_prefix_plan;
    proposal!.point_support = { observation_ref: observation.observation_ref, level_epoch: observation.level_epoch, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: rows[y]![x], bbox: [x, y, x, y],
      entity_ref: 'measured-aligned-control:' + plan.controller.key, signature: identity([plan.controller, plan.mode, point]),
      provenance: 'public color-run address aligned with a repeated field; full-raster and observed-effect guarded',
      field_ref: plan.state_before.layout.ref, full_raster_digest: plan.frame_digest };
  }
  return proposal;
}

export function bindCrossedPrefix(proposal: R, domain: ObservedInputDomain): void {
  if (proposal.actions[0].action_ref !== 'ACTION6') {
    if (!Object.hasOwn(proposal, 'crossed_prefix_plan')) throw new TypeError('Nonpoint operation without crossed-prefix witness');
    return;
  }
  const support = required(proposal, 'point_support');
  if (!domain.bindings.has(`${support.level_epoch}:${support.frame_hash}`)) throw new TypeError('Current public point domain has not been observed');
  if (proposal.actions.length !== 1 || !equal(support.point, [proposal.actions[0].data.x, proposal.actions[0].data.y])) {
    throw new TypeError('Measured cell address changed');
  }
  proposal.steps[0].point_binding = { ...support, scope: 'one composition-derived measured cell, full-raster guarded; not an enumerated exploratory sample' };
}
