import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeEntity, NativeFamily, NativeObservation, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { sicNeedId } from './need-identity.ts';

export const observedSharedRelationsId = 'sic_adjust_observed_shared_relations';
export const observedSharedRelationsStrategies = {
  adjust_shared_relation: 'Adjust the shared relation and verify which pieces move',
} as const;

type Part = Pick<NativeEntity, 'bbox' | 'area' | 'mask' | 'palette_value'>;
type Grid = { columns: number[]; rows: number[]; pitch: number; wall: number };
type Cell = { column: number; row: number; box: NativeBox };
type Room = Cell & { pigment: number; position: NativePoint; destination: NativePoint | null };
type PanelSetting = { relation: string; point: NativePoint; switchBox: NativeBox; sign: number };
type Neighbor = { first: number; second: number; axis: 0 | 1 };
type Relation = Neighbor & { setting: number };
type Scene = { grid: Grid; rooms: Room[]; settings: PanelSetting[]; relations: Relation[]; actorSize: number };
type Training = { epoch: number; scene: Scene; refs: string[] };
type Witness = { epoch: number; score: number; refs: string[] };
type Local = { epoch: number; scene: Scene; refs: string[]; blocked: boolean };
type Proposal = NativeProposal & { scene: Scene; selected: number; expected: NativePoint[]; refs: string[]; needId: string };

const size = ([l, t, r, b]: NativeBox): NativePoint => [r - l + 1, b - t + 1];
const center = ([l, t, r, b]: NativeBox): NativePoint => [(l + r) / 2, (t + b) / 2];
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, i) => value === b[i]);
const pair = (a: number, b: number) => a < b ? `${a},${b}` : `${b},${a}`;
const cellContains = ([l, t, r, b]: NativeBox, cell: Cell) => {
  const [cl, ct, cr, cb] = cell.box;
  return cl < l && r < cr && ct < t && b < cb;
};

function parallelWalls(part: Part, rows: NativeRows, axis: 0 | 1): number[] {
  const [l, t, r, b] = part.bbox;
  const from = axis === 0 ? l : t, to = axis === 0 ? r : b;
  const lower = axis === 0 ? t : l, upper = axis === 0 ? b : r;
  const lines: number[] = [];
  for (let line = from; line <= to; line++) {
    let full = true;
    for (let step = lower; step <= upper && full; step++) {
      full = (axis === 0 ? rows[step]?.[line] : rows[line]?.[step]) === part.palette_value;
    }
    if (full) lines.push(line);
  }
  return lines;
}

function measureGrid(parts: readonly Part[], rows: NativeRows): Grid | null {
  const grids: Grid[] = [];
  for (const part of parts) {
    const [width, height] = size(part.bbox);
    if (Math.min(width, height) < 9 || part.area >= width * height || part.area < 3 * (width + height - 3)) continue;
    const columns = parallelWalls(part, rows, 0), lines = parallelWalls(part, rows, 1);
    if (columns.length < 3 || lines.length < 3 || columns.length * lines.length > 30) continue;
    const pitch = columns[1]! - columns[0]!;
    if (pitch < 8 || pitch % 4 || ![columns, lines].every(axis => axis.every((line, i) => line === axis[0]! + i * pitch))) continue;
    if (columns.length * height + lines.length * width - columns.length * lines.length !== part.area) continue;
    grids.push({ columns, rows: lines, pitch, wall: part.palette_value });
  }
  return grids.length === 1 ? grids[0]! : null;
}

function cells(columns: number[], rows: number[]): Cell[] {
  return rows.slice(0, -1).flatMap((t, row) => columns.slice(0, -1).map((l, column) => ({
    column, row, box: [l, t, columns[column + 1]!, rows[row + 1]!] as const,
  })));
}

