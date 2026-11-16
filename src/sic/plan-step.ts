import type { NativeBox, NativeRows } from '../logos-engine/v6-native-types.ts';

/** The plan stays open only while its next step can still be checked in the current situation. */
export function decidePlanContinuation(input: {
  readonly boundary: boolean;
  readonly matched: boolean | null;
  readonly sealRequested: boolean;
  readonly hasNextStep: boolean;
  readonly budgetReason: string | null;
}) {
  const interruption = input.boundary ? 'official_boundary_or_terminal'
    : input.matched === false ? 'observed_path_expectation_diverged'
      : input.sealRequested && input.hasNextStep ? 'frontier_outcome_sealed_prefix'
        : input.budgetReason;
  return { interruption, continue: input.hasNextStep && !input.sealRequested && interruption === null };
}

/** Reject an unexpected change outside the sprites a projected step moves. */
export function unchangedOutside(first: NativeRows, second: NativeRows, moved: readonly NativeBox[]): boolean {
  for (let y = 0; y < first.length; y++) {
    const left = first[y]!, right = second[y];
    if (!right || left.length !== right.length) return false;
    for (let x = 0; x < left.length; x++) {
      if (left[x] !== right[x] && !moved.some(box => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3])) return false;
    }
  }
  return first.length === second.length;
}

type LandingPixel = readonly [x: number, y: number, value: number];
export interface MeasuredLanding {
  readonly entering: readonly LandingPixel[];
}

const contains = (box: NativeBox, x: number, y: number): boolean => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];

/** Bind only the newly occupied pixels of a future translation. A pixel that
 * was hidden by the original sprite requires a fresh observation. */
export function bindTranslationLanding(rows: NativeRows, original: NativeBox, previous: NativeBox, landing: NativeBox): MeasuredLanding | null {
  const entering: LandingPixel[] = [];
  for (let y = landing[1]; y <= landing[3]; y++) {
    for (let x = landing[0]; x <= landing[2]; x++) {
      if (contains(previous, x, y)) continue;
      const value = rows[y]?.[x];
      if (value === undefined || contains(original, x, y)) return null;
      entering.push([x, y, value]);
    }
  }
  return entering.length ? { entering } : null;
}

export function sameLandingPixels(landing: MeasuredLanding, rows: NativeRows): boolean {
  return landing.entering.every(([x, y, value]) => rows[y]?.[x] === value);
}
