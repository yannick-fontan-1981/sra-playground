import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { collectLightTiming, exposureMask, sampledExposureSites, searchLightTiming } from './lit-route-timing.ts';
import type { LightTiming } from './lit-route-timing.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const litRouteId = 'sic_lit_route';
export const learnLitRouteId = 'sic_learn_route_from_exposure';

type Scene = { actor: NativePoint; goal: NativePoint; stripe: [number, number]; tiles: Tile[]; walls: number; light: number;
  litBox: NativeBox | null; guards?: { ink: number; boxes: NativeBox[] } };
type Tile = { point: NativePoint; lit: number };
type Recovery = { failedSites: NativePoint[]; exposedSites: string[]; seeking: boolean };
type Memory = { epoch: number; refs: string[]; rejected: string[]; steps: number; recovery?: Recovery };
type Plan = { target: NativePoint; route: NativePoint[]; lit: number; toward: number; wait?: true; timed?: true; refuge?: true };
type Proposal = NativeProposal & { scene: Scene; plan: Plan; finish?: NativePoint[]; local: Memory; attempt: string; needId: string };
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

function measure(rows: NativeRows, prior: Scene | null, retainDuringPatrol = false): Scene | null {
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
    const obstructed = retainDuringPatrol && prior?.guards
      && tilePixels(rows, prior.goal).includes(prior.guards.ink);
    const goal = goals.length === 1 ? goals[0]! : !goals.length && obstructed ? prior!.goal : null;
    if (!goal || same(goal, actor)) continue;
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
    const guards = retainDuringPatrol && prior?.guards
      ? { ink: prior.guards.ink, boxes: bodies.filter(p => p.color === prior.guards!.ink).map(p => p.bbox) }
      : bodies.length >= 3 && bodies.every(p => p.color === bodies[0]!.color)
        ? { ink: bodies[0]!.color, boxes: bodies.map(p => p.bbox) } : null;
    candidates.push({ actor, goal, stripe, tiles, walls, light: lighting, litBox, ...(guards ? { guards } : {}) });
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

function nextRefuge(scene: Scene, recovery: Recovery): Plan | null {
  const { actor, goal } = scene, tiles = new Map(scene.tiles.map(tile => [key(tile.point), tile]));
  const exposed = new Set(recovery.exposedSites);
  const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  const candidates = [...paths(tiles, actor).values()].filter(path =>
    path.route.length && !path.lit && !same(path.point, goal) && !exposed.has(key(path.point))
    && !recovery.failedSites.some(site => same(site, path.point)));
  candidates.sort((a, b) => Number(recovery.failedSites.some(site => distance(a.point, site) <= pitch))
    - Number(recovery.failedSites.some(site => distance(b.point, site) <= pitch)) || a.route.length - b.route.length);
  const path = candidates[0];
  return path ? { target: path.point, route: path.route, lit: path.lit, toward: 0, refuge: true } : null;
}

function timingPlan(scene: Scene, local: Memory, timing: LightTiming | null, rows: NativeRows, remaining: number): Plan | null {
  if (!scene.guards || timing?.stopped || remaining < 2 && !timing?.period) return null;
  const { actor, guards } = scene;
  if (!timing?.period) {
    if (local.recovery?.seeking) return nextRefuge(scene, local.recovery);
    const [l, t, r, b] = box(actor), margin = pitch * 2;
    const clearStart = guards.boxes.every(([x, y, u, v]) => u + margin < l || x - margin > r || v + margin < t || y - margin > b)
      && scene.tiles.every(tile => !tile.lit || Math.abs(tile.point[0] - l) + Math.abs(tile.point[1] - t) > pitch);
    const arrivedAtRefuge = local.recovery && !local.recovery.seeking && scene.tiles.some(tile => same(tile.point, actor) && !tile.lit);
    return (timing || (!local.steps && clearStart) || arrivedAtRefuge) ? { target: actor, route: [], lit: 0, toward: 0, wait: true } : null;
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

export function createSicLitRoute(family = litRouteId, allowWitnessedTransient = false): NativeFamily<Proposal> {
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
      if ((prior?.steps ?? 0) >= (prior?.recovery ? 48 : 16)) return null;
      const scene = measure(rows, prior ? observation : null, !!(prior?.recovery && timing?.period));
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
      const actions = [action];
      const steps = [{ action, expected_after: plan.target, ...(witness ? { point_binding: witness } : {}) }];
      let finish: NativePoint[] | undefined;
      if (routeSupported && remaining > 1 && local.steps < 15 && !plan.wait && !plan.timed && !plan.refuge
        && !local.recovery && !scene.guards && !same(plan.target, scene.goal)
        && !local.rejected.includes(key(plan.target) + '/' + key(scene.goal))) {
        const tiles = new Map(scene.tiles.map(tile => [key(tile.point), tile]));
        finish = paths(tiles, plan.target).get(key(scene.goal))?.route;
        if (finish?.length) {
          const [x, y] = scene.goal, point: NativePoint = [x + 1, y + 1];
          const point_binding = await ObservedInputDomain.makeLocusWitness(before, rows, point,
            { reason: 'Exit at the end of the retained corridor, once every tile is confirmed unlit', evidence });
          const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
          actions.push(action);
          steps.push({ action, expected_after: scene.goal, point_binding });
        }
      }
      const situation = plan.wait ? (plan.timed ? 'Wait for the next measured safe crossing window' : 'Observe the patrols from the current stopping point')
        : plan.refuge ? 'Move to an unlit stopping point farther from the interrupted observation'
        : plan.timed ? `Cross during a safe window in the observed ${timing!.period}-frame patrol cycle`
        : same(plan.target, scene.goal) ? 'Take the route to the exit with the current corridor unlit'
        : 'Move to a stopping point with lower visible exposure and assess the new lighting';
      return {
        status: 'proposed', kind: family, local, scene, plan, attempt: key(scene.actor) + '/' + key(plan.target), needId: need.id,
        ...(finish?.length ? { finish } : {}),
        binding: { observation_ref: ref, level_epoch: before.level_epoch }, actions, steps,
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: 'Reach the exit past the changing light', situation, evidence, agenda: navigation?.entries ?? [],
          ...(plan.timed && timing?.transientEvidence ? { witnessedTransientCycle: true } : {}),
          mode, triggerCard: navigation?.card ?? decision?.receipt.workflow, actor: box(scene.actor), focus: box(plan.target),
          goal: box(scene.goal), light: scene.litBox, ...(scene.guards ? { patrols: scene.guards.boxes } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, before) {
      if (index === 1 && proposal.finish) {
        const scene = measure(packet.frame_rows, proposal.scene);
        const admitted = before.level_epoch === proposal.local.epoch && !!scene && !scene.guards
          && same(scene.actor, proposal.plan.target) && same(scene.goal, proposal.scene.goal)
          && proposal.finish.every(point => scene.tiles.some(tile => same(tile.point, point) && tile.lit === 0));
        return { admitted, reason: admitted ? 'retained_exit_corridor_is_unlit' : 'lit_route_observation_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === before.observation_ref;
      return { admitted, reason: admitted ? 'lit_route_action_bound' : 'lit_route_observation_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const origin = index === 0 ? proposal.scene.actor : proposal.plan.target;
      const target = index === 0 ? proposal.plan.target : proposal.scene.goal;
      const actor = stripes(second, proposal.scene.stripe, 0, origin);
      const matched = actor.length === 1 && same(actor[0]!, target);
      if (matched && proposal.plan.timed && timing) {
        const phase = checkedPhase(timing, proposal, second);
        return { matched: !!phase, seal_prefix: true, reason: phase ? 'patrol_phase_and_arrival_confirmed' : 'patrol_phase_prediction_contradicted' };
      }
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length, reason: matched
        ? proposal.plan.wait ? 'stationary_observation_returned' : 'safe_stopping_point_observed' : 'path_refused_or_interrupted' };
    },
    record(before, after, _action, first, second, proposal, index, frames) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const local = (index > 0 && memory?.epoch === before.level_epoch ? memory : null) ?? proposal.local;
      const scene = index === 0 ? proposal.scene : measure(first, proposal.scene) ?? { ...proposal.scene, actor: proposal.plan.target };
      const plan = index === 0 ? proposal.plan : { target: scene.goal, route: proposal.finish!, lit: 0, toward: 0 } as Plan;
      const actor = stripes(second, scene.stripe, 0, scene.actor);
      const reached = actor.length === 1 && same(actor[0]!, plan.target);
      const movedThroughAnimation = reached && frames.some(rows => stripes(rows, scene.stripe, 0)
        .some(p => !same(p, scene.actor) && !same(p, plan.target)));
      const clock = memory?.epoch === before.level_epoch ? timing : null;
      let timingObserved = false, recovery = local.recovery;
      if (scene.guards && plan.wait && !plan.timed) {
        const view = { ...scene, guardInk: scene.guards.ink };
        timing = reached ? collectLightTiming(clock, first, second, frames, view, pitch, allowWitnessedTransient) : null;
        timingObserved = timing !== null;
        if (!timing && (clock || frames.length > 0)) {
          const samples = [...(clock?.samples ?? []), ...frames.filter(rows => rows[1]?.[1] === scene.walls)
            .map(rows => exposureMask(rows, view, pitch))];
          const exposed = sampledExposureSites(samples, scene.tiles.map(tile => tile.point), first[0]!.length, pitch);
          recovery = { seeking: true, failedSites: [...(recovery?.failedSites ?? []), scene.actor],
            exposedSites: [...new Set([...(recovery?.exposedSites ?? []), ...exposed])] };
        }
      } else if (plan.timed && clock && reached) {
        timing = checkedPhase(clock, proposal, second);
        timingObserved = timing !== null;
      } else timing = null;
      if (plan.refuge && recovery) {
        recovery = { ...recovery, seeking: !reached, failedSites: reached ? recovery.failedSites : [...recovery.failedSites, plan.target] };
      }
      observation = scene;
      memory = { ...local, ...(recovery ? { recovery } : {}), steps: local.steps + 1,
        refs: movedThroughAnimation || timingObserved || recovery !== local.recovery ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: reached ? local.rejected : [...local.rejected, index === 0 ? proposal.attempt : key(scene.actor) + '/' + key(plan.target)] };
      if (plan.wait && !plan.timed && recovery?.seeking && recovery !== local.recovery) {
        return { events: [], reviewEvidence: 'The wait interrupted the sequence of patrol observations. Measure again from another stopping point.' };
      }
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
