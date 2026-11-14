import { geometricComponents, type GeometricComponent } from '../logos-engine/v6-native-observer.ts';
import type { NativeBox, NativePoint, NativeRows } from '../logos-engine/v6-native-types.ts';

type Filter = (part: GeometricComponent) => boolean;

export type DirectionalMotion = { readonly command: string; readonly family: string; readonly beforeRef: string; readonly afterRef: string;
  readonly levelEpoch: number; readonly translations: readonly ComponentTranslation[] };
export type ComponentTranslation = { readonly from: NativeBox; readonly to: NativeBox; readonly displacement: NativePoint; readonly area: number; readonly color: number };

/** Parts nested in the footprint can express the same motion. Conflicting
 * translations inside the footprint leave the command effect unresolved. */
export function motionIntoFootprint(receipt: DirectionalMotion, [left, top, right, bottom]: NativeBox): NativePoint | null {
  const within = receipt.translations.filter(({ to: [l, t, r, b] }) => l >= left && t >= top && r <= right && b <= bottom);
  const displacement = within[0]?.displacement;
  return displacement && within.every(part => part.displacement.every((delta, axis) => delta === displacement[axis])) ? displacement : null;
}

/** Produce a compact receipt only when a planning consumer asks for it. */
export function measureDirectionalMotion(before: NativeRows, after: NativeRows, context: Omit<DirectionalMotion, 'translations'>): DirectionalMotion {
  const area = before.length * before[0]!.length;
  const matches = measureComponentTranslations(before, after, part => part.area > 1 && part.area * 4 < area);
  return { ...context, translations: matches.map(({ from, to, displacement }) =>
    ({ from: from.bbox, to: to.bbox, displacement, area: from.area, color: from.color })) };
}

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
