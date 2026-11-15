import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type Direction = readonly [input: string, dx: number, dy: number];
export type ContactCalibration = { readonly pitch: number; readonly band: number; readonly steps: number; readonly evidence: string };
type Position = { readonly pieces: readonly number[]; readonly selected: number };
type Piece = { readonly width: number; readonly height: number; readonly goal: number };
type Scene = {
  readonly pieces: readonly Piece[];
  readonly width: number;
  readonly height: number;
  readonly origin: NativePoint;
  readonly paint: number;
  readonly selectedInk: number;
  readonly field: readonly number[];
  readonly calibration: ContactCalibration;
};
export type ContactRouteMove = { readonly input: string; readonly position: Position; readonly contact: number | null };
export type ContactRoute = {
  readonly epoch: number;
  readonly scene: Scene;
  readonly position: Position;
  readonly path: readonly ContactRouteMove[];
  readonly evidence: readonly string[];
  readonly observedControls: Readonly<Record<string, string>>;
  readonly blocked: readonly string[];
  readonly stopped: boolean;
};

const width = ([l, , r]: NativeBox) => r - l + 1;
const height = ([, t, , b]: NativeBox) => b - t + 1;
const center = ([l, t, r, b]: NativeBox): NativePoint => [Math.floor((l + r) / 2), Math.floor((t + b) / 2)];
const same = (a: Position, b: Position) => a.selected === b.selected && a.pieces.every((part, index) => part === b.pieces[index]);
const positionKey = (p: Position) => p.selected + ':' + p.pieces.join(',');
const moveKey = (a: Position, b: Position) => positionKey(a) + '>' + positionKey(b);
const pixel = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const coords = (boardWidth: number, cell: number): NativePoint => [cell % boardWidth, Math.floor(cell / boardWidth)];

export function contactBox(scene: Scene, at: number, index: number): NativeBox {
  const { origin, width: columns, calibration: { pitch } } = scene;
  const [x, y] = coords(columns, at), [l, t] = [origin[0] + x * pitch, origin[1] + y * pitch];
  const piece = scene.pieces[index]!;
  return [l, t, l + piece.width * pitch - 1, t + piece.height * pitch - 1];
}

export function selectionPoint(scene: Scene, index: number, at: number): NativePoint {
  const [x, y] = contactBox(scene, at, index), centerOffset = Math.floor(scene.calibration.pitch / 2);
  return [x + centerOffset, y + centerOffset];
}

