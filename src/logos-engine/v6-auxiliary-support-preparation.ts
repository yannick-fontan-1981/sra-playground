/** Public counterfactual support questions from coupled_support_preparation.py.
 * Erasure prepares a question only. Every physical effect is separately guarded.
 */
import { symbolicDigest as identity } from './v6-hash.ts';
import { pythonEqual as equal } from './v6-operations.ts';
import { supportParts, supportCompare } from './v6-support-measurements.ts';
import { measureCoupledPairs } from './v6-coupled-pair-observation.ts';
import type { CoupledPair, CoupledPairBox, CoupledPairDelta } from './v6-coupled-pair-observation.ts';
import { jointCoupledPairRoute } from './v6-coupled-pair-route.ts';
import type { NativeRows } from './v6-native-types.ts';

type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
const boxKey = (box: readonly number[]): string => JSON.stringify(box);

export function auxiliarySupportPatch(rows: NativeRows, box: readonly number[]): number[][] {
  return rows.slice(box[0], box[2]! + 1).map(row => row.slice(box[1], box[3]! + 1));
}
export function auxiliarySupportPut(rows: number[][], box: readonly number[], content: NativeRows): void {
  for (let y = 0; y < content.length; y++) for (let x = 0; x < content[y]!.length; x++) {
    let row = box[0]! + y, column = box[1]! + x;
    if (row < 0) row += rows.length;
    if (row < 0 || row >= rows.length) throw new RangeError('Support patch row is outside the public frame');
    if (column < 0) column += rows[row]!.length;
    if (column < 0 || column >= rows[row]!.length) throw new RangeError('Support patch column is outside the public frame');
    rows[row]![column] = content[y]![x]!;
  }
}
export function auxiliarySupportTranslate(box: readonly number[], delta: readonly number[]): CoupledPairBox {
  return [box[0]! + delta[0]!, box[1]! + delta[1]!, box[2]! + delta[0]!, box[3]! + delta[1]!];
}
export function auxiliarySupportInside(rows: NativeRows, box: readonly number[]): boolean {
  return box[0]! >= 0 && box[1]! >= 0 && box[2]! < rows.length && box[3]! < rows[0]!.length;
}

export function auxiliarySupportControls(state: R, available: readonly string[]): [Record<string, CoupledPairDelta> | null, number[] | null] {
  const moves: Record<string, CoupledPairDelta> = {}, signs = [new Set<number>(), new Set<number>()];
  for (const [action, samples] of Object.entries(state.samples) as [string, R[]][]) {
    const deltas = new Map<string, CoupledPairDelta>();
    for (const sample of samples) if (sample.deltas[0].some((value: number) => value !== 0)) {
      const delta = sample.deltas[0] as CoupledPairDelta; deltas.set(JSON.stringify(delta), delta);
    }
    if (deltas.size === 1 && available.includes(action)) moves[action] = clone([...deltas.values()][0]!);
    for (const sample of samples) for (const axis of [0, 1]) {
      const first = sample.deltas[0][axis], second = sample.deltas[1][axis];
      if (first && second && Math.abs(first) === Math.abs(second)) signs[axis]!.add(first * second > 0 ? 1 : -1);
    }
  }
  return signs.every(values => values.size === 1) ? [moves, signs.map(values => [...values][0]!)] : [null, null];
}

/** A selection can recolor the group. Its measured loci and order remain bound. */
export function auxiliarySupportCurrentPair(rows: NativeRows, known: CoupledPair): CoupledPair | null {
  const boxes = [...known.boxes].sort(supportCompare);
  const matches = measureCoupledPairs(rows).filter(pair => pair.size === known.size && equal([...pair.boxes].sort(supportCompare), boxes));
  if (matches.length !== 1) return null;
  return { ...matches[0]!, boxes: clone(known.boxes) };
}

