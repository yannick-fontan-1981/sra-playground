import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import { maximumCommittedActions } from './plan-step.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProgramHandle, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { searchCoverageRoute } from './coverage-route.ts';
import { chooseSwitchingJump, observeSwitchingJump, readSwitchingLayout, readSwitchingScene, switchingAttempt,
  type JumpMemory, type JumpTile, type SwitchingLayout, type SwitchingScene, type SwitchingStep } from './switching-jump-route.ts';

export const highlightedRouteId = 'sic_highlighted_route';
export const learnHighlightedRouteId = 'sic_learn_highlighted_route';

type Part = ReturnType<typeof geometricComponents>[number];
type Tile = JumpTile;
type Portal = { ends: [Tile, Tile]; pattern: string; ink: number; mask: NativePoint[] };
type Supports = { sites: Tile[]; pattern: string; ink: number; mask: NativePoint[]; consumed: string[]; persistent: string[] };
type Scene = { actor: Tile; goal: Tile; tiles: Tile[]; moves: Tile[]; offsets: NativePoint; seals?: Tile[]; portal?: Portal; supports?: Supports };
type Collection = { goals: NativePoint[]; verified: string[]; provisional: string | null };
type Memory = { epoch: number; ground: number; highlight: number; evidence: string[]; blocked: string[];
  collection?: Collection; switching?: SwitchingLayout; portal?: Portal; checkedTransfers?: string[]; supports?: Supports };
type Proposal = NativeProposal & { scene: Scene; target: Tile; memory: Memory; attempt: string; needId: string;
  switching?: { previous: SwitchingScene; step: SwitchingStep }; arrival?: Tile; route?: Tile[] };

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

function terrainPattern(rows: NativeRows, [l, t, r, b]: NativeBox, { ground, highlight }: JumpMemory) {
  return rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1)).map(value => value === ground || value === highlight ? 'floor' : value).join(',');
}

function measurePortal(rows: NativeRows, model: JumpMemory, actor: Tile, goal: Tile, tiles: Part[], seals: readonly Tile[]): Portal | null {
  const ink = rows[actor.point[1]]![actor.point[0]]!, groups = new Map<string, Tile[]>();
  if (ink === model.ground || ink === model.highlight) return null;
  for (const part of tiles) {
    const tile = asTile(part), [l, t, r, b] = tile.box;
    if (same(tile.point, actor.point) || same(tile.point, goal.point) || seals.some(seal => same(seal.point, tile.point))
      || part.area === model.side ** 2) continue;
    const colors = new Set(rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1)));
    if (colors.has(ink) || colors.size < 3) continue;
    const pattern = terrainPattern(rows, tile.box, model), matches = groups.get(pattern) ?? [];
    matches.push(tile);
    groups.set(pattern, matches);
  }
  const pairs = [...groups.entries()].filter(([, group]) => group.length === 2);
  if (pairs.length !== 1) return null;
  const [pattern, matches] = pairs[0]!, [l, t, r, b] = actor.box;
  const mask: NativePoint[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]![x] === ink) mask.push([x - l, y - t]);
  return mask.length >= model.side ? { ends: [matches[0]!, matches[1]!], pattern, ink, mask } : null;
}

function settledTile(scene: Scene, target: Tile): Tile {
  const ends = scene.portal?.ends;
  if (!ends?.some(tile => same(tile.point, target.point))) return target;
  return ends.find(tile => !same(tile.point, target.point))!;
}

