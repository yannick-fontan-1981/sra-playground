/** ProductPanelAccess own layer, retained acquisition and source common wrapper. */
import { measureProductPanel, productPanelCurrent, productPanelCommand } from './v6-product-panel-observation.ts';
import { compileProductRoutes } from './v6-product-panel-mechanics.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { rowsDigest, type ObservedInputDomain } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Clock = () => number;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface ProductPanelState { product_state: R | null; product_events: R[] }

export function productPanelBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.product_panel_plan;
  if (!truth(plan)) throw new TypeError('Product guard requires product_panel_plan');
  let admitted = meta.epoch === plan.epoch && meta.score === plan.score && equal(proposal.actions, plan.commands)
    && equal(proposal.bundle_template.actions, plan.commands) && index >= 0 && index < proposal.steps.length;
  if (admitted) {
    const step = proposal.steps[index], control = plan.scene.controls[step.factor];
    admitted = equal(proposal.actions[index], productPanelCommand(control))
      && equal(productPanelCurrent(rows, plan.scene.geometry), step.before_values) && meta.available.includes('ACTION6');
  }
  if (index === 0) admitted = admitted && meta.observation_ref === plan.observation_ref && identity(rows) === plan.frame_digest;
  return { admitted, reason: admitted ? 'current_factor_point_and_values_bound' : 'factor_binding_or_payload_changed' };
}

export function productPanelAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.product_panel_plan;
  if (!truth(plan)) throw new TypeError('Product outcome requires product_panel_plan');
  const step = proposal.steps[index], progress = meta.score > plan.score, boundary = meta.epoch !== plan.epoch;
  const values = boundary ? null : productPanelCurrent(later, plan.scene.geometry);
  const matched = step.after_values === null ? null : equal(values, step.after_values);
  return { matched, seal_prefix: progress || boundary || !step.relation_observed || matched !== true,
    reason: matched ? 'conditional_factor_projection_matched' : 'factor_effect_requires_reconciliation',
    official_progress: progress, scope: 'Local factor projection; official terminal cause remains unasserted.' };
}

function initialState(observation: R, scene: R): R {
  return { epoch: observation.level_epoch, geometry_ref: scene.geometry_ref, visited: [scene.current], edges: [], evidence: [], counterexamples: [] };
}

