import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const pairedChannelsId = 'sic_paired_channels';
type Tile = { point: NativePoint; box: NativeBox; color: number; count: number; accents: number[] };
type Part = ReturnType<typeof geometricComponents>[number];
type Pair = { color: number; from: Tile; to: Tile };
type Layout = { pitch: number; tiles: Tile[]; pairs: Pair[]; closed: number; open: number; reserve: number };
type Thread = { pair: Pair; clicks: Tile[] };
type State = { epoch: number; layout: Layout; threads: Thread[]; rejected: string[]; refs: string[]; count: number };
type Proposal = NativeProposal & { state: State; tile: Tile; pair: Pair; completes: boolean; needId: string };
const key = (p: NativePoint) => p.join(',');
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

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
  const sink = measureTile(rows, ...pair.to.point, pitch);
  return sink.color === pair.color && sink.count >= pitch ** 2 - 1;
}

function layoutFor(rows: NativeRows): Layout | null {
  const parts = geometricComponents(rows);
  const candidates: Layout[] = [];
  for (const field of parts.filter(p => width(p.bbox) === height(p.bbox) && width(p.bbox) >= 24 && p.area > 100
    && p.bbox[0] > 0 && p.bbox[1] > 0 && p.bbox[2] < rows[0]!.length - 1 && p.bbox[3] < rows.length - 1)) {
    for (const pitch of [3, 4, 5]) {
      const side = width(field.bbox) / pitch;
      if (!Number.isInteger(side) || side > 14 || side < 6) continue;
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
      const marks = surface.filter(tile => tile.count === pitch ** 2 - pitch && tile.accents.length === 1);
      const sources = marks.filter(tile => tile.color !== open && tile.color !== closed);
      if (sources.length < 2 || sources.length > 4 || marks.length !== 2 * sources.length) continue;
      const pairs: Pair[] = [];
      for (const from of sources) {
        const matches = marks.filter(tile => tile.color === open && tile.accents[0] === from.color);
        if (matches.length === 1) pairs.push({ color: from.color, from, to: matches[0]! });
      }
      if (pairs.length !== sources.length || new Set(pairs.map(pair => pair.color)).size !== pairs.length) continue;
      const indicators = parts.filter(p => p.bbox[3] < t && height(p.bbox) === 2 && width(p.bbox) >= 6 && p.area === 2 * width(p.bbox));
      if (indicators.length !== 1) continue;
      candidates.push({ pitch, tiles: surface, pairs, closed, open, reserve: width(indicators[0]!.bbox) });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
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

export function createSicPairedChannels(): NativeFamily<Proposal> {
  let memory: State | null = null;
  return {
    id: pairedChannelsId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')
        || observation.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))) return null;
      const prior = memory?.epoch === observation.level_epoch ? memory : null;
      const layout = prior?.layout ?? layoutFor(rows);
      if (!layout || (prior?.count ?? 0) >= layout.reserve) return null;
      const threads = prior?.threads ?? plan(layout, []);
      if (!threads) return null;
      const state = prior ?? { epoch: observation.level_epoch, layout, threads, rejected: [], refs: [], count: 0 };
      const nextTile = (thread: Thread) => thread.clicks.find(tile => measureTile(rows, ...tile.point, layout.pitch).color === layout.closed);
      const thread = threads.find(t => nextTile(t));
      const tile = thread && nextTile(thread);
      if (!thread || !tile || state.rejected.includes(key(tile.point))) return null;
      if (threads.some(t => !nextTile(t) && !endpointReached(rows, t.pair, layout.pitch))) return null;
      const { pair } = thread, ref = observation.observation_ref;
      const completes = thread.clicks.filter(t => measureTile(rows, ...t.point, layout.pitch).color === layout.closed).length === 1;
      const evidence: [string, ...string[]] = [ref, ...state.refs.filter(value => value !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offset = Math.floor(layout.pitch / 2), [x, y] = tile.point;
      const point: NativePoint = [x + offset, y + offset];
      const offer = { input: 'ACTION6', expected: point, evidence };
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: prior ? null : offer, access: prior ? offer : null, interaction: null });
      if (!selected) return null;
      const witness = await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: 'One closed tile on a candidate channel', evidence });
      if (!witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'connect_matching_endpoints', scope: ref.split(':revision:', 1)[0]!,
        subjects: [key(pair.from.point), key(pair.to.point)], parentObjective: parent, satisfactionContract: 'paired_endpoints_in_the_same_open_channel' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = pairedChannelsId + ':' + need.id;
      const situation = prior ? 'Open the next tile and compare the change with the two paired endpoints' : 'Test whether one closed tile can be opened';
      const action = { action_ref: 'ACTION6', data: { x: point[0], y: point[1] } };
      return {
        status: 'proposed', kind: pairedChannelsId, tile, pair, state, completes, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, point_binding: witness, expected_after: null }],
        sicSituationCard: { strategy: selected.id, need: 'Connect matching endpoints within the visible reserve', situation, evidence, agenda: entries,
          mode, triggerCard: card, target: tile.box, source: pair.from.box, sink: pair.to.box },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
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
      const matched = tile.color !== layout.closed && (!proposal.completes || reached);
      return { matched, seal_prefix: true, reason: reached ? 'paired_endpoint_recolored' : proposal.completes && !reached
        ? 'paired_endpoint_did_not_recolor' : matched && changed
        ? 'tile_opened_and_remote_tiles_changed' : matched ? 'tile_opened' : 'tile_did_not_open',
        ...(reached ? { sic_need: { id: proposal.needId, status: 'satisfied' as const } } : {}) };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { state, tile } = proposal;
      const opened = measureTile(second, ...tile.point, state.layout.pitch).color !== state.layout.closed;
      memory = { ...state, count: state.count + 1, refs: [...state.refs.slice(-4), after.observation_ref],
        rejected: opened ? state.rejected : [...state.rejected, key(tile.point)] };
      return { events: [] };
    },
    state: () => ({ memory }),
    restore(value: NativeRecord) { memory = structuredClone(value.memory as State | null); },
  };
}
