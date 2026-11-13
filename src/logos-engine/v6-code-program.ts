/** Complete native transfer of V6 common_code_program.py at 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e. */
import { geometricComponents, projection, rowsDigest, v6Digest } from './v6-native-observer.ts';
import type { ObservedInputDomain } from './v6-native-observer.ts';
import type { NativePoint, NativePublicObservation, NativeRows } from './v6-native-types.ts';
export type CodeRecord = Record<string, any>;
export interface CodeCommand extends CodeRecord { action_ref: string; data?: Record<string, number> }
export interface CodeObservation extends CodeRecord { entities: readonly CodeRecord[]; level_epoch: number; levels_completed: number; observation_ref: string; frame_hash: string; state: string }
/** Arbitrary Python code words stay exact beyond the JSON safe-integer domain. */
export type CodeWord = number | { readonly $v6_integer: string };
export const CODE_DIRECTIONS: readonly NativePoint[] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const keyOf = (value: unknown): string => JSON.stringify(value);
const pointKey = (value: NativePoint): string => keyOf(value);
const comparePoint = (a: NativePoint, b: NativePoint) => a[0] - b[0] || a[1] - b[1];
const addressed = (action: CodeCommand): boolean => !!action.data && Object.keys(action.data).length > 0;
function same(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key]));
}
export function encodeCodeWord(value: bigint): CodeWord { return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= 0n ? Number(value) : { $v6_integer: value.toString() }; }
export function decodeCodeWord(value: CodeWord): bigint {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (value && typeof value === 'object' && Object.keys(value).length === 1 && typeof value.$v6_integer === 'string' && /^(0|[1-9][0-9]*)$/.test(value.$v6_integer)) return BigInt(value.$v6_integer);
  throw new TypeError('Invalid exact native code word');
}
const encodeWords = (values: readonly bigint[]): CodeWord[] => values.map(encodeCodeWord);
const decodeWords = (values: readonly CodeWord[]): bigint[] => values.map(decodeCodeWord);
const wordKey = (position: NativePoint, word: readonly bigint[]): string => keyOf([position, encodeWords(word)]);
function compareWords(a: readonly bigint[], b: readonly bigint[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1; return a.length - b.length; }
function bitCount(value: bigint): number { let result = 0; while (value) { value &= value - 1n; result++; } return result; }
function maskKey(points: readonly NativePoint[]): string { return keyOf([...points].sort(comparePoint)); }

export function codeInputAt(inputs: readonly CodeCommand[], box: readonly number[]): CodeCommand | null {
  return inputs.find(action => addressed(action) && box[0]! <= action.data!.x! && action.data!.x! <= box[2]! && box[1]! <= action.data!.y! && action.data!.y! <= box[3]!) ?? null;
}

export function measureCodeScene(observation: CodeObservation, rows: NativeRows, inputs: readonly CodeCommand[]): CodeRecord | null {
  const parts = observation.entities, tiles = new Map<number, CodeRecord[]>();
  for (const entity of parts) { const [x, y, right, bottom] = entity.bbox; if (entity.rectangular && right - x === bottom - y && right > x) {
    const size = right - x + 1; if (!tiles.has(size)) tiles.set(size, []); tiles.get(size)!.push(entity); } }
  const boards: CodeRecord[] = [];
  for (const [size, group] of tiles) {
    const places = new Map(group.map(entity => [pointKey(entity.position), entity])), left = new Map(group.map(entity => [pointKey(entity.position), entity.position as NativePoint]));
    while (left.size) {
      const seed = left.values().next().value!; left.delete(pointKey(seed));
      const connected = new Map([[pointKey(seed), seed]]), queue = [seed];
      for (let head = 0; head < queue.length; head++) { const [x, y] = queue[head]!; for (const [dx, dy] of CODE_DIRECTIONS) {
        const point: NativePoint = [x + size * dx, y + size * dy], key = pointKey(point); if (left.has(key)) { left.delete(key); connected.set(key, point); queue.push(point); }
      } }
      const xs = [...new Set([...connected.values()].map(p => p[0]))], ys = [...new Set([...connected.values()].map(p => p[1]))];
      const hues = new Set([...connected.keys()].map(key => places.get(key)!.palette_value as number));
      if (xs.length < 3 || ys.length < 3 || hues.size !== 2) continue;
      const x0 = Math.min(...xs), y0 = Math.min(...ys), width = Math.floor((Math.max(...xs) - x0) / size) + 1, height = Math.floor((Math.max(...ys) - y0) / size) + 1;
      if (connected.size * 2 < width * height) continue;
      for (const entity of parts) {
        if (hues.has(entity.palette_value) || entity.area <= size * size / 2) continue;
        const [x, y, right, bottom] = entity.bbox;
        if (right - x + 1 !== size || bottom - y + 1 !== size || (x - x0) % size || (y - y0) % size || !(x0 <= x && x < x0 + width * size && y0 <= y && y < y0 + height * size)) continue;
        const mask = maskKey(entity.mask), targets = new Map<string, NativePoint>();
        for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
          const X = x0 + cx * size, Y = y0 + cy * size, cut = projection(rows, [X, Y, X + size - 1, Y + size - 1]);
          for (const base of hues) {
            const found: NativePoint[] = []; cut.forEach((row, yy) => row.forEach((value, xx) => { if (value === base) found.push([xx, yy]); }));
            if (maskKey(found) !== mask) continue;
            const rim = projection(rows, [Math.max(0, X - 1), Math.max(0, Y - 1), X + size, Y + size]);
            if (rim.flat().filter(value => value === entity.palette_value).length >= size) targets.set(pointKey([cx, cy]), [cx, cy]);
          }
        }
        if (targets.size !== 1) continue;
        boards.push({ origin: [x0, y0], size, shape: [width, height], floor: [...hues].sort((a, b) => a - b), hue: entity.palette_value,
          mask: [...entity.mask].sort(comparePoint), goal: [...targets.values()][0], start: [Math.floor((x - x0) / size), Math.floor((y - y0) / size)] });
      }
    }
  }
  if (boards.length !== 1) return null;
  const board = boards[0]!, [x0, y0] = board.origin, size = board.size, [width, height] = board.shape;
  const glyphs: { x: number; y: number; boxes: number[][] }[] = [], values = new Set<number>();
  for (const entity of parts) {
    const [x, y, right, bottom] = entity.bbox, length = right - x + 1;
    if (!entity.rectangular || bottom !== y || length < 2) continue;
    for (const vertical of parts) {
      const [X, Y, R, B] = vertical.bbox;
      if (!vertical.rectangular || X !== R || B - Y + 1 !== length || 2 * X !== x + right || Y !== y + 2) continue;
      glyphs.push({ x, y, boxes: [entity.bbox, vertical.bbox] }); values.add(entity.palette_value); values.add(vertical.palette_value);
    }
  }
  if (values.size !== 2) return null;
  const rowsByX = new Map<number, { y: number; boxes: number[][] }[]>();
  for (const glyph of glyphs) { if (!rowsByX.has(glyph.x)) rowsByX.set(glyph.x, []); rowsByX.get(glyph.x)!.push(glyph); }
  type Column = { x: number; boxes: number[][] }; type Group = { ys: number[]; columns: Column[] };
  const byRows = new Map<string, Group>();
  for (const [x, entries] of rowsByX) { entries.sort((a, b) => a.y - b.y); const ys = entries.map(entry => entry.y), key = keyOf(ys);
    if (!byRows.has(key)) byRows.set(key, { ys, columns: [] }); byRows.get(key)!.columns.push({ x, boxes: entries.flatMap(entry => entry.boxes) }); }
  const candidateGroups: Group[] = [];
  for (const { ys, columns } of byRows.values()) {
    columns.sort((a, b) => a.x - b.x); if (columns.length < 2) continue;
    const gap = Math.min(...columns.slice(1).map((column, i) => column.x - columns[i]!.x)); let chunk: Column[] = [];
    for (const column of columns) { if (chunk.length && column.x - chunk.at(-1)!.x !== gap) { if (chunk.length >= 2) candidateGroups.push({ ys, columns: chunk }); chunk = []; } chunk.push(column); }
    if (chunk.length >= 2) candidateGroups.push({ ys, columns: chunk });
  }
  const candidates: { y: number; columns: Column[]; bindings: (CodeCommand | null)[][] }[] = [];
  for (const { ys, columns } of candidateGroups) {
    if (ys[0]! < y0 + height * size) continue;
    const middle = (columns[0]!.x + columns.at(-1)!.x) / 2; if (!(x0 <= middle && middle < x0 + width * size)) continue;
    const bindings = columns.map(column => column.boxes.map(box => codeInputAt(inputs, box)));
    if (!bindings.every(row => row.every(Boolean))) continue;
    candidates.push({ y: ys[0]!, columns, bindings });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.y - b.y); const { columns, bindings } = candidates[0]!;
  const bottom = Math.max(...columns.flatMap(column => column.boxes.map(box => box[3]!)));
  const buttons: { distance: number; entity: CodeRecord; command: CodeCommand }[] = [];
  for (const entity of parts) {
    const [left, top, right, b] = entity.bbox;
    if (board.floor.includes(entity.palette_value) || entity.palette_value === board.hue || top <= bottom || Math.min(left, top) === 0 || right === rows[0]!.length - 1 || b === rows.length - 1) continue;
    if (Math.abs((right - left) - (b - top)) > 1 || right - left + 1 <= size || entity.area * 2 <= (right - left + 1) * (b - top + 1)) continue;
    const command = codeInputAt(inputs, entity.bbox); if (command) buttons.push({ distance: Math.abs((left + right) / 2 - (columns[0]!.x + columns.at(-1)!.x) / 2), entity, command });
  }
  if (!buttons.length) return null;
  buttons.sort((a, b) => a.distance - b.distance); const button = buttons[0]!;
  const examples: CodeRecord[] = [];
  for (const group of candidateGroups) {
    if (same(group.columns, columns) || group.columns[0]!.boxes.length !== columns[0]!.boxes.length) continue;
    const left = Math.min(...group.columns.map(column => column.x)), right = Math.max(...group.columns.flatMap(column => column.boxes.map(box => box[2]!)));
    const demoBottom = Math.max(...group.columns.flatMap(column => column.boxes.map(box => box[3]!)));
    for (const entity of parts) {
      const box = entity.bbox; if (entity.palette_value !== board.hue || box[1] <= demoBottom || Math.max(box[2] - box[0] + 1, box[3] - box[1] + 1) >= size) continue;
      const command = codeInputAt(inputs, box); if (command) examples.push({ command, box, columns: group.columns.map(column => column.boxes), stage: [left - size, 0, right + size, group.ys[0]! - 1] });
    }
  }
  Object.assign(board, { columns: columns.map(column => column.boxes), bit_commands: bindings, values: [...values].sort((a, b) => a - b), execute: button.command,
    button_box: button.entity.bbox, button_hue: button.entity.palette_value, examples });
  const allowed = new Map<string, NativePoint>();
  for (let cy = 0; cy < height; cy++) for (let cx = 0; cx < width; cx++) {
    const cut = projection(rows, [x0 + cx * size, y0 + cy * size, x0 + (cx + 1) * size - 1, y0 + (cy + 1) * size - 1]);
    if (cut.flat().every(value => board.floor.includes(value) || value === board.hue)) allowed.set(pointKey([cx, cy]), [cx, cy]);
  }
  allowed.set(pointKey(board.start), board.start); allowed.set(pointKey(board.goal), board.goal); board.allowed = [...allowed.values()].sort(comparePoint); return board;
}

