import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export const STCK_PROGRAM_COLORS = [10, 9, 14, 11, 8, 7] as const;
export const STCK_PLAY_HEIGHT = 54;
export const STCK_BOARD_LEFT = 11;

export interface StckCard {
  readonly box: NativeBox;
  readonly color: number;
  readonly highlighted: boolean;
}

/** Read the wide, solid stripes in the public STCK program panel, bottom first. */
export function readStckStack(rows: NativeRows): readonly StckCard[] {
  if (rows.length !== 64 || rows[0]?.length !== 64) return [];
  const rowColor = (y: number): number | null => {
    const color = rows[y]?.[4];
    return color !== undefined && STCK_PROGRAM_COLORS.some(value => value === color)
      && [2, 3, 5, 6, 7].every(x => rows[y]?.[x] === color) ? color : null;
  };
  const cards: StckCard[] = [];
  let bottom = STCK_PLAY_HEIGHT - 2;
  while (bottom >= 0) {
    const color = rowColor(bottom);
    if (color === null) break;
    let top = bottom;
    while (top > 0 && rowColor(top - 1) === color) top--;
    if (bottom - top < 1) return [];
    const highlighted = Array.from({ length: bottom - top + 1 }, (_, index) => rows[top + index]!)
      .every(row => row[1] === 0 && row[8] === 0);
    cards.push({ box: [1, top, 8, bottom], color, highlighted });
    if (rowColor(top - 1) !== null) return [];
    bottom = top - 2;
  }
  return cards;
}

export type StckRankEffect = 'emptied' | 'recolored' | 'same-color';

export interface StckRankTrial {
  readonly level: number;
  readonly rank: number;
  readonly depth: number;
  readonly color: number;
  readonly expectedColor: number | null;
  readonly actualColor: number | null;
  readonly expected: StckRankEffect;
  readonly actual: StckRankEffect;
  readonly stackShiftMatched: boolean;
}

export function compareStckRank(before: NativeRows, after: NativeRows, [x, y]: NativePoint, level: number): StckRankTrial | null {
  const cards = readStckStack(before);
  const index = cards.findIndex(({ box: [left, top, right, bottom] }) => x >= left && x <= right && y >= top && y <= bottom);
  if (index < 0) return null;
  const returned = readStckStack(after);
  const color = cards[index]!.color;
  const expectedColor = cards[index + 1]?.color ?? null;
  const actualColor = returned[index]?.color ?? null;
  const effect = (value: number | null): StckRankEffect => value === null ? 'emptied' : value === color ? 'same-color' : 'recolored';
  const shifted = cards.filter((_, at) => at !== index);
  return { level, rank: index + 1, depth: cards.length, color, expectedColor, actualColor,
    expected: effect(expectedColor), actual: effect(actualColor),
    stackShiftMatched: returned.length === shifted.length && returned.every((card, i) => card.color === shifted[i]!.color) };
}
