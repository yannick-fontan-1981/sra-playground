export const NATIVE_REGION_BENCHMARK_MANIFEST_STATUSES = Object.freeze([
  'ready-for-official-abba-measurement',
  'official-abba-measurement-accepted',
] as const);

export type NativeRegionBenchmarkManifestStatus =
  typeof NATIVE_REGION_BENCHMARK_MANIFEST_STATUSES[number];

export interface NativeRegionBenchmarkConfig {
  manifestVersion: number;
  manifestStatus: NativeRegionBenchmarkManifestStatus;
  referenceSourceRef: string;
  candidateSourceRef: string;
  corpusRef: string;
  measurementIsolation: string;
  requestedAt: string;
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

export function validateNativeRegionBenchmarkConfig(
  value: unknown,
): NativeRegionBenchmarkConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('official benchmark config must be an object');
  }
  const input = value as Record<string, unknown>;
  if (input.manifestVersion !== 1) {
    throw new Error('official benchmark manifest version is unsupported');
  }
  const manifestStatus = nonEmptyString(input.manifestStatus, 'manifestStatus');
  if (!(NATIVE_REGION_BENCHMARK_MANIFEST_STATUSES as readonly string[]).includes(manifestStatus)) {
    throw new Error(`official benchmark manifest status is unsupported: ${manifestStatus}`);
  }
  return {
    manifestVersion: 1,
    manifestStatus: manifestStatus as NativeRegionBenchmarkManifestStatus,
    referenceSourceRef: nonEmptyString(input.referenceSourceRef, 'referenceSourceRef'),
    candidateSourceRef: nonEmptyString(input.candidateSourceRef, 'candidateSourceRef'),
    corpusRef: nonEmptyString(input.corpusRef, 'corpusRef'),
    measurementIsolation: nonEmptyString(input.measurementIsolation, 'measurementIsolation'),
    requestedAt: nonEmptyString(input.requestedAt, 'requestedAt'),
  };
}
