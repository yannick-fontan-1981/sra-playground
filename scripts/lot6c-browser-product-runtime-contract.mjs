import assert from 'node:assert/strict';

const INITIAL_PIXEL = [17, 34, 51, 255];
const SIMPLE_PIXEL = [68, 85, 102, 255];
const TERMINAL_PIXEL = [119, 136, 153, 255];

function requestAt(report, index) {
  const request = report?.worker?.requests?.[index];
  assert.ok(request, `missing Worker request #${index + 1}`);
  return request;
}

export function assertLot6cBrowserProductRuntimeReport(report) {
  assert.equal(report?.version, 1, 'unexpected browser report version');
  assert.equal(report?.runtime, 'vite-main-synthetic-worker', 'unexpected browser runtime identity');
  assert.equal(report?.worker?.instances, 1, 'main.ts must own exactly one game Worker');
  assert.equal(report?.worker?.terminatedCount, 0, 'the live Worker must not terminate before the report');
  assert.match(report?.worker?.scriptUrl ?? '', /\/src\/runtime\/game-worker\.ts(?:\?|$)/, 'wrong Worker module URL');
  assert.deepEqual(report?.worker?.options, { type: 'module', name: 'sra-games' }, 'wrong Worker constructor options');

  assert.deepEqual(requestAt(report, 0), { type: 'load', code: 'CASC' }, 'initial game load request drifted');
  assert.deepEqual(requestAt(report, 1), { type: 'action', actionId: 1 }, 'simple action request drifted');
  assert.deepEqual(requestAt(report, 2), {
    type: 'action',
    actionId: 6,
    data: report.afterAction6.expectedPoint,
  }, 'ACTION6 request did not preserve browser canvas coordinates');
  assert.equal(report.worker.requests.length, 3, 'unexpected extra Worker requests');

  assert.equal(report?.initial?.urlGame, 'CASC', 'initial URL game was not synchronized');
  assert.equal(report?.initial?.urlLevel, '1', 'initial URL level was not synchronized');
  assert.deepEqual(report?.initial?.canvasPixel, INITIAL_PIXEL, 'initial canvas frame was not painted');
  assert.equal(report?.initial?.busy, false, 'initial presentation left busy set');
  assert.equal(report?.initial?.feedback, '', 'initial presentation emitted terminal feedback');
  assert.equal(report?.initial?.runtimeOverlayHidden, true, 'runtime overlay remained visible after load');

  assert.equal(report?.afterSimple?.busyDuring, true, 'simple dispatch did not acquire busy');
  assert.equal(report?.afterSimple?.busyAfter, false, 'simple dispatch did not release busy');
  assert.deepEqual(report?.afterSimple?.canvasPixel, SIMPLE_PIXEL, 'simple action frame was not painted');
  assert.equal(report?.afterSimple?.feedback, '', 'simple action emitted terminal feedback');

  assert.equal(report?.afterAction6?.busyDuring, true, 'ACTION6 dispatch did not acquire busy');
  assert.equal(report?.afterAction6?.busyAfter, false, 'ACTION6 dispatch did not release busy');
  assert.deepEqual(report?.afterAction6?.canvasPixel, TERMINAL_PIXEL, 'terminal ACTION6 frame was not painted');
  assert.equal(report?.afterAction6?.feedback, 'Level 1 complete.', 'terminal feedback drifted');
  assert.equal(report?.afterAction6?.winOverlayVisible, true, 'terminal overlay was not shown');
  assert.equal(report?.afterAction6?.winTitle, 'Level complete', 'terminal overlay title drifted');

  return {
    workerRequestsQualified: 3,
    busyTransitionsQualified: 2,
    canvasStatesQualified: 3,
    urlAndFeedbackQualified: true,
  };
}
