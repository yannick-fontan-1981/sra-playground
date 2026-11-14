import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const reactiveTargetId = 'sic_reactive_target';

const inputs = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Input = typeof inputs[number][0];
type Direction = typeof inputs[number];
type Part = ReturnType<typeof geometricComponents>[number];
type Layout = { actor: number; peer: number; goals: NativePoint[]; cells: Record<string, boolean>; pitch: number; size: number; bounds: NativeBox };
type Pair = { actor: NativePoint; peer: NativePoint };
type Return = Pair & { evidence: string };
type Hypothesis = { order: Direction[]; matches: number };
type Memory = { epoch: number; layout: Layout; edges: Record<string, Return>; visits: Record<string, number>;
  hypotheses: Hypothesis[]; refs: string[]; count: number };
type Plan = { input: Input; target: Pair; condition: 'contact' | 'route' | 'probe' };
type Proposal = NativeProposal & { local: Memory; at: Pair; plan: Plan; needId: string };
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const point = ([x, y]: NativeBox): NativePoint => [x, y];
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const dist = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const inside = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && x <= r && t <= y && y <= b;
const shift = ([x, y]: NativePoint, [, dx, dy]: Direction, n: number): NativePoint => [x + dx * n, y + dy * n];
const pairKey = ({ actor, peer }: Pair) => key(actor) + '/' + key(peer);
const edgeKey = (p: Pair, input: Input) => pairKey(p) + '/' + input;
const box = ([x, y]: NativePoint, size: number): NativeBox => [x, y, x + size - 1, y + size - 1];

function permutations(directions: readonly Direction[]): Direction[][] {
  if (!directions.length) return [[]];
  return directions.flatMap(direction => permutations(directions.filter(d => d !== direction)).map(rest => [direction, ...rest]));
}

