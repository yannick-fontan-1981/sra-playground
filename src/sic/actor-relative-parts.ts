import { add, diff, same, type XY } from './access-terrain.ts';
import type { PartMotion } from './controlled-parts.ts';
import type { VisualLayout } from './witnessed-preview-transfer.ts';

export type RelativePart = { offset: XY; from: XY; first: string; confirmed?: string };
type Body = VisualLayout[string][number];
type Motion = { from: Body; to: Body };
const inside = (p: XY, b: Body) =>
  p[0] >= 2 * b.box[0]! && p[0] <= 2 * b.box[2]! &&
  p[1] >= 2 * b.box[1]! && p[1] <= 2 * b.box[3]!;

export function observeRelativeParts(stats: PartMotion, actor: string, motion: Motion, changes: ReadonlyMap<string, Motion>,
  before: VisualLayout, after: VisualLayout, ref: string) {
  for (const [role, relation] of Object.entries(stats.followers ?? {})) {
    const expected = add(motion.to.at, relation.offset);
    if (!after[role]?.some(p => same(p.at, expected))) delete stats.followers![role];
  }
  for (const [role, part] of changes) {
    if (role === actor || before[role]!.length < 2 || before[role]!.length > 12) continue;
    if (!inside(part.from.at, motion.from) && !inside(motion.from.at, part.from)) continue;
    const offset = diff(part.from.at, motion.from.at);
    if (!same(part.to.at, add(motion.to.at, offset))) continue;
    const memory = (stats.followers ??= {});
    const previous = memory[role];
    if (!previous || !same(previous.offset, offset))
      memory[role] = { offset, from: motion.from.at, first: ref };
    else if (!same(previous.from, motion.from.at) && !same(previous.from, motion.to.at))
      previous.confirmed ??= ref;
  }
}

export function followingPart(stats: PartMotion | undefined, role: string, actor: XY, fixed: XY[]) {
  const relation = stats?.followers?.[role];
  return relation?.confirmed && fixed.some(p => same(p, add(actor, relation.offset)))
    ? { offset: relation.offset, witnesses: [relation.first, relation.confirmed] } : undefined;
}

export function placePeers(fixed: XY[], origin: XY, actor: XY, offset?: XY) {
  if (!offset) return fixed;
  const carried = add(origin, offset);
  return fixed.map(p => same(p, carried) ? add(actor, offset) : p);
}
