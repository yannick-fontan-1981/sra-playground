import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const linkedMidpointId = 'sic_linked_midpoint';

type Part = ReturnType<typeof geometricComponents>[number];
type Mark = { point: NativePoint; box: NativeBox; color: number };
type Layout = { side: number; carrierColor: number; carrierMask: string; selectorMask: string; goal: NativePoint; goalBox: NativeBox; ground: number; activeColor: number };
type Scene = { actor: Mark; active: Mark; passive: Mark };
type Memory = { epoch: number; layout: Layout; coupling: string | null; switches: string[]; tried: string[]; count: number };
type Intent = 'measure' | 'select' | 'align';
type Proposal = NativeProposal & { local: Memory; scene: Scene; intent: Intent; target: NativePoint; prediction: NativePoint; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const mid = ([x, y]: NativePoint, [u, v]: NativePoint): NativePoint => [Math.floor((x + u) / 2), Math.floor((y + v) / 2)];
const center = ([l, t, r, b]: NativeBox): NativePoint => mid([l, t], [r, b]);
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = (p: NativePoint) => p.join(',');
const mark = (p: Part): Mark => ({ point: center(p.bbox), box: p.bbox, color: p.color });
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function findGoal(parts: Part[], actor: Part): { point: NativePoint; box: NativeBox } | null {
  const pins = parts.filter(p => p.color === actor.color && p.area === 1).map(p => center(p.bbox));
  if (pins.length < 8 || pins.length > 48) return null;
  const pinKeys = new Set(pins.map(key));
  const candidates = new Map<string, { point: NativePoint; box: NativeBox }>();
  const radius = Math.ceil(width(actor.bbox) / 2);
  for (const [x, y] of pins) {
    for (const [u, v] of pins) {
      if (x === u || y === v || (x + u) % 2 || (y + v) % 2) continue;
      const c: NativePoint = [(x + u) / 2, (y + v) / 2];
      if (pinKeys.has(key(c)) || candidates.has(key(c))) continue;
      const enclosed = pins.filter(([a, b]) => Math.max(Math.abs(a - c[0]), Math.abs(b - c[1])) <= radius);
      if (enclosed.length < 8 || enclosed.some(([a, b]) => !pinKeys.has(key([2 * c[0] - a, b]))
        || !pinKeys.has(key([a, 2 * c[1] - b])))) continue;
      if (!enclosed.some(([a]) => Math.abs(a - c[0]) === radius) || !enclosed.some(([, b]) => Math.abs(b - c[1]) === radius)) continue;
      candidates.set(key(c), { point: c, box: [c[0] - radius, c[1] - radius, c[0] + radius, c[1] + radius] });
    }
  }
  return candidates.size === 1 ? [...candidates.values()][0]! : null;
}

function readScene(parts: Part[], layout: Layout): Scene | null {
  const actors = parts.filter(p => p.color === layout.carrierColor && JSON.stringify(p.mask) === layout.carrierMask);
  const markers = parts.filter(p => width(p.bbox) === layout.side && height(p.bbox) === layout.side && JSON.stringify(p.mask) === layout.selectorMask);
  const active = markers.filter(p => p.color === layout.activeColor), passive = markers.filter(p => p.color !== layout.activeColor);
  return actors.length === 1 && active.length === 1 && passive.length === 1
    ? { actor: mark(actors[0]!), active: mark(active[0]!), passive: mark(passive[0]!) } : null;
}

function initial(parts: Part[], rows: NativeRows): Layout | null {
  const ground = parts.find(p => p.area > rows.length * rows[0]!.length * 0.65);
  if (!ground) return null;
  const options: Layout[] = [];
  for (const actor of parts) {
    const side = width(actor.bbox);
    if (side < 3 || side > 7 || side % 2 === 0 || side !== height(actor.bbox) || actor.area < side * (side - 1)) continue;
    const goal = findGoal(parts, actor);
    if (!goal) continue;
    const m = parts.filter(p => width(p.bbox) === side && height(p.bbox) === side && p.area === 4 * (side - 2));
    if (m.length !== 2 || m[0]!.color === m[1]!.color || JSON.stringify(m[0]!.mask) !== JSON.stringify(m[1]!.mask)
      || !same(mid(center(m[0]!.bbox), center(m[1]!.bbox)), center(actor.bbox))) continue;
    const bands = parts.filter(p => height(p.bbox) === rows.length && width(p.bbox) === 1 && p.area === rows.length);
    const active = m.filter(p => bands.some(band => band.color === p.color));
    if (active.length !== 1) continue;
    options.push({ carrierColor: actor.color, carrierMask: JSON.stringify(actor.mask), selectorMask: JSON.stringify(m[0]!.mask),
      side, goal: goal.point, goalBox: goal.box, ground: ground.color, activeColor: active[0]!.color });
  }
  return options.length === 1 ? options[0]! : null;
}

function proposalPoint(rows: NativeRows, scene: Scene, local: Memory): { target: NativePoint; intent: Intent } | null {
  const { goal, side, ground } = local.layout;
  const { active, passive } = scene;
  const safe = ([x, y]: NativePoint) => {
    const h = (side - 1) / 2;
    return rows[y - h]?.[x - h] === ground && rows[y - h]?.[x + h] === ground
      && rows[y + h]?.[x - h] === ground && rows[y + h]?.[x + h] === ground;
  };
  const available = (p: NativePoint) => !local.tried.includes(key(active.point) + '/' + key(passive.point) + '/' + key(p));
  const reflection: NativePoint = [2 * goal[0] - passive.point[0], 2 * goal[1] - passive.point[1]];
  if (local.coupling && safe(reflection) && available(reflection) && distance(reflection, passive.point) >= side) {
    return { target: reflection, intent: 'align' };
  }
  if (local.coupling && distance(active.point, goal) < distance(passive.point, goal) && available(passive.point)) {
    return { target: passive.point, intent: 'select' };
  }

  const offset = side + 1;
  const [x, y] = goal, [u, v] = passive.point;
  const dx = Math.sign(x - u), dy = Math.sign(y - v);
  const candidates: NativePoint[] = [[x + dx * side, y + dy * offset], [x - dx * offset, y - dy * offset],
    [x + dx * offset, y - dy * offset], [x - dx * offset, y + dy * offset]];
  const target = candidates.find(p => safe(p) && available(p));
  return target ? { target, intent: local.coupling ? 'align' : 'measure' } : null;
}

export function createSicLinkedMidpoint(): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  return {
    id: linkedMidpointId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const parts = geometricComponents(rows), prior = memory?.epoch === observation.level_epoch ? memory : null;
      const layout = prior?.layout ?? initial(parts, rows);
      if (!layout || (prior?.count ?? 0) >= 16) return null;
      const scene = readScene(parts, layout);
      if (!scene) return null;
      const local = prior ?? { epoch: observation.level_epoch, layout, coupling: null, switches: [], tried: [], count: 0 };
      const candidate = proposalPoint(rows, scene, local);
      if (!candidate) return null;
      const { target, intent } = candidate;
      const prediction = intent === 'select' ? scene.actor.point : mid(scene.passive.point, target);
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...[local.coupling, ...local.switches].filter((value): value is string => !!value && value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: 'ACTION6', expected: prediction, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: intent !== 'align' ? offer : null, access: intent === 'align' ? offer : null, interaction: null });
      if (!selected) return null;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, target, { reason: 'Link the movable markers to the carrier position', evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'align_carrier_by_linked_markers', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(layout.goal)], parentObjective: parent, satisfactionContract: 'official_progress_after_carrier_alignment' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = linkedMidpointId + ':' + need.id, action = { action_ref: 'ACTION6', data: { x: target[0], y: target[1] } };
      const [x, y] = target, h = Math.floor(layout.side / 2);
      const situation = intent === 'measure' ? 'Test whether moving the active marker also moves the carrier to the midpoint'
        : intent === 'select' ? 'Test switching the active marker while keeping both positions'
          : 'Position the active marker so the measured midpoint reaches the destination';
      return {
        status: 'proposed', kind: linkedMidpointId, local, scene, intent, target, prediction, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: prediction, point_binding: witness }],
        sicSituationCard: { strategy: selected.id, need: 'Align the linked carrier with the visible destination', situation, evidence, agenda: entries,
          mode, triggerCard: card, actor: scene.actor.box, active: scene.active.box, passive: scene.passive.box, goal: layout.goalBox,
          focus: [x - h, y - h, x + h, y + h] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'linked_marker_action_bound' : 'linked_marker_observation_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = readScene(geometricComponents(second), proposal.local.layout);
      const selected = proposal.intent === 'select';
      const matched = !!next && same(next.actor.point, proposal.prediction) && same(next.active.point, proposal.target)
        && same(next.passive.point, selected ? proposal.scene.active.point : proposal.scene.passive.point);
      return { matched, seal_prefix: true, reason: matched ? selected ? 'active_marker_switched' : 'linked_midpoint_observed' : 'predicted_linked_motion_missing' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, scene, target, prediction, intent } = proposal;
      const next = readScene(geometricComponents(second), local.layout);
      const moved = !!next && same(next.actor.point, prediction) && same(next.active.point, target);
      memory = { ...local, count: local.count + 1,
        coupling: moved && intent !== 'select' ? after.observation_ref : local.coupling,
        switches: moved && intent === 'select' ? [...local.switches.slice(-2), after.observation_ref] : local.switches,
        tried: moved ? local.tried : [...local.tried, key(scene.active.point) + '/' + key(scene.passive.point) + '/' + key(target)] };
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as Memory | null); },
  };
}
