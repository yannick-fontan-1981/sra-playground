import type { NativeEntity, NativeObservation } from '../logos-engine/v6-native-types.ts';
import { same, type XY } from './access-terrain.ts';
import type { Layout } from './projected-motion.ts';

// An occurrence is identified by the other members of its visual class that stayed in place.
export type Role = { signature: string; fixed: string[] };
export type RolePair = [Role, Role];
export type Groups = Map<string, Map<string, NativeEntity>>;
export function groupsOf(o: NativeObservation): Groups {
  const groups: Groups = new Map();
  for (const e of o.entities) {
    const positions = groups.get(e.signature) ?? new Map<string, NativeEntity>();
    positions.set(e.position.join(), e);
    groups.set(e.signature, positions);
  }
  return groups;
}
export function resolveRole(g: Groups, r: Role) {
  const positions = g.get(r.signature);
  if (!positions || positions.size !== r.fixed.length + 1 || !r.fixed.every((p) => positions.has(p)))
    return null;
  for (const [p, e] of positions) if (!r.fixed.includes(p)) return e;
  return null;
}
export function poseOf(g: Groups, roles: RolePair): Layout | null {
  const a = resolveRole(g, roles[0]),
    b = resolveRole(g, roles[1]);
  return a && b ? [[...a.position], [...b.position]] : null;
}
export function observedRoleMoves(before: Groups, after: Groups) {
  const moves: { role: Role; from: XY; to: XY }[] = [];
  for (const [signature, old] of before) {
    const next = after.get(signature);
    if (!next || old.size !== next.size || old.size > 12) continue;
    const removed = [...old].filter(([p]) => !next.has(p));
    if (removed.length !== 1) continue;
    const added = [...next].find(([p]) => !old.has(p))!;
    moves.push({
      role: { signature, fixed: [...old.keys()].filter((p) => p !== removed[0]![0]).sort() },
      from: [...removed[0]![1].position],
      to: [...added[1].position],
    });
  }
  moves.sort((a, b) => a.role.signature.localeCompare(b.role.signature));
  return moves;
}
export function observedExchanges(before: Groups, after: Groups) {
  const moves = observedRoleMoves(before,after);
  const pairs: RolePair[] = [];
  for (const [i, a] of moves.entries())
    for (const b of moves.slice(i + 1))
      if (same(a.from, b.to) && same(a.to, b.from)) pairs.push([a.role, b.role]);
  return pairs;
}
