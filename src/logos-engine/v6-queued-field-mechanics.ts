/** Pinned V5 queue placement and equal-line closure, with occurrence-preserving receipts. */
import { symbolicDigest as identity } from './v6-hash.ts';

type R = Record<string, any>;
export type QueuedFieldValues = readonly (readonly (number | null)[])[];
export type QueuedFieldCell = { value: number; occurrence_ref: string };
export type QueuedFieldTypedBoard = readonly (readonly (QueuedFieldCell | null)[])[];
type Position = [number, number];

function checkedBoard(value: QueuedFieldTypedBoard): QueuedFieldTypedBoard {
  if (!value.length || !value[0]!.length || value.length * value[0]!.length > 4096 || value.some(row => row.length !== value[0]!.length)) throw new TypeError('A bounded rectangular queue board is required');
  const ids = value.flat().filter((cell): cell is QueuedFieldCell => cell !== null).map(cell => cell.occurrence_ref);
  if (new Set(ids).size !== ids.length) throw new TypeError('Queue occurrence identities must be unique');
  return value;
}

export function queuedFieldTyped(grid: QueuedFieldValues, prefix = 'board'): (QueuedFieldCell | null)[][] {
  return grid.map((row, y) => row.map((value, x) => value === null ? null : { value, occurrence_ref: `${prefix}:${x}:${y}` }));
}
export function queuedFieldValues(grid: QueuedFieldTypedBoard): (number | null)[][] {
  return grid.map(row => row.map(cell => cell === null ? null : cell.value));
}

export function queuedEqualLines(board: QueuedFieldTypedBoard, directions: readonly (readonly number[])[], minimum: number): { runs: Position[][]; removed: Position[] } {
  if (!Number.isSafeInteger(minimum) || minimum < 2) throw new TypeError('Queue line threshold must be at least two');
  const height = board.length, width = board[0]!.length, runs: Position[][] = [], removed = new Map<string, Position>();
  for (const [dr, dc] of directions) {
    if (![[0, 1], [1, 0], [1, 1], [1, -1]].some(([r, c]) => dr === r && dc === c)) throw new TypeError('Queue directions require registered unit vectors');
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
      const cell = board[r]![c];
      if (cell === null) continue;
      const pr = r - dr!, pc = c - dc!;
      if (0 <= pr && pr < height && 0 <= pc && pc < width && board[pr]![pc] !== null && board[pr]![pc]!.value === cell!.value) continue;
      const run: Position[] = []; let rr = r, cc = c;
      while (0 <= rr && rr < height && 0 <= cc && cc < width && board[rr]![cc] !== null && board[rr]![cc]!.value === cell!.value) {
        run.push([rr, cc]); rr += dr!; cc += dc!;
      }
      if (run.length >= minimum) { runs.push(run); for (const point of run) removed.set(point.join(','), point); }
    }
  }
  return { runs, removed: [...removed.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]) };
}

export function queuedColumnCompaction(board: QueuedFieldTypedBoard, removed: readonly (readonly number[])[], gravity: number): { board: (QueuedFieldCell | null)[][]; falls: R[] } {
  if (gravity !== -1 && gravity !== 1) throw new TypeError('Queue compaction requires a vertical gravity sign');
  const height = board.length, width = board[0]!.length, removal = new Set(removed.map(point => point.join(',')));
  const output: (QueuedFieldCell | null)[][] = Array.from({ length: height }, () => Array(width).fill(null)), falls: R[] = [];
  for (let c = 0; c < width; c++) {
    const survivors: [number, QueuedFieldCell][] = [];
    for (let r = 0; r < height; r++) if (board[r]![c] !== null && !removal.has(`${r},${c}`)) survivors.push([r, board[r]![c]!]);
    const start = gravity === 1 ? height - survivors.length : 0;
    for (const [offset, [oldRow, cell]] of survivors.entries()) {
      const newRow = start + offset; output[newRow]![c] = cell;
      falls.push({ occurrence_ref: cell.occurrence_ref, before: [oldRow, c], after: [newRow, c] });
    }
  }
  return { board: output, falls };
}

export function queuedTypedClosure(initial: QueuedFieldTypedBoard, model: R, bound: number): { board: QueuedFieldTypedBoard; trace: R[]; credited: string[]; closed: boolean } {
  if (!Number.isSafeInteger(bound) || bound < 0 || bound > 65536) throw new TypeError('Queue closure requires a finite wave bound');
  let board = initial; const trace: R[] = [], credited: string[] = [];
  for (let wave = 0; wave < bound; wave++) {
    const { runs, removed } = queuedEqualLines(board, model.directions, model.minimum_line);
    if (!removed.length) return { board, trace, credited, closed: true };
    const occurrences = removed.map(([r, c]) => board[r]![c]!.occurrence_ref);
    credited.push(...occurrences);
    const next = queuedColumnCompaction(board, removed, model.gravity); board = next.board;
    trace.push({ phase: 'automatic', wave_index: wave, runs, removed_positions: removed, credited_occurrences: occurrences, falls: next.falls, board });
  }
  const pending = queuedEqualLines(board, model.directions, model.minimum_line).removed;
  return { board, trace, credited, closed: !pending.length };
}

