/**
 * PanelServiceAccess's complete own layer from pinned V6 source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. The shared series owner dispatches
 * ancestors, applies their records first, and owns the single common journal.
 */
import { measurePanelService, panelServiceProjection as projection } from './v6-panel-service-observation.ts';
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal, pythonTruthy as truth } from './v6-operations.ts';
import { compareUnicode } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type BeforeMeta = { epoch: number; score: number; observation_ref: string; available: readonly string[] };
type AfterMeta = { epoch: number; score: number; state?: string };
export interface PanelServiceState { panel_memory: R; panel_events: R[] }

export function panelServiceBefore(proposal: R, index: number, rows: NativeRows, meta: BeforeMeta): R {
  const plan = proposal.panel_service_plan;
  if (!truth(plan)) throw new TypeError('Panel service admission requires panel_service_plan');
  const scene = measurePanelService(rows, plan.memory.symbols);
  let admitted = scene !== null && equal(scene.layout, plan.scene.layout) && equal([meta.epoch, meta.score], [plan.epoch, plan.score])
    && equal(proposal.actions, plan.commands) && equal(plan.commands, proposal.bundle_template.actions)
    && proposal.proposal_id === 'panel-service:' + identity(plan) && meta.available.includes(plan.commands[index].action_ref);
  if (index === 0) admitted = admitted && identity(rows) === plan.frame_digest && meta.observation_ref === plan.observation_ref;
  else admitted = admitted && equal(projection(scene!), plan.steps[index - 1].expected);
  const edit = plan.steps[index].edit;
  if (admitted && truth(edit)) {
    const panel = scene!.panels.find((item: R) => item.id === edit.panel), cell = edit.cell;
    const current = panel ? panel.cells.find((item: R) => equal(item.point, cell.point)) : null;
    admitted = current !== null && current !== undefined && equal(current.pattern, cell.pattern) && current.color === cell.color
      && equal(plan.commands[index].data, { x: current.point[0], y: current.point[1] });
  }
  return { admitted: Boolean(admitted), reason: admitted ? 'current_panel_service_bound' : 'panel_service_binding_changed' };
}

export function panelServiceAfter(proposal: R, index: number, _rows: NativeRows, later: NativeRows, meta: AfterMeta): R {
  const plan = proposal.panel_service_plan;
  if (!truth(plan)) throw new TypeError('Panel service outcome requires panel_service_plan');
  const scene = measurePanelService(later, plan.memory.symbols), boundary = !equal([meta.epoch, meta.score], [plan.epoch, plan.score]);
  const expected = plan.steps[index].expected;
  const matched = boundary || expected === null || scene === null ? null : equal(projection(scene), expected);
  return { matched, seal_prefix: boundary || matched !== true,
    reason: matched ? 'panel_selection_projection' : 'shared_response_requires_reconciliation' };
}

export class PanelServiceMemory {
  private panelMemory: R = { symbols: [], evidence: [], selection_observed: false, effects: [], failed: [] };
  private panelEvents: R[] = [];
  private version = 0;

  get nativeRevision(): number { return this.version; }
  get eventCount(): number { return this.panelEvents.length; }
  currentState(): PanelServiceState { return structuredClone({ panel_memory: this.panelMemory, panel_events: this.panelEvents }); }
  retainedDigest(ancestor: string): string { return identity([ancestor, this.panelMemory, this.panelEvents]); }

  applyEvent(event: R): void {
    if (event.kind !== 'observed_panel_service') throw new TypeError(`Outside panel-service layer: ${String(event.kind)}`);
    const owned = retainNativeJson(event);
    if (!Object.hasOwn(owned, 'memory')) throw new TypeError('Panel service event lacks its memory');
    this.version++;
    this.panelMemory = owned.memory;
    this.panelEvents.push(owned);
  }

