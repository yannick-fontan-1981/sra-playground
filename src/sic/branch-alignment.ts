import { branchBbox, branchLayout, branchReadState, boundedBranchObservedStateCooperative,
  costBoundedBranchPlacementCooperative, BranchRoutingIncomplete, type BranchModel, type BranchPoint, type BranchState } from '../logos-engine/v6-branch-routing-geometry.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { measureStackedBranchLayout, placeStackedBranches, stackedBranchBox, stackedBranchSelection,
  verifyStackedBranchLayout, type StackedBranchLayout } from './stacked-branch-layout.ts';
import { arrangeDirectedBranches, directedBranchBox, directedBranchSelection, directedBranchWalk, measureDirectedBranchLayout,
  placeDirectedBranches, verifyDirectedBranches, type DirectedBranchLayout } from './directed-branch-layout.ts';

export const branchAlignmentId = 'sic_branch_alignment';
export const verifyBranchAlignmentId = 'sic_verify_branch_alignment';
export const learnBranchAlignmentId = 'sic_learn_branch_alignment';
export const branchAlignmentStrategies = {
  learn_contributor_control: 'Measure how commands move the selected contributor',
  select_unaligned_contributor: 'Select a contributor that needs to move',
  align_contributor_to_openings: 'Move the contributor to align its branches with the openings',
  test_aligned_propagation: 'Test propagation after the contributors are aligned',
} as const;

type State = { epoch: number; model: BranchModel; positions: BranchPoint[]; controls: Record<string, BranchPoint>;
  tried: string[]; evidence: string[]; stopped: boolean; recalledEvidence?: string[] | null;
  controlEvidence?: Record<string, string> };
type ConfirmedControls = { epoch: number; axis: BranchModel['axis']; unit: number; sources: number;
  controls: State['controls']; evidence: string[] };
type LinearProposal = NativeProposal & { local: State; current: BranchState; expected: BranchState | null; approach: BranchState[];
  attempt: string; launch: boolean; needId: string };
type StackedState = { epoch: number; layout: StackedBranchLayout; positions: NativePoint[]; placements: NativePoint[];
  focused: number; controls: Record<string, NativePoint>; evidence: string[]; stopped: boolean };
type StackedProposal = NativeProposal & { stackedPlan: StackedState; needId: string; launch: boolean };
type DirectedState = { epoch: number; layout: DirectedBranchLayout; positions: number[]; placements: number[];
  focused: number; controls: Record<string, NativePoint>; evidence: string[]; stopped: boolean };
type DirectedMove = { positions: number[]; focused: number };
type DirectedProposal = NativeProposal & { directedPlan: DirectedState; moves: DirectedMove[]; needId: string; launch: boolean };
type Proposal = LinearProposal | StackedProposal | DirectedProposal;
const isStacked = (proposal: Proposal): proposal is StackedProposal => Object.hasOwn(proposal, 'stackedPlan');
const isDirected = (proposal: Proposal): proposal is DirectedProposal => Object.hasOwn(proposal, 'directedPlan');
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const bounds = { maximumIdentityAssignments: 2048, maximumPlacements: 8192, yieldInterval: 128 };
const plain = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
function movedContributor(before: BranchState, after: BranchState): BranchPoint | null {
  const [positions, active] = before;
  const moved = positions.flatMap((point, index) => equal(point, after[0][index]) ? [] : [index]);
  if (active !== after[1] || moved.length !== 1 || moved[0] !== active) return null;
  const [x, y] = positions[active]!, [nx, ny] = after[0][active]!;
  return (x === nx) !== (y === ny) ? [nx - x, ny - y] : null;
}

