import { geometricComponents, ObservedInputDomain } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativeCommand, NativeFamily, NativePoint, NativeProposal, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { navigationPrimitives, resolveNavigationPrimitives } from './navigation-primitives.ts';
import { sicNeedId } from './need-identity.ts';

export const nestedPassageId = 'sic_nested_passage';

const dirs = [['ACTION1', 0, -1], ['ACTION2', 0, 1], ['ACTION3', -1, 0], ['ACTION4', 1, 0]] as const;
type Part = ReturnType<typeof geometricComponents>[number];
type Room = { width: number; height: number; parent: number; walls: NativePoint[]; color: number };
type Position = { rooms: NativePoint[]; selected: number };
type Layout = { origin: NativePoint; pitch: number; rooms: Room[]; source: { room: number; point: NativePoint }; exit: NativePoint; highlight: number };
type State = { epoch: number; layout: Layout; position: Position; refs: string[]; rejected: string[] };
type Move = { position: Position; input: string; click?: NativePoint };
type Proposal = NativeProposal & { local: State; move: Move; needId: string; attempt: string };

const key = (p: NativePoint) => p.join(',');
const same = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const add = ([x, y]: NativePoint, [a, b]: NativePoint): NativePoint => [x + a, y + b];
const sub = ([x, y]: NativePoint, [a, b]: NativePoint): NativePoint => [x - a, y - b];
const within = ([l, t, r, b]: NativeBox, [x, y]: NativePoint) => x >= l && x <= r && y >= t && y <= b;
const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const contains = (a: NativeBox, b: NativeBox) => within(a, [b[0], b[1]]) && within(a, [b[2], b[3]]);
const positionKey = (p: Position) => p.selected + '/' + p.rooms.map(key).join(';');

function boxFor(layout: Layout, p: Position, index: number): NativeBox {
  const room = layout.rooms[index]!, at = p.rooms[index]!, s = layout.pitch;
  const [x, y] = add(layout.origin, [at[0] * s, at[1] * s]);
  return [x, y, x + room.width * s - 1, y + room.height * s - 1];
}

function crossAt(rows: NativeRows, [x, y]: NativePoint): boolean {
  const middle = rows[y]?.[x], arm = rows[y - 1]?.[x];
  return middle !== undefined && arm !== undefined && middle !== arm && rows[y + 1]?.[x] === arm
    && rows[y]?.[x - 1] === arm && rows[y]?.[x + 1] === arm;
}

