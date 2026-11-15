import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { searchCoverageRoute } from './coverage-route.ts';

export const highlightedRouteId = 'sic_highlighted_route';
export const learnHighlightedRouteId = 'sic_learn_highlighted_route';

type Part = ReturnType<typeof geometricComponents>[number];
type Tile = { box: NativeBox; point: NativePoint; color: number };
type Scene = { actor: Tile; goal: Tile; tiles: Tile[]; moves: Tile[]; offsets: NativePoint; seals?: Tile[] };
type JumpModel = { completed: number; side: number; actorArea: number; goalArea: number; ground: number; highlight: number;
  offsets: NativePoint; ref: string };
type Collection = { goals: NativePoint[]; verified: string[]; provisional: string | null };
type Memory = { epoch: number; ground: number; highlight: number; evidence: string[]; blocked: string[]; collection?: Collection };
type Proposal = NativeProposal & { scene: Scene; target: Tile; memory: Memory; attempt: string; needId: string };

const boxWidth = ([left, , right]: NativeBox) => right - left + 1;
const boxHeight = ([, top, , bottom]: NativeBox) => bottom - top + 1;
const center = ([left, top, right, bottom]: NativeBox): NativePoint => [Math.ceil((left + right) / 2), Math.ceil((top + bottom) / 2)];
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const key = (point: NativePoint) => point.join(',');
const aligned = (tile: Tile, origin: Tile, pitch: number) =>
  (tile.point[0] - origin.point[0]) % pitch === 0 && (tile.point[1] - origin.point[1]) % pitch === 0;
const asTile = (part: Part): Tile => ({ box: part.bbox, point: center(part.bbox), color: part.color });

function displacement(a: { point: NativePoint }, b: { point: NativePoint }): NativePoint {
  const dx = Math.abs(a.point[0] - b.point[0]), dy = Math.abs(a.point[1] - b.point[1]);
  return [Math.min(dx, dy), Math.max(dx, dy)];
}

function hasCenteredInset(part: Part, parts: Part[]): boolean {
  const [left, top, right, bottom] = part.bbox;
  return parts.some(other => {
    const [l, t, r, b] = other.bbox;
    return l > left && t > top && r < right && b < bottom
      && l + r === left + right && t + b === top + bottom;
  });
}

