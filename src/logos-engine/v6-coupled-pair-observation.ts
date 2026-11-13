/**
 * Public pairs and correspondence from coupled_pair_observation.py, source
 * 786dcf51ca57773d8e3a8948ce9ea3655e7baf8e.
 *
 * Only pairs() and match_pair() are transferred here. Joint-route generation,
 * collision hypotheses and control semantics remain outside this module.
 */
import { supportCompare, supportParts } from './v6-support-measurements.ts';
import type { NativeRows } from './v6-native-types.ts';

/** Inclusive V5 row/column bounds, not the neutral observer's XY bounds. */
export type CoupledPairBox = readonly [top: number, left: number, bottom: number, right: number];
export type CoupledPairDelta = readonly [row: number, column: number];
export interface CoupledPair {
  value: number;
  size: number;
  boxes: CoupledPairBox[];
}
export interface CoupledPairMatch {
  boxes: CoupledPairBox[];
  deltas: CoupledPairDelta[];
}

/** Preserve first component/group encounter order; sort only each pair's boxes. */
export function measureCoupledPairs(rows: NativeRows): CoupledPair[] {
  const groups = new Map<string, CoupledPair>();
  for (const component of supportParts(rows)) {
    const box = component.bbox;
    if (box.width !== box.height || !(1 < box.width && box.width <= 16)
      || component.area !== box.width * box.height) continue;
    const key = String(component.value) + ':' + String(box.width);
    let group = groups.get(key);
    if (!group) {
      group = { value: component.value, size: box.width, boxes: [] };
      groups.set(key, group);
    }
    group.boxes.push([box.top, box.left, box.bottom, box.right]);
  }
  return [...groups.values()].filter(group => group.boxes.length === 2)
    .map(group => ({ ...group, boxes: group.boxes.sort(supportCompare) }));
}

/** Source permits a local cardinal displacement of any length up to size. */
export function matchCoupledPair(before: Readonly<CoupledPair>, after: Readonly<CoupledPair>): CoupledPairMatch | null {
  let minimum = Infinity, count = 0, result: CoupledPairMatch | null = null;
  const assigned: CoupledPairBox[] = [], used = new Set<number>();
  const visit = (): void => {
    if (assigned.length !== after.boxes.length) {
      // Enumerate positional permutations, including equal-valued assignments.
      // The production pair measurement supplies exactly two boxes.
      for (let index = 0; index < after.boxes.length; index++) if (!used.has(index)) {
        used.add(index); assigned.push(after.boxes[index]!);
        visit();
        assigned.pop(); used.delete(index);
      }
      return;
    }
    const deltas: CoupledPairDelta[] = [];
    for (let index = 0; index < Math.min(before.boxes.length, assigned.length); index++) {
      const previous = before.boxes[index]!, following = assigned[index]!;
      const row = following[0] - previous[0], column = following[1] - previous[1];
      if ((row !== 0 && column !== 0) || !(Math.abs(row) + Math.abs(column) <= before.size)) return;
      deltas.push([row, column]);
    }
    const cost = deltas.reduce((sum, [row, column]) => sum + Math.abs(row) + Math.abs(column), 0);
    if (cost < minimum) {
      minimum = cost; count = 1;
      result = { boxes: assigned.map(box => [...box] as CoupledPairBox), deltas };
    } else if (cost === minimum) count++;
  };
  visit();
  return count === 1 ? result : null;
}
