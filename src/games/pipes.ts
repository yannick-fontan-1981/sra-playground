/**
 * PIPE — deterministic browser port of custom_games/engines/pipes.py.
 * Reference: ARC-AGI-3-Yannick-Fontan@212d8d426f07eea2b6797c2bb647545767488a96.
 * Adapted from Yannick Fontan's repository; license notices are retained in
 * the project notices and the unchanged Python reference.
 * English level copy is the only intentional change to game observations.
 * No solution, agent, network request, timer, or random choice exists here.
 */

export const SIZE = 64;
export const FRAME = SIZE;
export const LEVEL_COUNT = 6;
export const GAME_ID = 'pipe-c3000001';
export const FAMILY = 'pipes';
export const WAVE = 'custom_3';
export const ANIM_FPS = 10;
export const PALETTE = [
  '#F3F2EB', '#C9CDC8', '#37404B', '#66707B', '#1B2028', '#11161C',
  '#614439', '#E7B9A3', '#F06B65', '#679DEB', '#63D5D6', '#F1CE62',
  '#EBA258', '#86513A', '#77CB93', '#BB94EB',
] as const;

const C_WHITE = 0, C_GRID = 2, C_OUTLINE = 3, C_BACKGROUND = 4, C_BOARD = 5;
const C_BLUE = 9, C_CYAN = 10, C_GREEN = 14;
export const DIRECTIONS = [
  [-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2],
] as const;

export type Raster = number[][];
export type Cell = [number, number];
export type GameState = 'NOT_FINISHED' | 'WIN';
export interface LevelConfig {
  readonly number: number;
  readonly title: string;
  readonly note: string;
  readonly size: number;
  readonly source: readonly [number, number];
  readonly pipes: ReadonlyArray<ReadonlyArray<number>>;
}

const builtinLevels: LevelConfig[] = [
  { number: 1, title: 'First connection', note: 'Rotate the pipes to extend the blue network.',
    size: 3, source: [0, 0], pipes: [[2, 10, 12], [3, 10, 12], [9, 10, 4]] },
  { number: 2, title: 'A branching path', note: 'A T-junction supplies three directions.',
    size: 3, source: [1, 1], pipes: [[2, 3, 2], [3, 13, 10], [8, 3, 6]] },
  { number: 3, title: 'Start at the edges', note: 'No opening should point outside the grid.',
    size: 4, source: [1, 1], pipes: [[2, 14, 10, 2], [3, 11, 10, 8], [5, 8, 5, 6], [12, 5, 5, 9]] },
  { number: 4, title: 'One network', note: 'Connect the isolated groups, too.',
    size: 4, source: [2, 1], pipes: [[3, 11, 5, 8], [10, 7, 10, 6], [10, 7, 2, 10], [1, 1, 8, 6]] },
  { number: 5, title: 'One step at a time', note: 'Start at the blue source and build each branch.',
    size: 5, source: [2, 2], pipes: [[2, 7, 6, 4, 4], [6, 12, 9, 14, 6], [5, 6, 14, 7, 3], [5, 10, 5, 4, 10], [12, 9, 1, 8, 9]] },
  { number: 6, title: 'Every branch', note: 'Connect the whole grid without leaks or loops.',
    size: 5, source: [2, 2], pipes: [[6, 11, 5, 5, 2], [4, 9, 12, 6, 12], [8, 10, 11, 9, 10], [3, 11, 7, 5, 14], [4, 4, 1, 8, 9]] },
];

// Export immutable authoring data; instances always own their mutable boards.
export const LEVELS: readonly LevelConfig[] = Object.freeze(builtinLevels.map(level => {
  for (const row of level.pipes) Object.freeze(row);
  Object.freeze(level.pipes);
  Object.freeze(level.source);
  return Object.freeze(level);
}));

export interface NetworkAnalysis {
  wet: boolean[][];
  connected: number;
  total: number;
  leaks: Array<{ cell: Cell; direction: number }>;
  leakCount: number;
  edges: number;
  components: number;
  cycles: number;
  solved: boolean;
}

