import { linkedNodes, linkedOpenEnclosures, linkedPhaseSlots } from '../logos-engine/v6-linked-temporal-contact.ts';
import { temporalPatch } from '../logos-engine/v6-linked-temporal-common.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const replayAccessId = 'sic_replay_access';
export { navigationPrimitives as replayAccessStrategies } from './navigation-primitives.ts';

type Body = { signature: string; start: NativePoint; size: NativePoint; floor: number; quantum: number; palette: number; mask: readonly NativePoint[] };
type Node = { position: NativePoint; peer_support: NativePoint[] };
type Scene = { body: Body; goal: NativePoint; nodes: Node[]; slots: NativeBox[] };
type Changed = { pixel: NativePoint; before: number; after: number };
type State = { epoch: number; scene: Scene; controls: Record<string, NativePoint>; tried: string[]; samples: NativePoint[];
  node: Node | null; entered: Changed[]; restored: boolean; reversible: boolean; replay: string | null; ticks: number;
  evidence: string[]; count: number; stopped: boolean };
type Proposal = NativeProposal & { local: State; from: NativePoint; to: NativePoint | null; intention: 'move' | 'probe' | 'replay'; needId: string };
const controls = ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'];
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const minus = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const positionKey = (p: NativePoint) => p.join(',');
const box = ([x, y]: NativePoint, [w, h]: NativePoint): NativeBox => [x, y, x + w - 1, y + h - 1];
const ordinal = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const contains = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const valueAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function sceneAtStart(observation: NativeObservation, rows: NativeRows): Scene | null {
  const scenes: Scene[] = [];
  for (const entity of observation.entities) {
    const [x, y, r, b] = entity.bbox, w = r - x + 1, h = b - y + 1;
    if (Math.min(w, h) < 2 || Math.max(w, h) > 12 || entity.area < w * h * 0.75) continue;
    const floor = rows[y]?.[x - 1];
    if (floor === undefined || floor === entity.palette_value) continue;
    for (let quantum = Math.max(w, h) + 1; quantum <= 16; quantum++) {
      const body: Body = { signature: entity.signature, start: [x, y], size: [w, h], floor, quantum, palette: entity.palette_value, mask: entity.mask };
      const goals = linkedOpenEnclosures(observation, body, quantum);
      if (goals.length !== 1) continue;
      const nodes = linkedNodes(observation, body, quantum) as Node[];
      if (!nodes.length) continue;
      const slots = linkedPhaseSlots(observation, body, true) as NativeBox[] | null;
      if (slots && slots.length === 2) scenes.push({ body, goal: goals[0]!, nodes, slots });
    }
  }
  return scenes.length === 1 ? scenes[0]! : null;
}

function actorPosition(observation: NativeObservation, scene: Scene): NativePoint | null {
  const actors = observation.entities.filter(entity => entity.signature === scene.body.signature);
  return actors.length === 1 ? [actors[0]!.bbox[0], actors[0]!.bbox[1]] : null;
}

type Step = { to: NativePoint; delta: NativePoint };
function candidatePaths(rows: NativeRows, scene: Scene, from: NativePoint, special: readonly NativePoint[], transit: readonly NativePoint[] = []) {
  const { body } = scene, q = body.quantum, [w, h] = body.size;
  const grid: NativePoint[] = [[0, -q], [-q, 0], [q, 0], [0, q]];
  const pending = [from], paths = new Map<string, Step[]>([[positionKey(from), []]]);
  for (const origin of pending) for (const delta of grid) {
    const to = add(origin, delta), [x, y] = to, key = positionKey(to);
    if (x < 0 || y < 0 || x + w > rows[0]!.length || y + h > rows.length || paths.has(key)) continue;
    const clear = temporalPatch(rows, to, body.size).every(row => row.every(pixel => pixel === body.floor));
    const passable = transit.some(site => equal(site, to));
    if (!clear && !passable && !special.some(site => equal(site, to))) continue;
    paths.set(key, [...paths.get(positionKey(origin))!, { to, delta }]);
    if (clear || passable) pending.push(to);
  }
  return paths;
}

