import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { collectLightTiming, exposureMask, searchLightTiming } from './lit-route-timing.ts';
import type { LightTiming } from './lit-route-timing.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const litRouteId = 'sic_lit_route';
export const learnLitRouteId = 'sic_learn_route_from_exposure';

type Scene = { actor: NativePoint; goal: NativePoint; stripe: [number, number]; tiles: Tile[]; walls: number; light: number;
  litBox: NativeBox | null; guards?: { ink: number; boxes: NativeBox[] } };
type Tile = { point: NativePoint; lit: number };
type Memory = { epoch: number; refs: string[]; rejected: string[]; steps: number };
type Plan = { target: NativePoint; route: NativePoint[]; lit: number; toward: number; wait?: true; timed?: true };
type Proposal = NativeProposal & { scene: Scene; plan: Plan; local: Memory; attempt: string; needId: string };
const pitch = 4;
const offsets = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const box = ([x, y]: NativePoint): NativeBox => [x, y, x + pitch - 1, y + pitch - 1];

function tilePixels(rows: NativeRows, [x, y]: NativePoint) {
  return rows.slice(y, y + pitch).flatMap(row => row.slice(x, x + pitch));
}

function stripes(rows: NativeRows, colors: [number, number], axis: 0 | 1, phase?: NativePoint): NativePoint[] {
  const matches: NativePoint[] = [];
  const top = phase ? phase[1] % pitch : 0;
  const left = phase ? phase[0] % pitch : 0;
  const step = phase ? pitch : 1;
  const r = rows[0]?.length ?? 0, b = rows.length - pitch;
  for (let y = top; y + pitch <= b; y += step) {
    for (let x = left; x + pitch <= r; x += step) {
      if (rows[y]![x] !== colors[0]) continue;
      if (tilePixels(rows, [x, y]).every((c, i) => c === colors[(axis === 0 ? Math.floor(i / pitch) : i % pitch) % 2])) matches.push([x, y]);
    }
  }
  return matches;
}