export interface PipesObservation {
  backend: 'custom';
  selected: true;
  game_id: string;
  title: string;
  custom_family: string;
  wave: typeof WAVE;
  frame: Raster;
  frames: Raster[];
  frame_count: number;
  default_fps: number;
  state: GameState;
  level: number;
  levels_completed: number;
  score: number;
  win_levels: number;
  win_score: number;
  step_index: number;
  last_action: string | null;
  available_actions: string[];
  available_action_ids: number[];
  full_reset: boolean;
  test_mode: boolean;
  level_name: string;
  moves: number;
  selected_cell: Cell | null;
  connected: number;
  total: number;
  completion: number;
  leak_count: number;
  cycle_count: number;
  completed: boolean[];
  event: string;
  played_level?: number;
  played_moves?: number;
}

interface PipesInfo {
  game_id: string;
  title: string;
  family: string;
  levels: number;
  default_fps: number;
}

export interface PipesOptions {
  info?: Partial<PipesInfo>;
  /** In-memory counterpart of Python's levels_dir, for authoring and parity tests. */
  levels?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function integer(value: unknown, label: string, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < low || value > high) {
    throw new RangeError(`${label} must be an integer from ${low} to ${high}`);
  }
  return value;
}

function parseLevel(data: unknown, number: number): LevelConfig {
  if (!isRecord(data)) throw new TypeError(`Level ${number} must be an object`);
  if ('number' in data && integer(data.number, 'number', 1, LEVEL_COUNT) !== number) {
    throw new RangeError(`Expected level number ${number}, got ${String(data.number)}`);
  }
  const size = integer(data.size, 'size', 2, 6);
  const title = data.title === undefined ? 'Pipes' : data.title;
  const note = data.note === undefined ? '' : data.note;
  if (typeof title !== 'string' || typeof note !== 'string') {
    throw new TypeError(`Level ${number}: title and note must be text`);
  }
  if (!Array.isArray(data.source) || data.source.length !== 2) {
    throw new TypeError(`Level ${number}: source must contain row and column`);
  }
  const source: Cell = [integer(data.source[0], 'source row', 0, size - 1),
    integer(data.source[1], 'source column', 0, size - 1)];
  if (!Array.isArray(data.pipes) || data.pipes.length !== size) {
    throw new TypeError(`Level ${number}: pipes must have ${size} rows`);
  }
  const pipes = data.pipes.map((rawRow: unknown, row: number) => {
    if (!Array.isArray(rawRow) || rawRow.length !== size) {
      throw new TypeError(`Level ${number}: pipe row ${row} must have ${size} masks`);
    }
    return rawRow.map((mask: unknown, col: number) => integer(mask, `pipe (${row}, ${col})`, 1, 15));
  });
  // Intentionally discard solution and every other authoring-only field.
  return { number, title: title || 'Pipes', note, size, source, pipes };
}

export function rotate(mask: number): number {
  return ((mask << 1) & 15) | (mask >> 3);
}

/** Analyze reciprocal openings; never change either input or consult a solution. */
export function analyze(pipes: ReadonlyArray<ReadonlyArray<number>>, source: readonly number[]): NetworkAnalysis {
  const size = pipes.length, total = size * size;
  const adjacency: number[][] = Array.from({ length: total }, () => []);
  const leaks: NetworkAnalysis['leaks'] = [];
  let edges = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      for (const [dr, dc, bit, opposite] of DIRECTIONS) {
        if (!(pipes[row]![col]! & bit)) continue;
        const rr = row + dr, cc = col + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size || !(pipes[rr]![cc]! & opposite)) {
          leaks.push({ cell: [row, col], direction: bit });
        } else {
          adjacency[row * size + col]!.push(rr * size + cc);
          if (bit === 2 || bit === 4) edges++;
        }
      }
    }
  }
  const reach = (start: number): Set<number> => {
    const seen = new Set([start]), todo = [start];
    for (let i = 0; i < todo.length; i++) {
      for (const neighbor of adjacency[todo[i]!]!) {
        if (!seen.has(neighbor)) { seen.add(neighbor); todo.push(neighbor); }
      }
    }
    return seen;
  };
  const supplied = reach(source[0]! * size + source[1]!);
  const wet = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => supplied.has(row * size + col)));
  const visited = new Set<number>();
  let components = 0;
  for (let node = 0; node < total; node++) {
    if (!visited.has(node)) {
      components++;
      for (const member of reach(node)) visited.add(member);
    }
  }
  const cycles = edges - total + components, connected = supplied.size;
  return { wet, connected, total, leaks, leakCount: leaks.length, edges, components, cycles,
    solved: connected === total && leaks.length === 0 && cycles === 0 };
}

