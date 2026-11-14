import { ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { assemblePorts, compatiblePorts, inferPortPoses, measurePortLayout, placedPorts, portAccessPath, portAgreement, portCells,
  updatePorts, type PortModel, type PortPose } from '../logos-engine/v6-port-assembly.ts';
import { PointSet, pointKey, type Point, type PointSetState } from '../logos-engine/v6-point-set.ts';
import { sicNeedId } from './need-identity.ts';
import { compileStrategyGraph, resolveStrategyGraph } from './strategy-agenda.ts';

export const portPairingId = 'sic_port_pairing';
export const portPairingStrategies = {
  learn_piece_motion: 'Measure the movement of the active piece',
  reveal_piece_connectors: 'Select a piece to reveal its connection points',
  orient_piece_for_matching: 'Rotate the piece toward a paired arrangement',
  translate_piece_for_matching: 'Move the piece toward paired connection points',
} as const;
const graph = compileStrategyGraph({ id: 'pair_connectors_with_disjoint_shapes', version: 1, order: 'FALLBACK',
  priorities: ['translate_piece_for_matching', 'orient_piece_for_matching', 'reveal_piece_connectors', 'learn_piece_motion'],
  strategies: {
    learn_piece_motion: [{ fact: 'calibration', expected: true, label: 'Some directions have no measured effect on the selected piece' }],
    reveal_piece_connectors: [{ fact: 'selection', expected: true, label: 'The needed piece differs from the active piece' }],
    orient_piece_for_matching: [{ fact: 'orientation', expected: true, label: 'The paired arrangement requires the piece to turn' }],
    translate_piece_for_matching: [{ fact: 'translation', expected: true, label: 'A route leads to the paired arrangement using measured displacements' }],
  },
}, ['calibration', 'selection', 'orientation', 'translation']);

type Strategy = keyof typeof portPairingStrategies;
type Local = { epoch: number; model: PortModel; poses: readonly PortPose[]; active: number | null; motion: Record<string, Point>;
  rotate: { action: string; turn: number } | null; attempts: string[]; evidence: string[]; blockedOverlap: boolean; stopped: boolean; frame: string };
type Choice = { command: NativeCommand; part: number | null; expected?: readonly PortPose[]; overlapping?: boolean };
type Saved = Omit<Local, 'model'> & { model: StoredModel };
type Proposal = NativeProposal & { local: Saved; choice: Choice; strategy: Strategy; key: string; needId: string };
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

export function createSicPortPairing(): NativeFamily<Proposal> {
  let state: Local | null = null;
  return {
    id: portPairingId,
    async propose(observation, rows, _inputs, remaining) {
      const plain = observation.available_action_refs.filter(action => /^ACTION[1-5]$/.test(action)).sort();
      if (remaining < 1 || plain.length < 2 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch && state.frame === observation.frame_hash ? state : null;
      if (prior?.stopped || (prior?.attempts.length ?? 0) >= 48) return null;
      const model = prior?.model ?? measurePortLayout(observation, rows);
      if (!model || model.bodies.length > 3 || model.bodies.some(body => body.material.size > 40 || body.ports.size > 8)) return null;
      const local = prior ?? { model, epoch: observation.level_epoch, poses: model.poses, active: null, motion: {}, rotate: null,
        attempts: [], evidence: [], blockedOverlap: false, stopped: false, frame: observation.frame_hash };
      const { poses, active } = local;
      const unknown = plain.filter(action => !local.motion[action] && action !== local.rotate?.action &&
        !local.attempts.includes(contextKey(observation.frame_hash, action, active)));
      const vectors = new Map(Object.entries(local.motion).filter(([action]) => plain.includes(action)));
      let calibration: Choice | null = null, selection: Choice | null = null, orientation: Choice | null = null, translation: Choice | null = null;
      let goal: readonly PortPose[] | null = null, part = active;
      if (active === null || vectors.size < 4 && unknown.length) {
        if (unknown[0]) calibration = { command: command(unknown[0]), part: active };
      } else {
        const hidden = model.bodies.findIndex(body => !body.known);
        if (hidden >= 0) part = hidden;
        else {
          goal = assemblePorts(model, poses, active, local.rotate?.turn ?? null);
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
            const action = path?.[0];
            if (action) {
              const [dx, dy] = vectors.get(action)!;
              const expected = [...poses];
              expected[part] = [current[0], current[1] + dx, current[2] + dy];
              const other = new Map(poses.flatMap((pose, index) => index === part ? [] : [[index, pose] as const]));
              translation = { command: command(action), part, expected, overlapping: !compatiblePorts(model, part, expected[part]!, other) };
            }
          }
        }
      }
      const unused = (choice: Choice | null) => choice && !local.attempts.includes(contextKey(observation.frame_hash, choice.command.action_ref, choice.part));
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.evidence.filter(value => value !== ref)];
      const { selected, entries } = resolveStrategyGraph({ graph, mode: 'active', facts: {
        calibration: { value: !!unused(calibration), evidence }, selection: { value: !!unused(selection), evidence },
        orientation: { value: !!unused(orientation), evidence }, translation: { value: !!unused(translation), evidence },
      }, planners: { learn_piece_motion: () => calibration, reveal_piece_connectors: () => selection,
        orient_piece_for_matching: () => orientation, translate_piece_for_matching: () => translation } });
      if (!selected) return null;
      const strategy = selected.id, choice = selected.plan, label = portPairingStrategies[strategy], parent = 'G_official_completion';
      const objective = { kind: 'pair_visible_connectors', scope: ref.split(':revision:', 1)[0]!, subjects: ['rigid_pieces', 'matching_connectors'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_pairing_disjoint_pieces' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `port-pairing:${need.id}`, actions = [choice.command];
      const binding = selection && choice === selection
        ? await ObservedInputDomain.makeLocusWitness(observation, rows, [choice.command.data.x!, choice.command.data.y!], { reason: label, evidence }) : undefined;
      return { status: 'proposed', kind: portPairingId, actions, local: { ...local, model: packModel(model) }, choice, strategy, needId: need.id,
        key: contextKey(observation.frame_hash, choice.command.action_ref, choice.part),
        steps: [{ action: choice.command, expected_after: null, ...(binding ? { point_binding: binding } : {}) }],
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Pair the connectors while keeping the solid parts separate',
          mode: strategy === 'learn_piece_motion' ? 'exploration' : 'solving',
          situation: choice.overlapping ? 'The direct route is blocked. This step tests a temporary overlap before the final fit.' : label,
          agenda: entries, evidence, pieces: poses.map((pose, index) => tileBounds(model, placedPorts(model, index, pose)[0])) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'connector_arrangement_bound' : 'connector_arrangement_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true,
        reason: 'official_boundary', sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { choice, local, strategy } = proposal;
      const measured = { ...local, model: unpackModel(local.model) };
      const matched = choice.expected ? portAgreement(second, measured.model, choice.expected) &&
        (strategy !== 'reveal_piece_connectors' || selectionChanged(measured, choice.part!, first, second)) : null;
      return { matched, seal_prefix: true, reason: 'compare_visible_rigid_piece_poses' };
    },
    record(before, after, issued, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local: saved, choice, strategy } = proposal, model = unpackModel(saved.model);
      const local = { ...saved, model };
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
        frame: after.frame_hash, attempts: [...local.attempts, proposal.key], evidence: [...local.evidence.slice(-3), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ state: state && { ...state, model: packModel(state.model) } }),
    restore(value: NativeRecord) {
      const saved = structuredClone(value.state as Saved | null);
      state = saved && { ...saved, model: unpackModel(saved.model) };
    },
  };
}
