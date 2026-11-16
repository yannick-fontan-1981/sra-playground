import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const protectGravityRouteId = 'sic_protect_gravity_route';

type Part = ReturnType<typeof geometricComponents>[number];
type Tile = 'air' | 'wall' | 'danger' | 'off' | 'on' | 'removable' | 'exit';
type Layout = { pitch: number; phase: NativePoint; actor: number; air: number; toggle: number; removable: number };
type Scene = { layout: Layout; actor: NativeBox; columns: number; tiles: Tile[]; at: number; exit: number | null };
type Step = { input: string; at: number; landing: number; edit?: 'on' | 'off' | 'air'; frontier?: true };
type State = { epoch: number; layout: Layout; refs: string[]; rejected: string[]; solidVerified: boolean };
type Proposal = NativeProposal & { local: State; scene: Scene; step: Step; attempt: string; needId: string };

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const actorPart = (part: Part) => part.area === 6 && width(part.bbox) === 2 && height(part.bbox) === 4;
const blockPart = (part: Part) => part.area === 21 && width(part.bbox) === 5 && height(part.bbox) === 5;
const blocked = (tile: Tile | undefined) => tile === 'wall' || tile === 'on' || tile === 'removable';
const directions = [['ACTION3', -1], ['ACTION4', 1]] as const;

function positions(rows: NativeRows, { phase: [x, y], pitch }: Pick<Layout, 'phase' | 'pitch'>): NativePoint[][] {
  const lines: NativePoint[][] = [], radius = Math.floor((pitch - 1) / 2);
  for (let v = y; v + radius < rows.length - pitch + 2; v += pitch) {
    if (v < radius) continue;
    const line: NativePoint[] = [];
    for (let u = x; u + radius < rows[0]!.length; u += pitch) if (u >= radius) line.push([u, v]);
    lines.push(line);
  }
  return lines;
}

function countColors(rows: NativeRows, [x, y]: NativePoint, pitch: number): Map<number, number> {
  const counts = new Map<number, number>(), radius = Math.floor((pitch - 1) / 2);
  for (let v = y - radius; v <= y + radius; v++) for (let u = x - radius; u <= x + radius; u++) {
    const ink = rows[v]![u]!;
    counts.set(ink, (counts.get(ink) ?? 0) + 1);
  }
  return counts;
}

function measureLayout(rows: NativeRows, parts: Part[]): Layout | null {
  const actors = parts.filter(actorPart), blocks = parts.filter(blockPart);
  if (actors.length !== 1 || blocks.length < 4) return null;
  const pitch = width(blocks[0]!.bbox) + 1, [x, y] = center(blocks[0]!.bbox);
  const phase: NativePoint = [x % pitch, y % pitch];
  if (!blocks.every(part => center(part.bbox).every((value, axis) => (value - phase[axis]!) % pitch === 0))) return null;
  const colors = [...new Set(blocks.map(part => part.color))];
  if (colors.length !== 2 || blocks.filter(part => part.color === colors[0]).length < 2
    || blocks.filter(part => part.color === colors[1]).length < 2) return null;
  const patches = positions(rows, { phase, pitch }).flat().map(point => countColors(rows, point, pitch));
  const uniform = new Map<number, number>();
  for (const patch of patches) if (patch.size === 1) {
    const ink = patch.keys().next().value!;
    uniform.set(ink, (uniform.get(ink) ?? 0) + 1);
  }
  const air = [...uniform].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (air === undefined || colors.includes(air)) return null;
  const sparse = colors.filter(ink => patches.filter(patch => patch.size === 2 && (patch.get(ink) ?? 0) > 0
    && patch.get(air) === (pitch - 1) ** 2 - patch.get(ink)! && patch.get(ink)! <= pitch).length >= 2);
  if (sparse.length !== 1) return null;
  return { pitch, phase, actor: actors[0]!.color, air, toggle: sparse[0]!, removable: colors.find(ink => ink !== sparse[0])! };
}

function readScene(rows: NativeRows, parts: Part[], layout: Layout): Scene | null {
  const { pitch, air, toggle, removable } = layout;
  const actors = parts.filter(part => part.color === layout.actor && actorPart(part));
  if (actors.length !== 1) return null;
  const actor = actors[0]!.bbox, grid = positions(rows, layout), columns = grid[0]?.length ?? 0;
  const sites = grid.flat(), [ax] = center(actor), ay = actor[1] + 2;
  const at = sites.findIndex(([x, y]) => Math.abs(x - ax) <= 1 && y === ay);
  if (at < 0 || !columns) return null;
  const exits = parts.filter(part => part.area === 5 && width(part.bbox) === 3 && height(part.bbox) === 3
    && ![air, toggle, removable, layout.actor].includes(part.color) && part.mask.every(([x, y]) => x === 1 || y === 1));
  const [goal] = exits;
  const exit = exits.length === 1 && goal ? sites.findIndex(([x, y]) => {
    const [gx, gy] = center(goal.bbox);
    return Math.abs(gx - x) <= 1 && Math.abs(gy - y) <= 1;
  }) : -1;
  const cells = (pitch - 1) ** 2;
  const tiles = sites.map<Tile>((point, i) => {
    if (i === exit) return 'exit';
    if (i === at) return 'air';
    const colors = countColors(rows, point, pitch);
    const toggled = colors.get(toggle) ?? 0;
    if (toggled === 21) return 'on';
    if (colors.get(removable) === 21) return 'removable';
    if (toggled > 0 && toggled <= pitch && colors.get(air) === cells - toggled) return 'off';
    if (colors.get(air) === cells) return 'air';
    return [...colors].some(([ink, count]) => ink !== air && count >= cells * 0.8) ? 'wall' : 'danger';
  });
  return { layout, actor, columns, tiles, at, exit: exit >= 0 ? exit : null };
}

