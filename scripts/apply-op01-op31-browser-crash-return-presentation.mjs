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
  `      const request = requestsById.get(message.id);\n      if (phase === 2 && message.result && request?.type === 'action') {\n        actionReturnDelivered = true;\n      }\n      if (message.result && request?.type === 'load') {`,
  'ACTION6 return delivery marker',
);

replaceOnce(
  `let canvasPresentations = 0;\nconst originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;`,
  `let canvasPresentations = 0;\nlet returnedObservationPresentations = 0;\nlet actionReturnDelivered = false;\nconst originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;`,
  'presentation counters',
);

replaceOnce(
  `  canvasPresentations += 1;\n  (originalPutImageData as any).apply(this, args);`,
  `  canvasPresentations += 1;\n  if (phase === 2 && actionReturnDelivered) returnedObservationPresentations += 1;\n  (originalPutImageData as any).apply(this, args);`,
  'returned observation presentation counter',
);

replaceOnce(
  `  assert(canvasPresentations === 1, \`post-crash returned observation was painted \${canvasPresentations} times\`);`,
  `  assert(\n    returnedObservationPresentations === 1,\n    \`post-crash returned observation was painted \${returnedObservationPresentations} times\`,\n  );`,
  'returned observation assertion',
);

replaceOnce(
  `  const presentationsAtSettlement = canvasPresentations;\n  await delay(150);\n  assert(workerRequests.length === requestsAtSettlement, 'Agent emitted another physical action after crash recovery');\n  assert(canvasPresentations === presentationsAtSettlement, 'returned observation was presented again after recovery');`,
  `  const presentationsAtSettlement = returnedObservationPresentations;\n  await delay(150);\n  assert(workerRequests.length === requestsAtSettlement, 'Agent emitted another physical action after crash recovery');\n  assert(\n    returnedObservationPresentations === presentationsAtSettlement,\n    'returned observation was presented again after recovery',\n  );`,
  'post-settlement presentation guard',
);

replaceOnce(
  `      canvasPresentations,\n      extraRequestsAfterSettlement: workerRequests.length - requestsAtSettlement,\n      extraPresentationsAfterSettlement: canvasPresentations - presentationsAtSettlement,`,
  `      canvasPresentations: returnedObservationPresentations,\n      totalCanvasPaints: canvasPresentations,\n      extraRequestsAfterSettlement: workerRequests.length - requestsAtSettlement,\n      extraPresentationsAfterSettlement:\n        returnedObservationPresentations - presentationsAtSettlement,`,
  'qualified presentation report',
);

await writeFile(path, source);
console.log('Measured the returned ACTION6 observation separately from initial paints');