function neighbors(units: Cell[]): Neighbor[] {
  const links: Neighbor[] = [];
  for (const [first, unit] of units.entries()) {
    const side = units.findIndex(other => other.row === unit.row && other.column === unit.column + 1);
    const below = units.findIndex(other => other.row === unit.row + 1 && other.column === unit.column);
    if (side >= 0) links.push({ first, second: side, axis: 0 });
    if (below >= 0) links.push({ first, second: below, axis: 1 });
  }
  return links;
}

function measurePanel(part: Part, solids: Part[], rows: NativeRows): PanelSetting[] | null {
  const [l, t, r, b] = part.bbox, pitch = (r - l) / 2;
  if (pitch < 4 || pitch % 2 || parallelWalls(part, rows, 0).length !== 2 || parallelWalls(part, rows, 1).length !== 2) return null;
  const units = cells([l, l + pitch, r], [t, t + pitch, b]);
  const pieces = units.map(cell => solids.filter(solid => cellContains(solid.bbox, cell)));
  if (pieces.some(list => list.length !== 1) || new Set(pieces.map(list => size(list[0]!.bbox)[0])).size !== 1) return null;
  const settings: PanelSetting[] = [];
  for (const { first, second, axis } of neighbors(units)) {
    const origin = center(units[first]!.box), destination = center(units[second]!.box);
    const a = pieces[first]![0]!, b = pieces[second]![0]!;
    const sign = Math.sign(center(a.bbox)[axis] - origin[axis]);
    if (!sign || Math.sign(destination[axis] - center(b.bbox)[axis]) !== sign) return null;
    const [x, y]: NativePoint = axis === 0 ? [origin[0] + pitch / 2, origin[1]] : [origin[0], origin[1] + pitch / 2];
    const range = axis === 0 ? units[first]!.box[1] : units[first]!.box[0];
    const value = rows[y]?.[x];
    if (value === undefined || value === part.palette_value) return null;
    let start = axis === 0 ? y : x, end = start;
    const cross = (at: number) => axis === 0 ? rows[at]?.[x] : rows[y]?.[at];
    while (start > range + 1 && cross(start - 1) === value) start--;
    while (end < range + pitch - 1 && cross(end + 1) === value) end++;
    if (end - start < 2) return null;
    settings.push({ relation: pair(a.palette_value, b.palette_value), point: [x, y],
      switchBox: axis === 0 ? [x, start, x, end] : [start, y, end, y], sign });
  }
  return settings;
}

function panelSettings(parts: readonly Part[], solids: Part[], rows: NativeRows, grid: Grid): PanelSetting[] | null {
  const settings = new Map<string, PanelSetting>();
  for (const part of parts) {
    const [width, height] = size(part.bbox);
    if (part.palette_value !== grid.wall || width !== height || width <= grid.pitch || width >= 2 * grid.pitch
      || part.bbox[1] <= grid.rows.at(-1)!) continue;
    const panel = measurePanel(part, solids, rows);
    if (!panel) continue;
    for (const setting of panel) {
      const existing = settings.get(setting.relation);
      if (existing && setting.sign !== existing.sign) return null;
      if (!existing) settings.set(setting.relation, setting);
    }
  }
  return settings.size && settings.size <= 12 ? [...settings.values()] : null;
}

function project(rooms: Cell[], relations: Relation[], settings: PanelSetting[], pitch: number, reversed: number): NativePoint[] {
  const net = rooms.map(() => [0, 0] as [number, number]);
  for (const { first, second, axis, setting } of relations) {
    const sign = settings[setting]!.sign * (reversed & (1 << setting) ? -1 : 1);
    net[first]![axis] += sign;
    net[second]![axis] -= sign;
  }
  return rooms.map((cell, i) => {
    const [x, y] = center(cell.box), [dx, dy] = net[i]!;
    return [x + Math.sign(dx) * pitch / 4, y + Math.sign(dy) * pitch / 4];
  });
}