function tilePoint(scene: Scene, index: number): NativePoint {
  const { phase: [x, y], pitch } = scene.layout, edge = Math.floor((pitch - 1) / 2);
  return [x + (Number(x < edge) + index % scene.columns) * pitch,
    y + (Number(y < edge) + Math.floor(index / scene.columns)) * pitch];
}

function tileBox(scene: Scene, index: number): NativeBox {
  const [x, y] = tilePoint(scene, index), radius = Math.floor((scene.layout.pitch - 1) / 2);
  return [x - radius, y - radius, x + radius, y + radius];
}

const signature = (scene: Scene, step: Step) => [scene.tiles.join(','), scene.at, step.input, step.at].join('/');

function choose(scene: Scene, rejected: readonly string[], remaining: number): Step | null {
  const { columns, tiles, at: start, exit } = scene;
  const editable = tiles.flatMap((tile, i) => ['off', 'on', 'removable'].includes(tile) ? [i] : []);
  if (editable.length > 30) return null;
  const bits = new Map(editable.map((at, i) => [at, 1 << i]));
  const cell = (index: number, mask: number): Tile | undefined => {
    const tile = tiles[index], flag = bits.get(index);
    if (!flag || !(mask & flag)) return tile;
    return tile === 'on' ? 'off' : tile === 'off' ? 'on' : 'air';
  };
  const settle = (from: number, mask: number) => {
    let clear = 0;
    for (let at = from; at >= 0; at -= columns) {
      const tile = cell(at, mask), above = cell(at - columns, mask);
      if (tile === 'exit') return { at };
      if (!tile || tile === 'danger' || blocked(tile)) return null;
      if (blocked(above)) return { at };
      clear++;
      if (!above && clear >= 3) return { at, frontier: true as const };
    }
    return null;
  };
  const offerableToggles = (loc: number, mask: number) => {
    const scope = new Set<number>();
    for (const offset of [-1, 0, 1]) {
      const x = loc % columns + offset;
      if (x < 0 || x >= columns) continue;
      for (let at = loc + offset; at >= 0; at -= columns) {
        const tile = cell(at, mask);
        if (at !== loc && bits.has(at) && (tile === 'on' || tile === 'off' || tile === 'removable')) scope.add(at);
        if (blocked(tile) || tile === 'danger') break;
      }
    }
    return [...scope];
  };
  type Node = { at: number; mask: number; first: Step | null; depth: number; frontier?: true };
  const queue: Node[] = [{ at: start, mask: 0, first: null, depth: 0 }], seen = new Set([start + '/0']);
  let highest = Math.floor(start / columns), best: Step | null = null;
  for (let i = 0; i < queue.length && i < 18000; i++) {
    const { at, mask, first, depth, frontier } = queue[i]!;
    if (at === exit && first) return first;
    const row = Math.floor(at / columns);
    const hasOutlet = [-1, 1].some(offset => {
      const x = at % columns + offset;
      const side = x >= 0 && x < columns ? cell(at + offset, mask) : null;
      return side === 'air' || side === 'exit' || side === 'off' || side === 'on' || side === 'removable';
    });
    if (first && hasOutlet && row < highest) { highest = row; best = first; }
    if (depth >= remaining || frontier) continue;
    const offer = (input: string, target: number, newMask: number, edit?: Step['edit']) => {
      const arrival = settle(edit ? at : target, newMask);
      if (!arrival) return;
      const { at: landing, frontier } = arrival;
      const key = landing + '/' + newMask;
      const step = { input, at: target, landing, ...(edit ? { edit } : {}), ...(frontier ? { frontier } : {}) };
      if (seen.has(key) || !first && rejected.length && rejected.includes(signature(scene, step))) return;
      seen.add(key);
      queue.push({ at: landing, mask: newMask, first: first ?? step, depth: depth + 1, ...(frontier ? { frontier } : {}) });
    };
    for (const [input, offset] of directions) {
      const x = at % columns + offset;
      if (x >= 0 && x < columns) offer(input, at + offset, mask);
    }
    for (const target of offerableToggles(at, mask)) {
      const tile = cell(target, mask);
      offer('ACTION6', target, mask ^ bits.get(target)!, tile === 'off' ? 'on' : tile === 'on' ? 'off' : 'air');
    }
  }
  return best;
}