function peerBounds(points: readonly NativePoint[]): NativeBox | null {
  if (!points.length) return null;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function createSicReplayAccess(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: replayAccessId,
    propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !controls.every(control => observation.available_action_refs.includes(control)) || observation.available_action_refs.includes('ACTION6')) return null;
      const previous = state?.epoch === observation.level_epoch ? state : null;
      if (previous?.stopped || (previous?.count ?? 0) >= 72) return null;
      const scene = previous?.scene ?? sceneAtStart(observation, rows);
      if (!scene) return null;
      const from = actorPosition(observation, scene);
      if (!from) return null;
      const local: State = previous ?? { epoch: observation.level_epoch, scene, controls: {}, tried: [], samples: [from],
        node: null, entered: [], restored: false, reversible: false, replay: null, ticks: 0, evidence: [], count: 0, stopped: false };
      const nodePositions = scene.nodes.map(node => node.position);
      const special = [...nodePositions, scene.goal];
      const completed = local.replay && local.ticks >= local.samples.length - 1;
      const hold = completed && local.node && local.entered.every(change => valueAt(rows, change.pixel) === change.after) ? [local.node.position] : [];
      const paths = candidatePaths(rows, scene, from, special, hold);
      const node = local.node ?? [...scene.nodes].filter(node => paths.has(positionKey(node.position))).sort((a, b) =>
        paths.get(positionKey(a.position))!.length - paths.get(positionKey(b.position))!.length || ordinal(a.position, b.position))[0] ?? null;
      if (!node) return null;
      const contact = node.position;
      const evidence: [string, ...string[]] = [observation.observation_ref, ...local.evidence.filter(ref => ref !== observation.observation_ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      let proposed: Step | null = null, replayAction: string | null = null, destination: NativePoint = contact;
      let situation = 'Test a nearby object with a visible link to a distant obstruction';
      if (local.replay) {
        destination = scene.goal;
        situation = 'Use the candidate replay to reach the open-rim destination';
        const approach: { prefix: Step[]; entry: Step }[] = [];
        const vectors = Object.values(local.controls);
        for (const [key, prefix] of paths) for (const delta of vectors) {
          const [x, y] = key.split(',').map(Number), origin = [x!, y!] as const, to = add(origin, delta);
          if (local.entered.some(change => contains(box(to, scene.body.size), change.pixel))) approach.push({ prefix, entry: { to, delta } });
        }
        approach.sort((a, b) => a.prefix.length - b.prefix.length);
        const current = approach[0];
        if (completed) proposed = paths.get(positionKey(scene.goal))?.[0] ?? current?.prefix[0] ?? current?.entry ?? null;
        else if (current?.prefix.length) proposed = current.prefix[0]!;
        else {
          const offsets = vectors.flatMap(delta => {
            const to = add(from, delta), key = positionKey(to), rect = box(to, scene.body.size);
            return vectors.some(other => equal(other, minus(from, to))) && paths.get(key)?.length === 1
              && !local.entered.some(change => contains(rect, change.pixel)) ? [{ to, delta }] : [];
          }).sort((a, b) => ordinal(a.to, b.to));
          proposed = offsets[0] ?? null;
          situation = 'Make a reversible move and check whether the other piece continues replaying';
        }
      } else if (!local.entered.length) proposed = paths.get(positionKey(contact))?.[0] ?? null;
      else if (!local.restored) {
        const departures = [...paths.values()].filter(route => route.length === 1 && !equal(route[0]!.to, contact)
          && temporalPatch(rows, route[0]!.to, scene.body.size).every(row => row.every(pixel => pixel === scene.body.floor)));
        proposed = departures[0]?.[0] ?? null;
        destination = proposed?.to ?? contact;
        situation = 'Leave the object to see whether the distant obstruction returns';
      } else if (!local.reversible) {
        proposed = paths.get(positionKey(contact))?.[0] ?? null;
        situation = 'Return to the object to verify that its distant effect repeats';
      } else {
        const unknown = controls.filter(input => !local.controls[input] && !local.tried.includes(positionKey(from) + ':' + input));
        if (unknown.length === 1) replayAction = unknown[0]!;
        situation = 'Test the remaining control while the distant passage is open';
      }
      const known = proposed && Object.entries(local.controls).find(([, delta]) => equal(delta, proposed!.delta))?.[0];
      const probe = !known && !replayAction ? controls.find(input => !local.controls[input] && !local.tried.includes(positionKey(from) + ':' + input)) : null;
      const offer = (input: string, expected: NativePoint | null) => ({ input, expected, evidence });
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        access: known && proposed ? offer(known, proposed.to) : null,
        probe: replayAction ? offer(replayAction, null) : probe ? offer(probe, null) : null, interaction: null });
      if (!selected) return null;
      const { id: strategy, plan } = selected, intention = replayAction ? 'replay' : strategy === 'P07' ? 'move' : 'probe';
      const parent = 'G_official_completion', ref = observation.observation_ref;
      const objective = { kind: 'use_repeated_remote_effect_to_gain_access', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['carrier', 'linked_occurrence', 'replay', 'open_receiver'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_verified_replay_access' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'replay-access:' + need.id, action = { action_ref: plan.input, data: {} }, actions = [action];
      return { status: 'proposed', kind: replayAccessId, actions, local: { ...local, node }, from, to: plan.expected, intention, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: plan.expected }],
        sicSituationCard: { strategy, need: 'Keep the distant passage open long enough to reach the receiver',
          situation, evidence, agenda: entries, mode, triggerCard: card,
          actor: box(from, scene.body.size), target: box(destination, scene.body.size), remote: peerBounds(node.peer_support), slots: scene.slots },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: situation, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_replay_and_carrier_bound' : 'replay_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { scene, node } = proposal.local, position = actorPosition(after, scene);
      const openFloor = proposal.to && temporalPatch(second, proposal.from, scene.body.size).every(row => row.every(pixel => pixel === scene.body.floor));
      const matched = proposal.to && (!node || !equal(proposal.to, node.position)) && openFloor ? !!position && equal(position, proposal.to) : null;
      return { matched, seal_prefix: true, reason: 'compare_replayed_motion_and_remote_return' };
    },
    record(before, after, command, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, from, intention } = proposal, scene = local.scene;
      const position = actorPosition(after, scene);
      const next: State = { ...local, count: local.count + 1, stopped: !position, tried: [...local.tried, positionKey(from) + ':' + command.action_ref],
        evidence: [...local.evidence.slice(-5), after.observation_ref] };
      if (!position) { state = next; return { events: [] }; }
      if (intention === 'replay') {
        next.replay = command.action_ref;
        next.stopped = !equal(position, scene.body.start) || equal(position, from);
      } else {
        const delta = minus(position, from), moved = delta.some(Boolean);
        if (Math.abs(delta[0]) + Math.abs(delta[1]) === scene.body.quantum && (!delta[0] || !delta[1])) {
          next.controls = { ...local.controls, [command.action_ref]: delta };
        }
        if (local.replay) {
          next.ticks = local.ticks + Number(moved);
          const at = local.samples[Math.min(next.ticks, local.samples.length - 1)]!;
          const secondary = after.entities.filter(entity => entity.signature !== scene.body.signature
            && entity.bbox[2] - entity.bbox[0] + 1 === scene.body.size[0] && entity.bbox[3] - entity.bbox[1] + 1 === scene.body.size[1]
            && entity.mask.length === scene.body.mask.length && scene.body.mask.every(([x, y], i) => x === entity.mask[i]?.[0] && y === entity.mask[i]?.[1]));
          next.stopped = secondary.some(entity => !equal([entity.bbox[0], entity.bbox[1]], at));
        } else if (moved) {
          next.samples = [...local.samples, position];
          const node = local.node!;
          if (!local.entered.length && equal(position, node.position)) {
            next.entered = node.peer_support.flatMap(pixel => {
              const a = valueAt(first, pixel), b = valueAt(second, pixel);
              return a !== undefined && b !== undefined && a !== b ? [{ pixel, before: a, after: b }] : [];
            });
            next.stopped = !next.entered.length;
          } else if (local.entered.length && equal(from, node.position) && !local.restored) {
            next.restored = local.entered.every(change => valueAt(second, change.pixel) === change.before);
            next.stopped = !next.restored;
          } else if (local.restored && equal(position, node.position)) {
            next.reversible = local.entered.every(change => valueAt(second, change.pixel) === change.after);
            next.stopped = !next.reversible;
          }
        }
      }
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
