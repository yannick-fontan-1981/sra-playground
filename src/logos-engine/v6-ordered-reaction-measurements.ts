/** Pinned V5 ordered_tip_changes and sparse cell_deltas, consumed by V6.
 * Measurements retain public temporal order; they infer no reaction law.
 */
import { supportCompare, supportParts, supportSame } from './v6-support-measurements.ts';
import { symbolicDigest } from './v6-hash.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
type Point = number[];
export interface MarkedSquare { top: number; left: number; size: number; value: number; marker_value: number; offsets: number[][] }
export interface SquareField { squares: MarkedSquare[]; stride: number; size: number; row_phase: number; col_phase: number }
export interface CellFrameDelta { ordinal: number; changes: number[][] }
export interface CellDeltaPacket { positions: number[][]; types: number[][][]; initial_types: number[]; deltas: CellFrameDelta[] }
export interface OrderedSquareChange { square: MarkedSquare; first_marker_loss: number | null; first_marker_preserving_recolor: number | null; final_matches_initial: boolean }
export interface OrderedSquarePacket { action_ref: string; field: SquareField; changes: OrderedSquareChange[]; frame_count: number; distinct_loss_step_count: number; equal_cardinality_external_component_group_count: number; cell_changes: CellDeltaPacket }
export const MAX_SQUARES = 256;
export const MAX_PACKET_FRAMES = 256;
export const digest = symbolicDigest;
const key = (p: readonly number[]): string => p.join(',');
const position = (s: MarkedSquare): Point => [s.top, s.left];
const patch = (rows: NativeRows, top: number, left: number, size: number): number[][] => rows.slice(top, top + size).map(row => [...row.slice(left, left + size)]);
const counts = (values: Iterable<number>): Map<number, number> => { const out = new Map<number, number>(); for (const v of values) out.set(v, (out.get(v) ?? 0) + 1); return out; };
const gcd = (a: number, b: number): number => { while (b) [a, b] = [b, a % b]; return a; };
const sequence = (start: number, end: number, step: number): number[] => { const result = []; for (let n = start; n < end; n += step) result.push(n); return result; };
const offsets = (tile: NativeRows, value: number, invert = false): number[][] => tile.flatMap((row, r) => row.flatMap((v, c) => (invert ? v !== value : v === value) ? [[r, c]] : []));

export function measureSquareField(rows: NativeRows): SquareField | null {
  const groups = new Map<string, { tuple: number[]; items: MarkedSquare[] }>();
  for (const component of supportParts(rows)) {
    const box = component.bbox, size = box.height;
    if (size < 3 || size % 2 === 0 || box.width !== size || component.area !== size * size - 1) continue;
    const tile = patch(rows, box.top, box.left, size), other = offsets(tile, component.value, true), middle = Math.floor(size / 2);
    if (other.length !== 1 || ![[0, middle], [size - 1, middle], [middle, 0], [middle, size - 1]].some(p => supportSame(p, other[0]))) continue;
    const [r, c] = other[0]!, marker = tile[r!]![c!]!, tuple = [size, marker], k = key(tuple);
    const group: { tuple: number[]; items: MarkedSquare[] } = groups.get(k) ?? { tuple, items: [] };
    group.items.push({ top: box.top, left: box.left, size, value: component.value, marker_value: marker, offsets: other }); groups.set(k, group);
  }
  const repeated = [...groups.values()].sort((a, b) => supportCompare(a.tuple, b.tuple)).map(g => g.items).filter(items => items.length >= 2);
  if (repeated.length !== 1) return null;
  const base = repeated[0]!;
  if (base.length > MAX_SQUARES) return null;
  const size = base[0]!.size, marker = base[0]!.marker_value;
  let stride = 0;
  for (const coordinates of [base.map(s => s.top), base.map(s => s.left)]) {
    const sorted = [...new Set(coordinates)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) stride = gcd(stride, sorted[i]! - sorted[i - 1]!);
  }
  if (stride <= size) return null;
  const row_phase = base[0]!.top % stride, col_phase = base[0]!.left % stride;
  const rs = sequence(row_phase, rows.length - size + 1, stride), cs = sequence(col_phase, rows[0]!.length - size + 1, stride);
  if (rs.length * cs.length > MAX_SQUARES) return null;
  const squares: MarkedSquare[] = [], middle = Math.floor(size / 2), edge = [[0, middle], [size - 1, middle], [middle, 0], [middle, size - 1]];
  for (const top of rs) for (const left of cs) {
    const tile = patch(rows, top, left, size), values = counts(tile.flat());
    if (values.size !== 2 || !values.has(marker)) continue;
    const marks = offsets(tile, marker), value = [...values.keys()].find(v => v !== marker)!;
    if (marks.length === 1 && edge.some(p => supportSame(p, marks[0])) || supportSame([...marks].sort(supportCompare), [...edge, [middle, middle]].sort(supportCompare))) {
      squares.push({ top, left, size, value, marker_value: marker, offsets: marks });
    }
  }
  return { squares, stride, size, row_phase, col_phase };
}

