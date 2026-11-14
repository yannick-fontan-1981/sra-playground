import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const navigateRevealedGridId = 'sic_navigate_revealed_grid';

type Part = ReturnType<typeof geometricComponents>[number];
type Grid = { box: NativeBox; pitch: number; columns: number; size: number; tint: number; base: number; actor: number; enemy: number; trail: number;
  goal: number; charges: NativePoint[] };
type Cell = 'wall' | 'free';
type Reading = { position: number; obstacle: number | null; risk: number[]; memory: Partial<Record<number, Cell>>; charges: number };
type State = { epoch: number; grid: Grid; last: Reading; previousObstacle: number | null; refs: string[]; consecutiveWaits: number };
type Choice = { action: NativeCommand; kind: 'pulse' | 'wait' | 'move'; target: number; uncertain: boolean };
type Proposal = NativeProposal & { local: State; choice: Choice; needId: string };

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION4', 1, 0], ['ACTION3', -1, 0]] as const;
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const colorAt = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];

function tile(grid: Grid, index: number): NativeBox {
  const x = grid.box[0] + index % grid.columns * grid.pitch;
  const y = grid.box[1] + Math.floor(index / grid.columns) * grid.pitch;
  return [x, y, x + grid.pitch - 1, y + grid.pitch - 1];
}

