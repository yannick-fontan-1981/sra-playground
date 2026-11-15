import { FrameGrid, measureConcentricFrames, type ConcentricFrame } from '../logos-engine/v5-concentric-frames.ts';
import { measureDiagramCandidate, measureDiagramRows, measureDiagramTransition } from '../logos-engine/v5-symbolic-diagrams.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { advanceSymbolTransaction, consolidateSymbolWorkspace, nextSymbolStep, rebindSymbolWorkspace, rememberSymbolExample,
  verifySymbolStep, type SymbolExamples, type SymbolStep, type SymbolTransaction, type SymbolWorkspaceEvidence } from './observed-symbol-transactions.ts';
import { chooseVisibleInstruction, visibleInstructionModule, visibleInstructionRules, type VisibleInstruction } from './visible-instruction-card.ts';

export const symbolContributionId = 'sic_follow_and_verify_visible_instruction';
export const symbolContributionStrategies = {
  P02: navigationPrimitives.P02,
  P05: navigationPrimitives.P05,
  select_indicated_symbol: 'Test selection of the indicated symbol',
  load_indicated_operand: 'Test placing the selected symbol in the indicated operand',
  apply_indicated_transformation: 'Test the indicated operation on the loaded operands',
  deliver_matching_symbol: 'Test delivering the selected symbol to the matching request',
} as const;
type State = { epoch: number; count: number; evidence: string[]; appearance: number | null; stopped: boolean; confirmed?: VisibleInstruction[];
  examples?: SymbolExamples; learned?: SymbolWorkspaceEvidence; transaction?: SymbolTransaction };
type Transfer = { step: SymbolStep; transaction: SymbolTransaction; learned: SymbolWorkspaceEvidence };
type Proposal = NativeProposal & { strategy: VisibleInstruction; guide: NativeBox; appearance: number; needId: string; transfer?: Transfer };
const empty = (epoch = 0): State => ({ epoch, count: 0, evidence: [], appearance: null, stopped: false });
const freshLevel = (epoch: number, learned?: SymbolWorkspaceEvidence): State => ({ ...empty(epoch), ...(learned ? { learned } : {}) });
const frameBox = ({ left, top, right, bottom }: ConcentricFrame): NativeBox => [left, top, right, bottom];
const area = ({ left, top, right, bottom }: ConcentricFrame) => (right - left + 1) * (bottom - top + 1);
const atCenter = (frame: ConcentricFrame, x: number, y: number) => frame.center[0] === y && frame.center[1] === x;
const transferredInstructions: Record<SymbolStep['kind'], VisibleInstruction> = {
  select: 'select_indicated_symbol', load: 'load_indicated_operand', deliver: 'deliver_matching_symbol', transform: 'apply_indicated_transformation',
};
const transferLabels: Record<SymbolStep['kind'], string> = {
  select: 'Select a stocked symbol needed for the planned delivery',
  load: 'Place a reserved input in the verified operand slot',
  deliver: 'Fill the open request with the matching symbol',
  transform: 'Test the displayed recipe that supplies a missing symbol',
};

function guideAt(frame: FrameGrid, observation: NativeObservation, appearance: number | null) {
  const diagrams = measureDiagramRows(frame);
  if (diagrams.length < 2 || !diagrams.some(row => row.left_values.length === 2)) return null;
  const frames = measureConcentricFrames(frame);
  const eligible = frames.filter(candidate => candidate.maximum_equal_padding > 1
    && (appearance === null || appearance === candidate.outer_value) && observation.entities.some(entity =>
    entity.id === candidate.outer_ref || (entity.palette_value === candidate.outer_value
      && entity.area === 2 * (candidate.right - candidate.left + candidate.bottom - candidate.top)
      && frameBox(candidate).every((value, i) => value === entity.bbox[i]))));
  if (!eligible.length) return null;
  const minimum = Math.min(...eligible.map(area));
  const small = eligible.filter(candidate => area(candidate) === minimum);
  const linked = small.filter(candidate => frames.some(other => other.outer_value === candidate.outer_value
    && other.maximum_equal_padding === 1));
  const choices = linked.length ? linked : small;
  return choices.length === 1 ? choices[0]! : null;
}

