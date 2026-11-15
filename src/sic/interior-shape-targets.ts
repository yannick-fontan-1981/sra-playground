import { geometricComponents, type GeometricComponent } from '../logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

export function componentCenterPoint({ bbox: [left, top, right, bottom], mask }: GeometricComponent): NativePoint {
  const distance = ([x, y]: NativePoint) => Math.abs(2 * x + left - right) + Math.abs(2 * y + top - bottom);
  const [x, y] = mask.reduce((best, point) => distance(point) < distance(best) ? point : best);
  return [left + x, top + y];
}

export type ShapeTargetOrder = 'non_solid' | 'interior' | 'small';

export function shapeTargets(rows: NativeRows, order: ShapeTargetOrder, limit: number) {
  const height = rows.length, width = rows[0]!.length;
  return geometricComponents(rows).filter(({ bbox: [left, top, right, bottom], area }) => {
    if (area < 2 || area * 4 >= width * height) return false;
    if (order === 'small') return true;
    if (left === 0 || top === 0 || right === width - 1 || bottom === height - 1) return false;
    const w = right - left + 1, h = bottom - top + 1;
    return order === 'interior' || (w >= 2 && h >= 2 && area < w * h);
  }).sort((a, b) => order === 'small' ? a.area - b.area : b.area - a.area).slice(0, limit).map(part => {
    const [x, y] = componentCenterPoint(part);
    const command: NativeCommand = { action_ref: 'ACTION6', data: { x, y } };
    return { command, box: part.bbox };
  });
}
