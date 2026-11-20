import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const pairedReorientationId = 'sic_align_opposing_faces';
export const learnPairedReorientationId = 'sic_learn_observed_reorientation';

type Body = { point: NativePoint; box: NativeBox; direction: NativePoint; selected: boolean };
type Scene = { bodies: Body[]; goal: NativePoint };
type Rotation = { epoch: number; command: string; clockwise: boolean; refs: string[] };
type Step = { action: NativeCommand; expected: Scene | null };
type Proposal = NativeProposal & { route: Step[]; needId: string };

const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const reverse = ([x, y]: NativePoint): NativePoint => [-x, -y];
const rotate = ([x, y]: NativePoint, clockwise: boolean): NativePoint => clockwise ? [-y, x] : [y, -x];
const midpoint = ([left, top, right, bottom]: NativeBox): NativePoint => [(left + right) / 2, (top + bottom) / 2];
const inScope = (observation: NativeObservation) => {
  const has = (input: string) => observation.available_action_refs.includes(input);
  return has('ACTION3') && has('ACTION4') && has('ACTION5') && has('ACTION6') && !has('ACTION1') && !has('ACTION2');
};

function measure(rows: NativeRows): Scene | null {
  const parts = geometricComponents(rows);
  const stripes = parts.filter(part => part.rectangular && part.area >= 3 && part.area <= 9 && part.area % 2 === 1
    && (part.bbox[0] === part.bbox[2] || part.bbox[1] === part.bbox[3]));
  const bodiesByAppearance = new Map<string, Body[]>();
  for (const low of stripes) for (const high of stripes) {
    if (low.color >= high.color || low.area !== high.area) continue;
    const [x, y] = low.bbox, [u, v] = high.bbox;
    const horizontal = low.bbox[0] === low.bbox[2];
    const delta = low.area - 1;
    const direction: NativePoint = horizontal ? [Math.sign(u - x), 0] : [0, Math.sign(v - y)];
    if (horizontal ? high.bbox[0] !== high.bbox[2] || v !== y || Math.abs(u - x) !== delta
      : high.bbox[1] !== high.bbox[3] || u !== x || Math.abs(v - y) !== delta) continue;
    const left = Math.min(x, u), top = Math.min(y, v), box: NativeBox = [left, top, left + delta, top + delta];
    const point = midpoint(box), [cx, cy] = point;
    const samples = [rows[cy - 1]?.[cx], rows[cy + 1]?.[cx], rows[cy]?.[cx - 1], rows[cy]?.[cx + 1]];
    const colors = samples.filter(value => value !== low.color && value !== high.color);
    const core = colors[0];
    if (core === undefined || colors.length < 2 || colors.some(value => value !== core)) continue;
    const at = `${low.color}:${high.color}:${low.area}:${core}`;
    const group = bodiesByAppearance.get(at) ?? [];
    group.push({ point, box, direction, selected: rows[cy]?.[cx] !== core });
    bodiesByAppearance.set(at, group);
  }
  const candidates: Scene[] = [];
  for (const bodies of bodiesByAppearance.values()) {
    if (bodies.length !== 2 || bodies.filter(body => body.selected).length > 1) continue;
    const [a, b] = bodies as [Body, Body], [x, y] = a.point, [u, v] = b.point;
    if ((x === u) === (y === v)) continue;
    const width = a.box[2] - a.box[0] + 1;
    const targets = parts.filter(part => part.area === 4 * (width - 1) && part.bbox[2] - part.bbox[0] + 1 === width
      && part.bbox[3] - part.bbox[1] + 1 === width).map(part => midpoint(part.bbox)).filter(([c, r]) =>
      x === u ? c === x && Math.min(y, v) < r && r < Math.max(y, v)
        : r === y && Math.min(x, u) < c && c < Math.max(x, u));
    if (targets.length === 1) candidates.push({ bodies, goal: targets[0]! });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function matches(actual: Scene | null, expected: Scene): boolean {
  return !!actual && same(actual.goal, expected.goal) && expected.bodies.every(body =>
    actual.bodies.some(other => same(body.point, other.point) && same(body.direction, other.direction) && body.selected === other.selected));
}

export function createSicPairedReorientation(family = pairedReorientationId): NativeFamily<Proposal> {
  const learns = family === learnPairedReorientationId;
  let measured: Rotation | null = null, rejected: number | null = null;
  return {
    id: family,
    observePublicOutcome(before, after, command, oldRows, _rows, frames = []) {
      if (!learns || !inScope(before) || before.level_epoch !== after.level_epoch
        || (command.action_ref !== 'ACTION3' && command.action_ref !== 'ACTION4')) return;
      const old = measure(oldRows), selected = old?.bodies.find(body => body.selected);
      if (!old || !selected) return;
      for (const rows of frames) {
        const returned = measure(rows);
        const rotating = returned?.bodies.find(body => same(body.point, selected.point) && body.selected);
        if (!rotating || same(rotating.direction, selected.direction)) continue;
        const clockwise = same(rotating.direction, rotate(selected.direction, true));
        if (!clockwise && !same(rotating.direction, rotate(selected.direction, false))) continue;
        const expected: Scene = { ...old, bodies: old.bodies.map(body => body === selected ? rotating : body) };
        if (matches(returned, expected)) {
          measured = { epoch: before.level_epoch, command: command.action_ref, clockwise, refs: [before.observation_ref, after.observation_ref] };
          break;
        }
      }
    },
    async propose(observation, rows, inputs, remaining) {
      if (remaining < 2 || rejected === observation.level_epoch || !inScope(observation)
        || (learns && measured?.epoch !== observation.level_epoch)) return null;
      const scene = measure(rows);
      if (!scene) return null;
      const [a, b] = scene.bodies as [Body, Body];
      const along = (body: Body) => a.point[0] === b.point[0] ? body.direction[0] === 0 : body.direction[1] === 0;
      let route: Step[];
      const available = (input: string) => inputs.find(command => command.action_ref === input);
      if (learns && measured) {
        const body = scene.bodies.find(body => body.selected), action = available(measured.command);
        if (!body || !action || !scene.bodies.every(along) || !same(a.direction, reverse(b.direction))) return null;
        const expected = { ...scene, bodies: scene.bodies.map(other =>
          other === body ? { ...body, direction: rotate(body.direction, measured!.clockwise) } : other) };
        route = [{ action, expected }, { action, expected: null }];
      } else {
        if (scene.bodies.some(body => body.selected)) return null;
        const targets = scene.bodies.filter(along);
        if (targets.length !== 1) return null;
        const peer = targets[0]!, body = peer === a ? b : a;
        const clockwise = same(rotate(body.direction, true), peer.direction);
        if (!clockwise && !same(rotate(body.direction, false), peer.direction)) return null;
        const action = available(clockwise ? 'ACTION4' : 'ACTION3');
        if (!action) return null;
        const [x, y] = body.point;
        const selected = { ...scene, bodies: scene.bodies.map(other => other === body ? { ...body, selected: true } : other) };
        route = [{ action: { action_ref: 'ACTION6', data: { x, y } }, expected: selected }, { action, expected: null }];
      }
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence = [ref, ...(learns ? measured!.refs : [])];
      const label = 'Align the two observed faces along the line through the target';
      const objective = { kind: 'bring_two_oriented_bodies_toward_common_target', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['paired_oriented_bodies', 'target_between_bodies'], parentObjective: parent,
        satisfactionContract: 'verify_the_intermediate_orientation_before_releasing_the_final_turn' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id, actions = route.map(step => step.action);
      const steps = [];
      for (const { action, expected } of route) {
        const witness = action.action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
          [action.data.x!, action.data.y!], { reason: label, evidence }) : null;
        steps.push({ action, expected_after: expected, ...(witness ? { point_binding: witness } : {}) });
      }
      return { status: 'proposed', kind: family, actions, steps, route, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy: 'P07', mode: 'solving', need: 'Reach the framed target through an aligned pair',
          situation: label, evidence, agenda: [], bodies: scene.bodies.map(body => body.box), target: scene.goal },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: 'P07', objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const expected = proposal.route[index - 1]?.expected;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!expected && proposal.binding?.level_epoch === observation.level_epoch && matches(measure(packet.frame_rows), expected);
      return { admitted, reason: admitted ? 'paired_orientation_current' : 'paired_orientation_changed' };
    },
    after(proposal, index, before, after, _first, rows) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const expected = proposal.route[index]!.expected;
      const matched = !!expected && matches(measure(rows), expected);
      return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
        reason: matched ? 'intermediate_orientation_confirmed' : 'pair_prediction_requires_replanning' };
    },
    record(before, after, _command, _old, rows, proposal, index) {
      const expected = proposal.route[index]!.expected;
      if (before.level_epoch === after.level_epoch && (!expected || !matches(measure(rows), expected))) rejected = before.level_epoch;
      return { events: [] };
    },
    state: () => ({ measured, rejected }),
    restore(value: NativeRecord) {
      measured = structuredClone((value.measured as Rotation | undefined) ?? null);
      rejected = (value.rejected as number | undefined) ?? null;
    },
  };
}
