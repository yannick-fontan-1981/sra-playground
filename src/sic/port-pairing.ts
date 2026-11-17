import { maximumCommittedActions } from './plan-step.ts';
import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { assemblePorts, compatiblePorts, inferPortPoses, measurePortLayout, placedPorts, portAccessPath, portAgreement, portCells,
  updatePorts, type PortModel, type PortPose } from '../logos-engine/v6-port-assembly.ts';
import { PointSet, pointKey, type Point, type PointSetState } from '../logos-engine/v6-point-set.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseInteraction, interactionModule } from './observed-interaction-card.ts';
import { motionIntoFootprint } from './observed-translation.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';
import { measureGeometryControl, observeGeometryControl, type GeometryControl } from './port-geometry-control.ts';

export const portPairingId = 'sic_port_pairing';
export const learnPortPairingId = 'sic_connect_pieces_after_observed_motion';
export const portPairingStrategies = {
  learn_piece_motion: 'Measure the movement of the active piece',
  test_piece_geometry: 'Test the separate cell attached to a piece and measure how the piece changes',
  reveal_piece_connectors: 'Select a piece to reveal its connection points',
  orient_piece_for_matching: 'Rotate the piece toward a paired arrangement',
  translate_piece_for_matching: 'Move the piece toward paired connection points',
} as const;
const graph = compileStrategyGraph({ id: 'pair_connectors_with_disjoint_shapes', version: 1, order: 'FALLBACK',
  priorities: ['test_piece_geometry', 'translate_piece_for_matching', 'orient_piece_for_matching', 'reveal_piece_connectors', 'learn_piece_motion'],
  strategies: {
    test_piece_geometry: [{ fact: 'geometryControl', expected: true, label: 'A separate cell is attached to a single piece with visible connectors' }],
    learn_piece_motion: [{ fact: 'calibration', expected: true, label: 'Some directions have no measured effect on the selected piece' }],
    reveal_piece_connectors: [{ fact: 'selection', expected: true, label: 'The needed piece differs from the active piece' }],
    orient_piece_for_matching: [{ fact: 'orientation', expected: true, label: 'The paired arrangement requires the piece to turn' }],
    translate_piece_for_matching: [{ fact: 'translation', expected: true, label: 'A route leads to the paired arrangement using measured displacements' }],
  },
}, ['geometryControl', 'calibration', 'selection', 'orientation', 'translation']);

type Strategy = keyof typeof portPairingStrategies;
export const portPairingCardStrategies = { ...portPairingStrategies, P02: navigationPrimitives.P02, P05: navigationPrimitives.P05 };
type Local = { epoch: number; model: PortModel; poses: readonly PortPose[]; active: number | null; motion: Record<string, Point>;
  rotate: { action: string; turn: number } | null; attempts: string[]; evidence: string[]; blockedOverlap: boolean; stopped: boolean; frame: string;
  control?: GeometryControl | null; reshaped?: boolean };
type Choice = { command: NativeCommand; part: number | null; expected?: readonly PortPose[]; overlapping?: boolean };
type Saved = Omit<Local, 'model'> & { model: StoredModel };
type Proposal = NativeProposal & { local: Saved; choices: Choice[]; strategy: Strategy; needId: string };
type StoredModel = Omit<PortModel, 'bodies'> & { bodies: { material: PointSetState; ports: PointSetState; known: boolean }[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const packModel = (model: PortModel): StoredModel => ({ ...model,
  bodies: model.bodies.map(body => ({ ...body, material: body.material.state(), ports: body.ports.state() })) });
const unpackModel = (model: StoredModel) => ({ ...model,
  bodies: model.bodies.map(body => ({ ...body, material: PointSet.restore(body.material), ports: PointSet.restore(body.ports) })) }) as PortModel;
const command = (action_ref: string): NativeCommand => ({ action_ref, data: {} });
const contextKey = (frame: string, action: string, part: number | null) => JSON.stringify([frame, action, part]);
const centerOf = (model: PortModel, [x, y]: Point): Point => [model.phase[0] + x * model.unit + Math.floor(model.unit / 2),
  model.phase[1] + y * model.unit + Math.floor(model.unit / 2)];

function tileBounds(model: PortModel, cells: PointSet): NativeBox {
  const xs = [...cells].map(([x]) => model.phase[0] + x * model.unit);
  const ys = [...cells].map(([, y]) => model.phase[1] + y * model.unit);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) + model.unit - 1, Math.max(...ys) + model.unit - 1];
}

