/** Deterministic pushing puzzles. No browser, solver, agent or network dependency. */
export type Point = Readonly<{x: number; y: number}>;
export type Direction = 'N' | 'S' | 'W' | 'E';
export interface LevelSpec {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly string[];
  readonly facing?: Direction;
}
export interface World {
  readonly id: string;
  readonly title: string;
  readonly terrain: readonly string[];
  readonly start: Point;
  readonly stones: readonly Point[];
  readonly supports: readonly Point[];
  readonly buttons: readonly Point[];
  readonly doors: readonly Point[];
  readonly goal: Point;
  readonly facing: Direction;
}
export interface State {
  readonly hero: Point;
  readonly facing: Direction;
  readonly stones: readonly Point[];
  readonly supports: readonly Point[];
  readonly complete: boolean;
  readonly failed: boolean;
}
export interface Observation {
  gameCode: string;
  frame: number[][];
  frames: number[][][];
  frameDurationsMs?: number[];
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
export const GRID = Object.freeze({cells: 20, cellPx: 3, originPx: 2, canvasPx: 64});
/** Same sixteen colour conventions as SS01. */
export const PALETTE: readonly string[] = Object.freeze([
  '#ffffff', '#cccccc', '#999999', '#777777', '#333333', '#000000',
  '#e03bca', '#f5a9c8', '#ef4141', '#2765d3', '#43d9eb', '#ffe14a',
  '#f59e29', '#8b5a2b', '#50b848', '#9e6bdb',
]);
export const VECTORS: Readonly<Record<Direction, Point>> = Object.freeze({
  N: {x: 0, y: -1}, S: {x: 0, y: 1}, W: {x: -1, y: 0}, E: {x: 1, y: 0},
});
const directionIds: Readonly<Record<number, Direction>> = {1: 'N', 2: 'S', 3: 'W', 4: 'E'};
export const equal = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export const contains = (points: readonly Point[], p: Point): boolean => points.some(q => equal(p, q));
export const offset = (p: Point, d: Direction): Point => ({x: p.x + VECTORS[d].x, y: p.y + VECTORS[d].y});
export const inside = (p: Point): boolean => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < 20 && p.y < 20;
export const terrainAt = (w: World, p: Point): string => inside(p) ? w.terrain[p.y * 20 + p.x]! : '#';
export const doorsOpen = (w: World, s: State): boolean => w.buttons.length > 0 && w.buttons.every(p => equal(p, s.hero) || contains(s.stones, p));
export const supported = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '.' || contains(s.supports, p);
const blocked = (w: World, s: State, p: Point): boolean => terrainAt(w, p) === '#' || (contains(w.doors, p) && !doorsOpen(w, s));
const safeDoors = (w: World, s: State): boolean => doorsOpen(w, s) || w.doors.every(p => !equal(p, s.hero) && !contains(s.stones, p));
export function compileLevel(spec: LevelSpec): World {
  const width = spec.rows[0]?.length ?? 0;
  if (!spec.id.trim() || !spec.title.trim() || !width || width > 20 || !spec.rows.length || spec.rows.length > 20 || spec.rows.some(r => r.length !== width)) throw new Error('A nonempty rectangular map of at most 20×20 cells is required.');
  if (spec.facing !== undefined && !Object.hasOwn(VECTORS, spec.facing)) throw new Error('Invalid facing.');
  const ox = Math.floor((20 - width) / 2), oy = Math.floor((20 - spec.rows.length) / 2);
  const terrain = Array<string>(400).fill('#');
  const starts: Point[] = [], stones: Point[] = [], supports: Point[] = [], buttons: Point[] = [], doors: Point[] = [], goals: Point[] = [];
  spec.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (!'#.~WobD*sg@'.includes(c)) throw new Error(`Unknown tile: ${c}`);
    const p = Object.freeze({x: x + ox, y: y + oy});
    terrain[p.y * 20 + p.x] = '#~'.includes(c) ? c : c === 's' ? '~' : '.';
    if (c === 'W' || c === '@') starts.push(p);
    if (c === 'o' || c === '*') stones.push(p);
    if (c === 's') supports.push(p);
    if (c === 'b' || c === '*' || c === '@') buttons.push(p);
    if (c === 'D') doors.push(p);
    if (c === 'g') goals.push(p);
  }));
  if (starts.length !== 1 || goals.length !== 1) throw new Error('SS02 requires one Warrior and one destination.');
  if (doors.length && !buttons.length) throw new Error('Doors require a visible pressure button.');
  return Object.freeze({id: spec.id, title: spec.title, terrain: Object.freeze(terrain), start: starts[0]!, goal: goals[0]!, stones: Object.freeze(stones), supports: Object.freeze(supports), buttons: Object.freeze(buttons), doors: Object.freeze(doors), facing: spec.facing ?? 'N'});
}
export function initialState(w: World): State {
  return {hero: {...w.start}, facing: w.facing, stones: w.stones.map(p => ({...p})), supports: w.supports.map(p => ({...p})), complete: false, failed: false};
}
export interface PushPlan {
  from: Point; to: Point; valid: boolean; sinks: boolean;
  stones: readonly Point[]; destinations: readonly Point[];
}
/** Push an entire contiguous file one cell; blocked tail cancels the whole action. */
export function planPush(w: World, s: State, direction: Direction): PushPlan | null {
  if (s.complete) return null;
  const from = offset(s.hero, direction);
  if (!contains(s.stones, from)) return null;
  const stones: Point[] = [];
  let to = from;
  while (contains(s.stones, to)) {stones.push(to); to = offset(to, direction);}
  const destinations = stones.map(p => offset(p, direction));
  const sinks = terrainAt(w, to) === '~' && !contains(s.supports, to);
  const plan: PushPlan = {from, to, valid: !blocked(w, s, to), sinks, stones, destinations};
  if (plan.valid) plan.valid = safeDoors(w, performPush(s, plan));
  return plan;
}
function performPush(s: State, plan: PushPlan): State {
  const moved = s.stones.flatMap(p => {
    const index = plan.stones.findIndex(q => equal(p, q));
    if (index < 0) return [p];
    const target = plan.destinations[index]!;
    return plan.sinks && equal(target, plan.to) ? [] : [target];
  });
  return {...s, hero: plan.from, stones: moved,
    supports: plan.sinks ? [...s.supports, plan.to] : s.supports, failed: false};
}
/** A direction moves the Warrior or pushes the adjacent file and follows it. */
export function stepWorld(w: World, s: State, actionId: number): State {
  if (!Number.isInteger(actionId) || actionId < 1 || actionId > 4) throw new RangeError('SS02 accepts ACTION1–ACTION4.');
  if (s.complete) return s;
  let next: State = {...s, failed: false};
  const direction = directionIds[actionId]!;
  const p = offset(s.hero, direction);
  next = {...next, facing: direction};
  if (contains(s.stones, p)) {
    const plan = planPush(w, s, direction)!;
    next = plan.valid ? performPush(next, plan) : {...next, failed: true};
  } else {
    if (supported(w, s, p) && !blocked(w, s, p)) {
      const moved = {...next, hero: p};
      if (safeDoors(w, moved)) next = moved;
    }
  }
  return {...next, complete: equal(next.hero, w.goal)};
}
type Sprite = readonly (readonly (number | null)[])[];
const cross = (c: number): Sprite => [[null,c,null],[c,c,c],[null,c,null]];
const square = (c: number, middle: number | null = null): Sprite => [[c,c,c],[c,middle,c],[c,c,c]];
function stampPixels(frame: number[][], p: Point, sprite: Sprite): void {
  sprite.forEach((row, y) => row.forEach((v, x) => {
    const px = p.x + x, py = p.y + y;
    if (v !== null && px >= 2 && px < 62 && py >= 2 && py < 62) frame[py]![px] = v;
  }));
}
function stamp(frame: number[][], p: Point, sprite: Sprite): void {
  if (!inside(p)) return;
  stampPixels(frame, {x: 2 + p.x * 3, y: 2 + p.y * 3}, sprite);
}
function warriorSprite(facing: Direction): Sprite {
  const hero: (number|null)[][] = [[null,8,null],[8,8,8],[null,8,null]], d = VECTORS[facing];
  hero[1+d.y]![1+d.x] = 0;
  return hero;
}
function renderScene(w: World, s: State, stones: readonly Point[], hero: Point | null): number[][] {
  const frame = Array.from({length: 64}, () => Array<number>(64).fill(4));
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const t = terrainAt(w, {x,y}), c = t === '#' ? 4 : t === '~' ? 9 : 3;
    stamp(frame, {x,y}, [[c,c,c],[c,c,c],[c,c,c]]);
  }
  for (const p of s.supports) stamp(frame, p, [[10,13,10],[13,10,13],[10,13,10]]);
  for (const p of w.buttons) stamp(frame, p, cross(7));
  for (const p of w.doors) stamp(frame, p, doorsOpen(w,s) ? [[7,null,7],[null,null,null],[7,null,7]] : square(7,5));
  stamp(frame, w.goal, square(11));
  for (const p of stones) stamp(frame, p, square(13,5));
  if (hero) stamp(frame, hero, warriorSprite(s.facing));
  for (const p of w.buttons) if (contains(stones,p) || (hero && equal(p,hero))) stamp(frame,p,[[7,null,7],[null,null,null],[7,null,7]]);
  if (contains(stones,w.goal)) stamp(frame,w.goal,[[11,null,11],[null,null,null],[11,null,11]]);
  return frame;
}
export function renderWorld(w: World, s: State): number[][] {
  return renderScene(w, s, s.stones, s.hero);
}
/** Intermediates are presentation only; they never advance game logic. */
export function transitionFrames(w: World, before: State, after: State, action: number): number[][][] {
  const direction = directionIds[action];
  if (!direction || after.failed || equal(before.hero,after.hero)) return [renderWorld(w,after)];
  const plan = planPush(w,before,direction);
  if (!plan?.valid) return [renderWorld(w,after)];
  const stationary = before.stones.filter(p => !contains(plan.stones,p)), d = VECTORS[direction];
  const frames = [1,2].map(pixels => {
    const frame = renderScene(w,before,stationary,null);
    const shifted = (p: Point): Point => ({x: 2 + p.x * 3 + d.x * pixels, y: 2 + p.y * 3 + d.y * pixels});
    for (const p of plan.stones) stampPixels(frame,shifted(p),square(13,5));
    stampPixels(frame,shifted(before.hero),warriorSprite(direction));
    return frame;
  });
  return [...frames,renderWorld(w,after)];
}
interface Snapshot {index: number; completed: number[]; state: State}
export class PushPuzzleSession {
  private readonly worlds: readonly World[];
  private readonly gameCode: string;
  private index = 0;
  private completed = new Set<number>();
  private state: State;
  private history: Snapshot[] = [];
  constructor(levels: readonly LevelSpec[], gameCode = 'SS02') {
    if (!levels.length || new Set(levels.map(l=>l.id)).size !== levels.length || !/^[A-Z0-9]{4}$/.test(gameCode)) throw new Error('Unique levels and a four-character game code are required.');
    this.worlds = levels.map(compileLevel); this.gameCode = gameCode; this.state = initialState(this.worlds[0]!);
  }
  observe(): Observation {
    const frame = renderWorld(this.worlds[this.index]!,this.state);
    return {gameCode:this.gameCode,frame,frames:[frame],state:this.completed.size===this.worlds.length?'WIN':'NOT_FINISHED',availableActionIds:[1,2,3,4],canUndo:this.history.length>0,canSelectLevel:true,level:this.index+1,levelCount:this.worlds.length,levelsCompleted:this.completed.size,defaultFps:10,palette:[...PALETTE]};
  }
  action(actionId: number): Observation {
    const world=this.worlds[this.index]!,before=this.state,next=stepWorld(world,before,actionId);
    if (JSON.stringify(next)===JSON.stringify(before)) return this.observe();
    this.history.push({index:this.index,completed:[...this.completed],state:before}); this.state=next;
    const frames=transitionFrames(world,before,next,actionId);
    const durations=frames.length>1?[60,80,0]:[0];
    if (next.complete) {
      this.completed.add(this.index);
      const nextIndex=this.worlds.findIndex((_,i)=>!this.completed.has(i));
      if (nextIndex!==-1) {this.index=nextIndex;this.state=initialState(this.worlds[this.index]!);}
    }
    const observation=this.observe();
    if (this.state!==next) {durations[durations.length-1]=100;frames.push(observation.frame);durations.push(0);}
    return {...observation,frames,frameDurationsMs:durations};
  }
  undo(): Observation {
    const snapshot=this.history.pop();
    if (snapshot) {this.index=snapshot.index;this.completed=new Set(snapshot.completed);this.state=snapshot.state;}
    return this.observe();
  }
  reset(): Observation {this.completed.delete(this.index);this.state=initialState(this.worlds[this.index]!);this.history=[];return this.observe();}
  restart(): Observation {this.index=0;this.completed.clear();return this.reset();}
  selectLevel(level: number): Observation {
    if (!Number.isInteger(level)||level<1||level>this.worlds.length) throw new RangeError('Invalid level.');
    this.index=level-1;return this.reset();
  }
}
