import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeExecution, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';
import { chooseGravityReversal, gravityAttempt, gravityReturn, gravityStateKey, gravityTerrain, gravityTile, gravityTileBox,
  readReversibleGravity, startingGravity, type GravityHistory, type GravityStep, type GravityView } from './reversible-gravity.ts';
import { canPlanSupportChain, planSupportChain } from './gravity-support-route.ts';

export const protectGravityRouteId = 'sic_protect_gravity_route';

type Part = ReturnType<typeof geometricComponents>[number];
type Tile = 'air' | 'wall' | 'danger' | 'off' | 'on' | 'removable' | 'exit';
type Layout = { pitch: number; phase: NativePoint; actor: number; air: number; toggle: number; removable: number };
type Scene = { layout: Layout; actor: NativeBox; columns: number; tiles: Tile[]; at: number; exit: number | null };
type Step = { input: string; at: number; landing: number; edit?: 'on' | 'off' | 'air'; frontier?: true };
type State = { epoch: number; layout: Layout; refs: string[]; rejected: string[]; solidVerified: boolean };
type ProtectiveProposal = NativeProposal & { local: State; scene: Scene; step: Step; attempt: string; needId: string };
type ReversibleState = { epoch: number; geometry: Layout; memory: GravityHistory; refs: string[]; stopped: boolean; carriesProtection?: true };
type ReversalWitness = { epoch: number; geometry: Layout; direction: GravityHistory['direction']; refs: string[] };
type ReversibleProposal = NativeProposal & { reversal: ReversibleState; view: GravityView; advance: GravityStep; needId: string };
type Proposal = ProtectiveProposal | ReversibleProposal;

function observedReversal(proposal: ReversibleProposal, rows: NativeRows, frames: readonly NativeRows[]) {
  const { reversal, view, advance } = proposal;
  const read = (frame: NativeRows) => readReversibleGravity(frame, reversal.geometry, reversal.carriesProtection);
  const next = read(rows);
  if (!next) return null;
  const result = gravityReturn(view, next, advance, reversal.memory, () => {
    const stride = Math.max(1, Math.ceil(frames.length / 64));
    return frames.flatMap((frame, index) => {
      const measured = index % stride === 0 ? read(frame) : null;
      return measured ? [measured] : [];
    });
  });
  return result ? { next, result } : null;
}
const isReversible = (proposal: Proposal): proposal is ReversibleProposal => Object.hasOwn(proposal, 'reversal');

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