export class ProductPanelMemory {
  private productState: R | null = null;
  private events: R[] = [];
  private version = 0;
  get nativeRevision(): number { return this.version; }
  currentState(): ProductPanelState { return structuredClone({ product_state: this.productState, product_events: this.events }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.productState, this.events]); }
  applyEvent(event: R): void {
    if (event.kind !== 'observed_factor_product') throw new TypeError(`Outside product-panel layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    this.version++; this.productState = owned.state; this.events.push(owned);
  }

  /** Questions do not acquire state; the shared owner supplies inherited fallbacks. */
  proposeProduct(observation: R, rows: NativeRows, _inputs: readonly R[], maxPrefix: number, config: R,
    levelDeadlineMs: number, now: Clock = () => performance.now(),
    base: R | null = { status: 'abstained', reason: 'no_recurrent_line_question' }): R | null {
    const cfg = config.factor_product_question, scene = truth(cfg) ? measureProductPanel(rows) : null;
    if (!scene || !maxPrefix || !observation.available_action_refs.includes('ACTION6')) return base;
    const state = this.productState && this.productState.epoch === observation.level_epoch && this.productState.geometry_ref === scene.geometry_ref
      ? this.productState : initialState(observation, scene);
    const unknown = scene.controls.map((_control: R, i: number) => i).filter((i: number) => !state.edges.some((edge: R) => edge.factor === i));
    let estimate: R | null = null, indices: number[], why: string;
    if (unknown.length) { indices = [unknown[0]!]; why = cfg.control_question; }
    else {
      estimate = compileProductRoutes(scene, state, observation, config.remaining_level_actions, levelDeadlineMs, cfg.max_factors, now);
      if (!estimate || !estimate.indices.length) return { status: 'abstained', reason: 'factor_product_has_no_supported_bounded_route' };
      indices = estimate.indices.slice(0, maxPrefix); why = cfg.coverage_question;
    }
    const actions: R[] = [], steps: R[] = [];
    let values: number[] = [...scene.current];
    for (const i of indices) {
      const action = productPanelCommand(scene.controls[i]);
      let expected: number[] | null = null;
      if (estimate) {
        const cycle: number[] = estimate.factors[i].map(Number); expected = [...values];
        expected[i] = cycle[(cycle.indexOf(values[i]!) + 1) % cycle.length]!;
      }
      const acquired = expected !== null && state.edges.some((edge: R) => edge.factor === i && edge.from === values[i] && edge.to === expected![i]);
      actions.push(action); steps.push({ action, factor: i, before_values: [...values], after_values: expected, relation_observed: acquired, expected_after: null });
      if (!acquired) break;
      values = expected!;
    }
    const plan = { epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref,
      frame_digest: identity(rows), scene, commands: structuredClone(actions), state_digest: identity(state), estimate,
      scope: 'Experimental coverage of measured catalogue; cycle order and independence conditional. Abstract emitted-command reserve and experimental acceptance do not assert game resource or terminal ordering.' };
    const ref = 'C_product_' + identity(plan).slice(0, 20);
    const facts = { measured_catalogue_is_complete_factor_product: true, current_point_controls_bound: true, conditional_model_not_official_terminal_law: true };
    return structuredClone({ status: 'proposed', kind: 'factor_product_experiment', product_panel_plan: plan, proposal_id: ref, actions, steps, facts,
      compositions: [{ id: ref, observed: false, open_question: why, properties: { roles: cfg.roles }, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: state.evidence.slice(-16) }, route_refs: [observation.observation_ref],
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', preserve_refs: [], actions,
        purpose: why, preconditions: facts, evidence: [observation.observation_ref, ...state.evidence.slice(-16)], outcome_guard: { path: ['value'], contains: ref } } });
  }

  /** Call after inherited record layers, even if the selected plan belongs elsewhere. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, _proposal: R, _index: number): R[] {
    const first = measureProductPanel(rows);
    if (!first) return [];
    const state = this.productState && this.productState.epoch === before.level_epoch && this.productState.geometry_ref === first.geometry_ref
      ? structuredClone(this.productState) : initialState(before, first);
    if (before.level_epoch === after.level_epoch) {
      const second = measureProductPanel(later);
      if (second && second.geometry_ref === first.geometry_ref) {
        const changed = first.current.map((_value: number, i: number) => i).filter((i: number) => first.current[i] !== second.current[i]);
        if (!state.visited.some((tuple: number[]) => equal(tuple, second.current))) state.visited.push(second.current);
        if (changed.length === 1) {
          const i = changed[0], targeted = equal(command, productPanelCommand(first.controls[i]));
          if (targeted) state.edges.push({ factor: i, from: first.current[i], to: second.current[i], before: first.current, after: second.current,
            evidence: [before.observation_ref, after.observation_ref] });
        } else if (changed.length) state.counterexamples.push({ command, changed_factors: changed, evidence: [before.observation_ref, after.observation_ref] });
      }
    } else state.boundary_witness = { before: before.observation_ref, after: after.observation_ref, official_score: after.levels_completed,
      catalogue_goal_causal_status: 'compatible_not_universal' };
    state.evidence.push(before.observation_ref, after.observation_ref);
    const event = { kind: 'observed_factor_product', state };
    this.applyEvent(event); return [structuredClone(event)];
  }
}

export async function commonProductPanelProposal(memory: ProductPanelMemory, observation: R, rows: NativeRows, inputs: readonly R[],
  remaining: number, config: R, levelDeadlineMs: number | null, now: Clock = () => performance.now(), base?: R | null): Promise<R | null> {
  if (remaining < 1) return null;
  if (levelDeadlineMs === null || levelDeadlineMs === undefined) throw new TypeError('Product experiment requires current level deadline');
  const proposal = memory.proposeProduct(observation, rows, inputs, Math.min(16, remaining), { ...config, remaining_level_actions: remaining }, levelDeadlineMs, now, base);
  if (!proposal || !Object.hasOwn(proposal, 'product_panel_plan')) return null;
  const scene = proposal.product_panel_plan.scene;
  for (const step of proposal.steps as R[]) {
    const control = scene.controls[step.factor], [x, y] = control.point, value = step.before_values[step.factor];
    step.expected_before = Object.fromEntries(['level_epoch', 'frame_hash', 'levels_completed', 'state'].map(key => [key, observation[key]]));
    step.point_support = { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref, frame_hash: observation.frame_hash,
      point: [x, y], palette_value: value, projection_bbox: [x, y, x, y], projected_rows_digest: await rowsDigest([[value]]),
      entity_ref: 'measured-control-envelope:' + identity(control.bbox), signature: identity([control.bbox, control.values]),
      scope: 'Current measured control locus. Later value is a frozen conditional predecessor prediction, revalidated at dispatch; no stale-coordinate or component-identity authority.' };
  }
  return proposal;
}

/** The source binder checks its measured support; dispatch owns the observed domain. */
export function bindProductPanel(proposal: R, _domain: ObservedInputDomain): void {
  for (const [index, action] of (proposal.actions as R[]).entries()) {
    const support = proposal.steps[index].point_support;
    if (!equal(support.point, [action.data.x, action.data.y])) throw new TypeError('Product point payload changed');
    proposal.steps[index].point_binding = { ...support };
  }
}