export function auxiliarySupportOccurrences(rows: NativeRows, pair: CoupledPair, floor: number): R[] {
  const q = pair.size, oy = pair.boxes[0]![0] % q, ox = pair.boxes[0]![1] % q, result: R[] = [];
  for (const component of supportParts(rows)) {
    const box = component.bbox;
    if (!(0 < component.area && component.area < q * q && box.width < q && box.height < q && component.value !== floor)) continue;
    const y = oy + Math.floor((box.top - oy) / q) * q, x = ox + Math.floor((box.left - ox) / q) * q;
    const cell: CoupledPairBox = [y, x, y + q - 1, x + q - 1];
    if (!auxiliarySupportInside(rows, cell) || box.bottom > cell[2] || box.right > cell[3]) continue;
    const content = auxiliarySupportPatch(rows, cell), values = new Set(content.flat());
    if (values.size !== 2 || !values.has(floor) || !values.has(component.value)) continue;
    if (content.flat().filter(value => value !== floor).length !== component.area) continue;
    result.push({ box: cell, point: { x: Math.floor((box.left + box.right) / 2), y: Math.floor((box.top + box.bottom) / 2) },
      patch: content, occurrence_ref: 'support:' + identity([cell, content]).slice(0, 20) });
  }
  return result.length <= 6 ? result : [];
}

export function auxiliarySupportErased(rows: NativeRows, items: readonly R[], floor: number): number[][] {
  const result = rows.map(row => [...row]);
  for (const item of items) {
    const box = item.box as CoupledPairBox;
    auxiliarySupportPut(result, box, Array.from({ length: box[2] - box[0] + 1 }, () => Array(box[3] - box[1] + 1).fill(floor)));
  }
  return result;
}
export function auxiliarySupportGroupRoute(rows: NativeRows, pair: CoupledPair, moves: Record<string, CoupledPairDelta>,
  signs: readonly number[], floor: number, remaining: number, evidence: readonly string[]): R | null {
  return jointCoupledPairRoute(rows, pair, moves, [floor], signs, remaining, evidence, true);
}

export function auxiliarySupportSelectQuestion(rows: NativeRows, state: R, available: readonly string[], remaining: number, parked: readonly CoupledPairBox[]): R | null {
  if (!available.includes('ACTION6') || state.floors.length !== 1) return null;
  const pair = auxiliarySupportCurrentPair(rows, state.pair), [moves, signs] = auxiliarySupportControls(state, available);
  if (!pair || !moves || !Object.keys(moves).length) return null;
  const floor = state.floors[0], items = auxiliarySupportOccurrences(rows, pair, floor).filter(item => !parked.some(box => equal(box, item.box)));
  if (!items.length) return null;
  const route = auxiliarySupportGroupRoute(auxiliarySupportErased(rows, items, floor), pair, moves, signs!, floor, remaining, state.evidence);
  if (!route) return null;
  const ranked: { visit: number; item: R }[] = [];
  for (const item of items) {
    const first = (route.expected as CoupledPairBox[][]).findIndex(boxes => boxes.some(box => equal(box, item.box)));
    if (first >= 0) ranked.push({ visit: first, item });
  }
  if (!ranked.length) return null;
  ranked.sort((a, b) => supportCompare([a.visit, a.item.occurrence_ref], [b.visit, b.item.occurrence_ref]));
  return { item: ranked[0]!.item, pair, moves, signs, floor, virtual_route: route,
    virtual_removed: items.map(item => item.occurrence_ref),
    question: 'Test whether this currently visible support occurrence can be selected for preparing the conditional joint path; point meaning and control mode are unknown.' };
}

