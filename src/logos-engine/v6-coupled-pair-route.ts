/**
 * Exact joint_route projection consumed by V6 coupled_pair_observation.py.
 * Reference 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * The supplied V6 request fixes one measured lattice, canonical control order,
 * one route variant, no temporal-tracker inference or typed footprints, and
 * a 4096-expanded-state bound. This is that closure of V5's
 * _bounded_joint_peer_collision_route_candidates, not its other request types.
 */
import { symbolicDigest } from './v6-hash.ts';
import { validateRows } from './v6-native-observer.ts';
import type { NativeRows } from './v6-native-types.ts';
import type { CoupledPair, CoupledPairBox } from './v6-coupled-pair-observation.ts';

export interface CoupledPairRoute {
  actions: string[];
  expected: CoupledPairBox[][];
  states: number;
  expanded: number;
  one_sided_steps: number;
  grid_ref: string;
}
type Position = readonly [row: number, column: number];
type JointState = readonly [firstRow: number, firstColumn: number, secondRow: number, secondColumn: number];
interface Cell {
  row: number;
  column: number;
  box: CoupledPairBox;
  pattern: string;
  palette: readonly number[];
}
interface SearchNode {
  state: JointState;
  depth: number;
  parent: number | null;
  action: string | null;
}
const modulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor;
const boxKey = (box: readonly number[]): string => box.join(',');
const stateKey = (state: JointState): string => state.join(',');
const sameState = (a: JointState, b: JointState): boolean => a.every((value, index) => value === b[index]);
const pythonStringOrder = (a: string, b: string): number => {
  const first = Array.from(a), second = Array.from(b);
  for (let index = 0; index < Math.min(first.length, second.length); index++) {
    const difference = first[index]!.codePointAt(0)! - second[index]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return first.length - second.length;
};

export function jointCoupledPairRoute(
  rows: NativeRows,
  pair: Readonly<CoupledPair>,
  controls: Readonly<Record<string, readonly number[]>>,
  floorValues: readonly number[],
  signs: readonly number[],
  limit: number,
  _evidence: readonly string[] = [],
  excludeMixtures = false,
): CoupledPairRoute | null {
  const size = pair.size, entries = Object.entries(controls);
  if (!entries.length || entries.some(([, delta]) => Math.abs(delta[0]!) + Math.abs(delta[1]!) !== size)) return null;
  if (!Number.isSafeInteger(size) || size < 1) throw new TypeError('Known grid cell extent must be a positive integer');
  const rowOffset = modulo(pair.boxes[0]![0], size), columnOffset = modulo(pair.boxes[0]![1], size);
  if (pair.boxes.some(box => modulo(box[0], size) !== rowOffset || modulo(box[1], size) !== columnOffset)) return null;
  validateRows(rows);
  const rowCount = Math.floor((rows.length - rowOffset) / size);
  const columnCount = Math.floor((rows[0]!.length - columnOffset) / size);
  if (rowCount < 1 || columnCount < 1) throw new TypeError('Known grid logical dimensions must be positive');
  if (rowCount * columnCount > 4096) throw new RangeError('known grid cell count exceeds hard bound');
  const gridRef = 'measured_motion_lattice:' + symbolicDigest([rowOffset, columnOffset, size, rowCount, columnCount]).slice(0, 16);

  // This is the consumed type_patterns/cell_type_ids projection of
  // recount_known_grid_cells. No separator or history datum is consulted.
  const cells: Cell[] = [], patterns = new Map<string, { ref: string; palette: number[] }>();
  for (let row = 0; row < rowCount; row++) for (let column = 0; column < columnCount; column++) {
    const top = rowOffset + row * size, left = columnOffset + column * size;
    const pixels = rows.slice(top, top + size).map(line => line.slice(left, left + size));
    const key = JSON.stringify(pixels);
    let pattern = patterns.get(key);
    if (!pattern) {
      pattern = { ref: 'pattern:' + symbolicDigest(pixels), palette: [...new Set(pixels.flat())].sort((a, b) => a - b) };
      patterns.set(key, pattern);
    }
    cells.push({ row, column, box: [top, left, top + size - 1, left + size - 1], pattern: pattern.ref, palette: pattern.palette });
  }
  const suppliedBoxes = new Set(pair.boxes.map(boxKey));
  const suppliedMovers = cells.filter(cell => suppliedBoxes.has(boxKey(cell.box)));
  if (suppliedMovers.length !== 2 || new Set(suppliedMovers.map(cell => cell.pattern)).size !== 1) return null;
  const knownFloor = new Set(floorValues), floorPatterns = new Set(cells
    .filter(cell => cell.palette.length === 1 && knownFloor.has(cell.palette[0]!)).map(cell => cell.pattern));
  if (!floorPatterns.size) return null;

  // The V6 SimpleNamespace carries no tracking object or InteractionProbeInput
  // fallback. Its declared residual signs are the only coupling witness here.
  const couplingRow = Math.trunc(signs[0]!), couplingColumn = Math.trunc(signs[1]!);
  if (couplingRow !== 1 || couplingColumn !== -1) return null;
  const deltas: [string, Position][] = entries
    .map(([action, delta]): [string, Position] => [action, [Math.floor(delta[0]! / size), Math.floor(delta[1]! / size)]])
    .filter(([, [row, column]]) => row !== 0 || column !== 0)
    .sort(([first], [second]) => pythonStringOrder(first, second));
  // V6 declares one observed execution for every supplied control.
  if (new Set(deltas.filter(([, [, column]]) => column !== 0).map(([action]) => action)).size < 2) return null;

  const moverPattern = suppliedMovers[0]!.pattern;
  const movers = cells.filter(cell => cell.pattern === moverPattern);
  if (movers.length !== 2) return null;
  // order_peers_by_measured_interface_alignment binds the first tracked box,
  // even when it is no longer the first cell in row/column ordering.
  const aligned = movers.filter(cell => boxKey(cell.box) === boxKey(pair.boxes[0]!));
  if (aligned.length !== 1) return null;
  const first = aligned[0]!, second = movers.find(cell => cell !== first)!;
  const passablePatterns = new Set([...floorPatterns, moverPattern]);
  const excluded = excludeMixtures ? new Set(cells
    .filter(cell => cell.palette.length > 1 && cell.palette.some(value => knownFloor.has(value)))
    .map(cell => cell.pattern)) : new Set<string>();
  const at = (row: number, column: number): Cell | undefined =>
    row >= 0 && row < rowCount && column >= 0 && column < columnCount ? cells[row * columnCount + column] : undefined;
  const transition = (state: JointState, delta: Position): JointState | null => {
    const firstDestination: Position = [state[0] + delta[0], state[1] + delta[1]];
    const secondDestination: Position = [state[2] + delta[0] * couplingRow, state[3] + delta[1] * couplingColumn];
    const firstCell = at(...firstDestination), secondCell = at(...secondDestination);
    // The source excludes contact with these patterns even if the member
    // would independently stop there under the conditional collision model.
    if (firstCell && excluded.has(firstCell.pattern) || secondCell && excluded.has(secondCell.pattern)) return null;
    const firstAfter = firstCell && passablePatterns.has(firstCell.pattern) ? firstDestination : [state[0], state[1]];
    const secondAfter = secondCell && passablePatterns.has(secondCell.pattern) ? secondDestination : [state[2], state[3]];
    return [firstAfter[0]!, firstAfter[1]!, secondAfter[0]!, secondAfter[1]!];
  };
  const initial: JointState = [first.row, first.column, second.row, second.column];
  const maxDepth = Math.min(40, Math.max(1, Math.trunc(Math.min(40, limit))));
  const queue: SearchNode[] = [{ state: initial, depth: 0, parent: null, action: null }];
  const visited = new Set([stateKey(initial)]);
  let expanded = 0, endpoint = -1;
  for (let cursor = 0; cursor < queue.length && expanded < 4096; cursor++) {
    const node = queue[cursor]!;
    expanded++;
    if (node.state[0] === node.state[2] && node.state[1] === node.state[3]) { endpoint = cursor; break; }
    if (node.depth >= maxDepth) continue;
    for (const [action, delta] of deltas) {
      const next = transition(node.state, delta);
      if (!next || sameState(next, node.state)) continue;
      const key = stateKey(next);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ state: next, depth: node.depth + 1, parent: cursor, action });
    }
  }
  if (endpoint < 0) return null;
  const actions: string[] = [];
  for (let cursor = endpoint; queue[cursor]!.parent !== null; cursor = queue[cursor]!.parent!) actions.push(queue[cursor]!.action!);
  actions.reverse();
  if (!actions.length) return null;
  const deltaByAction = new Map(deltas), expected: CoupledPairBox[][] = [];
  let replay = initial, oneSided = 0;
  const pixelBox = (row: number, column: number): CoupledPairBox => {
    const top = rowOffset + row * size, left = columnOffset + column * size;
    return [top, left, top + size - 1, left + size - 1];
  };
  for (const action of actions) {
    const next = transition(replay, deltaByAction.get(action)!)!;
    const firstMoved = next[0] !== replay[0] || next[1] !== replay[1];
    const secondMoved = next[2] !== replay[2] || next[3] !== replay[3];
    if (firstMoved !== secondMoved) oneSided++;
    replay = next;
    expected.push([pixelBox(next[0], next[1]), pixelBox(next[2], next[3])]);
  }
  return { actions, expected, states: visited.size, expanded, one_sided_steps: oneSided, grid_ref: gridRef };
}