export function codePosition(rows: NativeRows, board: CodeRecord): NativePoint | null {
  const [x0, y0] = board.origin, size = board.size, [width, height] = board.shape, found: NativePoint[] = [];
  if (y0 + height * size > rows.length || x0 + width * size > rows[0]!.length) return null;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if ((board.mask as NativePoint[]).every(([i, j]) => rows[y0 + y * size + j]![x0 + x * size + i] === board.hue)) found.push([x, y]);
  return found.length === 1 ? found[0]! : null;
}
export function codeBits(rows: NativeRows, board: CodeRecord, columns?: readonly (readonly (readonly number[])[])[]): CodeWord[] | null {
  const result: CodeWord[] = [];
  for (const column of columns?.length ? columns : board.columns as number[][][]) {
    let word = 0n;
    for (const box of column) { const colors = [...new Set(projection(rows, box).flat())]; if (colors.length !== 1 || !board.values.includes(colors[0])) return null;
      word = word * 2n + BigInt(board.values.indexOf(colors[0])); }
    result.push(encodeCodeWord(word));
  }
  return result;
}
export function moveCodePosition(position: NativePoint, delta: NativePoint, board: CodeRecord): NativePoint {
  const next: NativePoint = [position[0] + delta[0], position[1] + delta[1]]; return board.allowed.some((point: NativePoint) => same(point, next)) ? next : position;
}
export function physicalCodePaths(board: CodeRecord, start: NativePoint, length: number, effects: ReadonlyMap<bigint, NativePoint>): CodeWord[][] {
  const result: CodeWord[][] = [];
  const walk = (position: NativePoint, path: bigint[]): void => {
    if (path.length === length) { if (same(position, board.goal)) result.push(encodeWords(path)); return; }
    const distance = Math.abs(position[0] - board.goal[0]) + Math.abs(position[1] - board.goal[1]); if (distance > length - path.length) return;
    for (const [code, delta] of effects) { const next = moveCodePosition(position, delta, board); if (!same(next, position)) walk(next, [...path, code]); }
  };
  walk(start, []); return result;
}

