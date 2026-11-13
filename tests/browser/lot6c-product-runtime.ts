import type { GameObservation, GameRuntimeRequest } from '../../src/runtime/browser-games.ts';

type WorkerEnvelope = { id: number; request: GameRuntimeRequest };
type WorkerRecord = {
  scriptUrl: string;
  options: { type?: string; name?: string };
};

const RESPONSE_DELAY_MS = 35;
const PALETTE = [
  '#000000', '#112233', '#445566', '#778899',
  '#101010', '#202020', '#303030', '#404040',
  '#505050', '#606060', '#707070', '#808080',
  '#909090', '#A0A0A0', '#B0B0B0', '#C0C0C0',
];
const EXPECTED_PIXELS = {
  initial: [17, 34, 51, 255],
  simple: [68, 85, 102, 255],
  terminal: [119, 136, 153, 255],
} as const;

const workerRecords: WorkerRecord[] = [];
const requests: GameRuntimeRequest[] = [];
let terminatedCount = 0;
let activeGameCode = 'CASC';

function makeFrame(color: number): number[][] {
  return Array.from({ length: 64 }, () => Array<number>(64).fill(color));
}

function makeObservation(
  color: number,
  state: string,
  options: {
    frames?: number[][][];
    canUndo?: boolean;
    levelsCompleted?: number;
  } = {},
): GameObservation {
  const frame = makeFrame(color);
  return {
    gameCode: activeGameCode,
    frame,
    frames: options.frames ?? [],
    frameDurationsMs: options.frames?.map(() => 0),
    state,
    availableActionIds: [1, 6],
    canUndo: options.canUndo ?? false,
    canSelectLevel: true,
    level: 1,
    levelCount: 2,
    levelsCompleted: options.levelsCompleted ?? 0,
    defaultFps: 60,
    palette: PALETTE,
  };
}

function cloneRequest(request: GameRuntimeRequest): GameRuntimeRequest {
  return JSON.parse(JSON.stringify(request)) as GameRuntimeRequest;
}

class SyntheticWorker extends EventTarget {
  #terminated = false;

  constructor(scriptUrl: string | URL, options: WorkerOptions = {}) {
    super();
    workerRecords.push({
      scriptUrl: String(scriptUrl),
      options: { type: options.type, name: options.name },
    });
  }

