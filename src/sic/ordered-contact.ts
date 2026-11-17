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
import { measureFixedGuides, planOrderedLattice } from './contact-lattice.ts';
import { measureReceivingGuides, type ReceivingGuideLayout } from './receiving-guide-scene.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { measureStockedPiercing, planStockedPiercing, stockedPiercingGeometry, stockedPiercingMoves, stockedPlacementKey,
  type RefusedPiercingStep } from './stocked-piercing.ts';

export const orderedContactId = 'sic_ordered_contact';
export const verifyContactOrderId = 'sic_verify_contact_order';
export const learnContactOrderId = 'sic_learn_contact_order';
type EvidenceRow = NonNullable<ReturnType<typeof rootedLineEffect>>;
type Projection = ReturnType<typeof physicalRootedLine>;
type Configuration = Parameters<typeof projectedRootedLine>[0];
type Memory = { epoch: number; tried: string[]; effects: Record<string, EvidenceRow>;
  counterexample: readonly string[]; retained: Configuration | null; refused: boolean; guideRefused?: boolean; receiverLayout?: ReceivingGuideLayout;
  transferableContact: readonly string[]; stockRefusals?: RefusedPiercingStep[] };
type Plan = { command: NativeCommand; prediction: Projection | null; distance: number | null; configuration: Configuration | null };
type ContactProposal = NativeProposal & { route: Plan[]; layout: unknown; strategy: ContactPhase; needId: string;
  receiverLayout?: ReceivingGuideLayout; adoptedEffect?: EvidenceRow; stocked?: true };
