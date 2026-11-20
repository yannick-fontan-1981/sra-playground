import type { NativeEntity, NativePoint } from '../logos-engine/v6-native-types.ts';
import { rotateMask } from '../logos-engine/v6-native-observer.ts';

// Absolute screen directions are learned separately. The same coloured footprint can
// present any of its rigid orientations while retaining this family identity.
export function poseFamilyKey(e: Pick<NativeEntity, 'palette_value' | 'mask' | 'bbox'>): string {
  const w = e.bbox[2] - e.bbox[0] + 1;
  const flipped = e.mask.map(([x, y]) => [w - 1 - x, y] as NativePoint);
  const variants: string[] = [];
  for (const mask of [e.mask, flipped])
    for (let i = 0; i < 4; i++)
      variants.push(
        rotateMask(mask, i)
          .map((p) => p.join())
          .join(';')
      );
  return e.palette_value + '/' + variants.sort()[0];
}
