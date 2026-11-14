import { orientedCouplingInitial, orientedCouplingScene, orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const orientedDeliveryId = 'sic_oriented_delivery';

type Geometry = { pitch: number; phase: NativePoint; core: number; background: number; rest_shell: number;
  targets: NativePoint[]; initial_boxes: NativePoint[] };
type Scene = { pose: NativePoint; face: NativePoint; boxes: Record<string, number> };
type State = { epoch: number; geometry: Geometry; color: number; held: NativePoint | null; invitation: NativePoint | null;
  free: Record<string, NativePoint>; loaded: Record<string, NativePoint>; tried: string[]; refs: string[]; count: number };
type Move = { pose: NativePoint; face: NativePoint; cargo: NativePoint | null };
type Intent = 'motion' | 'attach' | 'release';
type Step = { input: string; intent: Intent; prediction: Move | null; target: NativePoint | null };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; needId: string; attempt: string };

const labels = { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] } as const;
const add = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x + u, y + v];
const sub = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [x - u, y - v];
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint | null, b: NativePoint | null) => a === b || !!a && !!b && a[0] === b[0] && a[1] === b[1];
const compare = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const point = (value: string): NativePoint => { const [x, y] = value.split(',').map(Number); return [x!, y!]; };
const positions = (scene: Scene) => Object.keys(scene.boxes).map(point).sort(compare);
function tileBox(g: Geometry, [x, y]: NativePoint): NativeBox {
  const l = g.phase[0] + x * g.pitch, t = g.phase[1] + y * g.pitch;
  return [l, t, l + g.pitch - 1, t + g.pitch - 1];
}

function shortest(start: Move, fixed: Set<string>, floor: Set<string>, vectors: Readonly<Record<string, NativePoint>>,
  accepts: (state: Move) => boolean): { step: Step | null; end: Move; length: number } | null {
  const moves = Object.entries(vectors);
  const queue = [{ state: start, step: null as Step | null, length: 0 }];
  const visited = new Set<string>();
  for (const { state, step, length } of queue) {
    const identity = JSON.stringify([state.pose, state.face, state.cargo]);
    if (visited.has(identity)) continue;
    visited.add(identity);
    if (accepts(state)) return { step, end: state, length };
    if (visited.size >= 2048) return null;
    for (const [input, delta] of moves) {
      const pose = add(state.pose, delta), face = state.cargo ? state.face : delta;
      const cargo = state.cargo ? add(state.cargo, delta) : null;
      const occupiable = (q: NativePoint) => floor.has(key(q)) && !fixed.has(key(q));
      const prediction = occupiable(pose) && (!cargo || occupiable(cargo)) ? { pose, face, cargo } : { ...state, face };
      if (same(prediction.pose, state.pose) && same(prediction.face, state.face)) continue;
      queue.push({ state: prediction, step: step ?? { input, intent: 'motion', prediction, target: null }, length: length + 1 });
    }
  }
  return null;
}

function planDelivery(local: State, scene: Scene, rows: NativeRows, commands: Readonly<Record<string, NativePoint>>): Step | null {
  const { geometry: g, held } = local, parts = positions(scene);
  const goal = new Set(g.targets.map(key));
  const floor = new Set([...parts, scene.pose, ...g.targets].map(key));
  for (let y = 0; y * g.pitch + g.phase[1] + g.pitch <= rows.length; y++) {
    for (let x = 0; x * g.pitch + g.phase[0] + g.pitch <= rows[0]!.length; x++) {
      const cell: NativePoint = [x, y];
      if (orientedCouplingTile(rows, g, cell)?.every(row => row.every(value => value === g.background))) floor.add(key(cell));
    }
  }
  const choices: { step: Step; length: number; index: number; target: NativePoint; face: NativePoint }[] = [];
  for (const [index, part] of parts.entries()) {
    if (held ? !same(held, part) : goal.has(key(part))) continue;
    const fixed = new Set(parts.filter(other => !same(part, other)).map(key));
    for (const target of g.targets.filter(target => !fixed.has(key(target)))) {
      for (const face of held ? [scene.face] : Object.values(commands)) {
        let start: Move = { pose: scene.pose, face: scene.face, cargo: held };
        let length = 0, opening: Step | null = null;
        if (!held) {
          const approach = shortest(start, new Set([...fixed, key(part)]), floor, commands,
            state => same(state.pose, sub(part, face)) && same(state.face, face));
          if (!approach) continue;
          start = { ...approach.end, cargo: part };
          length = approach.length + 1;
          opening = approach.step ?? { input: 'ACTION5', intent: 'attach', prediction: null, target: part };
        }
        const path = shortest(start, fixed, floor, commands, state => same(state.cargo, target));
        if (!path) continue;
        const step = opening ?? path.step ?? { input: 'ACTION5', intent: 'release', prediction: null, target };
        choices.push({ step: { ...step, target: step.target ?? target }, length: length + path.length + 1, index, target, face });
      }
    }
  }
  choices.sort((a, b) => a.length - b.length || a.index - b.index || compare(a.target, b.target) || compare(a.face, b.face));
  return choices[0]?.step ?? null;
}

