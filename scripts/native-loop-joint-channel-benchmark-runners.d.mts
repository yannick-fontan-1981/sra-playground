import type {
  NativeLoopDescriptor,
  NativeLoopSample,
} from './measure-native-loop-costs.mjs';
import type {
  BrowserWorkerBenchmarkRequest,
} from './native-loop-browser-worker-dispatch.mjs';

export interface JointChannelHookStats {
  actionsSeen: number;
  decisions: number;
  acquisitions: number;
  completedSessions: number;
  stackCardTargets: number;
  shopButtonTargets: number;
  smlpGateTargets: number;
}

export interface JointChannelBenchmarkHook {
  stats: JointChannelHookStats;
  readonly activeSessions: number;
}

export interface NativeJointChannelBenchmarkAssembly {
  runSession(descriptor: NativeLoopDescriptor): Promise<NativeLoopSample>;
  runners: unknown;
  hooks: {
    STCK: JointChannelBenchmarkHook;
    SMLP: JointChannelBenchmarkHook;
  };
}

export function createNativeJointChannelBenchmarkRunSession(options: {
  dispatchByGame: {
    STCK: (request: BrowserWorkerBenchmarkRequest) => Promise<unknown>;
    SMLP: (request: BrowserWorkerBenchmarkRequest) => Promise<unknown>;
  };
  referenceSourceRef: string;
  candidateSourceRef: string;
}): NativeJointChannelBenchmarkAssembly;

export const NATIVE_JOINT_CHANNEL_BENCHMARK_RUNNER_IDENTITIES: Readonly<Record<string, unknown>>;