type UnresolvedRoom = Omit<Room, 'pigment'> & { pigment: number | null };
function resolveRoomColors(rooms: UnresolvedRoom[], settings: PanelSetting[], grid: Grid): Pick<Scene, 'rooms' | 'relations'> | null {
  const edges = neighbors(rooms);
  const settingsByPair = new Map(settings.map((setting, index) => [setting.relation, index]));
  const pigments = [...new Set(settings.flatMap(setting => setting.relation.split(',').map(Number)))];
  let result: Pick<Scene, 'rooms' | 'relations'> | null = null;
  let visits = 0;
  let ambiguous = false;
  function visit(assigned: number[]) {
    if (ambiguous || ++visits > 128) return;
    const index = assigned.length;
    if (index === rooms.length) {
      const relations = edges.map(edge => ({ ...edge, setting: settingsByPair.get(pair(assigned[edge.first]!, assigned[edge.second]!))! }));
      if (!project(rooms, relations, settings, grid.pitch, 0).every((point, i) => same(point, rooms[i]!.position))) return;
      ambiguous = result !== null;
      result = { rooms: rooms.map((room, i) => ({ ...room, pigment: assigned[i]! })), relations };
      return;
    }
    const observed = rooms[index]!.pigment;
    for (const pigment of observed === null ? pigments : [observed]) {
      const next = [...assigned, pigment];
      if (!edges.some(({ first, second }) => second <= index && !settingsByPair.has(pair(next[first]!, next[second]!)))) visit(next);
    }
  }
  visit([]);
  return ambiguous || visits > 128 ? null : result;
}

function readScene(parts: readonly Part[], rows: NativeRows, previous?: Scene): Scene | null {
  const grid = measureGrid(parts, rows);
  if (!grid || (previous && (!same(grid.columns, previous.grid.columns) || !same(grid.rows, previous.grid.rows)))) return null;
  const units = cells(grid.columns, grid.rows);
  const solids = parts.filter(part => {
    const [width, height] = size(part.bbox);
    return width >= 2 && height === width && part.area === width * height;
  });
  const settings = panelSettings(parts, solids, rows, grid);
  if (!settings) return null;
  const frequencies = new Map<number, number>();
  for (const solid of solids) {
    if (!units.some(cell => cellContains(solid.bbox, cell))) continue;
    const [width] = size(solid.bbox);
    frequencies.set(width, (frequencies.get(width) ?? 0) + 1);
  }
  const sizes = [...frequencies.entries()].sort((a, b) => b[1] - a[1]);
  const actorSize = previous?.actorSize ?? (sizes[0] && sizes[0][1] !== sizes[1]?.[1] ? sizes[0][0] : null);
  if (!actorSize) return null;
  const markerSize = grid.pitch / 2 - 1;
  if (actorSize >= markerSize) return null;
  const frames = parts.filter(part => {
    const [width, height] = size(part.bbox);
    return width === markerSize && height === markerSize && part.area === 4 * (width - 1)
      && part.mask.every(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1);
  });
  const rooms = units.flatMap((cell, index): UnresolvedRoom[] => {
    const bodies = solids.filter(solid => size(solid.bbox)[0] === actorSize && cellContains(solid.bbox, cell));
    const markers = frames.filter(frame => cellContains(frame.bbox, cell));
    const occupied = solids.filter(solid => size(solid.bbox)[0] === markerSize && cellContains(solid.bbox, cell));
    if (bodies.length > 1 || markers.length > 1 || occupied.length > 1 || (!bodies.length && (markers.length || !occupied.length))) return [];
    const destination = markers[0] ? center(markers[0].bbox) : occupied[0] ? center(occupied[0].bbox) : null;
    const prior = previous?.rooms[index];
    if (prior?.destination && destination && !same(prior.destination, destination)) return [];
    if (bodies[0] && prior && bodies[0].palette_value !== prior.pigment) return [];
    return [{ ...cell, pigment: bodies[0]?.palette_value ?? prior?.pigment ?? null,
      position: center((bodies[0] ?? occupied[0])!.bbox), destination: destination ?? prior?.destination ?? null }];
  });
  if (rooms.length !== units.length || rooms.filter(room => room.destination).length < 2) return null;
  const resolved = resolveRoomColors(rooms, settings, grid);
  return resolved ? { grid, settings, ...resolved, actorSize } : null;
}

