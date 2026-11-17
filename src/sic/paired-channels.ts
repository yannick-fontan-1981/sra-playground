import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeExecution, NativeFamily, NativeProgramHandle, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { chooseLanding, landingModule } from './highlighted-route-card.ts';
import { sicNeedId } from './need-identity.ts';
import { observedMechanicsGroup } from './strategy-agenda.ts';

export const pairedChannelsId = 'sic_paired_channels';
export const verifyChannelAccessId = 'sic_verify_channel_access';
type Tile = { point: NativePoint; box: NativeBox; color: number; count: number; accents: number[] };
type Part = ReturnType<typeof geometricComponents>[number];
type Pair = { color: number; from: Tile; to: Tile; other?: Tile; branches?: Tile[] };
type Recipe = { from: number; other: number; result: number; evidence: string };
type Layout = { pitch: number; tiles: Tile[]; pairs: Pair[]; closed: number; open: number; reserve: number };
type Thread = { pair: Pair; clicks: Tile[]; mergeAt?: Tile };
type State = { epoch: number; layout: Layout; threads: Thread[]; rejected: string[]; refs: string[]; count: number; stopped?: true };
type Proposal = NativeProposal & { state: State; tile: Tile; pair: Pair; completes: boolean; needId: string; merging?: true };
const key = (p: NativePoint) => p.join(',');
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
const outlets = (pair: Pair) => [pair.to, ...(pair.branches ?? [])];
const terminalsOf = (pair: Pair) => [pair.from, ...(pair.other ? [pair.other] : []), ...outlets(pair)];

