/** Standalone SS01 game. No imports from the agent, DOM, Python or Playground. */
export type Direction = 'N' | 'S' | 'W' | 'E';
export type MirrorFace = 'NE' | 'SE' | 'SW' | 'NW';
export type Position = Readonly<{ x: number; y: number }>;
export interface LevelSpec {
  readonly id: string;
  readonly title: string;
  /** Original maps, centered in the fixed 20 x 20 logical board. */
  readonly rows: readonly string[];
  readonly facing: Direction;
}
export interface Mirror extends Position { readonly face: MirrorFace }
export interface World {
  readonly id: string;
  readonly title: string;
  readonly tiles: readonly string[];
  readonly mirrors: readonly Mirror[];
  readonly start: Position;
  readonly rocks: readonly Position[];
  readonly buttons: readonly Position[];
  readonly doors: readonly Position[];
  readonly goal: Position;
  readonly facing: Direction;
}
export interface WorldState {
  readonly hero: Position;
  readonly rocks: readonly Position[];
  readonly facing: Direction;
  readonly complete: boolean;
  /** Visual feedback only, not a rule label exposed to an agent. */
  readonly failed: boolean;
}
export interface PilotObservation {
  gameCode: string;
  frame: number[][];
  frames: number[][][];
  state: 'NOT_FINISHED' | 'WIN';
  availableActionIds: number[];
  canUndo: boolean;
  canSelectLevel: boolean;
  level: number;
  levelCount: number;
  levelsCompleted: number;
  defaultFps: number;
  palette: string[];
}
export const GRID = Object.freeze({ cells: 20, cellPx: 3, originPx: 2, canvasPx: 64 });
/** Per-series RGB choices; the Playground's global palette is not modified. */
export const PALETTE: readonly string[] = Object.freeze([
  '#ffffff', '#cccccc', '#999999', '#777777', '#333333', '#000000',
  '#e03bca', '#f5a9c8', '#ef4141', '#2765d3', '#43d9eb', '#ffe14a',
  '#f59e29', '#8b5a2b', '#50b848', '#9e6bdb',
]);
const DELTA: Record<Direction, Position> = {
  N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 }, E: { x: 1, y: 0 },
};
const ACTION_DIRECTION: Record<number, Direction> = { 1: 'N', 2: 'S', 3: 'W', 4: 'E' };
const FACES: Record<string, MirrorFace> = { '1': 'NE', '2': 'SE', '3': 'SW', '4': 'NW' };
const ARMS: Record<MirrorFace, readonly Direction[]> = {
  NE: ['N', 'E'], SE: ['S', 'E'], SW: ['S', 'W'], NW: ['N', 'W'],
};
const same = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
const inside = (p: Position): boolean => Number.isInteger(p.x) && Number.isInteger(p.y)
  && p.x >= 0 && p.x < GRID.cells && p.y >= 0 && p.y < GRID.cells;
const tile = (w: World, p: Position): string => inside(p) ? w.tiles[p.y * GRID.cells + p.x]! : '#';
const mirrorAt = (w: World, p: Position): boolean => w.mirrors.some(m => same(m, p));
const rockAt = (s: WorldState, p: Position): boolean => s.rocks.some(rock => same(rock, p));
const doorAt = (w: World, p: Position): boolean => w.doors.some(door => same(door, p));
/** A single AND circuit. No implicit latch or hidden occupied-door exception. */
export function buttonsPressed(w: World, s: WorldState): boolean {
  return w.buttons.length > 0 && w.buttons.every(p => same(p, s.hero) || rockAt(s, p));
}
const solid = (w: World, s: WorldState, p: Position): boolean => tile(w, p) === '#'
  || mirrorAt(w, p) || (doorAt(w, p) && !buttonsPressed(w, s));
const floor = (w: World, s: WorldState, p: Position): boolean => tile(w, p) === '.' && !solid(w, s, p);
/** Reject an entire move/swap if it would close a door onto any entity. */
const doorsSafe = (w: World, s: WorldState): boolean => buttonsPressed(w, s)
  || w.doors.every(p => !same(p, s.hero) && !rockAt(s, p));
const along = (p: Position, d: Direction, n = 1): Position => ({
  x: p.x + DELTA[d].x * n, y: p.y + DELTA[d].y * n,
});

export function cellToPixel(p: Position): Position {
  if (!inside(p)) throw new RangeError('Cell outside the 20 x 20 grid.');
  return { x: GRID.originPx + p.x * GRID.cellPx, y: GRID.originPx + p.y * GRID.cellPx };
}
export function pixelToCell(x: number, y: number): Position | null {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 2 || y < 2 || x >= 62 || y >= 62) return null;
  return { x: Math.floor((x - 2) / 3), y: Math.floor((y - 2) / 3) };
}

