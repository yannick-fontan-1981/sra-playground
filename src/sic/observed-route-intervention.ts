import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import { outlineSameBox } from '../logos-engine/v6-outline-geometry.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const observedRouteInterventionId = 'sic_intervene_on_observed_route';

export type RouteInterventionWitness = {
  epoch: number; score: number; actor: number; carrier: number; wall: number; pitch: number; refs: string[]; routeVerified?: boolean;
};

type Grid = { bounds: NativeBox; pitch: number; width: number; height: number; floor: number; inset: number; frame: number };
type Rival = { id: string; color: number; cell: number; cue: number | null };
type Scene = { actor: number; carrier: number; exit: number; cue: number | null; walls: number[]; rails: number[];
  rivals: Rival[] };
type Memory = { epoch: number; grid: Grid; cells: Pick<Scene, 'walls' | 'rails' | 'exit'> & { rivals?: Rival[] };
  visited: number[]; intercept: string | null; caged: string[]; refs: string[]; count: number;
  forecast?: boolean; opening?: number; shield?: { cell: number; rivalId: string } };
type Intervention = 'contain' | 'divert' | 'open' | 'accompany' | 'shield';
type Choice = { kind: Intervention; target: number; action: string; actor: number; carrier: number | null;
  toggle: boolean; rival: Scene['rivals'][number] | null };
type Proposal = NativeProposal & { memory: Memory; scene: Scene; choice: Choice; needId: string };

const directions = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
const localCommand = 'ACTION5';
const column = (grid: Grid, cell: number) => cell % grid.width;
const row = (grid: Grid, cell: number) => Math.floor(cell / grid.width);
const distance = (grid: Grid, a: number, b: number) => Math.abs(column(grid, a) - column(grid, b)) + Math.abs(row(grid, a) - row(grid, b));
const inside = (grid: Grid, at: number) => column(grid, at) > 0 && column(grid, at) < grid.width - 1
  && row(grid, at) > 0 && row(grid, at) < grid.height - 1;

