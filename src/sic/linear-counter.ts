import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Write = { box: NativeBox; from: number; to: number };
export type LinearCounter = { last: Write; advance: NativePoint | null };

function inBox([l, t, r, b]: NativeBox, x: number, y: number): boolean {
  return l <= x && x <= r && t <= y && y <= b;
}

/** Infer a single repeated exterior write, leaving every other difference to the family guard. */
export function observeLinearCounter(first: NativeRows, second: NativeRows, excluded: NativeBox[], prior?: LinearCounter | null): LinearCounter | undefined {
  let left = Infinity, top = Infinity, right = -1, bottom = -1, count = 0;
  let colors: { from: number; to: number } | undefined;
  for (let y = 0; y < first.length; y++) for (let x = 0; x < first[y]!.length; x++) {
    const from = first[y]![x]!, to = second[y]?.[x];
    if (from === to || excluded.some(box => inBox(box, x, y))) continue;
    if (to === undefined || colors && (from !== colors.from || to !== colors.to)) return undefined;
    colors ??= { from, to };
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    count++;
  }
  if (!colors || count < 2 || left !== right && top !== bottom || count !== (right - left + 1) * (bottom - top + 1)) return undefined;
  const last: Write = { box: [left, top, right, bottom], ...colors };
  if (!prior) return { last, advance: null };
  const [l, t, r, b] = prior.last.box, dx = left - l, dy = top - t;
  const translated = right - r === dx && bottom - b === dy && Math.abs(dx) + Math.abs(dy) === 1;
  const disjoint = (left > r || right < l || top > b || bottom < t);
  const stable = colors.from === prior.last.from && colors.to === prior.last.to;
  return { last, advance: translated && disjoint && stable ? [dx, dy] : null };
}

export function projectedCounterWrite(counter: LinearCounter | null | undefined, index: number): Write | null {
  if (!counter?.advance) return null;
  const { last, advance: [dx, dy] } = counter, [l, t, r, b] = last.box;
  return { ...last, box: [l + dx * index, t + dy * index, r + dx * index, b + dy * index] };
}

export function counterValue(rows: NativeRows, { box: [l, t, r, b], from, to }: Write, phase: 'from' | 'to'): boolean {
  const value = phase === 'from' ? from : to;
  for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (rows[y]?.[x] !== value) return false;
  return true;
}