export function auxiliarySupportParkingRoute(rows: NativeRows, state: R, aux: R, available: readonly string[], remaining: number): R | null {
  const pair = auxiliarySupportCurrentPair(rows, state.pair), [moves, signs] = auxiliarySupportControls(state, available);
  if (!pair || !moves || !Object.keys(moves).length) return null;
  const floor = aux.floor, q = pair.size, start = aux.box as CoupledPairBox, body = aux.selected_patch as NativeRows;
  const others = auxiliarySupportOccurrences(rows, pair, floor).filter(item => !equal(item.box, start) && !aux.parked.some((box: CoupledPairBox) => equal(box, item.box)));
  const virtual = auxiliarySupportErased(rows, others, floor), actual = rows.map(row => [...row]);
  const empty = Array.from({ length: q }, () => Array<number>(q).fill(floor));
  auxiliarySupportPut(virtual, start, empty); auxiliarySupportPut(actual, start, empty);
  const helperMoves: Record<string, readonly number[]> = { ...moves };
  for (const [action, value] of Object.entries(aux.recalled_moves ?? {}) as [string, R][]) if (available.includes(action)) helperMoves[action] = value.delta;
  for (const [action, delta] of Object.entries(aux.measured_moves ?? {}) as [string, readonly number[]][]) if (available.includes(action)) helperMoves[action] = delta;
  const parent = new Map<string, { prior: CoupledPairBox; action: string } | null>([[boxKey(start), null]]);
  const depth = new Map<string, number>([[boxKey(start), 0]]), queue: CoupledPairBox[] = [start], maxDepth = Math.min(16, remaining);
  let cursor = 0;
  while (cursor < queue.length && parent.size <= 256) {
    const box = queue[cursor++]!, currentKey = boxKey(box), trial = virtual.map(row => [...row]);
    auxiliarySupportPut(trial, box, body);
    const route = auxiliarySupportGroupRoute(trial, pair, moves, signs!, floor, remaining, state.evidence);
    if (route) {
      const path: R[] = []; let node = box, link = parent.get(boxKey(node))!;
      while (link !== null) {
        path.push({ action_ref: link.action, from: [...link.prior], to: [...node], mapping_observed: Object.hasOwn(aux.measured_moves ?? {}, link.action) });
        node = link.prior; link = parent.get(boxKey(node))!;
      }
      return { path: path.reverse(), joint_length: route.actions.length, states: parent.size,
        scope: 'Conditional parking pose preserves an available joint route after unresolved supports are virtually prepared. Not evidence that erasure or selection is physical.' };
    }
    if (depth.get(currentKey)! >= maxDepth) continue;
    for (const [action, delta] of Object.entries(helperMoves)) {
      const destination = auxiliarySupportTranslate(box, delta), key = boxKey(destination);
      if (parent.has(key) || !auxiliarySupportInside(rows, destination) || auxiliarySupportPatch(actual, destination).some(row => row.some(value => value !== floor))) continue;
      parent.set(key, { prior: box, action }); depth.set(key, depth.get(currentKey)! + 1); queue.push(destination);
    }
  }
  return null;
}

export function auxiliarySupportGroupControlQuestion(rows: NativeRows, state: R, aux: R, available: readonly string[]): R | null {
  const pair = auxiliarySupportCurrentPair(rows, state.pair), [moves, signs] = auxiliarySupportControls(state, available);
  if (!pair || !moves || !Object.keys(moves).length) return null;
  for (const [action, delta] of Object.entries(moves)) {
    const expected = [auxiliarySupportTranslate(pair.boxes[0]!, delta), auxiliarySupportTranslate(pair.boxes[1]!, [delta[0] * signs![0]!, delta[1] * signs![1]!])];
    if (expected.every(box => auxiliarySupportInside(rows, box) && auxiliarySupportPatch(rows, box).every(row => row.every(value => value === aux.floor)))) {
      return { action_ref: action, pair_before: pair, expected, helper_box: aux.box, helper_patch_before: auxiliarySupportPatch(rows, aux.box),
        question: 'Discriminate actual paired control from auxiliary control with a previously measured paired displacement toward two visibly free supports. Appearance alone is not evidence of control. Preserve the parked auxiliary and stop if the physical response is ambiguous.' };
    }
  }
  return null;
}

export function auxiliarySupportGroupControlResponse(rows: NativeRows, later: NativeRows, detail: R): R {
  const expected = detail.expected as CoupledPairBox[], known = detail.pair_before as CoupledPair;
  const found = measureCoupledPairs(later).filter(pair => pair.size === known.size && equal([...pair.boxes].sort(supportCompare), [...expected].sort(supportCompare)));
  const allowed = new Set<string>();
  for (const box of [...known.boxes, ...expected]) for (let y = box[0]; y <= box[2]; y++) for (let x = box[1]; x <= box[3]; x++) allowed.add(`${y},${x}`);
  let extra = 0;
  for (let y = 1; y < rows.length - 1; y++) for (let x = 1; x < rows[0]!.length - 1; x++) if (!allowed.has(`${y},${x}`) && rows[y]![x] !== later[y]![x]) extra++;
  const preserved = equal(auxiliarySupportPatch(later, detail.helper_box), detail.helper_patch_before), matched = found.length === 1 && extra === 0 && preserved;
  const pair = matched ? { ...found[0]!, boxes: clone(expected) } : null;
  return { matched, pair_after: pair, extra_effect_count: extra, helper_preserved: preserved,
    scope: 'Actual pair displacement after return attempts; no marginal causal attribution to a particular return input.' };
}
