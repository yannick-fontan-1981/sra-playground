/**
 * Finite numerical values for the isolated V6 dated-packet layer.
 *
 * The shared V7 canonical domain remains integer-only. These native state
 * digests use sorted JSON for finite IEEE-754 values; integer raster/support
 * identities equal the pinned source, but floating identities are deliberately
 * native and are not claimed to equal Python's float JSON spelling or libm.
 */
import { assertUnicode, compareUnicode, isJsonObject } from './canonical.ts';
import { sha256Bytes } from './v6-hash.ts';

export function linkedPacketCanonical(value: unknown): string {
  const seen = new WeakSet<object>();
  const quote = (text: string): string => {
    assertUnicode(text);
    return JSON.stringify(text).replace(/[\u007f-\uffff]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  };
  function encode(item: unknown, depth: number): string {
    if (depth > 128) throw new TypeError('Linked packet numerical state nesting exceeds its contract');
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'string') return quote(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) throw new TypeError('Linked packet numbers must be finite');
      return Object.is(item, -0) ? '-0.0' : String(item);
    }
    if (typeof item !== 'object' || (!Array.isArray(item) && !isJsonObject(item)) || Object.getOwnPropertySymbols(item).length) {
      throw new TypeError('Linked packet digests require plain JSON');
    }
    if (seen.has(item)) throw new TypeError('Cyclic linked packet state');
    seen.add(item);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(item), array = Array.isArray(item);
      const names = Object.keys(descriptors).filter(key => !array || key !== 'length');
      if (array && (names.length !== item.length || names.some((key, index) => key !== String(index)))) throw new TypeError('Sparse linked packet arrays');
      for (const name of names) if (!descriptors[name]!.enumerable || !('value' in descriptors[name]!)) throw new TypeError('Linked packet JSON requires data properties');
      if (array) return `[${names.map(name => encode(descriptors[name]!.value, depth + 1)).join(',')}]`;
      return `{${names.sort(compareUnicode).map(name => `${quote(name)}:${encode(descriptors[name]!.value, depth + 1)}`).join(',')}}`;
    } finally { seen.delete(item); }
  }
  return encode(value, 0);
}

export function linkedPacketDigest(value: unknown): string {
  return sha256Bytes(new TextEncoder().encode(linkedPacketCanonical(value)));
}

/** Python round(x) uses ties-to-even, including negative half integers. */
export function linkedRound(value: number): number {
  if (!Number.isFinite(value)) throw new TypeError('Cannot round a non-finite value');
  const floor = Math.floor(value), difference = value - floor;
  return difference < 0.5 ? floor : difference > 0.5 ? floor + 1 : floor % 2 === 0 ? floor : floor + 1;
}
export const linkedCircular = (value: number): number => Math.atan2(Math.sin(value), Math.cos(value));
export const linkedCopySign = (magnitude: number, sign: number): number => Math.abs(magnitude) * (sign < 0 || Object.is(sign, -0) ? -1 : 1);
