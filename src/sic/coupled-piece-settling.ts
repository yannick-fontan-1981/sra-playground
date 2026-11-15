import type { NativePoint } from '../logos-engine/v6-native-types.ts';

export type CoupledPiece = { point: NativePoint; direction: number; selected: boolean };

const epsilon = 1e-9;
const pointKey = (point: NativePoint) => point.join(',');
export const coupledPiecesKey = (pieces: readonly CoupledPiece[]) =>
  pieces.map(({ point, direction, selected }) => [pointKey(point), direction, Number(selected)].join(':')).sort().join('|');

function relations(pieces: readonly CoupledPiece[]) {
  return pieces.flatMap((first, i) => pieces.slice(i + 1).flatMap((second, offset) => {
    const axis = 1 - first.direction % 2;
    if (first.direction % 2 !== second.direction % 2 || first.point[1 - axis] !== second.point[1 - axis]) return [];
    const delta = second.point[axis]! - first.point[axis]!;
    return delta ? [{ i, j: i + offset + 1, delta, polarity: first.direction === second.direction ? 1 : -1 }] : [];
  }));
}

function energy(pieces: readonly CoupledPiece[]): number {
  return relations(pieces).reduce((sum, relation) => sum - relation.polarity / Math.abs(relation.delta), 0);
}

function settleTick(pieces: readonly CoupledPiece[], floor: ReadonlySet<string>, width: number): CoupledPiece[] | null {
  const forces = pieces.map(() => 0);
  for (const { i, j, delta, polarity } of relations(pieces)) {
    const pull = polarity * Math.sign(delta) / (delta * delta);
    forces[i]! += pull;
    forces[j]! -= pull;
  }
  const moves = pieces.flatMap((piece, index) => {
    const force = forces[index]!;
    if (Math.abs(force) <= epsilon) return [];
    const [x, y] = piece.point, step = Math.sign(force);
    const point: NativePoint = piece.direction % 2 ? [x + step, y] : [x, y + step];
    return floor.has(pointKey(point)) ? [{ index, point }] : [];
  });
  if (!moves.length) return null;
  const original = energy(pieces);
  let best: CoupledPiece[] | null = null, bestCount = 0, bestEnergy = original, bestPosition = Infinity;
  const all = (1 << moves.length) - 1;
  for (let mask = all; mask > 0; mask--) {
    const chosen = moves.filter((_, index) => (mask & (1 << index)) !== 0);
    if (chosen.length < bestCount) continue;
    const candidate = [...pieces];
    for (const { index, point } of chosen) candidate[index] = { ...pieces[index]!, point };
    if (new Set(candidate.map(piece => pointKey(piece.point))).size !== candidate.length) continue;
    if (chosen.some(move => chosen.some(other => other !== move
      && pointKey(move.point) === pointKey(pieces[other.index]!.point)
      && pointKey(other.point) === pointKey(pieces[move.index]!.point)))) continue;
    const score = energy(candidate);
    if (score >= original - epsilon) continue;
    const position = candidate.reduce((sum, { point: [x, y] }) => sum + y * width + x, 0);
    if (chosen.length > bestCount || score < bestEnergy - epsilon || (Math.abs(score - bestEnergy) <= epsilon && position < bestPosition)) {
      best = candidate;
      bestCount = chosen.length;
      bestEnergy = score;
      bestPosition = position;
    }
    if (mask === all) break;
  }
  return best;
}

export function settleCoupledPieces(pieces: CoupledPiece[], floor: ReadonlySet<string>, width: number, height: number): CoupledPiece[] | null {
  let current = pieces;
  for (let tick = 0; tick < width * height; tick++) {
    const next = settleTick(current, floor, width);
    if (!next) return current;
    current = next;
  }
  return null;
}
