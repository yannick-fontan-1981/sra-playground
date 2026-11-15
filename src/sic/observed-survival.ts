import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedSurvivalId = 'sic_preserve_room_to_survive';

const moves = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const key = ([x, y]: NativePoint) => `${x},${y}`;
const inside = ([x, y]: NativePoint, [l, t, r, b]: NativeBox) => l <= x && x <= r && t <= y && y <= b;
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const distance = (a: NativePoint, b: NativePoint) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

type Arena = { bounds: NativeBox; pitch: number; outline: number; floor: number; wall: number };
type Horizon = { row: number; start: number; spacing: number; pending: number; completed: number };
type Context = { epoch: number; arena: Arena; horizon: Horizon | null; rounds: number; wins: number; refs: string[] };
type Scene = { actor: NativePoint; rivals: NativePoint[]; open: Set<string> };
type Move = { action: typeof moves[number][0]; to: NativePoint };
type Proposal = NativeProposal & { move: Move; needId: string; turns: number };
type Part = ReturnType<typeof geometricComponents>[number];

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const fit = (inner: NativeBox, outer: NativeBox) => inside([inner[0], inner[1]], outer) && inside([inner[2], inner[3]], outer);
const corner = ([x, y]: NativeBox): NativePoint => [x, y];

function measureArena(rows: NativeRows): Arena | null {
  const parts = geometricComponents(rows);
  const backdrop = parts.filter(p => width(p.bbox) === rows[0]!.length).sort((a, b) => b.area - a.area)[0];
  if (!backdrop) return null;
  const candidates: Arena[] = [];
  for (const actor of parts) {
    const pitch = width(actor.bbox), [x, y] = actor.bbox;
    if (pitch < 3 || pitch > 8 || height(actor.bbox) !== pitch || actor.area !== 4 * (pitch - 1)
      || rows[y + 1]?.[x + 1] === actor.color || !fit(actor.bbox, backdrop.bbox)) continue;
    const aligned = (part: Part) => part.color !== backdrop.color && fit(part.bbox, backdrop.bbox)
      && (part.bbox[0] - x) % pitch === 0 && (part.bbox[1] - y) % pitch === 0
      && width(part.bbox) % pitch === 0 && height(part.bbox) % pitch === 0;
    const supports = parts.filter(aligned), fills = supports.filter(part => part.rectangular && part.area >= pitch * pitch);
    if (!fills.length) continue;
    const wall = new Map<number, number>();
    for (const p of fills) wall.set(p.color, (wall.get(p.color) ?? 0) + p.area);
    const ordered = [...wall].sort((a, b) => b[1] - a[1]);
    if (!ordered[0] || ordered[0][1] < 2 * pitch * pitch || ordered[0][1] === ordered[1]?.[1]) continue;
    const bounds: NativeBox = [Math.min(...supports.map(p => p.bbox[0])), Math.min(...supports.map(p => p.bbox[1])),
      Math.max(...supports.map(p => p.bbox[2])), Math.max(...supports.map(p => p.bbox[3]))];
    if (width(bounds) < 3 * pitch || height(bounds) < 3 * pitch) continue;
    candidates.push({ bounds, pitch, outline: actor.color, floor: backdrop.color, wall: ordered[0][0] });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

function readRoom(rows: NativeRows, { bounds: [l, t, r, b], pitch, outline, floor, wall }: Arena): Scene | null {
  const open = new Set<string>(), rivals: NativePoint[] = [], actors: NativePoint[] = [];
  for (let y = t; y + pitch - 1 <= b; y += pitch) for (let x = l; x + pitch - 1 <= r; x += pitch) {
    const point: NativePoint = [(x - l) / pitch, (y - t) / pitch], center = rows[y + Math.floor(pitch / 2)]![x + Math.floor(pitch / 2)]!;
    let uniform = true, border = true;
    for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
      const cell = rows[y + dy]![x + dx]!;
      uniform &&= cell === center;
      if (dx === 0 || dy === 0 || dx === pitch - 1 || dy === pitch - 1) border &&= cell === outline;
    }
    if (uniform) {
      if (center === floor) open.add(key(point));
      else if (center !== wall) rivals.push(point);
    } else if (border && center !== outline && center !== floor && center !== wall) actors.push(point);
  }
  return actors.length === 1 && rivals.length > 0 ? { actor: actors[0]!, rivals, open } : null;
}

function visibleHorizon(first: NativeRows, second: NativeRows, arena: Arena): Horizon | null {
  const found: Horizon[] = [];
  for (let row = arena.bounds[3] + 1; row < first.length; row++) {
    const line = first[row]!, after = second[row]!;
    const changes = line.flatMap((cell, x) => cell === after[x] ? [] : [x]);
    if (changes.length !== 1) continue;
    const x = changes[0]!, pending = line[x]!, completed = after[x]!;
    const next = line.findIndex((value, index) => index > x && value === pending);
    const spacing = next - x;
    if (spacing < 2 || line[next + spacing] !== pending || line[x + 1] === pending) continue;
    let start = x;
    while (start - spacing >= 0 && line[start - spacing] === completed && line[start - 1] === line[x + 1]) start -= spacing;
    found.push({ row, start, spacing, pending, completed });
  }
  return found.length === 1 ? found[0]! : null;
}

function roundsLeft(rows: NativeRows, horizon: Horizon) {
  const { row, start, spacing, pending, completed } = horizon, line = rows[row]!;
  let turns = 0, slots = 0;
  for (let x = start; x < line.length; x += spacing) {
    if (line[x] !== completed && line[x] !== pending) break;
    turns += Number(line[x] === pending);
    slots++;
  }
  return slots >= 3 ? turns : null;
}

function options(scene: Scene, at: NativePoint, visited: ReadonlySet<string>): Move[] {
  return moves.flatMap(([action, dx, dy]) => {
    const to: NativePoint = [at[0] + dx, at[1] + dy];
    return scene.open.has(key(to)) && !visited.has(key(to)) ? [{ action, to }] : [];
  });
}

function survivalMove(scene: Scene, turns: number): Move | null {
  const exposure = (at: NativePoint) => scene.rivals.reduce((total, rival) => {
    const steps = distance(at, rival);
    return total + (steps <= 1 ? 10 : 1 / (steps * steps));
  }, 0);
  function forecast(at: NativePoint, remaining: number, visited: ReadonlySet<string>): number {
    if (!remaining) return 0;
    const moves = options(scene, at, visited);
    return moves.length ? Math.min(...moves.map(({ to }) => exposure(to) + 0.45 * forecast(to, remaining - 1, new Set([...visited, key(to)])))) : 20;
  }
  const visited = new Set([key(scene.actor)]);
  return options(scene, scene.actor, visited).map(move => ({
    move, cost: exposure(move.to) + 0.45 * forecast(move.to, Math.min(turns - 1, 3), new Set([...visited, key(move.to)])),
  })).sort((a, b) => a.cost - b.cost)[0]?.move ?? null;
}

function box({ bounds: [l, t], pitch }: Arena, [x, y]: NativePoint): NativeBox {
  return [l + x * pitch, t + y * pitch, l + (x + 1) * pitch - 1, t + (y + 1) * pitch - 1];
}

export function createSicObservedSurvival(): NativeFamily<Proposal> {
  let context: Context | null = null;
  function observe(before: NativeObservation, after: NativeObservation, first: NativeRows, second: NativeRows) {
    const current = context?.epoch === before.level_epoch ? context : null;
    if (after.levels_completed > before.levels_completed) {
      if (current && current.horizon && current.rounds > 0 && roundsLeft(first, current.horizon) === 1) {
        context = { ...current, epoch: after.level_epoch, wins: current.wins + 1, rounds: 0,
          refs: [...current.refs.slice(-3), after.observation_ref] };
      }
      return;
    }
    if (before.level_epoch !== after.level_epoch) return;
    const arena = current?.arena ?? measureArena(first);
    if (!arena) return;
    const prior = readRoom(first, arena), next = readRoom(second, arena);
    if (!prior || !next || distance(prior.actor, next.actor) !== 1 || next.open.has(key(prior.actor))) return;
    const horizon = current?.horizon ?? visibleHorizon(first, second, arena);
    if (!horizon) return;
    const remaining = roundsLeft(first, horizon);
    if (remaining === null || roundsLeft(second, horizon) !== remaining - 1) return;
    context = { epoch: before.level_epoch, arena, horizon, rounds: (current?.rounds ?? 0) + 1, wins: current?.wins ?? 0,
      refs: [...(current?.refs ?? [before.observation_ref]).slice(-4), after.observation_ref] };
  }
  return {
    id: observedSurvivalId,
    observePublicOutcome(before, after, command, first, second, frames = []) {
      if (frames.length < 4 || before.available_action_refs.includes('ACTION6') || !moves.some(([input]) => input === command.action_ref)) return;
      observe(before, after, first, second);
    },
    propose(observation, rows, inputs, remaining) {
      if (!context || context.epoch !== observation.level_epoch || context.wins < 2 || !context.horizon || remaining < 1) return null;
      const { arena, refs, horizon } = context, scene = readRoom(rows, arena), turns = roundsLeft(rows, horizon);
      if (!scene || turns === null || turns < 1) return null;
      const move = survivalMove(scene, turns), action = inputs.find(input => input.action_ref === move?.action);
      if (!move || !action) return null;
      const ref = observation.observation_ref, parent = 'G_official_completion';
      const evidence: [string, ...string[]] = [ref, ...refs.filter(value => value !== ref)];
      const objective = { kind: 'preserve_continuation_until_rounds_complete', scope: ref.split(':revision:', 1)[0]!,
        subjects: [`visible_round_counter:${horizon.row}`], parentObjective: parent, satisfactionContract: 'rounds_completed_with_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `survival:${need.id}`, reason = 'Choose open space with less exposure to the other moving pieces';
      const nearest = [...scene.rivals].sort((a, b) => distance(move.to, a) - distance(move.to, b))[0]!;
      const actions = [action];
      return { status: 'proposed', kind: observedSurvivalId, actions, move, turns, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: { position: move.to, rounds_left: turns - 1 } }],
        sicSituationCard: { strategy: 'P07', mode: 'solving', need: 'Stay alive until the visible round counter is complete',
          situation: reason, evidence, agenda: [], controlledPiece: box(arena, scene.actor),
          addressedRegion: box(arena, move.to), nearestRival: box(arena, nearest), turns },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy: 'P07', objective: { id, label: reason, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'survival_room_bound' : 'survival_room_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const scene = context && readRoom(second, context.arena);
      const matched = !!scene && same(scene.actor, proposal.move.to) && !!context?.horizon
        && roundsLeft(second, context.horizon) === proposal.turns - 1;
      return { matched, seal_prefix: true, reason: matched ? 'position_and_round_confirmed' : 'survival_projection_contradicted' };
    },
    record(before, after, _command, first, second, _proposal) {
      observe(before, after, first, second);
      return { events: [] };
    },
    state: () => ({ context }),
    restore(value: NativeRecord) { context = structuredClone((value.context as Context | null | undefined) ?? null); },
  };
}