function neighbors(grid: Grid, at: number) {
  const x = column(grid, at), y = row(grid, at);
  return directions.flatMap(([action, dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx < 0 || nx >= grid.width || ny < 0 || ny >= grid.height ? [] : [{ action, cell: ny * grid.width + nx }];
  });
}

function cellBox(grid: Grid, at: number): NativeBox {
  const x = grid.bounds[0] + 1 + column(grid, at) * grid.pitch, y = grid.bounds[1] + 1 + row(grid, at) * grid.pitch;
  return [x, y, x + grid.pitch - 1, y + grid.pitch - 1];
}

function mostCommon(counts: Map<number, number>): number | null {
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function matchCells(grid: Grid, from: readonly number[], to: readonly number[], cost = (a: number, b: number) => distance(grid, a, b)) {
  const pairs = from.flatMap(a => to.map(b => ({ a, b, cost: cost(a, b) }))).sort((a, b) => a.cost - b.cost);
  const found = new Map<number, number>(), used = new Set<number>();
  for (const { a, b } of pairs) {
    if (found.has(a) || used.has(b)) continue;
    found.set(a, b);
    used.add(b);
  }
  return found;
}

function trackRivals(grid: Grid, color: number, cells: number[], cues: number[], previous: Rival[], walls: Set<number>): Rival[] {
  const old = previous.filter(rival => rival.color === color), byCell = new Map(old.map(rival => [rival.cell, rival]));
  const linked = matchCells(grid, cells, old.map(rival => rival.cell), (current, last) =>
    current === last ? 0 : byCell.get(last)?.cue === current ? 1 : 2 + distance(grid, current, last));
  const intentions = cells.length === 1 && cues.length
    ? new Map([[cells[0]!, cues.at(-1)!]]) : matchCells(grid, cells.filter(cell => !walls.has(cell)), cues);
  const used = new Set(old.map(rival => rival.id));
  return cells.map(cell => {
    let id = byCell.get(linked.get(cell) ?? -1)?.id;
    if (!id) {
      const stem = cells.length === 1 ? String(color) : `${color}:${cell}`;
      id = stem;
      for (let occurrence = 2; used.has(id); occurrence++) id = `${stem}:${occurrence}`;
      used.add(id);
    }
    return { id, color, cell, cue: intentions.get(cell) ?? null };
  });
}

function gridOn(rows: NativeRows, { actor, carrier, wall, pitch }: RouteInterventionWitness): Grid | null {
  const fits: Grid[] = [];
  for (const part of geometricComponents(rows)) {
    const [l, t, r, b] = part.bbox, width = (r - l - 1) / pitch, height = (b - t - 1) / pitch;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || width * height > 256
      || part.area !== 2 * (r - l + b - t) || !outlineSameBox(rows, part.bbox, part.color)) continue;
    const grid = { bounds: part.bbox, pitch, width, height, floor: -1, inset: -1, frame: part.color };
    const rims = new Map<number, number>(), centers = new Map<number, number>();
    let controlled = 0, destinations = 0;
    for (let at = 0; at < width * height; at++) {
      const box = cellBox(grid, at), [x, y] = box, rim = rows[y]![x]!, inner = rows[y + 1]![x + 1]!;
      if (rim === actor && outlineSameBox(rows, box, actor)) controlled++;
      if (rim === carrier && outlineSameBox(rows, box, carrier)) destinations++;
      if ([actor, carrier, wall, part.color].includes(rim) || rows[y + 1]![x] !== rim || rows[y]![x + 1] !== rim) continue;
      rims.set(rim, (rims.get(rim) ?? 0) + 1);
      if (inner !== rim && rows[y + 2]![x + 2] === inner) centers.set(inner, (centers.get(inner) ?? 0) + 1);
    }
    const floor = mostCommon(rims), inset = mostCommon(centers);
    if (controlled === 1 && destinations === 1 && floor !== null && inset !== null && (centers.get(inset) ?? 0) >= 3) {
      fits.push({ ...grid, floor, inset });
    }
  }
  return fits.length === 1 ? fits[0]! : null;
}

function project(rows: NativeRows, grid: Grid, roles: RouteInterventionWitness, prior: Memory['cells']): Scene | null {
  const walls = new Set<number>(), rails = new Set(prior.rails), oldWalls = new Set(prior.walls);
  const bodies = new Map<number, number[]>(), markers = new Map<number, number[]>();
  const terrain = new Set([roles.wall, roles.actor, grid.floor, grid.inset, grid.frame]);
  let actor = -1, exit = prior.exit;
  for (let cell = 0; cell < grid.width * grid.height; cell++) {
    const box = cellBox(grid, cell), [x, y] = box, rim = rows[y]![x]!;
    const control = rim === roles.actor && outlineSameBox(rows, box, roles.actor);
    if (control) actor = cell;
    if (rim === roles.carrier && rows[y]![x + 1] === rim && rows[y + 1]![x] === rim) exit = cell;
    const inner: number[] = [], sprite: number[] = [];
    for (let dy = 1; dy < grid.pitch; dy++) for (let dx = 1; dx < grid.pitch; dx++) {
      const value = rows[y + dy]![x + dx]!;
      sprite.push(value);
      if (dy < grid.pitch - 1 && dx < grid.pitch - 1) inner.push(value);
    }
    const covered = control && inner.every(pixel => !terrain.has(pixel) || pixel === roles.actor);
    if ((rim === roles.wall && rows[y]![x + 1] === rim && rows[y + 1]![x] === rim)
      || (control && inner.includes(roles.wall)) || (covered && oldWalls.has(cell))) walls.add(cell);
    if (inner.includes(grid.inset)) rails.add(cell);
    const pixels = control ? inner : sprite;
    const counts = new Map<number, number>();
    for (const value of pixels) if (!terrain.has(value)) counts.set(value, (counts.get(value) ?? 0) + 1);
    const color = mostCommon(counts);
    if (color !== null && counts.get(color)! >= pixels.length - Number(!control)
      && !(cell === exit && color !== roles.carrier)) {
      bodies.set(color, [...(bodies.get(color) ?? []), cell]);
    }
    const carrierMark = rows[y + 1]![x + 1]!;
    const rivalMark = rows[y + grid.pitch - 2]![x + grid.pitch - 2]!;
    if (carrierMark === roles.carrier && !bodies.get(roles.carrier)?.includes(cell)) markers.set(roles.carrier, [...(markers.get(roles.carrier) ?? []), cell]);
    if (rivalMark !== roles.carrier && !terrain.has(rivalMark) && !bodies.get(rivalMark)?.includes(cell)) {
      markers.set(rivalMark, [...(markers.get(rivalMark) ?? []), cell]);
    }
  }
  const carrier = bodies.get(roles.carrier);
  if (actor < 0 || exit < 0 || carrier?.length !== 1 || bodies.size < 2) return null;
  rails.add(exit);
  return { actor, exit, carrier: carrier[0]!, cue: markers.get(roles.carrier)?.at(-1) ?? null, walls: [...walls], rails: [...rails],
    rivals: [...bodies].flatMap(([color, cells]) => color === roles.carrier ? []
      : trackRivals(grid, color, cells, markers.get(color) ?? [], prior.rivals ?? [], walls)) };
}

function shortCorridor(grid: Grid, scene: Scene, visited: readonly number[]): number[] {
  const best = new Map([[scene.carrier, 0]]), queue = [{ at: scene.carrier, cost: 0, path: [scene.carrier] }];
  const walls = new Set(scene.walls), rails = new Set(scene.rails), past = new Set(visited);
  const occupied = new Set(scene.rivals.map(rival => rival.cell));
  while (queue.length) {
    queue.sort((a, b) => b.cost - a.cost);
    const current = queue.pop()!;
    if (current.cost !== best.get(current.at)) continue;
    if (current.at === scene.exit) return current.path;
    for (const { cell } of neighbors(grid, current.at)) {
      if (!inside(grid, cell)) continue;
      const cost = current.cost + 1 + (walls.has(cell) ? 3.5 : 0) + (rails.has(cell) ? 0 : 0.4)
        + (walls.has(cell) && occupied.has(cell) ? 8 : 0) + (past.has(cell) ? 0.25 : 0);
      if (cost >= (best.get(cell) ?? Infinity)) continue;
      best.set(cell, cost);
      queue.push({ at: cell, cost, path: [...current.path, cell] });
    }
  }
  return [];
}

function entranceOptions(scene: Scene, grid: Grid, path: number[]) {
  const pathSet = new Set(path), walls = new Set(scene.walls);
  const horizon = Math.max(grid.width, grid.height);
  return scene.rivals.flatMap(rival => {
    if (walls.has(rival.cell) || pathSet.has(rival.cell)) return [];
    const distances = new Map([[rival.cell, 0]]), queue = [rival.cell];
    for (const cell of queue) for (const { cell: step } of neighbors(grid, cell)) {
      if (!inside(grid, step) || walls.has(step) || distances.has(step) || pathSet.has(step)) continue;
      distances.set(step, distances.get(cell)! + 1);
      queue.push(step);
    }
    return path.flatMap((entry, time) => {
      if (time < 3 || time > horizon) return [];
      return neighbors(grid, entry).flatMap(({ cell }) => {
        if (pathSet.has(cell) || walls.has(cell) || !distances.has(cell)) return [];
        const actorDistance = distance(grid, scene.actor, cell), rivalDistance = distances.get(cell)!;
        // Compare geometric travel times as a forecast. The next public
        // return can show that either mobile took a different route.
        const lead = time - rivalDistance - 1;
        if (actorDistance + 1 > time || lead <= 0) return [];
        return [{ cell, actorDistance, lead, rival }];
      });
    });
  }).sort((a, b) => b.lead - a.lead || a.actorDistance - b.actorDistance);
}

function selectIntervention(scene: Scene, memory: Memory): Pick<Choice, 'kind' | 'target' | 'rival'> | null {
  const { grid, visited, caged } = memory, path = shortCorridor(grid, scene, visited);
  if (path.length < 2) return null;
  const shield = memory.shield;
  if (memory.forecast && shield && !scene.walls.includes(shield.cell) && !path.includes(shield.cell)) {
    const rival = scene.rivals.find(candidate => candidate.id === shield.rivalId);
    if (rival) return { kind: 'shield', target: shield.cell, rival };
  }
  if (memory.forecast && memory.opening !== undefined && !shield) {
    const option = entranceOptions(scene, grid, path)[0];
    if (option) return { kind: 'shield', target: option.cell, rival: option.rival };
  }
  // Follow an announced local corridor before diverting to a separate threat.
  if (memory.forecast && memory.opening === undefined && scene.carrier !== scene.exit) {
    const former = [...visited].reverse().find(at => at !== scene.carrier);
    const heading = scene.cue ?? (former === undefined ? null : 2 * scene.carrier - former);
    if (heading !== null && distance(grid, heading, scene.carrier) === 1) {
      const stride = heading - scene.carrier;
      let continuation: number | undefined;
      let at = scene.carrier;
      for (let step = 0; step < 3; step++) {
        const next = neighbors(grid, at).find(candidate => candidate.cell === at + stride)?.cell;
        if (next === undefined || !inside(grid, next) || scene.rivals.some(rival => rival.cell === next)) break;
        if (scene.walls.includes(next)) {
          continuation = next;
          break;
        }
        at = next;
      }
      if (continuation !== undefined && !path.slice(1, 3).some(at => scene.rivals.some(rival => rival.cue === at))) {
        return { kind: 'open', target: continuation, rival: null };
      }
    }
  }
  const free = scene.rivals.filter(rival => !scene.walls.includes(rival.cell));
  const candidate = free.find(rival => rival.id === memory.intercept) ?? free.map(rival => ({
    rival, index: path.findIndex(cell => cell === rival.cell || cell === rival.cue),
  })).filter(({ rival, index }) => index > 0 && index <= Math.max(2, Math.ceil(path.length / 2)) && !caged.includes(rival.id))
    .sort((a, b) => a.index - b.index)[0]?.rival;
  if (candidate) {
    const { cell, cue } = candidate;
    const target = cue !== null && scene.actor !== cell && distance(grid, scene.actor, cue) <= distance(grid, scene.actor, cell) ? cue : cell;
    return { kind: 'contain', target, rival: candidate };
  }
  const opening = path.findIndex((at, index) => index > 0 && scene.walls.includes(at));
  if (opening > 0) {
    const wall = path[opening]!;
    const accessible = (at: number) => !scene.walls.includes(at) && !path.includes(at) && !visited.includes(at);
    const branch = path.slice(Math.max(0, opening - 2), opening).flatMap(at => neighbors(grid, at).map(step => step.cell))
      .filter(at => accessible(at) && (scene.rails.includes(at) || neighbors(grid, at).some(step => accessible(step.cell)))
        && distance(grid, scene.actor, at) <= distance(grid, scene.actor, wall))
      .sort((a, b) => distance(grid, scene.actor, a) - distance(grid, scene.actor, b))[0];
    if (branch !== undefined) return { kind: 'divert', target: branch, rival: null };
    return { kind: 'open', target: wall, rival: null };
  }
  const next = neighbors(grid, scene.actor).filter(({ cell }) => cell !== scene.cue && cell !== scene.carrier)
    .sort((a, b) => distance(grid, a.cell, scene.exit) - distance(grid, b.cell, scene.exit))[0];
  return next ? { kind: 'accompany', target: next.cell, rival: null } : null;
}

function selectChoice(scene: Scene, memory: Memory): Choice | null {
  const instruction = selectIntervention(scene, memory);
  if (!instruction) return null;
  const { target, kind, rival } = instruction, atTarget = target === scene.actor;
  const step = neighbors(memory.grid, scene.actor).find(({ cell }) => distance(memory.grid, cell, target) < distance(memory.grid, scene.actor, target));
  const toggle = atTarget && (kind !== 'contain' || rival?.cell === target);
  if (!toggle && !step) return null;
  const closing = toggle && kind !== 'open', cue = scene.cue;
  const carrier = cue === null ? null : closing && (target === cue || target === scene.carrier) ? scene.carrier : cue;
  return { ...instruction, action: toggle ? localCommand : step!.action, actor: toggle ? scene.actor : step!.cell, carrier, toggle };
}

function expectedCells(proposal: Proposal): Memory['cells'] {
  const { scene, choice } = proposal, walls = new Set(scene.walls);
  if (choice.toggle && choice.kind === 'open') walls.delete(choice.target);
  else if (choice.toggle) walls.add(choice.target);
  return { walls: [...walls], rails: scene.rails, exit: scene.exit, rivals: scene.rivals };
}

function verifyIntervention(proposal: Proposal, next: Scene | null, rows: NativeRows, wall: number): boolean | null {
  const { memory, choice } = proposal;
  if (!next || next.actor !== choice.actor || (choice.carrier !== null && next.carrier !== choice.carrier)) return false;
  if (!choice.toggle) return true;
  if (choice.kind === 'contain') {
    const rival = next.rivals.find(value => value.id === choice.rival?.id);
    return !rival || rival.cell !== choice.target ? false : choice.rival?.cue !== null ? true : null;
  }
  const [x, y] = cellBox(memory.grid, choice.target);
  const patch = rows.slice(y + 1, y + memory.grid.pitch - 1).flatMap(line => line.slice(x + 1, x + memory.grid.pitch - 1));
  return patch.some(pixel => pixel === wall) === (choice.kind !== 'open');
}

const purposes = {
  contain: 'Keep an interfering mobile out of the approach',
  divert: 'Close a rail branch that leads away from the destination',
  open: 'Open the blocked continuation toward the matching outline',
  accompany: 'Let the announced move proceed and check the next position',
  shield: 'Close a side passage before a rival can reach the projected corridor',
};

export function createSicObservedRouteIntervention(): NativeFamily<Proposal> & { learn(witness: RouteInterventionWitness): void } {
  let state: Memory | null = null, roles: RouteInterventionWitness | null = null;
  return {
    id: observedRouteInterventionId,
    learn(witness) { roles = witness; },
    async propose(observation, rows, inputs, remaining) {
      if (!roles || roles.epoch !== observation.level_epoch || roles.score !== observation.levels_completed
        || roles.pitch < 4 || remaining < 1 || ![...directions.map(([key]) => key), localCommand]
          .every(key => inputs.some(command => command.action_ref === key))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      if ((prior?.count ?? 0) >= 64) return null;
      const grid = prior?.grid ?? gridOn(rows, roles);
      if (!grid) return null;
      const memory = prior ?? { epoch: observation.level_epoch, grid,
        cells: { walls: [], rails: [], exit: -1 }, visited: [], intercept: null, caged: [], refs: roles.refs, count: 0,
        forecast: roles.routeVerified === true };
      const scene = project(rows, grid, roles, memory.cells);
      if (!scene) return null;
      const choice = selectChoice(scene, memory);
      const action: NativeCommand | undefined = inputs.find(input => input.action_ref === choice?.action);
      if (!choice || !action) return null;
      const ref = observation.observation_ref, parent = 'G_official_completion', evidence: [string, ...string[]] = [ref, ...memory.refs];
      const scope = ref.split(':revision:', 1)[0]!;
      const objective = { kind: 'protect_visible_autonomous_route', scope, subjects: [cellBox(grid, scene.exit).join(',')],
        parentObjective: parent, satisfactionContract: 'observe_marked_body_reach_matching_outline_and_score' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `protect-route:${need.id}`, strategy = choice.toggle ? 'P05' : 'P07';
      const reason = purposes[choice.kind], actions = [action];
      return { status: 'proposed', kind: observedRouteInterventionId, actions, memory, scene, choice, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, expected_after: { cursor: choice.actor, markedBody: choice.carrier } }],
        sicSituationCard: { strategy, mode: choice.toggle ? 'exploration' : 'solving', need: 'Bring the autonomous body to its matching outline',
          situation: reason, evidence, agenda: [], controlledPiece: cellBox(grid, scene.actor), addressedRegion: cellBox(grid, choice.target),
          markedBody: cellBox(grid, scene.carrier), marker: scene.cue === null ? null : cellBox(grid, scene.cue),
          rival: choice.rival ? cellBox(grid, choice.rival.cell) : null, destination: cellBox(grid, scene.exit) },
        question: { reason, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: reason, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label: navigationPrimitives[strategy], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: reason,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'observed_route_bound' : 'observed_route_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const scene = roles ? project(second, proposal.memory.grid, roles, expectedCells(proposal)) : null;
      const matched = roles ? verifyIntervention(proposal, scene, second, roles.wall) : false;
      return { matched, seal_prefix: true, reason: matched === null ? 'intervention_covered_by_mobile'
        : matched ? 'projected_route_effect_observed' : 'projected_route_effect_differs' };
    },
    record(before, after, _command, _first, second, proposal) {
      const { memory, scene, choice } = proposal;
      if (roles && after.levels_completed > before.levels_completed) {
        roles = { ...roles, epoch: after.level_epoch, score: after.levels_completed,
          refs: [...memory.refs.slice(-5), after.observation_ref], routeVerified: roles.routeVerified || memory.opening !== undefined };
        return { events: [] };
      }
      if (!roles || before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const projected = expectedCells(proposal), next = project(second, memory.grid, roles, projected);
      if (!next) return { events: [] };
      const verified = verifyIntervention(proposal, next, second, roles.wall);
      const followedRival = choice.kind === 'contain' ? choice.rival : null;
      const caged = choice.toggle && followedRival && verified !== false;
      const cells = verified === false && choice.toggle ? project(second, memory.grid, roles, scene) ?? next : next;
      state = { ...memory, count: memory.count + 1, visited: [...new Set([...memory.visited, scene.carrier])], cells,
        intercept: caged ? null : followedRival?.id ?? null, caged: caged ? [...memory.caged, followedRival!.id] : memory.caged,
        refs: [...memory.refs.slice(-6), after.observation_ref] };
      if (choice.kind === 'open' && choice.toggle && verified !== false) state.opening = choice.target;
      if (choice.kind === 'shield' && choice.rival) state.shield = { cell: choice.target, rivalId: choice.rival.id };
      return { events: [] };
    },
    state: () => ({ state, roles }),
    restore(value: NativeRecord) {
      state = structuredClone((value.state as Memory | null | undefined) ?? null);
      if (state) {
        state.intercept = state.intercept === null ? null : String(state.intercept);
        state.caged = state.caged.map(String);
      }
      roles = structuredClone((value.roles as RouteInterventionWitness | null | undefined) ?? null);
    },
  };
}
