/** Consumed V5 entity_identity measurements. Source rows and proofs stay intact.
 * Arrays represent Python tuples; objects represent its frozen string maps. */
import { symbolicDigest } from './v6-hash.ts';
import { compareUnicode, isJsonObject } from './canonical.ts';
type R = Record<string, any>;

export function outlineTruthy(value: unknown): boolean {
  if (value == null || value === false || value === 0 || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/** Python tuple/dict equality, including its numeric bool/int equality. */
export function outlineEqual(a: any, b: any): boolean {
  if ((typeof a === 'number' || typeof a === 'boolean') && (typeof b === 'number' || typeof b === 'boolean')) return Number(a) === Number(b);
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => outlineEqual(v, b[i]));
  return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && outlineEqual(a[k], b[k]));
}

export function outlineUnique<T>(values: readonly T[]): T[] {
  const result: T[] = [];
  for (const value of values) if (!result.some(other => outlineEqual(other, value))) result.push(value);
  return result;
}

export function outlineTupleCompare(a: any, b: any): number {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const comparison = outlineTupleCompare(a[i], b[i]); if (comparison) return comparison; }
    return a.length - b.length;
  }
  if (typeof a === 'string' && typeof b === 'string') return compareUnicode(a, b);
  if ((typeof a === 'number' || typeof a === 'boolean') && (typeof b === 'number' || typeof b === 'boolean')) return Number(a) - Number(b);
  throw new TypeError('Outside outline ordered tuple contract');
}

export function outlineExactEntityDescriptionCount(rows: readonly R[]): number | null {
  for (const row of rows) {
    if (outlineTruthy(row.entity_ref)) continue;
    const members = row.member_refs ?? [];
    if (!Array.isArray(members) || members.length < 2 || members.length > 64
      || members.some(ref => typeof ref !== 'string' || !ref) || new Set(members).size !== members.length
      || typeof row.support_digest !== 'string' || !row.support_digest || typeof row.operational_scene_ref !== 'string' || !row.operational_scene_ref
      || !Number.isSafeInteger(row.bbox_height) || row.bbox_height <= 0 || !Number.isSafeInteger(row.bbox_width) || row.bbox_width <= 0
      || row.bbox_height * row.bbox_width > 4096) return null;
  }
  if (rows.length && rows.every(row => outlineTruthy(row.control_geometry_identity_projection))) {
    return outlineUnique(rows.map(row => row.control_geometry_identity_projection)).length;
  }
  // The source deliberately uses stable JSON digests in this branch, so true
  // and 1 keep their different serialized descriptions despite Python ==.
  return new Set(rows.map(row => symbolicDigest(Object.fromEntries(Object.entries(row)
    .filter(([key]) => !['term_ref', 'role_premise_claim_refs', 'source_term_rows'].includes(key))
    .map(([key, value]) => [key, key === 'member_refs' ? [...value].sort(outlineTupleCompare) : value]))))).size;
}

export function outlineMarkerDescriptionsConjoin(rows: readonly R[]): boolean {
  if (rows.length < 2 || rows.length > 64) return false;
  const required = ['entity_ref', 'shape_digest', 'bbox_height', 'bbox_width', 'operational_scene_ref'];
  let markerPresent = false; const combined: R = {};
  for (const row of rows) {
    const projection = row.control_geometry_identity_projection;
    if (!isJsonObject(projection) || !Object.keys(projection).length || required.some(key => projection[key] == null || projection[key] === '')) return false;
    const marker = row.control_geometry_declared_marker_carrier === true;
    if (!marker && row.control_geometry_partial_description_conjunction_allowed !== true) return false;
    if (marker) {
      const members = row.marker_member_refs;
      if (!Array.isArray(members) || !members.length || members.length > 64 || members.some(ref => typeof ref !== 'string' || !ref)
        || new Set(members).size !== members.length) return false;
      markerPresent = true;
    }
    if (outlineTruthy(row.control_support_unresolved_refs) || outlineTruthy(row.control_support_stale_term_refs)) return false;
    for (const [key, value] of Object.entries(projection).sort(([a], [b]) => compareUnicode(a, b))) {
      if (value === null) continue;
      if (Object.hasOwn(combined, key) && !outlineEqual(combined[key], value)) return false;
      combined[key] = value;
    }
    if (Object.keys(combined).length > 64) return false;
  }
  return markerPresent;
}

export function outlineGeometryDescriptionsCompatible(rows: readonly R[]): boolean {
  if (rows.length > 1 && outlineExactEntityDescriptionCount(rows) === 1) return true;
  if (rows.length < 2 || rows.length > 64 || !rows.some(row => row.control_geometry_partial_description_conjunction_allowed === true)) return false;
  const required = ['entity_ref', 'shape_digest', 'bbox_height', 'bbox_width', 'operational_scene_ref'];
  if (rows.some(row => required.some(key => row[key] == null || row[key] === ''))) return false;
  if (!rows.some(row => Number.isSafeInteger(row.bbox_top) && Number.isSafeInteger(row.bbox_left) && outlineTruthy(row.normalized_valued_pixels))) return false;
  const fields = new Set(required);
  for (const row of rows) {
    const declared = row.control_geometry_identity_fields;
    if (!Array.isArray(declared) || !declared.length) return false;
    for (const field of declared) fields.add(field);
  }
  if (fields.size > 64) return false;
  for (const key of fields) {
    const values = rows.filter(row => Object.hasOwn(row, key) && row[key] !== null).map(row => row[key]);
    if (values.some(value => !outlineEqual(value, values[0]))) return false;
  }
  return true;
}

export function outlineMemorialReferenceMeasurements(rows: readonly R[]): R {
  const refs = outlineUnique(rows.flatMap(row => row.role_premise_claim_refs ?? []));
  return { canonical_memorial_control_premise_claim_refs: refs, canonical_memorial_control_premise_claim_count: refs.length,
    canonical_provisional_control_identity_count: outlineExactEntityDescriptionCount(rows),
    canonical_provisional_marker_descriptions_conjoin: outlineMarkerDescriptionsConjoin(rows),
    canonical_provisional_control_bearer_ref_count: outlineUnique(rows.filter(row => outlineTruthy(row.entity_ref)).map(row => row.entity_ref)).length,
    canonical_provisional_control_bearer_refs_complete: rows.length > 0 && rows.every(row => outlineTruthy(row.entity_ref)) };
}
