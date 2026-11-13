import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';
import { cropReturn } from '../logos-engine/v6-public-return-visuals.ts';
import { STCK_BOARD_LEFT, STCK_PLAY_HEIGHT, STCK_PROGRAM_COLORS } from './stck-stack.ts';

type SpriteKind = 'player' | 'opponent';
interface Sprite {
  readonly kind: SpriteKind;
  readonly anchor: NativePoint;
  readonly box: NativeBox;
  readonly rows: NativeRows;
  readonly signature: string;
}
export interface SpriteChange {
  readonly track: number;
  readonly kind: SpriteKind;
  readonly effect: 'moved' | 'changed' | 'moved and changed' | 'appeared' | 'no longer detected';
  readonly before: Sprite | null;
  readonly after: Sprite | null;
}
interface TrackedSprite { readonly track: number; readonly sprite: Sprite }

/** Tower base: a white or violet bottom tip with matching flanks one row above. */
export function readStckSprites(rows: NativeRows): readonly Sprite[] {
  if (rows.length !== 64 || rows[0]?.length !== 64) return [];
  const result: Sprite[] = [];
  const at = (x: number, y: number) => rows[y]?.[x];
  const isProgram = (value: number | undefined) => STCK_PROGRAM_COLORS.some(color => color === value);
  for (let y = 2; y < STCK_PLAY_HEIGHT; y++) for (let x = STCK_BOARD_LEFT + 1; x < 63; x++) {
    const rim = at(x, y);
    if ((rim !== 0 && rim !== 15) || at(x - 1, y) === rim || at(x + 1, y) === rim
        || at(x - 1, y - 1) !== rim || at(x + 1, y - 1) !== rim) continue;
    const center = at(x, y - 1);
    if (center !== rim && !isProgram(center)) continue;
    let top = y - 2;
    const colors: number[] = [];
    if (center === rim) {
      if (at(x, top) !== rim) continue;
    } else {
      let capped = false;
      for (let scan = y - 1; scan > Math.max(-1, y - 15); scan--) {
        const value = at(x, scan);
        if (value === undefined || !isProgram(value)) break;
        colors.push(value);
        if (scan === y - 1) continue;
        const left = at(x - 1, scan), right = at(x + 1, scan);
        if (left !== colors[colors.length - 2] || right !== left) break;
        if (left === value && at(x, scan - 1) === value
            && at(x - 1, scan - 1) !== value && at(x + 1, scan - 1) !== value) {
          top = scan - 1;
          capped = true;
          break;
        }
      }
      if (!capped) continue;
    }
    const box: NativeBox = [x - 1, top, x + 1, y];
    result.push({ kind: rim === 0 ? 'player' : 'opponent', anchor: [x, y - 1], box,
      rows: cropReturn(rows, box, 1), signature: center === rim ? 'empty' : colors.slice(0, y - top - 1).join(',') });
  }
  return result;
}

export function trackStckSprites() {
  let previous: readonly TrackedSprite[] = [];
  let nextId = 0;
  const score = (a: Sprite, b: Sprite): number => {
    if (a.kind !== b.kind) return Infinity;
    const dx = Math.abs(a.anchor[0] - b.anchor[0]), dy = Math.abs(a.anchor[1] - b.anchor[1]);
    if (dx > 8 || dy > 4) return Infinity;
    return (dx + dy) * 2 + Number(a.signature !== b.signature);
  };
  const uniqueBest = (scores: readonly number[]) => {
    const best = Math.min(...scores);
    const first = scores.indexOf(best);
    return Number.isFinite(best) && first === scores.lastIndexOf(best) ? first : -1;
  };
  return (rows: NativeRows, boundary = false, obscured = false): readonly SpriteChange[] => {
    if (obscured) return [];
    const sprites = readStckSprites(rows);
    const changes: SpriteChange[] = [];
    const used = new Set<number>();
    const matches: TrackedSprite[] = [];
    for (const [index, sprite] of sprites.entries()) {
      const best = boundary ? -1 : uniqueBest(previous.map(item => score(item.sprite, sprite)));
      const matched = previous[best];
      if (!matched || uniqueBest(sprites.map(item => score(matched.sprite, item))) !== index) {
        const track = ++nextId;
        matches.push({ track, sprite });
        changes.push({ track, kind: sprite.kind, effect: 'appeared', before: null, after: sprite });
        continue;
      }
      used.add(best);
      matches.push({ track: matched.track, sprite });
      const prior = matched.sprite;
      const moved = prior.anchor.some((value, i) => value !== sprite.anchor[i]);
      const changed = prior.signature !== sprite.signature;
      if (moved || changed) changes.push({ track: matched.track, kind: sprite.kind,
        effect: moved && changed ? 'moved and changed' : moved ? 'moved' : 'changed', before: prior, after: sprite });
    }
    for (const [index, { sprite, track }] of previous.entries()) if (!used.has(index)) {
      changes.push({ track, kind: sprite.kind, effect: 'no longer detected', before: sprite, after: null });
    }
    previous = matches;
    return boundary ? [] : changes;
  };
}