function measure(rows: NativeRows): { layout: Layout; position: Position } | null {
  const parts = geometricComponents(rows);
  const candidates = parts.filter(p => p.area > 180 && p.area < 750 && width(p.bbox) > 30 && height(p.bbox) > 20
    && p.bbox[0] > 0 && p.bbox[2] < rows[0]!.length - 1 && p.bbox[1] > 0 && p.bbox[3] < rows.length - 4);
  const goals = parts.filter(p => p.area === 9 && width(p.bbox) === 3 && height(p.bbox) === 3 && (p.bbox[0] === 0 || p.bbox[2] === rows[0]!.length - 1));
  if (goals.length !== 1) return null;
  const goal = goals[0]!, goalY = goal.bbox[1] + 1;
  const painted = (part: Part, x: number, y: number) => rows[y]?.[x] === part.color;
  const isFrame = (part: Part, pitch: number) => {
    const bounds = part.bbox;
    if (width(bounds) % pitch || height(bounds) % pitch || width(bounds) < pitch * 4 || height(bounds) < pitch * 4) return false;
    const [l, t, r, b] = bounds;
    const walls = Array.from({ length: width(bounds) / pitch }, (_, i) => [painted(part, l + i * pitch, t), painted(part, l + i * pitch, b - pitch + 1)]).flat();
    for (let y = t + pitch; y <= b - pitch; y += pitch) walls.push(painted(part, l, y), painted(part, r - pitch + 1, y));
    return walls.filter(Boolean).length >= walls.length * 0.75;
  };
  const layouts = [];
  for (const root of candidates) for (const pitch of [2, 3, 4]) {
    if (!isFrame(root, pitch) || goalY < root.bbox[1] || goalY > root.bbox[3]) continue;
    const origin: NativePoint = [root.bbox[0], root.bbox[1]];
    const background = rows[origin[1] + pitch]?.[origin[0] + pitch];
    if (background === undefined || background === root.color) continue;
    const enclosed = parts.filter(p => p.color !== root.color && p.color !== background && contains(root.bbox, p.bbox)
      && (p.bbox[0] - origin[0]) % pitch === 0 && (p.bbox[1] - origin[1]) % pitch === 0 && isFrame(p, pitch))
      .sort((a, b) => width(b.bbox) * height(b.bbox) - width(a.bbox) * height(a.bbox));
    if (enclosed.length < 2 || enclosed.length > 5 || new Set(enclosed.map(p => p.color)).size !== enclosed.length) continue;
    const rectangles = [root, ...enclosed], exit: NativePoint = [goal.bbox[0] === 0 ? 0 : width(root.bbox) / pitch - 1, Math.floor((goalY - origin[1]) / pitch)];
    if (painted(root, origin[0] + exit[0] * pitch, origin[1] + exit[1] * pitch)) continue;
    const position: Position = { rooms: rectangles.map(p => [(p.bbox[0] - origin[0]) / pitch, (p.bbox[1] - origin[1]) / pitch]), selected: 1 };
    const rooms: Room[] = rectangles.map((p, i) => {
      const w = width(p.bbox) / pitch, h = height(p.bbox) / pitch;
      const parent = rectangles.reduce((parent, outer, j) => j < i && contains(outer.bbox, p.bbox) ? j : parent, -1);
      const walls: NativePoint[] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const wx = p.bbox[0] + x * pitch, wy = p.bbox[1] + y * pitch;
        if (rectangles.slice(i + 1).some(child => within(child.bbox, [wx, wy]))) continue;
        if (rows.slice(wy, wy + pitch).every(row => row.slice(wx, wx + pitch).every(c => c === p.color))) walls.push([x, y]);
      }
      return { width: w, height: h, parent, walls, color: p.color };
    });
    const sources = [];
    const [l, t, r, b] = root.bbox;
    for (let y = t + Math.floor(pitch / 2); y < b; y += pitch) for (let x = l + Math.floor(pitch / 2); x < r; x += pitch) {
      if (!crossAt(rows, [x, y]) || rows[y]![x] !== enclosed[0]!.color) continue;
      const room = rectangles.reduce((innermost, part, index) => within(part.bbox, [x, y]) ? index : innermost, -1);
      if (room <= 0) continue;
      const bounds = rectangles[room]!.bbox;
      sources.push({ room, point: [Math.floor((x - bounds[0]) / pitch), Math.floor((y - bounds[1]) / pitch)] as NativePoint });
    }
    if (sources.length !== 1 || rooms.some(room => room.walls.length < 8)) continue;
    layouts.push({ layout: { origin, exit, pitch, rooms, source: sources[0]!, highlight: enclosed[0]!.color }, position });
  }
  return layouts.length === 1 ? layouts[0]! : null;
}

