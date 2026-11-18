import { measureReceptionLayout, receptionServiceCarriers } from '../logos-engine/v6-reception-service-observation.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { receptionRequestTiles, type ReceptionMemory } from './reception-activation.ts';

type Support = { anchor: NativePoint; color: number };
type Layout = { box: NativeBox; pitch: number; cells: NativePoint[]; background: number; support_candidates: Support[]; requests: NativeBox[] };
type Badge = { box: NativeBox; initial: number[] };
type Receipt = { badge: number; support: NativePoint; pixels: number[]; confirmed: boolean };
export type ReceptionSequence = {
  epoch: number; layout: Layout; initialHash: string; start: NativePoint; carrierInk: number; at: NativePoint; visible: boolean;
  inactiveEntry?: { hash: string; at: NativePoint };
  badges: Badge[]; supports: NativePoint[]; walls: string[]; blocked: string[]; failures: string[]; exhausted: string[];
  receipts: Receipt[]; tick: number; waits: number; target: NativePoint | null; evidence: string[];
};
export type ReceptionSequenceStep = { input: string; to: NativePoint; support: NativePoint; hold: boolean };

const key = (point: NativePoint) => point.join(',');
const equal = (a: NativePoint, b: NativePoint) => a[0] === b[0] && a[1] === b[1];
const offset = ([x, y]: NativePoint, [dx, dy]: NativePoint): NativePoint => [x + dx, y + dy];
const box = ([x, y]: NativePoint, size: number): NativeBox => [x, y, x + size - 1, y + size - 1];
const pixels = (rows: NativeRows, [l, t, r, b]: NativeBox) => rows.slice(t, b + 1).flatMap(row => row.slice(l, r + 1));
const samePixels = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((value, index) => value === b[index]);

export function startReceptionSequence(rows: NativeRows, epoch: number, frameHash: string, memory: ReceptionMemory): ReceptionSequence | null {
  const layout = measureReceptionLayout(rows) as Layout | null;
  if (!layout || layout.pitch !== memory.pitch || layout.cells.length > 196) return null;
  const { pitch } = layout;
  const badges = receptionRequestTiles(layout).map(badge => ({ box: badge, initial: pixels(rows, badge) }));
  const supports = layout.support_candidates.filter(support => support.color === memory.supportInk).map(support => support.anchor);
  const actors = receptionServiceCarriers(rows, layout);
  if (badges.length < 2 || badges.length !== supports.length || actors.length !== 1
    || badges.some(badge => new Set(badge.initial).size !== 2)) return null;
  const [x, y] = layout.box, wall = pixels(rows, box([x - 1, y - 1], pitch));
  const walls = layout.cells.filter(site => samePixels(pixels(rows, box(site, pitch)), wall)).map(key);
  const actor = actors[0]!;
  return { epoch, layout, initialHash: frameHash, start: actor.anchor, at: actor.anchor, carrierInk: actor.color, visible: true,
    badges, supports, walls, blocked: [], failures: [], exhausted: [], receipts: [], tick: 0, waits: 0, target: null, evidence: memory.evidence };
}

export function chooseReceptionSequence(state: ReceptionSequence, memory: ReceptionMemory, available: readonly string[],
  remaining: number): ReceptionSequenceStep | null {
  const { layout } = state;
  if (remaining < 1 || state.tick >= layout.cells.length) return null;
  const cells = new Set(layout.cells.map(key)), walls = new Set(state.walls);
  const unavailable = new Set(layout.support_candidates.filter(support => !state.supports.some(p => equal(p, support.anchor))).map(support => key(support.anchor)));
  const settled = new Set([...state.receipts.map(receipt => key(receipt.support)), ...state.exhausted]);
  const targets = new Set(state.supports.map(key).filter(site => !settled.has(site)));
  if (!targets.size) return null;
  const blocked = new Set(state.blocked), failures = new Set(state.failures);
  const moves = [...available].sort().flatMap(input => {
    const delta = memory.controls[input];
    return delta && (delta[0] === 0 || delta[1] === 0) && Math.abs(delta[0]) + Math.abs(delta[1]) === layout.pitch
      ? [{ input, delta }] : [];
  });
  const stays = (from: NativePoint, to: NativePoint, input: string) =>
    !cells.has(key(to)) || walls.has(key(to)) || blocked.has(key(from) + '/' + input);
  const at = key(state.at);
  if (targets.has(at) && (!state.target || equal(state.target, state.at))) {
    const wait = moves.find(({ input, delta }) => stays(state.at, offset(state.at, delta), input));
    if (wait && !failures.has(`${state.tick + 1}/${at}`)) return { input: wait.input, to: state.at, support: state.at, hold: true };
  }
  type Node = { site: NativePoint; depth: number; first?: { input: string; to: NativePoint } };
  const queue: Node[] = [{ site: state.at, depth: 0 }], seen = new Set([at + '/0']);
  const depthLimit = Math.min(remaining, layout.cells.length - state.tick);
  for (const node of queue) {
    if (node.first && targets.has(key(node.site))) return { ...node.first, support: node.site, hold: false };
    if (node.depth >= depthLimit) continue;
    const depth = node.depth + 1;
    for (const { input, delta } of moves) {
      const landing = offset(node.site, delta);
      if (unavailable.has(key(landing))) continue;
      const to = stays(node.site, landing, input) ? node.site : landing, id = key(to);
      const visit = `${id}/${failures.size ? depth : 0}`;
      if (seen.has(visit) || failures.has(`${state.tick + depth}/${id}`)) continue;
      seen.add(visit);
      queue.push({ site: to, depth, first: node.first ?? { input, to } });
    }
  }
  return null;
}