function measureSupports(rows: NativeRows, model: JumpMemory, onGrid: Part[], actor: Tile, occupiedRoles: readonly Tile[]): Supports | null {
  const addressed = new Set([actor, ...occupiedRoles].map(tile => key(tile.point)));
  const groups = new Map<string, Tile[]>();
  for (const part of onGrid) {
    const tile = asTile(part);
    if (part.area === model.side ** 2 || addressed.has(key(tile.point))) continue;
    const pattern = terrainPattern(rows, tile.box, model), matches = groups.get(pattern) ?? [];
    matches.push(tile);
    groups.set(pattern, matches);
  }
  const repeated = [...groups.entries()].filter(([, sites]) => 3 <= sites.length && sites.length <= 12);
  if (repeated.length !== 1) return null;
  const [pattern, sites] = repeated[0]!;
  const [l, t, r, b] = actor.box, ink = rows[actor.point[1]]?.[actor.point[0]];
  if (ink === undefined || ink === model.ground || ink === model.highlight) return null;
  const mask: NativePoint[] = [];
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] === ink) mask.push([x - l, y - t]);
  return mask.length >= model.side ? { pattern, sites, ink, mask, consumed: [], persistent: [] } : null;
}

function measureActorOnSupports(rows: NativeRows, { sites, ink, mask }: Supports, side: number): Tile | null {
  const pitch = side + 1, [left, top] = sites[0]!.box;
  const candidates: Tile[] = [];
  for (let y = top % pitch; y + side <= rows.length; y += pitch) {
    for (let x = left % pitch; x + side <= rows[y]!.length; x += pitch) {
      if (!mask.every(([dx, dy]) => rows[y + dy]?.[x + dx] === ink)) continue;
      const box: NativeBox = [x, y, x + side - 1, y + side - 1];
      candidates.push({ box, point: center(box), color: rows[y]![x]! });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function measureCollection(rows: NativeRows, model: JumpMemory, collection?: Collection, retainedPortal?: Portal,
  retainedSupports?: Supports): Scene | null {
  const { side, ground, highlight, actorArea, goalArea, offsets } = model;
  const parts = geometricComponents(rows), pitch = side + 1;
  const tiles = parts.filter(p => (p.color === ground || p.color === highlight) && boxWidth(p.bbox) === side && boxHeight(p.bbox) === side);
  const actors = retainedSupports ? [] : tiles.filter(part => part.color === ground && (retainedPortal
    ? aligned(asTile(part), retainedPortal.ends[0], pitch) && retainedPortal.mask.every(([x, y]) => rows[part.bbox[1] + y]?.[part.bbox[0] + x] === retainedPortal.ink)
    : part.area === actorArea && !hasCenteredInset(part, parts)));
  const actor = retainedSupports ? measureActorOnSupports(rows, retainedSupports, side) : actors.length === 1 ? asTile(actors[0]!) : null;
  if (!actor) return null;
  const onGrid = tiles.filter(part => aligned(asTile(part), actor, pitch));
  const frames = onGrid.filter(part => part.area === goalArea && hasCenteredInset(part, parts));
  const goals = frames.length <= 1 ? frames : frames.filter(({ bbox: [l, t, r, b] }) => parts.some(({ bbox }) =>
    bbox[0] === l + 1 && bbox[1] === t + 1 && bbox[2] === r - 1 && bbox[3] === b - 1));
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
  const portal = retainedPortal ?? (!collection ? measurePortal(rows, model, actor, goal, onGrid, seals) : null);
  const endpoints = portal?.ends.filter(tile => !same(tile.point, actor.point)) ?? [];
  if (portal && endpoints.some(tile => terrainPattern(rows, tile.box, model) !== portal.pattern)) return null;
  const supports = retainedSupports ?? (!collection ? measureSupports(rows, model, onGrid, actor, [goal, ...seals, ...endpoints]) : null);
  const availableSupports = supports?.sites.flatMap(site => {
    if (same(site.point, actor.point) || supports.consumed.includes(key(site.point))) return [];
    const present = onGrid.find(part => same(center(part.bbox), site.point));
    return present && terrainPattern(rows, site.box, model) === supports.pattern ? [asTile(present)] : [];
  }) ?? [];
  const plain = onGrid.filter(part => part.area === side * side).map(asTile);
  if (plain.length < 5) return null;
  const all = [...plain, ...seals, actor, goal, ...availableSupports,
    ...endpoints.map(tile => ({ ...tile, color: rows[tile.box[1]]![tile.box[0]]! }))];
  const moves = all.filter(tile => tile.color === highlight);
  if (moves.length < 1 || moves.length > 8 || moves.some(tile => !same(displacement(actor, tile), offsets))) return null;
  return { actor, goal, tiles: all, moves, offsets, seals, ...(portal ? { portal } : {}), ...(supports ? { supports } : {}) };
}

function routeToSeals(scene: Scene, collection: Collection, memory: Memory, remaining: number): Tile | null {
  const { actor, goal, tiles, offsets, moves } = scene;
  const bits = new Map(collection.goals.map((point, i) => [key(point), 1 << i]));
  const supports = new Map(memory.supports?.sites.filter(site => !memory.supports!.persistent.includes(key(site.point)))
    .map((tile, i) => [key(tile.point), 1 << i]) ?? []);
  const acquired = [...collection.verified, collection.provisional].reduce((mask, position) => mask | (position ? bits.get(position) ?? 0 : 0), 0);
  const route = searchCoverageRoute<Tile>(actor.point, goal.point, acquired, (1 << collection.goals.length) - 1, function* (point, first, spent) {
    const source = { point };
    const uses = supports.get(key(point)) ?? 0;
    for (const tile of tiles) {
      if (!same(displacement(source, tile), offsets)
        || (first && (!moves.includes(tile) || memory.blocked.includes([key(point), key(tile.point), key(offsets)].join('/'))))) continue;
      const landing = settledTile(scene, tile);
      if ((spent | uses) & ((supports.get(key(tile.point)) ?? 0) | (supports.get(key(landing.point)) ?? 0))) continue;
      yield { point: landing.point, visits: bits.get(key(landing.point)) ?? 0, step: tile, uses };
    }
  });
  return route && (!scene.portal && !scene.supports || route.length <= remaining) ? route[0]! : null;
}

function assessSupports(previous: Scene, next: Scene, rows: NativeRows, ground: number): Supports | null {
  const model = previous.supports;
  if (!model) return null;
  const source = key(previous.actor.point);
  const present = new Set(next.tiles.map(tile => key(tile.point)));
  const departed = model.sites.find(tile => key(tile.point) === source);
  for (const tile of model.sites) {
    const site = key(tile.point);
    if (site !== source && present.has(site) === model.consumed.includes(site)) return null;
  }
  if (!departed) return model;
  if (present.has(source)) return { ...model, persistent: [...new Set([...model.persistent, source])] };
  const [l, t, r, b] = departed.box, background = rows[0]?.[0];
  if (background === undefined || !rows.slice(t, b + 1).every((row, dy) => row.slice(l, r + 1).every((pixel, dx) =>
    pixel === background || pixel === ground && (dx === 0 || l + dx === r) && (dy === 0 || t + dy === b)))) return null;
  return { ...model, consumed: [...model.consumed, source] };
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
  let known: JumpMemory | null = null;
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
      const collectionScene = reusable && !prior?.switching
        ? measureCollection(rows, reusable, prior?.collection, prior?.portal, prior?.supports) : null;
      const switching = prior?.switching ?? (reusable && !prior && !collectionScene ? readSwitchingLayout(rows, reusable) : null);
      const phased = switching && readSwitchingScene(rows, switching);
      const phasedScene: Scene | null = phased ? { actor: phased.actor, goal: phased.layout.goal, tiles: phased.layout.cells,
        moves: phased.moves, offsets: phased.layout.memory.offsets, seals: phased.collection === 'remaining' ? [phased.layout.marker] : [] } : null;
      const recalled = phasedScene ?? collectionScene;
      const measured = recalled && reusable ? { scene: recalled, ground: reusable.ground, highlight: reusable.highlight }
        : switching ? null
        : prior?.collection ? null : measure(rows, prior);
      if (!measured) return null;
      const { scene, ground, highlight } = measured;
      const arrival = learns && !prior ? execution?.readClickRegionChanges?.([scene.actor.box]) : null;
      const [left, top, right, bottom] = scene.actor.box;
      const witnessedArrival = arrival?.afterRef === observation.observation_ref && arrival.levelEpoch === observation.level_epoch &&
        arrival.changed[0] && !arrival.predictionContradicted &&
        arrival.point[0] >= left && arrival.point[0] <= right && arrival.point[1] >= top && arrival.point[1] <= bottom;
      const memory = prior ?? { epoch: observation.level_epoch, ground, highlight,
        evidence: witnessedArrival ? [arrival.beforeRef, arrival.afterRef] : recalled && reusable ? [reusable.ref] : [], blocked: [],
        ...(switching ? { switching } : {}),
        ...(collectionScene?.seals ? { collection: { goals: collectionScene.seals.map(seal => seal.point), verified: [], provisional: null } } : {}),
        ...(collectionScene?.portal ? { portal: collectionScene.portal } : {}),
        ...(collectionScene?.supports ? { supports: collectionScene.supports } : {}) };
      const attemptFor = (tile: Tile) => phased ? switchingAttempt(phased, tile) : [key(scene.actor.point), key(tile.point), key(scene.offsets)].join('/');
      const distance = memory.collection || phased ? null : distances(scene);
      const options = distance ? scene.moves.filter(p => distance.has(p) && !memory.blocked.includes(attemptFor(p)))
        .sort((a, b) => distance.get(a)! - distance.get(b)!) : scene.moves;
      const step = phased ? chooseSwitchingJump(phased, remaining, memory.blocked) : null;
      const target = phased ? step?.target : memory.collection ? routeToSeals(scene, memory.collection, memory, remaining) : options[0];
      if (!target) return null;
      const landing = settledTile(scene, target);
      const transfer = !same(landing.point, target.point);
      const transferProbe = transfer && !memory.checkedTransfers?.includes(key(target.point));

      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...memory.evidence.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: 'ACTION6', expected: landing.point, evidence };
      const routeSupported = memory.evidence.length > 0 && !transferProbe;
      const eligibleProbe = transferProbe || memory.evidence.length === 0 && scene.moves.length >= 2;
      const facts = { routeSupported, eligibleProbe, knownInteraction: false,
        visibleLandings: scene.moves.length, reachableLandings: options.length, mode };
      const decision = learns ? await choose?.run({ situation: facts }, { signal: execution?.signal }) : null;
      const navigation = learns ? null : resolveNavigationPrimitives({
        mode, evidence, probe: routeSupported ? null : offer, access: routeSupported ? offer : null, interaction: null,
      });
      const strategy = decision?.result ?? navigation?.selected?.id;
      if (strategy !== 'P05' && strategy !== 'P07') return null;
      const pointBinding = await ObservedInputDomain.makeLocusWitness(observation, rows, target.point, { reason: 'Currently highlighted landing', evidence });
      if (!pointBinding) return null;
      const parent = 'G_official_completion';
      const objective = { kind: memory.collection || phased ? 'collect_visible_markers_before_exit' : 'reach_framed_marker_by_highlighted_jumps',
        scope: ref.split(':revision:', 1)[0]!,
        subjects: ['current_piece', 'highlighted_landing', 'framed_marker'], parentObjective: parent,
        satisfactionContract: 'official_progress_after_highlighted_jump' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id;
      const action = { action_ref: 'ACTION6', data: { x: target.point[0], y: target.point[1] } };
      const route = [target], actions = [action], steps = [{ action, expected_after: landing.point, point_binding: pointBinding }];
      if (strategy === 'P07' && distance && !transfer) {
        while (route.length < Math.min(remaining, maximumCommittedActions)) {
          const at = route.at(-1)!;
          const cost = distance.get(at);
          if (!cost) break;
          const next = scene.tiles.find(tile => distance.get(tile) === cost - 1 && same(displacement(at, tile), scene.offsets)
            && !memory.blocked.includes([key(at.point), key(tile.point), key(scene.offsets)].join('/')));
          if (!next) break;
          const [x, y] = next.point;
          const current = await ObservedInputDomain.makeLocusWitness(observation, rows, next.point,
            { reason: 'Landing predicted to be highlighted by the observed jump effect', evidence });
          const palette = rows[y]![x] === next.color ? memory.highlight : rows[y]![x]!;
          const point_binding = await ObservedInputDomain.projectLocusWitness(current, palette);
          const command = { action_ref: 'ACTION6', data: { x, y } };
          route.push(next);
          actions.push(command);
          steps.push({ action: command, expected_after: next.point, point_binding });
        }
      }
      const situation = transfer ? 'Use the highlighted entrance and verify where the same piece comes to rest' : step ? step.switches
        ? 'Land on the marked switch and check which highlighted jumps become available'
        : `Choose a highlighted jump on the ${step.distance}-jump route through the current and projected door states`
        : memory.supports ? 'Keep a route through the remaining seals even if marked supports disappear after departure'
        : memory.collection ? scene.seals?.length
        ? 'Choose a highlighted jump on a route through the remaining seals'
        : 'Reach the exit while checking that the collected seals stay absent' : strategy === 'P05'
        ? 'Check whether clicking a highlighted square moves the piece there'
        : 'Choose a highlighted square on a shortest candidate route, then verify the landing and the new highlights';
      return {
        status: 'proposed', kind: family, scene, target, memory, attempt: attemptFor(target), needId: need.id,
        ...(phased && step ? { switching: { previous: phased, step } } : {}),
        ...(transfer ? { arrival: landing } : {}),
        ...(route.length > 1 ? { route } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions,
        steps,
        ...(decision ? { sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true, situation: facts } } : {}),
        sicSituationCard: { strategy, need: memory.collection || phased ? 'Collect the seals and reach the exit' : 'Reach the framed marker',
          situation, evidence, agenda: navigation?.entries ?? [], mode, triggerCard: navigation?.card ?? decision?.receipt.workflow,
          actor: scene.actor.box, focus: target.box, destination: scene.goal.box, ...(scene.seals ? { seals: scene.seals.map(seal => seal.box) } : {}),
          ...(transfer ? { projectedLanding: landing.box } : {}),
          ...(scene.supports ? { possibleConsumableSupports: scene.supports.sites.filter(site =>
            !scene.supports!.consumed.includes(key(site.point))).map(site => site.box) } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, packet, observation) {
      if (index > 0 && proposal.route) {
        const current = measure(packet.frame_rows, proposal.memory)?.scene;
        const admitted = proposal.memory.epoch === observation.level_epoch && !!current
          && same(current.actor.point, proposal.route[index - 1]!.point) && same(current.offsets, proposal.scene.offsets)
          && current.tiles.length === proposal.scene.tiles.length
          && current.tiles.every(tile => proposal.scene.tiles.some(prior => same(prior.point, tile.point)))
          && current.moves.some(tile => same(tile.point, proposal.route![index]!.point));
        return { admitted, reason: admitted ? 'predicted_highlight_confirmed' : 'highlighted_route_context_changed' };
      }
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_landing_bound' : 'highlighted_route_context_changed' };
    },
    after(proposal, index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (proposal.switching) {
        const { previous, step } = proposal.switching;
        const reason = observeSwitchingJump(second, previous, step);
        return { matched: !!reason, seal_prefix: true, reason: reason ?? 'landing_door_group_or_seal_contradicted' };
      }
      const next = proposal.memory.collection && known ? measureCollection(second, known, proposal.memory.collection, proposal.memory.portal, proposal.memory.supports)
        : measure(second, proposal.memory)?.scene;
      const matched = !!next && same(next.actor.point, (proposal.route?.[index] ?? proposal.arrival ?? proposal.target).point)
        && same(next.offsets, proposal.scene.offsets);
      if (next && matched && proposal.memory.collection) {
        const receipt = assessCollection(proposal, next);
        const supports = !proposal.memory.supports || assessSupports(proposal.scene, next, second, proposal.memory.ground);
        return { matched: !!receipt && !!supports && receipt.reason !== 'seal_returned_after_departure', seal_prefix: true,
          reason: !supports ? 'marked_support_return_changed_unexpectedly'
            : typeof supports !== 'boolean' && supports.consumed.length > proposal.memory.supports!.consumed.length ? 'marked_support_removed_after_departure'
            : proposal.arrival && receipt?.reason === 'landing_and_next_highlights_confirmed' ? 'portal_arrival_and_next_highlights_confirmed'
            : receipt?.reason ?? 'collection_return_changed_unexpectedly' };
      }
      return { matched, seal_prefix: !matched || index + 1 >= proposal.actions.length,
        reason: matched ? 'landing_and_next_highlights_confirmed' : 'landing_or_next_highlights_diverged' };
    },
    record(before, after, _action, first, second, proposal, index) {
      const memory = (index > 0 && state?.epoch === before.level_epoch ? state : null) ?? proposal.memory;
      const from = proposal.route?.[index - 1]?.point ?? proposal.scene.actor.point;
      const target = proposal.route?.[index] ?? proposal.target;
      if (after.levels_completed > before.levels_completed) {
        if (proposal.switching && known) {
          known = { ...known, completed: after.levels_completed, ref: after.observation_ref };
          return { events: [] };
        }
        const scene = index > 0 && proposal.route ? measure(first, memory)?.scene : proposal.scene;
        if (!scene) return { events: [] };
        const parts = geometricComponents(first);
        const actor = parts.find(part => part.color === memory.ground && same(center(part.bbox), from)
          && boxWidth(part.bbox) === boxWidth(scene.actor.box));
        const goal = parts.find(part => part.color === scene.goal.color && same(center(part.bbox), scene.goal.point)
          && boxWidth(part.bbox) === boxWidth(scene.goal.box) && hasCenteredInset(part, parts));
        if (actor && goal) known = { completed: after.levels_completed, side: boxWidth(scene.actor.box), actorArea: actor.area,
          goalArea: goal.area, ground: memory.ground, highlight: memory.highlight, offsets: scene.offsets, ref: after.observation_ref };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (proposal.switching) {
        const { memory, switching: { previous, step } } = proposal;
        const reason = observeSwitchingJump(second, previous, step);
        state = { ...memory, evidence: [...memory.evidence.slice(-5), after.observation_ref],
          blocked: reason ? memory.blocked : [...memory.blocked, proposal.attempt] };
        return { events: [] };
      }
      const next = proposal.memory.collection && known ? measureCollection(second, known, proposal.memory.collection, proposal.memory.portal, proposal.memory.supports)
        : measure(second, proposal.memory)?.scene;
      const confirmed = !!next && same(next.actor.point, (proposal.arrival ?? target).point) && same(next.offsets, proposal.scene.offsets);
      const receipt = confirmed && next && memory.collection ? assessCollection(proposal, next) : null;
      const supports = confirmed && next ? assessSupports(proposal.scene, next, second, memory.ground) : null;
      const acquired = confirmed && (!memory.supports || !!supports) && (!memory.collection || receipt && receipt.reason !== 'seal_returned_after_departure');
      state = { ...memory, evidence: acquired ? [...memory.evidence.slice(-5), after.observation_ref] : [],
        blocked: acquired ? memory.blocked : [...memory.blocked,
          index === 0 ? proposal.attempt : [key(from), key(target.point), key(proposal.scene.offsets)].join('/')],
        ...(receipt ? { collection: receipt.collection } : {}),
        ...(supports ? { supports } : {}),
        ...(acquired && proposal.arrival ? { checkedTransfers: [...new Set([...(memory.checkedTransfers ?? []), key(proposal.target.point)])] } : {}) };
      return { events: [], ...(acquired && proposal.arrival ? { reviewEvidence: 'The piece emerged at the other entrance and the new highlights belong to that landing.' } : {}) };
    },
    state: () => ({ state, known }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as Memory | null);
      known = structuredClone((value.known as JumpMemory | undefined) ?? null);
    },
  };
}