  /** Null delegates to the next inherited planner; blocking refusals do not. */
  propose(observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
    const cfg = config.panel_service_question;
    // Source scene is pure, so the absent-config delegation needs no raster scan.
    if (!truth(cfg)) return null;
    const scene = measurePanelService(rows, this.panelMemory.symbols);
    if (!scene) return null;
    if (!observation.available_action_refs.includes('ACTION6')) return { status: 'unknown', reason: 'panel_pointing_unavailable', block_unrelated_probe: true };
    const memory = structuredClone(this.panelMemory), prepared: R[] = [], unresolved: string[] = [], contributions: R[] = [];
    for (const panel of scene.panels) for (const service of panel.services) {
      if (!memory.symbols.some((symbol: unknown) => equal(symbol, service.symbol))) memory.symbols.push(service.symbol);
    }
    const receivers = scene.panels.flatMap((panel: R) => panel.services.filter((service: R) => service.kind === 'displayed_receiver')
      .map((service: R) => [panel, service]));
    for (const panel of scene.panels) {
      const direct = panel.operators.filter((service: R) => service.kind === 'displayed_receiver' && service.input === panel.material);
      const rewrite = panel.operators.filter((service: R) => service.kind === 'displayed_rewrite' && service.input === panel.material
        && panel.services.some((receiver: R) => receiver.kind === 'displayed_receiver' && service.output === receiver.input));
      let operator: R | null = null, parameter: R | null = null, reason: string | null = null;
      if (direct.length === 1) { operator = direct[0].control; reason = 'current_material_matches_local_receiver'; }
      else if (rewrite.length === 1) { operator = rewrite[0].control; reason = 'displayed_rewrite_prepares_local_receiver'; }
      else {
        const destinations = receivers.filter(([peer, service]: [R, R]) => service.input === panel.material && peer.room_marker !== panel.room_marker)
          .map(([peer]: [R, R]) => peer);
        const choices: [R, R][] = [];
        if (destinations.length === 1) for (const control of panel.activity_controls) {
          const parameters = panel.cells.filter((cell: R) => cell.row === control.row && cell.col >= 2 && cell.solid && cell.color === destinations[0].room_marker);
          if (parameters.length === 1) choices.push([control, parameters[0]]);
        }
        if (choices.length === 1) { [operator, parameter] = choices[0]!; reason = 'test_room_parameter_to_prepare_matching_receiver'; }
      }
      if (operator === null) { unresolved.push(panel.id); continue; }
      contributions.push({ panel: panel.id, reason, material: panel.material, operator_symbol: operator.pattern, parameter });
      if (operator.outline !== panel.selection_color) prepared.push({ panel: panel.id, cell: operator, field: 'activity', reason });
      if (parameter !== null && parameter.outline === null) prepared.push({ panel: panel.id, cell: parameter, field: 'parameter', reason });
    }
    if (unresolved.length) return { status: 'unknown', reason: 'panel_service_correspondence_unresolved', missing_panels: unresolved, block_unrelated_probe: true };
    let actions: R[] = [], steps: R[] = [], kind = 'configuration';
    const expected = projection(scene);
    for (const edit of prepared.slice(0, Math.min(limit, 16))) {
      const command = { action_ref: 'ACTION6', data: { x: edit.cell.point[0], y: edit.cell.point[1] } };
      const trial = identity([observation.level_epoch, projection(scene), command]);
      if (memory.failed.includes(trial)) return { status: 'unknown', reason: 'panel_configuration_refused_in_context', block_unrelated_probe: true };
      const panel = expected.find(item => item.id === edit.panel)!, cell = edit.cell;
      if (edit.field === 'activity') panel.activity = [cell.row];
      else {
        panel.parameters = [...panel.parameters.filter((value: number[]) => value[0] !== cell.row), [cell.row, cell.col]];
        panel.parameters.sort((a: number[], b: number[]) => a[0]! - b[0]! || a[1]! - b[1]!);
      }
      actions.push(command); steps.push({ edit, expected: structuredClone(expected), trial });
      if (!memory.selection_observed) break;
    }
    if (!prepared.length) {
      const candidates = inputs.filter(action => action.action_ref !== 'ACTION6' && observation.available_action_refs.includes(action.action_ref))
        .map(action => action.action_ref as string).sort(compareUnicode);
      if (!candidates.length) return { status: 'unknown', reason: 'shared_application_control_unknown', block_unrelated_probe: true };
      const command = { action_ref: candidates[0]! }, trial = identity([observation.level_epoch, projection(scene), command]);
      if (memory.failed.includes(trial)) return { status: 'unknown', reason: 'shared_application_no_information', block_unrelated_probe: true };
      actions = [command]; steps = [{ edit: null, expected: null, trial }]; kind = 'application';
    }
    const why = cfg[kind], evidence = [...new Set([...memory.evidence, observation.observation_ref])];
    const plan = structuredClone({ scene, memory, commands: actions, steps, contributions, kind, why,
      epoch: observation.level_epoch, score: observation.levels_completed, observation_ref: observation.observation_ref, frame_digest: identity(rows) });
    const ref = 'panel-service:' + identity(plan);
    return { status: 'proposed', kind: 'panel_service', proposal_id: ref, panel_service_plan: plan, actions,
      steps: actions.map(action => ({ action, expected_after: null })),
      facts: { current_panel_symbols_measured: true, service_goal_is_library_hypothesis: true, shared_turn_law_unknown: true },
      compositions: [{ id: ref, observed: false, open_question: why, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: evidence }, route_refs: evidence,
      binding: { level_epoch: observation.level_epoch, observation_ref: observation.observation_ref },
      bundle_template: { operation_key: 'OP18', composition_ref: ref, objective_ref: 'G_official_completion', purpose: why,
        evidence, preconditions: {}, actions, outcome_guard: { path: ['value'], contains: ref } } };
  }

  /** The owner calls ancestor records first; this reducer emits its own layer once. */
  record(before: R, command: R, after: R, rows: NativeRows, later: NativeRows, proposal: R, index: number): R[] {
    const plan = proposal.panel_service_plan;
    if (!truth(plan)) return [];
    const memory = structuredClone(this.panelEvents.length ? this.panelMemory : plan.memory);
    memory.symbols = structuredClone(plan.memory.symbols);
    const scene = measurePanelService(later, memory.symbols), step = plan.steps[index];
    const boundary = before.level_epoch !== after.level_epoch, changed = identity(rows) !== identity(later);
    const detail: R = { before: before.observation_ref, after: after.observation_ref, kind: plan.kind, command,
      boundary, pixel_changed: changed, prediction_matched: null, score_delta: after.levels_completed - before.levels_completed };
    if (!boundary && step.expected !== null && scene !== null) {
      const matched = equal(projection(scene), step.expected); detail.prediction_matched = matched;
      if (matched) memory.selection_observed = true;
      else memory.failed.push(step.trial);
    } else if (!changed || !boundary && plan.kind === 'application' && scene !== null && equal(projection(scene), projection(plan.scene))) {
      memory.failed.push(step.trial); detail.no_panel_service_information = true;
    }
    memory.evidence = [...new Set([...memory.evidence, before.observation_ref, after.observation_ref])];
    memory.effects.push(detail);
    const event = structuredClone({ kind: 'observed_panel_service', memory, detail });
    this.applyEvent(event);
    return [event];
  }
}

export function proposePanelService(memory: PanelServiceMemory, observation: R, rows: NativeRows, inputs: readonly R[], limit: number, config: R): R | null {
  return memory.propose(observation, rows, inputs, limit, config);
}