function measure(rows: NativeRows, prior: Scene | null): Scene | null {
  const parts = geometricComponents(rows);
  const near = (part: typeof parts[number]) => part.area === pitch && part.bbox[3] < rows.length - pitch;
  const horizontal = parts.filter(p => near(p) && p.bbox[3] === p.bbox[1] && p.bbox[2] - p.bbox[0] === pitch - 1);
  const wall = parts.find(p => p.bbox[0] === 0 && p.bbox[1] === 0 && p.bbox[2] === rows[0]!.length - 1
    && p.bbox[3] === rows.length - 1 && p.area > rows.length * rows[0]!.length / 5);
  if (!wall && !prior) return null;
  const colors = prior ? [prior.stripe] : [...new Map(horizontal.flatMap(p => {
    const [x, y] = p.bbox, c = rows[y + 1]?.[x];
    return c !== undefined && c !== p.color && c !== wall!.color ? [[p.color + '/' + c, [p.color, c] as [number, number]] as const] : [];
  })).values()];
  const candidates: Scene[] = [];
  for (const stripe of colors) {
    const actors = stripes(rows, stripe, 0, prior?.actor);
    if (actors.length !== 1) continue;
    const actor = actors[0]!;
    const goals = stripes(rows, stripe, 1, actor);
    if (goals.length !== 1 || same(goals[0]!, actor)) continue;
    const walls = prior?.walls ?? wall!.color;
    const lighting = prior?.light ?? parts.filter(p => p.color !== walls && !stripe.includes(p.color)
      && p.bbox[3] < rows.length - pitch && p.area > 20 && p.area < rows.length * rows[0]!.length / 3
      && p.bbox[2] - p.bbox[0] >= pitch * 2 && p.bbox[3] - p.bbox[1] >= pitch * 2).sort((a, b) => b.area - a.area)[0]?.color;
    if (lighting === undefined) continue;
    const tiles: Tile[] = [];
    for (let y = actor[1] % pitch; y + pitch <= rows.length - pitch; y += pitch) {
      for (let x = actor[0] % pitch; x + pitch <= rows[0]!.length; x += pitch) {
        const point: NativePoint = [x, y], pixels = tilePixels(rows, point);
        if (pixels.includes(walls)) continue;
        tiles.push({ point, lit: pixels.filter(c => c === lighting).length });
      }
    }
    const litBox = parts.filter(p => p.color === lighting && p.bbox[3] < rows.length - pitch)
      .sort((a, b) => b.area - a.area)[0]?.bbox ?? null;
    const bodies = parts.filter(p => p.area === 7 && p.bbox[3] < rows.length - pitch && p.bbox[2] - p.bbox[0] === 2
      && p.bbox[3] - p.bbox[1] === 2 && p.color !== walls && p.color !== lighting && !stripe.includes(p.color));
    const guards = bodies.length >= 3 && bodies.every(p => p.color === bodies[0]!.color)
      ? { ink: bodies[0]!.color, boxes: bodies.map(p => p.bbox) } : null;
    candidates.push({ actor, goal: goals[0]!, stripe, tiles, walls, light: lighting, litBox, ...(guards ? { guards } : {}) });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function paths(tiles: Map<string, Tile>, start: NativePoint) {
  const queue: { point: NativePoint; route: NativePoint[]; lit: number }[] = [{ point: start, route: [], lit: 0 }];
  const visited = new Map([[key(start), queue[0]!]]);
  for (const item of queue) {
    for (const [dx, dy] of offsets) {
      const point: NativePoint = [item.point[0] + dx * pitch, item.point[1] + dy * pitch];
      const k = key(point), tile = tiles.get(k);
      if (!tile || visited.has(k)) continue;
      const node = { point, route: [...item.route, point], lit: item.lit + tile.lit };
      visited.set(k, node);
      queue.push(node);
    }
  }
  return visited;
}

function choose(scene: Scene, rejected: readonly string[]): Plan | null {
  const tiles = new Map(scene.tiles.map(t => [key(t.point), t]));
  const from = paths(tiles, scene.actor), exit = from.get(key(scene.goal));
  if (!exit) return null;
  const to = paths(tiles, scene.goal);
  const available = (point: NativePoint) => !rejected.includes(key(scene.actor) + '/' + key(point));
  if (!exit.lit && available(scene.goal)) return { target: scene.goal, route: exit.route, lit: 0, toward: 0 };
  const viable = [...from.values()].flatMap(item => {
    const toward = to.get(key(item.point))?.route.length;
    if (toward === undefined || toward >= exit.route.length || !item.route.length || !available(item.point)) return [];
    return [{ target: item.point, route: item.route, lit: item.lit, toward }];
  });
  viable.sort((a, b) => a.lit - b.lit || a.toward - b.toward || a.route.length - b.route.length);
  return viable[0] ?? null;
}

function timingPlan(scene: Scene, local: Memory, timing: LightTiming | null, rows: NativeRows, remaining: number): Plan | null {
  if (!scene.guards || timing?.stopped || remaining < 2 && !timing?.period) return null;
  const { actor, guards } = scene;
  if (!timing?.period) {
    const [l, t, r, b] = box(actor), margin = pitch * 2;
    const clearStart = guards.boxes.every(([x, y, u, v]) => u + margin < l || x - margin > r || v + margin < t || y - margin > b)
      && scene.tiles.every(tile => !tile.lit || Math.abs(tile.point[0] - l) + Math.abs(tile.point[1] - t) > pitch);
    return (timing || (!local.steps && clearStart)) ? { target: actor, route: [], lit: 0, toward: 0, wait: true } : null;
  }
  const tiles = new Map(scene.tiles.map(t => [key(t.point), t]));
  const step = searchLightTiming(timing, { ...scene, guardInk: guards.ink }, pitch, rows[0]!.length,
    rows.length - pitch, start => paths(tiles, start), remaining);
  return step ? { target: step.point, route: step.route, lit: 0, toward: 0, timed: true, ...(step.wait ? { wait: true } : {}) } : null;
}

function checkedPhase(clock: LightTiming, { scene, plan }: Proposal, rows: NativeRows): LightTiming | null {
  if (!clock.period || !scene.guards) return null;
  const elapsed = clock.elapsed + (plan.wait ? clock.waitTicks : plan.route.length * pitch);
  return clock.samples[elapsed % clock.period] === exposureMask(rows, { ...scene, guardInk: scene.guards.ink }, pitch)
    ? { ...clock, elapsed } : null;
}

export function createSicLitRoute(family = litRouteId): NativeFamily<Proposal> {
  const learns = family === learnLitRouteId;
  let memory: Memory | null = null;
  let observation: Scene | null = null;
  let timing: LightTiming | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(before, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5', 'ACTION6'].every(ref => before.available_action_refs.includes(ref))
        || before.available_action_refs.some(ref => /^ACTION[1-4]$/.test(ref))) return null;
      const prior = memory?.epoch === before.level_epoch ? memory : null;
      if ((prior?.steps ?? 0) >= 16) return null;
      const scene = measure(rows, prior ? observation : null);
      if (!scene) return null;
      const local = prior ?? { epoch: before.level_epoch, refs: [], rejected: [], steps: 0 };
      const plan = timingPlan(scene, local, prior ? timing : null, rows, remaining) ?? choose(scene, local.rejected);
      if (!plan) return null;
      const ref = before.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const input = plan.wait ? 'ACTION5' : 'ACTION6';
      const offer = { input, expected: plan.target, evidence };
      const routeSupported = !!plan.timed || !plan.wait && local.refs.length > 0;
      const facts = { routeSupported, eligibleProbe: !routeSupported && plan.lit === 0, knownInteraction: false, mode };
      const decision = learns ? await decide?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({ mode, evidence, probe: routeSupported ? null : offer,
        access: routeSupported ? offer : null, interaction: null });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== 'P05' && strategy !== 'P07') return null;
      const [x, y] = plan.target, target: NativePoint = [x + 1, y + 1];
      const witness = plan.wait ? null : await ObservedInputDomain.makeLocusWitness(before, rows, target, { reason: 'Reachable stopping tile outside the visible light', evidence });
      if (!plan.wait && !witness) return null;

      const parent = 'G_official_completion';
      const objective = { kind: 'reach_exit_using_current_illumination', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(scene.goal)], parentObjective: parent, satisfactionContract: 'official_progress_after_safe_traversal' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = litRouteId + ':' + need.id;
      const action: NativeCommand = { action_ref: input, data: plan.wait ? {} : { x: target[0], y: target[1] } };
      const situation = plan.wait ? (plan.timed ? 'Wait for the next measured safe crossing window' : 'Observe the patrols from the current stopping point')
        : plan.timed ? `Cross during a safe window in the observed ${timing!.period}-frame patrol cycle`
        : same(plan.target, scene.goal) ? 'Take the route to the exit with the current corridor unlit'
        : 'Move to a stopping point with lower visible exposure and assess the new lighting';
      return {
        status: 'proposed', kind: family, local, scene, plan, attempt: key(scene.actor) + '/' + key(plan.target), needId: need.id,
        binding: { observation_ref: ref, level_epoch: before.level_epoch }, actions: [action],
        steps: [{ action, expected_after: plan.target, ...(witness ? { point_binding: witness } : {}) }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Reach the exit past the changing light', situation, evidence, agenda: navigation?.entries ?? [],
          mode, triggerCard: navigation?.card ?? decision?.receipt.workflow, actor: box(scene.actor), focus: box(plan.target),
          goal: box(scene.goal), light: scene.litBox, ...(scene.guards ? { patrols: scene.guards.boxes } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, before) {
      const admitted = index === 0 && proposal.binding?.observation_ref === before.observation_ref;
      return { admitted, reason: admitted ? 'lit_route_action_bound' : 'lit_route_observation_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const actor = stripes(second, proposal.scene.stripe, 0, proposal.scene.actor);
      const matched = actor.length === 1 && same(actor[0]!, proposal.plan.target);
      if (matched && proposal.plan.timed && timing) {
        const phase = checkedPhase(timing, proposal, second);
        return { matched: !!phase, seal_prefix: true, reason: phase ? 'patrol_phase_and_arrival_confirmed' : 'patrol_phase_prediction_contradicted' };
      }
      return { matched, seal_prefix: true, reason: matched
        ? proposal.plan.wait ? 'stationary_observation_returned' : 'safe_stopping_point_observed' : 'path_refused_or_interrupted' };
    },
    record(before, after, _action, first, second, proposal, _index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const actor = stripes(second, proposal.scene.stripe, 0, proposal.scene.actor);
      const reached = actor.length === 1 && same(actor[0]!, proposal.plan.target);
      const movedThroughAnimation = reached && frames.some(rows => stripes(rows, proposal.scene.stripe, 0)
        .some(p => !same(p, proposal.scene.actor) && !same(p, proposal.plan.target)));
      const { local } = proposal;
      const { scene, plan } = proposal;
      const clock = memory?.epoch === before.level_epoch ? timing : null;
      let timingObserved = false;
      if (scene.guards && plan.wait && !plan.timed && reached) {
        timing = collectLightTiming(clock, first, second, frames, { ...scene, guardInk: scene.guards.ink }, pitch);
        timingObserved = timing !== null;
      } else if (plan.timed && clock && reached) {
        timing = checkedPhase(clock, proposal, second);
        timingObserved = timing !== null;
      } else timing = null;
      observation = proposal.scene;
      memory = { ...local, steps: local.steps + 1, refs: movedThroughAnimation || timingObserved ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reached ? local.rejected : [...local.rejected, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ memory, observation, timing }),
    restore(value: NativeRecord) {
      memory = structuredClone(value.memory as Memory | null);
      observation = structuredClone(value.observation as Scene | null);
      timing = structuredClone((value.timing as LightTiming | undefined) ?? null);
    },
  };
}