function nextSetting(scene: Scene, remaining: number): number | null {
  if (scene.rooms.every(room => !room.destination || same(room.position, room.destination))) return null;
  let best = 0, bestCount = remaining + 1;
  for (let reversed = 1; reversed < (1 << scene.settings.length); reversed++) {
    const count = scene.settings.reduce((sum, _, i) => sum + Number(Boolean(reversed & (1 << i))), 0);
    if (count >= bestCount) continue;
    const projected = project(scene.rooms, scene.relations, scene.settings, scene.grid.pitch, reversed);
    if (!projected.every((point, i) => !scene.rooms[i]!.destination || same(point, scene.rooms[i]!.destination!))) continue;
    best = reversed;
    bestCount = count;
  }
  const index = scene.settings.findIndex((_, i) => best & (1 << i));
  return index === -1 ? null : index;
}

function confirms(scene: Scene, result: Scene | null, selected: number, expected: NativePoint[]): boolean {
  if (!result || result.settings.length !== scene.settings.length) return false;
  return expected.every((point, i) => same(point, result.rooms[i]!.position)) && scene.settings.every(({ relation, sign }, i) =>
    result.settings.some(next => next.relation === relation && next.sign === (i === selected ? -sign : sign)));
}

function terminalFrame(scene: Scene, selected: number, expected: NativePoint[], frames: readonly NativeRows[]): boolean {
  return frames.some(rows => {
    const parts = geometricComponents(rows).map(part => ({ ...part, palette_value: part.color }));
    return confirms(scene, readScene(parts, rows, scene), selected, expected);
  });
}

