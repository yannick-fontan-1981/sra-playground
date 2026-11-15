import { measureRootedLine, physicalRootedLine, projectedRootedLine, rootedLineConfiguration } from '../logos-engine/v6-rooted-line-observation.ts';
import { rootedLineEffect, rootedLineModel } from '../logos-engine/v6-rooted-line-mechanics.ts';
import { planCellPush, witnessedCellPush } from '../logos-engine/v6-rooted-line-revision.ts';
import { pythonEqual as equal } from '../logos-engine/v6-operations.ts';
import { searchPiercingPlans } from '../logos-engine/v5-piercing-plan.ts';
import { digest } from '../logos-engine/canonical.ts';
import type { CompiledModule } from '../logos-engine/ir.ts';
import type { NativeCommand, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { RecoveryPack } from './active-recovery.ts';
import { sicNeedId } from './need-identity.ts';
import { situationChoiceWorkflow } from './situation-choice-workflow.ts';
import { planOrderedLattice } from './contact-lattice.ts';

export const orderedContactId = 'sic_ordered_contact';
export const verifyContactOrderId = 'sic_verify_contact_order';
type EvidenceRow = NonNullable<ReturnType<typeof rootedLineEffect>>;
type Projection = ReturnType<typeof physicalRootedLine>;
type Configuration = Parameters<typeof projectedRootedLine>[0];
type Memory = { epoch: number; tried: string[]; effects: Record<string, EvidenceRow>;
  counterexample: readonly string[]; retained: Configuration | null; refused: boolean; transferableContact: readonly string[] };
type Plan = { command: NativeCommand; prediction: Projection | null; distance: number | null; configuration: Configuration | null };
type ContactProposal = NativeProposal & { contact: Plan; strategy: ContactPhase; needId: string };
const empty: Memory = { epoch: 0, tried: [], effects: {}, counterexample: [], retained: null, refused: false, transferableContact: [] };
const objective = 'G_official_completion';
export const orderedContactStrategies = {
  learn_command_displacement: 'Measure which part moves when this command is applied',
  order_components_by_contact: 'Test a route that aligns the components with the visible reference order',
  revise_contact_chain: 'Replan using the observed displacement of the contact chain',
  revalidate_contact_composition: 'Test whether the observed contact can construct the current reference order',
};
const situations = {
  learn_command_displacement: ['Exploration', 'An available command has no measured effect on the support.'],
  order_components_by_contact: ['Solving', 'The controls are measured and the visible reference gives an order to reproduce.'],
  revise_contact_chain: ['Exploration', 'The last model missed a displacement that affected several pieces.'],
  revalidate_contact_composition: ['Assimilation', 'An observed contact effect can be tested against the new board and reference order.'],
} as const;
const contactPrimitives = {
  learn_command_displacement: 'P05',
  revise_contact_chain: 'P07',
  revalidate_contact_composition: 'P02',
  order_components_by_contact: 'P07',
} as const;
type ContactPhase = keyof typeof contactPrimitives;
const phases = Object.keys(contactPrimitives) as ContactPhase[];
const moduleId = 'sic.choose_contact_response';
export const chooseContactResponse = moduleId + '.choose';

export async function contactChoiceModule(): Promise<CompiledModule> {
  const workflows = [situationChoiceWorkflow(chooseContactResponse, phases.map(phase => ({ situation: phase, strategy: phase })))];
  const hash = await digest(workflows);
  return { module_id: moduleId, source_name: 'src/sic/ordered-contact.ts', source_hash: hash, semantic_hash: hash, imports: [], workflows };
}

function contactPhase(value: unknown): value is ContactPhase {
  return typeof value === 'string' && Object.hasOwn(contactPrimitives, value);
}

export function createSicVerifyContactOrder(policy: Parameters<typeof rootedLineModel>[0], limits: RecoveryPack): NativeFamily<ContactProposal> {
  let memory: Memory = structuredClone(empty);
  let decide: NativeProgramHandle | undefined;
  function current(epoch: number): Memory {
    return memory.epoch === epoch ? memory : { ...structuredClone(empty), epoch, effects: memory.effects,
      transferableContact: memory.transferableContact };
  }
  function changedLevel(before: NativeObservation, after: NativeObservation) {
    return before.level_epoch !== after.level_epoch || before.levels_completed !== after.levels_completed || before.state !== after.state;
  }
  return {
    id: verifyContactOrderId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseContactResponse, {}, await contactChoiceModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !policy) return null;
      const scene = measureRootedLine(rows);
      if (!scene) return null;
      const { tried, effects, counterexample, retained, refused, transferableContact } = current(observation.level_epoch);
      if (refused) return null;
      const available = new Map(inputs.filter(input => !Object.keys(input.data).length).map(input => [input.action_ref, input]));
      const ref = observation.observation_ref;
      const unmeasured = (policy.probe_order as string[]).find(action =>
        available.has(action) && !tried.includes(action) && !Object.hasOwn(effects, action));
      const currentEffects = Object.fromEntries(Object.entries(effects).filter(([action]) => available.has(action)));
      const effectEvidence = Object.values(currentEffects).flatMap(effect => effect.evidence_refs as string[]);
      const proof: [string, ...string[]] = [ref, ...new Set([...effectEvidence, ...counterexample, ...transferableContact])];
      const now = execution?.now ?? (() => performance.now());
      const deadlineMs = execution?.deadlineMs ?? Infinity;
      const shouldStop = () => !!execution?.signal?.aborted || now() >= deadlineMs;
      const planFrom = (action: string, prediction: Projection | null = null, distance: number | null = null,
        configuration: Configuration | null = null): Plan | null => {
        const command = available.get(action);
        return command ? { command, prediction, distance, configuration } : null;
      };
      const depth = Math.min(limits.maxDepth, remaining, execution?.remainingLevelActions ?? remaining);
      const facts = {
        learn_command_displacement: !!unmeasured,
        revise_contact_chain: !!counterexample.length,
        revalidate_contact_composition: !!transferableContact.length,
        order_components_by_contact: !unmeasured && !counterexample.length,
        mode: execution?.reasoningMode ?? 'exploration',
      };
      const planners: Record<ContactPhase, () => Plan | null> = {
        learn_command_displacement: () => unmeasured ? planFrom(unmeasured) : null,
        revise_contact_chain: () => {
          const revised = planCellPush(scene, currentEffects, depth, limits.maxNodes, shouldStop);
          return revised ? planFrom(revised.command, revised.prediction, revised.predictedGoalDistance) : null;
        },
        revalidate_contact_composition: () => {
          const revised = planOrderedLattice(scene as Parameters<typeof planOrderedLattice>[0],
            Object.values(currentEffects).map(effect => ({
              action_ref: effect.action_ref, extent_delta: effect.extent_delta, root_translation: effect.root_translation,
            })), depth, limits.maxNodes, shouldStop);
          return revised ? planFrom(revised.command, revised.prediction, revised.distance) : null;
        },
        order_components_by_contact: () => {
          if (shouldStop() || !Object.keys(currentEffects).length) return null;
          const configuration = retained && equal(projectedRootedLine(retained), physicalRootedLine(scene))
            ? { ...retained, frame_ref: ref } : rootedLineConfiguration(scene, ref, observation.level_epoch);
          const result = searchPiercingPlans({ configuration, effects: Object.values(currentEffects), models: [rootedLineModel(policy)],
            goal_requested_root_ref: 'current_root', goal_requested_type_order: [...scene.order], max_microsteps: policy.max_microsteps,
            max_depth: depth, max_nodes: limits.maxNodes, max_plans: 1 }, { now, deadlineMs, shouldStop });
          const plan = result.plans.find((offer: { effects: unknown[] }) => offer.effects.length > 0);
          return plan ? planFrom(plan.effects[0].action_ref, projectedRootedLine(plan.steps[0].configuration),
            plan.effects.length, plan.steps[0].configuration) : null;
        },
      };
      const selectPlan = async () => {
        while (!shouldStop()) {
          const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
          const phase = decision?.result;
          if (!decision || !contactPhase(phase) || !facts[phase]) return null;
          const plan = planners[phase]();
          if (plan) return { phase, plan, decision };
          facts[phase] = false;
        }
        return null;
      };
      const selected = await selectPlan();
      if (!selected || shouldStop()) return null;
      const { phase, plan, decision } = selected;
      const strategy = contactPrimitives[phase];
      const goal = { kind: phase === 'learn_command_displacement' ? 'measure_control_effect' : 'achieve_observed_reference_order',
        scope: ref.split(':revision:', 1)[0]!, subjects: [scene.layout as string],
        parentObjective: objective, satisfactionContract: phase === 'learn_command_displacement'
          ? 'observe_displacement_in_public_return' : 'observe_game_advance_after_alignment' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `contact:${need.id}`, label = orderedContactStrategies[phase], actions = [plan.command];
      const [mode, situation] = situations[phase];
      return { status: 'proposed', kind: verifyContactOrderId, strategy: phase, contact: plan, needId: need.id, actions,
        rooted_line_plan: { scene: { root: scene.root, pieces: scene.pieces.slice(0, 8) } },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, phase } },
        sicSituationCard: { strategy, need: goal.kind === 'measure_control_effect' ? 'Understand a command' : 'Reproduce the visible reference order',
          mode, situation, agenda: [], triggerCard: decision.receipt.workflow, evidence: proof, distance: plan.distance },
        steps: [{ action: plan.command, expected_after: plan.prediction }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_reference_order_bound' : 'reference_order_scene_changed' };
    },
    after(proposal, _index, before, after, _oldRows, newRows) {
      const boundary = changedLevel(before, after);
      const scene = boundary ? null : measureRootedLine(newRows);
      const matched = scene && proposal.contact.prediction ? equal(physicalRootedLine(scene), proposal.contact.prediction) : null;
      const advanced = after.levels_completed > before.levels_completed;
      return { matched, seal_prefix: true, reason: boundary ? 'official_boundary'
        : matched === null ? 'control_effect_awaits_measurement' : matched ? 'contact_projection_confirmed' : 'contact_projection_contradicted',
        ...(advanced ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, oldRows, newRows, proposal) {
      memory = structuredClone(current(before.level_epoch));
      const first = measureRootedLine(oldRows), second = measureRootedLine(newRows);
      if (changedLevel(before, after) || !first || !second) return { events: [] };
      const refs = [before.observation_ref, after.observation_ref] as const;
      const action = command.action_ref;
      const previousEffect = memory.effects[action];
      if (proposal.strategy === 'learn_command_displacement') {
        memory.tried.push(action);
        const effect = rootedLineEffect(action, first, second, refs);
        if (effect) memory.effects[action] = effect;
      } else if (equal(physicalRootedLine(second), proposal.contact.prediction)) {
        memory.retained = proposal.contact.configuration;
      } else if (!memory.counterexample.length && proposal.contact.prediction && previousEffect
        && witnessedCellPush(first, second, proposal.contact.prediction, previousEffect)) {
        memory.counterexample = refs;
        memory.transferableContact = refs;
        memory.retained = null;
      } else {
        memory.refused = true;
        memory.retained = null;
      }
      return { events: [] };
    },
    state: () => ({ ...memory }),
    restore(state: NativeRecord) { memory = structuredClone(state as Memory); },
  };
}
