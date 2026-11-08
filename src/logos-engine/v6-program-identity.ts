/** Python JSON identities for the fitted program grammar's typed float fields.
 *
 * The ordinary V7 symbolic domain remains unchanged. Python's glyph fitter
 * computes matrix and center values as floats, including values such as 0.0
 * and 2.0; this schema preserves their source spelling inside every enclosing
 * model, plan and event identity. Native persistence retains the numeric value
 * with its existing finite IEEE-754 codec.
 */
import { compareUnicode } from './canonical.ts';
import { retainNativeJson } from './v6-native-owned.ts';
import { sha256Bytes } from './v6-hash.ts';
import { BoundedWeakCache } from './bounded-weak-cache.ts';

const normalCache = new BoundedWeakCache<string>(16 * 1024 * 1024, 4096);
const floatCache = new BoundedWeakCache<string>(256 * 1024, 1024);
const asciiString = (value: string): string => JSON.stringify(value).replace(/[\u007f-\uffff]/g,
  character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);

/** CPython repr's decimal/scientific cutoffs and signed, two-digit exponent. */
export function programPythonFloat(value: number): string {
  if (!Number.isFinite(value)) throw new TypeError('Program identities require finite numbers');
  if (Object.is(value, -0)) return '-0.0';
  const magnitude = Math.abs(value);
  if (magnitude && (magnitude < 1e-4 || magnitude >= 1e16)) {
    const [mantissa, exponent] = value.toExponential().split('e') as [string, string];
    const power = Number(exponent);
    return `${mantissa}e${power < 0 ? '-' : '+'}${Math.abs(power).toString().padStart(2, '0')}`;
  }
  const text = String(value);
  return Number.isInteger(value) ? `${text}.0` : text;
}

export function programCanonical(value: unknown): string {
  // Validate closed JSON and use only deeply immutable trees in the bounded
  // cache. This owns no mutable caller objects and keeps no growing history.
  const retained = retainNativeJson(value);
  const encode = (item: unknown, float: boolean): string => {
    if (item === null) return 'null';
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'string') return asciiString(item);
    if (typeof item === 'number') {
      return float || !Number.isSafeInteger(item) || Object.is(item, -0) ? programPythonFloat(item) : String(item);
    }
    const object = item as Record<string, unknown>;
    const cache = float ? floatCache : normalCache, cached = cache.get(object);
    if (cached !== undefined) return cached;
    let text: string;
    if (Array.isArray(object)) text = `[${object.map(child => encode(child, float)).join(',')}]`;
    else {
      const glyph = object.status === 'conditional_glyph_vector_map';
      text = `{${Object.keys(object).sort(compareUnicode).map(key =>
        `${asciiString(key)}:${encode(object[key], float || glyph && (key === 'matrix' || key === 'center'))}`).join(',')}}`;
    }
    cache.set(object, text, text.length * 2 + 128);
    return text;
  };
  return encode(retained, false);
}

export function programIdentity(value: unknown): string {
  return sha256Bytes(new TextEncoder().encode(programCanonical(value)));
}