export function queuedTypedPlacement(board: QueuedFieldTypedBoard, bundle: readonly QueuedFieldCell[], column: number, gravity: number): { board: QueuedFieldTypedBoard; positions: Position[] } | null {
  const height = board.length, width = board[0]!.length;
  if (column < 0 || column >= width || !bundle.length || bundle.length > height) return null;
  if (gravity !== -1 && gravity !== 1) throw new TypeError('Queue placement requires a vertical gravity sign');
  let rows = Array.from({ length: bundle.length }, (_, i) => gravity === 1 ? i : height - bundle.length + i);
  if (rows.some(r => board[r]![column] !== null)) return null;
  while (rows.every(r => 0 <= r + gravity && r + gravity < height && board[r + gravity]![column] === null)) rows = rows.map(r => r + gravity);
  const output = board.map(row => [...row]);
  for (const [i, r] of rows.entries()) output[r]![column] = bundle[i]!;
  return { board: checkedBoard(output), positions: rows.map(r => [r, column]) };
}

export function queuedFieldModels(shape: readonly number[], gravity: number): R[] {
  const directions = [[0, 1], [1, 0], [1, 1], [1, -1]], groups: number[][][] = [];
  function combinations(count: number, first = 0, chosen: number[][] = []): void {
    if (!count) { groups.push(chosen); return; }
    for (let i = first; i <= directions.length - count; i++) combinations(count - 1, i + 1, [...chosen, directions[i]!]);
  }
  for (let count = 1; count <= directions.length; count++) combinations(count);
  const out: R[] = [];
  for (const group of groups) for (let n = 2; n <= Math.max(...shape); n++) out.push({ directions: structuredClone(group), minimum_line: n, gravity });
  return out;
}

export function queuedFieldPlacement(grid: QueuedFieldValues, bundle: readonly number[], column: number, gravity: number): (number | null)[][] | null {
  const placed = queuedTypedPlacement(queuedFieldTyped(grid), bundle.map((value, i) => ({ value, occurrence_ref: `incoming:${i}` })), column, gravity);
  return placed === null ? null : queuedFieldValues(placed.board);
}
export function queuedFieldClosure(grid: QueuedFieldValues, model: R): R {
  const result = queuedTypedClosure(queuedFieldTyped(grid), model, grid.length * grid[0]!.length);
  return { board: queuedFieldValues(result.board), removed: result.credited.length, waves: result.trace.length, closed: result.closed };
}

/** Only the source cascade_closure entry is exposed, not the entire V5 queue kernel. */
export function queuedCascadeClosure(input: R): R {
  const request: R = { model_ref: null, state: {}, model: {}, data: {}, observations: [], evidence_refs: [], model_alternatives: [],
    requested_domain_ref: null, schema_version: 'yf_arc3_v5.mechanical_request_b.v1', ...structuredClone(input) };
  if (!request.bounds || !Object.keys(request.bounds).length || Object.keys(request.bounds).length > 16
    || Object.values(request.bounds).some(value => !Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 65536)) throw new TypeError('Queue closure request requires finite bounds');
  const defaults = { request, cause: null, values: {}, examined_count: 0, domain_size: null, domain_exhausted: false,
    frontier: [], missing_refs: [], schema_version: 'yf_arc3_v5.mechanical_result_b.v1' };
  if (['directions', 'minimum_line', 'gravity'].some(key => !Object.hasOwn(request.model, key)) || !Object.hasOwn(request.bounds, 'max_waves')) {
    return { ...defaults, source_status: 'NEEDS_EVIDENCE', cause: 'MISSING_OBSERVATION', missing_refs: ['model.cascade_or_wave_bound'] };
  }
  const out = queuedTypedClosure(checkedBoard(request.state.board), request.model, request.bounds.max_waves);
  return { ...defaults, source_status: out.closed ? 'FOUND' : 'BUDGET_REACHED', cause: out.closed ? null : 'COMPUTATION_BOUND',
    values: { board: out.board, wave_trace: out.trace, credited_occurrences: out.credited, closed: out.closed }, examined_count: out.trace.length,
    frontier: out.closed ? [] : [{ board: out.board, credited_occurrences: out.credited }] };
}

export function queuedFieldReceipt(observation: R, grid: QueuedFieldValues, model: R, evidence: readonly string[]): R {
  const request: R = { request_ref: 'queue:' + identity([observation.observation_ref, grid, model]), caller_ref: 'observed_queue_composition',
    parent_contribution_ref: 'conditional_equal_line_closure', epoch: observation.level_epoch, input_revision_ref: observation.observation_ref,
    event_owner_ref: 'SRC', operation_ref: 'mechanics.queued_alignment_cascade.cascade_closure', mode: 'CONDITIONAL_CLOSURE',
    expected_return_type: 'MechanicalResultB', model_ref: identity(model), state: { board: queuedFieldTyped(grid) }, model,
    evidence_refs: evidence.slice(-256), bounds: { max_waves: grid.length * grid[0]!.length } };
  return queuedCascadeClosure(request);
}
