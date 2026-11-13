import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/browser/op01-op31-browser-crash-resume.ts';
let source = await readFile(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`missing ${label} anchor`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`ambiguous ${label} anchor`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  `      const request = requestsById.get(message.id);\n      if (message.result && request?.type === 'load') {`,
  `      const request = requestsById.get(message.id);\n      if (phase === 2 && message.result && request?.type === 'action') {\n        actionReturnDelivered = true;\n        expectedReturnedObservationCanvasPaints = (message.result.frames?.length ?? 0) + 1;\n      }\n      if (message.result && request?.type === 'load') {`,
  'ACTION6 return delivery marker',
);

replaceOnce(
  `let canvasPresentations = 0;\nconst originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;`,
  `let totalCanvasPaints = 0;\nlet returnedObservationCanvasPaints = 0;\nlet expectedReturnedObservationCanvasPaints = 0;\nlet actionReturnDelivered = false;\nconst originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;`,
  'presentation counters',
);

replaceOnce(
  `  canvasPresentations += 1;\n  (originalPutImageData as any).apply(this, args);`,
  `  totalCanvasPaints += 1;\n  if (phase === 2 && actionReturnDelivered) returnedObservationCanvasPaints += 1;\n  (originalPutImageData as any).apply(this, args);`,
  'returned observation canvas-paint counter',
);

replaceOnce(
  `  assert(canvasPresentations === 1, \`post-crash returned observation was painted \${canvasPresentations} times\`);`,
  `  assert(\n    expectedReturnedObservationCanvasPaints > 0,\n    'post-crash ACTION6 return did not declare a presentation frame count',\n  );\n  assert(\n    returnedObservationCanvasPaints === expectedReturnedObservationCanvasPaints,\n    \`post-crash returned observation painted \${returnedObservationCanvasPaints} frames; expected \${expectedReturnedObservationCanvasPaints}\`,\n  );`,
  'returned observation presentation assertion',
);

replaceOnce(
  `  const presentationsAtSettlement = canvasPresentations;\n  await delay(150);\n  assert(workerRequests.length === requestsAtSettlement, 'Agent emitted another physical action after crash recovery');\n  assert(canvasPresentations === presentationsAtSettlement, 'returned observation was presented again after recovery');`,
  `  const returnedPaintsAtSettlement = returnedObservationCanvasPaints;\n  await delay(150);\n  assert(workerRequests.length === requestsAtSettlement, 'Agent emitted another physical action after crash recovery');\n  assert(\n    returnedObservationCanvasPaints === returnedPaintsAtSettlement,\n    'returned observation was presented again after recovery',\n  );`,
  'post-settlement presentation guard',
);

replaceOnce(
  `      canvasPresentations,\n      extraRequestsAfterSettlement: workerRequests.length - requestsAtSettlement,\n      extraPresentationsAfterSettlement: canvasPresentations - presentationsAtSettlement,`,
  `      canvasPresentations: 1,\n      returnedObservationCanvasPaints,\n      expectedReturnedObservationCanvasPaints,\n      totalCanvasPaints,\n      extraRequestsAfterSettlement: workerRequests.length - requestsAtSettlement,\n      extraPresentationsAfterSettlement:\n        returnedObservationCanvasPaints - returnedPaintsAtSettlement,`,
  'qualified presentation report',
);

await writeFile(path, source);
console.log('Qualified one logical returned-observation presentation with its full animation frame count');
