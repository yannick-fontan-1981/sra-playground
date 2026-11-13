import { BrowserGameRuntime, type GameObservation } from '../../src/runtime/browser-games.ts';
import { selectNativeRegionAction6CostAction } from '../../scripts/native-loop-region-action6-corpus.mjs';
import { WORKER_PYODIDE_PARITY_PLAN } from '../../scripts/worker-pyodide-parity-contract.mjs';

type BenchmarkGame = 'STCK' | 'SMLP';
type RegionAction = { id: 6; x: number; y: number };

type ExtendedObservation = GameObservation & {
  gameId?: string;
  backend?: string;
};

function changedPixels(before: number[][], after: number[][]): number {
  let changed = 0;
  for (let y = 0; y < 64; y += 1) {
    const beforeRow = before[y];
    const afterRow = after[y];
    if (!beforeRow || !afterRow) throw new RangeError('parity frames must be 64x64');
    for (let x = 0; x < 64; x += 1) {
      if (beforeRow[x] !== afterRow[x]) changed += 1;
    }
  }
  return changed;
}

async function frameHash(frame: number[][]): Promise<string> {
  if (!Array.isArray(frame) || frame.length !== 64 || frame.some(row => row.length !== 64)) {
    throw new RangeError('parity frame must be 64x64');
  }
  const pixels = Uint8Array.from(frame.flat());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', pixels));
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function publicState(observation: ExtendedObservation) {
  return {
    frameHash: await frameHash(observation.frame),
    availableActionIds: [...observation.availableActionIds],
    state: observation.state,
    level: observation.level,
    levelsCompleted: observation.levelsCompleted,
  };
}

async function runSample(
  runtime: BrowserGameRuntime,
  game: BenchmarkGame,
  actionsRequested: number,
) {
  let observation = await runtime.load(game, 1) as ExtendedObservation;
  const initial = await publicState(observation);
  const steps = [];

  for (let index = 0; index < actionsRequested; index += 1) {
    const action = selectNativeRegionAction6CostAction({
      game,
      observation,
    }) as RegionAction | undefined;
    if (!action || action.id !== 6) {
      throw new Error(`${game} public Region corpus could not select ACTION6 at step ${index + 1}`);
    }
    const before = observation;
    observation = await runtime.action(6, { x: action.x, y: action.y }) as ExtendedObservation;
    const delta = changedPixels(before.frame, observation.frame);
    if (delta <= 0) {
      throw new Error(`${game} Worker/Pyodide ACTION6 produced no public delta at step ${index + 1}`);
    }
    steps.push({
      action: { id: 6, x: action.x, y: action.y },
      changedPixelCount: delta,
      ...(await publicState(observation)),
    });
  }

  return {
    game,
    actionsRequested,
    gameId: String(observation.gameId ?? ''),
    backend: String(observation.backend ?? ''),
    initial,
    steps,
  };
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__lot9b-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`report endpoint returned ${response.status}`);
}

async function main(): Promise<void> {
  const runtime = new BrowserGameRuntime({ requestTimeoutMs: 300_000 });
  const status = document.querySelector<HTMLPreElement>('#status');
  try {
    const samples = [];
    for (const item of WORKER_PYODIDE_PARITY_PLAN) {
      if (status) status.textContent = `running ${item.game}/${item.actions}`;
      samples.push(await runSample(runtime, item.game as BenchmarkGame, item.actions));
    }
    const report = {
      version: 1,
      runtime: 'browser-game-worker-pyodide',
      userAgent: navigator.userAgent,
      samples,
    };
    document.body.dataset.status = 'success';
    if (status) status.textContent = 'success';
    await postReport({ status: 'success', report });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    document.body.dataset.status = 'error';
    if (status) status.textContent = message;
    await postReport({ status: 'error', error: message });
  } finally {
    runtime.dispose();
  }
}

void main();