export function createSicObservedSharedRelations(): NativeFamily<Proposal> {
  let training: Training | null = null, witness: Witness | null = null, local: Local | null = null;
  return {
    id: observedSharedRelationsId,
    observePublicOutcome(before, after, action, first, second, frames = []) {
      if (action.action_ref !== 'ACTION6' || before.available_action_refs.some(ref => /^ACTION[1-5]$/.test(ref))
        || before.frame_hash === after.frame_hash) return;
      const previous = training?.epoch === before.level_epoch ? training : null;
      const scene = readScene(before.entities, first, previous?.scene);
      if (!scene) return;
      const { x, y } = action.data;
      if (x === undefined || y === undefined) return;
      const selected = scene.settings.findIndex(({ switchBox: [l, t, r, b] }) => l <= x && x <= r && t <= y && y <= b);
      if (selected < 0) return;
      const expected = project(scene.rooms, scene.relations, scene.settings, scene.grid.pitch, 1 << selected);
      if (after.levels_completed > before.levels_completed) {
        if (previous && terminalFrame(scene, selected, expected, frames)) {
          witness = { epoch: after.level_epoch, score: after.levels_completed, refs: [...previous.refs, after.observation_ref] };
        }
        return;
      }
      if (after.level_epoch !== before.level_epoch || expected.every((point, i) => same(point, scene.rooms[i]!.position))) return;
      const result = readScene(after.entities, second, scene);
      if (result && confirms(scene, result, selected, expected)) {
        training = { epoch: before.level_epoch, scene: result, refs: [...(previous?.refs ?? [before.observation_ref]).slice(-3), after.observation_ref] };
      }
    },
    async propose(observation, rows, _inputs, remaining) {
      if (witness?.epoch !== observation.level_epoch || witness.score !== observation.levels_completed || remaining < 1
        || !observation.available_action_refs.includes('ACTION6')) return null;
      const prior = local?.epoch === observation.level_epoch ? local : null;
      if (prior?.blocked) return null;
      const scene = readScene(observation.entities, rows, prior?.scene);
      if (!scene) return null;
      const selected = nextSetting(scene, remaining);
      if (selected === null) return null;
      const control = scene.settings[selected]!, [x, y] = control.point;
      const expected = project(scene.rooms, scene.relations, scene.settings, scene.grid.pitch, 1 << selected);
      const affected = scene.rooms.filter((room, i) => !same(room.position, expected[i]!));
      const ref = observation.observation_ref, evidence: [string, ...string[]] = [ref,
        ...new Set([...witness.refs, ...(prior?.refs ?? [])].filter(value => value !== ref))];
      const strategy = 'adjust_shared_relation', label = observedSharedRelationsStrategies[strategy], parent = 'G_official_completion';
      const binding = await ObservedInputDomain.makeLocusWitness(observation, rows, control.point, { reason: label, evidence });
      if (!binding) return null;
      const action: NativeCommand = { action_ref: 'ACTION6', data: { x, y } }, actions = [action];
      const objective = { kind: 'adjust_shared_relations_to_fill_frames', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['relation_control', 'affected_pieces', 'visible_frames'], parentObjective: parent,
        satisfactionContract: 'verify_projected_settled_positions_and_official_progress' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = `shared-relations:${need.id}`;
      return { status: 'proposed', kind: observedSharedRelationsId, actions, scene, selected, expected, refs: evidence, needId: need.id,
        binding: { observation_ref: ref, level_epoch: observation.level_epoch },
        steps: [{ action, point_binding: binding, expected_after: expected }],
        sicSituationCard: { strategy, mode: 'solving', need: 'Settle the pieces in the visible frames', situation: label, agenda: [], evidence,
          control: control.switchBox, actors: affected.map(room => region(room.position, scene.actorSize)),
          destinations: affected.flatMap(room => room.destination ? [region(room.destination, scene.grid.pitch / 2 - 1)] : []) },
        question: { reason: label, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: label, relations: [`contributes_to:${parent}`] }],
        sicLocalDecision: { strategy, objective: { id, label, parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: label,
          preconditions: {}, preserve_refs: [], evidence, actions, outcome_guard: { path: ['value'], contains: id } } };
    },
    before(proposal, index, _packet, observation) {
      const admitted = index === 0 && proposal.binding?.observation_ref === observation.observation_ref;
      return { admitted, reason: admitted ? 'current_relation_setting_bound' : 'relation_context_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const result = after.level_epoch === before.level_epoch ? readScene(after.entities, second, proposal.scene) : null;
      const matched = confirms(proposal.scene, result, proposal.selected, proposal.expected);
      return { matched, seal_prefix: true, reason: matched ? 'shared_relation_effect_confirmed' : 'shared_relation_effect_contradicted' };
    },
    record(before, after, _action, _first, second, proposal, _index, frames) {
      if (after.levels_completed > before.levels_completed) {
        if (terminalFrame(proposal.scene, proposal.selected, proposal.expected, frames)) witness = {
          epoch: after.level_epoch, score: after.levels_completed, refs: [...proposal.refs.slice(-3), after.observation_ref],
        };
        return { events: [] };
      }
      const result = after.level_epoch === before.level_epoch ? readScene(after.entities, second, proposal.scene) : null;
      const matched = confirms(proposal.scene, result, proposal.selected, proposal.expected);
      local = { epoch: before.level_epoch, scene: result ?? proposal.scene, blocked: !matched, refs: [...proposal.refs.slice(-4), after.observation_ref] };
      return { events: [] };
    },
    state: () => ({ training, witness, local }),
    restore(value: NativeRecord) {
      training = structuredClone((value.training as Training | null | undefined) ?? null);
      witness = structuredClone((value.witness as Witness | null | undefined) ?? null);
      local = structuredClone((value.local as Local | null | undefined) ?? null);
    },
  };
}

function region([x, y]: NativePoint, size: number): NativeBox {
  const half = (size - 1) / 2;
  return [x - half, y - half, x + half, y + half];
}