interface Geometry { cell: number; span: number; ox: number; oy: number }
function geometryForSize(size: number): Geometry {
  const cell = Math.floor(50 / size), span = cell * size;
  return { cell, span, ox: Math.floor((SIZE - span) / 2), oy: Math.floor((56 - span) / 2) };
}
function center(g: Geometry, [row, col]: readonly number[]): Cell {
  return [g.ox + col! * g.cell + Math.floor(g.cell / 2),
    g.oy + row! * g.cell + Math.floor(g.cell / 2)];
}
function fill(frame: Raster, x: number, y: number, width: number, height: number, color: number): void {
  for (let yy = Math.max(0, y); yy < Math.min(SIZE, y + height); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(SIZE, x + width); xx++) frame[yy]![xx] = color;
  }
}
function outline(frame: Raster, x: number, y: number, width: number, height: number, color: number): void {
  fill(frame, x, y, width, 1, color); fill(frame, x, y + height - 1, width, 1, color);
  fill(frame, x, y, 1, height, color); fill(frame, x + width - 1, y, 1, height, color);
}
function square(frame: Raster, [x, y]: Cell, width: number, color: number): void {
  fill(frame, x - Math.floor(width / 2), y - Math.floor(width / 2), width, width, color);
}
function sameCell(a: Cell | null, b: Cell): boolean {
  return a !== null && a[0] === b[0] && a[1] === b[1];
}

export class PipesEngine {
  readonly info: PipesInfo;
  readonly win_levels: number;
  test_mode = false;
  step_index = 0;
  last_action: string | null = null;
  moves = 0;
  state: GameState = 'NOT_FINISHED';
  private readonly templates: LevelConfig[];
  private readonly fps: number;
  private completed: boolean[] = Array<boolean>(LEVEL_COUNT).fill(false);
  private index = 0;
  private config: LevelConfig;
  private geometry: Geometry;
  private pipes: number[][] = [];
  private selected: Cell | null = null;

  constructor(options: PipesOptions = {}) {
    this.info = { game_id: GAME_ID, title: 'Pipes', family: FAMILY,
      levels: LEVEL_COUNT, default_fps: ANIM_FPS, ...options.info };
    const rawLevels = options.levels === undefined ? LEVELS : options.levels;
    if (!Array.isArray(rawLevels) || rawLevels.length !== LEVEL_COUNT) {
      throw new RangeError('Exactly six levels are required');
    }
    this.templates = rawLevels.map((raw: unknown, i: number) => parseLevel(raw, i + 1));
    this.win_levels = integer(this.info.levels, 'info.levels', 1, LEVEL_COUNT);
    this.fps = integer(this.info.default_fps, 'info.default_fps', 1, 240);
    this.config = this.templates[0]!;
    this.geometry = geometryForSize(this.config.size);
    this.setup(0);
  }

  get levels_completed(): number { return this.completed.filter(Boolean).length; }

  private setup(index: number): void {
    this.index = index;
    this.config = this.templates[index]!;
    this.geometry = geometryForSize(this.config.size);
    this.pipes = this.config.pipes.map(row => [...row]);
    this.selected = null;
    this.moves = 0;
    this.state = 'NOT_FINISHED';
  }

  private network(): NetworkAnalysis { return analyze(this.pipes, this.config.source); }

