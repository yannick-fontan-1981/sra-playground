import { geometricComponents } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRecord, NativeRows } from '../logos-engine/v6-native-types.ts';
import { RecolorWorkBudget } from '../logos-engine/v6-topological-recolor-geometry.ts';
import { processOneBeat, type WindowBeatStateD, type WindowReceiverD } from '../logos-engine/v5-window-processing.ts';
import type { WindowSettings } from '../logos-engine/v6-window-question-geometry.ts';

export type RailWindow = { bbox: NativeBox; base: number; unit: number; slots: { box: NativeBox }[];
  signal_marker?: { point: NativePoint; ink: number } };
type Link = { from: number; to: number; box: NativeBox };
export type LinkedWindows = { path: NativePoint[]; positions: number[]; links: Link[]; order: number[] };
const key = ([x, y]: NativePoint) => `${x},${y}`;
const centerX = ([l, , r]: NativeBox) => (l + r) / 2;
const cell = (rows: NativeRows, [x, y]: NativePoint) => rows[y]?.[x];
const near = (a: number, b: number, pitch: number) => 0 < a - b && a - b <= pitch + 1;

function measureLinks(rows: NativeRows, boxes: RailWindow[], pitch: number): Link[] | null {
  const parts = geometricComponents(rows), links: Link[] = [];
  for (const [to, box] of boxes.entries()) {
    const marker = box.signal_marker;
    if (!marker) continue;
    const [x, bottom] = marker.point;
    const matches = boxes.flatMap(({ bbox }, from) => {
      if (from === to) return [];
      const sourceX = centerX(bbox);
      return parts.filter(({ color, bbox: [l, t, r, b] }) => color === marker.ink && l === Math.min(sourceX, x)
        && r === Math.max(sourceX, x) && near(t, Math.min(bottom, bbox[3]), pitch) && b > Math.max(bottom, bbox[3]))
        .map(part => ({ from, to, box: part.bbox }));
    });
    if (matches.length !== 1) return null;
    links.push(matches[0]!);
  }
  return links.length ? links : null;
}

function measurePath(rows: NativeRows, boxes: RailWindow[], pitch: number): NativePoint[] | null {
  const seed = boxes[0]!, [left, , , bottom] = seed.bbox, { base, unit } = seed;
  const points = new Map<string, NativePoint>(), width = rows[0]!.length, height = rows.length;
  const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
  for (let y = bottom + unit + 1; y < height - 1; y += pitch) {
    for (let x = (left + unit) % pitch || pitch; x < width - 1; x += pitch) {
      if (cell(rows, [x, y]) === base || !corners.every(([dx, dy]) => cell(rows, [x + dx, y + dy]) === base)) continue;
      if (boxes.some(({ bbox: [l, t, r, b] }) => l <= x && x <= r && t <= y && y <= b)) continue;
      const point: NativePoint = [x, y];
      points.set(key(point), point);
    }
  }
  const neighbours = ([x, y]: NativePoint) => ([[x - pitch, y], [x + pitch, y], [x, y - pitch], [x, y + pitch]] as const)
    .filter(point => points.has(key(point)));
  const endpoints = [...points.values()].filter(point => neighbours(point).length === 1);
  if (endpoints.length !== 2 || [...points.values()].some(point => neighbours(point).length > 2)) return null;
  const endcaps = endpoints.filter(([x, y]) => {
    const neighbour = neighbours([x, y])[0]!;
    if (neighbour[1] !== y) return false;
    const direction = Math.sign(x - neighbour[0]), end = x + direction * seed.unit;
    const ink = cell(rows, [end, y]);
    return ink !== undefined && ink !== rows[0]![0] && ink !== base &&
      [-2, -1, 0, 1, 2].every(offset => cell(rows, [end, y + offset]) === ink);
  });
  if (endcaps.length !== 1) return null;
  const path = [endpoints.find(point => point !== endcaps[0])!];
  while (path.length < points.size) {
    const next = neighbours(path.at(-1)!).find(point => key(point) !== (path.length < 2 ? '' : key(path.at(-2)!)));
    if (!next) return null;
    path.push(next);
  }
  return key(path.at(-1)!) === key(endcaps[0]!) ? path : null;
}

export function measureLinkedWindows(rows: NativeRows, boxes: RailWindow[]): LinkedWindows | null {
  const pitches = new Set(boxes.flatMap(({ slots }) => slots.slice(1).map((slot, i) => slot.box[0] - slots[i]!.box[0])));
  const pitch = [...pitches][0];
  if (pitches.size !== 1 || !pitch || pitch < 2) return null;
  const links = measureLinks(rows, boxes, pitch);
  if (!links) return null;
  const path = measurePath(rows, boxes, pitch);
  if (!path) return null;
  const positions = boxes.map(({ bbox: [l, , r, b], unit }) => {
    const candidates = path.flatMap(([x, y], i) => {
      if (!near(y, b, pitch) || ![l + unit, r - unit].includes(x)) return [];
      const otherX = x === l + unit ? r - unit : l + unit, span = Math.abs(otherX - x) / pitch;
      return Number.isInteger(span) && span > 0 && key(path[i + span] ?? [-1, -1]) === key([otherX, y]) ? [i] : [];
    });
    return candidates.length === 1 ? candidates[0]! : -1;
  });
  if (positions.some(index => index < 0)) return null;
  const order: number[] = [];
  while (order.length < boxes.length) {
    const next = boxes.findIndex((_, i) => !order.includes(i) && links.every(link => link.to !== i || order.includes(link.from)));
    if (next < 0) return null;
    order.push(next);
  }
  return { path, positions, links, order };
}

export function linkedWindowCoverage(rail: LinkedWindows, colors: readonly number[], paint: readonly boolean[],
  settings: WindowSettings): [boolean, NativeRecord[]] {
  const ref = (index: number) => `receiver:${index}`, event = 'visible_receiver_signal';
  const receivers: WindowReceiverD[] = settings.map(([size, filter, output], i) => ({
    receiver_ref: ref(i), first_rank_at_beat_zero: 1 - rail.positions[i]! - size, window_size: size,
    admitted_color_refs: filter === null ? null : [String(filter)], maximal_group_required: false,
    required_parent_events: rail.links.filter(link => link.to === i).map(link => [ref(link.from), event]),
    action: paint[i] ? 'PAINT' : 'CAPTURE', paint_color_ref: paint[i] ? String(output) : null,
    event_ref: event, one_use_for_run: true,
  }));
  let state: WindowBeatStateD = {
    train: colors.map((color, rank) => ({ rank, unit_ref: `rank:${rank}`, current_color_ref: String(color), captured: false })),
    receivers, receiver_order: rail.order.map(ref), spent_for_run_refs: [], current_pulses: [],
    beat: 0, rank_shift_per_beat: 1, visitation_policy: 'single_ordered_pass',
    revisit_receiver_refs: [], firing_bounds: [], revisit_termination_evidence_ref: null,
  };
  const receipts: NativeRecord[] = [];
  const budget = new RecolorWorkBudget({ node_bound: 4096, time_bound_ms: 1000, domain_bound: 4096 });
  for (let beat = 0; beat < rail.path.length + colors.length - 1; beat++) {
    const [next, result] = processOneBeat({ ...state, beat, current_pulses: [] }, budget, 1);
    state = next;
    receipts.push(...result.ordered_events);
    if (state.train.every(unit => unit.captured)) return [true, receipts];
    if (state.spent_for_run_refs.length === receivers.length) break;
  }
  return [false, []];
}
