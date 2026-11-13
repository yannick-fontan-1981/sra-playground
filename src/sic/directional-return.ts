import { changedReturnRegions } from '../logos-engine/v6-public-return-visuals.ts';
import type { NativeRows } from '../logos-engine/v6-native-types.ts';

export interface DirectionalReturn {
  readonly sessionId: string;
  readonly sequence: number;
  readonly command: number;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly changes: ReturnType<typeof changedReturnRegions> | null;
}

/** Raw public pixel differences; no object role or control effect is inferred here. */
export function observeDirectionalReturn(
  scope: Omit<DirectionalReturn, 'changes'>,
  before: NativeRows,
  after: NativeRows,
  boundary: boolean,
): DirectionalReturn {
  const width = before[0]?.length;
  const comparable = width && before.length === after.length
    && before.every(row => row.length === width) && after.every(row => row.length === width);
  return { ...scope, changes: !boundary && comparable
    ? changedReturnRegions(before, after, [-1, -1, -1, -1]) : null };
}