function outcome(proposal: ProtectiveProposal, rows: NativeRows): string | null {
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
  let reversal: ReversibleState | null = null;
  let reversalWitness: ReversalWitness | null = null;
  async function offerReversal(observation: NativeObservation, rows: NativeRows, remaining: number, execution?: NativeExecution): Promise<ReversibleProposal | null> {
    const { level_epoch: epoch, observation_ref: ref } = observation;
    const prior = reversal?.epoch === epoch ? reversal : null;
    const previous = state?.epoch === epoch - 1 && state.solidVerified ? state : null;
    const witnessed = reversalWitness?.epoch === epoch ? reversalWitness : null;
    const geometry = prior?.geometry ?? witnessed?.geometry ?? previous?.layout;
    if (!geometry || prior?.stopped) return null;
    const carriesProtection = prior?.carriesProtection || !!witnessed;
    const view = readReversibleGravity(rows, geometry, carriesProtection);
    if (!view) return null;
    const worldRow = Math.floor(view.at / view.width);
    const direction = witnessed ? startingGravity(view, witnessed.direction) : -1;
    const base: ReversibleState = prior ?? { epoch, geometry, refs: (witnessed?.refs ?? previous!.refs).slice(-3), stopped: false,
      ...(carriesProtection ? { carriesProtection: true } : {}),
      memory: { rowOrigin: 0, direction, highest: worldRow, lowest: worldRow, inverted: !!witnessed, denied: [],
        seen: [gravityStateKey(view, 0, direction)], terrain: gravityTerrain(view, 0) } };
    const heading = base.memory.supportHeading ?? (carriesProtection && canPlanSupportChain(view) ? base.memory.direction : undefined);
    const local = heading !== undefined && base.memory.supportHeading === undefined
      ? { ...base, memory: { ...base.memory, supportHeading: heading } } : base;
    const step = heading === undefined ? chooseGravityReversal(view, local.memory, remaining, carriesProtection)
      : planSupportChain(view, local.memory, remaining, heading);
    if (!step) return null;
    const mode = execution?.reasoningMode ?? 'exploration';
    const evidence: [string, ...string[]] = [ref, ...local.refs.filter(value => value !== ref)];
    const landing = Math.min(Math.max(0, Math.floor(step.landing / view.width)), view.tiles.length / view.width - 1) * view.width
      + (step.landing % view.width + view.width) % view.width;
    const front = step.frontier || landing !== step.landing, offer = { input: step.command.action_ref, expected: gravityTile(view, landing), evidence };
    const unknownEdit = step.edit === 'invert' && !local.memory.inverted;
    const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: front || unknownEdit ? offer : null,
      access: !step.edit && !front ? offer : null, interaction: step.edit && !front && !unknownEdit ? offer : null });
    if (!selected) return null;
    const situation = step.edit === 'invert' ? unknownEdit ? 'Test whether the newly visible block reverses the fall'
      : 'Reverse the fall after checking the visible and remembered path'
      : step.edit === 'solidify' ? 'Build a protective ceiling before entering the next column'
      : step.edit === 'open' ? 'Reopen the support now that the next landing is ready'
      : step.edit === 'remove' ? 'Remove the blocking tile to open the next fall'
        : front ? 'Reveal more terrain in the current direction' : 'Move sideways to the next safe landing';
    const point = gravityTile(view, step.index);
    const witness = step.edit ? await ObservedInputDomain.makeLocusWitness(observation, rows, point, { reason: situation, evidence }) : null;
    if (step.edit && !witness) return null;
    const parent = 'G_official_completion';
    const objective = { kind: 'reach_exit_with_reversible_gravity', scope: ref.split(':revision:', 1)[0]!,
      subjects: ['moving_piece', 'direction', 'remembered_terrain'], parentObjective: parent,
      satisfactionContract: 'official_progress_after_gravity_route' };
    const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
    const id = protectGravityRouteId + ':' + need.id, actions = [step.command];
    return { status: 'proposed', kind: protectGravityRouteId, reversal: local, view, advance: step, needId: need.id, actions,
      binding: { observation_ref: ref, level_epoch: epoch },
      steps: [{ action: step.command, expected_after: gravityTileBox(view, landing), ...(witness ? { point_binding: witness } : {}) }],
      sicSituationCard: { strategy: selected.id, need: 'Find a safe path to the exit by changing the direction of the fall', situation, evidence,
        agenda: entries, mode, triggerCard: card, actor: view.actor, focus: gravityTileBox(view, step.index), landing: gravityTileBox(view, landing),
        exit: view.exit === null ? null : gravityTileBox(view, view.exit), direction: local.memory.direction },
      question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
      compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
      sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
      bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
        preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
  }
  return {
    id: protectGravityRouteId,
    async propose(observation, rows, _inputs, remaining, execution) {
      if (remaining < 1 || !['ACTION3', 'ACTION4', 'ACTION6'].every(ref => observation.available_action_refs.includes(ref))) return null;
      if (reversal?.epoch === observation.level_epoch || reversalWitness?.epoch === observation.level_epoch) {
        return offerReversal(observation, rows, remaining, execution);
      }
      const parts = geometricComponents(rows);
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const layout = prior?.layout ?? measureLayout(rows, parts);
      if (!layout) return offerReversal(observation, rows, remaining, execution);
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
    after(proposal, _index, before, after, _first, second, frames = []) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      if (isReversible(proposal)) {
        const result = observedReversal(proposal, second, frames)?.result;
        const reason = result?.matched ? result.alignedThroughMemory ? 'gravity_landing_confirmed_by_remembered_terrain'
          : result.alignedThroughAnimation ? 'gravity_landing_confirmed_through_animation'
          : result.inverted ? 'reversed_fall_confirmed_by_terrain_alignment'
          : result.solidified ? 'protective_ceiling_solidified_in_reversible_path'
            : result.opened ? 'temporary_support_reopened_in_reversible_path'
            : proposal.advance.edit ? 'blocking_tile_removed_in_gravity_path'
            : 'gravity_landing_confirmed_by_terrain_alignment' : 'reversible_gravity_projection_contradicted';
        return { matched: !!result?.matched, seal_prefix: true, reason };
      }
      const reason = outcome(proposal, second);
      return { matched: !!reason, seal_prefix: true, reason: reason ?? 'gravity_projection_contradicted' };
    },
    record(before, after, _action, _first, second, proposal, _index, frames = []) {
      if (isReversible(proposal) && after.levels_completed > before.levels_completed && proposal.reversal.memory.inverted) {
        reversalWitness = { epoch: after.level_epoch, geometry: proposal.reversal.geometry, direction: proposal.advance.direction,
          refs: [...proposal.reversal.refs.slice(-3), after.observation_ref] };
      }
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      if (isReversible(proposal)) {
        const { reversal: local, advance, view } = proposal, { memory } = local;
        const checked = observedReversal(proposal, second, frames);
        if (!checked) {
          reversal = { ...local, stopped: true };
          return { events: [] };
        }
        const { next, result } = checked;
        const origin = memory.rowOrigin + result.shift, landing = memory.rowOrigin + result.landing;
        const direction = result.matched ? advance.direction : memory.direction;
        const terrain = { ...memory.terrain };
        if (advance.edit && result.removed) {
          terrain[[advance.index % view.width, memory.rowOrigin + Math.floor(advance.index / view.width)].join(',')] = 'air';
        }
        if (result.solidified) {
          terrain[[advance.index % view.width, memory.rowOrigin + Math.floor(advance.index / view.width)].join(',')] = 'ceiling_solid';
        }
        if (result.opened) {
          terrain[[advance.index % view.width, memory.rowOrigin + Math.floor(advance.index / view.width)].join(',')] = 'ceiling_open';
        }
        reversal = { ...local, refs: [...local.refs.slice(-5), after.observation_ref], memory: { ...memory, rowOrigin: origin, direction,
          terrain: gravityTerrain(next, origin, terrain), inverted: memory.inverted || result.inverted,
          ...(advance.edit === 'invert' && result.matched ? { reversedHere: true } : {}),
          highest: Math.min(memory.highest, landing), lowest: Math.max(memory.lowest, landing),
          seen: [...new Set([...memory.seen, gravityStateKey(next, origin, direction)])],
          denied: result.matched ? memory.denied : [...memory.denied.slice(-16), gravityAttempt(view, advance, memory)] } };
        return { events: [] };
      }
      const { local, step } = proposal, confirmed = outcome(proposal, second);
      state = { ...local, refs: confirmed ? [...local.refs.slice(-5), after.observation_ref] : local.refs,
        solidVerified: local.solidVerified || confirmed === 'movement_stopped_under_solidified_ceiling',
        rejected: confirmed ? [] : [...local.rejected.slice(-12), proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state, reversal, ...(reversalWitness ? { reversalWitness } : {}) }),
    restore(value: NativeRecord) {
      state = structuredClone(value.state as State | null);
      reversal = structuredClone(value.reversal as ReversibleState | null ?? null);
      reversalWitness = structuredClone((value.reversalWitness as ReversalWitness | undefined) ?? null);
    },
  };
}
