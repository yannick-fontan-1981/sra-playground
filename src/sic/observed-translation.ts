import { geometricComponents, type GeometricComponent } from '../logos-engine/v6-native-observer.ts';
import type { NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Filter = (part: GeometricComponent) => boolean;

/** Compare visible components by their full mask and palette value. Each
 * consumer supplies its evidence scope and decides what the movement means. */
export function measureComponentTranslations(before: NativeRows, after: NativeRows, source: Filter, returned: Filter = source) {
  const indexed = (rows: NativeRows, include: Filter) => {
    const components = new Map<string, GeometricComponent[]>();
    for (const part of geometricComponents(rows)) {
      if (!include(part)) continue;
      const signature = JSON.stringify([part.color, part.mask]);
      const matches = components.get(signature);
      if (matches) matches.push(part);
      else components.set(signature, [part]);
    }
    return components;
  };
  const previous = indexed(before, source), current = indexed(after, returned);
  return [...previous].flatMap(([signature, matches]) => {
    const destinations = current.get(signature);
    if (matches.length !== 1 || destinations?.length !== 1) return [];
    const from = matches[0]!, to = destinations[0]!;
    const displacement: NativePoint = [to.bbox[0] - from.bbox[0], to.bbox[1] - from.bbox[1]];
    return displacement.some(Boolean) ? [{ from, to, displacement }] : [];
  });
}