const empty: Memory = { epoch: 0, tried: [], effects: {}, counterexample: [], retained: null, refused: false, transferableContact: [] };
const objective = 'G_official_completion';
const maximumReceivingGuidePlacements = 20_000;
export const orderedContactStrategies = {
  learn_command_displacement: 'Measure which part moves when this command is applied',
  compose_axial_guide_release: 'Make the reference order by sliding pieces along a fixed guide',
  order_components_by_contact: 'Test a route that aligns the components with the visible reference order',
  revise_contact_chain: 'Replan using the observed displacement of the contact chain',
  revalidate_contact_composition: 'Test whether the observed contact can construct the current reference order',
  compose_stocked_order: 'Rearrange interchangeable pieces to assemble the visible order',
};
const situations = {
  learn_command_displacement: ['Exploration', 'An available command has no measured effect on the support.'],
  compose_axial_guide_release: ['Solving', 'A fixed guide crosses the playfield. Pieces on it can slide along the guide and leave it at the end.'],
  order_components_by_contact: ['Solving', 'The controls are measured and the visible reference gives an order to reproduce.'],
  revise_contact_chain: ['Exploration', 'The last model missed a displacement that affected several pieces.'],
  revalidate_contact_composition: ['Assimilation', 'An observed contact effect can be tested against the new board and reference order.'],
  compose_stocked_order: ['Solving', 'The reference repeats a material or the available stock has duplicates. The route verifies the whole span and each piece displacement.'],
} as const;
const contactPrimitives = {
  learn_command_displacement: 'P05',
  compose_axial_guide_release: 'P07',
  revise_contact_chain: 'P07',
  revalidate_contact_composition: 'P02',
  order_components_by_contact: 'P07',
  compose_stocked_order: 'P07',
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

function measureContactScene(rows: NativeRows, receiverLayout?: ReceivingGuideLayout): ReturnType<typeof measureRootedLine> {
  const scene = receiverLayout ? measureReceivingGuides(rows, receiverLayout) : measureRootedLine(rows) ?? measureReceivingGuides(rows);
  if (!scene) return null;
  // Use the visible reference order so palette values cannot affect search ordering.
  const kinds = new Map((scene.order as string[]).map((type, index) => [type, String(index).padStart(2, '0')]));
  const pieces = new Map((scene.pieces as NativeRecord[]).map(piece => [String(piece.type), piece]));
  const receivingGuides = (scene.receivingGuides as NonNullable<ReturnType<typeof measureReceivingGuides>>['receivingGuides'] | undefined)?.map(guide =>
    ({ ...guide, order: guide.order.map(type => kinds.get(type)!) }));
  return { ...scene, ...(receivingGuides ? { receivingGuides } : {}), order: [...kinds.values()], pieces: [...kinds].map(([type, rank]) =>
    ({ ...pieces.get(type), id: 'material:' + rank, type: rank })) };
}

function contactGeometry(rows: NativeRows, receiverLayout?: ReceivingGuideLayout, stocked?: boolean): ReturnType<typeof measureRootedLine> {
  if (!stocked) return measureContactScene(rows, receiverLayout);
  const scene = measureStockedPiercing(rows);
  return scene ? stockedPiercingGeometry(scene, scene.placement) : null;
}

export function createSicVerifyContactOrder(policy: Parameters<typeof rootedLineModel>[0], limits: RecoveryPack,
  family = verifyContactOrderId): NativeFamily<ContactProposal> {
  const learns = family === learnContactOrderId;
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
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseContactResponse, {}, await contactChoiceModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      if (remaining < 1 || !policy) return null;
      let retainedMemory = current(observation.level_epoch);
      const fixedScene = measureContactScene(rows, retainedMemory.receiverLayout);
      const stock = fixedScene ? null : measureStockedPiercing(rows);
      const scene = fixedScene ?? (stock && stockedPiercingGeometry(stock, stock.placement));
      if (!scene) return null;
      let adoptedEffect: EvidenceRow | null = null;
      if (learns && memory.epoch !== observation.level_epoch) {
        const prior = execution?.readPriorDirectionalScene?.(rows => contactGeometry(rows, retainedMemory.receiverLayout, !!stock));
        if (!prior || prior.afterRef !== observation.observation_ref || prior.levelEpoch !== observation.level_epoch) return null;
        adoptedEffect = rootedLineEffect(prior.command, prior.scene, scene, [prior.beforeRef, prior.afterRef]);
        if (!adoptedEffect) return null;
        retainedMemory = { ...retainedMemory, effects: { ...retainedMemory.effects, [prior.command]: adoptedEffect } };
      }
      const { tried, effects, counterexample, retained, refused, guideRefused, transferableContact } = retainedMemory;
      if (refused) return null;
      const available = new Map(inputs.filter(input => !Object.keys(input.data).length).map(input => [input.action_ref, input]));
      const ref = observation.observation_ref;
      const unmeasured = (policy.probe_order as string[]).find(action =>
        available.has(action) && !tried.includes(action) && !Object.hasOwn(effects, action));
      const currentEffects = Object.fromEntries(Object.entries(effects).filter(([action]) => available.has(action)));
      const latticeEffects = Object.values(currentEffects).map(effect => ({
        action_ref: effect.action_ref, extent_delta: effect.extent_delta, root_translation: effect.root_translation,
      }));
      const lattice = scene as Parameters<typeof planOrderedLattice>[0] & { background: number };
      const receivers = fixedScene?.receivingGuides as NonNullable<ReturnType<typeof measureReceivingGuides>>['receivingGuides'] | undefined;
      const guides = guideRefused || stock ? [] : receivers?.map(receiver => receiver.box) ?? measureFixedGuides(rows, lattice);
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
      const retainedRoute = (path: { command: string; prediction: Projection; configuration?: Configuration }[], distance: number) => {
        const steps: Plan[] = [];
        for (const step of path.slice(0, maximumCommittedActions)) {
          const planned = planFrom(step.command, step.prediction, distance - steps.length, step.configuration);
          if (!planned) break;
          steps.push(planned);
        }
        return steps.length ? steps : null;
      };
      const depth = Math.min(limits.maxDepth, remaining, execution?.remainingLevelActions ?? remaining);
      const facts = {
        learn_command_displacement: !!unmeasured,
        compose_axial_guide_release: guides.length > 0 && latticeEffects.length > 0,
        revise_contact_chain: !stock && !receivers && !!counterexample.length,
        revalidate_contact_composition: !stock && !receivers && !!transferableContact.length,
        order_components_by_contact: !stock && !receivers && !unmeasured && !counterexample.length,
        compose_stocked_order: !!stock && !unmeasured && latticeEffects.length > 0,
        mode: execution?.reasoningMode ?? 'exploration',
      };
      const planners: Record<ContactPhase, () => Plan[] | null> = {
        learn_command_displacement: () => {
          const trial = unmeasured ? planFrom(unmeasured) : null;
          return trial ? [trial] : null;
        },
        compose_axial_guide_release: () => {
          const maximumPlacements = receivers ? maximumReceivingGuidePlacements : limits.maxNodes;
          const plan = planOrderedLattice(lattice, latticeEffects, depth, maximumPlacements, shouldStop, guides, receivers);
          return plan ? retainedRoute(plan.route, plan.distance) : null;
        },
        revise_contact_chain: () => {
          const revised = planCellPush(scene, currentEffects, depth, limits.maxNodes, shouldStop, { retainRoute: true });
          return revised?.route ? retainedRoute(revised.route, revised.predictedGoalDistance) : null;
        },
        revalidate_contact_composition: () => {
          const revised = planOrderedLattice(lattice, latticeEffects, depth, limits.maxNodes, shouldStop);
          return revised ? retainedRoute(revised.route, revised.distance) : null;
        },
        compose_stocked_order: () => {
          if (!stock) return null;
          const moves = stockedPiercingMoves(stock.layout, latticeEffects).sort((a, b) => a.action.localeCompare(b.action));
          const path = planStockedPiercing(stock, moves, depth, shouldStop, retainedMemory.stockRefusals);
          return path ? retainedRoute(path.map(leg => ({ command: leg.action,
            prediction: physicalRootedLine(stockedPiercingGeometry(stock, leg.expected)) })), path.length) : null;
        },
        order_components_by_contact: () => {
          if (!fixedScene || shouldStop() || !Object.keys(currentEffects).length) return null;
          const configuration = retained && equal(projectedRootedLine(retained), physicalRootedLine(scene))
            ? { ...retained, frame_ref: ref } : rootedLineConfiguration(scene, ref, observation.level_epoch);
          const result = searchPiercingPlans({ configuration, effects: Object.values(currentEffects), models: [rootedLineModel(policy)],
            goal_requested_root_ref: 'current_root', goal_requested_type_order: [...fixedScene.order], max_microsteps: policy.max_microsteps,
            max_depth: depth, max_nodes: limits.maxNodes, max_plans: 1 }, { now, deadlineMs, shouldStop });
          const plan = result.plans.find((offer: { effects: unknown[] }) => offer.effects.length > 0);
          return plan ? retainedRoute(plan.effects.map((effect: { action_ref: string }, index: number) => ({
            command: effect.action_ref, prediction: projectedRootedLine(plan.steps[index].configuration),
            configuration: plan.steps[index].configuration,
          })), plan.effects.length) : null;
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
      const { phase, plan: route, decision } = selected;
      const plan = route[0]!;
      const strategy = contactPrimitives[phase];
      const goal = { kind: phase === 'learn_command_displacement' ? 'measure_control_effect' : 'achieve_observed_reference_order',
        scope: ref.split(':revision:', 1)[0]!, subjects: [scene.layout as string],
        parentObjective: objective, satisfactionContract: phase === 'learn_command_displacement'
          ? 'observe_displacement_in_public_return' : 'observe_game_advance_after_alignment' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence: proof };
      const id = `contact:${need.id}`, label = orderedContactStrategies[phase], actions = route.map(step => step.command);
      const [mode, explanation] = situations[phase];
      const situation = receivers && phase === 'compose_axial_guide_release'
        ? 'Use the mobile support to distribute the pieces in the reference order on each receiving guide' : explanation;
      return { status: 'proposed', kind: family, strategy: phase, route, layout: scene.layout, needId: need.id, actions,
        ...(stock ? { stocked: true as const } : {}),
        ...(adoptedEffect ? { adoptedEffect } : {}),
        ...(fixedScene?.receiverLayout ? { receiverLayout: fixedScene.receiverLayout as ReceivingGuideLayout } : {}),
        rooted_line_plan: { scene: { root: scene.root, pieces: scene.pieces.slice(0, 8),
          guides: phase === 'compose_axial_guide_release' ? guides : [] } },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...facts, phase } },
        sicSituationCard: { strategy, need: goal.kind === 'measure_control_effect' ? 'Understand a command' : 'Reproduce the visible reference order',
          mode, situation, agenda: [], triggerCard: decision.receipt.workflow, evidence: proof, distance: plan.distance },
        steps: route.map(step => ({ action: step.command, expected_after: step.prediction })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${objective}`] }],
        question: { reason: label, hypothesis_refs: proof }, route_refs: proof,
        sicLocalDecision: { strategy, objective: { id, label, parent: objective }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: objective, purpose: label,
          evidence: proof, preconditions: {}, preserve_refs: [], actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const scene = index > 0 ? contactGeometry(packet.frame_rows, proposal.receiverLayout, proposal.stocked) : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : proposal.binding?.level_epoch === observation.level_epoch && !!scene && scene.layout === proposal.layout
          && equal(physicalRootedLine(scene), proposal.route[index - 1]!.prediction);
      return { admitted, reason: admitted ? 'current_reference_order_bound' : 'reference_order_scene_changed' };
    },
    after(proposal, index, before, after, _oldRows, newRows) {
      const boundary = changedLevel(before, after);
      const scene = boundary ? null : contactGeometry(newRows, proposal.receiverLayout, proposal.stocked);
      const { prediction } = proposal.route[index]!;
      const matched = scene && prediction ? scene.layout === proposal.layout && equal(physicalRootedLine(scene), prediction) : null;
      const advanced = after.levels_completed > before.levels_completed;
      return { matched, seal_prefix: matched !== true || index + 1 >= proposal.route.length, reason: boundary ? 'official_boundary'
        : matched === null ? 'control_effect_awaits_measurement' : matched ? 'contact_projection_confirmed' : 'contact_projection_contradicted',
        ...(advanced ? { sic_need: { id: proposal.needId, status: 'satisfied' } } : {}) };
    },
    record(before, after, command, oldRows, newRows, proposal, index) {
      memory = structuredClone(current(before.level_epoch));
      if (index === 0 && proposal.adoptedEffect) memory.effects[proposal.adoptedEffect.action_ref] = proposal.adoptedEffect;
      const first = contactGeometry(oldRows, proposal.receiverLayout, proposal.stocked), second = contactGeometry(newRows, proposal.receiverLayout, proposal.stocked);
      if (changedLevel(before, after) || !first) return { events: [] };
      if (proposal.stocked && proposal.strategy === 'compose_stocked_order' && (!second || !equal(physicalRootedLine(second), proposal.route[index]!.prediction))) {
        const stock = measureStockedPiercing(oldRows);
        if (stock) {
          memory.stockRefusals = [...(memory.stockRefusals ?? []).slice(-23), { placement: stockedPlacementKey(stock.placement), action: command.action_ref }];
          memory.counterexample = [before.observation_ref, after.observation_ref];
        }
        return { events: [] };
      }
      if (!second) return { events: [] };
      if (proposal.receiverLayout) memory.receiverLayout = proposal.receiverLayout;
      const refs = [before.observation_ref, after.observation_ref] as const;
      const action = command.action_ref;
      const previousEffect = memory.effects[action];
      const leg = proposal.route[index]!;
      if (proposal.strategy === 'learn_command_displacement') {
        memory.tried.push(action);
        const effect = rootedLineEffect(action, first, second, refs);
        if (effect) memory.effects[action] = effect;
      } else if (equal(physicalRootedLine(second), leg.prediction)) {
        memory.retained = leg.configuration;
      } else if (proposal.strategy === 'compose_axial_guide_release') {
        memory.guideRefused = true;
        memory.retained = null;
      } else if (!memory.counterexample.length && leg.prediction && previousEffect
        && witnessedCellPush(first, second, leg.prediction, previousEffect)) {
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