export function createSicVerifyBranchAlignment(family = verifyBranchAlignmentId): NativeFamily<Proposal> {
  const learns = family === learnBranchAlignmentId;
  let state: State | null = null;
  let confirmed: ConfirmedControls | null = null;
  let stacked: StackedState | null = null;
  let directed: DirectedState | null = null;
  let decide: NativeProgramHandle | undefined;
  async function proposeDirected(observation: NativeObservation, rows: NativeRows, keys: readonly string[], remaining: number,
    execution?: NativeExecution): Promise<DirectedProposal | null> {
    const ref = observation.observation_ref, epoch = observation.level_epoch;
    let local = directed?.epoch === epoch ? directed : null;
    if (!local) {
      const previous = stacked?.epoch === epoch - 1 ? stacked : null;
      if (!previous || previous.stopped || !Object.keys(previous.controls).every(key => keys.includes(key))) return null;
      const layout = measureDirectedBranchLayout(rows, previous.layout);
      if (!layout) return null;
      const placements = placeDirectedBranches(layout, () => !!execution?.signal?.aborted
        || (execution?.deadlineMs !== undefined && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs));
      if (!placements) return null;
      local = { epoch, layout, placements, positions: layout.pieces.map(piece => piece.at), focused: layout.focused,
        controls: previous.controls, evidence: previous.evidence, stopped: false };
    }
    const { layout, positions, placements, controls, focused } = local;
    if (local.stopped || !verifyDirectedBranches(rows, layout, positions, focused)) return null;
    const order = arrangeDirectedBranches(layout, positions, focused, placements);
    if (!order) return null;
    const current = order[0], launching = current === undefined, moving = current === focused;
    const mode = execution?.reasoningMode ?? 'solving', strategy = moving ? 'P07' : 'P05';
    const facts = { routeSupported: moving, eligibleProbe: !moving, knownInteraction: false, mode };
    const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
    if (decision?.result !== strategy) return null;
    const actions: NativeCommand[] = [], moves: DirectedMove[] = [];
    const region = current === undefined ? null : directedBranchBox(layout, positions[current]!, layout.pieces[current]!.offsets);
    const subject = current === undefined ? null : layout.pieces[current]!;
    const reason = launching ? 'Check the predicted straight and lateral arrivals by releasing the shared flow'
      : moving ? subject?.turn ? 'Move the corner to align its open side with the sideways receiver'
        : 'Position a straight contributor so its full outline guides the remaining branches'
        : 'Select the next contributor in the projected layout';
    const evidence: [string, ...string[]] = [ref, ...new Set(local.evidence.filter(value => value !== ref))];
    let pointBinding = null;
    if (launching) {
      const input = keys.find(key => !Object.hasOwn(controls, key));
      if (!input) return null;
      actions.push(plain(input));
      moves.push({ positions, focused });
    } else if (!moving) {
      const point = directedBranchSelection(layout, positions[current]!, current);
      pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason, evidence });
      if (!pointBinding || !observation.available_action_refs.includes('ACTION6')) return null;
      actions.push({ action_ref: 'ACTION6', data: { x: point[0], y: point[1] } });
      moves.push({ positions, focused: current });
    } else {
      const walk = directedBranchWalk(layout, positions, current, placements[current]!);
      let at = positions[current]!;
      for (const step of walk?.slice(0, Math.min(remaining, maximumCommittedActions)) ?? []) {
        const key = keys.find(key => equal(controls[key], step));
        if (!key) break;
        actions.push(plain(key));
        at += step[0] + step[1] * layout.width;
        moves.push({ positions: positions.map((cell, i) => i === current ? at : cell), focused });
      }
    }
    if (!actions.length) return null;
    const parent = 'G_official_completion', goal = { kind: 'deliver_flow_into_oriented_openings', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['sources', 'directional_receiver_openings', 'branching_and_turning_contributors'], parentObjective: parent,
      satisfactionContract: 'official_progress_after_directional_receivers_fill' };
    const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence }, id = 'branch-alignment:' + need.id;
    return { status: 'proposed', kind: family, actions, moves, directedPlan: local, needId: need.id, launch: launching,
      steps: actions.map((action, i) => ({ action, expected_after: launching ? null : moves[i],
        ...(pointBinding ? { point_binding: pointBinding } : {}) })),
      binding: { observation_ref: ref, level_epoch: epoch },
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
        instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Bring every branch into its receiving opening in the right direction',
        mode, situation: reason, evidence, agenda: [], triggerCard: decision.receipt.workflow, contributor: region,
        goals: layout.targets.map(target => directedBranchBox(layout, target.opening)),
        turningContributor: layout.pieces.flatMap((piece, i) => piece.turn ? [directedBranchBox(layout, positions[i]!, piece.offsets)] : [])[0] },
      question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: reason, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label: reason, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  async function proposeStacked(observation: NativeObservation, rows: NativeRows, keys: readonly string[], execution?: NativeExecution): Promise<StackedProposal | null> {
    const ref = observation.observation_ref, epoch = observation.level_epoch;
    let local = stacked?.epoch === epoch ? stacked : null;
    if (!local) {
      if (confirmed?.epoch !== epoch - 1 || confirmed.axis !== 1) return null;
      const layout = measureStackedBranchLayout(rows);
      if (!layout) return null;
      const controls = Object.fromEntries(Object.entries(confirmed.controls).flatMap(([key, vector]) => {
        const step: NativePoint = [vector[0] / confirmed!.unit, vector[1] / confirmed!.unit];
        return keys.includes(key) && Math.abs(step[0]) + Math.abs(step[1]) === 1 && step.every(Number.isInteger) ? [[key, step]] : [];
      }));
      if (new Set(Object.values(controls).map(step => step.join(','))).size !== 4) return null;
      const placements = placeStackedBranches(layout, () => !!execution?.signal?.aborted
        || (execution?.deadlineMs !== undefined && (execution.now ?? (() => performance.now()))() >= execution.deadlineMs));
      if (!placements) return null;
      local = { epoch, layout, placements, focused: layout.focused, positions: layout.bars.map(bar => bar.at),
        controls, evidence: [...confirmed.evidence], stopped: false };
    }
    const { layout, positions, placements, focused, controls } = local;
    if (local.stopped || !verifyStackedBranchLayout(rows, layout, positions, focused)) return null;
    const notAligned = positions.flatMap((position, index) => equal(position, placements[index]) ? [] : [index]);
    const moving = notAligned.includes(focused), launching = notAligned.length === 0;
    const selection = moving || launching ? null : notAligned.flatMap(index => {
      const point = stackedBranchSelection(layout, positions, index);
      return point ? [{ index, point }] : [];
    })[0] ?? null;
    const next = [...positions], destination = placements[focused]!, position = positions[focused]!;
    const delta: NativePoint = position[0] !== destination[0]
      ? [Math.sign(destination[0] - position[0]), 0] : [0, Math.sign(destination[1] - position[1])];
    const input = moving ? keys.find(key => equal(controls[key], delta)) : launching ? keys.find(key => !controls[key]) : null;
    if (!input && !selection) return null;
    if (moving) next[focused] = [position[0] + delta[0], position[1] + delta[1]];
    const action: NativeCommand = selection ? { action_ref: 'ACTION6', data: { x: selection.point[0], y: selection.point[1] } } : plain(input!);
    const evidence: [string, ...string[]] = [ref, ...new Set(local.evidence.filter(value => value !== ref))];
    const mode = execution?.reasoningMode ?? 'solving', strategy = moving ? 'P07' : 'P05';
    const facts = { routeSupported: moving, eligibleProbe: !moving, knownInteraction: false, mode };
    const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
    if (decision?.result !== strategy) return null;
    const situation = launching ? 'Check that the assembled branches and the carried source fill the receiving openings'
      : moving ? 'Place this bar to form a shared branch or keep the flow clear' : 'Select the next bar to position';
    const parent = 'G_official_completion';
    const objective = { kind: 'place_stacked_contributors_for_shared_flow', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['stacked_contributors', 'carried_source', 'receiving_openings'], parentObjective: parent,
      satisfactionContract: 'official_progress_after_all_receivers_fill' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = 'branch-alignment:' + need.id;
    const plannedFocus = selection?.index ?? focused, actions = [action];
    const binding = selection && await ObservedInputDomain.makeLocusWitness(observation, rows, selection.point, { reason: situation, evidence });
    if (selection && !binding) return null;
    return { status: 'proposed', kind: verifyBranchAlignmentId, actions, needId: need.id,
      stackedPlan: { ...local, positions: next, focused: plannedFocus }, launch: launching,
      steps: [{ action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
      binding: { observation_ref: ref, level_epoch: epoch },
      sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
        instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
      sicSituationCard: { strategy, need: 'Deliver branches from the fixed source and the source on the movable bar', mode, situation, evidence,
        agenda: [], triggerCard: decision.receipt.workflow, contributor: stackedBranchBox(layout, positions[plannedFocus]!, layout.bars[plannedFocus]!.length),
        goals: layout.targets.map(x => stackedBranchBox(layout, [x, layout.terminal], 1)) },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy, objective: { id, label: situation, parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const keys = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (remaining < 1 || keys.length !== 5) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if (directed?.epoch === observation.level_epoch) return proposeDirected(observation, rows, keys, remaining, execution);
      if (stacked?.epoch === observation.level_epoch) return proposeStacked(observation, rows, keys, execution);
      const model = prior?.model ?? branchLayout(observation, rows, inputs);
      if (!model) return learns ? null : await proposeStacked(observation, rows, keys, execution)
        ?? proposeDirected(observation, rows, keys, remaining, execution);
      if (model.bars.length > 5 || prior?.stopped || (prior?.tried.length ?? 0) >= 48) return null;
      const recalled = confirmed?.epoch === observation.level_epoch - 1 && confirmed.axis === model.axis
        && confirmed.unit === model.unit && confirmed.sources < model.sources.length
        && Object.keys(confirmed.controls).every(key => keys.includes(key)) ? confirmed : null;
      let local: State = prior ?? { epoch: observation.level_epoch, model, positions: model.bars.map(bar => bar.position),
        controls: recalled?.controls ?? {}, tried: [], evidence: [], stopped: false, recalledEvidence: recalled?.evidence ?? null };
      let current: BranchState | null, displacements: number[] | undefined;
      try {
        current = await boundedBranchObservedStateCooperative(observation, model, local.positions, bounds, execution);
        if (!current) return null;
        if (learns && !prior) {
          const [positions, active] = current;
          const motion = execution?.readPriorDirectionalScene?.(first => {
            const before = [[-1, 0], [1, 0], [0, -1], [0, 1]].flatMap(([dx, dy]) => {
              const location = positions.map(([x, y], index): BranchPoint =>
                index === active ? [x + dx! * model.unit, y + dy! * model.unit] : [x, y]);
              const [left, top, right, bottom] = branchBbox(location[active]!, model.bars[active]!.length, model);
              if (left < 0 || top < 0 || bottom >= first.length || right >= (first[0]?.length ?? 0)) return [];
              const measured = branchReadState(first, model, location);
              return measured?.[1] === active ? [measured] : [];
            });
            return before.length === 1 ? before[0]! : null;
          });
          const delta = motion && movedContributor(motion.scene, current);
          if (!motion || motion.afterRef !== observation.observation_ref || motion.levelEpoch !== observation.level_epoch
            || !keys.includes(motion.command) || !delta || Math.abs(delta[0]) + Math.abs(delta[1]) !== model.unit) return null;
          local = { ...local, positions: current[0], controls: { [motion.command]: delta },
            controlEvidence: { [motion.command]: motion.afterRef }, evidence: [motion.beforeRef, motion.afterRef] };
        }
        if (new Set(Object.values(local.controls).map(vector => JSON.stringify(vector))).size === 4) {
          displacements = (await costBoundedBranchPlacementCooperative(model, current[0], current[1], bounds, execution))?.displacement;
          if (!displacements) return null;
        }
      } catch (error) {
        if (error instanceof BranchRoutingIncomplete) return null;
        throw error;
      }
      const [positions, active] = current, contextKey = (action: NativeCommand) => JSON.stringify([current, action]);
      const unused = keys.filter(action => !local.controls[action] && !local.tried.includes(contextKey(plain(action))));
      const displaced = displacements?.flatMap((value, index) => value === 0 ? [] : [index]);
      const index = displaced?.includes(active) ? active : displaced?.[0] ?? active;
      const box = branchBbox(positions[index]!, model.bars[index]!.length, model);
      const [l, t, r, b] = box, point: NativePoint = [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
      const select = displaced?.length && index !== active && observation.available_action_refs.includes('ACTION6')
        ? { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } } : null;
      const magnitude = displacements?.[index];
      const delta: BranchPoint = model.tangent === 0 ? [Math.sign(magnitude ?? 0) * model.unit, 0] : [0, Math.sign(magnitude ?? 0) * model.unit];
      const movement = magnitude && index === active ? keys.find(action => equal(local.controls[action], delta)) : undefined;
      const launch = displaced?.length === 0 ? unused[0] : undefined;
      const learn = !displaced ? unused[0] : undefined;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.evidence, ...(local.recalledEvidence ?? [])].filter(value => value !== ref))];
      const trial = launch ? plain(launch) : select ?? (learn ? plain(learn) : null);
      const mode = execution?.reasoningMode ?? (learn ? 'exploration' : 'solving');
      const facts = { routeSupported: !!movement, eligibleProbe: !!trial, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = decision?.result;
      if (!decision || (strategy !== 'P07' && strategy !== 'P05')) return null;
      const action = strategy === 'P07' ? (movement ? plain(movement) : null) : trial;
      if (!action) return null;
      const selecting = action === select;
      const launching = strategy === 'P05' && !!launch;
      const phase = strategy === 'P07' ? 'align_contributor_to_openings' : launching ? 'test_aligned_propagation'
        : selecting ? 'select_unaligned_contributor' : 'learn_contributor_control';
      const attempt = contextKey(action);
      if (local.tried.includes(attempt)) return null;
      const label = branchAlignmentStrategies[phase], parent = 'G_official_completion';
      const objective = { kind: 'align_branches_with_openings', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['straight_contributors', 'receiving_openings'], parentObjective: parent, satisfactionContract: 'official_progress_after_propagation' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence }, id = `branch-alignment:${need.id}`;
      const expected: BranchState | null = selecting ? [positions, index] : strategy === 'P07' ? [positions.map(([x, y], i): BranchPoint =>
        i === index ? [x + delta[0], y + delta[1]] : [x, y]), active] : null;
      const actions = [action], binding = selecting && await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: label, evidence });
      const approach: BranchState[] = expected && strategy === 'P07' ? [expected] : [];
      if (approach.length && magnitude) {
        const length = Math.min(remaining, maximumCommittedActions, Math.floor(Math.abs(magnitude) / model.unit));
        for (let count = 2; count <= length; count++) {
          if (local.tried.includes(JSON.stringify([approach.at(-1), action]))) break;
          approach.push([positions.map(([x, y], member): BranchPoint =>
            member === index ? [x + delta[0] * count, y + delta[1] * count] : [x, y]), active]);
          actions.push(action);
        }
      }
      return { status: 'proposed', kind: family, actions, local, current, expected, approach, attempt, launch: launching, needId: need.id,
        steps: actions.map((action, step) => ({ action, expected_after: approach[step] ?? null, ...(binding ? { point_binding: binding } : {}) })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Deliver every branch to a receiving opening', mode,
          situation: launching ? (model.sources.length > 1
            ? 'The visible sources feed a shared network. The launch checks that their combined branches reach the measured openings.'
            : 'The measured positions satisfy the proposed geometry. The launch tests whether propagation follows it.') : label,
          agenda: [], evidence, triggerCard: decision.receipt.workflow, contributor: box, goals: model.goal_boxes.slice(0, 6) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      if (isDirected(proposal)) {
        const next = proposal.moves[index - 1];
        const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
          : !!next && proposal.directedPlan.epoch === observation.level_epoch
            && verifyDirectedBranches(packet.frame_rows, proposal.directedPlan.layout, next.positions, next.focused);
        return { admitted, reason: admitted ? 'oriented_branch_setup_confirmed' : 'oriented_branch_setup_changed' };
      }
      const previous = index > 0 && !isStacked(proposal) ? proposal.approach[index - 1] : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!previous && proposal.binding?.level_epoch === observation.level_epoch && !isStacked(proposal)
          && equal(branchReadState(packet.frame_rows, proposal.local.model, previous[0]), previous);
      return { admitted, reason: admitted ? 'current_contributor_positions_bound' : 'current_contributor_positions_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isDirected(proposal)) {
        const move = proposal.moves[index];
        const matched = !proposal.launch && before.level_epoch === after.level_epoch && !!move
          && verifyDirectedBranches(second, proposal.directedPlan.layout, move.positions, move.focused);
        return { matched, seal_prefix: !matched, reason: 'compare_oriented_branch_setup_return' };
      }
      if (isStacked(proposal)) {
        const { layout, positions, focused, controls } = proposal.stackedPlan;
        if (proposal.launch && after.levels_completed > before.levels_completed) {
          confirmed = { epoch: before.level_epoch, axis: 1, unit: layout.unit, sources: 2,
            controls: Object.fromEntries(Object.entries(controls).map(([key, [dx, dy]]) => [key, [dx * layout.unit, dy * layout.unit]])),
            evidence: [...proposal.stackedPlan.evidence.slice(-4), after.observation_ref] };
        }
        const matched = !proposal.launch && verifyStackedBranchLayout(second, layout, positions, focused);
        return { matched, seal_prefix: true, reason: matched ? 'observed_stacked_contributor_positions' : 'stacked_projection_contradicted' };
      }
      const expected = proposal.approach[index] ?? proposal.expected;
      const matched = expected ? equal(branchReadState(second, proposal.local.model, expected[0]), expected) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: 'compare_contributor_return' };
    },
    async record(before, after, issued, _first: NativeRows, second, proposal, index, _frames, execution) {
      if (isDirected(proposal)) {
        if (after.levels_completed > before.levels_completed) return { events: [],
          reviewEvidence: 'The directed branch projection was followed by official progress.' };
        const local = index > 0 && directed?.epoch === before.level_epoch ? directed : proposal.directedPlan;
        const move = proposal.moves[index]!;
        const matched = !proposal.launch && before.level_epoch === after.level_epoch
          && verifyDirectedBranches(second, local.layout, move.positions, move.focused);
        directed = { ...local, ...(matched ? move : {}), stopped: !matched,
          evidence: [...new Set([...local.evidence.slice(-5), after.observation_ref])] };
        return { events: [] };
      }
      if (isStacked(proposal)) {
        const { layout, positions, focused } = proposal.stackedPlan;
        if (before.level_epoch === after.level_epoch) stacked = { ...proposal.stackedPlan,
          evidence: [...proposal.stackedPlan.evidence.slice(-5), after.observation_ref],
          stopped: proposal.launch || !verifyStackedBranchLayout(second, layout, positions, focused) };
        return { events: [] };
      }
      const local = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.local;
      const current = proposal.approach[index - 1] ?? proposal.current;
      const expected = proposal.approach[index] ?? proposal.expected;
      const controls = { ...local.controls };
      if (after.levels_completed > before.levels_completed && proposal.launch && Object.keys(controls).length === 4) {
        const { axis, unit, sources } = local.model;
        confirmed = { epoch: before.level_epoch, axis, unit, sources: sources.length, controls,
          evidence: [...new Set([...(local.recalledEvidence ?? []), ...Object.values(local.controlEvidence ?? {}), after.observation_ref])].slice(-5) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      let next: BranchState | null = null;
      try {
        next = branchReadState(second, local.model, expected?.[0] ?? current[0]) ??
          await boundedBranchObservedStateCooperative(after, local.model, current[0], bounds, execution);
      } catch (error) {
        if (!(error instanceof BranchRoutingIncomplete)) throw error;
      }
      if (local.recalledEvidence && controls[issued.action_ref] && expected && !equal(next, expected)) {
        state = { ...local, controls: {}, positions: next?.[0] ?? current[0], recalledEvidence: null, controlEvidence: {},
          tried: [], evidence: [after.observation_ref], stopped: !next };
        return { events: [] };
      }
      const controlEvidence = { ...local.controlEvidence };
      if (next && issued.action_ref !== 'ACTION6') {
        const [positions, active] = current;
        const moved = positions.flatMap((point, index) => equal(point, next![0][index]) ? [] : [index]);
        if (moved.length === 1 && moved[0] === active) {
          const [x, y] = positions[active]!, [nx, ny] = next[0][active]!;
          if ((x === nx) !== (y === ny)) {
            controls[issued.action_ref] = [nx - x, ny - y];
            controlEvidence[issued.action_ref] ??= after.observation_ref;
          }
        }
      }
      const attempt = index === 0 ? proposal.attempt : JSON.stringify([current, issued]);
      state = { ...local, controls, controlEvidence, positions: next?.[0] ?? current[0], stopped: !next || proposal.launch,
        tried: [...local.tried, attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, confirmed, stacked, ...(directed ? { directed } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      stacked = structuredClone(value.stacked as StackedState | null ?? null);
      directed = structuredClone(value.directed as DirectedState | undefined) ?? null;
      confirmed = structuredClone((value.confirmed ?? null) as ConfirmedControls | null);
    },
  };
}
