import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const indicatedJumpId = 'sic_indicated_jump';

type Component = ReturnType<typeof geometricComponents>[number];
type Arrow = { point: NativePoint; box: NativeBox; face: NativePoint; color: number };
type Scene = { arrows: Arrow[]; actor: Arrow; terminal: NativePoint; pitch: number; boundary: NativeBox };
type State = { epoch: number; ring: number; highlight: number | null; refs: string[]; tried: string[]; count: number };
type Proposal = NativeProposal & { local: State; scene: Scene; point: NativePoint; needId: string; attempt: string };
const distance = ([x, y]: NativePoint, [u, v]: NativePoint) => Math.abs(x - u) + Math.abs(y - v);
const same = (a: NativePoint, b: NativePoint) => distance(a, b) === 0;
const middle = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const size = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];
const key = ([x, y]: NativePoint) => x + ',' + y;
const square = (p: Component) => p.bbox[2] - p.bbox[0] === p.bbox[3] - p.bbox[1];
const within = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;

function readArrow(component: Component): Arrow | null {
  const [w, h] = size(component.bbox);
  if (w === h || Math.max(w, h) < 3 || w % 2 === 0 || h % 2 === 0) return null;
  const axis = Number(h > w), width = axis ? h : w, thickness = axis ? w : h, spine = (thickness - 1) / 2;
  const counts = Array.from({ length: width }, () => 0);
  const centerline = new Set<number>();
  for (const offset of component.mask) {
    counts[offset[axis]!]!++;
    if (offset[1 - axis] === spine) centerline.add(offset[axis]!);
  }
  if (centerline.size !== width || component.area !== width + thickness - 1) return null;
  const head = counts.findIndex(count => count === thickness);
  if (head !== 1 && head !== width - 2) return null;
  if (counts.filter(count => count !== 1).length !== 1) return null;
  const direction = head === 1 ? -1 : 1, face: NativePoint = axis ? [0, direction] : [direction, 0];
  return { point: middle(component.bbox), box: component.bbox, face, color: component.color };
}

