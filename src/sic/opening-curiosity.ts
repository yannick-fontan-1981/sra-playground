import type { NativeBox, NativeEntity } from '../logos-engine/v6-native-types.ts';

export type OpeningCuriosityMode = 'shadow' | 'active';

export const openingCuriosityLabel = 'Investigate the richest observable composition';

export interface OpeningTarget {
  readonly entity: string;
  readonly box: NativeBox;
  readonly related: readonly { readonly entity: string; readonly box: NativeBox }[];
  readonly distinctRelations: number;
}

/** Count distinct neighboring roles from measured entity boundaries. A
 * repeated shape on the same side contributes one relation. */
export function openingClickTargets(entities: readonly NativeEntity[], points: readonly (readonly [number, number])[]) {
  const cells = new Map<NativeEntity, Set<number>>();
  const key = (x: number, y: number) => y * 64 + x;
  for (const entity of entities) {
    cells.set(entity, new Set(entity.mask.map(([dx, dy]) => key(entity.position[0] + dx, entity.position[1] + dy))));
  }
  const counts = new Map<number, number>();
  for (const mask of cells.values()) for (const pixel of mask) counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
  return points.map(([x, y]): OpeningTarget | null => {
    const pixel = key(x, y);
    if (counts.get(pixel) !== 1) return null;
    const subject = entities.find(entity => cells.get(entity)!.has(pixel));
    if (!subject) return null;
    const [left, top, right, bottom] = subject.bbox;
    const horizontalReach = Math.max(8, right - left + 1), verticalReach = Math.max(8, bottom - top + 1);
    const relations = new Map<string, { entity: string; box: NativeBox }>();
    for (const other of entities) {
      if (other === subject) continue;
      const [a, b, c, d] = other.bbox;
      const horizontal = c >= left && a <= right, vertical = d >= top && b <= bottom;
      const side = horizontal && top - d >= 1 && top - d <= verticalReach ? 'above'
        : horizontal && b - bottom >= 1 && b - bottom <= verticalReach ? 'below'
          : vertical && left - c >= 1 && left - c <= horizontalReach ? 'left'
            : vertical && a - right >= 1 && a - right <= horizontalReach ? 'right' : null;
      if (side) {
        const relation = JSON.stringify([side, other.signature, other.palette_value]);
        if (!relations.has(relation)) relations.set(relation, { entity: other.id, box: other.bbox });
      }
    }
    return relations.size ? { entity: subject.id, box: subject.bbox, related: [...relations.values()].slice(0, 4), distinctRelations: relations.size } : null;
  });
}
