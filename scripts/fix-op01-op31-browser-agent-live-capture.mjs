import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/runtime/v6-browser-agent-controller.ts';
const source = await readFile(path, 'utf8');
const before = '      if (hasPendingDispatch) this.#activePendingCounted = true;\n';
const occurrences = source.split(before).length - 1;
if (occurrences !== 1) {
  throw new Error(`expected one live-capture mutation, found ${occurrences}`);
}
await writeFile(path, source.replace(before, ''));
console.log('Made active browser Agent checkpoint capture idempotent.');
