import { measuredMetricScene, MetricComposition } from '../logos-engine/v6-metric-composition.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativeProposal, NativeRecord } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const metricCompositionId = 'sic_compose_measured_supports';
export const learnMetricCompositionId = 'sic_learn_metric_selection';

const supportedInputs = (observation: NativeObservation) =>
  observation.available_action_refs.includes('ACTION5') && observation.available_action_refs.includes('ACTION6');

export function createSicMetricComposition(family = metricCompositionId): NativeFamily {
  const solver = new MetricComposition();
  const learns = family === learnMetricCompositionId;
  let selection: { epoch: number; grid: string; target: string; refs: string[] } | null = null;
  return {
    id: family,
    observePublicOutcome(before, after, command, oldRows, rows) {
      if (!learns || command.action_ref !== 'ACTION5' || !supportedInputs(before)
        || before.level_epoch !== after.level_epoch) return;
      const old = measuredMetricScene(oldRows), next = old && measuredMetricScene(rows);
      if (!old || !next || next.selected === null || next.selected === old.selected || next.grid_ref !== old.grid_ref
        || next.target_ref !== old.target_ref || !next.fills.every((fill: string, index: number) => fill === old.fills[index])) return;
      selection = { epoch: after.level_epoch, grid: next.grid_ref, target: next.target_ref,
        refs: [before.observation_ref, after.observation_ref] };
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (!supportedInputs(observation) || (learns && selection?.epoch !== observation.level_epoch)) return null;
      if (learns) {
        const scene = measuredMetricScene(rows);
        if (!scene || scene.grid_ref !== selection?.grid || scene.target_ref !== selection?.target) return null;
      }
      const planned = await solver.propose(observation, rows, inputs, remaining, execution) as NativeProposal | null;
      if (!planned?.question || !planned.steps || !planned.bundle_template) return null;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence = [...new Set([ref, ...(selection?.refs ?? []),
        ...(Array.isArray(planned.route_refs) ? planned.route_refs as string[] : [])])];
      const objective = { kind: 'match_scaled_reference_with_measured_supports', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['movable_occurrences', 'visible_supports', 'scaled_reference'], parentObjective: parent,
        satisfactionContract: 'continue_while_selection_and_predicted_visible_occupancy_are_confirmed' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const label = 'Select a piece and follow its measured supports toward the reference arrangement';
      const actions: NativeCommand[] = planned.actions.map(action => ({ ...action, data: action.data ?? {} }));
      const steps = planned.steps.map((step, index) => ({ ...step, action: actions[index]! }));
      return { ...planned, kind: family, route_refs: evidence, actions, steps,
        bundle_template: { ...planned.bundle_template, actions },
        sicSituationCard: { strategy: 'P07', need: 'Reproduce the reference arrangement', situation: label,
          mode: execution?.reasoningMode ?? 'solving', agenda: [], evidence },
        sicLocalDecision: { strategy: 'P07', objective: { id: family + ':' + need.id, label, parent }, need } };
    },
    bind: proposal => solver.bind(proposal),
    before: (proposal, index, packet, observation) => solver.before(proposal, index, packet, observation),
    after: (proposal, index, before, after, oldRows, rows) => solver.after(proposal, index, before, after, oldRows, rows),
    record: (before, after, command, oldRows, rows, proposal, index, frames) =>
      solver.record(before, after, command, oldRows, rows, proposal, index, frames),
    state: () => ({ solver: solver.state(), selection }),
    restore(value: NativeRecord) {
      if (value.solver) solver.restore(value.solver as NativeRecord);
      selection = (value.selection as typeof selection | undefined) ?? null;
    },
  };
}
