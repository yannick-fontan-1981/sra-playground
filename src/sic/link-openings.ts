import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const linkOpeningsId = 'sic_link_openings';
export const learnLinkOpeningsId = 'sic_test_visible_opening_controls';

type Part = ReturnType<typeof geometricComponents>[number];
type Endpoint = { box: NativeBox; point: NativePoint; button: NativeBox; color: number; buttonMask?: string };
type RelayLeg = { pair: [Endpoint, Endpoint]; departure: NativeBox; arrival: NativeBox; floor: number };
type Scene = { endpoints: Endpoint[]; actorColor: number; actorMask: string; goal: NativeBox; goalColor?: number; goalMask?: string;
  footGap?: number; relay?: [RelayLeg, RelayLeg] };
type State = { epoch: number; scene: Scene; refs: string[]; selected: number | null; walkRef: string | null; crossed: boolean; rejected: string[];
  leg?: number; settleRef?: string };
type PriorLink = { completed: number; scene: Scene; proof: string };
type Choice = { kind: 'select' | 'place' | 'walk' | 'settle'; input: string; target: NativeBox; index: number; reason: string;
  point?: NativePoint; direction?: number };
type Proposal = NativeProposal & { local: State; choice: Choice; actor: NativeBox; needId: string; attempt: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const silhouette = (p: Part) => JSON.stringify(p.mask);
const sameBounds = (a: NativeBox, b: NativeBox) => a.every((value, i) => value === b[i]);
const contains = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => l <= x && t <= y && r >= x && b >= y;
function mirrorInvariantMask(p: Part): string {
  const w = width(p.bbox);
  const key = (reflected: boolean) => p.mask.map(([x, y]) => (reflected ? w - 1 - x : x) + ',' + y).sort().join(';');
  return [key(false), key(true)].sort()[0]!;
}

function actor(parts: Part[], scene: Scene): NativeBox | null {
  const sites = parts.filter(p => p.color === scene.actorColor && mirrorInvariantMask(p) === scene.actorMask
    && p.area >= 4 && p.area <= 12 && p.bbox[1] > scene.endpoints[0]!.button[3] + 4);
  return sites.length === 1 ? sites[0]!.bbox : null;
}

function discover(parts: Part[], rows: NativeRows): Scene | null {
  const h = rows.length, w = rows[0]!.length;
  const vertical = parts.filter(p => p.rectangular && width(p.bbox) === 1 && height(p.bbox) >= 5 && height(p.bbox) < h / 3
    && p.bbox[1] >= h / 4 && (p.bbox[0] < w / 4 || p.bbox[0] >= w * 3 / 4));
  const pairs = vertical.flatMap(left => vertical.filter(right => left.bbox[0] < w / 4 && right.bbox[0] >= w * 3 / 4
    && left.color === right.color && height(left.bbox) === height(right.bbox) && left.bbox[1] === right.bbox[1])
    .map(right => [left, right]));
  if (pairs.length !== 1) return null;
  const [left, right] = pairs[0]!, pair = [left!, right!];
  const hud = parts.filter(p => p.bbox[1] > 0 && p.bbox[3] < h / 8 && width(p.bbox) >= 5 && width(p.bbox) <= w / 4
    && height(p.bbox) >= 2 && height(p.bbox) <= 5 && p.area >= 10);
  const switches = hud.filter((p, i) => hud.slice(i + 1).some(q => q.color !== p.color && q.bbox[1] === p.bbox[1]
    && q.bbox[0] > p.bbox[2] && silhouette(q) === silhouette(p)));
  if (switches.length !== 1) return null;
  const first = switches[0]!;
  const second = hud.find(p => p.bbox[0] > first.bbox[2] && p.bbox[1] === first.bbox[1] && silhouette(p) === silhouette(first))!;
  const y = left!.bbox[1], bottom = left!.bbox[3], span = right!.bbox[0] - left!.bbox[0];
  const sprite = parts.filter(p => p.bbox[1] >= y && p.bbox[3] <= bottom && p.area >= 4 && p.area <= 12
    && width(p.bbox) >= 2 && height(p.bbox) >= 2 && p.color !== left!.color
    && !p.rectangular && p.bbox[0] > left!.bbox[0] && p.bbox[2] < right!.bbox[0]
    && !parts.some(frame => frame.bbox[1] === y && frame.bbox[3] === bottom
      && frame.bbox[0] < p.bbox[0] && frame.bbox[2] > p.bbox[2]));
  if (sprite.length !== 1) return null;
  const goals = parts.filter(p => p.bbox[1] === y && p.bbox[3] === bottom && width(p.bbox) >= 3 && width(p.bbox) <= height(p.bbox)
    && p.bbox[0] > left!.bbox[0] && p.bbox[2] < right!.bbox[0] && p.color !== left!.color);
  if (goals.length !== 1) return null;
  const goal = goals[0]!.bbox, [sx] = center(sprite[0]!.bbox), [gx] = center(goal);
  const closer = (x: number) => x - left!.bbox[0] < right!.bbox[0] - x ? 0 : 1;
  const startSide = closer(sx), endSide = closer(gx);
  if (startSide === endSide || Math.abs(gx - sx) < span / 3) return null;
  const floorY = bottom + 1;
  const floor = rows[floorY];
  if (!floor || floor[sx] !== floor[gx] || floor[Math.floor((sx + gx) / 2)] === floor[sx]) return null;
  const endpoints = pair.map((p, i) => {
    const button = i === startSide ? first : second;
    return { box: p.bbox, point: center(p.bbox), button: button.bbox, color: button.color, buttonMask: silhouette(button) };
  });
  return { endpoints, actorColor: sprite[0]!.color, actorMask: mirrorInvariantMask(sprite[0]!), goal,
    goalColor: goals[0]!.color, goalMask: silhouette(goals[0]!), footGap: floorY - sprite[0]!.bbox[3] };
}

function discoverRelay(parts: Part[], rows: NativeRows, previous: Scene): Scene | null {
  if (!previous.footGap || previous.footGap > 4 || previous.endpoints.length !== 2) return null;
  const buttons = previous.endpoints.map(endpoint => {
    const matches = parts.filter(part => part.color === endpoint.color && part.bbox[1] > 0
      && part.bbox[3] < rows.length / 8 && silhouette(part) === endpoint.buttonMask);
    return matches.length === 1 ? matches[0] : null;
  });
  if (buttons.some(button => !button)) return null;
  const controlled = actor(parts, previous);
  const goalParts = parts.filter(part => silhouette(part) === previous.goalMask && part.color === previous.goalColor);
  if (!controlled || goalParts.length !== 1) return null;
  const goal = goalParts[0]!.bbox, length = height(previous.endpoints[0]!.box);
  const bars = parts.filter(part => part.rectangular && part.bbox[1] > previous.endpoints[0]!.button[3] + 4
    && Math.min(width(part.bbox), height(part.bbox)) === 1 && part.area === length);
  const layouts: Scene[] = [];
  const start = center(controlled);
  for (const wall of bars) {
    if (width(wall.bbox) !== 1 || start[1] < wall.bbox[1] || start[1] > wall.bbox[3]) continue;
    const horizontal = bars.filter(part => part.color === wall.color && height(part.bbox) === 1);
    if (horizontal.length !== 3) continue;
    const getRoom = (point: NativePoint) => {
      const value = rows[point[1]]?.[point[0]];
      const candidates = parts.filter(part => part.color === value && width(part.bbox) >= length
        && height(part.bbox) >= length && contains(part.bbox, point));
      return candidates.length === 1 ? candidates[0]!.bbox : null;
    };
    const [wallX, wallY] = center(wall.bbox);
    const departure = getRoom([wallX + Math.sign(start[0] - wallX), wallY]);
    if (!departure || !contains(departure, start)) continue;
    for (const ceiling of horizontal) {
      const [x, y, r] = ceiling.bbox;
      const floor = horizontal.find(part => part.bbox[0] === x && part.bbox[2] === r && part.bbox[1] > y + length);
      const terminal = horizontal.find(part => part !== ceiling && part !== floor);
      if (!floor || !terminal || terminal.bbox[1] !== y) continue;
      const relayRoom = getRoom([center(ceiling.bbox)[0], y + 1]), finalRoom = getRoom([center(terminal.bbox)[0], y + 1]);
      if (!relayRoom || !finalRoom || relayRoom[1] !== y + 1 || relayRoom[3] !== floor.bbox[1] - 1
        || !contains(finalRoom, center(goal)) || contains(relayRoom, center(goal)) || contains(departure, center(goal))) continue;
      const bind = (part: Part, i: number): Endpoint => ({
        box: part.bbox, point: [part.bbox[0] + Math.floor(width(part.bbox) / 2), part.bbox[1] + Math.floor(height(part.bbox) / 2)],
        button: buttons[i]!.bbox, color: buttons[i]!.color,
      });
      const entrance = bind(wall, 0), relayExit = bind(ceiling, 1);
      layouts.push({ ...previous, goal, endpoints: [entrance, relayExit], relay: [
        { pair: [entrance, relayExit], departure, arrival: relayRoom, floor: floor.bbox[1] },
        { pair: [bind(floor, 0), bind(terminal, 1)], departure: relayRoom, arrival: finalRoom, floor: goal[3] + 1 },
      ] });
    }
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function placed(rows: NativeRows, endpoint: Endpoint): boolean {
  const [x, top, right, bottom] = endpoint.box;
  let count = 0;
  for (let y = top; y <= bottom; y++) for (let u = x; u <= right; u++) count += Number(rows[y]?.[u] === endpoint.color);
  return count >= width(endpoint.box) * height(endpoint.box) / 2;
}

function endpointKey(rows: NativeRows, endpoint: Endpoint): boolean {
  const [x, y] = center(endpoint.button);
  return rows[endpoint.button[1] - 1]?.[x] !== rows[y]?.[Math.min(rows[0]!.length - 1, endpoint.button[2] + 2)];
}

function choose(local: State, rows: NativeRows, controlled: NativeBox): Choice | null {
  const { scene, selected } = local;
  const ready = scene.endpoints.map(endpoint => placed(rows, endpoint));
  const [x] = center(controlled);
  const pending = scene.endpoints.map((_, i) => i).filter(i => !ready[i])
    .sort((a, b) => Math.abs(scene.endpoints[a]!.point[0] - x) - Math.abs(scene.endpoints[b]!.point[0] - x))[0];
  if (pending !== undefined) {
    const endpoint = scene.endpoints[pending]!;
    if (selected !== pending) return { kind: 'select', input: 'ACTION6', point: center(endpoint.button),
      target: endpoint.button, index: pending, reason: 'Select the control symbol for the unlinked opening' };
    return { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
      reason: 'Test placing this symbol on the visible opening' };
  }
  const [gx] = center(scene.goal);
  const [left, right] = scene.endpoints;
  const near = Math.abs(left!.point[0] - x) < Math.abs(right!.point[0] - x) ? 0 : 1;
  const goalSide = Math.abs(left!.point[0] - gx) < Math.abs(right!.point[0] - gx) ? 0 : 1;
  const target = near === goalSide ? scene.goal : scene.endpoints[near]!.box;
  const direction = Math.sign(center(target)[0] - x);
  if (!direction) return null;
  return { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', direction, target, index: near,
    reason: near === goalSide ? 'Approach the exit from the linked side' : 'Test passage through the linked opening' };
}

function relayChoice(local: State, rows: NativeRows, controlled: NativeBox): Choice | null {
  const { scene } = local, relay = scene.relay!, leg = local.leg ?? 0;
  const traveled = leg ? relay[leg - 1] : null, next = relay[leg];
  if (traveled && controlled[3] + scene.footGap! < traveled.floor) {
    const [l, , r] = traveled.arrival;
    return { kind: 'settle', input: 'ACTION2', index: 0, target: [l, traveled.floor - 1, r, traveled.floor - 1],
      reason: 'Observe where the sprite lands after emerging from the linked opening' };
  }
  if (next) {
    if (!contains(next.departure, center(controlled))) return null;
    const pending = next.pair.findIndex(endpoint => !placed(rows, endpoint));
    if (pending >= 0) {
      const endpoint = next.pair[pending]!;
      if (local.selected !== pending) return { kind: 'select', input: 'ACTION6', point: center(endpoint.button),
        target: endpoint.button, index: pending, reason: 'Select the control used for the next linked opening' };
      return { kind: 'place', input: 'ACTION6', point: endpoint.point, target: endpoint.box, index: pending,
        reason: leg ? 'Test a replacement link from the newly accessible platform' : 'Link the departure side to the platform above the next opening' };
    }
  }
  const target = next?.pair[0].box ?? scene.goal;
  const direction = Math.sign(center(target)[0] - center(controlled)[0]);
  if (!direction) return null;
  return { kind: 'walk', input: direction < 0 ? 'ACTION3' : 'ACTION4', target, direction, index: 0,
    reason: next ? 'Approach the entrance of the current link and verify the transfer' : 'Approach the exit after landing' };
}

function relayReturn({ local, choice, actor: first }: Proposal, before: NativeRows, after: NativeRows): string | null {
  const { scene } = local, leg = local.leg ?? 0, relay = scene.relay!, next = relay[leg];
  const second = actor(geometricComponents(after), scene);
  if (!second) return null;
  if ((choice.kind === 'select' || choice.kind === 'place') && next) {
    const selected = next.pair[choice.index]!, peer = next.pair[1 - choice.index]!;
    if (!sameBounds(first, second)) return null;
    if (choice.kind === 'select') return endpointKey(after, selected) && !endpointKey(after, peer)
      ? 'control_selection_observed' : null;
    return !placed(before, selected) && placed(after, selected) && placed(before, peer) === placed(after, peer)
      ? 'opening_symbol_observed' : null;
  }
  if (choice.kind === 'settle') {
    const last = relay[leg - 1];
    return last && contains(last.arrival, center(second)) && second[3] > first[3] && second[3] + scene.footGap! <= last.floor
      ? 'fall_toward_supported_pose_observed' : null;
  }
  if (choice.kind !== 'walk') return null;
  if (next && contains(next.departure, center(first)) && contains(next.arrival, center(second))) return 'linked_crossing_observed';
  const context = next?.departure ?? relay[1].arrival;
  return contains(context, center(second)) && Math.sign(center(second)[0] - center(first)[0]) === choice.direction
    ? 'approach_displacement_observed' : null;
}

function checked({ local, choice, actor: first }: Proposal, before: NativeRows, after: NativeRows): string | null {
  const endpoint = local.scene.endpoints[choice.index]!;
  if (choice.kind === 'select') {
    const other = local.scene.endpoints[1 - choice.index]!;
    if (endpointKey(after, endpoint) && !endpointKey(after, other)) return 'control_selection_observed';
    return null;
  }
  if (choice.kind === 'place') return !placed(before, endpoint) && placed(after, endpoint) ? 'opening_symbol_observed' : null;
  const second = actor(geometricComponents(after), local.scene);
  if (!second) return null;
  const [x0] = center(first), [x1] = center(second), dx = x1 - x0;
  const other = local.scene.endpoints[1 - choice.index]!;
  const separation = Math.abs(endpoint.point[0] - other.point[0]);
  if (Math.abs(dx) > separation / 2 && Math.abs(x1 - other.point[0]) < separation / 4) return 'linked_crossing_observed';
  return Math.sign(dx) === choice.direction ? 'approach_displacement_observed' : null;
}

export function createSicLinkOpenings(family = linkOpeningsId): NativeFamily<Proposal> {
  const learns = family === learnLinkOpeningsId;
  let state: State | null = null;
  let retained: PriorLink | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(id => observation.available_action_refs.includes(id))) return null;
      const parts = geometricComponents(rows);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const transfer = retained?.completed === observation.levels_completed ? retained : null;
      const scene = prior?.scene ?? discover(parts, rows) ?? (transfer ? discoverRelay(parts, rows, transfer.scene) : null);
      if (!scene) return null;
      const setup = scene.endpoints.map(endpoint => endpointKey(rows, endpoint));
      const selectedIndex = setup.filter(Boolean).length === 1 ? setup.indexOf(true) : null;
      const local: State = prior ?? { epoch: observation.level_epoch, scene, selected: selectedIndex,
        refs: scene.relay && transfer ? [transfer.proof] : [], walkRef: null, crossed: false, rejected: [] };
      const controlled = actor(parts, scene);
      if (!controlled) return null;
      const choice = scene.relay ? relayChoice(local, rows, controlled) : choose(local, rows, controlled);
      if (!choice || !observation.available_action_refs.includes(choice.input)) return null;
      const attempt = JSON.stringify([choice.kind, choice.index, choice.input, controlled, local.selected, ...(scene.relay ? [local.leg ?? 0] : [])]);
      if (local.rejected.includes(attempt)) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: choice.input, expected: center(choice.target), evidence };
      const reuse = choice.kind === 'walk' && local.walkRef !== null;
      const crossing = reuse && choice.target !== scene.goal && (scene.relay ? (local.leg ?? 0) < scene.relay.length : !local.crossed);
      const routeSupported = reuse && !crossing || choice.kind === 'settle' && !!local.settleRef;
      const facts = { eligibleProbe: !routeSupported, routeSupported, knownInteraction: false, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({ mode, evidence,
        probe: routeSupported ? null : offer, access: routeSupported ? offer : null, interaction: null });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== (routeSupported ? 'P07' : 'P05')) return null;
      const witness = choice.point ? await ObservedInputDomain.makeLocusWitness(observation, rows, choice.point, { reason: choice.reason, evidence }) : null;
      if (choice.point && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: scene.relay ? 'replace_links_along_the_route_to_exit' : 'link_opposite_openings_to_reach_exit', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['visible_openings', 'control_symbols', 'actor', 'exit'], parentObjective: parent, satisfactionContract: 'official_progress_after_crossing' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = linkOpeningsId + ':' + need.id;
      const action: NativeCommand = { action_ref: choice.input, data: choice.point ? { x: choice.point[0], y: choice.point[1] } : {} };
      return {
        status: 'proposed', kind: family, local, choice, actor: controlled, needId: need.id, attempt,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.target, ...(witness ? { point_binding: witness } : {}) }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: scene.relay ? 'Link each reachable compartment on the way to the exit' : 'Link the two openings and reach the exit', situation: choice.reason, evidence,
          agenda: navigation?.entries ?? [], mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: controlled, target: choice.target, exit: scene.goal,
          openings: (scene.relay?.flatMap(leg => leg.pair) ?? scene.endpoints).map(endpoint => endpoint.box) },
        question: { reason: choice.reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: choice.reason, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: choice.reason,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'opening_action_bound' : 'opening_layout_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const reason = proposal.local.scene.relay ? relayReturn(proposal, first, second) : checked(proposal, first, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'opening_effect_not_confirmed' };
    },
    record(before, after, _action, first, second, proposal) {
      const { local, choice } = proposal;
      if (after.levels_completed > before.levels_completed) {
        if (!local.scene.relay && local.crossed && local.walkRef) retained = {
          completed: after.levels_completed, scene: local.scene, proof: after.observation_ref,
        };
        return { events: [] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const reason = local.scene.relay ? relayReturn(proposal, first, second) : checked(proposal, first, second);
      state = { ...local,
        selected: reason && choice.kind === 'select' ? choice.index : local.selected,
        walkRef: reason && choice.kind === 'walk' ? after.observation_ref : local.walkRef,
        crossed: local.crossed || reason === 'linked_crossing_observed',
        ...(local.scene.relay && reason === 'linked_crossing_observed' ? { leg: (local.leg ?? 0) + 1 } : {}),
        ...(choice.kind === 'settle' && reason ? { settleRef: after.observation_ref } : {}),
        refs: reason ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reason ? local.rejected : [...local.rejected, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state, retained }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      retained = structuredClone((value.retained as PriorLink | undefined) ?? null);
    },
  };
}
