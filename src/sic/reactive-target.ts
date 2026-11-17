import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';
import { planPursuit, projectPursuit, pursuitDirections, pursuitStateKey, pursuitTrialKey, readPursuitState,
  type PursuitDirection, type PursuitMove, type PursuitRoles, type PursuitState } from './pursuit-forecast.ts';
import { gripStateMatches, gripTrialKey, planGrippedPursuit, readGripState, type GripLeg, type GripState, type GripTerrain } from './gripped-pursuit.ts';

export const reactiveTargetId = 'sic_reactive_target';
export const verifyReactiveMotionId = 'sic_verify_reactive_motion';
export const learnReactiveMotionId = 'sic_learn_reactive_motion';

const inputs = pursuitDirections;
type Input = typeof inputs[number][0];
type Direction = PursuitDirection;
type Part = ReturnType<typeof geometricComponents>[number];
type Layout = { actor: number; peer: number; goals: NativePoint[]; cells: Record<string, boolean>; pitch: number; size: number; bounds: NativeBox;
  grip?: GripTerrain };
type Pair = { actor: NativePoint; peer: NativePoint };
type Return = Pair & { evidence: string };
type Hypothesis = { order: Direction[]; matches: number };
type Memory = { epoch: number; layout: Layout; edges: Record<string, Return>; visits: Record<string, number>;
  hypotheses: Hypothesis[]; refs: string[]; count: number };
type Plan = { input: Input; target: Pair; condition: 'contact' | 'route' | 'probe' };
type Leg = { from: Pair; plan: Plan; previous: Leg | null };
type Calibration = { epoch: number; roles: PursuitRoles; orders: Direction[][]; pushRef: string | null };
type PursuitWitness = { epoch: number; score: number; roles: PursuitRoles; order: Direction[]; refs: string[] };
type PursuitMemory = { epoch: number; layout: Layout; rejected: string[]; refs: string[]; verified: boolean; blocked: boolean };
type CrowdPlan = { local: PursuitMemory; current: PursuitState; move: PursuitMove; obstacle: number };
type GripMemory = { epoch: number; terrain: GripTerrain; at?: GripState; heldInk?: number; refs: string[]; rejected: string[];
  plan: GripLeg[]; blocked: boolean };
type GripPlan = { local: GripMemory; observed: GripState; legs: GripLeg[] };
type Proposal = NativeProposal & ({ local: Memory; at: Pair; plan: Plan; needId: string; crowd?: never; grip?: never;
  walk?: { from: Pair; plan: Plan; predicted: PursuitState }[]; obstacle?: number }
  | { crowd: CrowdPlan; needId: string; grip?: never } | { grip: GripPlan; needId: string; crowd?: never });
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