export function createSicOrientedDelivery(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: orientedDeliveryId,
    propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !Object.keys(labels).every(input => observation.available_action_refs.includes(input))
        || !observation.available_action_refs.includes('ACTION5') || observation.available_action_refs.includes('ACTION6')) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if ((prior?.count ?? 0) >= 70) return null;
      const geometry = prior?.geometry ?? orientedCouplingInitial(rows) as Geometry | null;
      if (!geometry || geometry.targets.length > 6 || geometry.initial_boxes.length > 6) return null;
      const possible = prior ? [prior.color] : [...new Set(rows.flat())].filter(value => ![geometry.core, geometry.background, geometry.rest_shell].includes(value));
      const scenes = possible.flatMap(color => {
        const scene = orientedCouplingScene(rows, geometry, color) as Scene | null;
        return scene ? [{ color, scene }] : [];
      });
      if (scenes.length !== 1) return null;
      const { color, scene } = scenes[0]!, ahead = add(scene.pose, scene.face);
      const local: State = prior ?? { epoch: observation.level_epoch, geometry, color, held: null, invitation: null,
        free: {}, loaded: {}, tried: [], refs: [], count: 0 };
      const commands: Readonly<Record<string, NativePoint>> = { ...labels, ...local.free, ...(local.held ? local.loaded : {}) };
      const approach = planDelivery(local, scene, rows, commands);
      const invited = same(ahead, local.invitation) && Object.hasOwn(scene.boxes, key(ahead));
      if (!approach && !invited) return null;
      const unique = (step: Step) => JSON.stringify([scene.pose, scene.face, scene.boxes, local.held, step.input]);
      const step: Step | null = !local.held && invited && (!local.count || !Object.keys(local.loaded).length)
        ? { input: 'ACTION5', intent: 'attach', prediction: null, target: ahead } : approach;
      if (!step || local.tried.includes(unique(step))) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
      const known = step.intent === 'motion' ? (local.held ? local.loaded : local.free)[step.input] : null;
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: step.input, expected: known && step.prediction ? step.prediction.pose : null, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        access: known ? offer : null, probe: !known && (step.intent === 'motion' || !Object.keys(local.loaded).length) ? offer : null,
        interaction: step.intent !== 'motion' && Object.keys(local.loaded).length ? offer : null });
      if (!selected) return null;
      const strategy = selected.id, label = navigationPrimitives[strategy], parent = 'G_official_completion';
      const situation = step.intent === 'attach' ? 'Test whether the object in front attaches'
        : step.intent === 'release' ? 'Test whether the part stays in its receiving cell'
          : local.held ? 'Move while checking that the part keeps its offset' : 'Approach the next part and bring it in front of the carrier';
      const objective = { kind: 'fill_receiving_region_with_oriented_parts', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['oriented_carrier', 'part_in_front', 'receiving_region'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_depositing_compatible_parts' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'oriented-delivery:' + need.id, action = { action_ref: selected.plan.input, data: {} }, actions = [action];
      const prediction = known ? step.prediction : null;
      return { status: 'proposed', kind: orientedDeliveryId, actions, steps: [{ action, expected_after: prediction }],
        local, scene, step, needId: need.id, attempt: unique(step),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy, need: 'Bring the framed parts into the receiving region', situation, evidence, agenda: entries, mode, triggerCard: card,
          actor: tileBox(geometry, scene.pose), cargo: local.held ? tileBox(geometry, local.held) : invited ? tileBox(geometry, ahead) : null,
          target: step.target ? tileBox(geometry, step.target) : null },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_oriented_carrier_bound' : 'oriented_carrier_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const predicted = proposal.steps?.[0]?.expected_after as Move | null, previous = proposal.scene;
      const scene = predicted ? orientedCouplingScene(second, proposal.local.geometry, proposal.local.color) as Scene | null : null;
      const expected = new Set(Object.keys(previous.boxes).filter(p => !proposal.local.held || p !== key(proposal.local.held)));
      if (predicted?.cargo) expected.add(key(predicted.cargo));
      const matched = predicted ? !!scene && same(scene.pose, predicted.pose) && same(scene.face, predicted.face)
        && expected.size === Object.keys(scene.boxes).length && Object.keys(scene.boxes).every(p => expected.has(p)) : null;
      return { matched, seal_prefix: true, reason: 'compare_carrier_orientation_and_part_positions' };
    },
    record(before, after, action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene: old, step } = proposal;
      const scene = orientedCouplingScene(second, local.geometry, local.color) as Scene | null;
      if (!scene) return { events: [] };
      const delta = sub(scene.pose, old.pose), moved = delta.some(Boolean);
      const changed = Object.keys(old.boxes).filter(key => Object.hasOwn(scene.boxes, key) && old.boxes[key] !== scene.boxes[key]);
      const ahead = add(scene.pose, scene.face);
      const next: State = { ...local, count: local.count + 1, invitation: null, refs: [...local.refs.slice(-5), after.observation_ref],
        tried: [...local.tried, proposal.attempt] };
      if (step.intent !== 'motion' && !moved && changed.length === 1 && changed[0] === key(ahead)) {
        next.held = step.intent === 'attach' ? ahead : null;
      } else if (local.held && moved) {
        const cargo = add(local.held, delta);
        const removed = Object.keys(old.boxes).filter(key => !Object.hasOwn(scene.boxes, key));
        const added = Object.keys(scene.boxes).filter(key => !Object.hasOwn(old.boxes, key));
        if (removed.length === 1 && removed[0] === key(local.held) && added.length === 1 && added[0] === key(cargo)) {
          next.held = cargo;
          next.loaded = { ...local.loaded, [action.action_ref]: delta };
        } else next.held = null;
      } else if (moved) next.free = { ...local.free, [action.action_ref]: delta };
      if (!next.held && changed.length === 1 && changed[0] === key(ahead)) next.invitation = ahead;
      state = next;
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