  postMessage(message: unknown): void {
    const envelope = message as WorkerEnvelope;
    requests.push(cloneRequest(envelope.request));
    window.setTimeout(() => {
      if (this.#terminated) return;
      try {
        let result: GameObservation;
        if (envelope.request.type === 'load') {
          activeGameCode = envelope.request.code;
          result = makeObservation(1, 'NOT_FINISHED');
        } else if (envelope.request.type === 'action' && envelope.request.actionId === 1) {
          result = makeObservation(2, 'NOT_FINISHED', {
            frames: [makeFrame(2)],
            canUndo: true,
          });
        } else if (envelope.request.type === 'action' && envelope.request.actionId === 6) {
          result = makeObservation(3, 'WIN', {
            frames: [makeFrame(2), makeFrame(3)],
            canUndo: true,
            levelsCompleted: 1,
          });
        } else {
          result = makeObservation(1, 'NOT_FINISHED');
        }
        this.dispatchEvent(new MessageEvent('message', {
          data: { id: envelope.id, result },
        }));
      } catch (error) {
        this.dispatchEvent(new MessageEvent('message', {
          data: {
            id: envelope.id,
            error: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    }, RESPONSE_DELAY_MS);
  }

  terminate(): void {
    if (this.#terminated) return;
    this.#terminated = true;
    terminatedCount += 1;
  }
}

Object.defineProperty(globalThis, 'Worker', {
  configurable: true,
  writable: true,
  value: SyntheticWorker,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitFor(
  description: string,
  predicate: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(`Timed out waiting for ${description}`);
    await delay(10);
  }
}

function canvasPixel(canvas: HTMLCanvasElement): number[] {
  const context = canvas.getContext('2d');
  assert(context, 'canvas 2D context is unavailable');
  return Array.from(context.getImageData(0, 0, 1, 1).data);
}

function isBusy(canvas: HTMLCanvasElement): boolean {
  return canvas.getAttribute('aria-busy') === 'true';
}

function pixelMatches(canvas: HTMLCanvasElement, expected: readonly number[]): boolean {
  const actual = canvasPixel(canvas);
  return expected.every((value, index) => actual[index] === value);
}

async function postReport(payload: unknown): Promise<void> {
  const response = await fetch('/__lot6c-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`report endpoint returned ${response.status}`);
}

async function main(): Promise<void> {
  const status = document.querySelector<HTMLPreElement>('#lot6c-status');
  try {
    await import('../../src/main.ts');

    const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
    const simpleButton = document.querySelector<HTMLButtonElement>('button[data-action="1"]');
    const feedback = document.querySelector<HTMLElement>('#game-feedback');
    const runtimeOverlay = document.querySelector<HTMLElement>('#runtime-overlay');
    const winOverlay = document.querySelector<HTMLElement>('#win-overlay');
    const winTitle = document.querySelector<HTMLElement>('#win-title');
    assert(canvas, 'main.ts did not create the game canvas');
    assert(simpleButton, 'main.ts did not create the simple action button');
    assert(feedback && runtimeOverlay && winOverlay && winTitle, 'main.ts product DOM is incomplete');

    await waitFor('initial load presentation', () => (
      requests.length >= 1
      && !isBusy(canvas)
      && runtimeOverlay.hidden
      && !simpleButton.disabled
      && pixelMatches(canvas, EXPECTED_PIXELS.initial)
      && new URL(window.location.href).searchParams.get('level') === '1'
    ));

    const initialUrl = new URL(window.location.href);
    const initial = {
      urlGame: initialUrl.searchParams.get('game'),
      urlLevel: initialUrl.searchParams.get('level'),
      canvasPixel: canvasPixel(canvas),
      busy: isBusy(canvas),
      feedback: feedback.textContent ?? '',
      runtimeOverlayHidden: runtimeOverlay.hidden,
    };

    simpleButton.click();
    const simpleBusyDuring = isBusy(canvas);
    await waitFor('simple action presentation', () => (
      requests.length >= 2
      && !isBusy(canvas)
      && pixelMatches(canvas, EXPECTED_PIXELS.simple)
    ));
    const afterSimple = {
      busyDuring: simpleBusyDuring,
      busyAfter: isBusy(canvas),
      canvasPixel: canvasPixel(canvas),
      feedback: feedback.textContent ?? '',
    };

    const rect = canvas.getBoundingClientRect();
    assert(rect.width > 0 && rect.height > 0, 'the compiled browser canvas has no layout size');
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + rect.width * 0.25,
      clientY: rect.top + rect.height * 0.75,
      view: window,
    });
    const expectedPoint = {
      x: Math.max(0, Math.min(canvas.width - 1, Math.floor(((clickEvent.clientX - rect.left) / rect.width) * canvas.width))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.floor(((clickEvent.clientY - rect.top) / rect.height) * canvas.height))),
    };
    canvas.dispatchEvent(clickEvent);
    const action6BusyDuring = isBusy(canvas);
    await waitFor('ACTION6 terminal presentation', () => (
      requests.length >= 3
      && !isBusy(canvas)
      && pixelMatches(canvas, EXPECTED_PIXELS.terminal)
      && feedback.textContent === 'Level 1 complete.'
      && !winOverlay.hidden
    ));
    const afterAction6 = {
      expectedPoint,
      busyDuring: action6BusyDuring,
      busyAfter: isBusy(canvas),
      canvasPixel: canvasPixel(canvas),
      feedback: feedback.textContent ?? '',
      winOverlayVisible: !winOverlay.hidden,
      winTitle: winTitle.textContent ?? '',
    };

    const report = {
      version: 1,
      runtime: 'vite-main-synthetic-worker',
      userAgent: navigator.userAgent,
      worker: {
        instances: workerRecords.length,
        scriptUrl: workerRecords[0]?.scriptUrl ?? '',
        options: workerRecords[0]?.options ?? {},
        terminatedCount,
        requests,
      },
      initial,
      afterSimple,
      afterAction6,
    };

    document.body.dataset.status = 'success';
    if (status) status.textContent = 'success';
    await postReport({ status: 'success', report });
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    document.body.dataset.status = 'error';
    if (status) status.textContent = message;
    await postReport({ status: 'error', error: message });
  }
}

void main();
