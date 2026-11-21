import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';
import { hash } from './sic-study-source-replay.mjs';

export function overlay(before, a, b) {
  let onlyA = 0,
    onlyB = 0,
    conflicts = 0;
  const independent = [];
  const frame = before.map((row, y) =>
    row.map((v, x) => {
      const u = a[y]?.[x],
        w = b[y]?.[x];
      if (u === undefined || w === undefined || (u !== v && w !== v && u !== w)) conflicts++;
      if (u !== v && w === v) {
        onlyA++;
        independent.push([x, y, u]);
      }
      if (w !== v && u === v) {
        onlyB++;
        independent.push([x, y, w]);
      }
      return u !== v ? u : w;
    }),
  );
  return {
    onlyA,
    onlyB,
    conflicts,
    anticipated: !conflicts && onlyA > 0 && onlyB > 0 ? hash({ frame }).slice(0, 16) : null,
    retained(rows) {
      return onlyA > 0 && onlyB > 0 && independent.every(([x, y, ink]) => rows[y]?.[x] === ink);
    },
  };
}
function subjects(rows) {
  const groups = new Map();
  for (const part of geometricComponents(rows)) {
    const key = JSON.stringify([part.color, part.mask]);
    groups.set(key, groups.has(key) ? null : part.bbox.slice(0, 2));
  }
  return groups;
}
export function combinedPositions(before, a, b) {
  const origins = subjects(before),
    first = subjects(a),
    second = subjects(b);
  const additions = [],
    onlyA = [],
    onlyB = [];
  for (const [role, p] of origins) {
    const q = first.get(role),
      r = second.get(role);
    if (!p || !q || !r) continue;
    const movesA = p[0] !== q[0] || p[1] !== q[1],
      movesB = p[0] !== r[0] || p[1] !== r[1];
    if (movesA && movesB) {
      const dest = [q[0] + r[0] - p[0], q[1] + r[1] - p[1]];
      if (dest[0] !== p[0] || dest[1] !== p[1]) additions.push([role, dest]);
    } else if (movesA) onlyA.push([role, q]);
    else if (movesB) onlyB.push([role, r]);
  }
  const joint = onlyA.length && onlyB.length ? [...onlyA, ...onlyB] : [];
  function confirm(r, predicates) {
    return predicates.length > 0 && predicates.every(([key, p]) => r.get(key)?.join() === p.join());
  }
  return {
    added: additions.length,
    separate: joint.length,
    check(rows) {
      const detected = subjects(rows);
      return { added: confirm(detected, additions), separate: confirm(detected, joint) };
    },
  };
}
