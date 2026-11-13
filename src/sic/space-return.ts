import { cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

export interface SpaceReturn {
  readonly sessionId: string;
  readonly sequence: number;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly frameCount: number;
  readonly before: NativeRows;
  readonly frames: readonly {
    readonly index: number;
    readonly changedFromBefore: number;
    readonly changedFromPrevious: number;
  }[];
  readonly previews: readonly { readonly index: number; readonly rows: NativeRows }[];
  readonly peakChange: number;
  readonly finalChange: number;
}

export function observeSpace(
  scope: Pick<SpaceReturn, 'sessionId' | 'sequence' | 'fromLevel' | 'toLevel'>,
  before: NativeRows,
  frames: readonly NativeRows[],
): SpaceReturn {
  const box: NativeBox = [0, 0, before[0]!.length - 1, before.length - 1];
  const limit = Math.min(12, frames.length);
  const selected = new Set(Array.from({ length: limit }, (_, index) =>
    limit === 1 ? 0 : Math.round(index * (frames.length - 1) / (limit - 1))));
  const changes: SpaceReturn['frames'][number][] = [];
  const previews: SpaceReturn['previews'][number][] = [];
  let previous = before;
  let peakChange = 0, finalChange = 0;
  for (const [index, frame] of frames.entries()) {
    let changedFromBefore = 0, changedFromPrevious = 0;
    frame.forEach((row, y) => row.forEach((value, x) => {
      if (value !== before[y]![x]) changedFromBefore++;
      if (value !== previous[y]![x]) changedFromPrevious++;
    }));
    changes.push({ index: index + 1, changedFromBefore, changedFromPrevious });
    if (selected.has(index)) previews.push({ index: index + 1, rows: cropReturn(frame, box, 1) });
    peakChange = Math.max(peakChange, changedFromBefore);
    finalChange = changedFromBefore;
    previous = frame;
  }
  return { ...scope, frameCount: frames.length, before: cropReturn(before, box, 1), frames: changes, previews, peakChange, finalChange };
}