function layoutFor(rows: NativeRows, parts: Part[], roles?: PursuitRoles, withWalls = false): Layout | null {
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
      const obstacles = roles ? groups.get(roles.obstacle) : others[0];
      if (!obstacles || obstacles.length < 3) continue;
      const indicators = parts.filter(p => p.bbox[1] > bottom && width(p.bbox) === size && height(p.bbox) === size - 1);
      const wallCandidates = new Map<number, NativePoint[]>();
      if (withWalls && roles) {
        for (const tag of indicators) if (tag.area === size * (size - 1) && ![roles.actor, roles.obstacle, board.color].includes(tag.color)) {
          wallCandidates.set(tag.color, []);
        }
        for (let y = top + 1; y < bottom; y += pitch) for (let x = left + 1; x < right; x += pitch) {
          const ink = rows[y]![x]!, sites = wallCandidates.get(ink);
          if (sites && rows.slice(y, y + size).every(row => row.slice(x, x + size).every(value => value === ink))) sites.push([x, y]);
        }
      }
      const walls = [...wallCandidates].filter(([, sites]) => sites.length > obstacles.length);
      if (withWalls ? walls.length !== 1 : !roles ? single.length !== 2 || others.length !== 1 : !groups.get(roles.peer)?.length || groups.size !== 3) continue;
      const actors = single.filter(p => (!roles || p.color === roles.actor)
        && indicators.some(tag => tag.color === p.color && tag.area === size * (size - 1)));
      if (actors.length !== 1) continue;
      const actor = actors[0]!, candidatesForPeer = single.filter(p => p !== actor && p.color !== walls[0]?.[0]);
      if (withWalls && candidatesForPeer.length !== 1) continue;
      const peer = roles && !withWalls ? groups.get(roles.peer)![0]! : candidatesForPeer[0]!;
      const cells: Record<string, boolean> = {};
      for (let y = top + 1; y < bottom; y += pitch) {
        for (let x = left + 1; x < right; x += pitch) {
          if (withWalls || [rows[y - 1]?.[x], rows[y]?.[x - 1], rows[y + size]?.[x + size - 1], rows[y + size - 1]?.[x + size]]
            .every(value => value === board.color)) cells[key([x, y])] = true;
        }
      }
      if (!cells[key(point(actor.bbox))] || !cells[key(point(peer.bbox))] || Object.keys(cells).length > 128) continue;
      const fixed = walls[0]?.[1];
      if (fixed) for (const site of fixed) delete cells[key(site)];
      const grip = fixed ? { actor: actor.color, peer: peer.color, pitch, size, cells, fixed,
        obstacle: obstacles[0]!.color, wall: walls[0]![0], floor: board.color } : undefined;
      candidates.push({ actor: actor.color, peer: peer.color, pitch, size, bounds: board.bbox, cells,
        goals: obstacles.map(p => point(p.bbox)), ...(grip ? { grip } : {}) });
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

function choose(at: Pair, local: Memory): { first: Plan; tail: Leg } | null {
  const { layout, edges, visits, hypotheses } = local;
  const queue: { at: Pair; first: Plan | null; depth: number; previous: Leg | null }[] = [{ at, first: null, depth: 0, previous: null }];
  const seen = new Set([pairKey(at)]);
  let probe: { first: Plan; tail: Leg; score: number } | null = null;
  const order = hypotheses[0]!.order;
  for (const item of queue) {
    for (const d of inputs) {
      const input = d[0], actor = shift(item.at.actor, d, layout.pitch);
      if (!layout.cells[key(actor)]) continue;
      const returned = edges[edgeKey(item.at, input)];
      if (returned && same(returned.actor, item.at.actor)) continue;
      const contact = !returned && same(actor, item.at.peer);
      const target = returned ?? { actor, peer: contact ? item.at.peer : prediction(layout, actor, item.at.peer, order) };
      const plan: Plan = { input, target, condition: contact ? 'contact' : returned ? 'route' : 'probe' };
      const first = item.first ?? plan, tail: Leg = { from: item.at, plan, previous: item.previous };
      if (contact) return { first, tail };
      const k = pairKey(target);
      if (!returned && item.depth <= 3) {
        const score = item.depth * 7 + Math.min(20, (visits[k] ?? 0) * 5);
        if (!probe || score < probe.score) probe = { first, tail, score };
      }
      if (seen.has(k)) continue;
      seen.add(k);
      queue.push({ at: target, first, depth: item.depth + 1, previous: tail });
    }
  }
  return probe;
}

function fitReactiveReturns(local: Memory, input: Direction, first: NativeRows, second: NativeRows, ref: string,
  retained: Calibration | null): Calibration | null {
  const { layout } = local, [x, y] = layout.goals[0]!;
  const obstacle = retained?.roles.obstacle ?? first[y]?.[x];
  if (obstacle === undefined || obstacle === layout.actor || obstacle === layout.peer) return null;
  const roles = retained?.roles ?? { actor: layout.actor, peer: layout.peer, obstacle };
  const before = readPursuitState(first, layout, obstacle), after = readPursuitState(second, layout, obstacle);
  if (!before || !after || same(before.actor, after.actor) || before.peers.length !== 1 || after.peers.length !== 1) return retained;
  const actual = pursuitStateKey(after);
  const orders = (retained?.orders ?? permutations(inputs)).filter(order => {
    const forecast = projectPursuit(before, layout, input, order);
    return forecast && pursuitStateKey(forecast) === actual;
  });
  const pushed = before.obstacles.some(position => same(position, after.actor))
    && !after.obstacles.some(position => same(position, after.actor)) && before.obstacles.length === after.obstacles.length;
  return { epoch: local.epoch, roles, orders, pushRef: retained?.pushRef ?? (pushed && orders.length ? ref : null) };
}

export function createSicVerifyReactiveMotion(family = verifyReactiveMotionId): NativeFamily<Proposal> {
  let memory: Memory | null = null;
  let calibration: Calibration | null = null, witness: PursuitWitness | null = null, pursuit: PursuitMemory | null = null;
  let grip: GripMemory | null = null;
  let decide: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, available, remaining, execution) {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, available, remaining, execution);
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed) return null;
      const proposal = await this.propose(observation, rows, available, remaining, execution);
      return proposal?.crowd || proposal?.grip ? proposal : null;
    },
    async propose(observation, rows, _available, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !inputs.every(([ref]) => observation.available_action_refs.includes(ref))
        || observation.available_action_refs.includes('ACTION6')) return null;
      const parts = geometricComponents(rows);
      if (witness?.epoch === observation.level_epoch && witness.score === observation.levels_completed) {
        if (observation.available_action_refs.includes('ACTION5')) {
          const prior = grip?.epoch === observation.level_epoch ? grip : null;
          const hasActiveRoute = pursuit?.epoch === observation.level_epoch || memory?.epoch === observation.level_epoch;
          const terrain = prior?.terrain ?? (!hasActiveRoute ? layoutFor(rows, parts, witness.roles, true)?.grip : undefined);
          const observed = terrain && !prior?.blocked && (prior || terrain.peer !== witness.roles.peer)
            ? readGripState(rows, terrain, prior?.heldInk) : null;
          const cached = observed && prior?.at && prior.plan.length <= remaining && gripStateMatches(observed.state, prior.at) ? prior.plan : [];
          const legs = observed && terrain ? cached.length ? cached
            : planGrippedPursuit(observed.state, terrain, witness.order, new Set(prior?.rejected), remaining,
              () => execution?.signal?.aborted === true) : null;
          const step = legs?.[0];
          if (step && observed && terrain) {
            const local = prior ?? { epoch: observation.level_epoch, terrain, refs: witness.refs, rejected: [], plan: [], blocked: false };
            const ref = observation.observation_ref, mode = execution?.reasoningMode ?? 'solving';
            const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
            const toggle = step.input === 'ACTION5', knownInteraction = toggle && local.heldInk !== undefined;
            const facts = { routeSupported: !toggle, eligibleProbe: toggle && !knownInteraction, knownInteraction, mode };
            const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
            const strategy = toggle ? knownInteraction ? 'P02' : 'P05' : 'P07';
            if (decision?.result !== strategy) return null;
            const action = { action_ref: step.input, data: {} }, actions = [action], parent = 'G_official_completion';
            const situation = toggle ? observed.state.held ? 'Leave the carried stone in a position that restricts retreat'
              : 'Check whether the adjacent stone can move with the actor'
              : observed.state.held ? 'Move while checking both the actor and the carried stone against the walls'
                : 'Follow a route that accounts for the fleeing sprite and the movable stones';
            const objective = { kind: 'reach_reactive_target_with_transportable_obstacles', scope: ref.split(':revision:', 1)[0]!,
              subjects: ['controlled_sprite', 'moving_target', 'movable_obstacles'], parentObjective: parent,
              satisfactionContract: 'official_progress_after_checked_interception' };
            const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
            const id = 'gripped-pursuit:' + need.id;
            return { status: 'proposed', kind: family, actions, grip: { local, observed: observed.state, legs }, needId: need.id,
              binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: step.expected }],
              sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
                edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
              sicSituationCard: { strategy, need: 'Reach the fleeing sprite using the available space', situation, evidence, agenda: [], mode,
                triggerCard: chooseLanding, actor: box(observed.state.actor, terrain.size), step: box(step.expected.actor, terrain.size),
                movingTargets: observed.state.peers.map(peer => box(peer, terrain.size)),
                ...(observed.state.held ? { movedObstacle: box(observed.state.held, terrain.size) } : {}) },
              question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
              compositions: [{ id, observed: false, open_question: situation, relations: [`contributes_to:${parent}`] }],
              sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
              bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
                preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
          }
        }
        const inherited = witness, previous = pursuit?.epoch === observation.level_epoch ? pursuit : null;
        const layout = previous?.layout ?? layoutFor(rows, parts, inherited.roles);
        if (layout && !previous?.blocked) {
          const observed = readPursuitState(rows, layout, inherited.roles.obstacle);
          const planned = observed && (previous || observed.peers.length > 1)
            ? planPursuit(observed, layout, inherited.order, new Set(previous?.rejected), remaining) : null;
          if (observed && planned) {
            const local = previous ?? { epoch: observation.level_epoch, layout, rejected: [], refs: inherited.refs, verified: false, blocked: false };
            const ref = observation.observation_ref;
            const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
            const mode = execution?.reasoningMode ?? 'solving';
            const facts = { routeSupported: local.verified, eligibleProbe: !local.verified, knownInteraction: false, mode };
            const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
            const strategy = local.verified ? 'P07' : 'P05';
            if (decision?.result !== strategy) return null;
            const action = { action_ref: planned.input, data: {} }, actions = [action], parent = 'G_official_completion';
            const subject = observed.obstacles.find(obstacle => same(obstacle, planned.expected.actor));
            const situation = subject ? 'Move the obstacle and check the open route'
              : planned.contactIn === 1 ? 'Check the predicted contact and count the remaining sprites'
                : 'Follow the measured retreat pattern toward the next contact';
            const objective = { kind: 'reach_each_reactive_target', scope: ref.split(':revision:', 1)[0]!,
              subjects: ['controlled_sprite', 'moving_targets', 'movable_obstacles'], parentObjective: parent,
              satisfactionContract: 'verify_each_contact_and_official_progress' };
            const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
            const id = `pursuit:${need.id}`;
            return { status: 'proposed', kind: family, actions,
              crowd: { local, current: observed, move: planned, obstacle: inherited.roles.obstacle }, needId: need.id,
              binding: { observation_ref: ref, level_epoch: observation.level_epoch }, steps: [{ action, expected_after: planned.expected }],
              sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash, instructions: decision.receipt.instructions,
                edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts },
              sicSituationCard: { strategy, need: 'Reach the remaining moving sprites', situation, evidence, agenda: [], mode,
                triggerCard: chooseLanding, actor: box(observed.actor, layout.size), step: box(planned.expected.actor, layout.size),
                movingTargets: observed.peers.map(peer => box(peer, layout.size)), ...(subject ? { movedObstacle: box(subject, layout.size) } : {}) },
              question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
              compositions: [{ id, observed: false, open_question: situation, relations: [`contributes_to:${parent}`] }],
              sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
              bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
                preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
          }
        }
      }
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const learns = !prior && family === learnReactiveMotionId;
      const motion = learns ? execution?.readPriorDirectionalScene?.(earlier => {
        const measured = geometricComponents(earlier), layout = layoutFor(earlier, measured);
        const at = layout && positions(measured, layout);
        return layout && at ? { layout, at } : null;
      }) : null;
      if (learns && (!motion || motion.afterRef !== observation.observation_ref)) return null;
      const layout = prior?.layout ?? motion?.scene.layout ?? layoutFor(rows, parts);
      if (!layout || (prior?.count ?? 0) >= 100) return null;
      const at = positions(parts, layout);
      if (!at) return null;
      const measuredInput = motion && inputs.find(input => input[0] === motion.command);
      if (motion && (!measuredInput || !same(shift(motion.scene.at.actor, measuredInput, layout.pitch), at.actor)
        || same(motion.scene.at.peer, at.peer))) return null;
      const local: Memory = prior ?? { epoch: observation.level_epoch, layout,
        edges: motion && measuredInput ? { [edgeKey(motion.scene.at, measuredInput[0])]: { ...at, evidence: motion.afterRef } } : {},
        visits: motion ? { [pairKey(motion.scene.at)]: 1 } : {}, refs: motion ? [motion.beforeRef, motion.afterRef] : [],
        count: motion ? 1 : 0, hypotheses: permutations(inputs).map(order => ({ order,
          matches: Number(!!motion && same(prediction(layout, at.actor, motion.scene.at.peer, order), at.peer)) }))
          .sort((a, b) => b.matches - a.matches) };
      const selected = choose(at, local);
      let plan = selected?.first;
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
      const routeSupported = plan.condition === 'route';
      const facts = { routeSupported, eligibleProbe: !routeSupported, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'test_contact_with_reactive_target', scope: ref.split(':revision:', 1)[0]!, subjects: ['tracked_moving_sprite'],
        parentObjective: parent, satisfactionContract: 'official_progress_after_contact_with_tracked_sprite' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = verifyReactiveMotionId + ':' + need.id;
      const situation = plan.condition === 'contact' ? 'Test contact with the tracked sprite'
        : plan.condition === 'route' ? 'Reuse a measured movement of both sprites'
          : 'Test how the second sprite reacts to this move and update the route';
      const action = { action_ref: plan.input, data: {} };
      const legs: Leg[] = [];
      if (selected?.first === plan) {
        for (let leg: Leg | null = selected.tail; leg; leg = leg.previous) legs.push(leg);
        legs.reverse();
      }
      const training = calibration?.epoch === local.epoch ? calibration : null;
      const orders = training?.orders ?? [];
      const [goalX, goalY] = layout.goals[0]!;
      const obstacle = training?.roles.obstacle ?? rows[goalY]?.[goalX];
      const series: NonNullable<Extract<Proposal, { plan: Plan }>['walk']> = [];
      const best = local.hypotheses[0]?.matches ?? 0;
      const forecasts = orders.length ? orders
        : local.hypotheses.filter(hypothesis => hypothesis.matches === best).map(hypothesis => hypothesis.order);
      let projected = obstacle !== undefined && obstacle !== layout.actor && obstacle !== layout.peer
        ? readPursuitState(rows, layout, obstacle) : null;
      for (const leg of legs.slice(0, Math.min(remaining, maximumCommittedActions, 100 - local.count))) {
        if (!projected || leg.plan.condition === 'contact') break;
        const input = inputs.find(direction => direction[0] === leg.plan.input)!;
        const known = local.edges[edgeKey(leg.from, leg.plan.input)] || best >= 2;
        if (!known || projected.obstacles.some(site => same(site, leg.plan.target.actor))) break;
        const predicted = projectPursuit(projected, layout, input, forecasts[0]!);
        if (!predicted || predicted.peers.length !== 1 || !same(predicted.actor, leg.plan.target.actor)
          || !same(predicted.peers[0]!, leg.plan.target.peer) || forecasts.some(order => {
            const candidate = projectPursuit(projected!, layout, input, order);
            return !candidate || pursuitStateKey(candidate) !== pursuitStateKey(predicted);
          })) break;
        series.push({ from: leg.from, plan: leg.plan, predicted });
        projected = predicted;
      }
      const walk = series.length > 1 ? series : undefined;
      const actions = walk?.map(step => ({ action_ref: step.plan.input, data: {} })) ?? [action];
      return {
        status: 'proposed', kind: family, at, plan, local, needId: need.id,
        ...(walk ? { walk, obstacle } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps: actions.map((action, index) => ({ action, expected_after: walk?.[index]?.predicted ?? plan.target })),
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Reach a sprite that reacts to movement', situation, evidence, agenda: [], mode,
          triggerCard: chooseLanding, actor: box(at.actor, layout.size), focus: box(at.peer, layout.size), landing: box(plan.target.peer, layout.size) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      const previous = !proposal.crowd && !proposal.grip && proposal.walk?.[index - 1];
      const scene = previous && !proposal.crowd && !proposal.grip && proposal.obstacle !== undefined
        ? readPursuitState(packet.frame_rows, proposal.local.layout, proposal.obstacle) : null;
      const admitted = index === 0 ? proposal.binding?.observation_ref === observation.observation_ref
        : !!previous && !!scene && proposal.binding?.level_epoch === observation.level_epoch
          && pursuitStateKey(scene) === pursuitStateKey(previous.predicted);
      return { admitted, reason: admitted ? 'tracked_pair_move_bound' : 'tracked_pair_context_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.grip) {
        const { local, legs } = proposal.grip;
        const actual = readGripState(second, local.terrain, local.heldInk);
        const matched = !!actual && gripStateMatches(actual.state, legs[0]!.expected);
        return { matched, seal_prefix: true, reason: matched ? 'gripped_pursuit_forecast_confirmed' : 'gripped_pursuit_response_diverged_replan' };
      }
      if (proposal.crowd) {
        const { local, obstacle, move } = proposal.crowd;
        const actual = readPursuitState(second, local.layout, obstacle);
        const matched = !!actual && pursuitStateKey(actual) === pursuitStateKey(move.expected);
        return { matched, seal_prefix: true, reason: matched ? 'pursuit_forecast_confirmed' : 'pursuit_response_diverged_replan' };
      }
      const step = proposal.walk?.[index];
      if (step && proposal.obstacle !== undefined) {
        const actual = readPursuitState(second, proposal.local.layout, proposal.obstacle);
        const matched = !!actual && pursuitStateKey(actual) === pursuitStateKey(step.predicted);
        return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
          reason: matched ? 'pursuit_forecast_confirmed' : 'pursuit_response_diverged_replan' };
      }
      const actual = positions(geometricComponents(second), proposal.local.layout), expected = proposal.plan.target;
      const matched = !!actual && same(actual.actor, expected.actor) && same(actual.peer, expected.peer);
      return { matched, seal_prefix: true, reason: matched ? 'both_sprite_positions_confirmed' : 'sprite_response_diverged_replan' };
    },
    record(before, after, _action, first, second, proposal, index) {
      if (proposal.grip) {
        const { local, observed, legs } = proposal.grip, step = legs[0]!;
        if (after.levels_completed > before.levels_completed && witness && !step.expected.peers.length) {
          const { actor, peer, obstacle } = local.terrain;
          witness = { ...witness, epoch: after.level_epoch, score: after.levels_completed, roles: { actor, peer, obstacle },
            refs: [...local.refs.slice(-4), after.observation_ref] };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const actual = readGripState(second, local.terrain, local.heldInk);
        const matched = !!actual && gripStateMatches(actual.state, step.expected);
        const heldInk = actual?.heldInk ?? local.heldInk;
        grip = { ...local, ...(actual ? { at: actual.state } : {}), ...(heldInk === undefined ? {} : { heldInk }),
          plan: matched ? legs.slice(1) : [], blocked: !actual,
          refs: [...local.refs.slice(-4), after.observation_ref],
          rejected: matched ? local.rejected : [...local.rejected.slice(-31), gripTrialKey(observed, step.input)] };
        return { events: [], ...(matched && step.input === 'ACTION5' ? { reviewEvidence: step.expected.held
          ? 'The adjacent stone entered the carried state at the measured offset.' : 'The stone returned to its free state at the intended cell.' } : {}) };
      }
      if (proposal.crowd) {
        const { local, current, move, obstacle } = proposal.crowd;
        if (after.levels_completed > before.levels_completed && witness?.epoch === before.level_epoch
          && local.verified && move.expected.peers.length === 0) {
          witness = { ...witness, epoch: after.level_epoch, score: after.levels_completed,
            refs: [...local.refs.slice(-4), after.observation_ref] };
        }
        if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
        const actual = readPursuitState(second, local.layout, obstacle);
        const verified = !!actual && pursuitStateKey(actual) === pursuitStateKey(move.expected);
        const rejected = verified ? local.rejected : [...local.rejected.slice(-31), pursuitTrialKey(current, move.input)];
        pursuit = { ...local, verified, rejected, blocked: !actual, refs: [...local.refs.slice(-4), after.observation_ref] };
        return { events: [], ...(actual && actual.peers.length < current.peers.length ? { reviewEvidence: 'One tracked sprite disappeared on contact' } : {}) };
      }
      const leg = proposal.walk?.[index], at = leg?.from ?? proposal.at, plan = leg?.plan ?? proposal.plan;
      const local = index > 0 ? memory ?? proposal.local : proposal.local;
      const direction = inputs.find(input => input[0] === plan.input)!;
      const trained = calibration?.epoch === local.epoch ? calibration : null;
      if (after.levels_completed > before.levels_completed && trained?.orders.length === 1 && trained.pushRef
        && same(shift(at.actor, direction, local.layout.pitch), at.peer)) {
        witness = { epoch: after.level_epoch, score: after.levels_completed, roles: trained.roles, order: trained.orders[0]!,
          refs: [...new Set([trained.pushRef, ...local.refs.slice(-2), after.observation_ref])] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      calibration = fitReactiveReturns(local, direction, first, second, after.observation_ref, trained);
      const k = edgeKey(at, plan.input), stateKey = pairKey(at);
      const actual = positions(geometricComponents(second), local.layout);
      const trial = actual && !local.edges[k] && !same(at.actor, actual.actor) ? actual : null;
      const hypotheses = trial ? local.hypotheses.map(h => ({ ...h, matches: h.matches
        + Number(same(prediction(local.layout, trial.actor, at.peer, h.order), trial.peer)) })).sort((a, b) => b.matches - a.matches) : local.hypotheses;
      memory = { ...local, count: local.count + 1, visits: { ...local.visits, [stateKey]: (local.visits[stateKey] ?? 0) + 1 },
        refs: [...local.refs.slice(-4), after.observation_ref], hypotheses,
        edges: actual ? { ...local.edges, [k]: { ...actual, evidence: after.observation_ref } } : local.edges };
      return { events: [] };
    },
    state: () => ({ memory, calibration, witness, pursuit, grip }),
    restore(value: NativeRecord) {
      memory = structuredClone(value.memory as Memory | null);
      calibration = structuredClone((value.calibration as Calibration | null | undefined) ?? null);
      witness = structuredClone((value.witness as PursuitWitness | null | undefined) ?? null);
      pursuit = structuredClone((value.pursuit as PursuitMemory | null | undefined) ?? null);
      grip = structuredClone((value.grip as GripMemory | null | undefined) ?? null);
    },
  };
}