function measureTile(rows: NativeRows, x: number, y: number, pitch: number): Tile {
  const counts = new Map<number, number>();
  for (const row of rows.slice(y, y + pitch)) {
    for (const value of row.slice(x, x + pitch)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const [color, count] = ranked[0]!;
  return { point: [x, y], box: [x, y, x + pitch - 1, y + pitch - 1], color, count, accents: ranked.slice(1).map(([c]) => c) };
}

function endpointReached(rows: NativeRows, pair: Pair, pitch: number): boolean {
  return outlets(pair).every(target => {
    const sink = measureTile(rows, ...target.point, pitch);
    return sink.color === pair.color && sink.count >= pitch ** 2 - 1;
  });
}

function samePigments(recipe: Recipe, a: number, b: number): boolean {
  return (recipe.from === a && recipe.other === b) || (recipe.from === b && recipe.other === a);
}

function sourceAssignments(sources: Tile[], sinks: Tile[], recipes: readonly Recipe[], limit = 48): Pair[][] {
  const groups: Pair[][] = [], pigments = new Set(sources.map(source => source.color));
  const compatible = (from: Tile, other: Tile, result: number) => from.color !== other.color
    && recipes.every(recipe => !samePigments(recipe, from.color, other.color) || recipe.result === result);
  const assign = (left: Tile[], pairs: Pair[]) => {
    if (groups.length > limit) return;
    const to = sinks[pairs.length];
    if (!to) {
      if (!left.length) groups.push(pairs);
      return;
    }
    const color = to.accents[0]!;
    for (const [index, from] of left.entries()) {
      if (pigments.has(color)) {
        if (from.color === color) assign(left.filter(tile => tile !== from), [...pairs, { color, from, to }]);
        continue;
      }
      for (const other of left.slice(index + 1)) if (compatible(from, other, color)) {
        assign(left.filter(tile => tile !== from && tile !== other), [...pairs, { color, from, other, to }]);
      }
    }
  };
  assign(sources, []);
  return groups.length <= limit ? groups : [];
}

function assignmentEvidence(pairs: readonly Pair[], recipes: readonly Recipe[]): number {
  let measured = 0, related = 0;
  for (const { from, other, color } of pairs) {
    if (!other) continue;
    if (recipes.some(recipe => recipe.result === color && samePigments(recipe, from.color, other.color))) measured++;
    else if (recipes.some(recipe => (recipe.result === from.color && (recipe.from === other.color || recipe.other === other.color))
      || (recipe.result === other.color && (recipe.from === from.color || recipe.other === from.color)))) related++;
  }
  // A previous ingredient-to-result relation ranks an experiment. The actual mix still needs verification.
  return measured * (pairs.length + 1) + related;
}

function sharedSourceAssignments(sources: Tile[], sinks: Tile[], recipes: readonly Recipe[]): Pair[][] {
  const demands = new Map<number, Tile[]>();
  for (const sink of sinks) {
    const color = sink.accents[0]!, ofColor = demands.get(color) ?? [];
    ofColor.push(sink);
    demands.set(color, ofColor);
  }
  const representatives = [...demands.values()].map(group => group[0]!);
  const limit = sources.length > 8 ? 2048 : 48;
  const groups = sourceAssignments(sources, representatives, recipes, limit).map(group => group.map(pair => {
    const branches = demands.get(pair.color)!.slice(1);
    return branches.length ? { ...pair, branches } : pair;
  }));
  return groups.sort((a, b) => assignmentEvidence(b, recipes) - assignmentEvidence(a, recipes));
}

function layoutFor(rows: NativeRows, recipes: readonly Recipe[]): Layout[] {
  const parts = geometricComponents(rows);
  const candidates: Layout[][] = [];
  for (const field of parts.filter(p => Math.min(width(p.bbox), height(p.bbox)) >= 24 && p.area > 100
    && p.bbox[0] > 0 && p.bbox[1] > 0 && p.bbox[2] < rows[0]!.length - 1 && p.bbox[3] < rows.length - 1)) {
    for (const pitch of [3, 4, 5]) {
      const dimensions = [width(field.bbox) / pitch, height(field.bbox) / pitch];
      if (!dimensions.every(side => Number.isInteger(side) && side >= 6 && side <= 18)) continue;
      const tiles: Tile[] = [];
      const [l, t, r, b] = field.bbox;
      for (let y = t; y <= b; y += pitch) for (let x = l; x <= r; x += pitch) tiles.push(measureTile(rows, x, y, pitch));
      const surface = tiles.filter(tile => tile.color !== field.color);
      const openColors = [...new Set(surface.filter(tile => tile.count === pitch ** 2).map(tile => tile.color))]
        .filter(c => surface.filter(tile => tile.color === c && tile.count === pitch ** 2).length >= 4);
      const closedColors = [...new Set(surface.filter(tile => tile.count === pitch ** 2 - 1).map(tile => tile.color))]
        .filter(c => surface.filter(tile => tile.color === c && tile.count === pitch ** 2 - 1).length >= 10);
      if (openColors.length !== 1 || closedColors.length !== 1 || openColors[0] === closedColors[0]) continue;
      const open = openColors[0]!, closed = closedColors[0]!;
      const marks = surface.filter(tile => tile.color !== closed && tile.count < pitch ** 2 && tile.accents.length === 1);
      if (new Set(marks.map(tile => tile.count)).size !== 1) continue;
      const sources = marks.filter(tile => tile.color !== open && tile.color !== closed);
      const sinks = marks.filter(tile => tile.color === open);
      if (sources.length < 2 || sources.length > sinks.length * 2 || sinks.length < 2 || sinks.length > 7) continue;
      const indicators = parts.filter(p => p.bbox[3] < t && height(p.bbox) === 2 && width(p.bbox) >= 6 && p.area === 2 * width(p.bbox));
      if (indicators.length !== 1) continue;
      const geometry = { pitch, tiles: surface, closed, open, reserve: width(indicators[0]!.bbox) };
      if (sources.length > 4 || sinks.length > 3) {
        const demanded = [...new Set(sinks.map(sink => sink.accents[0]!))], shared = demanded.length < sinks.length;
        // When channels can branch, a solid source can contribute to a mixture even if no outlet requests its original pigment.
        const pigments = shared ? [...new Set(surface.map(tile => tile.color))] : demanded;
        const uniform = pigments.flatMap(color => {
          if (color === open || color === closed || sources.some(source => source.color === color)) return [];
          const matching = surface.filter(tile => tile.color === color && tile.count === pitch ** 2);
          return matching.length === 1 ? matching : [];
        });
        const allSources = [...sources, ...uniform];
        if (allSources.length < demanded.length || allSources.length > demanded.length * 2) continue;
        const groups = shared ? sharedSourceAssignments(allSources, sinks, recipes) : sourceAssignments(allSources, sinks, recipes);
        if (groups.length) candidates.push(groups.map(pairs => ({ ...geometry, pairs })));
        continue;
      }
      const pairs: Pair[] = [];
      for (const from of sources) {
        const matches = sinks.filter(tile => tile.accents[0] === from.color);
        if (matches.length === 1) pairs.push({ color: from.color, from, to: matches[0]! });
      }
      if (new Set(pairs.map(pair => pair.color)).size !== pairs.length) continue;
      const spare = sources.filter(source => !pairs.some(pair => pair.from === source));
      const unmatched = sinks.filter(sink => !pairs.some(pair => pair.to === sink));
      if (spare.length === 2 && unmatched.length === 1 && spare[0]!.color !== spare[1]!.color) {
        const to = unmatched[0]!;
        if (sources.some(source => source.color === to.accents[0])) continue;
        pairs.push({ color: to.accents[0]!, from: spare[0]!, other: spare[1]!, to });
      } else if (spare.length || unmatched.length) continue;
      candidates.push([{ ...geometry, pairs }]);
    }
  }
  return candidates.length === 1 ? candidates[0]! : [];
}

function permutations(pairs: readonly Pair[]): Pair[][] {
  if (!pairs.length) return [[]];
  return pairs.flatMap(pair => permutations(pairs.filter(p => p !== pair)).map(rest => [pair, ...rest]));
}

function plan(layout: Layout, rejected: readonly string[]): Thread[] | null {
  const { tiles, pitch, reserve, closed, open } = layout;
  const byPoint = new Map(tiles.map(t => [key(t.point), t]));
  const neighbors = ({ point: [x, y] }: Tile) => offsets.flatMap(([dx, dy]) => {
    const tile = byPoint.get(key([x + pitch * dx, y + pitch * dy]));
    return tile ? [tile] : [];
  });
  const orderings = permutations(layout.pairs);
  let best: Thread[] | null = null, cost = reserve + 1;
  for (let variant = 0; variant < 80; variant++) {
    const extra = new Map(tiles.map((tile, i) => [tile, variant === 0 ? 0 : ((i * 29 + variant * 31) ^ (i % 3 * variant)) % 13]));
    for (const ordering of orderings) {
      const occupied = new Set<Tile>();
      const candidate: Thread[] = [];
      for (const pair of ordering) {
        const queue: { tile: Tile; route: Tile[]; cost: number }[] = [{ tile: pair.from, route: [], cost: 0 }];
        const seen = new Set<Tile>();
        let path: Tile[] | null = null;
        while (queue.length) {
          queue.sort((a, b) => a.cost - b.cost);
          const node = queue.shift()!;
          if (seen.has(node.tile)) continue;
          seen.add(node.tile);
          if (node.tile === pair.to) { path = node.route; break; }
          for (const t of neighbors(node.tile)) {
            if (occupied.has(t) || seen.has(t) || rejected.includes(key(t.point))
              || (t !== pair.to && t.count !== pitch ** 2 && !(t.color === closed && t.count === pitch ** 2 - 1))) continue;
            queue.push({ tile: t, route: [...node.route, t], cost: node.cost + (t.color === closed ? 10 : 1) + extra.get(t)! });
          }
        }
        if (!path) break;
        for (const tile of path) occupied.add(tile);
        for (const tile of path.filter(t => t.color === open && t.count === pitch ** 2)) {
          for (const near of neighbors(tile)) if (near.color === open && near.count === pitch ** 2) occupied.add(near);
        }
        candidate.push({ pair, clicks: path.filter(t => t.color === closed) });
      }
      if (candidate.length !== ordering.length) continue;
      const n = candidate.reduce((total, thread) => total + thread.clicks.length, 0);
      if (n < cost) { best = candidate; cost = n; }
    }
  }
  return best;
}

async function planSeparated(layout: Layout, budget: number, execution?: NativeExecution, seedLimit = 120): Promise<Thread[] | null> {
  const { pitch, pairs, closed, open } = layout;
  const tiles = layout.tiles.filter(tile => tile.color === closed || tile.color === open
    || pairs.some(pair => terminalsOf(pair).includes(tile)));
  const indexes = new Map(tiles.map((tile, i) => [tile, i]));
  const at = new Map(tiles.map((tile, i) => [key(tile.point), i]));
  const adjacent = tiles.map(({ point: [x, y] }) => offsets.flatMap(([dx, dy]) => {
    const i = at.get(key([x + dx * pitch, y + dy * pitch]));
    return i === undefined ? [] : [i];
  }));
  const spread = (seeds: Iterable<number>, excavated: ReadonlySet<number>) => {
    const queue = [...seeds], connected = new Set(queue);
    for (const i of queue) for (const near of adjacent[i]!) {
      if (connected.has(near) || tiles[near]!.color === closed && !excavated.has(near)) continue;
      connected.add(near);
      queue.push(near);
    }
    return connected;
  };
  const terminals = new Map(pairs.map(pair => [pair, terminalsOf(pair).map(tile => indexes.get(tile)!)]));
  const initial = new Map(pairs.map(pair => [pair, spread(terminals.get(pair)!, new Set())]));

  function reach(from: ReadonlySet<number>, end: number, blocked: ReadonlySet<number>, excavated: ReadonlySet<number>, seed: number) {
    const distance = tiles.map(() => Infinity), previous = tiles.map(() => -1), visited = new Set<number>();
    for (const start of from) distance[start] = 0;
    while (!visited.has(end)) {
      let site = -1;
      for (let i = 0; i < tiles.length; i++) {
        if (!visited.has(i) && distance[i]! < (site < 0 ? Infinity : distance[site]!)) site = i;
      }
      if (site < 0) return null;
      visited.add(site);
      for (const near of adjacent[site]!) {
        if (visited.has(near) || blocked.has(near)) continue;
        const noise = seed ? (((near + 1) * 2654435761) ^ (seed * 19435127) ^ (near * seed * 15485863)) >>> 0 : 0;
        const next = distance[site]! + (tiles[near]!.color === closed && !excavated.has(near) ? 17 : 1) + noise % 23;
        if (next >= distance[near]!) continue;
        distance[near] = next;
        previous[near] = site;
      }
    }
    const path: number[] = [];
    for (let i = end; previous[i] !== -1; i = previous[i]!) path.push(i);
    return path.reverse();
  }

  function route(order: Pair[], seed: number, limit: number): Thread[] | null {
    const occupied = new Map(initial), threads: Thread[] = [];
    let used = 0;
    for (const pair of order) {
      const blocked = new Set<number>();
      for (const [other, region] of occupied) if (other !== pair) for (const i of region) {
        blocked.add(i);
        for (const near of adjacent[i]!) blocked.add(near);
      }
      const ids = terminals.get(pair)!;
      const excavated = new Set<number>(), clicks: Tile[] = [];
      let region = spread([ids[0]!], excavated), mergeAt: Tile | undefined;
      if (ids.some(i => blocked.has(i))) return null;
      for (const [index, target] of ids.slice(1).entries()) {
        if (region.has(target)) continue;
        const path = reach(region, target, blocked, excavated, seed);
        if (!path) return null;
        for (const i of path) {
          const tile = tiles[i]!;
          if (tile.color !== closed || excavated.has(i)) continue;
          excavated.add(i);
          clicks.push(tile);
          if (++used >= limit) return null;
        }
        region = spread(region, excavated);
        if ([...region].some(i => blocked.has(i))) return null;
        if (pair.other && index === 0) mergeAt = clicks.at(-1);
      }
      occupied.set(pair, region);
      threads.push({ pair, clicks, ...(mergeAt ? { mergeAt } : {}) });
    }
    return threads;
  }

  const orderings = permutations(pairs);
  let best: Thread[] | null = null, limit = Math.min(budget, layout.reserve) + 1;
  for (let seed = 0; seed < seedLimit; seed++) {
    if (execution && seed % 8 === 0) {
      execution.signal?.throwIfAborted();
      if (execution.deadlineMs !== undefined && (execution.now?.() ?? performance.now()) >= execution.deadlineMs) break;
      await execution.yieldControl();
    }
    for (const ordering of orderings) {
      const candidate = route(ordering, seed, limit);
      if (!candidate) continue;
      best = candidate;
      limit = candidate.reduce((sum, thread) => sum + thread.clicks.length, 0);
    }
  }
  return best;
}

async function selectSeparatedLayout(rows: NativeRows, recipes: readonly Recipe[], remaining: number, execution?: NativeExecution) {
  async function search(layouts: Layout[], seedLimit: number) {
    let best: { layout: Layout; threads: Thread[] } | null = null, budget = remaining;
    for (const layout of layouts) {
      if (execution?.deadlineMs !== undefined && (execution.now?.() ?? performance.now()) >= execution.deadlineMs) break;
      if (best && layout.pairs.some(pair => pair.branches?.length)
        && assignmentEvidence(layout.pairs, recipes) < assignmentEvidence(best.layout.pairs, recipes)) break;
      const threads = layout.pairs.some(pair => pair.other || pair.branches?.length)
        ? await planSeparated(layout, budget, execution, seedLimit) : plan(layout, []);
      if (!threads) continue;
      const cost = threads.reduce((count, thread) => count + thread.clicks.length, 0);
      if (best && cost > budget) continue;
      best = { layout, threads };
      budget = cost - 1;
    }
    return best;
  }

  const layouts = layoutFor(rows, recipes);
  const first = layouts[0];
  if (!first || first.pairs.length <= 4 || !first.pairs.some(pair => pair.branches?.length)) return search(layouts, 120);

  // With more circuits, compare the shortest constructions across equally supported assignments before varying the paths.
  const tiers = new Map<number, Layout[]>();
  for (const layout of layouts) {
    const evidence = assignmentEvidence(layout.pairs, recipes);
    const tier = tiers.get(evidence);
    if (tier) tier.push(layout);
    else tiers.set(evidence, [layout]);
  }
  for (const tier of tiers.values()) {
    const best = await search(tier, 1) ?? await search(tier, 120);
    if (best) return best;
  }
  return null;
}

function sourcePigmentChanged(source: Tile, result: number, before: NativeRows, after: NativeRows): boolean {
  const [left, top, right, bottom] = source.box;
  let changed = false;
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const previous = before[y]?.[x], current = after[y]?.[x];
    if (previous === current) continue;
    if (previous !== source.color || current !== result) return false;
    changed = true;
  }
  return changed;
}

function mixConfirmed(pair: Pair, tileColor: number, before: NativeRows, after: NativeRows, pitch: number): boolean {
  return !!pair.other && [pair.from, pair.other].every(source =>
    measureTile(after, ...source.point, pitch).color === pair.color
    || tileColor === pair.color && sourcePigmentChanged(source, pair.color, before, after));
}

function separatedReturn(proposal: Proposal, before: NativeRows, after: NativeRows): boolean {
  const { layout } = proposal.state;
  if (!layout.pairs.some(pair => pair.other || pair.branches?.length)) return true;
  const { from, other, color } = proposal.pair, pitch = layout.pitch;
  const allowed = new Set([from.color, color, ...(other ? [other.color] : [])]);
  const tileColor = measureTile(after, ...proposal.tile.point, pitch).color;
  if (!allowed.has(tileColor) || proposal.merging && !mixConfirmed(proposal.pair, tileColor, before, after, pitch)) return false;
  return layout.pairs.filter(pair => key(pair.to.point) !== key(proposal.pair.to.point)).every(pair =>
    terminalsOf(pair).every(tile =>
      measureTile(before, ...tile.point, pitch).color === measureTile(after, ...tile.point, pitch).color));
}

export function createSicVerifyChannelAccess(): NativeFamily<Proposal> {
  let memory: State | null = null;
  let recipes: Recipe[] = [];
  let decide: NativeProgramHandle | undefined;
  return {
    id: verifyChannelAccessId,
    async attachPrograms(registry) {
      decide = await registry.registerProgram(chooseLanding, {}, await landingModule());
    },
    async proposeInGroup(group, observation, rows, inputs, remaining, execution): Promise<Proposal | null> {
      if (group !== observedMechanicsGroup) return this.propose(observation, rows, inputs, remaining, execution);
      const current = memory?.epoch === observation.level_epoch ? memory : null;
      if (current ? current.layout.pairs.filter(pair => pair.other).length < 2 : !recipes.length) return null;
      const proposal = await this.propose(observation, rows, inputs, remaining, execution);
      return (proposal?.state.layout.pairs.filter(pair => pair.other).length ?? 0) >= 2 ? proposal : null;
    },
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      if (prior?.stopped || (prior && prior.count >= prior.layout.reserve)) return null;
      const selected = prior ?? await selectSeparatedLayout(rows, recipes, remaining, execution);
      if (!selected) return null;
      const { layout, threads } = selected;
      const state = prior ?? { epoch: observation.level_epoch, layout, threads, rejected: [], refs: recipes.slice(-4).map(recipe => recipe.evidence), count: 0 };
      const nextTile = (thread: Thread) => thread.clicks.find(tile => measureTile(rows, ...tile.point, layout.pitch).color === layout.closed);
      const thread = threads.find(t => nextTile(t));
      const tile = thread && nextTile(thread);
      if (!thread || !tile || state.rejected.includes(key(tile.point))) return null;
      if (threads.some(t => !nextTile(t) && !endpointReached(rows, t.pair, layout.pitch))) return null;
      const { pair } = thread, ref = observation.observation_ref;
      const completes = thread.clicks.filter(t => measureTile(rows, ...t.point, layout.pitch).color === layout.closed).length === 1;
      const merging = thread.mergeAt && key(thread.mergeAt.point) === key(tile.point);
      const shared = layout.pairs.some(candidate => candidate.branches?.length);
      const unmeasuredMix = shared && merging && pair.other && !recipes.some(recipe => recipe.result === pair.color
        && samePigments(recipe, pair.from.color, pair.other!.color));
      const evidence: [string, ...string[]] = [ref, ...state.refs.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offset = Math.floor(layout.pitch / 2), [x, y] = tile.point;
      const point: NativePoint = [x + offset, y + offset];
      const routeSupported = !unmeasuredMix && !!prior && threads.some(candidate => candidate.clicks.some(previous =>
        measureTile(rows, ...previous.point, layout.pitch).color !== layout.closed));
      const facts = { routeSupported, eligibleProbe: !routeSupported, knownInteraction: false, mode };
      const decision = await decide?.run({ situation: facts }, { signal: execution?.signal });
      const strategy = routeSupported ? 'P07' : 'P05';
      if (decision?.result !== strategy) return null;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: 'One closed tile on a candidate channel', evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: pair.other ? 'combine_sources_without_joining_other_channels' : 'connect_matching_endpoints', scope: ref.split(':revision:', 1)[0]!,
        subjects: terminalsOf(pair).map(tile => key(tile.point)), parentObjective: parent,
        satisfactionContract: 'paired_endpoints_in_the_same_open_channel' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = verifyChannelAccessId + ':' + need.id;
      const situation = merging ? 'Join the two sources and verify their new color before using the mixture'
        : pair.branches?.length ? `Extend the same channel to ${outlets(pair).length} matching outlets while preserving the other channels`
        : pair.other ? 'Open a cell for the mixture while keeping neighboring channels separate'
          : routeSupported ? 'Open the next tile and compare the change with the two paired endpoints' : 'Test whether one closed tile can be opened';
      const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      return {
        status: 'proposed', kind: verifyChannelAccessId, tile, pair, state, completes, needId: need.id, ...(merging ? { merging: true } : {}),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: null }],
        sicSrcDecision: { workflow: decision.receipt.workflow, hash: decision.receipt.src_hash,
          instructions: decision.receipt.instructions, edited: 'edited' in decision.receipt && decision.receipt.edited === true,
          situation: facts },
        sicSituationCard: { strategy, need: 'Connect matching endpoints within the visible reserve', situation, evidence, agenda: [],
          mode, triggerCard: chooseLanding, target: tile.box, source: pair.from.box, sink: pair.to.box,
          ...(pair.branches?.length ? { branches: pair.branches.map(sink => sink.box) } : {}),
          ...(pair.other ? { otherSource: pair.other.box } : {}) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'channel_tile_bound' : 'channel_observation_changed' };
    },
    after(proposal, _index, before, after, first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { layout } = proposal.state;
      const tile = measureTile(second, ...proposal.tile.point, layout.pitch);
      const reached = endpointReached(second, proposal.pair, layout.pitch);
      const changed = layout.tiles.some(t => key(t.point) !== key(proposal.tile.point)
        && measureTile(first, ...t.point, layout.pitch).color !== measureTile(second, ...t.point, layout.pitch).color);
      if (!separatedReturn(proposal, first, second)) return { matched: false, seal_prefix: true, reason: 'channel_separation_or_mix_contradicted' };
      const matched = tile.color !== layout.closed && (!proposal.completes || reached);
      return { matched, seal_prefix: true, reason: proposal.merging && matched ? 'source_mixture_observed' : reached ? 'paired_endpoint_recolored' : proposal.completes && !reached
        ? 'paired_endpoint_did_not_recolor' : matched && changed
        ? 'tile_opened_and_remote_tiles_changed' : matched ? 'tile_opened' : 'tile_did_not_open',
        ...(reached ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { state, tile } = proposal;
      const opened = measureTile(second, ...tile.point, state.layout.pitch).color !== state.layout.closed;
      const separated = separatedReturn(proposal, first, second);
      if (proposal.merging && opened && separated && proposal.pair.other) {
        const { from, color } = proposal.pair, other = proposal.pair.other.color;
        const known = recipes.some(recipe => recipe.result === color && samePigments(recipe, from.color, other));
        if (!known) recipes = [...recipes.slice(-11), { from: from.color, other, result: color, evidence: after.observation_ref }];
      }
      memory = { ...state, count: state.count + 1, refs: [...state.refs.slice(-4), after.observation_ref],
        ...(!separated ? { stopped: true as const } : {}),
        rejected: opened ? state.rejected : [...state.rejected, key(tile.point)] };
      const observedBranch = proposal.pair.branches?.length && separated && opened
        && endpointReached(second, proposal.pair, state.layout.pitch) && !endpointReached(first, proposal.pair, state.layout.pitch);
      return { events: [], ...(observedBranch ? { reviewEvidence: 'The same circuit filled all its outlets and preserved the neighboring circuits.' } : {}) };
    },
    state: () => ({ memory, recipes }),
    restore(value: NativeRecord) {
      memory = structuredClone(value.memory as State | null);
      recipes = structuredClone((value.recipes as Recipe[] | undefined) ?? []);
    },
  };
}