export function identifyContactRoute(observation: NativeObservation, rows: NativeRows, calibration: ContactCalibration,
  observedControls: Readonly<Record<string, string>>): ContactRoute | null {
  const { pitch, band, evidence } = calibration;
  const { entities } = observation, groups = new Map<number, typeof entities[number][]>();
  for (const part of entities) {
    const w = width(part.bbox), h = height(part.bbox);
    if (w < pitch || h < pitch || w > pitch * 3 || h > pitch * 3 || w % pitch || h % pitch ||
      part.area !== w * h - (w * h / pitch ** 2)) continue;
    const group = groups.get(part.palette_value) ?? [];
    group.push(part);
    groups.set(part.palette_value, group);
  }
  const candidates: ContactRoute[] = [];
  for (const [paint, bodies] of groups) {
    if (bodies.length < 3 || bodies.length > 5 ||
      new Set(bodies.map(part => width(part.bbox) + '×' + height(part.bbox))).size !== bodies.length) continue;
    const matches = bodies.map(body => {
      const w = width(body.bbox), h = height(body.bbox);
      const frames = entities.filter(part => width(part.bbox) === w + 2 && height(part.bbox) === h + 2 &&
        part.area === 2 * (w + h) + 4 && part.palette_value !== paint && part.mask.every(([x, y]) => x === 0 || y === 0 || x === w + 1 || y === h + 1));
      return frames.length === 1 ? frames[0]! : null;
    });
    if (matches.some(frame => !frame || frame.palette_value !== matches[0]?.palette_value)) continue;
    const goals = matches.map(frame => [frame!.bbox[0] + 1, frame!.bbox[1] + 1] as NativePoint);
    const floor = pixel(rows, goals[0]!);
    if (floor === undefined || floor === band || !goals.every(point => pixel(rows, point) === floor)) continue;
    const starts = bodies.map(({ bbox: [x, y] }) => [x, y] as NativePoint);
    const origin: NativePoint = [starts[0]![0] % pitch, starts[0]![1] % pitch];
    if (![...starts, ...goals].every(point => point.every((coordinate, axis) => coordinate % pitch === origin[axis]))) continue;
    const columns = Math.floor((rows[0]!.length - origin[0]) / pitch), lines = Math.floor((rows.length - origin[1]) / pitch);
    if (columns * lines > 1024 || columns * lines < 24) continue;
    const encode = ([x, y]: NativePoint) => (y - origin[1]) / pitch * columns + (x - origin[0]) / pitch;
    const pieces = bodies.map((body, i) => ({ width: width(body.bbox) / pitch, height: height(body.bbox) / pitch, goal: encode(goals[i]!) }));
    const markers = bodies.map(body => pixel(rows, center(body.bbox)));
    const distinct = markers.filter((ink): ink is number => ink !== undefined && markers.filter(other => other === ink).length === 1);
    if (distinct.length !== 1 || distinct[0] === paint) continue;
    const position = { pieces: starts.map(encode), selected: markers.indexOf(distinct[0]!) };
    const half = Math.floor(pitch / 2);
    const colors = Array.from({ length: columns * lines }, (_, i) => {
      const [x, y] = coords(columns, i);
      return pixel(rows, [origin[0] + x * pitch + half, origin[1] + y * pitch + half]);
    });
    const field = colors.map(value => value === floor ? 0 : value === band ? 1 : 2);
    if (!field.includes(1)) continue;
    for (const [i, at] of position.pieces.entries()) {
      const [x, y] = coords(columns, at), piece = pieces[i]!;
      for (let r = 0; r < piece.height; r++) for (let c = 0; c < piece.width; c++) field[(y + r) * columns + x + c] = 0;
    }
    const scene: Scene = { width: columns, height: lines, pieces, origin, paint,
      selectedInk: distinct[0]!, field, calibration };
    candidates.push({ epoch: observation.level_epoch, scene, position, path: [], evidence: [evidence], observedControls, blocked: [], stopped: false });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}

type Candidate = { readonly position: Position; readonly walk: number; readonly score: number; readonly priority: number;
  readonly parent: Candidate | null; readonly input: string; readonly contact: number | null };

class ContactQueue {
  private readonly items: Candidate[] = [];
  get size() { return this.items.length; }
  add(item: Candidate) {
    const { items } = this;
    let i = items.push(item) - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (items[parent]!.priority <= item.priority) break;
      items[i] = items[parent]!;
      i = parent;
    }
    items[i] = item;
  }
  take() {
    const { items } = this, first = items[0]!, last = items.pop()!;
    if (!items.length) return first;
    let i = 0;
    while (2 * i + 1 < items.length) {
      let branch = 2 * i + 1;
      if (branch + 1 < items.length && items[branch + 1]!.priority < items[branch]!.priority) branch++;
      if (items[branch]!.priority >= last.priority) break;
      items[i] = items[branch]!;
      i = branch;
    }
    items[i] = last;
    return first;
  }
}