  private renderFrame(border = false): Raster {
    const cfg = this.config, g = this.geometry;
    const frame = Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(C_BACKGROUND));
    const water = this.network().wet, outer = g.cell >= 12 ? 7 : 5, inner = 3;
    fill(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_GRID);
    for (let row = 0; row < cfg.size; row++) for (let col = 0; col < cfg.size; col++) {
      fill(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
        g.cell - 1, g.cell - 1, C_BOARD);
    }
    const paint = (row: number, col: number, width: number, color: number): void => {
      const left = g.ox + col * g.cell, top = g.oy + row * g.cell;
      const x = left + Math.floor(g.cell / 2), y = top + Math.floor(g.cell / 2);
      const half = Math.floor(width / 2), mask = this.pipes[row]![col]!;
      square(frame, [x, y], width, color);
      if (mask & 1) fill(frame, x - half, top, width, y - top + 1, color);
      if (mask & 2) fill(frame, x, y - half, left + g.cell - x + 1, width, color);
      if (mask & 4) fill(frame, x - half, y, width, top + g.cell - y + 1, color);
      if (mask & 8) fill(frame, left, y - half, x - left + 1, width, color);
    };
    for (let row = 0; row < cfg.size; row++) for (let col = 0; col < cfg.size; col++) {
      paint(row, col, outer, water[row]![col] ? C_BLUE : C_GRID);
    }
    for (let row = 0; row < cfg.size; row++) for (let col = 0; col < cfg.size; col++) {
      paint(row, col, inner, water[row]![col] ? C_CYAN : C_OUTLINE);
    }
    for (let row = 0; row < cfg.size; row++) for (let col = 0; col < cfg.size; col++) {
      if ([1, 2, 4, 8].includes(this.pipes[row]![col]!)) {
        const position = center(g, [row, col]);
        square(frame, position, outer, water[row]![col] ? C_BLUE : C_GRID);
        square(frame, position, inner + 2, water[row]![col] ? C_CYAN : C_OUTLINE);
      }
    }
    outline(frame, g.ox, g.oy, g.span + 1, g.span + 1, C_OUTLINE);
    const sourceCenter = center(g, cfg.source);
    square(frame, sourceCenter, 7, C_BLUE);
    square(frame, sourceCenter, 3, C_CYAN);
    square(frame, sourceCenter, 1, C_WHITE);
    if (this.selected !== null) {
      const [row, col] = this.selected;
      outline(frame, g.ox + col * g.cell + 1, g.oy + row * g.cell + 1,
        g.cell - 1, g.cell - 1, C_WHITE);
    }
    for (let i = 0; i < LEVEL_COUNT; i++) fill(frame, 3 + i * 5, 62, 4, 1, this.completed[i] ? C_GREEN : C_GRID);
    if (border) outline(frame, 0, 0, SIZE, SIZE, C_GREEN);
    return frame;
  }

  render(): Raster { return this.renderFrame(); }

  private response(event = 'observation', frames?: Raster[],
    extra: Pick<Partial<PipesObservation>, 'full_reset' | 'played_level' | 'played_moves'> = {}): PipesObservation {
    const images = frames ?? [this.renderFrame()];
    const available = this.state === 'WIN' ? [7] : [1, 2, 3, 4, 5, 6, 7];
    const target = this.test_mode ? 1 : this.win_levels, net = this.network();
    return {
      backend: 'custom', selected: true, game_id: this.info.game_id, title: this.info.title,
      custom_family: this.info.family, wave: WAVE,
      frame: images[images.length - 1]!, frames: images, frame_count: images.length,
      default_fps: this.fps, state: this.state, level: this.index + 1,
      levels_completed: this.levels_completed, score: this.levels_completed,
      win_levels: target, win_score: target, step_index: this.step_index, last_action: this.last_action,
      available_actions: available.map(id => `ACTION${id}`), available_action_ids: available,
      full_reset: false, test_mode: this.test_mode, level_name: this.config.title,
      moves: this.moves, selected_cell: this.selected === null ? null : [...this.selected],
      connected: net.connected, total: net.total, completion: net.connected / net.total,
      leak_count: net.leakCount, cycle_count: net.cycles, completed: [...this.completed], event, ...extra,
    };
  }

  public_state(): PipesObservation { return this.response(); }
  observe(): PipesObservation { return this.public_state(); }

  reset(): PipesObservation {
    this.test_mode = false;
    this.completed = Array<boolean>(LEVEL_COUNT).fill(false);
    this.step_index = 0;
    this.last_action = 'RESET';
    this.setup(0);
    return this.response('reset', undefined, { full_reset: true });
  }

  level_reset(): PipesObservation {
    this.completed[this.index] = false;
    this.step_index++;
    this.last_action = 'ACTION7';
    this.setup(this.index);
    return this.response('restart');
  }

  private select(actionId: number): PipesObservation {
    let target: Cell;
    if (this.selected === null) target = [0, 0];
    else {
      const deltas: Record<number, Cell> = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] };
      const [dr, dc] = deltas[actionId]!;
      const [row, col] = this.selected, end = this.config.size - 1;
      target = [Math.max(0, Math.min(end, row + dr)), Math.max(0, Math.min(end, col + dc))];
    }
    if (sameCell(this.selected, target)) return this.response('ignored');
    this.selected = target;
    this.step_index++;
    this.last_action = `ACTION${actionId}`;
    return this.response('select');
  }

  private turn(position: Cell, actionId: number): PipesObservation {
    const changedSelection = !sameCell(this.selected, position);
    const [row, col] = position, nextMask = rotate(this.pipes[row]![col]!);
    this.selected = [...position];
    if (nextMask === this.pipes[row]![col]) {
      if (!changedSelection) return this.response('ignored');
      this.step_index++;
      this.last_action = `ACTION${actionId}`;
      return this.response('select');
    }
    this.pipes[row]![col] = nextMask;
    this.moves++;
    this.step_index++;
    this.last_action = `ACTION${actionId}`;
    if (!this.network().solved) return this.response('rotate');
    const played_level = this.index + 1, played_moves = this.moves;
    this.completed[this.index] = true;
    const frames = [this.renderFrame(), this.renderFrame(true), this.renderFrame()];
    if (this.test_mode || this.levels_completed >= this.win_levels) {
      this.state = 'WIN';
      return this.response('win', frames, { played_level, played_moves });
    }
    this.setup(this.index + 1);
    frames.push(this.renderFrame());
    return this.response('success', frames, { played_level, played_moves });
  }

  /** ARC actions; invalid IDs and coordinates leave the current game untouched. */
  action(actionId: unknown, data?: unknown): PipesObservation {
    if (isRecord(actionId)) {
      const packet = actionId;
      data = packet.data;
      actionId = Object.prototype.hasOwnProperty.call(packet, 'id') ? packet.id : packet.action;
    }
    if (typeof actionId === 'string') {
      const aliases: Record<string, number> = { RESET: 0, click: 6, rotate: 5, space: 5 };
      for (let i = 1; i <= 7; i++) aliases[`ACTION${i}`] = i;
      actionId = Object.prototype.hasOwnProperty.call(aliases, actionId) ? aliases[actionId] : -1;
    }
    if (typeof actionId !== 'number' || !Number.isInteger(actionId) || actionId < 0 || actionId > 7) {
      return this.response('ignored');
    }
    if (actionId === 0) return this.reset();
    if (actionId === 7) return this.level_reset();
    if (this.state === 'WIN') return this.response('finished');
    if (actionId <= 4) return this.select(actionId);
    if (actionId === 5) return this.turn(this.selected ?? [0, 0], actionId);
    if (!isRecord(data)) return this.response('ignored');
    const { x, y } = data, g = this.geometry;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)
      || x < g.ox || x >= g.ox + g.span || y < g.oy || y >= g.oy + g.span) {
      return this.response('ignored');
    }
    return this.turn([Math.floor((y - g.oy) / g.cell), Math.floor((x - g.ox) / g.cell)], actionId);
  }

  step(action: unknown, data?: unknown): PipesObservation { return this.action(action, data); }

  /** Display/authoring diagnostics. Never forward this richer view to an agent. */
  view() {
    const cfg = this.config;
    return { level: this.index + 1, title: cfg.title, note: cfg.note, size: cfg.size,
      source: [...cfg.source], pipes: this.pipes.map(row => [...row]),
      selected: this.selected === null ? null : [...this.selected], completed: [...this.completed],
      testMode: this.test_mode, state: this.state, stepIndex: this.step_index, moves: this.moves,
      geometry: { ...this.geometry }, ...this.network() };
  }

  metadata() {
    return this.templates.map(cfg => ({ number: cfg.number, title: cfg.title, note: cfg.note, size: cfg.size }));
  }

  /** Isolated author preview; campaign credit is cleared instead of fabricated. */
  jump_to_level(number: number): PipesObservation {
    integer(number, 'number', 1, LEVEL_COUNT);
    this.test_mode = true;
    this.completed = Array<boolean>(LEVEL_COUNT).fill(false);
    this.step_index = 0;
    this.last_action = null;
    this.setup(number - 1);
    return this.response('preview');
  }

  levelReset(): PipesObservation { return this.level_reset(); }
  restartLevel(): PipesObservation { return this.level_reset(); }
  jumpToLevel(number: number): PipesObservation { return this.jump_to_level(number); }
}
