import { changedReturnRegions, cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';
import { readStckStack, STCK_BOARD_LEFT, STCK_PLAY_HEIGHT, type StckCard } from './stck-stack.ts';
import { trackStckSprites, type SpriteChange } from './stck-sprites.ts';

interface FrameFocus {
  readonly card: StckCard;
  readonly rank: number;
  readonly rows: NativeRows;
}

export interface SpaceReturn {
  readonly sessionId: string;
  readonly sequence: number;
  readonly fromLevel: number;
  readonly toLevel: number;
  readonly frameCount: number;
  readonly before: NativeRows;
  readonly frames: readonly {
    readonly index: number;
    readonly rows: NativeRows;
    readonly changedFromBefore: number;
    readonly changedFromPrevious: number;
    readonly focus: readonly FrameFocus[];
    readonly sprites: readonly SpriteChange[];
    readonly regions: ReturnType<typeof changedReturnRegions> | null;
    readonly boundary: boolean;
    readonly obscured: boolean;
  }[];
  readonly peakChange: number;
  readonly finalChange: number;
}

export function observeSpace(
  scope: Pick<SpaceReturn, 'sessionId' | 'sequence' | 'fromLevel' | 'toLevel'>,
  before: NativeRows,
  frames: readonly NativeRows[],
): SpaceReturn {
  const box: NativeBox = [0, 0, before[0]!.length - 1, before.length - 1];
  const changes: SpaceReturn['frames'][number][] = [];
  let previous = before;
  let peakChange = 0, finalChange = 0;
  const track = trackStckSprites();
  track(before);
  const field: NativeBox = [STCK_BOARD_LEFT, 4, 63, STCK_PLAY_HEIGHT - 1];
  const flashed = (frame: NativeRows) => frame.length === 64 && frame[0]?.length === 64
    && frame.slice(0, STCK_PLAY_HEIGHT).every(row => row.every(pixel => pixel === 5 || pixel === 8));
  const hasResetFlash = frames.some(flashed);
  for (const [index, frame] of frames.entries()) {
    let changedFromBefore = 0, changedFromPrevious = 0;
    frame.forEach((row, y) => row.forEach((value, x) => {
      if (value !== before[y]![x]) changedFromBefore++;
      if (value !== previous[y]![x]) changedFromPrevious++;
    }));
    const boundary = (scope.fromLevel !== scope.toLevel || hasResetFlash) && index === frames.length - 1;
    const obscured = flashed(frame);
    const focus = boundary || obscured ? [] : readStckStack(frame).flatMap((card, rank) => card.highlighted
      ? [{ card, rank: rank + 1, rows: cropReturn(frame, card.box, 1) }] : []);
    const rows = cropReturn(frame, box, 1);
    const regions = boundary || frame.length !== 64 || frame[0]?.length !== 64 || !changedFromPrevious
      ? null : changedReturnRegions(previous, frame, [59, 1, 62, 3], field);
    changes.push({ index: index + 1, rows, changedFromBefore, changedFromPrevious, focus,
      sprites: track(frame, boundary, obscured), regions, boundary, obscured });
    peakChange = Math.max(peakChange, changedFromBefore);
    finalChange = changedFromBefore;
    previous = frame;
  }
  return { ...scope, frameCount: frames.length, before: cropReturn(before, box, 1), frames: changes, peakChange, finalChange };
}