function layoutFor(rows: NativeRows, parts: Part[]): Layout | null {
  const candidates: Layout[] = [];
  const boards = parts.filter(p => width(p.bbox) === height(p.bbox) && width(p.bbox) >= 20
    && p.bbox[0] > 0 && p.bbox[1] > 0 && p.bbox[2] < rows[0]!.length - 1 && p.bbox[3] < rows.length - 3
    && p.area * 2 > width(p.bbox) ** 2);
  for (const board of boards) {
    for (const size of [2, 3, 4]) {
      const pitch = size + 2;
      if (width(board.bbox) % pitch !== 0) continue;
      const [left, top, right, bottom] = board.bbox;
      const grid = (p: Part) => inside(board.bbox, point(p.bbox))
        && (p.bbox[0] - left - 1) % pitch === 0 && (p.bbox[1] - top - 1) % pitch === 0;
      const pieces = parts.filter(p => p.area === size ** 2 && width(p.bbox) === size && height(p.bbox) === size && grid(p));
      const groups = new Map<number, Part[]>();
      for (const p of pieces) groups.set(p.color, [...groups.get(p.color) ?? [], p]);
      const single = [...groups.values()].filter(g => g.length === 1).map(g => g[0]!);
      const others = [...groups.values()].filter(g => g.length > 1);
      if (single.length !== 2 || others.length !== 1 || others[0]!.length < 3) continue;
      const indicators = parts.filter(p => p.bbox[1] > bottom && width(p.bbox) === size && height(p.bbox) === size - 1);
      const actors = single.filter(p => indicators.some(tag => tag.color === p.color && tag.area === size * (size - 1)));
      if (actors.length !== 1) continue;
      const actor = actors[0]!, peer = single.find(p => p !== actor)!;
      const cells: Record<string, boolean> = {};
      for (let y = top + 1; y < bottom; y += pitch) {
        for (let x = left + 1; x < right; x += pitch) {
          if ([rows[y - 1]?.[x], rows[y]?.[x - 1], rows[y + size]?.[x + size - 1], rows[y + size - 1]?.[x + size]]
            .every(value => value === board.color)) cells[key([x, y])] = true;
        }
      }
      if (!cells[key(point(actor.bbox))] || !cells[key(point(peer.bbox))] || Object.keys(cells).length > 128) continue;
      candidates.push({ actor: actor.color, peer: peer.color, pitch, size, bounds: board.bbox, cells, goals: others[0]!.map(p => point(p.bbox)) });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function positions(parts: Part[], { bounds, actor, size, peer }: Layout): Pair | null {
  const match = (color: number) => parts.filter(p => p.color === color && p.area === size ** 2
    && width(p.bbox) === size && height(p.bbox) === size && inside(bounds, point(p.bbox)));
  const a = match(actor), p = match(peer);
  return a.length === 1 && p.length === 1 ? { actor: point(a[0]!.bbox), peer: point(p[0]!.bbox) } : null;
}

function prediction(layout: Layout, actor: NativePoint, peer: NativePoint, order: readonly Direction[]): NativePoint {
  let best = peer, distance = dist(actor, peer);
  for (const d of order) {
    const candidate = shift(peer, d, layout.pitch), value = dist(actor, candidate);
    if (layout.cells[key(candidate)] && value > distance) {
      best = candidate;
      distance = value;
    }
  }
  return best;
}

function choose(at: Pair, local: Memory): Plan | null {
  const { layout, edges, visits, hypotheses } = local;
  const queue: { at: Pair; first: Plan | null; depth: number }[] = [{ at, first: null, depth: 0 }];
  const seen = new Set([pairKey(at)]);
  let probe: { plan: Plan; score: number } | null = null;
  const order = hypotheses[0]!.order;
  for (const item of queue) {
    for (const d of inputs) {
      const input = d[0], actor = shift(item.at.actor, d, layout.pitch);
      if (!layout.cells[key(actor)]) continue;
      const returned = edges[edgeKey(item.at, input)];
      if (returned && same(returned.actor, item.at.actor)) continue;
      const contact = !returned && same(actor, item.at.peer);
      const target = returned ?? { actor, peer: contact ? item.at.peer : prediction(layout, actor, item.at.peer, order) };
      const first: Plan = item.first ?? { input, target, condition: contact ? 'contact' : returned ? 'route' : 'probe' };
      if (contact) return first;
      const k = pairKey(target);
      if (!returned && item.depth <= 3) {
        const score = item.depth * 7 + Math.min(20, (visits[k] ?? 0) * 5);
        if (!probe || score < probe.score) probe = { plan: first, score };
      }
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ at: target, first, depth: item.depth + 1 });
    }
  }
  return probe?.plan ?? null;
}

export function createSicReactiveTarget(): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  return {
    id: reactiveTargetId,
    propose(observation, rows, _available, remaining, execution): Proposal | null {
      if (remaining < 1 || !inputs.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const parts = geometricComponents(rows);
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const layout = prior?.layout ?? layoutFor(rows, parts);
      if (!layout || (prior?.count ?? 0) >= 100) return null;
      const local = prior ?? { epoch: observation.level_epoch, layout, edges: {}, visits: {}, refs: [], count: 0,
        hypotheses: permutations(inputs).map(order => ({ order, matches: 0 })) };
      const at = positions(parts, layout);
      if (!at) return null;
      let plan = choose(at, local);
      if (!plan || (local.visits[pairKey(at)] ?? 0) > 1) {
        const untested = inputs.find(d => layout.cells[key(shift(at.actor, d, layout.pitch))] && !local.edges[edgeKey(at, d[0])]);
        if (untested) {
          const actor = shift(at.actor, untested, layout.pitch);
          plan = { input: untested[0], target: { actor, peer: prediction(layout, actor, at.peer, local.hypotheses[0]!.order) },
            condition: same(actor, at.peer) ? 'contact' : 'probe' };
        }
      }
      if (!plan) return null;
      const ref = observation.observation_ref, exact = local.edges[edgeKey(at, plan.input)]?.evidence;
      const evidence: [string, ...string[]] = [ref, ...new Set([...local.refs, ...(exact ? [exact] : [])].filter(r => r !== ref))];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: plan.input, expected: plan.target.actor, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: plan.condition === 'probe' ? offer : null, access: plan.condition === 'route' ? offer : null,
        interaction: plan.condition === 'contact' ? offer : null });
      if (!selected) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'test_contact_with_reactive_target', scope: ref.split(':revision:', 1)[0]!, subjects: ['tracked_moving_sprite'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_contact_with_tracked_sprite' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = reactiveTargetId + ':' + need.id;
      const situation = plan.condition === 'contact' ? 'Test contact with the tracked sprite'
        : plan.condition === 'route' ? 'Reuse a measured movement of both sprites'
          : 'Test how the second sprite reacts to this move and update the route';
      const action = { action_ref: plan.input, data: {} };
      return {
        status: 'proposed', kind: reactiveTargetId, at, plan, local, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action], steps: [{ action, expected_after: plan.target }],
        sicSituationCard: { strategy: selected.id, need: 'Reach a sprite that reacts to movement', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: box(at.actor, layout.size), focus: box(at.peer, layout.size), landing: box(plan.target.peer, layout.size) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'tracked_pair_move_bound' : 'tracked_pair_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actual = positions(geometricComponents(second), proposal.local.layout), expected = proposal.plan.target;
      const matched = !!actual && same(actual.actor, expected.actor) && same(actual.peer, expected.peer);
      return { matched, seal_prefix: true, reason: matched ? 'both_sprite_positions_confirmed' : 'sprite_response_diverged_replan' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { at, local, plan } = proposal, k = edgeKey(at, plan.input), stateKey = pairKey(at);
      const actual = positions(geometricComponents(second), local.layout);
      const trial = actual && !local.edges[k] && !same(at.actor, actual.actor) ? actual : null;
      const hypotheses = trial ? local.hypotheses.map(h => ({ ...h, matches: h.matches
        + Number(same(prediction(local.layout, trial.actor, at.peer, h.order), trial.peer)) })).sort((a, b) => b.matches - a.matches) : local.hypotheses;
      memory = { ...local, count: local.count + 1, visits: { ...local.visits, [stateKey]: (local.visits[stateKey] ?? 0) + 1 },
        refs: [...local.refs.slice(-4), after.observation_ref], hypotheses,
        edges: actual ? { ...local.edges, [k]: { ...actual, evidence: after.observation_ref } } : local.edges };
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as Memory | null); },
  };
}