export function planContacts(state: ContactRoute, directions: readonly Direction[]): readonly ContactRouteMove[] {
  const { scene } = state;
  const { width: columns, height: lines, pieces, field, calibration } = scene, count = field.length;
  const footprints = pieces.map(piece => Array.from({ length: count }, (_, at) => {
    const [x, y] = coords(columns, at);
    if (x + piece.width > columns || y + piece.height > lines) return [];
    return Array.from({ length: piece.height }, (_, r) => Array.from({ length: piece.width }, (_, c) => (y + r) * columns + x + c)).flat();
  }));
  const traversable = (limit: number) => footprints.map(items => items.map(cells => !!cells.length && cells.every(at => field[at]! <= limit)));
  const floor = traversable(0), canCross = traversable(1);
  const advance = (at: number, [, dx, dy]: Direction) => {
    const [x, y] = coords(columns, at), a = x + dx, b = y + dy;
    return a >= 0 && b >= 0 && a < columns && b < lines ? b * columns + a : -1;
  };
  const overlaps = (a: number, at: number, b: number, other: number) => footprints[a]![at]!.some(cell => footprints[b]![other]!.includes(cell));
  const launch = (index: number, from: number, direction: Direction, positions?: readonly number[]) => {
    let at = from, distance = 0;
    while (distance < calibration.steps || !floor[index]![at]) {
      const next = advance(at, direction);
      if (!canCross[index]![next] || positions?.some((other, j) => j !== index && overlaps(index, next, j, other))) break;
      at = next;
      distance++;
    }
    return floor[index]![at] ? at : from;
  };
  const estimate = pieces.map((piece, index) => {
    const links = Array.from({ length: count }, () => [] as number[]);
    const steps = Array.from({ length: count }, () => [] as number[]);
    for (let at = 0; at < count; at++) if (floor[index]![at]) {
      for (const direction of directions) {
        const walk = advance(at, direction), slide = launch(index, at, direction);
        if (floor[index]![walk]) { links[walk]!.push(at); steps[at]!.push(walk); }
        if (slide !== at) links[slide]!.push(at);
      }
    }
    const min = new Int32Array(count).fill(1000), queue = [piece.goal], room = new Set([piece.goal]), onFoot = [piece.goal];
    min[piece.goal] = 0;
    for (let i = 0; i < queue.length; i++) for (const from of links[queue[i]!]!) {
      if (min[from] !== 1000) continue;
      min[from] = min[queue[i]!]! + 1;
      queue.push(from);
    }
    for (let i = 0; i < onFoot.length; i++) for (const next of steps[onFoot[i]!]!) {
      if (room.has(next)) continue;
      room.add(next);
      onFoot.push(next);
    }
    return { min, room };
  });
  const guess = (p: Position) => p.pieces.reduce((sum, at, i) => sum + estimate[i]!.min[at]! + (estimate[i]!.room.has(at) ? 0 : 8), 0);
  const blocked = new Set(state.blocked), queue = new ContactQueue(), best = new Map([[positionKey(state.position), 0]]);
  const score = guess(state.position);
  queue.add({ position: state.position, walk: 0, score, priority: score * 2.6, parent: null, input: '', contact: null });
  for (let i = 0; queue.size && i < 50_000; i++) {
    const node = queue.take(), { position, walk, score: remaining } = node;
    if (best.get(positionKey(position)) !== walk) continue;
    if (!remaining) {
      const path: ContactRouteMove[] = [];
      for (let step = node; step.parent; step = step.parent) path.push({ input: step.input, position: step.position, contact: step.contact });
      return path.reverse();
    }
    const offer = (next: Position, input: string, contact: number | null = null) => {
      if (blocked.has(moveKey(position, next))) return;
      const key = positionKey(next), cost = walk + 1;
      if ((best.get(key) ?? Infinity) <= cost) return;
      best.set(key, cost);
      const score = guess(next);
      queue.add({ position: next, walk: cost, score, priority: cost + 2.6 * score, parent: node, input, contact });
    };
    const { selected } = position;
    for (const index of position.pieces.keys()) if (index !== selected) offer({ ...position, selected: index }, 'ACTION6');
    for (const direction of directions) {
      const at = advance(position.pieces[selected]!, direction);
      if (!floor[selected]![at]) continue;
      const contact = position.pieces.findIndex((value, index) => index !== selected && overlaps(selected, at, index, value));
      if (contact === -1) offer({ ...position, pieces: position.pieces.map((value, index) => index === selected ? at : value) }, direction[0]);
      else {
        const from = position.pieces[contact]!, to = launch(contact, from, direction, position.pieces);
        if (to !== from) offer({ ...position, pieces: position.pieces.map((value, index) => index === contact ? to : value) }, direction[0], contact);
      }
    }
  }
  return [];
}

function matchesPositions(rows: NativeRows, scene: Scene, position: Position) {
  const rectangles = position.pieces.map((at, i) => contactBox(scene, at, i));
  const { pitch } = scene.calibration;
  let found = 0;
  for (const row of rows) for (const color of row) found += Number(color === scene.paint);
  let owned = 0;
  for (const [left, top, right, bottom] of rectangles) {
    let visible = 0;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) visible += Number(rows[y]?.[x] === scene.paint);
    if (visible < ((right - left + 1) * (bottom - top + 1) * (1 - pitch ** -2)) / 2) return false;
    owned += visible;
  }
  return owned === found;
}

export function observeContactRoute(rows: NativeRows, state: ContactRoute, move: ContactRouteMove, ref: string): ContactRoute | null {
  const { scene, position } = state;
  const isSelection = move.input === 'ACTION6';
  const selectedMatches = !isSelection || pixel(rows, center(contactBox(scene, move.position.pieces[move.position.selected]!, move.position.selected))) === scene.selectedInk;
  if (selectedMatches && matchesPositions(rows, scene, move.position)) {
    const observedControls = !isSelection && move.contact === null && !state.observedControls[move.input]
      ? { ...state.observedControls, [move.input]: ref } : state.observedControls;
    return { ...state, position: move.position, path: state.path.slice(1), evidence: [...state.evidence.slice(-5), ref], observedControls };
  }
  if (state.blocked.length < 8 && !same(position, move.position) && matchesPositions(rows, scene, position) &&
    (!isSelection || pixel(rows, center(contactBox(scene, position.pieces[position.selected]!, position.selected))) === scene.selectedInk)) {
    return { ...state, path: [], blocked: [...state.blocked, moveKey(position, move.position)] };
  }
  return null;
}