function isInstruction(value: unknown): value is VisibleInstruction {
  return typeof value === 'string' && Object.hasOwn(visibleInstructionRules, value);
}

export function createSicSymbolContribution(): NativeFamily<Proposal> {
  let state = empty();
  let chooseInstruction: NativeProgramHandle | undefined;
  let choosePrimitive: NativeProgramHandle | undefined;
  return {
    id: symbolContributionId,
    async attachPrograms(registry) {
      chooseInstruction = await registry.registerProgram(chooseVisibleInstruction, {}, await visibleInstructionModule());
      choosePrimitive = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const local = state.epoch === observation.level_epoch ? state : freshLevel(observation.level_epoch, state.learned);
      if (local.stopped || local.count >= 32) return null;
      const frame = new FrameGrid(rows), guide = local.transaction ? null : guideAt(frame, observation, local.appearance);
      const learned = local.learned;
      const transaction = guide || !learned ? null : local.transaction ?? rebindSymbolWorkspace(frame, learned);
      const step = transaction ? nextSymbolStep(frame, transaction) : null;
      const transfer = transaction && learned && step ? { transaction, learned, step } : null;
      if (!guide && !transfer) return null;
      const [x, y] = guide ? [guide.center[1], guide.center[0]] : transfer!.step.point;
      const focus = guide ? frameBox(guide) : transfer!.step.target;
      const appearance = guide?.outer_value ?? transfer!.learned.selectionOutline;
      const facts = guide ? measureDiagramCandidate(frame, { point: guide.center }, guide.outer_value) : null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(transfer?.learned.proof ?? [])].filter(item => item !== ref))];
      const command = { action_ref: 'ACTION6', data: { x, y } };
      const transferred = transfer ? transferredInstructions[transfer.step.kind] : null;
      const situation = facts ? {
        selectable: facts.diagram_point_full_symbol_count === 1 && facts.diagram_tight_white_center_count === 0,
        operand: facts.diagram_point_equal_pair_center_count === 1 && facts.diagram_tight_white_center_count === 1,
        operation: facts.diagram_point_branch_value_square_count === 1 && facts.diagram_equal_pair_matches_left_group_count === 1,
        request: facts.diagram_point_hollow_matches_tight_value_count === 1,
      } : {
        selectable: transferred === 'select_indicated_symbol',
        operand: transferred === 'load_indicated_operand',
        operation: transferred === 'apply_indicated_transformation',
        request: transferred === 'deliver_matching_symbol',
      };
      const mode = execution?.reasoningMode ?? 'exploration';
      const instruction = await chooseInstruction?.run({ situation }, { signal: execution?.signal });
      const strategy = instruction?.result;
      if (!isInstruction(strategy) || !situation[visibleInstructionRules[strategy]]) return null;
      const repeated = transfer ? transfer.step.kind !== 'transform' : local.confirmed?.includes(strategy) ?? false;
      const primitiveSituation = { repeatSupportedInteraction: repeated, probeNeededInteraction: !repeated, mode };
      const primitive = repeated ? 'P02' : 'P05';
      const decision = await choosePrimitive?.run({ situation: primitiveSituation }, { signal: execution?.signal });
      if (!instruction || decision?.result !== primitive) return null;
      const label = transfer ? transferLabels[transfer.step.kind] : symbolContributionStrategies[strategy];
      const parent = 'G_official_completion';
      const goal = { kind: 'satisfy_visible_symbol_requests', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['visible_symbol_diagram_and_request'], parentObjective: parent, satisfactionContract: 'observe_official_progress_after_symbol_delivery' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = `symbol-contribution:${need.id}`, actions = [command];
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
      if (!binding) return null;
      return { status: 'proposed', kind: symbolContributionId, strategy, guide: focus, appearance,
        ...(transfer ? { transfer } : {}),
        actions, needId: need.id, steps: [{ action: command, expected_after: null, point_binding: binding }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: { ...primitiveSituation, instruction: strategy, instructionWorkflow: instruction.receipt.workflow,
            instructionHash: instruction.receipt.src_hash, instructionEdited: 'edited' in instruction.receipt && instruction.receipt.edited === true } },
        sicSituationCard: { strategy: primitive, need: 'Use the visible diagram to fill the symbol requests',
          mode, situation: label, agenda: [], evidence, guide: focus, triggerCard: instruction.receipt.workflow,
          ...(transfer ? { contributionTarget: transfer.step.intent } : {}) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: primitive, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'symbol_contribution_bound' : 'symbol_contribution_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const confirmation = confirmedEffect(proposal, first, second);
      return { matched: confirmation !== null, seal_prefix: true, reason: confirmation ?? 'symbol_contribution_contradicted' };
    },
    record(before, after, _command, first, second, proposal) {
      const won = after.levels_completed > before.levels_completed;
      if (!won && (before.level_epoch !== after.level_epoch || before.state !== after.state)) return { events: [] };
      const local = state.epoch === before.level_epoch ? state : freshLevel(before.level_epoch, state.learned);
      const confirmation = won ? 'official_boundary' : confirmedEffect(proposal, first, second);
      const matched = confirmation !== null;
      if (proposal.transfer) {
        if (won) state = freshLevel(after.level_epoch, local.learned);
        else state = { ...local, count: local.count + 1, stopped: !matched, evidence: [...local.evidence.slice(-4), after.observation_ref],
          ...(matched ? { transaction: advanceSymbolTransaction(proposal.transfer.transaction, proposal.transfer.step) } : {}) };
        return { events: [] };
      }
      const { x, y } = proposal.actions[0]!.data;
      const examples = matched ? rememberSymbolExample(local.examples ?? {}, proposal.strategy, [x!, y!], first, after.observation_ref) : local.examples;
      if (won) {
        const learned = consolidateSymbolWorkspace(examples ?? {}, proposal.appearance);
        state = freshLevel(after.level_epoch, learned ?? local.learned);
        return { events: [] };
      }
      const confirmed = matched ? [...new Set([...(local.confirmed ?? []), proposal.strategy])] : local.confirmed;
      state = { ...local, count: local.count + 1, stopped: !matched, ...(confirmed ? { confirmed } : {}),
        appearance: proposal.appearance, evidence: [...local.evidence.slice(-4), after.observation_ref], ...(examples ? { examples } : {}) };
      return { events: [] };
    },
    state: () => ({ ...state }),
    restore(value: NativeRecord) { state = structuredClone(value as State); },
  };
}

function confirmedEffect(proposal: Proposal, first: NativeRows, second: NativeRows): string | null {
  const { transfer } = proposal;
  if (transfer) return verifySymbolStep(transfer.step, transfer.transaction.workspace, first, second, transfer.learned.selectionOutline);
  return observed(proposal, first, second) ? 'symbol_contribution_observed' : null;
}

function observed({ strategy, actions, appearance, guide }: Proposal, first: NativeRows, second: NativeRows): boolean {
  const after = new FrameGrid(second);
  const { x, y } = actions[0]!.data;
  const frames = measureConcentricFrames(after);
  const tight = frames.filter(frame => frame.outer_value === appearance && frame.maximum_equal_padding === 1);
  if (strategy === 'select_indicated_symbol') return tight.length === 1 && atCenter(tight[0]!, x!, y!);
  if (strategy === 'apply_indicated_transformation') return measureDiagramTransition(new FrameGrid(first), after) > 0;
  const value = second[y!]![x!]!;
  return tight.length === 0 && value !== first[y!]![x!] && !frames.some(frame =>
    frame.outer_value === appearance && frameBox(frame).every((coordinate, i) => coordinate === guide[i]));
}
