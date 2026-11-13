import type {
  NativeLoopDescriptor,
  NativeLoopSample,
} from './measure-native-loop-costs.mjs';

export interface RegionHookStats {
  actionsSeen: number;
  action6Seen: number;
  usefulAction6Evidence: number;
  boundEvidence: number;
  acquisitions: number;
}

export interface RegionBenchmarkHook {
  stats: RegionHookStats;
  owner: {
    model: {
      readonly size: number;
    };
  };
}

export interface NativeRegionBenchmarkAssembly {
  runSession(descriptor: NativeLoopDescriptor): Promise<NativeLoopSample>;
  runners: unknown;
  hooks: {
    STCK: RegionBenchmarkHook;
    SMLP: RegionBenchmarkHook;
  };
}

export function nativeRegionBenchmarkMethodRef(input: {
  index: number;
  descriptor: NativeLoopDescriptor;
}): string;

export function createNativeRegionBenchmarkRunSession(options: {
  dispatchByGame: {
    STCK: (request: unknown) => Promise<unknown>;
    SMLP: (request: unknown) => Promise<unknown>;
  };
  referenceSourceRef: string;
  candidateSourceRef: string;
}): NativeRegionBenchmarkAssembly;

export const NATIVE_REGION_BENCHMARK_RUNNER_IDENTITIES: Readonly<Record<string, unknown>>;
