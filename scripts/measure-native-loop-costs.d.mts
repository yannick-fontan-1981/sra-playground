export interface NativeLoopDescriptor {
  invocationIndex: number;
  series: 'A1' | 'B1' | 'B2' | 'A2';
  variant: 'A' | 'B';
  game: 'STCK' | 'SMLP';
  kind: 'warmup' | 'measured';
  sessionIndex: number;
  actions: number;
}

export interface NativeLoopAction {
  id: number;
  x?: number;
  y?: number;
}

export interface NativeLoopSample {
  durationMs: number;
  phases: Record<string, number>;
  metadata?: {
    runnerKind?: string;
    runnerRef?: string;
    sourceRef?: string;
    corpusRef?: string;
    seed?: number;
    timingScope?: string;
    actions?: NativeLoopAction[];
    [key: string]: unknown;
  };
}

export interface NativeLoopEntry {
  descriptor: NativeLoopDescriptor;
  sample: NativeLoopSample;
}

export interface NativeLoopSeriesResult {
  series: NativeLoopDescriptor['series'];
  variant: NativeLoopDescriptor['variant'];
  game: NativeLoopDescriptor['game'];
  warmup: NativeLoopEntry;
  measured: NativeLoopEntry[];
}

export interface NativeLoopGameResult {
  baselineMeasuredSessions: number;
  candidateMeasuredSessions: number;
  baselineMedianMs: number;
  candidateMedianMs: number;
  relativeIncreasePercent: number;
  globalAccepted: boolean;
  phases: Record<string, unknown>;
  phaseOverruns: Record<string, unknown>;
}

export interface NativeLoopCostResult {
  protocol: unknown;
  totals: {
    invocations: number;
    warmupSessions: number;
    measuredSessions: number;
    warmupActions: number;
    measuredActions: number;
  };
  series: NativeLoopSeriesResult[];
  games: {
    STCK: NativeLoopGameResult;
    SMLP: NativeLoopGameResult;
  };
  accepted: boolean;
}

export function runNativeLoopCostProtocol(
  runSession: (descriptor: NativeLoopDescriptor) => Promise<NativeLoopSample>,
): Promise<NativeLoopCostResult>;
