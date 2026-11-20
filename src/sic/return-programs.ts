import type { NativeObservation, NativeRows } from '../logos-engine/v6-native-types.ts';
import type { Edge } from './preparation-experiments.ts';
import { groupsOf, observedRoleMoves, type Role } from './exchange-roles.ts';
import { observedEdit, type Edit } from './relative-edits.ts';
import { siteShape } from './site-operations.ts';
import type { XY } from './access-terrain.ts';

export type RoleMove = { role: Role; from: XY; to: XY };
export type Patient = { role: Role; at: XY; box: readonly number[]; form: string; gap: number };
export type Manipulation = { edit: Edit; moves: RoleMove[]; patients: Patient[]; changedClasses: string[] };
export function witnessManipulation(
  b: NativeObservation,
  a: NativeObservation,
  rows: NativeRows,
  next: NativeRows
): Manipulation | undefined {
  if (b.level_epoch !== a.level_epoch || b.state !== a.state) return;
  const edit = observedEdit(rows, next, 128);
  if (!edit) return;
  if (!edit.count) return { edit, moves: [], patients: [], changedClasses: [] };
  const before = groupsOf(b),
    after = groupsOf(a),
    changedClasses = [];
  for (const [signature, old] of before) {
    const fresh = after.get(signature);
    if (!fresh || fresh.size !== old.size || [...old.keys()].some((p) => !fresh.has(p)))
      changedClasses.push(signature);
  }
  const moves = observedRoleMoves(before, after).slice(0, 16);
  const patients: Patient[] = [];
  for (const e of b.entities) {
    const classAt = before.get(e.signature)!;
    if (e.area > (edit.width * edit.height) / 12 || classAt.size > 12) continue;
    const gap = editGap(e.bbox, edit);
    if (gap > 4) continue;
    patients.push({
      role: {
        signature: e.signature,
        fixed: [...classAt.keys()].filter((p) => p !== e.position.join()).sort(),
      },
      at: [...e.position],
      box: [...e.bbox],
      form: siteShape(e),
      gap,
    });
  }
  patients.sort((p, q) => p.gap - q.gap || p.role.fixed.length - q.role.fixed.length);
  return { edit, moves, patients: patients.slice(0, 20), changedClasses };
}
export function editGap(box: readonly number[], edit: Edit) {
  let nearest = Infinity;
  for (const [i, n] of edit.runs) {
    const x = i % edit.width,
      y = Math.floor(i / edit.width);
    nearest = Math.min(
      nearest,
      Math.max(0, box[0]! - x - n + 1, x - box[2]!) + Math.max(0, box[1]! - y, y - box[3]!)
    );
    if (!nearest) break;
  }
  return nearest;
}
export function returnPrograms(edges: Edge[], origin: number) {
  const incoming = new Map<number, Edge[]>();
  for (const e of edges)
    if (e.stable && e.t !== e.s) {
      const list = incoming.get(e.t) ?? [];
      list.push(e);
      incoming.set(e.t, list);
    }
  const paths = new Map<number, Edge[]>([[origin, []]]),
    queue = [origin];
  for (const s of queue) {
    const rest = paths.get(s)!;
    if (rest.length >= 8) continue;
    for (const e of incoming.get(s) ?? []) {
      if (paths.has(e.s)) continue;
      paths.set(e.s, [e, ...rest]);
      queue.push(e.s);
    }
  }
  return paths;
}
