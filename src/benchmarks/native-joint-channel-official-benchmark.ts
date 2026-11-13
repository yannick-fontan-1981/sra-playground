import { BrowserGameRuntime } from '../runtime/browser-games.ts';
import { runNativeLoopCostProtocol } from '../../scripts/measure-native-loop-costs.mjs';
import { createBrowserWorkerGameBridgeDispatch } from '../../scripts/native-loop-browser-worker-dispatch.mjs';
import {
  createNativeJointChannelBenchmarkRunSession,
  NATIVE_JOINT_CHANNEL_BENCHMARK_RUNNER_IDENTITIES,
} from '../../scripts/native-loop-joint-channel-benchmark-runners.mjs';

interface SourceProfile {
  sourceRef: string;
  profile: Record<string, unknown>;
}

interface BenchmarkConfig {
  version: 1;
  generatedFromCommit: string | null;
  sourceRefs: {
    version: number;
    commonRoot: string;
    candidateRoot: string;
    reference: SourceProfile;
    candidate: SourceProfile;
    invariants: Record<string, unknown>;
  };
  measurement: {
    isolation: string;
    timingScope: string;
    transport: string;
    corpusRef: string;
  };
}

function status(message: string, state = 'running'): void {
  document.body.dataset.status = state;
  const target = document.querySelector<HTMLElement>('#status');
  if (target) target.textContent = message;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function measuredEntries(result: Awaited<ReturnType<typeof runNativeLoopCostProtocol>>) {
  return result.series.flatMap(series => series.measured.map(entry => ({
    variant: series.variant,
    game: series.game,
    descriptor: entry.descriptor,
    sample: entry.sample,
  })));
}

function verifySampleMetadata(
  result: Awaited<ReturnType<typeof runNativeLoopCostProtocol>>,
  config: BenchmarkConfig,
): void {
  for (const entry of measuredEntries(result)) {
    const metadata = entry.sample.metadata as Record<string, unknown> | undefined;
    assert(metadata, `missing measured metadata for ${entry.variant}/${entry.game}`);
    assert(metadata.corpusRef === config.measurement.corpusRef, 'measured corpusRef mismatch');
    assert(metadata.seed === 0, 'measured seed mismatch');
    assert(metadata.startLevel === 1, 'measured start level mismatch');
    assert(metadata.actionsExecuted === entry.descriptor.actions, 'measured action count mismatch');
    assert(metadata.completedRequestedActions === true, 'measured session did not complete all requested actions');
    assert(
      metadata.sourceRef === (entry.variant === 'A'
        ? config.sourceRefs.reference.sourceRef
        : config.sourceRefs.candidate.sourceRef),
      'measured sourceRef mismatch',
    );
    assert(
      metadata.transport === 'BrowserGameRuntime -> game-worker.ts -> Pyodide -> game_bridge.py -> custom-games.zip',
      'measured transport mismatch',
    );
  }
}

function verifyHookStats(
  hooks: ReturnType<typeof createNativeJointChannelBenchmarkRunSession>['hooks'],
): void {
  const expected = {
    STCK: { actions: 86, sessions: 10 },
    SMLP: { actions: 126, sessions: 10 },
  } as const;
  for (const game of ['STCK', 'SMLP'] as const) {
    const hook = hooks[game];
    assert(hook.stats.actionsSeen === expected[game].actions, `${game} hook action count mismatch`);
    assert(hook.stats.decisions === expected[game].actions, `${game} hook decision count mismatch`);
    assert(hook.stats.acquisitions === expected[game].actions, `${game} hook acquisition count mismatch`);
    assert(hook.stats.completedSessions === expected[game].sessions, `${game} completed session count mismatch`);
    assert(hook.activeSessions === 0, `${game} retained active benchmark session`);
  }
  assert(hooks.STCK.stats.stackCardTargets > 0, 'STCK did not exercise visible stack-card targets');
  assert(hooks.STCK.stats.shopButtonTargets > 0, 'STCK did not exercise visible shop-button targets');
  assert(hooks.SMLP.stats.smlpGateTargets === 126, 'SMLP did not exercise every gate target');
}

async function postReport(report: unknown): Promise<void> {
  const response = await fetch('/__lot9c3-benchmark-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`benchmark report upload failed: ${response.status}`);
}

async function main(): Promise<void> {
  status('Loading source identities and native browser runners...');
  const configResponse = await fetch('/__lot9c3-benchmark-config', { cache: 'no-store' });
  if (!configResponse.ok) throw new Error(`benchmark config failed: ${configResponse.status}`);
  const config = await configResponse.json() as BenchmarkConfig;
  assert(config.version === 1, 'unsupported joint-channel benchmark config');

  const runtimes = {
    STCK: new BrowserGameRuntime({ requestTimeoutMs: 120000 }),
    SMLP: new BrowserGameRuntime({ requestTimeoutMs: 120000 }),
  };
  try {
    const dispatchByGame = {
      STCK: createBrowserWorkerGameBridgeDispatch({ runtime: runtimes.STCK, game: 'STCK' }),
      SMLP: createBrowserWorkerGameBridgeDispatch({ runtime: runtimes.SMLP, game: 'SMLP' }),
    };
    const assembly = createNativeJointChannelBenchmarkRunSession({
      dispatchByGame,
      referenceSourceRef: config.sourceRefs.reference.sourceRef,
      candidateSourceRef: config.sourceRefs.candidate.sourceRef,
    });

    status('Executing A1 → B1 → B2 → A2 on STCK and SMLP...');
    const result = await runNativeLoopCostProtocol(assembly.runSession);
    assert(result.totals.invocations === 40, 'official invocation count mismatch');
    assert(result.totals.warmupSessions === 8, 'official warmup session count mismatch');
    assert(result.totals.measuredSessions === 32, 'official measured session count mismatch');
    assert(result.totals.warmupActions === 24, 'official warmup action count mismatch');
    assert(result.totals.measuredActions === 400, 'official measured action count mismatch');
    verifySampleMetadata(result, config);
    verifyHookStats(assembly.hooks);

    const report = {
      version: 1,
      status: result.accepted ? 'accepted' : 'rejected',
      benchmark: 'lot9c-joint-channels-v1',
      generatedAt: new Date().toISOString(),
      generatedFromCommit: config.generatedFromCommit,
      measurement: config.measurement,
      sourceRefs: config.sourceRefs,
      runnerIdentities: NATIVE_JOINT_CHANNEL_BENCHMARK_RUNNER_IDENTITIES,
      hookStats: {
        STCK: { ...assembly.hooks.STCK.stats, activeSessions: assembly.hooks.STCK.activeSessions },
        SMLP: { ...assembly.hooks.SMLP.stats, activeSessions: assembly.hooks.SMLP.activeSessions },
      },
      userAgent: navigator.userAgent,
      result,
    };
    await postReport(report);
    status(
      `Complete: STCK ${result.games.STCK.relativeIncreasePercent.toFixed(3)}%, `
      + `SMLP ${result.games.SMLP.relativeIncreasePercent.toFixed(3)}%, `
      + `${result.accepted ? 'accepted' : 'rejected'}.`,
      result.accepted ? 'accepted' : 'rejected',
    );
  } finally {
    runtimes.STCK.dispose();
    runtimes.SMLP.dispose();
  }
}

main().catch(async error => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  status(message, 'error');
  try {
    await postReport({
      version: 1,
      status: 'error',
      benchmark: 'lot9c-joint-channels-v1',
      error: message,
    });
  } catch {
    // The orchestrator also observes the page status when report upload fails.
  }
});
