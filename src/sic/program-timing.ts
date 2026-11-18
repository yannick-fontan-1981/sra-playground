import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export type ProgramHazard = { steps: { instruction: number; cells: NativePoint[] }[]; ref: string };
type Lattice = { origin: NativePoint; shape: NativePoint; size: number };

/** Find an animated band crossing the predicted landing of a disappearing piece. */
export function observeProgramHazard(before: NativeRows, steps: ReadonlyMap<number, NativeRows>, interrupted: number,
  landing: NativePoint, lattice: Lattice, ref: string): ProgramHazard | null {
  const failed = steps.get(interrupted);
  if (!failed) return null;
  const { origin, shape, size } = lattice;
  const spans: NativePoint[][] = [];
  for (const along of [0, 1] as const) {
    const across = along === 0 ? 1 : 0;
    const side = origin[across] + landing[across] * size;
    const end = origin[along] + shape[along] * size;
    const cut = origin[along] + landing[along] * size;
    for (let lane = side; lane < side + size; lane++) {
      let span: NativePoint[] = [];
      for (let offset = origin[along]; offset <= end; offset++) {
        const point: NativePoint = along === 0 ? [offset, lane] : [lane, offset];
        const [x, y] = point;
        if (offset < end && failed[y]?.[x] !== before[y]?.[x]) {
          span.push(point);
          continue;
        }
        if (span.length >= size * 3 && span.some(pixel => pixel[along] >= cut && pixel[along] < cut + size)) spans.push(span);
        span = [];
      }
    }
  }
  const measured = new Map<number, Map<string, NativePoint>>();
  for (const span of spans) {
    const phases = [...steps].filter(([, frame]) => span.every(([x, y]) => frame[y]?.[x] === failed[y]?.[x]));
    if (phases.length < 2 || phases.length === steps.size) continue;
    for (const [instruction] of phases) {
      const cells = measured.get(instruction) ?? new Map<string, NativePoint>();
      for (const [x, y] of span) {
        const cell: NativePoint = [Math.floor((x - origin[0]) / size), Math.floor((y - origin[1]) / size)];
        cells.set(cell.join(','), cell);
      }
      measured.set(instruction, cells);
    }
  }
  return measured.has(interrupted)
    ? { steps: [...measured].map(([instruction, cells]) => ({ instruction, cells: [...cells.values()] })), ref }
    : null;
}