function preservesBadge(initial: readonly number[], current: readonly number[]) {
  if (initial.length !== current.length || samePixels(initial, current)) return false;
  const mapping = new Map(initial.map((value, index) => [value, current[index]!]));
  return new Set(mapping.values()).size === mapping.size && initial.every((value, index) => mapping.get(value) === current[index]);
}

export function receptionSequenceReturn(state: ReceptionSequence, step: ReceptionSequenceStep, rows: NativeRows, frameHash: string) {
  const reset = frameHash === state.inactiveEntry?.hash || frameHash === state.initialHash && (state.receipts.length > 0
    || !equal(state.at, state.start) && !equal(step.to, state.start));
  const candidates = receptionServiceCarriers(rows, state.layout);
  const actor = candidates.find(candidate => equal(candidate.anchor, step.to))
    ?? candidates.find(candidate => candidate.color === state.carrierInk);
  const position = actor?.anchor as NativePoint | undefined;
  return { reset, position };
}

export function recordReceptionSequence(state: ReceptionSequence, step: ReceptionSequenceStep, rows: NativeRows,
  frameHash: string, ref: string): { next: ReceptionSequence; evidence?: string } {
  const { reset, position } = receptionSequenceReturn(state, step, rows, frameHash);
  const tick = state.tick + 1, evidence = [...state.evidence.slice(-5), ref];
  const restart = state.inactiveEntry?.hash === frameHash ? state.inactiveEntry.at : state.start;
  if (reset) return { next: { ...state, tick: 0, at: restart, visible: true, receipts: [], exhausted: [], waits: 0, target: null,
    failures: [...state.failures, `${tick}/${key(step.to)}`], evidence },
    evidence: 'The crossing returned the carrier to the starting scene. Try a different position at that time.' };

  const readings = state.badges.map(badge => pixels(rows, badge.box));
  const receipts = state.receipts.filter(receipt => samePixels(receipt.pixels, readings[receipt.badge]!))
    .map(receipt => receipt.confirmed ? receipt : { ...receipt, confirmed: true });
  const newBadges = state.badges.flatMap((badge, index) => !receipts.some(receipt => receipt.badge === index)
    && preservesBadge(badge.initial, readings[index]!) ? [index] : []);
  const acquired = !!position && equal(position, step.support) && newBadges.length === 1
    && !receipts.some(receipt => equal(receipt.support, step.support));
  if (acquired) {
    const badge = newBadges[0]!;
    receipts.push({ badge, support: step.support, pixels: readings[badge]!, confirmed: false });
  }
  const waits = step.hold ? (state.target && equal(state.target, step.support) ? state.waits : 0) + 1 : 0;
  const blocked = position && equal(position, state.at) && !equal(position, step.to)
    ? [...state.blocked, key(state.at) + '/' + step.input] : state.blocked;
  const exhausted = waits >= 32 && !acquired ? [...state.exhausted, key(step.support)] : state.exhausted;
  const confirmed = receipts.some(receipt => receipt.confirmed && state.receipts.some(old => old.badge === receipt.badge && !old.confirmed));
  return { next: { ...state, tick, at: position ?? step.to, visible: !!position, target: step.support, waits, receipts, blocked, exhausted, evidence },
    ...(acquired ? { evidence: 'One request badge changed while the carrier occupied the support.' }
      : confirmed ? { evidence: 'The changed request badge persisted after the next command.' } : {}) };
}