function measure(rows: NativeRows, memory: Memory | null): { scene: Scene; ground: number; highlight: number } | null {
  const parts = geometricComponents(rows);
  const distinct = (p: Part) => boxWidth(p.bbox) === boxHeight(p.bbox) && boxWidth(p.bbox) >= 4
    && p.area > boxWidth(p.bbox) && p.area < boxWidth(p.bbox) ** 2;
  const fixtures = parts.filter(distinct);
  const candidates = [];
  for (const goalPart of fixtures.filter(part => hasCenteredInset(part, parts))) {
    const goal = asTile(goalPart);
    const side = boxWidth(goal.box), pitch = side + 1;
    const solid = parts.filter(p => boxWidth(p.bbox) === side && boxHeight(p.bbox) === side && p.area === side * side)
      .map(asTile).filter(p => aligned(p, goal, pitch));
    const groundOptions = fixtures.filter(p => p !== goalPart && boxWidth(p.bbox) === side
      && !hasCenteredInset(p, parts) && aligned(asTile(p), goal, pitch) && (memory ? memory.ground === p.color : goal.color === p.color));
    if (groundOptions.length !== 1) continue;
    const actor = asTile(groundOptions[0]!), ground = actor.color;
    if (solid.filter(p => p.color === ground).length < 5) continue;
    const highlightOptions = memory ? [memory.highlight] : [...new Set(solid.flatMap(p => p.color === ground ? [] : [p.color]))];
    for (const highlight of highlightOptions) {
      const moves = solid.filter(p => p.color === highlight);
      if (goal.color === highlight) moves.push(goal);
      if (moves.length < (memory ? 1 : 2) || moves.length > 8) continue;
      const offsets = displacement(actor, moves[0]!);
      if (!offsets[0] || offsets[0] === offsets[1] || moves.some(p => !same(displacement(actor, p), offsets))) continue;
      const tiles = [...solid.filter(p => p.color === ground || p.color === highlight), actor, goal];
      if (tiles.length > 100 || tiles.some(p => p !== actor && same(displacement(actor, p), offsets) !== moves.includes(p))) continue;
      candidates.push({ scene: { actor, goal, tiles, moves, offsets }, ground, highlight });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function measureCollection(rows: NativeRows, model: JumpModel, collection?: Collection): Scene | null {
  const { side, ground, highlight, actorArea, goalArea, offsets } = model;
  const parts = geometricComponents(rows), pitch = side + 1;
  const tiles = parts.filter(p => (p.color === ground || p.color === highlight) && boxWidth(p.bbox) === side && boxHeight(p.bbox) === side);
  const actors = tiles.filter(part => part.area === actorArea && part.color === ground && !hasCenteredInset(part, parts));
  if (actors.length !== 1) return null;
  const actor = asTile(actors[0]!);
  const onGrid = tiles.filter(part => aligned(asTile(part), actor, pitch));
  const goals = onGrid.filter(part => part.area === goalArea && hasCenteredInset(part, parts));
  if (goals.length !== 1) return null;
  const goal = asTile(goals[0]!);
  const groups = new Map<string, Tile[]>();
  for (const seal of onGrid) {
    if (seal.area === actorArea || seal.area === goalArea || seal.area === side * side) continue;
    const [l, t, r, b] = seal.bbox;
    const inset = parts.filter(p => p.color !== ground && p.color !== highlight && p.bbox[0] === l + 1
      && p.bbox[1] === t + 1 && p.bbox[2] === r && p.bbox[3] === b && p.area > side && p.area < (side - 1) ** 2);
    if (inset.length !== 1) continue;
    const signature = inset[0]!.mask.map(key).join('/');
    const matching = groups.get(signature) ?? [];
    matching.push(asTile(seal));
    groups.set(signature, matching);
  }
  const possible = [...groups.values()].filter(group => collection
    ? group.every(seal => collection.goals.some(point => same(point, seal.point)))
    : group.length >= 2 && group.length <= 6);
  if (possible.length > 1 || (!collection && possible.length !== 1)) return null;
  const seals = possible[0] ?? [];
  const plain = onGrid.filter(part => part.area === side * side).map(asTile);
  if (plain.length < 5) return null;
  const all = [...plain, ...seals, actor, goal];
  const moves = all.filter(tile => tile.color === highlight);
  if (moves.length < 1 || moves.length > 8 || moves.some(tile => !same(displacement(actor, tile), offsets))) return null;
  return { actor, goal, tiles: all, moves, offsets, seals };
}

function routeToSeals(scene: Scene, collection: Collection, memory: Memory): Tile | null {
  const { actor, goal, tiles, offsets, moves } = scene;
  const bits = new Map(collection.goals.map((point, i) => [key(point), 1 << i]));
  const acquired = [...collection.verified, collection.provisional].reduce((mask, position) => mask | (position ? bits.get(position) ?? 0 : 0), 0);
  const route = searchCoverageRoute<Tile>(actor.point, goal.point, acquired, (1 << collection.goals.length) - 1, function* (point, first) {
    const source = { point };
    for (const tile of tiles) {
      if (!same(displacement(source, tile), offsets)
        || (first && (!moves.includes(tile) || memory.blocked.includes([key(point), key(tile.point), key(offsets)].join('/'))))) continue;
      yield { point: tile.point, visits: bits.get(key(tile.point)) ?? 0, step: tile };
    }
  });
  return route?.[0] ?? null;
}

function assessCollection(proposal: Proposal, next: Scene): { collection: Collection; reason: string } | null {
  const previous = proposal.memory.collection;
  if (!previous || !next.seals) return null;
  const target = key(next.actor.point), stillVisible = new Set(next.seals.map(seal => key(seal.point)));
  const remaining = proposal.scene.seals ?? [];
  if (remaining.some(seal => key(seal.point) !== target && !stillVisible.has(key(seal.point)))) return null;
  if (remaining.some(seal => key(seal.point) === target) && stillVisible.has(target)) return null;
  const verified = previous.verified.filter(position => !stillVisible.has(position));
  const departed = previous.provisional && previous.provisional !== target ? previous.provisional : null;
  if (departed && !stillVisible.has(departed)) verified.push(departed);
  const tookSeal = remaining.some(seal => key(seal.point) === target) && !stillVisible.has(target);
  return { collection: { ...previous, verified, provisional: tookSeal ? target : null },
    reason: tookSeal ? 'seal_absent_after_landing_pending_departure' : departed && stillVisible.has(departed) ? 'seal_returned_after_departure'
      : departed ? 'seal_collection_persists_after_departure' : 'landing_and_next_highlights_confirmed' };
}

function distances(scene: Scene): Map<Tile, number> {
  const reachable = new Map([[scene.goal, 0]]);
  const queue = [scene.goal];
  // The offsets give a candidate graph. Only currently highlighted edges can be executed.
  for (const tile of queue) {
    for (const other of scene.tiles) {
      if (reachable.has(other) || !same(displacement(tile, other), scene.offsets)) continue;
      reachable.set(other, reachable.get(tile)! + 1);
      queue.push(other);
    }
  }
  return reachable;
}

export function createSicHighlightedRoute(family = highlightedRouteId): NativeFamily<Proposal> {
  const learns = family === learnHighlightedRouteId;
  let state: Memory | null = null;
  let known: JumpModel | null = null;
  let choose: NativeProgramHandle | undefined;
  return {
    id: family,
    async attachPrograms(registry) {
      if (learns) choose = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(action => /^ACTION[1-5]$/.test(action))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const reusable = known?.completed === observation.levels_completed ? known : null;
      const collectionScene = reusable ? measureCollection(rows, reusable, prior?.collection) : null;
      const measured = collectionScene && reusable ? { scene: collectionScene, ground: reusable.ground, highlight: reusable.highlight }
        : prior?.collection ? null : measure(rows, prior);
      if (!measured) return null;
      const { scene, ground, highlight } = measured;
      const arrival = learns && !prior ? execution?.readClickRegionChanges?.([scene.actor.box]) : null;
      const [left, top, right, bottom] = scene.actor.box;
      const witnessedArrival = arrival?.afterRef === observation.observation_ref && arrival.levelEpoch === observation.level_epoch &&
        arrival.changed[0] && !arrival.predictionContradicted &&
        arrival.point[0] >= left && arrival.point[0] <= right && arrival.point[1] >= top && arrival.point[1] <= bottom;
      const memory = prior ?? { epoch: observation.level_epoch, ground, highlight,
        evidence: witnessedArrival ? [arrival.beforeRef, arrival.afterRef] : collectionScene && reusable ? [reusable.ref] : [], blocked: [],
        ...(collectionScene?.seals ? { collection: { goals: collectionScene.seals.map(seal => seal.point), verified: [], provisional: null } } : {}) };
      const attemptFor = (tile: Tile) => [key(scene.actor.point), key(tile.point), key(scene.offsets)].join('/');
      const distance = memory.collection ? null : distances(scene);
      const options = distance ? scene.moves.filter(p => distance.has(p) && !memory.blocked.includes(attemptFor(p)))
        .sort((a, b) => distance.get(a)! - distance.get(b)!) : scene.moves;
      const target = memory.collection ? routeToSeals(scene, memory.collection, memory) : options[0];
      if (!target) return null;

      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...memory.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: 'ACTION6', expected: target.point, evidence };
      const eligibleProbe = memory.evidence.length === 0 && scene.moves.length >= 2;
      const facts = { routeSupported: memory.evidence.length > 0, eligibleProbe, knownInteraction: false,
        visibleLandings: scene.moves.length, reachableLandings: options.length, mode };
      const decision = learns ? await choose?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({
        mode, evidence, probe: memory.evidence.length ? null : offer, access: memory.evidence.length ? offer : null, interaction: null,
      });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== 'P05' && strategy !== 'P07') return null;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, target.point, { reason: 'Currently highlighted landing', evidence });
      if (!pointBinding) return null;
      const parent = 'G_official_completion';
      const objective = { kind: memory.collection ? 'collect_visible_markers_before_exit' : 'reach_framed_marker_by_highlighted_jumps',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_piece', 'highlighted_landing', 'framed_marker'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_highlighted_jump' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id;
      const action = { action_ref: 'ACTION6', data: { x: target.point[0], y: target.point[1] } };
      const situation = memory.collection ? scene.seals?.length
        ? 'Choose a highlighted jump on a route through the remaining seals'
        : 'Reach the exit while checking that the collected seals stay absent' : strategy === 'P05'
        ? 'Check whether clicking a highlighted square moves the piece there'
        : 'Choose a highlighted square on a shortest candidate route, then verify the landing and the new highlights';
      return {
        status: 'proposed', kind: family, scene, target, memory, attempt: attemptFor(target), needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: target.point, point_binding: pointBinding }],
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: memory.collection ? 'Collect the seals and reach the exit' : 'Reach the framed marker',
          situation, evidence, agenda: navigation?.entries ?? [], mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: scene.actor.box, focus: target.box, destination: scene.goal.box, ...(scene.seals ? { seals: scene.seals.map(seal => seal.box) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_landing_bound' : 'highlighted_route_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const next = proposal.memory.collection && known ? measureCollection(second, known, proposal.memory.collection)
        : measure(second, proposal.memory)?.scene;
      const matched = !!next && same(next.actor.point, proposal.target.point) && same(next.offsets, proposal.scene.offsets);
      if (next && matched && proposal.memory.collection) {
        const receipt = assessCollection(proposal, next);
        return { matched: !!receipt && receipt.reason !== 'seal_returned_after_departure', seal_prefix: true,
          reason: receipt?.reason ?? 'collection_return_changed_unexpectedly' };
      }
      return { matched, seal_prefix: true, reason: matched ? 'landing_and_next_highlights_confirmed' : 'landing_or_next_highlights_diverged' };
    },
    record(before, after, _action, first, second, proposal) {
      if (after.levels_completed > before.levels_completed) {
        const { scene, memory } = proposal, parts = geometricComponents(first);
        const actor = parts.find(part => part.color === memory.ground && same(center(part.bbox), scene.actor.point)
          && boxWidth(part.bbox) === boxWidth(scene.actor.box));
        const goal = parts.find(part => part.color === scene.goal.color && same(center(part.bbox), scene.goal.point)
          && boxWidth(part.bbox) === boxWidth(scene.goal.box) && hasCenteredInset(part, parts));
        if (actor && goal) known = { completed: after.levels_completed, side: boxWidth(scene.actor.box), actorArea: actor.area,
          goalArea: goal.area, ground: memory.ground, highlight: memory.highlight, offsets: scene.offsets, ref: after.observation_ref };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const next = proposal.memory.collection && known ? measureCollection(second, known, proposal.memory.collection)
        : measure(second, proposal.memory)?.scene;
      const confirmed = !!next && same(next.actor.point, proposal.target.point) && same(next.offsets, proposal.scene.offsets);
      const { memory } = proposal;
      const receipt = confirmed && next && memory.collection ? assessCollection(proposal, next) : null;
      const acquired = confirmed && (!memory.collection || receipt);
      state = { ...memory, evidence: acquired ? [...memory.evidence.slice(-5), after.observation_ref] : [],
        blocked: acquired ? memory.blocked : [...memory.blocked, proposal.attempt],
        ...(receipt ? { collection: receipt.collection } : {}) };
      return { events: [] };
    },
    state: () => ({ state, known }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      known = structuredClone((value.known as JumpModel | undefined) ?? null);
    },
  };
}