/** Source compares changed rows before reclassifying only touched cells. */
export function measureCellDeltas(before: NativeRows, frames: readonly NativeRows[], row_phase: number, col_phase: number, stride: number, size: number, max_cells = 256, max_frames = 256): CellDeltaPacket | null {
  if (!before.length || !before[0]!.length || !(0 < size && size <= stride) || frames.length > max_frames) return null;
  const height = before.length, width = before[0]!.length;
  if (before.some(row => row.length !== width)) return null;
  const positions = sequence(row_phase, height - size + 1, stride).flatMap(r => sequence(col_phase, width - size + 1, stride).map(c => [r, c]));
  if (positions.length > max_cells) return null;
  const indexes = new Map(positions.map((p, i) => [key(p), i])), typeIndexes = new Map<string, number>(), types: number[][][] = [];
  const cellType = (rows: NativeRows, p: number[]): number => {
    const tile = patch(rows, p[0]!, p[1]!, size), k = JSON.stringify(tile);
    if (!typeIndexes.has(k)) { typeIndexes.set(k, types.length); types.push(tile); }
    return typeIndexes.get(k)!;
  };
  const current = positions.map(p => cellType(before, p)), initial_types = [...current], deltas: CellFrameDelta[] = [];
  let previous = before;
  for (const [ordinal, frame] of frames.entries()) {
    if (frame.length !== height || frame.some(row => row.length !== width)) return null;
    const changed = new Set<number>();
    for (let r = 0; r < height; r++) {
      const oldRow = previous[r]!, newRow = frame[r]!;
      if (supportSame(oldRow, newRow)) continue;
      const cellRow = Math.floor((r - row_phase) / stride), insideRow = ((r - row_phase) % stride + stride) % stride;
      if (r < row_phase || insideRow >= size) continue;
      for (let c = 0; c < width; c++) {
        if (oldRow[c] === newRow[c] || c < col_phase) continue;
        const cellCol = Math.floor((c - col_phase) / stride), insideCol = ((c - col_phase) % stride + stride) % stride;
        if (insideCol < size) {
          const index = indexes.get(key([row_phase + cellRow * stride, col_phase + cellCol * stride]));
          if (index !== undefined) changed.add(index);
        }
      }
    }
    const changes: number[][] = [];
    for (const index of [...changed].sort((a, b) => a - b)) {
      const next = cellType(frame, positions[index]!), old = current[index]!;
      if (next !== old) { changes.push([index, old, next]); current[index] = next; }
    }
    deltas.push({ ordinal, changes }); previous = frame;
  }
  return { positions, types, initial_types, deltas };
}