function outcome(proposal: Proposal, rows: NativeRows): string | null {
  const { scene, step } = proposal, next = readScene(rows, geometricComponents(rows), scene.layout);
  if (!next || next.columns !== scene.columns || next.at % next.columns !== step.landing % scene.columns) return null;
  const sameTerrain = (offset: number) => {
    let matching = 0, fixed = 0;
    scene.tiles.forEach((tile, i) => {
      if (tile !== 'wall' && tile !== 'danger') return;
      const actual = next.tiles[i + offset];
      if (!actual || i + offset === next.at) return;
      fixed++;
      matching += Number(actual === tile);
    });
    return fixed >= 6 && matching >= fixed * 0.85;
  };
  const expected = next.at - step.landing;
  const shifts = step.frontier
    ? Array.from({ length: Math.ceil((next.tiles.length - expected) / next.columns) }, (_, i) => expected + i * next.columns)
    : [expected];
  const offset = shifts.find(sameTerrain);
  if (offset === undefined) return null;
  if (step.edit) {
    if (step.frontier && step.at + offset >= next.tiles.length) return 'safe_ascent_beyond_edited_cell';
    if (next.tiles[step.at + offset] !== step.edit) return null;
    return step.edit === 'on' ? 'protective_ceiling_solidified' : 'blocking_cell_opened';
  }
  return scene.tiles[step.landing - scene.columns] === 'on'
    ? 'movement_stopped_under_solidified_ceiling' : offset ? 'safe_ascent_and_camera_shift_observed' : 'safe_lateral_movement_observed';
}

export function createSicProtectGravityRoute(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: protectGravityRouteId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))) return null;
      const parts = geometricComponents(rows);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const layout = prior?.layout ?? measureLayout(rows, parts);
      if (!layout) return null;
      const scene = readScene(rows, parts, layout);
      const local = prior ?? { epoch: observation.level_epoch, layout, refs: [], rejected: [], solidVerified: false };
      const step = scene && choose(scene, local.rejected, remaining);
      if (!scene || !step) return null;
      const ref = observation.observation_ref, mode = execution?.reasoningMode ?? 'exploration';
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
      const point = tilePoint(scene, step.at), offer = { input: step.input, expected: tilePoint(scene, step.landing), evidence };
      const knownEdit = !!step.edit && !step.frontier && local.solidVerified;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: step.frontier || step.edit && !knownEdit ? offer : null,
        access: step.edit || step.frontier ? null : offer, interaction: knownEdit ? offer : null });
      if (!selected) return null;
      const ceiling = step.landing - scene.columns;
      const protective = step.edit === 'on' ? step.at : scene.tiles[ceiling] === 'on' ? ceiling : null;
      let danger: number | null = null;
      if (protective !== null) for (let i = protective - scene.columns; i >= 0; i -= scene.columns) {
        if (scene.tiles[i] === 'danger') { danger = i; break; }
        if (scene.tiles[i] === 'wall') break;
      }
      const situation = step.frontier ? 'Follow the clear column to check the terrain beyond the current view'
        : step.edit === 'on' ? 'Build a ceiling to stop the next ascent before the hazard'
        : step.edit ? 'Open the blocking cell after checking the resulting ascent'
        : scene.tiles[ceiling] === 'on' ? 'Move sideways under the solid ceiling'
          : 'Move to the next protected landing or the exit';
      const witness = step.edit ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: situation, evidence }) : null;
      if (step.edit && !witness) return null;
      const action: NativeCommand = { action_ref: step.input, data: step.edit ? { x: point[0], y: point[1] } : {} };
      const parent = 'G_official_completion';
      const goal = { kind: 'reach_exit_by_shaping_gravity_passage', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['moving_piece', 'editable_ceiling', 'hazards'], parentObjective: parent, satisfactionContract: 'official_progress_after_protected_ascent' };
      const need = { ...goal, id: sicNeedId(goal), status: 'assigned', evidence };
      const id = protectGravityRouteId + ':' + need.id;
      return {
        status: 'proposed', kind: protectGravityRouteId, local, scene, step, attempt: signature(scene, step), needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: tileBox(scene, step.landing), ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Reach the exit without rising into the visible hazards', situation, evidence,
          agenda: entries, mode, triggerCard: card, actor: scene.actor, focus: tileBox(scene, step.at),
          landing: tileBox(scene, step.landing), exit: scene.exit === null ? null : tileBox(scene, scene.exit),
          ceiling: protective === null ? null : tileBox(scene, protective), danger: danger === null ? null : tileBox(scene, danger) },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'gravity_step_bound' : 'gravity_view_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const reason = outcome(proposal, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'gravity_projection_contradicted' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, step } = proposal, confirmed = outcome(proposal, second);
      state = { ...local, refs: confirmed ? [...local.refs.slice(-5), after.observation_ref] : local.refs,
        solidVerified: local.solidVerified || confirmed === 'movement_stopped_under_solidified_ceiling',
        rejected: confirmed ? [] : [...local.rejected.slice(-12), proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