function selectionChanged(local: Local, part: number, first: NativeRows, second: NativeRows) {
  const a = portCells(first, local.model), b = portCells(second, local.model);
  return [...placedPorts(local.model, part, local.poses[part]!)[0]].some(cell => a.get(pointKey(cell))?.value !== b.get(pointKey(cell))?.value);
}

function acquiredMotion(model: PortModel, ref: string, epoch: number, execution: NativeExecution | undefined) {
  const receipt = execution?.readDirectionalMotion?.();
  if (!receipt || receipt.afterRef !== ref || receipt.levelEpoch !== epoch) return null;
  const candidates = model.poses.flatMap((pose, index) => {
    const [material] = placedPorts(model, index, pose);
    const displacement = motionIntoFootprint(receipt, tileBounds(model, material));
    if (!displacement || Math.abs(displacement[0]) + Math.abs(displacement[1]) !== model.unit
      || !(displacement[0] === 0 || displacement[1] === 0)) return [];
    const move: Point = [displacement[0] / model.unit, displacement[1] / model.unit];
    const previous = [...model.poses];
    previous[index] = [pose[0], pose[1] - move[0], pose[2] - move[1]];
    const prior = execution?.readPriorDirectionalScene?.(rows => portAgreement(rows, model, previous));
    return prior?.scene && prior.beforeRef === receipt.beforeRef ? [{ active: index, move }] : [];
  });
  return candidates.length === 1 ? { ...candidates[0]!, command: receipt.command, beforeRef: receipt.beforeRef } : null;
}

function resumeAfterDirection(local: Local, rows: NativeRows, frame: string, ref: string, execution: NativeExecution | undefined): Local | null {
  const previous = execution?.readPriorDirectionalScene?.(first => portAgreement(first, local.model, local.poses));
  if (!previous?.scene || previous.beforeRef !== local.evidence.at(-1) || previous.afterRef !== ref ||
    previous.levelEpoch !== local.epoch) return null;
  const poses = inferPortPoses(rows, local.model, local.poses);
  const moved = poses?.flatMap((pose, index) => same(pose, local.poses[index]) ? [] : [index]);
  if (!poses || moved?.length !== 1) return null;
  const active = moved[0]!, [beforeTurn, x, y] = local.poses[active]!, [turn, nx, ny] = poses[active]!;
  const move: Point = [nx - x, ny - y];
  if (beforeTurn !== turn || Math.abs(move[0]) + Math.abs(move[1]) !== 1) return null;
  return { ...local, poses, active, motion: { ...local.motion, [previous.command]: move }, frame,
    evidence: [...local.evidence.slice(-3), ref] };
}

