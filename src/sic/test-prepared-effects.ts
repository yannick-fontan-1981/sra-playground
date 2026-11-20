import {repeatedFrameCommand} from './inverse-frame-experiment.ts';
import { newDelayedMemory } from './distinguishing-suffix.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type {
  NativeFamily,
  NativeObservation,
  NativeCommand,
  NativeRows,
  NativeProposal,
} from '../logos-engine/v6-native-types.ts';
import { observedCommandKey } from './observed-command-frontier.ts';
import {
  initialMemory,
  experimentCommand,
  selectExperiment,
  recordExperiment,
  type Experiment,
} from './preparation-experiments.ts';
import { sicNeedId } from './need-identity.ts';
import { exhaustedGroup } from './test-observed-compositions.ts';
export const preparedEffectsId = 'sic_test_prepared_effects';
import { freshCapabilities } from './derive-capabilities.ts';
import { newSpatialMemory } from './spatial-access.ts';
import {newFrontierMemory} from './experimental-frontier.ts';
import { newProjectionMemory } from './projected-affordances.ts';
type Offer = NativeProposal & { experiment: Experiment };
const labels: Record<Experiment['phase'], string> = {
  activateResponse:'Test what a command can move after another component was repositioned',
  inverseFrame:'Place a learned reference to reach a predicted destination and continue from it',
  instrumentSite:'Test the control at a new spatial binding and compare what becomes reachable',
  transportControl: 'Test which component inherits a command when the original configuration is restored',
  placedExchange: 'Place a movable partner to reach and use a predicted destination',
  configuredTransfer: 'Test the predicted destination and next move after configuring two sites',
  conditionSetup: 'Place a partner where the observed spatial conditions predict a motion',
  conditionTrigger: 'Compare the predicted motion with the inactive control at the original placement',
  conditionUse: 'Test the predicted use of the newly reached location',
  delayedProbe: 'Test a matched control program after moving or changing its preparation',
  frontierRoute:'Return along witnessed edges to an unanswered experiment',
  frontierProbe:'Try a previously unmeasured control at its selected configuration',
  frontierConsequence: 'Exercise the use made available by the prepared landing',
  frontierUse:'Test the predicted continuation of the newly measured transition',
  projection: 'Test a projected arrangement, arrival and subsequent action',
  capabilityUse: 'Exercise the predicted new access furnished by the invented capability',
  capabilityStep: 'Test a new capability derived from witnessed operators',
  accessContinue: 'Exercise an untested command at the predicted destination',
  accessSetup: 'Arrange the measured bodies for a predicted destination',
  accessTrigger: 'Test the destination derived from this spatial configuration',
  prepare: 'Prepare a second condition for an action with a measured baseline',
  probe: 'Measure B after A from the matched starting scene',
  control: 'Measure B alone from the original starting scene',
  confirmControl: 'Predict and independently repeat the B-only control',
  confirmA: 'Recreate the preparation of the controlled experiment',
  confirmB: 'Test the prediction for B after the preparation',
  reuseA: 'Apply a verified preparation to reach an untested continuation',
  reuseB: 'Use the learned effect and check the predicted landing',
  route: 'Follow a witnessed transition to the controlled experiment',
  inverse: 'Test an inverse learned from public returns and verify the exact experimental origin',
  explore: 'Test a new continuation at the reached destination',
  position: 'Test an accessible arrangement with a visible landmark',
  positionB: 'Measure B at the reached arrangement',
  deriveControl: 'Measure the unprepared control at the proposed new site',
  deriveA: 'Recreate the learned change at the new site',
  deriveB: 'Test the derived prediction at the new site',
  carry: 'Move the changed object while preserving its measured state',
  carryB: 'Test the transported change against the control from this destination',
};
export function createPreparedEffects(): NativeFamily<Offer> {
  let m = initialMemory(0);
  function acquire(
    b: NativeObservation,
    a: NativeObservation,
    cmd: NativeCommand,
    rows: NativeRows,
    next: NativeRows,
    x?: Experiment
  ) {
    if (m.epoch !== b.level_epoch) m = initialMemory(b.level_epoch);
    if (!x && (b.level_epoch !== a.level_epoch || b.state !== a.state)) return null;
    return recordExperiment(m, b, a, cmd, rows, next, x);
  }
  return {
    id: preparedEffectsId,
    propose: () => null,
    async proposeInGroup(group, o, rows, inputs, remaining) {
      if (remaining < 1 || m.epoch !== o.level_epoch || !m.turns) return null;
      const available = [...inputs];
      for (const op of o.available_action_refs)
        if (op !== 'ACTION6' && !available.some((c) => c.action_ref === op))
          available.push({ action_ref: op, data: {} });
      const experiment = selectExperiment(m, o, available, group === exhaustedGroup, rows);
      if (!experiment) return null;
      const { a, b, phase } = experiment;
      const key=experimentCommand(experiment);
      const command = available.find((c) => observedCommandKey(c) === key) ?? (experiment.frame||experiment.activation ? repeatedFrameCommand(key,o,rows) : null);
      if (!command) return null;
      const ref = o.observation_ref,
        label = experiment.frame?.plan.basis==='observed_preparation' ? 'Measure the response after a witnessed change of reference' : labels[phase],
        parent = 'G_official_completion';
      const evidence = [
        ref,
        ...experiment.refs.map(
          (r) =>
            ref.split(':revision:', 1)[0] +
            ':revision:' +
            r +
            ':frame:' +
            m.scenes[m.revisionScene[r]!]!.split('|')[0]
        ),
      ];
      const question = {
        kind: 'test_prepared_effect',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: [a, b, experiment.rule, phase],
        parentObjective: parent,
        satisfactionContract: 'compare_the_public_effect_of_B_after_each_preparation',
      };
      const equation = experiment.equation?.claim;
      const capability = equation
        ? {
            unknown: 'effect of the proposed program',
            kind: equation.kind,
            roles: equation.roles,
            initial: equation.initial,
            goal: equation.goal,
            derived_effect: equation.effect,
            control: equation.control,
            program: equation.program,
            opportunity: equation.opportunity,
            choices: experiment.equation!.choices,
          }
        : null;
      const projected = experiment.projection?.plan;
      const link=experiment.transfer?.plan;
      const imagined = experiment.instrument?.plan ?? experiment.transport?.plan ?? experiment.exchange?.program ?? (link ? {role:link.role,entry:link.entry,exit:link.exit,placement:link.prepare,arrival:link.desired,subsequent:link.following,alternatives:link.alternatives} : projected ? { roles: projected.roles, placement: projected.steps[projected.arrival]!.from,
        arrival: projected.steps[projected.arrival]!.to, continuation: projected.steps[projected.arrival+1], control: projected.steps[projected.arrival]!.control ?? null, goals: projected.goals, alternatives: experiment.projection?.alternatives ?? [] } : experiment.access
        ? {
            chosen: {
              actor: experiment.access.card.law.actor,
              trigger: experiment.access.card.law.op,
              launch: experiment.access.card.launch,
              placement: experiment.access.card.anchorAt,
              destination: experiment.access.card.destination,
              interest: experiment.access.card.interest,
              score: experiment.access.card.score,
            },
            alternatives: experiment.access.alternatives,
          }
        : null);
      const need = { ...question, id: sicNeedId(question), status: 'assigned', evidence };
      const witness =
        command.action_ref === 'ACTION6'
          ? await ObservedInputDomain.makeLocusWitness(o, rows, [command.data.x!, command.data.y!], {
              reason: label,
              evidence,
            })
          : null;
      return {
        status: 'proposed',
        kind: preparedEffectsId,
        actions: [command],
        experiment,
        ...(experiment.instrument ? { instrumentForecast: experiment.instrument.plan, instrumentPosition: experiment.instrument.predicted } : {}),
        ...(experiment.activation ? {activationForecast:experiment.activation} : {}),
        ...(experiment.frame ? {frameForecast:experiment.frame} : {}),
        ...(experiment.retained ? {retainedForecast: experiment.retained} : {}),
        ...(experiment.transport ? { transportForecast: experiment.transport.plan } : {}),
        ...(experiment.exchange ? { exchangeForecast: experiment.exchange.program } : {}),
        ...(imagined ? { spatial_forecast: imagined } : {}),
        ...(experiment.delayed ? { conditional_program: experiment.delayed } : {}),
        ...(experiment.frontier ? { reachable_experiment: experiment.frontier } : {}),
        ...(experiment.condition ? { conditional_placement: experiment.condition } : {}),
        ...(capability ? { capability_equation: capability } : {}),
        steps: [{ action: command, expected_after: null, ...(witness ? { point_binding: witness } : {}) }],
        binding: { observation_ref: ref, level_epoch: o.level_epoch },
        sicSituationCard: {
          strategy: phase,
          need: label,
          situation: label,
          mode: 'exploration',
          evidence,
          agenda: [],
        },
        compositions: [
          { id: need.id, observed: false, open_question: label, relations: ['contributes_to:' + parent] },
        ],
        question: {
          reason: label,
          hypothesis_refs: evidence,
          ...(imagined ? { spatial_forecast: imagined } : {}),
          ...(capability ? { capability_equation: capability } : {}),
        },
        route_refs: evidence,
        sicLocalDecision: { strategy: phase, objective: { id: need.id, label, parent }, need },
        bundle_template: {
          operation_key: 'OP18',
          composition_ref: need.id,
          objective_ref: parent,
          purpose: label,
          evidence,
          preconditions: {},
          preserve_refs: [],
          actions: [command],
          outcome_guard: { path: ['value'], contains: need.id },
        },
      };
    },
    before(p, i, _packet, o) {
      const admitted = i === 0 && p.binding?.observation_ref === o.observation_ref;
      return { admitted, reason: admitted ? 'matched_preparation_bound' : 'stale_preparation' };
    },
    after(_p, _i, b, a) {
      const won = a.levels_completed > b.levels_completed;
      return {
        matched: won ? true : null,
        seal_prefix: true,
        reason: won ? 'official_boundary' : 'measure_prepared_return',
      };
    },
    observePublicOutcome(b, a, c, r, n) {
      acquire(b, a, c, r, n);
    },
    record(b, a, c, r, n, p) {
      const outcome = acquire(b, a, c, r, n, p.experiment);
      return {
        events: outcome ? [{ kind: 'sic_preparation_outcome', epoch: b.level_epoch, ...outcome }] : [],
      };
    },
    state: () => m,
    restore(value) {
      m = structuredClone(value as typeof m);
      m.delayed ??= newDelayedMemory();
      m.frontier ??= {...newFrontierMemory(),lastEdge:m.turns,lastScene:m.turns};
      m.projection ??= newProjectionMemory();
      m.space ??= newSpatialMemory();
      m.equations ??= freshCapabilities();
    },
  };
}
