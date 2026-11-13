/** ReferencePopulationAccess's own layer from pinned original V6.
 * SharedSeries owns inherited dispatch, acquisition order and the common journal.
 * Occupancy preparation never supplies a complete appearance or terminal law.
 */
import { measureReferencePopulation, referencePopulationCellKey, referencePopulationLocalRelations,
  referencePopulationPaths, referencePopulationPoint } from './v6-reference-population-observation.ts';
import { maximumInjectiveMatching, PopulationWorkBudget, PopulationWorkInterrupted,
  selectedCardinalPopulationStep } from './v5-reference-population-calculus.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { compareUnicode } from './canonical.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Cell = number[];
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface ReferencePopulationState {
  population_events: R[];
  population_controls: R;
  population_state: R | null;
}
export const freshReferencePopulationMemory = (): ReferencePopulationState => ({
  population_events: [], population_controls: {}, population_state: null,
});

const cellOrder = (left: readonly number[], right: readonly number[]): number => left[0]! - right[0]! || left[1]! - right[1]!;
const cells = (scene: R): Set<string> => new Set(scene.bodies.map((body: R) => referencePopulationCellKey(body.cell)));
const sameCells = (left: ReadonlySet<string>, right: ReadonlySet<string>): boolean => left.size === right.size && [...left].every(cell => right.has(cell));
function at<T>(values: readonly T[], index: number): T {
  const offset = index < 0 ? values.length + index : index;
  if (!Number.isInteger(offset) || offset < 0 || offset >= values.length) throw new RangeError('Reference population sequence index out of range');
  return values[offset]!;
}
function projectedCells(plan: R, destination: readonly number[]): Set<string> {
  const wanted = cells(plan.scene);
  wanted.delete(referencePopulationCellKey(plan.chosen));
  wanted.add(referencePopulationCellKey(destination));
  return wanted;
}

export function referencePopulationBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.reference_population_plan;
  if (!truth(plan)) throw new TypeError('Reference population admission requires reference_population_plan');
  const scene = measureReferencePopulation(rows, plan.scene);
  let admitted = scene !== null && proposal.proposal_id === 'reference-population:' + identity(plan)
    && equal(proposal.actions, plan.commands) && equal(plan.commands, proposal.bundle_template.actions)
    && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && meta.available.includes(at<R>(proposal.actions, index).action_ref);
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else {
    const wanted = projectedCells(plan, at<Cell>(plan.before_cells, index));
    admitted = admitted && sameCells(cells(scene!), wanted);
  }
  return { admitted: Boolean(admitted), reason: admitted ? 'current_population_and_reference_bound' : 'population_or_reference_changed' };
}

export function referencePopulationAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.reference_population_plan;
  if (!truth(plan)) throw new TypeError('Reference population outcome requires reference_population_plan');
  const boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]), expected = at<Cell | null>(plan.expected, index);
  let matched: boolean | null = null;
  if (!boundary && expected !== null) {
    const scene = measureReferencePopulation(later, plan.scene), wanted = projectedCells(plan, expected);
    matched = scene !== null && sameCells(cells(scene), wanted);
  }
  return { matched, seal_prefix: boundary || matched !== true,
    reason: boundary ? 'boundary' : expected === null ? 'unknown_population_effect' : 'population_projection' };
}

