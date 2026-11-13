import type {
  NativeLoopDescriptor,
  NativeLoopSample,
} from './measure-native-loop-costs.mjs';
import type {
  BrowserWorkerBenchmarkRequest,
} from './native-loop-browser-worker-dispatch.mjs';

export interface Lot9c4GameStats {
  decisions: number;
  acquisitions: number;
  targetCycles: number;
  excludedPreludeActions: number;
  completedProtocolSessions: number;
}

export interface Lot9c4BenchmarkAssembly {
  runSession(descriptor: NativeLoopDescriptor): Promise<NativeLoopSample>;
  runners: unknown;
  stats: {
    STCK: Lot9c4GameStats;
    SMLP: Lot9c4GameStats;
  };
}

export function createOfficialJointChannelBenchmarkRunSession(options: {
  dispatchByGame: {
    STCK: (request: BrowserWorkerBenchmarkRequest) => Promise<unknown>;
    SMLP: (request: BrowserWorkerBenchmarkRequest) => Promise<unknown>;
  };
  referenceSourceRef: string;
  candidateSourceRef: string;
}): Lot9c4BenchmarkAssembly;

export const LOT9C4_CORPUS: Readonly<Record<string, unknown>>;
export const LOT9C4_TIMING_SCOPE: Readonly<Record<'STCK' | 'SMLP', string>>;
export const LOT9C4_RUNNER_IDENTITIES: Readonly<Record<string, unknown>>;