export function createSicPortPairing(family = portPairingId): NativeFamily<Proposal> {
  const learns = family === learnPortPairingId;
  let state: Local | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseInteraction, {}, await interactionModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      const plain = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (remaining < 1 || plain.length < 2 || !observation.available_action_refs.includes('ACTION6')) return null;
      const ref = observation.observation_ref;
      const sameLevel = state?.epoch === observation.level_epoch ? state : null;
      const prior = sameLevel?.frame === observation.frame_hash ? sameLevel
        : learns && sameLevel && !sameLevel.stopped ? resumeAfterDirection(sameLevel, rows, observation.frame_hash, ref, execution) : null;
      if (prior?.stopped || prior && !prior.reshaped && prior.attempts.length >= 48) return null;
      const model = prior?.model ?? measurePortLayout(observation, rows);
      if (!model || model.bodies.length > 4 || model.bodies.some(body => body.material.size > 40 || body.ports.size > 8)) return null;
      const control = prior ? prior.control ?? null : measureGeometryControl(rows, model, model.poses);
      const acquired = learns && !prior && !control ? acquiredMotion(model, ref, observation.level_epoch, execution) : null;
      if (learns && !prior && !acquired && !control) return null;
      const previousControls = control && state?.epoch === observation.level_epoch - 1 && state.model.unit === model.unit ? state : null;
      const local: Local = prior ?? { model, epoch: observation.level_epoch, poses: model.poses, active: acquired?.active ?? null,
        motion: acquired ? { [acquired.command]: acquired.move } : previousControls?.motion ?? {}, rotate: previousControls?.rotate ?? null,
        attempts: [], evidence: acquired ? [acquired.beforeRef, ref] : previousControls?.evidence.slice(-3) ?? [],
        blockedOverlap: false, stopped: false, frame: observation.frame_hash, ...(control ? { control } : {}) };
      const { poses, active } = local;
      const unknown = plain.filter(action => !local.motion[action] && action !== local.rotate?.action &&
        !local.attempts.includes(contextKey(observation.frame_hash, action, active)));
      const vectors = new Map(Object.entries(local.motion).filter(([action]) => plain.includes(action)));
      let calibration: Choice | null = null, selection: Choice | null = null, orientation: Choice | null = null, translation: Choice | null = null;
      let reshaping: Choice | null = null;
      let goal: readonly PortPose[] | null = null, part = active;
      const route: Choice[] = [];
      if (control) {
        const [x, y] = centerOf(model, control.cell);
        reshaping = { command: { action_ref: 'ACTION6', data: { x, y } }, part: control.part };
      } else if (active === null || vectors.size < 4 && unknown.length) {
        if (unknown[0]) calibration = { command: command(unknown[0]), part: active };
      } else {
        const hidden = model.bodies.findIndex(body => !body.known);
        if (hidden >= 0) part = hidden;
        else {
          goal = assemblePorts(model, poses, active, local.rotate?.turn ?? null, model.bodies.length > 3 ? 50_000 : Infinity);
          if (!goal) return null;
          const off = poses.flatMap((pose, index) => same(pose, goal![index]) ? [] : [index]);
          if (!off.length) return null;
          part = off.includes(active) ? active : off[0]!;
        }
        const current = poses[part]!;
        if (part !== active) {
          const [material, connectors] = placedPorts(model, part, current);
          const cell = material.difference(connectors).sorted()[0];
          if (!cell) return null;
          const [x, y] = centerOf(model, cell);
          selection = { command: { action_ref: 'ACTION6', data: { x, y } }, part, expected: poses };
        } else if (goal) {
          const target = goal[part]!;
          if (current[0] !== target[0]) {
            const rotate = local.rotate?.action ?? (unknown.length === 1 ? unknown[0] : null);
            if (rotate) orientation = { command: command(rotate), part };
          } else {
            const path = portAccessPath(model, poses, part, target, vectors) ??
              (!local.blockedOverlap ? portAccessPath(model, poses, part, target, vectors, true) : null);
            const other = new Map(poses.flatMap((pose, index) => index === part ? [] : [[index, pose] as const]));
            let [turn, x, y] = current;
            const allowance = local.reshaped ? remaining : Math.min(remaining, 48 - local.attempts.length);
            for (const action of path?.slice(0, Math.min(allowance, maximumCommittedActions)) ?? []) {
              const [dx, dy] = vectors.get(action)!;
              x += dx;
              y += dy;
              const expected = [...poses];
              expected[part] = [turn, x, y];
              const overlapping = !compatiblePorts(model, part, expected[part]!, other);
              const next = { command: command(action), part, expected, overlapping };
              if (overlapping && route.length) break;
              route.push(next);
              if (overlapping) break;
            }
            translation = route[0] ?? null;
          }
        }
      }
      const unused = (choice: Choice | null) => choice && !local.attempts.includes(contextKey(observation.frame_hash, choice.command.action_ref, choice.part));
      const evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        geometryControl: { value: !!unused(reshaping), evidence },
        calibration: { value: !!unused(calibration), evidence }, selection: { value: !!unused(selection), evidence },
        orientation: { value: !!unused(orientation), evidence }, translation: { value: !!unused(translation), evidence },
      }, planners: { test_piece_geometry: () => reshaping, learn_piece_motion: () => calibration, reveal_piece_connectors: () => selection,
        orient_piece_for_matching: () => orientation, translate_piece_for_matching: () => translation } });
      if (!selected) return null;
      const strategy = selected.id, choice = selected.plan, label = portPairingStrategies[strategy], parent = 'G_official_completion';
      const mode = execution?.reasoningMode ?? 'exploration';
      const repeated = strategy === 'translate_piece_for_matching' ||
        (strategy === 'orient_piece_for_matching' && local.rotate?.action === choice.command.action_ref);
      const facts = { repeatSupportedInteraction: repeated, probeNeededInteraction: !repeated, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const primitive = repeated ? 'P02' : 'P05';
      if (learns && decision?.result !== primitive) return null;
      const selectedStrategy = learns ? primitive : strategy;
      const objective = { kind: 'pair_visible_connectors', scope: ref.split(':revision:', 1)[0]!, subjects: ['rigid_pieces', 'matching_connectors'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_pairing_disjoint_pieces' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `port-pairing:${need.id}`, choices = choice === translation ? route : [choice];
      const actions = choices.map(step => step.command);
      const binding = choice === selection || choice === reshaping
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, [choice.command.data.x!, choice.command.data.y!], { reason: label, evidence }) : undefined;
      if ((learns && strategy === 'reveal_piece_connectors' || strategy === 'test_piece_geometry') && !binding) return null;
      return { status: 'proposed', kind: family, actions, local: { ...local, model: packModel(model) }, choices, strategy, needId: need.id,
        steps: choices.map(step => ({ action: step.command, expected_after: null, ...(binding ? { point_binding: binding } : {}) })),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy: selectedStrategy, need: 'Pair the connectors while keeping the solid parts separate',
          mode: learns ? mode : strategy === 'learn_piece_motion' || strategy === 'test_piece_geometry' ? 'exploration' : 'solving',
          situation: choice.overlapping ? 'The direct route is blocked. This step tests a temporary overlap before the final fit.' : label,
          ...(decision ? { triggerCard: decision.receipt.workflow } : {}),
          agenda: entries, evidence, pieces: poses.map((pose, index) => tileBounds(model, placedPorts(model, index, pose)[0])) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: selectedStrategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const expected = proposal.choices[index - 1]?.expected;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!expected && proposal.local.epoch === observation.level_epoch
          && portAgreement(packet.frame_rows, unpackModel(proposal.local.model), expected);
      return { admitted, reason: admitted ? 'connector_arrangement_bound' : 'connector_arrangement_changed' };
    },
    after(proposal, index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, strategy } = proposal, choice = proposal.choices[index]!;
      const measured = { ...local, model: unpackModel(local.model) };
      if (strategy === 'test_piece_geometry' && local.control) {
        const matched = !!observeGeometryControl(after, first, second, measured.model, local.poses, local.control);
        return { matched, seal_prefix: true, reason: matched ? 'piece_geometry_changed_at_local_control' : 'local_control_did_not_verify_piece_geometry' };
      }
      const matched = choice.expected ? portAgreement(second, measured.model, choice.expected) &&
        (strategy !== 'reveal_piece_connectors' || selectionChanged(measured, choice.part!, first, second)) : null;
      return { matched, seal_prefix: !matched || index + 1 >= proposal.choices.length, reason: 'compare_visible_rigid_piece_poses' };
    },
    record(before, after, issued, first, second, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local: saved, strategy } = proposal, choice = proposal.choices[index]!;
      const local = (index > 0 && state?.frame === before.frame_hash ? state : null) ?? { ...saved, model: unpackModel(saved.model) };
      const { model } = local;
      if (strategy === 'test_piece_geometry' && local.control) {
        const changed = observeGeometryControl(after, first, second, model, local.poses, local.control);
        state = { ...local, ...(changed ? { model: changed.model, poses: changed.model.poses, active: changed.part,
          control: changed.next, reshaped: true } : {}), stopped: !changed, frame: after.frame_hash,
          attempts: [...local.attempts, contextKey(before.frame_hash, issued.action_ref, choice.part)],
          evidence: [...local.evidence.slice(-3), after.observation_ref] };
        return { events: [], ...(changed ? { reviewEvidence: 'The clicked cell changed the piece geometry while the other pieces kept their pose.' } : {}) };
      }
      const predicted = strategy === 'translate_piece_for_matching' && choice.expected &&
        portAgreement(second, model, choice.expected) && !portAgreement(second, model, local.poses);
      const next = predicted ? choice.expected! : inferPortPoses(second, model, local.poses, strategy === 'learn_piece_motion' ? null : choice.part);
      let active = local.active, rotate = local.rotate;
      const motion = { ...local.motion };
      if (next && strategy === 'reveal_piece_connectors') active = selectionChanged(local, choice.part!, first, second) ? choice.part : null;
      const moved = next?.flatMap((pose, index) => same(pose, local.poses[index]) ? [] : [index]);
      if (moved?.length === 1) {
        const part = moved[0]!, [oldTurn, x, y] = local.poses[part]!, [turn, nx, ny] = next![part]!;
        active = part;
        if (oldTurn !== turn) rotate = { action: issued.action_ref, turn: (turn - oldTurn + 4) % 4 };
        else if ((nx === x) !== (ny === y)) motion[issued.action_ref] = [nx - x, ny - y];
      }
      if (next && active !== null) updatePorts(second, model, next, active);
      state = { ...local, model, active, motion, rotate, poses: next ?? local.poses,
        blockedOverlap: local.blockedOverlap || !!choice.overlapping && same(next, local.poses), stopped: !next,
        frame: after.frame_hash, attempts: [...local.attempts, contextKey(before.frame_hash, choice.command.action_ref, choice.part)],
        evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state: state && { ...state, model: packModel(state.model) } }),
    restore(value: NativeRecord) {
      const saved = structuredClone(value.state as Saved | null);
      state = saved && { ...saved, model: unpackModel(saved.model) };
    },
  };
}
