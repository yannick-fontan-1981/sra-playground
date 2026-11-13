import { BrowserGameRuntime } from '../runtime/browser-games.ts';
import { runNativeLoopCostProtocol } from '../../scripts/measure-native-loop-costs.mjs';
import { createBrowserWorkerGameBridgeDispatch } from '../../scripts/native-loop-browser-worker-dispatch.mjs';
import {
  createOfficialJointChannelBenchmarkRunSession,
  LOT9C4_CORPUS,
  LOT9C4_RUNNER_IDENTITIES,
  LOT9C4_TIMING_SCOPE,
} from '../../scripts/native-loop-joint-channel-official-runners.mjs';

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
    transport: string;
    corpusRef: string;
    timingScope: Record<'STCK' | 'SMLP', string>;
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

function protocolEntries(result: Awaited<ReturnType<typeof runNativeLoopCostProtocol>>) {
  return result.series.flatMap(series => [
    {
      variant: series.variant,
      game: series.game,
      descriptor: series.warmup.descriptor,
      sample: series.warmup.sample,
    },
    ...series.measured.map(entry => ({
      variant: series.variant,
      game: series.game,
      descriptor: entry.descriptor,
      sample: entry.sample,
    })),
  ]);
}

function verifySampleMetadata(
  result: Awaited<ReturnType<typeof runNativeLoopCostProtocol>>,
  config: BenchmarkConfig,
): void {
  for (const entry of protocolEntries(result)) {
    const metadata = entry.sample.metadata as Record<string, unknown> | undefined;
    assert(metadata, `missing metadata for ${entry.variant}/${entry.game}`);
    assert(metadata.corpusRef === config.measurement.corpusRef, 'corpusRef mismatch');
    assert(metadata.seed === 0, 'seed mismatch');
    assert(metadata.startLevel === 1, 'start level mismatch');
    assert(metadata.actionsExecuted === entry.descriptor.actions, 'target action count mismatch');
    assert(metadata.completedRequestedActions === true, 'runner did not complete requested target actions');
    assert(
      metadata.sourceRef === (entry.variant === 'A'
        ? config.sourceRefs.reference.sourceRef
        : config.sourceRefs.candidate.sourceRef),
      'sourceRef mismatch',
    );
    assert(metadata.transport === config.measurement.transport, 'transport mismatch');
    assert(
      metadata.timingScope === config.measurement.timingScope[entry.game as 'STCK' | 'SMLP'],
      'timing scope mismatch',
    );
    const excluded = metadata.excludedSetup as Record<string, unknown> | undefined;
    assert(excluded, 'excluded setup metadata missing');
    if (entry.game === 'STCK') {
      assert(
        excluded.actionCount === entry.descriptor.actions * 3,
        'STCK excluded prelude action count mismatch',
      );
      assert(excluded.freshNativeSessions === entry.descriptor.actions, 'STCK fresh session count mismatch');
    } else {
      assert(excluded.actionCount === 0, 'SMLP must not exclude setup actions');
      assert(excluded.freshNativeSessions === 1, 'SMLP session count mismatch');
    }
  }
}

function verifyStats(
  stats: ReturnType<typeof createOfficialJointChannelBenchmarkRunSession>['stats'],
): void {
  assert(stats.STCK.decisions === 86, 'STCK decision count mismatch');
  assert(stats.STCK.acquisitions === 86, 'STCK acquisition count mismatch');
  assert(stats.STCK.targetCycles === 86, 'STCK target-cycle count mismatch');
  assert(stats.STCK.excludedPreludeActions === 258, 'STCK excluded prelude count mismatch');
  assert(stats.STCK.completedProtocolSessions === 10, 'STCK protocol session count mismatch');

  assert(stats.SMLP.decisions === 126, 'SMLP decision count mismatch');
  assert(stats.SMLP.acquisitions === 126, 'SMLP acquisition count mismatch');
  assert(stats.SMLP.targetCycles === 126, 'SMLP target-cycle count mismatch');
  assert(stats.SMLP.excludedPreludeActions === 0, 'SMLP excluded prelude count mismatch');
  assert(stats.SMLP.completedProtocolSessions === 10, 'SMLP protocol session count mismatch');
}

async function postReport(report: unknown): Promise<void> {
  const response = await fetch('/__lot9c4-benchmark-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(report),
  });
  if (!response.ok) throw new Error(`Lot 9C4 report upload failed: ${response.status}`);
}

async function main(): Promise<void> {
  status('Loading strict source identities and native browser runners...');
  const configResponse = await fetch('/__lot9c4-benchmark-config', { cache: 'no-store' });
  if (!configResponse.ok) throw new Error(`Lot 9C4 config failed: ${configResponse.status}`);
  const config = await configResponse.json() as BenchmarkConfig;
  assert(config.version === 1, 'unsupported Lot 9C4 benchmark config');

  const runtimes = {
    STCK: new BrowserGameRuntime({ requestTimeoutMs: 120000 }),
    SMLP: new BrowserGameRuntime({ requestTimeoutMs: 120000 }),
  };
  try {
    const assembly = createOfficialJointChannelBenchmarkRunSession({
      dispatchByGame: {
        STCK: createBrowserWorkerGameBridgeDispatch({ runtime: runtimes.STCK, game: 'STCK' }),
        SMLP: createBrowserWorkerGameBridgeDispatch({ runtime: runtimes.SMLP, game: 'SMLP' }),
      },
      referenceSourceRef: config.sourceRefs.reference.sourceRef,
      candidateSourceRef: config.sourceRefs.candidate.sourceRef,
    });

    status('Executing strict A1 → B1 → B2 → A2 on STCK and SMLP...');
    const result = await runNativeLoopCostProtocol(assembly.runSession);
    assert(result.totals.invocations === 40, 'official invocation count mismatch');
    assert(result.totals.warmupSessions === 8, 'official warmup session count mismatch');
    assert(result.totals.measuredSessions === 32, 'official measured session count mismatch');
    assert(result.totals.warmupActions === 24, 'official warmup target-action count mismatch');
    assert(result.totals.measuredActions === 400, 'official measured target-action count mismatch');
    verifySampleMetadata(result, config);
    verifyStats(assembly.stats);

    const report = {
      version: 1,
      status: result.accepted ? 'accepted' : 'rejected',
      benchmark: 'lot9c4-strict-joint-channels-v1',
      generatedAt: new Date().toISOString(),
      generatedFromCommit: config.generatedFromCommit,
      measurement: config.measurement,
      sourceRefs: config.sourceRefs,
      corpus: LOT9C4_CORPUS,
      timingScope: LOT9C4_TIMING_SCOPE,
      runnerIdentities: LOT9C4_RUNNER_IDENTITIES,
      stats: assembly.stats,
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
      benchmark: 'lot9c4-strict-joint-channels-v1',
      error: message,
    });
  } catch {
    // The orchestrator also observes the page state when report upload fails.
  }
});
