import { cropReturn, measureChangedRegions } from '../logos-engine/v6-public-return-visuals.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { observeDirectionalReturn, type DirectionalReturn } from './directional-return.ts';

export interface PublicRoleFrame {
  readonly rows: NativeRows;
  readonly level: number;
}

export interface PublicRoleCandidate {
  readonly kind: 'appearance changer' | 'exit';
  readonly action: number;
  readonly level: number;
  readonly box: NativeBox;
  readonly sprite: NativeRows;
  readonly change?: NativeBox;
}

/** Return proposals from settled pixels, command direction and public level changes only. */
export function proposePublicRoles(boards: readonly PublicRoleFrame[], commands: readonly number[]): readonly PublicRoleCandidate[] {
  const proposals: PublicRoleCandidate[] = [];
  let previous: DirectionalReturn | undefined;
  const steps = new Map<number, Set<number>>();
  for (const [index, command] of commands.entries()) {
    const a = boards[index], b = boards[index + 1];
    if (!a || !b || command < 1 || command > 4) { previous = undefined; continue; }
    const action = index + 1;
    const receipt = observeDirectionalReturn({ sessionId: 'public-role-review', sequence: action, command,
      fromLevel: a.level, toLevel: b.level }, a.rows, b.rows, a.level !== b.level, previous);
    if (b.level > a.level && previous?.translation) {
      const distances = steps.get(a.level);
      if (distances?.size === 1) {
        const distance = [...distances][0]!;
        const dx = command === 3 ? -distance : command === 4 ? distance : 0;
        const dy = command === 1 ? -distance : command === 2 ? distance : 0;
        const [x, y, r, bottom] = previous.translation.to;
        const box: NativeBox = [x + dx, y + dy, r + dx, bottom + dy];
        if (box[0] >= 0 && box[1] >= 0 && box[2] < (a.rows[0]?.length ?? 0) && box[3] < a.rows.length) {
          proposals.push({ kind: 'exit', action, level: a.level, box, sprite: cropReturn(a.rows, box, 1) });
        }
      }
    }
    if (receipt.translation) {
      const { from, to, targetBefore } = receipt.translation;
      const distances = steps.get(a.level) ?? new Set<number>();
      distances.add(Math.abs(to[0] - from[0]) + Math.abs(to[1] - from[1]));
      steps.set(a.level, distances);
      const colors = new Set(targetBefore.flat());
      if (colors.size >= 2) {
        const changes = measureChangedRegions(a.rows, b.rows, [from, to]);
        const shape = changes.regions.find(({ box: [x, y, r, bottom], pixels }) =>
          pixels >= 4 && r > x && bottom > y && r - x < 12 && bottom - y < 12
          && new Set(cropReturn(a.rows, [x, y, r, bottom], 1).flat()).size > 1);
        if (shape) proposals.push({ kind: 'appearance changer', action, level: a.level, box: to,
          sprite: targetBefore, change: shape.box });
      }
    }
    previous = receipt;
  }
  return proposals;
}