function connected(layout: Layout, position: Position): boolean {
  const walls = new Set(layout.rooms.flatMap((room, i) => room.walls.map(p => key(add(p, position.rooms[i]!)))));
  const start = add(position.rooms[layout.source.room]!, layout.source.point);
  const queue = [start], seen = new Set([key(start)]);
  const outer = layout.rooms[0]!;
  for (const at of queue) {
    if (same(at, layout.exit)) return true;
    for (const [, dx, dy] of dirs) {
      const [x, y] = nextPoint(at, dx, dy), k = key([x, y]);
      if (x < 0 || y < 0 || x >= outer.width || y >= outer.height || walls.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push([x, y]);
    }
  }
  return false;
}

function nextPoint([x, y]: NativePoint, dx: number, dy: number): NativePoint { return [x + dx, y + dy]; }

function translated(layout: Layout, p: Position, dx: number, dy: number): Position | null {
  const index = p.selected, room = layout.rooms[index]!, parent = layout.rooms[room.parent]!;
  const [px, py] = p.rooms[room.parent]!, [x, y] = nextPoint(p.rooms[index]!, dx, dy);
  const covers = ([a, b]: NativePoint) => a >= x && b >= y && a < x + room.width && b < y + room.height;
  if (x < px + 1 || y < py + 1 || x + room.width > px + parent.width - 1 || y + room.height > py + parent.height - 1
    || parent.walls.some(p => covers(add(p, [px, py])))) return null;
  if (layout.rooms.some((sibling, j) => {
    if (j === index || sibling.parent !== room.parent) return false;
    const [a, b] = p.rooms[j]!;
    return x < a + sibling.width && x + room.width > a && y < b + sibling.height && y + room.height > b;
  })) return null;
  const moved = new Set([index]), rooms = p.rooms.map((at, j) => {
    if (moved.has(layout.rooms[j]!.parent)) moved.add(j);
    return moved.has(j) ? nextPoint(at, dx, dy) : at;
  });
  return { ...p, rooms };
}

function choose(local: State): Move | null {
  const { position, layout, rejected } = local;
  const queue: { p: Position; first: Move | null }[] = [{ p: position, first: null }];
  const seen = new Set([positionKey(position)]);
  for (let i = 0; i < queue.length && i < 3000; i++) {
    const { p, first } = queue[i]!;
    if (connected(layout, p)) return first ?? { position: p, input: 'ACTION5' };
    const offer = (m: Move) => {
      const k = positionKey(m.position);
      if (seen.has(k) || !first && rejected.includes(positionKey(p) + '/' + k)) return;
      seen.add(k);
      queue.push({ p: m.position, first: first ?? m });
    };
    for (let j = 1; j < layout.rooms.length; j++) if (j !== p.selected) {
      const [x, y] = boxFor(layout, p, j);
      offer({ position: { ...p, selected: j }, input: 'ACTION6', click: [x + 1, y + 1] });
    }
    for (const [input, dx, dy] of dirs) {
      const next = translated(layout, p, dx, dy);
      if (next) offer({ position: next, input });
    }
  }
  return null;
}

function checked(rows: NativeRows, { local, move }: Proposal): boolean {
  const { layout } = local;
  const predicted = move.position;
  const selected = predicted.selected, shell = layout.highlight;
  const at = (i: number, p: NativePoint) => add(layout.origin, add(predicted.rooms[i]!, p).map(v => v * layout.pitch) as [number, number]);
  return layout.rooms.every((room, i) => room.walls.every(p => {
    const [x, y] = at(i, p), actual = rows[y]?.[x];
    if (i === selected) return actual === shell;
    return room.color === shell ? actual !== shell : actual === room.color;
  }));
}

export function createSicNestedPassage(): NativeFamily<Proposal> {
  let state: State | null = null;
  return {
    id: nestedPassageId,
    async propose(observation, rows, _inputs, remaining, execution): Promise<Proposal | null> {
      if (remaining < 1 || !['ACTION5', 'ACTION6', ...dirs.map(([id]) => id)].every(id => observation.available_action_refs.includes(id))) return null;
      const prior = state?.epoch === observation.level_epoch ? state : null;
      const initial = prior ?? measure(rows);
      if (!initial) return null;
      const local = prior ?? { ...initial, epoch: observation.level_epoch, refs: [], rejected: [] };
      const move = choose(local);
      if (!move) return null;
      const ref = observation.observation_ref;
      const evidence: [string, ...string[]] = [ref, ...local.refs.filter(v => v !== ref)];
      const mode = execution?.reasoningMode ?? 'exploration';
      const offer = { input: move.input, expected: move.position.rooms[move.position.selected]!, evidence };
      const probe = !local.refs.length || !!move.click;
      const { selected, entries, card } = resolveNavigationPrimitives({ mode, evidence,
        probe: probe ? offer : null, access: !probe ? offer : null, interaction: null });
      if (!selected) return null;
      const witness = move.click ? await ObservedInputDomain.makeLocusWitness(observation, rows, move.click, { reason: 'Select a visible room', evidence }) : null;
      if (move.click && !witness) return null;
      const parent = 'G_official_completion';
      const objective = { kind: 'join_room_openings_into_reachable_route', scope: ref.split(':revision:', 1)[0]!,
        subjects: ['movable_rooms', 'visible_openings', 'source_and_exit'], parentObjective: parent, satisfactionContract: 'official_progress_after_joining_openings' };
      const need = { ...objective, id: sicNeedId(objective), status: 'assigned', evidence };
      const id = nestedPassageId + ':' + need.id;
      const action: NativeCommand = { action_ref: move.input, data: move.click ? { x: move.click[0], y: move.click[1] } : {} };
      const situation = move.click ? 'Change the selected room to move its openings independently'
        : 'Move the selected room and its contents toward a continuous passage';
      const { layout, position } = local;
      const p = layout.pitch, [sx, sy] = add(layout.origin, add(position.rooms[layout.source.room]!, layout.source.point).map(v => v * p) as [number, number]);
      const [gx, gy] = add(layout.origin, layout.exit.map(v => v * p) as [number, number]);
      return {
        status: 'proposed', kind: nestedPassageId, local, move, needId: need.id, attempt: positionKey(position) + '/' + positionKey(move.position),
        binding: { observation_ref: ref, level_epoch: observation.level_epoch }, actions: [action],
        steps: [{ action, expected_after: move.position.rooms, ...(witness ? { point_binding: witness } : {}) }],
        sicSituationCard: { strategy: selected.id, need: 'Connect the source to the exit through the room openings', situation, evidence, agenda: entries, mode,
          triggerCard: card, room: boxFor(layout, position, move.position.selected), source: [sx, sy, sx + p - 1, sy + p - 1], exit: [gx, gy, gx + p - 1, gy + p - 1] },
        question: { reason: situation, hypothesis_refs: evidence }, route_refs: evidence,
        compositions: [{ id, observed: false, open_question: situation, relations: ['contributes_to:' + parent] }],
        sicLocalDecision: { strategy: selected.id, objective: { id, label: navigationPrimitives[selected.id], parent }, need },
        bundle_template: { operation_key: 'OP18', composition_ref: id, objective_ref: parent, purpose: situation,
          preconditions: {}, preserve_refs: [], evidence, actions: [action], outcome_guard: { path: ['value'], contains: id } },
      };
    },
    before(proposal, index, _packet, current) {
      const admitted = index === 0 && proposal.binding?.observation_ref === current.observation_ref;
      return { admitted, reason: admitted ? 'room_move_bound' : 'room_layout_changed' };
    },
    after(proposal, _index, before, after, _first, second) {
      if (after.levels_completed > before.levels_completed) return { matched: true, seal_prefix: true, reason: 'official_boundary',
        sic_need: { id: proposal.needId, status: 'satisfied' } };
      const matched = checked(second, proposal);
      return { matched, seal_prefix: true, reason: matched ? proposal.move.click ? 'room_selection_observed' : 'room_walls_at_predicted_positions' : 'room_projection_contradicted' };
    },
    record(before, after, _action, _first, second, proposal) {
      if (before.level_epoch !== after.level_epoch || before.state !== after.state) return { events: [] };
      const { local, move } = proposal, matched = checked(second, proposal);
      state = { ...local, position: matched ? move.position : local.position, refs: matched ? [...local.refs.slice(-4), after.observation_ref] : local.refs,
        rejected: matched ? local.rejected : [...local.rejected, proposal.attempt] };
      return { events: [] };
    },
    state: () => ({ state }),
    restore(value: NativeRecord) { state = structuredClone(value.state as State | null); },
  };
}
