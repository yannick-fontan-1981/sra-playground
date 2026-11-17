import { orientedCouplingTile } from '../logos-engine/v6-oriented-coupling.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Grid = { pitch: number; phase: NativePoint; background: number; targets: NativePoint[] };
export type DeliveryPassage = { floor: string[]; source: string[]; mouths: NativePoint[]; staging: string[] };

const key = (values: readonly number[]) => values.join(',');

export function measureDeliveryPassage(rows: NativeRows, grid: Grid, actor: NativePoint, parts: NativePoint[],
  carriers: NativePoint[]): DeliveryPassage | null {
  if (carriers.length !== 1 || grid.targets.length < parts.length) return null;
  const limits = [Math.floor((rows[0]!.length - grid.phase[0]) / grid.pitch),
    Math.floor((rows.length - grid.phase[1]) / grid.pitch)];
  const floor = new Set([actor, ...parts, ...carriers, ...grid.targets].map(key));
  for (let y = 0; y < limits[1]!; y++) for (let x = 0; x < limits[0]!; x++) {
    if (orientedCouplingTile(rows, grid, [x, y])?.every(row => row.every(ink => ink === grid.background))) floor.add(key([x, y]));
  }
  const candidates: DeliveryPassage[] = [];
  for (const axis of [0, 1] as const) {
    const towardActor = Math.sign(actor[axis] - grid.targets[0]![axis]);
    if (!towardActor || grid.targets.some(target => Math.sign(actor[axis] - target[axis]) !== towardActor)) continue;
    const cell = (line: number, offset: number): NativePoint => axis === 0 ? [line, offset] : [offset, line];
    const gap = (line: number) => Array.from({ length: limits[1 - axis]! }, (_, offset) => offset)
      .filter(offset => floor.has(key(cell(line, offset))));
    let band: { from: number; to: number; gap: number[] } | null = null;
    for (let line = actor[axis] - towardActor; grid.targets.every(target => (line - target[axis]) * towardActor > 0); line -= towardActor) {
      const opening = gap(line);
      if (!opening.length || opening.length > 3 || opening.at(-1)! - opening[0]! !== opening.length - 1) continue;
      let end = line;
      while (grid.targets.every(target => (end - towardActor - target[axis]) * towardActor > 0)
        && key(gap(end - towardActor)) === key(opening)) end -= towardActor;
      if (!band || Math.abs(line - end) > Math.abs(band.from - band.to)) band = { from: line, to: end, gap: opening };
      line = end;
    }
    if (!band || (carriers[0]![axis] - band.to) * towardActor >= 0) continue;
    const mouths = band.gap.map(offset => cell(band.from + towardActor, offset)).filter(site => floor.has(key(site)));
    if (!mouths.length) continue;
    const source = [...floor].filter(id => {
      const coordinate = Number(id.split(',')[axis]);
      return (coordinate - band.from) * towardActor > 0;
    });
    const staging = [1, 2].flatMap(distance => band.gap.map(offset => key(cell(band.from + distance * towardActor, offset))));
    candidates.push({ floor: [...floor], source, mouths, staging });
  }
  return candidates.length === 1 ? candidates[0]! : null;
}