function measure(rows: NativeRows): Grid | null {
  const parts = geometricComponents(rows), candidates: Grid[] = [];
  const outlines = parts.filter(p => width(p.bbox) >= 24 && height(p.bbox) >= 24
    && p.area >= 2 * (width(p.bbox) + height(p.bbox) - 2)
    && p.area < width(p.bbox) * height(p.bbox) / 4);
  for (const frame of outlines) {
    const box: NativeBox = [frame.bbox[0] + 1, frame.bbox[1] + 1, frame.bbox[2] - 1, frame.bbox[3] - 1];
    const [x, y] = box, tint = frame.color;
    const base = rows[y]?.[x + 1];
    if (base === undefined || base === tint) continue;
    const inside = (p: Part) => p.bbox[0] >= box[0] && p.bbox[1] >= box[1] && p.bbox[2] <= box[2] && p.bbox[3] <= box[3];
    for (let pitch = 4; pitch <= 9; pitch++) {
      if (width(box) % pitch || height(box) % pitch) continue;
      const columns = width(box) / pitch, size = columns * height(box) / pitch;
      const dots = Array.from({ length: size }, (_, i) => [x + i % columns * pitch, y + Math.floor(i / columns) * pitch] as const);
      if (dots.filter(([a, b]) => rows[b]?.[a] === tint && rows[b]?.[a + 1] === base).length < size * 0.8) continue;
      const squareFrames = parts.filter(p => inside(p) && width(p.bbox) === pitch && height(p.bbox) === pitch
        && (p.bbox[0] - x) % pitch === 0 && (p.bbox[1] - y) % pitch === 0 && p.color !== base && p.color !== tint && !p.rectangular);
      if (squareFrames.length !== 2) continue;
      const goalFrames = squareFrames.filter(p => colorAt(rows, center(p.bbox)) === base);
      if (goalFrames.length !== 1) continue;
      const goalFrame = goalFrames[0]!, enemyFrame = squareFrames.find(p => p !== goalFrame)!;
      const trail = colorAt(rows, center(enemyFrame.bbox));
      if (trail === undefined || trail === enemyFrame.color || trail === tint) continue;
      const bodies = parts.filter(p => inside(p) && p.color !== base && p.color !== tint && width(p.bbox) === height(p.bbox)
        && width(p.bbox) >= 2 && width(p.bbox) <= pitch / 2 && !p.rectangular
        && !squareFrames.some(f => p.bbox[0] >= f.bbox[0] && p.bbox[1] >= f.bbox[1] && p.bbox[2] <= f.bbox[2] && p.bbox[3] <= f.bbox[3]));
      if (bodies.length !== 1) continue;
      const badges = parts.filter(p => p.color === enemyFrame.color && p.rectangular && p.bbox[3] < y
        && width(p.bbox) >= 2 && width(p.bbox) <= pitch && height(p.bbox) >= 2 && height(p.bbox) <= pitch);
      if (!badges.length) continue;
      const goal = ((goalFrame.bbox[1] - y) / pitch) * columns + (goalFrame.bbox[0] - x) / pitch;
      candidates.push({ box, pitch, columns, size, tint, base, actor: bodies[0]!.color, enemy: enemyFrame.color, trail,
        goal, charges: badges.map(p => center(p.bbox)) });
    }
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function read(rows: NativeRows, grid: Grid, prior?: Reading): Reading | null {
  const memory = { ...prior?.memory }, risk = new Set(prior?.risk);
  const positions: number[] = [], obstacles: number[] = [];
  for (let i = 0; i < grid.size; i++) {
    const [x, y] = tile(grid, i), m = Math.floor(grid.pitch / 2);
    const a = rows[y]?.[x], b = rows[y]?.[x + 1], c = rows[y + 1]?.[x + 1], d = rows[y + m]?.[x + m];
    const occupied = d === grid.actor && a !== grid.enemy && i !== grid.goal;
    if (occupied) positions.push(i);
    if (a === grid.enemy) obstacles.push(i);
    if (a === grid.enemy || d === grid.trail) risk.add(i);
    if (i === grid.goal || occupied) memory[i] = 'free';
    else if (a === grid.enemy) continue;
    else if (a === b && c !== b && a !== grid.tint && a !== grid.base) memory[i] = 'wall';
    else if (a === grid.tint && b === a && c === a && memory[i] !== 'wall') memory[i] = 'free';
  }
  if (positions.length !== 1 || obstacles.length > 1) return null;
  return { position: positions[0]!, obstacle: obstacles[0] ?? null, risk: [...risk], memory,
    charges: grid.charges.filter(p => colorAt(rows, p) === grid.enemy).length };
}

function route(reading: Reading, grid: Grid): { action: string; target: number } | null {
  const start = reading.position, risk = new Set(reading.risk);
  type Candidate = { index: number; cost: number; first: { action: string; target: number } | null };
  const queue: Candidate[] = [{ index: start, cost: 0, first: null }], best = new Map([[start, 0]]);
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const { index, cost, first } = queue.shift()!;
    if (cost !== best.get(index)) continue;
    if (index === grid.goal) return first;
    for (const [action, dx, dy] of directions) {
      const x = index % grid.columns + dx, y = Math.floor(index / grid.columns) + dy;
      const target = y * grid.columns + x;
      if (x < 0 || x >= grid.columns || y < 0 || target >= grid.size || reading.memory[target] === 'wall') continue;
      const nextCost = cost + 1 + (reading.memory[target] ? 0 : 2) + (risk.has(target) ? 8 : 0);
      if (nextCost >= (best.get(target) ?? Infinity)) continue;
      best.set(target, nextCost);
      queue.push({ index: target, cost: nextCost, first: first ?? { action, target } });
    }
  }
  return null;
}

function choose({ grid, last, previousObstacle, consecutiveWaits }: State): Choice | null {
  const next = route(last, grid);
  if (!next) return null;
  const target = next.target, uncertain = !last.memory[target], obstacle = last.obstacle;
  const approaching = obstacle !== null && previousObstacle !== null && target === 2 * obstacle - previousObstacle;
  const wait = obstacle === target || approaching;
  if (last.charges && (!Object.keys(last.memory).some(i => Number(i) !== grid.goal && Number(i) !== last.position) || uncertain)) {
    return { action: { action_ref: 'ACTION5', data: {} }, kind: 'pulse', target, uncertain: true };
  }
  if (wait) {
    if (consecutiveWaits >= 2 * Math.max(1, last.risk.length)) return null;
    return { action: { action_ref: 'ACTION5', data: {} }, kind: 'wait', target, uncertain: true };
  }
  return { action: { action_ref: next.action, data: {} }, kind: 'move', target, uncertain };
}

export function createSicNavigateRevealedGrid(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: navigateRevealedGridId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5', ...directions.map(([id]) => id)].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const grid = prior?.grid ?? measure(rows);
      if (!grid) return null;
      const last = read(rows, grid, prior?.last);
      if (!last) return null;
      const local = prior ? { ...prior, last } : { epoch: observation.level_epoch, grid, last, previousObstacle: null, refs: [], consecutiveWaits: 0 };
      const choice = choose(local);
      if (!choice) return null;
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const target = tile(grid, choice.target), offer = { input: choice.action.action_ref, expected: center(target), evidence };
      const known = choice.kind === 'move' && !choice.uncertain;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence, probe: known ? null : offer,
        access: known ? offer : null, interaction: null });
      if (!selected) return null;
      const situation = choice.kind === 'pulse' ? 'Reveal nearby cells before taking an uncertain route'
        : choice.kind === 'wait' ? 'Check the next phase of the moving obstacle before crossing'
          : choice.uncertain ? 'Test the next unconfirmed cell on the route' : 'Follow the route through observed open cells';
      const parent = 'G_official_completion';
      const objective = { kind: 'navigate_with_partially_revealed_terrain', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['controlled_sprite', 'revealed_cells', 'moving_obstacle', 'exit'], parentObjective: parent, satisfactionContract: 'official_progress_at_visible_exit' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = navigateRevealedGridId + ':' + need.id, action = choice.action;
      return {
        status: 'proposed', kind: navigateRevealedGridId, local, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: choice.kind === 'move' ? target : null }],
        sicSituationCard: { strategy: selected.id, need: 'Find a passable route to the exit', situation, evidence, agenda: entries, mode,
          triggerCard: card, actor: tile(grid, last.position), target, exit: tile(grid, grid.goal),
          obstacle: last.obstacle === null ? null : tile(grid, last.obstacle), revealedWalls: Object.values(last.memory).filter(v => v === 'wall').length },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'revealed_grid_bound' : 'revealed_grid_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const { local, choice } = proposal, next = read(second, local.grid, local.last);
      if (!next) return { matched: false, seal_prefix: true, reason: 'grid_return_unreadable' };
      const matched = choice.kind === 'pulse' ? next.charges < local.last.charges && Object.keys(next.memory).length > Object.keys(local.last.memory).length
        : choice.kind === 'move' ? next.position === choice.target : null;
      return { matched, seal_prefix: true, reason: choice.kind === 'pulse' ? 'check_revealed_cells' : choice.kind === 'move'
        ? matched ? 'observed_grid_step' : 'grid_step_contradicted' : 'observe_obstacle_phase' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, choice } = proposal, next = read(second, local.grid, local.last);
      if (!next) return { events: [] };
      if (choice.kind === 'move' && next.position === local.last.position && next.obstacle !== choice.target && !next.risk.includes(choice.target)) {
        next.memory[choice.target] = 'wall';
      }
      state = { ...local, last: next, previousObstacle: next.obstacle !== local.last.obstacle ? local.last.obstacle : local.previousObstacle,
        refs: [...local.refs.slice(-4), after.observation_ref],
        consecutiveWaits: choice.kind === 'wait' ? local.consecutiveWaits + 1 : 0 };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