export class CodeProgram {
  readonly id = 'code_program'; readonly familyId = 'code_program';
  epoch: number | null = null; prior: Map<bigint, NativePoint> | null = null; passed: CodeRecord[] = []; events: CodeRecord[] = [];
  board: CodeRecord | null | undefined; effects = new Map<bigint, NativePoint>(); executed = new Map<string, readonly [NativePoint, readonly bigint[]]>();
  demoTried = new Set<number>(); counterexamples: CodeRecord[] = []; evidence: string[] = []; toggleKnown = false; initialRef: string | undefined; lastStart: unknown = null;
  state(): CodeRecord {
    const result: CodeRecord = { format: 'native.code_program.v1/exact-integers', epoch: this.epoch,
      prior: this.prior === null ? null : [...this.prior].map(([word, vector]) => [encodeCodeWord(word), vector]), passed: this.passed, events: this.events };
    if (this.board !== undefined) Object.assign(result, { board: this.board, effects: [...this.effects].map(([word, vector]) => [encodeCodeWord(word), vector]),
      executed: [...this.executed.values()].map(([position, word]) => [position, encodeWords(word)]).sort((a, b) => {
        const c = comparePoint(a[0] as NativePoint, b[0] as NativePoint); return c || compareWords(decodeWords(a[1] as CodeWord[]), decodeWords(b[1] as CodeWord[])); }),
      demo_tried: [...this.demoTried].sort((a, b) => a - b), counterexamples: this.counterexamples, evidence: this.evidence,
      toggle_known: this.toggleKnown, initial_ref: this.initialRef, last_start: this.lastStart });
    return structuredClone(result);
  }
  restore(snapshot: CodeRecord): void {
    const value = structuredClone(snapshot);
    if (value.format !== 'native.code_program.v1/exact-integers' || !Array.isArray(value.events) || !Array.isArray(value.passed)
      || Object.hasOwn(value, 'board') && (!Array.isArray(value.effects) || !Array.isArray(value.executed) || !Array.isArray(value.demo_tried))) throw new TypeError('Incompatible code-program state');
    this.epoch = value.epoch; this.prior = value.prior === null ? null : new Map(value.prior.map(([word, vector]: [CodeWord, NativePoint]) => [decodeCodeWord(word), vector]));
    this.passed = value.passed; this.events = value.events; this.board = value.board;
    this.effects = new Map((value.effects ?? []).map(([word, vector]: [CodeWord, NativePoint]) => [decodeCodeWord(word), vector]));
    this.executed = new Map((value.executed ?? []).map(([position, word]: [NativePoint, CodeWord[]]) => { const codes = decodeWords(word); return [wordKey(position, codes), [position, codes] as const]; }));
    this.demoTried = new Set(value.demo_tried ?? []); this.counterexamples = value.counterexamples ?? []; this.evidence = value.evidence ?? [];
    this.toggleKnown = value.toggle_known ?? false; this.initialRef = value.initial_ref; this.lastStart = value.last_start ?? null;
  }
  start(observation: CodeObservation, rows: NativeRows, inputs: readonly CodeCommand[]): void {
    this.epoch = observation.level_epoch; this.board = measureCodeScene(observation, rows, inputs); this.effects.clear(); this.executed.clear(); this.demoTried.clear(); this.counterexamples = [];
    this.evidence = []; this.toggleKnown = false; this.initialRef = observation.observation_ref; this.lastStart = null;
  }
  async propose(observation: CodeObservation, rows: NativeRows, inputs: readonly CodeCommand[], remaining: number): Promise<CodeRecord | null> {
    if (this.epoch !== observation.level_epoch) this.start(observation, rows, inputs);
    const board = this.board; if (!board) return null;
    const codes = codeBits(rows, board), position = codePosition(rows, board); if (codes === null || position === null) return null;
    const code = decodeWords(codes), choices: { edits: number; word: bigint[] }[] = [];
    for (const encoded of physicalCodePaths(board, position, code.length, this.effects)) { const word = decodeWords(encoded); if (this.executed.has(wordKey(position, word))) continue;
      choices.push({ edits: code.reduce((sum, value, i) => sum + bitCount(value ^ word[i]!), 0), word }); }
    choices.sort((a, b) => a.edits - b.edits || compareWords(a.word, b.word));
    let wanted = choices.length ? choices[0]!.word : code;
    const example = choices.length ? null : board.examples.findIndex((_: unknown, i: number) => !this.demoTried.has(i));
    const selectedExample = example === -1 ? null : example, nbits = board.columns[0].length;
    const weights = Array.from({ length: nbits }, (_, j) => 1n << BigInt(nbits - j - 1));
    if (selectedExample === null && !choices.length && this.executed.size && this.executed.has(wordKey(position, code))) {
      const unknown: bigint[][] = [];
      for (let column = 0; column < code.length; column++) for (const bit of [...weights].reverse()) { const word = [...code]; word[column] = word[column]! ^ bit; if (!this.executed.has(wordKey(position, word))) unknown.push(word); }
      if (!unknown.length) return null; wanted = unknown.sort(compareWords)[0]!;
    }
    const edits: [number, number][] = [];
    code.forEach((value, i) => weights.forEach((bit, j) => { if ((value ^ wanted[i]!) & bit) edits.push([i, j]); }));
    const steps: CodeRecord[] = []; let current = code;
    if (selectedExample !== null) { const card = board.examples[selectedExample], box = [...card.box];
      steps.push({ action: card.command, mode: 'demonstrate', example: selectedExample, code: codes, position, expected_after: null, box, point_digest: await rowsDigest(projection(rows, box)) }); }
    for (const [i, j] of selectedExample === null ? edits.slice(0, Math.min(16, remaining)) : []) {
      const command = board.bit_commands[i][j]; if (!inputs.some(input => same(input, command))) return null;
      const word = [...current]; word[i] = word[i]! ^ weights[j]!; const box = [...board.columns[i][j]];
      steps.push({ action: command, mode: 'edit', code: encodeWords(current), position, expected_after: encodeWords(word), box, point_digest: await rowsDigest(projection(rows, box)) });
      current = word; if (!this.toggleKnown) break;
    }
    if (selectedExample === null && steps.length < Math.min(16, remaining) && (!edits.length || this.toggleKnown && steps.length === edits.length)) {
      const command = board.execute, box = [...board.button_box]; if (!inputs.some(input => same(input, command))) return null;
      steps.push({ action: command, mode: 'execute', code: encodeWords(current), position, expected_after: null, box, point_digest: await rowsDigest(projection(rows, box)) });
    }
    if (!steps.length) return null;
    steps.forEach((step, i) => { step.expected_before = { level_epoch: this.epoch, frame_hash: i === 0 ? observation.frame_hash : null }; });
    const actions = steps.map(step => step.action), refs = [...new Set([observation.observation_ref, this.initialRef!, ...this.evidence])];
    const focus = `C_codes_${(await v6Digest([refs, actions])).slice(0, 16)}`, why = 'Test the labelled execution trace of editable code columns, then synthesize a program ending in the matching cavity.';
    const info = { world_size: board.shape, tile_size: board.size, actor_position: position, goal: board.goal, current_codes: codes, desired_codes: encodeWords(wanted),
      locally_observed_operators: this.effects.size, observed_executions: this.executed.size, available_examples: board.examples.length,
      scope: 'Learn a label from its highlighted local example before using it in the actual world. Translation is admitted only after measured displacement.' };
    const facts = { checkerboard_world_measured: true, shape_cavity_correspondence: true, editable_columns_bound: true };
    return { status: 'proposed', kind: 'learned_code_program', code_plan: info, actions, steps, facts,
      compositions: [{ id: focus, role: 'information_question', observed: false, open_question: why, properties: info, relations: ['contributes_to:G_official_completion'] }],
      question: { reason: why, hypothesis_refs: refs }, route_refs: refs, binding: { observation_ref: observation.observation_ref, level_epoch: this.epoch, levels_completed: observation.levels_completed },
      bundle_template: { operation_key: 'OP18', composition_ref: focus, objective_ref: 'G_official_completion', preserve_refs: [], purpose: why, preconditions: facts, evidence: refs, actions,
        outcome_guard: { path: ['value'], contains: focus } } };
  }
  bind(proposal: CodeRecord, domain: ObservedInputDomain): void {
    const frame = proposal.steps[0].expected_before.frame_hash;
    for (const step of proposal.steps) { const data = step.action.data, old = domain.bindings.get(`${this.epoch}:${frame}`)?.get(`${data.x},${data.y}`);
      if (!old) throw new TypeError('Code input has no current sampled witness'); step.point_binding = { ...old, projection_bbox: step.box, projected_rows_digest: step.point_digest }; }
  }
  before(proposal: CodeRecord, index: number, publicPacket: NativePublicObservation, observation: CodeObservation): CodeRecord {
    const step = proposal.steps[index], bound = proposal.binding;
    const ok = publicPacket.level === bound.level_epoch && publicPacket.levels_completed === bound.levels_completed && publicPacket.available_action_refs.includes(step.action.action_ref)
      && (index !== 0 || observation.observation_ref === bound.observation_ref) && same(codeBits(publicPacket.frame_rows, this.board!), step.code) && same(codePosition(publicPacket.frame_rows, this.board!), step.position);
    return { admitted: !!ok, reason: 'bind_actor_program_bits_and_epoch' };
  }
  after(proposal: CodeRecord, index: number, before: CodeObservation, after: CodeObservation, _first: NativeRows, second: NativeRows): CodeRecord {
    if (!same([before.level_epoch, before.state, before.levels_completed], [after.level_epoch, after.state, after.levels_completed])) return { matched: null, seal_prefix: true, reason: 'official_boundary' };
    const step = proposal.steps[index], matched = step.expected_after?.length ? same(codeBits(second, this.board!), step.expected_after) && same(codePosition(second, this.board!), step.position) : null;
    return { matched, seal_prefix: matched !== true || index + 1 === proposal.steps.length, reason: 'compare_edit_or_observe_execution' };
  }
  record(before: CodeObservation, after: CodeObservation, _command: CodeCommand, first: NativeRows, second: NativeRows, proposal: CodeRecord, index: number, frames: readonly NativeRows[] = []): CodeRecord {
    const step = proposal.steps[index], ref = after.observation_ref, board = this.board!, event: CodeRecord = { ref, mode: step.mode };
    if (step.mode === 'edit') { this.toggleKnown = same(codeBits(second, board), step.expected_after); event.status = this.toggleKnown ? 'observed_edit' : 'edit_refuted'; }
    else {
      const demonstration = step.mode === 'demonstrate'; let example: CodeRecord | null = null, columns: number[][][], code: bigint[] | null, initial: NativePoint | null;
      if (demonstration) { example = board.examples[step.example]; this.demoTried.add(step.example); columns = example!.columns; code = null; initial = null; }
      else { const words = decodeWords(step.code); this.executed.set(wordKey(step.position, words), [step.position, words]); columns = board.columns; code = words; initial = step.position; }
      const trace = new Map<number, NativePoint>(), wordsAt = new Map<number, bigint>();
      for (const frame of frames) {
        let position: NativePoint | null;
        if (demonstration) {
          const current = codeBits(frame, board, columns); if (current !== null) code = decodeWords(current);
          const [left, top, right, bottom] = example!.stage;
          const objects = geometricComponents(frame).filter(component => maskKey(component.mask) === maskKey(board.mask)
            && left <= component.bbox[0] && component.bbox[2] <= right && top <= component.bbox[1] && component.bbox[3] <= bottom);
          position = objects.length === 1 ? [objects[0]!.bbox[0], objects[0]!.bbox[1]] : null;
        } else position = codePosition(frame, board);
        const scores = columns.map(column => projection(frame, [column[0]![0]! - 1, column[0]![1]! - 1, column[0]![2]! + 1, column.at(-1)![3]! + 1]).flat().filter(value => value === board.button_hue).length);
        const maximum = Math.max(...scores);
        if (maximum === 0) { if (initial === null && position !== null) initial = position; continue; }
        if (scores.filter(score => score === maximum).length !== 1) continue;
        const highlighted = scores.indexOf(maximum);
        if (position !== null) { trace.set(highlighted, position); if (code !== null && highlighted < code.length) wordsAt.set(highlighted, code[highlighted]!); }
      }
      const samples: CodeRecord[] = [];
      if (code !== null) for (const [j, position] of [...trace].sort(([a], [b]) => a - b)) {
        if (j >= code.length) continue;
        const start = j === 0 ? initial : trace.get(j - 1); if (start == null) continue;
        const dx = position[0] - start[0], dy = position[1] - start[1], quantum = demonstration ? board.size : 1;
        const vector: NativePoint = [Math.floor(dx / quantum), Math.floor(dy / quantum)];
        if (dx !== vector[0] * quantum || dy !== vector[1] * quantum || !CODE_DIRECTIONS.some(direction => same(direction, vector))) continue;
        const label = wordsAt.get(j) ?? code[j]!; samples.push({ code: encodeCodeWord(label), displacement: vector });
        const old = this.effects.get(label);
        if (old && !same(old, vector)) { this.counterexamples.push({ code: encodeCodeWord(label), before: old, after: vector, ref }); this.effects.delete(label); }
        else this.effects.set(label, vector);
      }
      Object.assign(event, { status: demonstration ? 'demonstration_measured' : 'execution_measured', highlighted_transitions: samples.length,
        observed_operators: this.effects.size, measured: samples, preserved_actual_world: demonstration ? same(codePosition(first, board), codePosition(second, board)) : null });
      if (samples.length) this.evidence.push(ref);
    }
    if (after.levels_completed > before.levels_completed) { this.prior = new Map(this.effects); this.passed.push({ score: after.levels_completed, ref }); event.status = 'official_boundary'; }
    this.events.push(event); return event;
  }
}
