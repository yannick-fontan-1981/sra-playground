import { branchBbox, branchLayout, branchReadState, boundedBranchObservedStateCooperative,
  costBoundedBranchPlacementCooperative, BranchRoutingIncomplete, type BranchModel, type BranchPoint, type BranchState } from '../logos-engine/v6-branch-routing-geometry.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';

export const branchAlignmentId = 'sic_branch_alignment';
export const verifyBranchAlignmentId = 'sic_verify_branch_alignment';
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
type Proposal = NativeProposal & { local: State; current: BranchState; expected: BranchState | null; attempt: string; launch: boolean; needId: string };
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const bounds = { maximumIdentityAssignments: 2048, maximumPlacements: 8192, yieldInterval: 128 };
const plain = (action_ref: string): NativeCommand => ({ action_ref, data: {} });

export function createSicVerifyBranchAlignment(): NativeFamily<Proposal> {
  let state: State | null = null;
  let confirmed: ConfirmedControls | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyBranchAlignmentId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, inputs, remaining, execution) {
      const keys = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (remaining < 1 || keys.length !== 5) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const model = prior?.model ?? branchLayout(observation, rows, inputs);
      if (!model || model.bars.length > 5 || prior?.stopped || (prior?.tried.length ?? 0) >= 48) return null;
      const recalled = confirmed?.epoch === observation.level_epoch - 1 && confirmed.axis === model.axis
        && confirmed.unit === model.unit && confirmed.sources < model.sources.length
        && Object.keys(confirmed.controls).every(key => keys.includes(key)) ? confirmed : null;
      const local: State = prior ?? { epoch: observation.level_epoch, model, positions: model.bars.map(bar => bar.position),
        controls: recalled?.controls ?? {}, tried: [], evidence: [], stopped: false, recalledEvidence: recalled?.evidence ?? null };
      let current: BranchState | null, displacements: number[] | undefined;
      try {
        current = await boundedBranchObservedStateCooperative(observation, model, local.positions, bounds, execution);
        if (!current) return null;
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
      return { status: 'proposed', kind: verifyBranchAlignmentId, actions, local, current, expected, attempt, launch: launching, needId: need.id,
        steps: [{ action, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
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
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_contributor_positions_bound' : 'current_contributor_positions_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = proposal.expected ? equal(branchReadState(second, proposal.local.model, proposal.expected[0]), proposal.expected) : null;
      return { matched, seal_prefix: true, reason: 'compare_contributor_return' };
    },
    async record(before, after, issued, _first: NativeRows, second, proposal, _index, _frames, execution) {
      const { local, current } = proposal, controls = { ...local.controls };
      if (after.levels_completed > before.levels_completed && proposal.launch && Object.keys(controls).length === 4) {
        const { axis, unit, sources } = local.model;
        confirmed = { epoch: before.level_epoch, axis, unit, sources: sources.length, controls,
          evidence: [...new Set([...(local.recalledEvidence ?? []), ...Object.values(local.controlEvidence ?? {}), after.observation_ref])].slice(-5) };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      let next: BranchState | null = null;
      try {
        next = branchReadState(second, local.model, proposal.expected?.[0] ?? current[0]) ??
          await boundedBranchObservedStateCooperative(after, local.model, current[0], bounds, execution);
      } catch (error) {
        if (!(error instanceof BranchRoutingIncomplete)) throw error;
      }
      if (local.recalledEvidence && controls[issued.action_ref] && proposal.expected && !equal(next, proposal.expected)) {
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
      state = { ...local, controls, controlEvidence, positions: next?.[0] ?? current[0], stopped: !next || proposal.launch,
        tried: [...local.tried, proposal.attempt], evidence: [...local.evidence.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state, confirmed }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      confirmed = structuredClone((value.confirmed ?? null) as ConfirmedControls | null);
    },
  };
}
