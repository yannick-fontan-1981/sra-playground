import type { NativeBox, NativeEntity, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type PatternGrid = { xs: number[]; ys: number[]; floor: NativePoint; boundary: NativeBox };
export type PatternPiece = { color: number; cell: NativePoint; selected: boolean };
export type PatternExample = { color: number; cell: NativePoint; box: NativeBox };
type PatternPile = { colors: number[]; unknownBelow: boolean };
export type PatternPiles = Record<string, PatternPile>;
export type PatternStep = {
  piece: PatternPiece; move: { command: string; step: NativePoint; length: number }; goal: NativePoint;
  intent: 'align' | 'park' | 'uncover' | 'clear'; covered?: PatternPiece;
};
type FindRoute = (piece: PatternPiece, goal: NativePoint, occupied: Set<string>, cover?: boolean) => PatternStep['move'] | null;

const patternKey = ([column, row]: NativePoint) => `${column},${row}`;
const gap = ([l, t, r, b]: NativeBox, [x, y, u, v]: NativeBox) => Math.max(0, l - u, x - r, t - v, y - b);
const distance = ([x, y]: NativePoint, [a, b]: NativePoint) => Math.abs(x - a) + Math.abs(y - b);

function nearbyExamples(boxes: NativeBox[]) {
  const groups: NativeBox[][] = [];
  for (const box of boxes) {
    const near = groups.filter(group => group.some(other => gap(box, other) <= 2));
    groups.splice(0, groups.length, ...groups.filter(group => !near.includes(group)), [box, ...near.flat()]);
  }
  return groups.filter(group => group.length >= 2).map<NativeBox>(group => [
    Math.min(...group.map(box => box[0])), Math.min(...group.map(box => box[1])),
    Math.max(...group.map(box => box[2])), Math.max(...group.map(box => box[3])),
  ]);
}

export function readStackExample(grid: PatternGrid, rows: NativeRows,
  entities: readonly NativeEntity[], pieces: PatternPiece[]): PatternExample[] | null {
  const below = grid.boundary[3], backgroundCounts = new Map<number, number>();
  for (const row of rows.slice(below + 1)) for (const ink of row) {
    if (grid.floor.includes(ink)) backgroundCounts.set(ink, (backgroundCounts.get(ink) ?? 0) + 1);
  }
  const background = [...backgroundCounts].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (background === undefined) return null;
  const boxes = entities.filter(part => part.bbox[1] > below && part.area >= 2 && !grid.floor.includes(part.palette_value))
    .map(part => part.bbox);
  const candidates = new Map<string, PatternExample[]>();
  for (const [left, top, right, bottom] of nearbyExamples(boxes)) {
    const width = right - left + 1, height = bottom - top + 1;
    const maxScale = Math.min(Math.floor((grid.xs.at(-1)! - grid.xs[0]!) / width),
      Math.floor((grid.ys.at(-1)! - grid.ys[0]!) / height));
    for (let scale = 2; scale <= maxScale; scale++) {
      for (const [r, y] of grid.ys.entries()) for (const [c, x] of grid.xs.entries()) {
        const endX = grid.xs.indexOf(x + width * scale), endY = grid.ys.indexOf(y + height * scale);
        if (endX === -1 || endY === -1) continue;
        const goals = tiledExample(grid, rows, [c, r], [endX, endY], [left, top], scale, background);
        if (!goals || new Set(goals.map(goal => goal.color)).size < 2
          || !goals.some(goal => pieces.some(piece => piece.color === goal.color))) continue;
        candidates.set(JSON.stringify(goals.map(goal => [goal.cell, goal.color])), goals);
      }
    }
  }
  return candidates.size === 1 ? [...candidates.values()][0]! : null;
}

function tiledExample(grid: PatternGrid, rows: NativeRows, [col, row]: NativePoint, [endCol, endRow]: NativePoint,
  [left, top]: NativePoint, scale: number, background: number): PatternExample[] | null {
  const goals: PatternExample[] = [], originX = grid.xs[col]!, originY = grid.ys[row]!;
  const sampleX = (x: number) => left + Math.floor((x - originX) / scale);
  const sampleY = (y: number) => top + Math.floor((y - originY) / scale);
  for (let r = row; r < endRow; r++) for (let c = col; c < endCol; c++) {
    const l = grid.xs[c]!, t = grid.ys[r]!, right = grid.xs[c + 1]! - 1, bottom = grid.ys[r + 1]! - 1;
    const color = rows[sampleY(t)]![sampleX(l)]!;
    for (let y = sampleY(t); y <= sampleY(bottom); y++) {
      for (let x = sampleX(l); x <= sampleX(right); x++) if (rows[y]![x] !== color) return null;
    }
    if (color === background) continue;
    if (grid.floor.includes(color)) return null;
    goals.push({ cell: [c, r], color, box: [sampleX(l), sampleY(t), sampleX(right), sampleY(bottom)] });
  }
  return goals;
}

function matchPieces(pieces: PatternPiece[], goals: PatternExample[]) {
  const pairs = pieces.flatMap(piece => goals.filter(goal => goal.color === piece.color)
    .map(goal => ({ piece, goal, distance: distance(piece.cell, goal.cell) }))).sort((a, b) => a.distance - b.distance);
  const used = new Set<PatternExample>(), assigned = new Map<PatternPiece, PatternExample>();
  for (const { piece, goal } of pairs) {
    if (used.has(goal) || assigned.has(piece)) continue;
    assigned.set(piece, goal);
    used.add(goal);
  }
  return { assigned, missing: goals.filter(goal => !used.has(goal)) };
}

export function chooseStackStep(grid: PatternGrid, pieces: PatternPiece[], goals: PatternExample[], piles: PatternPiles,
  route: FindRoute): PatternStep | null {
  const { assigned, missing } = matchPieces(pieces, goals);
  const bySite = new Map(pieces.map(piece => [patternKey(piece.cell), piece])), occupied = new Set(bySite.keys());
  const targetSites = new Set(goals.map(goal => patternKey(goal.cell)));
  const open = grid.ys.slice(0, -1).flatMap((_, r) => grid.xs.slice(0, -1).map((_, c) => [c, r] as NativePoint))
    .filter(cell => !occupied.has(patternKey(cell)) && !targetSites.has(patternKey(cell)));
  const offer = (piece: PatternPiece, goal: NativePoint, intent: PatternStep['intent'], canCover = false): PatternStep[] => {
    const move = route(piece, goal, occupied, canCover);
    if (!move) return [];
    const covered = canCover ? bySite.get(patternKey(move.step)) : undefined;
    return [{ piece, move, goal, intent, ...(covered ? { covered } : {}) }];
  };
  const pick = (steps: PatternStep[]) => steps.sort((a, b) => Number(b.piece.selected) - Number(a.piece.selected)
    || a.move.length - b.move.length)[0] ?? null;
  if (missing.length) {
    const buried = pieces.filter(piece => piles[patternKey(piece.cell)]?.colors.slice(1)
      .some(color => missing.some(goal => goal.color === color)));
    const candidates = buried.length ? buried : pieces.filter(piece => piles[patternKey(piece.cell)]?.unknownBelow);
    return pick(candidates.flatMap(piece => open.flatMap(cell => offer(piece, cell, 'uncover'))));
  }
  const spare = pieces.filter(piece => !assigned.has(piece) && !targetSites.has(patternKey(piece.cell)));
  const parking = goals.filter(goal => {
    const holder = bySite.get(patternKey(goal.cell));
    return !holder || !assigned.has(holder);
  });
  const park = pick(spare.flatMap(piece => parking.flatMap(goal => offer(piece, goal.cell, 'park', true))));
  if (park) return park;
  const align = pick([...assigned].flatMap(([piece, goal]) => {
    const other = bySite.get(patternKey(goal.cell));
    return offer(piece, goal.cell, 'align', !!other && !assigned.has(other));
  }));
  if (align) return align;
  const blocked = goals.flatMap(goal => {
    const holder = bySite.get(patternKey(goal.cell));
    return holder && (spare.length > 0 || holder.color !== goal.color) ? [holder] : [];
  });
  return pick(blocked.flatMap(piece => open.flatMap(cell => offer(piece, cell, 'clear'))));
}