function measure(rows: NativeRows, preferredRing: number | null): Scene | null {
  const components = geometricComponents(rows);
  const arrows = components.flatMap(component => { const arrow = readArrow(component); return arrow ? [arrow] : []; });
  if (arrows.length < 4 || arrows.length > 64) return null;
  const frames = components.filter(part => square(part) && part.area === (size(part.bbox)[0] - 1) * 4 && size(part.bbox)[0] >= 7);
  const candidates: Scene[] = [];
  for (const frame of frames) {
    if (preferredRing !== null && frame.color !== preferredRing) continue;
    const tagged = arrows.filter(arrow => arrow.color === frame.color && same(arrow.point, middle(frame.bbox)));
    if (tagged.length !== 1) continue;
    const actor = tagged[0]!, side = size(frame.bbox)[0];
    const aligned = arrows.filter(arrow => Math.abs(arrow.point[0] - actor.point[0]) % (side - 1) === 0
      && Math.abs(arrow.point[1] - actor.point[1]) % (side - 1) === 0);
    if (aligned.length < 4) continue;
    const pitch = aligned.reduce((period, arrow) => gcd(period, distance(arrow.point, actor.point)), 0);
    if (pitch !== side - 1) continue;
    const xs = aligned.map(arrow => arrow.point[0]), ys = aligned.map(arrow => arrow.point[1]);
    const boundary: NativeBox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const terminals = frames.filter(other => other !== frame && size(other.bbox)[0] < side
      && within(boundary, middle(other.bbox)) && distance(middle(other.bbox), actor.point) % pitch === 0
      && !aligned.some(arrow => same(arrow.point, middle(other.bbox)))
      && components.some(core => core.color === other.color && core.area > 1
        && same(middle(core.bbox), middle(other.bbox)) && size(core.bbox)[0] < size(other.bbox)[0]));
    if (terminals.length !== 1) continue;
    candidates.push({ arrows: aligned, actor, terminal: middle(terminals[0]!.bbox), pitch, boundary });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function inRay(from: Arrow, to: NativePoint, pitch: number): boolean {
  const [x, y] = from.point, [u, v] = to, dx = u - x, dy = v - y, [sx, sy] = from.face;
  return (sx ? !dy && dx * sx > 0 : !dx && dy * sy > 0) && (Math.abs(dx) + Math.abs(dy)) % pitch === 0;
}

function pathLength(scene: Scene, start: NativePoint): number {
  if (same(start, scene.terminal)) return 0;
  const queue = [{ point: start, length: 0 }], seen = new Set([key(start)]);
  for (const entry of queue) {
    const arrow = scene.arrows.find(arrow => same(arrow.point, entry.point));
    if (!arrow) continue;
    for (const { point } of [...scene.arrows, { point: scene.terminal }]) {
      if (seen.has(key(point)) || !inRay(arrow, point, scene.pitch)) continue;
      if (same(point, scene.terminal)) return entry.length + 1;
      seen.add(key(point));
      queue.push({ point, length: entry.length + 1 });
    }
  }
  return Infinity;
}

export function createSicIndicatedJump(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: indicatedJumpId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if ((prior?.count ?? 0) >= 24) return null;
      const scene = measure(rows, prior?.ring ?? null);
      if (!scene) return null;
      const local: State = prior ?? { epoch: observation.level_epoch, ring: scene.actor.color, highlight: null, refs: [], tried: [], count: 0 };
      const others = scene.arrows.filter(other => !same(scene.actor.point, other.point));
      const colors = new Map<number, Arrow[]>();
      for (const other of others) {
        const group = colors.get(other.color) ?? [];
        group.push(other);
        colors.set(other.color, group);
      }
      const marked = [...colors].filter(([, group]) => group.every(arrow => inRay(scene.actor, arrow.point, scene.pitch))
        && group.length > 0 && (local.highlight === null || group[0]!.color === local.highlight));
      const unique = marked.length === 1 ? marked[0] : null;
      const candidates = unique ? unique[1].map(arrow => arrow.point) : [];
      if (inRay(scene.actor, scene.terminal, scene.pitch) && (local.highlight !== null || !candidates.length)) candidates.push(scene.terminal);
      const attempt = (point: NativePoint) => [key(scene.actor.point), key(scene.actor.face), key(point)].join('/');
      const available = candidates.filter(point => !local.tried.includes(attempt(point)));
      available.sort((a, b) => pathLength(scene, a) - pathLength(scene, b) || distance(a, scene.actor.point) - distance(b, scene.actor.point));
      const point = available[0];
      if (!point) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration', offer = { input: 'ACTION6', expected: point, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({
        mode, evidence, access: local.refs.length ? offer : null, probe: local.refs.length ? null : offer, interaction: null,
      });
      if (!selected) return null;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: 'Current indicated destination', evidence });
      if (!pointBinding) return null;
      const strategy = selected.id, parent = 'G_official_completion', label = navigationPrimitives[strategy];
      const objective = { kind: 'follow_visible_direction_indicators', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_indicator', 'candidate_jump', 'terminal_marker'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_revalidated_indicated_jumps' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = 'indicated-jump:' + need.id, action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } }, actions = [action];
      const focus = [...scene.arrows].find(arrow => same(arrow.point, point))?.box ?? [point[0], point[1], point[0], point[1]];
      const [x, y] = scene.terminal;
      const situation = strategy === 'P05' ? 'Test one marked destination along the current arrow' : 'Use the measured jump effect and the current arrows to choose the next destination';
      return { status: 'proposed', kind: indicatedJumpId, actions, local: { ...local, highlight: unique?.[0] ?? local.highlight }, scene, point, needId: need.id,
        attempt: attempt(point), binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: local.refs.length ? point : null, point_binding: pointBinding }],
        sicSituationCard: { strategy, need: 'Reach the distinct marker by following the visible arrows', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: scene.actor.box, focus, destination: [x - 2, y - 2, x + 2, y + 2] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_indicator_and_click_bound' : 'indicated_jump_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = measure(second, proposal.local.ring);
      const matched = proposal.local.refs.length ? !!next && same(next.actor.point, proposal.point) : null;
      return { matched, seal_prefix: true, reason: 'compare_observed_indicator_position' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local } = proposal, next = measure(second, local.ring);
      const moved = next && same(next.actor.point, proposal.point) && !same(proposal.scene.actor.point, next.actor.point);
      state = { ...local, count: local.count + 1, tried: [...local.tried, proposal.attempt],
        refs: moved ? [...local.refs.slice(-5), after.observation_ref] : local.refs };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