export function observe(before: NativeRows, frames: readonly NativeRows[], action: string): OrderedSquarePacket | null {
  if (!frames.length || frames.length > MAX_PACKET_FRAMES) return null;
  const field = measureSquareField(before);
  if (!field) return null;
  const sparse = measureCellDeltas(before, frames, field.row_phase, field.col_phase, field.stride, field.size);
  if (!sparse) return null;
  const squares = new Map(field.squares.map(s => [key(position(s)), s])), loss = new Map<string, number>(), recolor = new Map<string, number>();
  const current = [...sparse.initial_types];
  for (const delta of sparse.deltas) for (const [index, , next] of delta.changes) {
    current[index!] = next!;
    const k = key(sparse.positions[index!]!), square = squares.get(k);
    if (!square) continue;
    const tile = sparse.types[next!]!, marks = offsets(tile, square.marker_value);
    if (!supportSame(marks, square.offsets) && !loss.has(k)) loss.set(k, delta.ordinal);
    const excluded = new Set(square.offsets.map(key)), values = new Set(tile.flatMap((row, r) => row.filter((_, c) => !excluded.has(key([r, c])))));
    if (supportSame(marks, square.offsets) && values.size === 1 && !values.has(square.value) && !recolor.has(k)) recolor.set(k, delta.ordinal);
  }
  const indexes = new Map(sparse.positions.map((p, i) => [key(p), i]));
  const changes = field.squares.map(square => { const k = key(position(square)), index = indexes.get(k)!; return { square, first_marker_loss: loss.get(k) ?? null, first_marker_preserving_recolor: recolor.get(k) ?? null, final_matches_initial: current[index] === sparse.initial_types[index] }; });
  if (changes.filter(item => item.first_marker_loss !== null).length < 2) return null;
  const stepCount = new Set(changes.filter(c => c.first_marker_loss !== null).map(c => c.first_marker_loss)).size;
  const top = Math.min(...field.squares.map(s => s.top)), bottom = Math.max(...field.squares.map(s => s.top + s.size)), groups = new Map<string, number>();
  for (const component of supportParts(before)) if (component.area > 1 && !component.touches_frame_boundary && (component.bbox.bottom < top || component.bbox.top >= bottom)) {
    const k = JSON.stringify([component.value, component.relative_pixels]); groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  return { action_ref: action, field, changes, frame_count: frames.length, distinct_loss_step_count: stepCount,
    equal_cardinality_external_component_group_count: [...groups.values()].filter(n => n === stepCount).length, cell_changes: sparse };
}

/** Exact native JSON domain of the source nominal dataclass restoration. */
export function packetRestore(value: unknown): OrderedSquarePacket {
  const object = (v: any): R => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Ordered packet requires a mapping'); return v; };
  const array = (v: any): any[] => { if (!Array.isArray(v)) throw new TypeError('Ordered packet requires a sequence'); return v; };
  const integer = (v: any): number => { if (!Number.isSafeInteger(v)) throw new TypeError('Ordered packet requires an exact integer'); return v; };
  const nullable = (v: any): number | null => v === null ? null : integer(v);
  const point = (v: any): number[] => { const p = array(v); if (p.length !== 2) throw new TypeError('Ordered position requires two coordinates'); return p.map(integer); };
  const square = (v: any): MarkedSquare => { const s = object(v); return { top: integer(s.top), left: integer(s.left), size: integer(s.size), value: integer(s.value), marker_value: integer(s.marker_value), offsets: array(s.offsets).map(point) }; };
  const p = object(value), f = object(p.field), cells = object(p.cell_changes);
  if (typeof p.action_ref !== 'string') throw new TypeError('Ordered packet requires an action reference');
  return { action_ref: p.action_ref,
    field: { squares: array(f.squares).map(square), stride: integer(f.stride), size: integer(f.size), row_phase: integer(f.row_phase), col_phase: integer(f.col_phase) },
    changes: array(p.changes).map(v => { const c = object(v); if (typeof c.final_matches_initial !== 'boolean') throw new TypeError('Ordered packet requires exact restoration evidence'); return { square: square(c.square), first_marker_loss: nullable(c.first_marker_loss), first_marker_preserving_recolor: nullable(c.first_marker_preserving_recolor), final_matches_initial: c.final_matches_initial }; }),
    frame_count: integer(p.frame_count), distinct_loss_step_count: integer(p.distinct_loss_step_count), equal_cardinality_external_component_group_count: integer(p.equal_cardinality_external_component_group_count),
    cell_changes: { positions: array(cells.positions).map(point), types: array(cells.types).map(tile => array(tile).map(row => array(row).map(integer))), initial_types: array(cells.initial_types).map(integer),
      deltas: array(cells.deltas).map(v => { const d = object(v); return { ordinal: integer(d.ordinal), changes: array(d.changes).map(v => { const c = array(v); if (c.length !== 3) throw new TypeError('Cell delta requires index, old type and new type'); return c.map(integer); }) }; }) } };
}

const tipVector = (square: MarkedSquare): number[] | null => square.offsets.length === 1 ? square.offsets[0]!.map(v => Math.sign(v - Math.floor(square.size / 2))) : null;
export function measure(rows: NativeRows, retained: readonly R[], directions: R): [R, Record<string, R>] {
  const packets = retained.map(p => packetRestore(p.packet)), field = measureSquareField(rows);
  const facts: R = { ordered_tip_square_count: 0, ordered_tip_temporal_incidence_count: 0, ordered_tip_unique_ring_present: false,
    ordered_tip_ring_on_earlier_chain: false, ordered_tip_route_present: false, ordered_tip_same_initial_value_count: 0 }, per: Record<string, R> = {};
  if (!field) return [facts, per];
  facts.ordered_tip_square_count = field.squares.length;
  const { size, stride } = field, patches = new Map<string, number[][]>(), uniform = new Map<number, number>(); let rings: number[][] = [];
  for (const top of sequence(field.row_phase, rows.length - size + 1, stride)) for (const left of sequence(field.col_phase, rows[0]!.length - size + 1, stride)) {
    const tile = patch(rows, top, left, size), border = new Set<number>(), inner = new Set<number>(); patches.set(key([top, left]), tile);
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) (r === 0 || r === size - 1 || c === 0 || c === size - 1 ? border : inner).add(tile[r]![c]!);
    if (border.size === 1 && inner.size === 1 && [...border][0] !== [...inner][0]) rings.push([top, left]);
    if (new Set([...border, ...inner]).size === 1) { const value = [...border][0]!; uniform.set(value, (uniform.get(value) ?? 0) + 1); }
  }
  const scope = [...field.squares, ...packets.filter(p => p.field.stride === stride && p.field.size === size && p.field.row_phase === field.row_phase && p.field.col_phase === field.col_phase).flatMap(p => p.field.squares)];
  const top = Math.min(...scope.map(s => s.top)) - stride, bottom = Math.max(...scope.map(s => s.top)) + stride, left = Math.min(...scope.map(s => s.left)) - stride, right = Math.max(...scope.map(s => s.left)) + stride;
  rings = rings.filter(p => top <= p[0]! && p[0]! <= bottom && left <= p[1]! && p[1]! <= right);
  if (rings.length !== 1 || !uniform.size) return [facts, per];
  const ring = rings[0]!; facts.ordered_tip_unique_ring_present = true; facts.ordered_tip_ring_position = ring;
  const maximum = Math.max(...uniform.values()), modes = [...uniform].sort((a, b) => a[0] - b[0]).filter(([, n]) => n === maximum).map(([v]) => v);
  if (modes.length !== 1) return [facts, per];
  const mode = modes[0]!, positions = new Set(field.squares.map(s => key(position(s))));
  for (const [action, [dr, dc]] of Object.entries(directions) as [string, number[]][]) {
    const neighbour = key([ring[0]! + dr! * stride, ring[1]! + dc! * stride]);
    if (patches.has(neighbour)) per[action] = { ordered_tip_next_cell_measured: true, ordered_tip_next_cell_has_mark: positions.has(neighbour) };
  }
  const allowed = new Set([...patches].filter(([, tile]) => tile.every(row => row.every(v => v === mode))).map(([k]) => k));
  for (const p of positions) allowed.add(p); allowed.add(key(ring));
  for (const packet of packets) {
    const changes = new Map(packet.changes.map(c => [key(position(c.square)), c])), earlier = new Set<string>(), incidences: number[][][] = [];
    for (const cross of packet.changes) {
      if (cross.square.offsets.length <= 1 || cross.first_marker_preserving_recolor === null) continue;
      const incoming: [OrderedSquareChange, number[]][] = [];
      for (const item of packet.changes) {
        const vector = tipVector(item.square);
        if (!vector || item.first_marker_loss === null) continue;
        if (item.square.top + vector[0]! * stride === cross.square.top && item.square.left + vector[1]! * stride === cross.square.left) incoming.push([item, vector]);
      }
      for (const [early, ev] of incoming) for (const [late, lv] of incoming) {
        if (ev[0]! * lv[0]! + ev[1]! * lv[1]! !== 0 || !(early.first_marker_loss! < cross.first_marker_preserving_recolor && cross.first_marker_preserving_recolor < late.first_marker_loss!)) continue;
        let p = [cross.square.top + lv[0]! * stride, cross.square.left + lv[1]! * stride]; const suffix: string[] = [];
        while (changes.has(key(p)) && suffix.length < MAX_SQUARES) {
          const item = changes.get(key(p))!, vector = tipVector(item.square);
          if (!vector || suffix.includes(key(p))) break;
          suffix.push(key(p)); p = [p[0]! + vector[0]! * stride, p[1]! + vector[1]! * stride];
        }
        if (!suffix.length || suffix.length === MAX_SQUARES) continue;
        const terminal = changes.get(suffix.at(-1)!)!;
        if (terminal.first_marker_loss !== null || terminal.square.value === late.square.value) continue;
        incidences.push([position(cross.square), position(early.square), position(late.square), position(terminal.square)]);
        p = position(early.square);
        for (let i = 0; i < MAX_SQUARES; i++) {
          if (!changes.has(key(p)) || earlier.has(key(p))) break;
          earlier.add(key(p));
          const predecessors = packet.changes.filter(c => { const v = tipVector(c.square); return v && c.square.top + v[0]! * stride === p[0] && c.square.left + v[1]! * stride === p[1]; }).map(c => position(c.square));
          if (predecessors.length !== 1) break; p = predecessors[0]!;
        }
      }
    }
    if (!incidences.length) continue;
    Object.assign(facts, { ordered_tip_temporal_incidence_count: incidences.length, ordered_tip_temporal_incidences: incidences,
      ordered_tip_packet_action_ref: packet.action_ref, ordered_tip_packet_frame_count: packet.frame_count,
      ordered_tip_cell_type_count: packet.cell_changes.types.length, ordered_tip_cell_delta_count: packet.cell_changes.deltas.reduce((n, d) => n + d.changes.length, 0),
      ordered_tip_distinct_loss_step_count: packet.distinct_loss_step_count, ordered_tip_equal_cardinality_external_group_count: packet.equal_cardinality_external_component_group_count,
      ordered_tip_changed_then_returned_count: packet.changes.filter(c => c.first_marker_loss !== null && c.final_matches_initial).length, ordered_tip_ring_on_earlier_chain: earlier.has(key(ring)) });
    const earliest = Math.min(...packet.changes.filter(c => c.first_marker_loss !== null).map(c => c.first_marker_loss!));
    const values = new Set(packet.changes.filter(c => c.first_marker_loss === earliest).map(c => c.square.value));
    facts.ordered_tip_same_initial_value_count = field.squares.filter(s => values.has(s.value)).length;
    if (earlier.has(key(ring))) break;
    const queue: number[][] = [ring], previous = new Map<string, string | null>([[key(ring), null]]), edge = new Map<string, string>(); let endpoint: string | null = null, cursor = 0;
    while (cursor < queue.length && previous.size <= MAX_SQUARES) {
      const p = queue[cursor++]!;
      if (earlier.has(key(p))) { endpoint = key(p); break; }
      for (const [action, [dr, dc]] of Object.entries(directions) as [string, number[]][]) {
        const next = [p[0]! + dr! * stride, p[1]! + dc! * stride], k = key(next);
        if (allowed.has(k) && !previous.has(k)) { previous.set(k, key(p)); edge.set(k, action); queue.push(next); }
      }
    }
    if (endpoint !== null && previous.size <= MAX_SQUARES) {
      const actions: string[] = [];
      while (previous.get(endpoint) !== null) { actions.push(edge.get(endpoint)!); endpoint = previous.get(endpoint)!; }
      actions.reverse();
      if (actions.length) { facts.ordered_tip_route_present = true; facts.ordered_tip_route_length = actions.length; (per[actions[0]!] ??= {}).ordered_tip_first_shortest_route_edge = true; }
    }
    break;
  }
  return [facts, per];
}

export function retainDistinctOrderedSquarePacket(packets: readonly OrderedSquarePacket[], packet: OrderedSquarePacket, limit = 4): readonly OrderedSquarePacket[] {
  if (limit < 1) throw new RangeError('ordered observation retention requires a positive bound');
  return packets.some(p => supportSame(p, packet)) ? packets : [...packets, packet].slice(-limit);
}
