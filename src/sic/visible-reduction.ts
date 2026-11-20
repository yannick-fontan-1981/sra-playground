import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';
import { maximumCommittedActions } from './plan-step.ts';

export const visibleReductionId = 'sic_compose_visible_reductions';
export const learnVisibleReductionId = 'sic_learn_observed_reduction';

type Tile = { box: NativeBox; point: NativePoint };
type Layout = { tiles: Tile[]; width: number; pitch: number; empty: number; piece: number; mask: readonly NativePoint[] };
type Board = { occupied: number[]; selected: number | null };
type Jump = { from: number; over: number; to: number };
type Step = { tile: Tile; before: Board; after: Board };
type Proposal = NativeProposal & { layout: Layout; route: Step[]; needId: string; entry: string };
const key = ([x, y]: NativePoint) => x + ',' + y;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const directions = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;

function measure(rows: NativeRows): Layout | null {
  const parts = geometricComponents(rows).filter(part => {
    const [x, y, right, bottom] = part.bbox, width = right - x + 1;
    return width >= 3 && width <= 8 && width === bottom - y + 1;
  });
  const groups = new Map<string, typeof parts>();
  for (const part of parts) {
    const [x, , right] = part.bbox;
    const signature = JSON.stringify([right - x + 1, part.color, part.mask]);
    groups.set(signature, [...(groups.get(signature) ?? []), part]);
  }
  const candidates: Layout[] = [];
  for (const ground of groups.values()) {
    const base = ground[0]!, [left, top, right] = base.bbox, width = right - left + 1;
    if (!base.rectangular || ground.length < 6 || ground.length > 64) continue;
    const px = ground.reduce((period, part) => gcd(period, Math.abs(part.bbox[0] - left)), 0);
    const py = ground.reduce((period, part) => gcd(period, Math.abs(part.bbox[1] - top)), 0);
    if (px !== py || px <= width || px > width * 2) continue;
    for (const group of groups.values()) {
      const first = group[0]!, [x, y, r, b] = first.bbox;
      if (group.length < 2 || group.length > 12 || first.rectangular || first.color === base.color
        || r - x + 1 !== width || b - y + 1 !== width || first.area * 2 < width ** 2) continue;
      if (!group.every(({ bbox: [x, y] }) => (x - left) % px === 0 && (y - top) % px === 0)) continue;
      const tiles = [...ground, ...group].map(({ bbox }) => ({
        box: bbox, point: [bbox[0] + Math.floor(width / 2), bbox[1] + Math.floor(width / 2)] as NativePoint,
      })).sort((a, b) => a.point[1] - b.point[1] || a.point[0] - b.point[0]);
      if (new Set(tiles.map(tile => key(tile.point))).size !== tiles.length) continue;
      candidates.push({ tiles, width, pitch: px, empty: base.color, piece: first.color, mask: first.mask });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function read(rows: NativeRows, layout: Layout): Board | null {
  const occupied: number[] = [];
  for (const [index, tile] of layout.tiles.entries()) {
    const [x, y] = tile.point, center = rows[y]?.[x], [left, top] = tile.box;
    if (center === layout.piece) {
      if (!layout.mask.every(([dx, dy]) => rows[top + dy]?.[left + dx] === layout.piece)) return null;
      occupied.push(index);
    } else if (center !== layout.empty) return null;
  }
  const rings = geometricComponents(rows).filter(part => part.area === 4 * (layout.width + 1));
  const active = occupied.filter(index => {
    const [left, top, right, bottom] = layout.tiles[index]!.box;
    return rings.some(ring => same(ring.bbox, [left - 1, top - 1, right + 1, bottom + 1]));
  });
  return active.length <= 1 ? { occupied, selected: active[0] ?? null } : null;
}

function shortestReduction(layout: Layout, board: Board): Jump[] | null {
  const positions = new Map(layout.tiles.map(({ point }, index) => [key(point), index]));
  const jumps = layout.tiles.flatMap(({ point: [x, y] }, from) => directions.flatMap(([dx, dy]) => {
    const over = positions.get(key([x + dx * layout.pitch, y + dy * layout.pitch]));
    const to = positions.get(key([x + 2 * dx * layout.pitch, y + 2 * dy * layout.pitch]));
    return over === undefined || to === undefined ? [] : [{ from, over, to }];
  }));
  const queue: { occupied: number[]; moves: Jump[] }[] = [{ occupied: board.occupied, moves: [] }];
  const seen = new Set([board.occupied.join(',')]);
  for (let index = 0; index < queue.length && index < 2048; index++) {
    const { occupied, moves } = queue[index]!;
    if (occupied.length === 1) return moves;
    const available = new Set(occupied);
    for (const jump of jumps) {
      if (!available.has(jump.from) || !available.has(jump.over) || available.has(jump.to)) continue;
      const next = afterJump(occupied, jump);
      const signature = next.join(',');
      if (seen.has(signature)) continue;
      if (seen.size >= 4096) return null;
      seen.add(signature);
      queue.push({ occupied: next, moves: [...moves, jump] });
    }
  }
  return null;
}

function afterJump(occupied: number[], jump: Jump): number[] {
  return [...occupied.filter(site => site !== jump.from && site !== jump.over), jump.to].sort((a, b) => a - b);
}

export function createSicVisibleReduction(family = visibleReductionId): NativeFamily<Proposal> {
  const learns = family === learnVisibleReductionId;
  let context: { epoch: number; layout: Layout; refs: string[]; rejected: string[] } | null = null;
  return {
    id: family,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = context?.epoch === observation.level_epoch ? context : null;
      const receipt = learns && !prior ? await execution?.readPriorClickScene?.((earlier, _previous, command) => {
        const layout = measure(earlier);
        const board = layout && read(earlier, layout);
        const site = layout && layout.tiles.findIndex(tile => {
          const [x, y, right, bottom] = tile.box;
          return x <= command.data.x! && command.data.x! <= right && y <= command.data.y! && command.data.y! <= bottom;
        });
        return layout && board && site !== null && board.occupied.includes(site) ? { layout, board, site } : null;
      }) : null;
      if (learns && !prior && (!receipt || receipt.afterRef !== observation.observation_ref)) return null;
      const layout = prior?.layout ?? receipt?.scene.layout ?? measure(rows);
      const current = layout && read(rows, layout);
      if (!layout || !current || current.occupied.length < 2 || (receipt &&
        (current.selected !== receipt.scene.site || !same(current.occupied, receipt.scene.board.occupied)))) return null;
      const jumps = shortestReduction(layout, current);
      if (!jumps?.length) return null;
      const entry = JSON.stringify([current, jumps[0]]);
      if (prior?.rejected.includes(entry)) return null;
      const route: Step[] = [];
      let before = current;
      for (const jump of jumps) {
        if (before.selected !== jump.from) {
          const selected = { ...before, selected: jump.from };
          route.push({ tile: layout.tiles[jump.from]!, before, after: selected });
          before = selected;
        }
        const returned = { occupied: afterJump(before.occupied, jump), selected: null };
        route.push({ tile: layout.tiles[jump.to]!, before, after: returned });
        before = returned;
      }
      route.splice(Math.min(remaining, maximumCommittedActions));
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence = [...new Set([ref, ...(prior?.refs ?? []), ...(receipt ? [receipt.beforeRef] : [])])];
      const label = 'Choose reductions that keep a route to one remaining piece';
      const objective = { kind: 'reduce_visible_group_to_one', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['aligned_pieces', 'available_landing_cells'], parentObjective: parent,
        satisfactionContract: 'each_landing_replaces_two_pieces_with_one' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = family + ':' + need.id, actions: NativeCommand[] = [];
      const steps = [];
      for (const step of route) {
        const [x, y] = step.tile.point, action = { action_ref: 'ACTION6', data: { x, y } };
        const measured = await ObservedInputDomain.makeLocusWitness(observation, rows, [x, y], { reason: label, evidence });
        const selecting = step.after.occupied.length === step.before.occupied.length;
        const value = selecting ? layout.piece : layout.empty;
        const point_binding = value === measured.palette_value ? measured : await ObservedInputDomain.projectLocusWitness(measured, value);
        actions.push(action);
        steps.push({ action, point_binding, expected_after: { pieces: step.after.occupied.length, selected: step.after.selected } });
      }
      return { status: 'proposed', kind: family, layout, route, entry, needId: need.id, actions, steps,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        sicSituationCard: { strategy: 'P07', mode: 'solving', need: 'Reduce the group while preserving possible landings',
          situation: label, evidence, agenda: [], target: route[0]!.tile.box,
          plannedLandings: jumps.map(jump => layout.tiles[jump.to]!.box) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: 'P07', objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, packet, observation) {
      const planned = proposal.route[index];
      const admitted = !!planned && proposal.binding?.level_epoch === observation.level_epoch
        && (index === 0 ? proposal.binding.observation_ref === observation.observation_ref
          : same(read(packet.frame_rows, proposal.layout), planned.before));
      return { admitted, reason: admitted ? 'selected_piece_and_landing_bound' : 'piece_selection_or_membership_changed' };
    },
    after(proposal, index, before, after, _first, rows) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = same(read(rows, proposal.layout), proposal.route[index]!.after);
      return { matched, seal_prefix: !matched || index + 1 === proposal.actions.length,
        reason: matched ? 'predicted_selection_or_reduction_observed' : 'reduction_projection_changed' };
    },
    record(before, after, _command, _first, rows, proposal, index) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const matched = same(read(rows, proposal.layout), proposal.route[index]!.after);
      const prior = context?.epoch === before.level_epoch ? context : null;
      context = { epoch: before.level_epoch, layout: proposal.layout, refs: [...(prior?.refs ?? []).slice(-3), after.observation_ref],
        rejected: [...(prior?.rejected ?? []), ...(matched ? [] : [proposal.entry])] };
      return { events: [] };
    },
    state: () => ({ context }),
    restore(value: NativeRecord) { context = structuredClone((value.context as typeof context | undefined) ?? null); },
  };
}
