import { runNativeLoopCostProtocol } from '../../scripts/measure-native-loop-costs.mjs';
import { createBrowserWorkerGameBridgeDispatch } from '../../scripts/native-loop-browser-worker-dispatch.mjs';
import { createNativeRegionBenchmarkRunSession } from '../../scripts/native-loop-region-benchmark-runners.mjs';
import { BrowserGameRuntime } from '../runtime/browser-games.ts';

type BenchmarkGame = 'STCK' | 'SMLP';

interface BenchmarkConfig {
  manifestVersion: number;
  manifestStatus: string;
  referenceSourceRef: string;
  candidateSourceRef: string;
  corpusRef: string;
  measurementIsolation: string;
  requestedAt: string;
}

async function loadConfig(): Promise<BenchmarkConfig> {
  const response = await fetch('/__lot9b-benchmark-config', { cache: 'no-store' });
  if (!response.ok) throw new Error(`benchmark config returned ${response.status}`);
  const config = await response.json() as BenchmarkConfig;
  if (config.manifestVersion !== 1 || config.manifestStatus !== 'ready-for-official-abba-measurement') {
    throw new Error('official benchmark manifest is not ready');
  }
  for (const [label, value] of [
    ['referenceSourceRef', config.referenceSourceRef],
    ['candidateSourceRef', config.candidateSourceRef],
    ['corpusRef', config.corpusRef],
    ['measurementIsolation', config.measurementIsolation],
  ] as const) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`${label} must be a non-empty string`);
    }
  }
  return config;
}

function verifySamples(result: Awaited<ReturnType<typeof runNativeLoopCostProtocol>>, config: BenchmarkConfig): void {
  for (const series of result.series) {
    const expectedSourceRef = series.variant === 'A'
      ? config.referenceSourceRef
      : config.candidateSourceRef;
    const entries = [series.warmup, ...series.measured];
    for (const entry of entries) {
      const metadata = entry.sample.metadata;
      if (!metadata || metadata.sourceRef !== expectedSourceRef) {
        throw new Error(`${series.series}/${series.game} sourceRef mismatch`);
      }
      if (metadata.corpusRef !== config.corpusRef || metadata.seed !== 0) {
        throw new Error(`${series.series}/${series.game} corpus identity mismatch`);
      }
      if (!Array.isArray(metadata.actions) || metadata.actions.length !== entry.descriptor.actions) {
        throw new Error(`${series.series}/${series.game} action count mismatch`);
      }
      if (metadata.actions.some(action => action.id !== 6)) {
        throw new Error(`${series.series}/${series.game} emitted a non-ACTION6 corpus step`);
      }
    }
  }
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__lot9b-benchmark-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`benchmark report endpoint returned ${response.status}`);
}

async function main(): Promise<void> {
  const status = document.querySelector<HTMLPreElement>('#status');
  const runtime = new BrowserGameRuntime({ requestTimeoutMs: 300_000 });
  const config = await loadConfig();

  try {
    if (status) status.textContent = 'initializing explicit A/B × STCK/SMLP runners';
    const dispatchByGame: Record<BenchmarkGame, ReturnType<typeof createBrowserWorkerGameBridgeDispatch>> = {
      STCK: createBrowserWorkerGameBridgeDispatch({ runtime, game: 'STCK' }),
      SMLP: createBrowserWorkerGameBridgeDispatch({ runtime, game: 'SMLP' }),
    };
    const assembled = createNativeRegionBenchmarkRunSession({
      dispatchByGame,
      referenceSourceRef: config.referenceSourceRef,
      candidateSourceRef: config.candidateSourceRef,
    });

    if (status) status.textContent = 'running A1 → B1 → B2 → A2';
    const startedAt = new Date().toISOString();
    const result = await runNativeLoopCostProtocol(assembled.runSession);
    const finishedAt = new Date().toISOString();
    verifySamples(result, config);

    const report = {
      version: 1,
      kind: 'official-native-region-abba-result',
      config,
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        crossOriginIsolated,
        timeOrigin: performance.timeOrigin,
      },
      startedAt,
      finishedAt,
      result,
      candidateHook: {
        STCK: {
          stats: structuredClone(assembled.hooks.STCK.stats),
          methods: assembled.hooks.STCK.owner.model.size,
        },
        SMLP: {
          stats: structuredClone(assembled.hooks.SMLP.stats),
          methods: assembled.hooks.SMLP.owner.model.size,
        },
      },
    };

    document.body.dataset.status = 'success';
    if (status) status.textContent = `success; accepted=${String(result.accepted)}`;
    await postReport({ status: 'success', report });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    document.body.dataset.status = 'error';
    if (status) status.textContent = message;
    await postReport({ status: 'error', error: message, config });
  } finally {
    runtime.dispose();
  }
}

void main();