export function compileLevel(spec: LevelSpec): World {
  const height = spec.rows.length, width = spec.rows[0]?.length ?? 0;
  if (!spec.id.trim() || width < 1 || height < 1 || width > 20 || height > 20
    || spec.rows.some(row => row.length !== width) || !Object.hasOwn(DELTA, spec.facing)) {
    throw new Error('Invalid rectangular level or direction.');
  }
  const ox = Math.floor((20 - width) / 2), oy = Math.floor((20 - height) / 2);
  const tiles: string[] = Array(400).fill('#');
  const mirrors: Mirror[] = [];
  const rocks: Position[] = [], buttons: Position[] = [], doors: Position[] = [];
  let start: Position | undefined, goal: Position | undefined;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const symbol = spec.rows[y]![x]!;
    if (!'#.~Mg1234obD*@'.includes(symbol)) throw new Error(`Unknown map symbol: ${symbol}`);
    const p = Object.freeze({ x: ox + x, y: oy + y });
    tiles[p.y * 20 + p.x] = '#~'.includes(symbol) ? symbol : '.';
    if (symbol === 'M' || symbol === '@') {
      if (start) throw new Error('The pilot requires exactly one merchant.');
      start = p;
    }
    if (symbol === 'g') {
      if (goal) throw new Error('The pilot requires exactly one destination.');
      goal = p;
    }
    if (symbol === 'o' || symbol === '*') rocks.push(p);
    if (symbol === 'b' || symbol === '*' || symbol === '@') buttons.push(p);
    if (symbol === 'D') doors.push(p);
    if (FACES[symbol]) mirrors.push(Object.freeze({ ...p, face: FACES[symbol]! }));
  }
  if (!start || !goal || !mirrors.length) throw new Error('Merchant, destination and mirror required.');
  return Object.freeze({ id: spec.id, title: spec.title, tiles: Object.freeze(tiles),
    mirrors: Object.freeze(mirrors), rocks: Object.freeze(rocks), buttons: Object.freeze(buttons),
    doors: Object.freeze(doors), start, goal, facing: spec.facing });
}
export function initialState(w: World): WorldState {
  return { hero: { ...w.start }, rocks: w.rocks.map(p => ({ ...p })), facing: w.facing, complete: false, failed: false };
}

function rayDistance(origin: Position, p: Position, direction: Direction): number | null {
  const dx = p.x - origin.x, dy = p.y - origin.y;
  const d = DELTA[direction];
  const distance = dx * d.x + dy * d.y;
  return distance > 0 && dx === distance * d.x && dy === distance * d.y ? distance : null;
}
function rayClear(w: World, s: WorldState, origin: Position, d: Direction, distance: number): boolean {
  for (let n = 1; n <= distance; n++) {
    const p = along(origin, d, n);
    if (solid(w, s, p) || (n < distance && rockAt(s, p))) return false;
  }
  return true;
}
/** Geometric counterpart(s). A stone may be the endpoint, never an intervening object. */
export function mirrorCandidates(w: World, s: WorldState): Position[] {
  const candidates: Position[] = [];
  for (const m of w.mirrors) {
    const arms = ARMS[m.face];
    for (let i = 0; i < 2; i++) {
      const sourceArm = arms[i]!, targetArm = arms[1 - i]!;
      const distance = rayDistance(m, s.hero, sourceArm);
      if (distance !== null && rayClear(w, s, m, sourceArm, distance)) {
        const target = along(m, targetArm, distance);
        if (rayClear(w, s, m, targetArm, distance) && floor(w, s, target)) {
          const next = reflectedState(s, target);
          if (doorsSafe(w, next)) candidates.push(target);
        }
      }
    }
  }
  return candidates;
}
function reflectedState(s: WorldState, target: Position): WorldState {
  return { ...s, hero: target, rocks: s.rocks.map(p => same(p, target) ? { ...s.hero } : p) };
}
/** Pure transition. Direction keys move one cell and update facing even on a block. */
export function stepWorld(w: World, s: WorldState, actionId: number): WorldState {
  if (!Number.isInteger(actionId) || actionId < 1 || actionId > 5) throw new RangeError('SS01 actions: 1 to 5.');
  if (s.complete) return s;
  let next: WorldState = { ...s, failed: false };
  const direction = ACTION_DIRECTION[actionId];
  if (direction) {
    next = { ...next, facing: direction };
    const target = along(s.hero, direction);
    if (floor(w, s, target) && !rockAt(s, target)) {
      const moved = { ...next, hero: target };
      if (doorsSafe(w, moved)) next = moved;
    }
  } else {
    const candidates = mirrorCandidates(w, s);
    // No hidden array-order priority when several mirrors are usable.
    next = candidates.length === 1 ? { ...reflectedState(next, candidates[0]!) }
      : { ...next, failed: true };
  }
  return { ...next, complete: same(next.hero, w.goal) };
}