export class ReferencePopulationMemory {
  private populationEvents: R[] = [];
  private populationControls: R = {};
  private populationState: R | null = null;
  private version = 0;
  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.populationEvents.length; }
  currentState(): ReferencePopulationState {
    return structuredClone({ population_events: this.populationEvents, population_controls: this.populationControls,
      population_state: this.populationState });
  }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.populationEvents, this.populationControls, this.populationState]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_reference_population') throw new TypeError(`Outside reference-population layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!Object.hasOwn(owned, 'controls') || !Object.hasOwn(owned, 'state')) throw new TypeError('Reference population event lacks its controls or state');
    this.version++; this.populationEvents.push(owned); this.populationControls = owned.controls; this.populationState = owned.state;
  }

  /** Null delegates to ReceptionService. Source current-revalidation and terminal
   * unknowns remain blocking. Explicit native work bounds do not become a physical
   * impossibility or an acquired matching law. */
  propose(observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.reference_population_question;
    let memory = this.populationState && this.populationState.epoch === observation.level_epoch ? structuredClone(this.populationState) : null;
    const scene = measureReferencePopulation(rows, memory ? memory.scene : null);
    if (memory && !scene) return { status: 'unknown', block_unrelated_probe: true, reason: 'current_reference_population_revalidation_missing' };
    if (!truth(cfg) || !scene) return null;
    if (memory === null) memory = { epoch: observation.level_epoch, scene, active: null, pending: null, tried: [], evidence: [observation.observation_ref] };
    const nativeBounds = config.native_reference_population_bounds === true, limits = config.native_reference_population_work_budget;
    const now: () => number = config.native_reference_population_now ?? (() => performance.now());
    if (nativeBounds && now() >= (config.level_deadline ?? Infinity)) return {
      status: 'unknown', block_unrelated_probe: true, reason: 'reference_population_level_deadline',
    };
    const budget = nativeBounds ? new PopulationWorkBudget({
      ...(limits ?? {}), now,
      ...(typeof config.level_deadline === 'number' ? { deadlineMs: Math.min(limits?.deadlineMs ?? Infinity, config.level_deadline) } : {}),
    }) : null;
    if (budget && (scene.floor.length > budget.request.domain_bound || scene.population > 128)) return {
      status: 'unknown', block_unrelated_probe: true, reason: 'reference_population_native_domain_bound',
    };
    const visit = budget ? () => budget.visit() : undefined;
    try {
      visit?.();
      const current = cells(scene), target = new Set<string>(scene.target.map((entry: number[]) => referencePopulationCellKey(entry.slice(0, 2))));
      const remaining = [...current].filter(key => !target.has(key)).map(key => JSON.parse(key) as Cell).sort(cellOrder);
      const slots = [...target].filter(key => !current.has(key)).map(key => JSON.parse(key) as Cell).sort(cellOrder);
      const availableActions = new Set<string>(observation.available_action_refs);
      const controls: R = Object.fromEntries(Object.entries(this.populationControls).filter(([name]) => availableActions.has(name)));
      if (!remaining.length) return { status: 'unknown', block_unrelated_probe: true, reason: 'reference_occupancy_prepared_color_relation_or_terminal_unknown' };
      const graph = new Map(remaining.map(point => [referencePopulationCellKey(point),
        referencePopulationPaths(point, scene.floor, current, controls, visit)]));
      const domains = remaining.map(point => {
        const paths = graph.get(referencePopulationCellKey(point))!;
        return slots.filter(slot => paths.has(referencePopulationCellKey(slot))).sort((left, right) =>
          paths.get(referencePopulationCellKey(left))![0].length - paths.get(referencePopulationCellKey(right))![0].length || cellOrder(left, right));
      });
      let [assigned, unfilled] = maximumInjectiveMatching(domains, visit);
      // Retain the source increasing path-bound matching witness, not a global
      // transport schedule or an appearance/terminal hypothesis.
      if (!unfilled.length) {
        const lengths = new Set<number>();
        for (const point of remaining) for (const slot of slots) {
          const path = graph.get(referencePopulationCellKey(point))!.get(referencePopulationCellKey(slot));
          if (path) lengths.add(path[0].length);
        }
        for (const bound of [...lengths].sort((a, b) => a - b)) {
          visit?.();
          const [candidate, missing] = maximumInjectiveMatching(domains.map((domain, i) => domain.filter(slot =>
            graph.get(referencePopulationCellKey(remaining[i]!))!.get(referencePopulationCellKey(slot))![0].length <= bound)), visit);
          if (!missing.length) { assigned = candidate; unfilled = missing; break; }
        }
      }
      const mapping = new Map(assigned.map(([index, destination]) => [referencePopulationCellKey(remaining[index]!), destination]));
      let actions: R[] = [], expected: (Cell | null)[] = [], mode = 'select', chosen: Cell | null = null, why = cfg.selection;
      const active = truth(memory.active) ? referencePopulationCellKey(memory.active) : null;
      const pending = truth(memory.pending) ? referencePopulationCellKey(memory.pending) : null;
      const remainingKeys = new Set(remaining.map(referencePopulationCellKey));
      if (active !== null && remainingKeys.has(active) && mapping.has(active)) {
        chosen = JSON.parse(active); const destination = mapping.get(active)!;
        const [word, path] = graph.get(active)!.get(referencePopulationCellKey(destination))!;
        actions = word.slice(0, limit); expected = path.slice(1, limit + 1); mode = 'move'; why = cfg.compose;
      }
      if (!actions.length && active !== null && remainingKeys.has(active)) {
        const origin = JSON.parse(active) as Cell;
        const unknown = [...new Set<string>(inputs.filter(command => !truth(command.data)
          && !Object.hasOwn(controls, command.action_ref)
          && !memory.tried.some((trial: R) => equal(trial, [command.action_ref, origin]))).map(command => command.action_ref))].sort(compareUnicode);
        if (unknown.length) { chosen = origin; actions = [{ action_ref: unknown[0] }]; expected = [null]; mode = 'probe'; why = cfg.control; }
      }
      if (!actions.length && pending !== null && current.has(pending)) {
        const available = [...new Set<string>(inputs.filter(command => !truth(command.data)).map(command => command.action_ref))].sort(compareUnicode);
        if (!available.length) throw new RangeError('Reference population pending selection has no non-point input');
        chosen = JSON.parse(pending); actions = [{ action_ref: available[0] }]; expected = [null]; mode = 'probe'; why = cfg.control;
      }
      if (!actions.length) {
        if (!slots.length) throw new RangeError('Reference population has no remaining reference slot');
        const distance = (point: Cell): number => Math.min(...slots.map(slot => Math.abs(point[0]! - slot[0]!) + Math.abs(point[1]! - slot[1]!)));
        chosen = [...remaining].sort((left, right) => Number(!mapping.has(referencePopulationCellKey(left))) - Number(!mapping.has(referencePopulationCellKey(right)))
          || distance(left) - distance(right) || cellOrder(left, right))[0]!;
        actions = [{ action_ref: 'ACTION6', data: referencePopulationPoint(scene, chosen) }]; expected = [null]; mode = 'select';
      }
      budget?.finish();
      const plan = structuredClone({ state: memory, scene, chosen, commands: actions, expected, before_cells: [chosen, ...expected.slice(0, -1)],
        epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
        frame_digest: identity(rows), why, mode, assignment_method: 'V5.maximum_injective_matching', assignment_complete: !unfilled.length, controls });
      const ref = 'reference-population:' + identity(plan), evidence = memory.evidence.slice(-16);
      const facts = { current_reference_occupancy_measured: true, color_relation_unknown: true,
        point_selection_experimental: mode === 'select', conditional_single_member_motion: true };
      return { status: 'proposed', kind: 'reference_population', proposal_id: ref, reference_population_plan: plan, actions,
        steps: actions.map(action => ({ action, expected_after: null })), facts,
        compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
        question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
        binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
        bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
          purpose: why, preconditions: facts, evidence, outcome_guard: { path: ['value'], contains: ref } } };
    } catch (error) {
      if (!(error instanceof PopulationWorkInterrupted)) throw error;
      return { status: 'unknown', block_unrelated_probe: true, reason: 'reference_population_work_bound',
        exhausted_bound: error.cause, frontier: structuredClone(error.frontier) };
    }
  }

  /** The shared caller records inherited layers first. This layer acquires once
   * only when both current populations revalidate in the same level epoch. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.reference_population_plan;
    if (!truth(plan) || before.level_epoch !== after.level_epoch) return [];
    const memory = structuredClone(this.populationState && this.populationState.epoch === before.level_epoch ? this.populationState : plan.state);
    const first = measureReferencePopulation(rows, memory.scene), controls = structuredClone(this.populationControls);
    if (plan.mode === 'select') {
      const [y, x] = plan.chosen, q = memory.scene.q, [oy, ox] = memory.scene.offset;
      const changes: number[][] = [];
      for (let dy = 0; dy < q - 1; dy++) for (let dx = 0; dx < q - 1; dx++) {
        const old = rows[oy + y * q + dy]![ox + x * q + dx], value = later[oy + y * q + dy]![ox + x * q + dx];
        if (old !== value) changes.push([dy, dx, value!]);
      }
      if (changes.length === 1) {
        const all = new Map<string, number[]>((memory.scene.observed_marker_overlays ?? []).map((item: number[]) => [JSON.stringify(item), [...item]]));
        all.set(JSON.stringify(changes[0]), changes[0]!);
        memory.scene.observed_marker_overlays = [...all.values()].sort((left, right) => cellOrder(left, right) || left[2]! - right[2]!);
      }
    }
    const second = measureReferencePopulation(later, memory.scene);
    if (!first || !second) return [];
    const old = cells(first), next = cells(second), gone = [...old].filter(cell => !next.has(cell)), added = [...next].filter(cell => !old.has(cell));
    const detail: R = { before: before.observation_ref, after: after.observation_ref, command, mode: plan.mode };
    if (gone.length === 1 && added.length === 1) {
      const origin = JSON.parse(gone[0]!) as Cell, destination = JSON.parse(added[0]!) as Cell;
      const delta = [destination[0]! - origin[0]!, destination[1]! - origin[1]!];
      if (!truth(command.data) && delta.reduce((sum, value) => sum + Math.abs(value), 0) === 1) {
        Object.defineProperty(controls, command.action_ref, { value: { delta, evidence: [before.observation_ref, after.observation_ref] },
          enumerable: true, configurable: true, writable: true });
        memory.active = destination; memory.pending = null;
        const ordered = [...old].map(cell => JSON.parse(cell) as Cell).sort(cellOrder);
        const state = { occurrences: ordered.map((cell, i) => ({ occurrence_ref: String(i), cell })),
          active_occurrence_ref: String(ordered.findIndex(cell => equal(cell, origin))), reserve: 0, terminated: false };
        const predicted = selectedCardinalPopulationStep({ movement_cells: first.floor, motion_law_ref: 'collision_checked_cardinal_step' },
          state, { kind_ref: 'move', delta }).state;
        detail.V5_physical_step_matches = sameCells(new Set(predicted.occurrences.map((item: R) => referencePopulationCellKey(item.cell))), next);
      }
    } else if (plan.mode === 'select') {
      memory.pending = plan.chosen; memory.active = null;
      detail.selection_scope = 'Pointed occupied occurrence; controlled identity awaits displacement response.';
    }
    if (plan.mode === 'probe') memory.tried.push([command.action_ref, at<Cell | null>(plan.before_cells, index)]);
    memory.scene = second; memory.evidence.push(before.observation_ref, after.observation_ref);
    const event = structuredClone({ kind: 'observed_reference_population', state: memory, controls, detail,
      observed_local_relations: referencePopulationLocalRelations(second), color_rule_status: 'observed_samples_only_no_complete_law' });
    this.applyEvent(event); return [event];
  }
}

export function proposeReferencePopulation(memory: ReferencePopulationMemory, observation: R, rows: NativeRows,
  inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}
