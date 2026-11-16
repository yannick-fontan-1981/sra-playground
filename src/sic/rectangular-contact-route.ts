import type { NativeBox, NativeObservation, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type Direction = readonly [input: string, dx: number, dy: number];
export type ContactCalibration = { readonly pitch: number; readonly band: number; readonly steps: number; readonly evidence: string };
type Position = { readonly pieces: readonly number[]; readonly selected: number };
type Piece = { readonly width: number; readonly height: number; readonly goal: number;
  readonly mask?: readonly NativePoint[]; readonly goalOptions?: readonly number[] };
type Scene = {
  readonly pieces: readonly Piece[];
  readonly width: number;
  readonly height: number;
  readonly origin: NativePoint;
  readonly paint: number;
  readonly selectedInk: number;
  readonly field: readonly number[];
  readonly calibration: ContactCalibration;
  readonly fixedCarrier?: number;
  readonly carrierInk?: number;
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
  readonly contactRef?: string;
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

type MaskedPart = { box: NativeBox; paint: number; mask: NativePoint[]; signature: string };

export function identifyMaskedContactRoute(observation: NativeObservation, rows: NativeRows, calibration: ContactCalibration,
  observedControls: Readonly<Record<string, string>>): ContactRoute | null {
  const { pitch, band, evidence } = calibration, { entities } = observation;
  const fields = entities.filter(part => part.area > rows.length * rows[0]!.length / 2
    && width(part.bbox) % pitch === 0 && height(part.bbox) % pitch === 0);
  if (fields.length !== 1) return null;
  const field = fields[0]!, [l, t, r, b] = field.bbox, origin: NativePoint = [l, t];
  const columns = width(field.bbox) / pitch, lines = height(field.bbox) / pitch;
  if (columns * lines > 1024) return null;
  const belongs = (box: NativeBox) => box[0] >= l && box[1] >= t && box[2] <= r && box[3] <= b
    && (box[0] - l) % pitch === 0 && (box[1] - t) % pitch === 0;
  const latch = (box: NativeBox) => entities.some(part => part.palette_value !== field.palette_value
    && part.bbox.every((value, i) => value === box[i]! + (i < 2 ? -1 : 1)));
  const shape = (part: typeof entities[number]): MaskedPart | null => {
    const box = part.bbox, w = width(box), h = height(box);
    if (!belongs(box) || w % pitch || h % pitch || w > 5 * pitch || h > 5 * pitch) return null;
    const counts = new Map<number, number>();
    for (const [x, y] of part.mask) {
      const cell = Math.floor(y / pitch) * (w / pitch) + Math.floor(x / pitch);
      counts.set(cell, (counts.get(cell) ?? 0) + 1);
    }
    if ([...counts.values()].some(count => count !== pitch ** 2)) return null;
    const indices = [...counts.keys()].sort((a, b) => a - b);
    return { box, paint: part.palette_value, mask: indices.map(i => coords(w / pitch, i)), signature: w + '/' + h + '/' + indices.join(',') };
  };
  const observed = entities.flatMap(part => {
    const measured = shape(part);
    return measured ? [measured] : [];
  });
  const cavities = observed.filter(part => part.paint === field.palette_value && latch(part.box));
  const small = cavities.filter(part => part.mask.length === 1);
  if (small.length !== 1) return null;
  const carriers = entities.filter(part => belongs(part.bbox) && width(part.bbox) === pitch && height(part.bbox) === pitch
    && part.area === pitch ** 2 - 1 && part.palette_value !== field.palette_value
    && pixel(rows, center(part.bbox)) !== part.palette_value);
  if (carriers.length !== 1) return null;
  const carrier = carriers[0]!, selectedInk = pixel(rows, center(carrier.bbox));
  if (selectedInk === undefined || selectedInk === field.palette_value) return null;
  const targets = cavities.filter(part => part.mask.length > 1);
  const cargo = observed.filter(part => part.paint !== field.palette_value && part.paint !== carrier.palette_value
    && part.mask.length * pitch ** 2 < width(part.box) * height(part.box)
    && targets.some(target => target.signature === part.signature));
  if (cargo.length < 2 || cargo.length > 4 || cargo.length !== targets.length || new Set(cargo.map(part => part.paint)).size !== 1
    || targets.some(target => targets.filter(part => part.signature === target.signature).length !== cargo.filter(part => part.signature === target.signature).length)) {
    return null;
  }
  const encode = ([x, y]: NativeBox) => (y - t) / pitch * columns + (x - l) / pitch;
  const pieces: Piece[] = [{ width: 1, height: 1, goal: encode(small[0]!.box) }];
  for (const part of cargo) {
    const goalOptions = targets.filter(target => target.signature === part.signature).map(target => encode(target.box));
    pieces.push({ width: width(part.box) / pitch, height: height(part.box) / pitch, goal: goalOptions[0]!, goalOptions, mask: part.mask });
  }
  const starts = [encode(carrier.bbox), ...cargo.map(part => encode(part.box))], half = Math.floor(pitch / 2);
  const terrain = Array.from({ length: columns * lines }, (_, i) => {
    const [x, y] = coords(columns, i), value = pixel(rows, [l + x * pitch + half, t + y * pitch + half]);
    return value === field.palette_value ? 0 : value === band ? 1 : 2;
  });
  for (const [i, start] of starts.entries()) {
    for (const [x, y] of pieces[i]?.mask ?? [[0, 0]]) terrain[start + y * columns + x] = 0;
  }
  const scene: Scene = { pieces, width: columns, height: lines, origin, paint: cargo[0]!.paint,
    selectedInk, field: terrain, calibration, fixedCarrier: 0, carrierInk: carrier.palette_value };
  return { epoch: observation.level_epoch, scene, position: { pieces: starts, selected: 0 }, path: [],
    evidence: [evidence], observedControls, blocked: [], stopped: false };
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
    if (piece.mask) return piece.mask.map(([dx, dy]) => (y + dy) * columns + x + dx);
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
        if (floor[index]![walk] && (scene.fixedCarrier === undefined || index === scene.fixedCarrier)) {
          links[walk]!.push(at); steps[at]!.push(walk);
        }
        if (slide !== at && index !== scene.fixedCarrier) links[slide]!.push(at);
      }
    }
    const goals = piece.goalOptions ?? [piece.goal];
    const min = new Int32Array(count).fill(1000), queue = [...goals], room = new Set(goals), onFoot = [...goals];
    for (const goal of goals) min[goal] = 0;
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
    if (scene.fixedCarrier === undefined) {
      for (const index of position.pieces.keys()) if (index !== selected) offer({ ...position, selected: index }, 'ACTION6');
    }
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
  if (scene.fixedCarrier !== undefined) {
    const owned = new Map<number, number>();
    for (const [i, [x, y]] of rectangles.map(([l, t]) => [l, t] as const).entries()) {
      const paint = i === scene.fixedCarrier ? scene.carrierInk! : scene.paint;
      let count = 0;
      for (const [cx, cy] of scene.pieces[i]?.mask ?? [[0, 0]]) {
        for (let dy = 0; dy < pitch; dy++) for (let dx = 0; dx < pitch; dx++) {
          const color = rows[y + cy * pitch + dy]?.[x + cx * pitch + dx];
          if (color === paint) count++;
          else if (i !== scene.fixedCarrier || color !== scene.selectedInk) return false;
        }
      }
      if (count === 0) return false;
      owned.set(paint, (owned.get(paint) ?? 0) + count);
    }
    const [l, t] = scene.origin;
    for (let y = t; y < t + scene.height * pitch; y++) for (let x = l; x < l + scene.width * pitch; x++) {
      const paint = rows[y]?.[x];
      if (paint !== undefined && owned.has(paint)) owned.set(paint, owned.get(paint)! - 1);
    }
    return [...owned.values()].every(count => count === 0);
  }
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
    return { ...state, position: move.position, path: state.path.slice(1), evidence: [...state.evidence.slice(-5), ref], observedControls,
      ...(scene.fixedCarrier !== undefined && move.contact !== null ? { contactRef: ref } : {}) };
  }
  if (state.blocked.length < 8 && !same(position, move.position) && matchesPositions(rows, scene, position) &&
    (!isSelection || pixel(rows, center(contactBox(scene, position.pieces[position.selected]!, position.selected))) === scene.selectedInk)) {
    return { ...state, path: [], blocked: [...state.blocked, moveKey(position, move.position)] };
  }
  return null;
}