export function renderWorld(w: World, s: WorldState): number[][] {
  const frame = Array.from({ length: 64 }, () => Array<number>(64).fill(4));
  const stamp = (p: Position, sprite: readonly (readonly (number | null)[])[]): void => {
    const q = cellToPixel(p);
    sprite.forEach((row, y) => row.forEach((c, x) => { if (c !== null) frame[q.y + y]![q.x + x] = c; }));
  };
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const c = tile(w, { x, y }) === '#' ? 4 : tile(w, { x, y }) === '~' ? 9 : 3;
    stamp({ x, y }, [[c,c,c],[c,c,c],[c,c,c]]);
  }
  for (const m of w.mirrors) for (const arm of ARMS[m.face]) {
    for (let n = 1; n < 20; n++) {
      const p = along(m, arm, n);
      if (solid(w, s, p)) break;
      const c = s.failed ? 8 : 10;
      stamp(p, DELTA[arm].x ? [[null,null,null],[c,c,c],[null,null,null]]
        : [[null,c,null],[null,c,null],[null,c,null]]);
      if (rockAt(s, p)) break;
    }
  }
  for (const p of w.buttons) stamp(p, [[null,7,null],[7,7,7],[null,7,null]]);
  const open = buttonsPressed(w, s);
  for (const p of w.doors) stamp(p, open ? [[7,null,7],[null,null,null],[7,null,7]]
    : [[7,7,7],[7,5,7],[7,7,7]]);
  for (const m of w.mirrors) {
    let sprite: (number | null)[][] = [[5,5,0],[5,0,null],[0,null,null]];
    const rotations = { SE: 0, SW: 1, NW: 2, NE: 3 }[m.face];
    for (let n = 0; n < rotations; n++) sprite = sprite[0]!.map((_, x) => sprite.map(row => row[x]!).reverse());
    stamp(m, sprite);
  }
  stamp(w.goal, [[11,11,11],[11,null,11],[11,11,11]]);
  for (const p of s.rocks) stamp(p, [[13,13,13],[13,5,13],[13,13,13]]);
  const hero: (number | null)[][] = [[null,12,null],[12,12,12],[null,12,null]];
  const d = DELTA[s.facing];
  hero[1 + d.y]![1 + d.x] = 0;
  stamp(s.hero, hero);
  // Preserve the supporting tile when occupied; stones remain recognizably brown.
  for (const p of w.buttons) if (same(p, s.hero) || rockAt(s, p)) {
    stamp(p, [[7,null,7],[null,null,null],[7,null,7]]);
  }
  if (rockAt(s, w.goal)) stamp(w.goal, [[11,null,11],[null,null,null],[11,null,11]]);
  return frame;
}
interface Snapshot { index: number; completed: number[]; state: WorldState }
/** A host adapter with the public fields expected by BrowserGameRuntime. */
export class SinkingStarSession {
  private readonly worlds: readonly World[];
  private index = 0;
  private completed = new Set<number>();
  private state: WorldState;
  private history: Snapshot[] = [];
  constructor(levels: readonly LevelSpec[]) {
    if (!levels.length || new Set(levels.map(l => l.id)).size !== levels.length) throw new Error('Unique nonempty levels required.');
    this.worlds = levels.map(compileLevel);
    this.state = initialState(this.worlds[0]!);
  }
  observe(): PilotObservation {
    const frame = renderWorld(this.worlds[this.index]!, this.state);
    return { gameCode: 'SS01', frame, frames: [frame], state: this.completed.size === this.worlds.length ? 'WIN' : 'NOT_FINISHED',
      availableActionIds: [1,2,3,4,5], canUndo: this.history.length > 0, canSelectLevel: true,
      level: this.index + 1, levelCount: this.worlds.length, levelsCompleted: this.completed.size,
      defaultFps: 8, palette: [...PALETTE] };
  }
  action(actionId: number): PilotObservation {
    const next = stepWorld(this.worlds[this.index]!, this.state, actionId);
    if (JSON.stringify(next) === JSON.stringify(this.state)) return this.observe();
    this.history.push({ index: this.index, completed: [...this.completed], state: this.state });
    this.state = next;
    if (next.complete) {
      this.completed.add(this.index);
      const nextIndex = this.worlds.findIndex((_, i) => !this.completed.has(i));
      if (nextIndex !== -1) { this.index = nextIndex; this.state = initialState(this.worlds[this.index]!); }
    }
    return this.observe();
  }
  undo(): PilotObservation {
    const snapshot = this.history.pop();
    if (snapshot) { this.index = snapshot.index; this.completed = new Set(snapshot.completed); this.state = snapshot.state; }
    return this.observe();
  }
  reset(): PilotObservation {
    this.completed.delete(this.index);
    this.state = initialState(this.worlds[this.index]!);
    this.history = [];
    return this.observe();
  }
  restart(): PilotObservation { this.index = 0; this.completed.clear(); return this.reset(); }
  selectLevel(level: number): PilotObservation {
    if (!Number.isInteger(level) || level < 1 || level > this.worlds.length) throw new RangeError('Invalid level.');
    this.index = level - 1;
    return this.reset();
  }
}
