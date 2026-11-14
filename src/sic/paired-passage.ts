import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const pairedPassageId = 'sic_paired_passage';

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Direction = typeof directions[number];
type Part = ReturnType<typeof geometricComponents>[number];
type Frame = { box: NativeBox; point: NativePoint; color: number; area: number };
type Pair = { key: string; frames: [Frame, Frame] };
type Scene = { actor: Part; goal: Frame; pairs: Pair[]; floor: Record<string, NativePoint>; pitch: number; flags: Part[] };
type Memory = { epoch: number; evidence: string[]; traversed: string[]; rejected: string[]; goal: Frame };
type Crossing = { pair: Pair; from: Frame; to: Frame };
type Step = { direction: Direction; point: NativePoint; crossing?: Crossing };
type Route = { steps: Step[]; target: Frame; crossing?: Crossing };
type Proposal = NativeProposal & { scene: Scene; memory: Memory; route: Route; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const origin = ([x, y]: NativeBox): NativePoint => [x, y];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => key(a) === key(b);
const square = (p: Part) => width(p.bbox) === height(p.bbox);
const solid = (p: Part) => square(p) && p.area === width(p.bbox) ** 2;
const commonAxis = (a: NativePoint, b: NativePoint) => a[0] === b[0] || a[1] === b[1];

function frameFor(part: Part, interiorSide: number): Frame | null {
  const size = interiorSide + 2;
  if (width(part.bbox) !== size || height(part.bbox) !== size || part.area < size * 3 - 2 || part.area > size * 4 - 4
    || part.mask.some(([x, y]) => x > 0 && x < size - 1 && y > 0 && y < size - 1)) return null;
  const [x, y] = origin(part.bbox);
  return { box: part.bbox, point: [x + 1, y + 1], color: part.color, area: part.area };
}

function measure(rows: NativeRows, priorGoal: Frame | null): Scene | null {
  const parts = geometricComponents(rows);
  const result: Scene[] = [];
  for (const actor of parts.filter(p => solid(p) && width(p.bbox) >= 2 && width(p.bbox) <= 4)) {
    const side = width(actor.bbox), pitch = side + 2, point = origin(actor.bbox);
    const aligned = ([x, y]: NativePoint) => (x - point[0]) % pitch === 0 && (y - point[1]) % pitch === 0;
    const allFrames = parts.flatMap(p => { const frame = frameFor(p, side); return frame ? [frame] : []; });
    const frames = allFrames.filter(p => aligned(p.point));
    const marked = frames.filter(p => rows[p.point[1]]?.[p.point[0]] === actor.color);
    const groups = new Map<string, Frame[]>();
    for (const frame of marked) {
      const signature = frame.color + ':' + frame.area;
      groups.set(signature, [...groups.get(signature) ?? [], frame]);
    }
    const pairs: Pair[] = [];
    for (const group of groups.values()) {
      if (group.length !== 2) continue;
      const [a, b] = group as [Frame, Frame];
      if (commonAxis(a.point, b.point) && Math.abs(a.point[0] - b.point[0]) + Math.abs(a.point[1] - b.point[1]) >= pitch * 2) {
        pairs.push({ key: [key(a.point), key(b.point)].sort().join('/'), frames: [a, b] });
      }
    }
    const entrances = pairs.flatMap(p => p.frames);
    if (!pairs.length || pairs.length > 8 || entrances.length !== marked.length) continue;
    const floors = parts.filter(p => solid(p) && width(p.bbox) === pitch - 1 && aligned(origin(p.bbox)));
    const colors = [...new Set(floors.map(p => p.color))].filter(color => floors.filter(p => p.color === color).length >= 8);
    if (colors.length !== 1) continue;
    const ground = colors[0]!;
    const goals = frames.filter(p => !entrances.includes(p) && (priorGoal
      ? same(p.point, priorGoal.point) : rows[p.point[1]]?.[p.point[0]] === ground));
    if (goals.length !== 1) continue;
    const goal = goals[0]!;
    const flags = allFrames.filter(p => !aligned(p.point)).map(frame => parts.find(p => p.bbox === frame.box)!);
    const tiles = [point, goal.point, ...floors.filter(p => p.color === ground).map(p => origin(p.bbox))];
    result.push({ actor, goal, pairs, floor: Object.fromEntries(tiles.map(p => [key(p), p])), pitch, flags });
    if (result.length > 1) return null;
  }
  return result[0] ?? null;
}

function shift(point: NativePoint, [, dx, dy]: Direction, pitch: number): NativePoint {
  return [point[0] + dx * pitch, point[1] + dy * pitch];
}

function plan(scene: Scene, memory: Memory, inputs: readonly string[]): Route | null {
  const start = origin(scene.actor.bbox);
  const unfinished = scene.pairs.filter(pair => !memory.traversed.includes(pair.key));
  const crossings = scene.pairs.flatMap(pair => pair.frames.map((from, i) => ({ pair, from, to: pair.frames[1 - i]! })));
  const queue: { point: NativePoint; steps: Step[] }[] = [{ point: start, steps: [] }];
  const seen = new Set([key(start)]);
  for (const item of queue) {
    for (const direction of directions) {
      if (!inputs.includes(direction[0]) || memory.rejected.includes(key(item.point) + '/' + direction[0])) continue;
      const point = shift(item.point, direction, scene.pitch);
      const crossing = crossings.find(pair => same(pair.from.point, point));
      if (crossing) {
        const landing = shift(crossing.to.point, direction, scene.pitch);
        if (!scene.floor[key(landing)]) continue;
        const steps = [...item.steps, { direction, point: landing, crossing }];
        if (unfinished.includes(crossing.pair)) return { steps, target: crossing.from, crossing };
        if (seen.has(key(landing))) continue;
        seen.add(key(landing));
        queue.push({ point: landing, steps });
        continue;
      }
      if (same(scene.goal.point, point)) {
        if (!unfinished.length) return { steps: [...item.steps, { direction, point }], target: scene.goal };
        continue;
      }
      if (!scene.floor[key(point)] || seen.has(key(point))) continue;
      seen.add(key(point));
      queue.push({ point, steps: [...item.steps, { direction, point }] });
    }
  }
  return null;
}

function actorAt(rows: NativeRows, actor: Part, point: NativePoint): boolean {
  const side = width(actor.bbox);
  return geometricComponents(rows).some(p => p.color === actor.color && p.area === side ** 2 && same(origin(p.bbox), point)
    && width(p.bbox) === side && height(p.bbox) === side);
}

export function createSicPairedPassage(): NativeFamily<Proposal> {
  let local: Memory | null = null;
  return {
    id: pairedPassageId,
    propose(observation, rows, _inputs, remaining, execution): Proposal | null {
      if (remaining < 1 || !directions.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = local?.epoch === observation.level_epoch ? local : null;
      const scene = measure(rows, prior?.goal ?? null);
      if (!scene) return null;
      const memory = prior ?? { epoch: observation.level_epoch, evidence: [], traversed: [], rejected: [], goal: scene.goal };
      const route = plan(scene, memory, observation.available_action_refs);
      if (!route) return null;
      const step = route.steps[0]!, action = { action_ref: step.direction[0], data: {} };
      const crossing = step.crossing;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...memory.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: action.action_ref, expected: step.point, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({
        mode, evidence, probe: !memory.evidence.length || crossing && !memory.traversed.length ? offer : null,
        access: memory.evidence.length && !crossing ? offer : null,
        interaction: crossing && memory.traversed.length ? offer : null,
      });
      if (!selected) return null;
      const parent = 'G_official_completion';
      const objective = { kind: route.crossing ? 'verify_access_through_paired_passage' : 'reach_exit_after_verified_transfers',
        scope: ref.split(':revision:', 1)[0]!, subjects: [route.crossing?.pair.key ?? key(scene.goal.point)],
        parentObjective: parent, satisfactionContract: route.crossing ? 'piece_at_paired_exit' : 'official_progress_at_framed_exit' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pairedPassageId + ':' + need.id;
      const situation = crossing ? 'Verify that entering the opening transfers the piece to its paired landing'
        : route.crossing ? 'Approach a visible pair whose transfer is still unverified'
          : 'Reach the exit after observing a transfer through each pair';
      const [x, y] = step.point, last = width(scene.actor.bbox) - 1;
      return {
        status: 'proposed', kind: pairedPassageId, scene, route, memory, needId: need.id, attempt: key(origin(scene.actor.bbox)) + '/' + action.action_ref,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: step.point }],
        sicSituationCard: { strategy: selected.id, need: route.crossing ? 'Verify a paired passage' : 'Exit after using the passages',
          situation, evidence, agenda: entries, mode, triggerCard: card, actor: scene.actor.bbox, focus: crossing?.from.box ?? route.target.box,
          landing: [x, y, x + last, y + last], exit: crossing?.to.box ?? null, flags: scene.flags.map(p => p.bbox) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'paired_passage_step_bound' : 'paired_passage_context_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const step = proposal.route.steps[0]!, crossing = step.crossing;
      const moved = actorAt(second, proposal.scene.actor, step.point);
      const markersChanged = crossing && proposal.scene.flags.some(({ bbox: [x, y] }) => first[y]?.[x] !== second[y]?.[x]);
      const reason = moved ? markersChanged ? 'paired_landing_and_remote_markers_observed' : 'expected_position_observed' : 'expected_position_missing';
      return { matched: moved, seal_prefix: true, reason, ...(crossing && moved && crossing.pair.key === proposal.route.crossing?.pair.key
        ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { memory, route } = proposal, step = route.steps[0]!;
      const moved = actorAt(second, proposal.scene.actor, step.point);
      const crossing = moved ? step.crossing : undefined;
      local = { ...memory, evidence: moved ? [...memory.evidence.slice(-5), after.observation_ref] : memory.evidence,
        traversed: crossing && !memory.traversed.includes(crossing.pair.key) ? [...memory.traversed, crossing.pair.key] : memory.traversed,
        rejected: moved ? memory.rejected : [...memory.rejected, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ local }),
    restore(value: NativeRecord) { local = structuredClone(value.local as Memory | null); },
  };
}
