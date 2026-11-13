import assert from 'node:assert/strict';
import test from 'node:test';

import { assertLot6cBrowserProductRuntimeReport } from '../scripts/lot6c-browser-product-runtime-contract.mjs';

function validReport() {
  const point = { x: 16, y: 48 };
  return {
    version: 1,
    runtime: 'vite-main-synthetic-worker',
    worker: {
      instances: 1,
      scriptUrl: 'http://127.0.0.1:4174/src/runtime/game-worker.ts',
      options: { type: 'module', name: 'sra-games' },
      terminatedCount: 0,
      requests: [
        { type: 'load', code: 'CASC' },
        { type: 'action', actionId: 1 },
        { type: 'action', actionId: 6, data: point },
      ],
    },
    initial: {
      urlGame: 'CASC',
      urlLevel: '1',
      canvasPixel: [17, 34, 51, 255],
      busy: false,
      feedback: '',
      runtimeOverlayHidden: true,
    },
    afterSimple: {
      busyDuring: true,
      busyAfter: false,
      canvasPixel: [68, 85, 102, 255],
      feedback: '',
    },
    afterAction6: {
      expectedPoint: point,
      busyDuring: true,
      busyAfter: false,
      canvasPixel: [119, 136, 153, 255],
      feedback: 'Level 1 complete.',
      winOverlayVisible: true,
      winTitle: 'Level complete',
    },
  };
}

test('accepts the complete compiled-browser product path', () => {
  assert.deepEqual(assertLot6cBrowserProductRuntimeReport(validReport()), {
    workerRequestsQualified: 3,
    busyTransitionsQualified: 2,
    canvasStatesQualified: 3,
    urlAndFeedbackQualified: true,
  });
});

test('rejects a simple action that does not acquire busy', () => {
  const report = validReport();
  report.afterSimple.busyDuring = false;
  assert.throws(() => assertLot6cBrowserProductRuntimeReport(report), /simple dispatch did not acquire busy/);
});

test('rejects ACTION6 coordinate loss', () => {
  const report = validReport();
  report.worker.requests[2].data = { x: 0, y: 0 };
  assert.throws(() => assertLot6cBrowserProductRuntimeReport(report), /ACTION6 request did not preserve/);
});

test('rejects a canvas paint regression', () => {
  const report = validReport();
  report.afterAction6.canvasPixel = [0, 0, 0, 255];
  assert.throws(() => assertLot6cBrowserProductRuntimeReport(report), /terminal ACTION6 frame was not painted/);
});

test('rejects terminal feedback drift', () => {
  const report = validReport();
  report.afterAction6.feedback = '';
  assert.throws(() => assertLot6cBrowserProductRuntimeReport(report), /terminal feedback drifted/);
});
