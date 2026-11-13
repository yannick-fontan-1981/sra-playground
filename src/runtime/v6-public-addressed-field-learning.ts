import type {
  AddressedFieldFitCandidate,
  AddressedFieldFitComparison,
  AddressedFieldFitEntity,
} from '../logos-engine/addressed-field-fit.ts';
import type { AddressedFieldResponseDependencies } from '../logos-engine/addressed-field-response.ts';
import type { PublicObservationLike } from '../logos-engine/linked-preparation.ts';

function numericTuple(value: unknown, length: number): value is readonly number[] {
  return Array.isArray(value)
    && value.length === length
    && value.every(item => typeof item === 'number' && Number.isFinite(item));
}

function entity(value: unknown): value is AddressedFieldFitEntity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.signature === 'string'
    && candidate.signature.length > 0
    && numericTuple(candidate.position, 2)
    && numericTuple(candidate.bbox, 4)
    && Array.isArray(candidate.mask)
    && candidate.mask.every(point => numericTuple(point, 2))
    && typeof candidate.palette_value === 'number';
}

function entities(observation: PublicObservationLike): AddressedFieldFitEntity[] {
  return Array.isArray(observation.entities)
    ? observation.entities.filter(entity)
    : [];
}

function sameBox(
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number],
): boolean {
  return left.every((value, index) => value === right[index]);
}

/**
 * Public identity remains deliberately strict: an occurrence is unchanged only
 * when both its measured signature and exact public bounding box are preserved.
 */
export function publicAddressedEntityUnchanged(
  source: AddressedFieldFitEntity,
  after: PublicObservationLike,
): boolean {
  return entities(after).some(candidate =>
    candidate.signature === source.signature && sameBox(candidate.bbox, source.bbox));
}

/**
 * Build residual public correspondences without nearest-neighbour guessing.
 *
 * Exact stationary occurrences are removed first. A residual movement is
 * accepted only when one old and one new occurrence remain for the same public
 * signature. Any one-to-many or many-to-one residue stays unresolved.
 */
export function publicResidualCorrespondences(
  before: PublicObservationLike,
  after: PublicObservationLike,
  _first: readonly (readonly number[])[],
  _second: readonly (readonly number[])[],
): AddressedFieldFitComparison {
  const prior = entities(before);
  const current = entities(after);
  const signatures = new Set([
    ...prior.map(item => item.signature),
    ...current.map(item => item.signature),
  ]);
  const candidates: AddressedFieldFitCandidate[] = [];
  const unresolved: unknown[] = [];

  for (const signature of signatures) {
    const beforeGroup = prior.filter(item => item.signature === signature);
    const afterGroup = current.filter(item => item.signature === signature);
    const stationary = beforeGroup.filter(item =>
      afterGroup.some(candidate => sameBox(candidate.bbox, item.bbox)));
    const oldResidual = beforeGroup.filter(item =>
      !afterGroup.some(candidate => sameBox(candidate.bbox, item.bbox)));
    const newResidual = afterGroup.filter(item =>
      !beforeGroup.some(candidate => sameBox(candidate.bbox, item.bbox)));

    if (oldResidual.length === 1 && newResidual.length === 1) {
      candidates.push({
        before: oldResidual[0]!,
        after: newResidual[0]!,
        stationary_same_signature: stationary,
        identity_status: stationary.length > 0
          ? 'unique_residual_with_stationary_exemplar'
          : 'unique_residual_without_stationary_exemplar',
      });
      continue;
    }

    if (oldResidual.length > 0 || newResidual.length > 0) {
      unresolved.push({
        signature,
        before_count: oldResidual.length,
        after_count: newResidual.length,
        reason: 'public_residual_correspondence_not_unique',
      });
    }
  }

  return { candidates, unresolved };
}

export const PUBLIC_ADDRESSED_FIELD_RETURN_DEPENDENCIES = Object.freeze({
  unchanged: publicAddressedEntityUnchanged,
  residualCorrespondences: publicResidualCorrespondences,
}) satisfies AddressedFieldResponseDependencies;