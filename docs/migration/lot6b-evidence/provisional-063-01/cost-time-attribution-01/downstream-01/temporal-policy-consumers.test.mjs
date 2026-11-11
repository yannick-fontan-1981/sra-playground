import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateCommonValueAttribution } from '../../../consolidate-owner-costs.mjs';

const corpus = JSON.parse(await readFile(new URL('./synthetic-policy-cases.json', import.meta.url), 'utf8'));
function modified(scenario) {
  const data = structuredClone(corpus.base);
  for (const edit of scenario.edits) {
    let target = data; const path = edit.path;
    for (const key of edit.op === 'append' ? path : path.slice(0, -1)) target = target[key];
    if (edit.op === 'set') target[path.at(-1)] = structuredClone(edit.value);
    else if (edit.op === 'remove') {
      if (Array.isArray(target)) target.splice(path.at(-1), 1); else delete target[path.at(-1)];
    } else if (edit.op === 'append') target.push(structuredClone(edit.value));
    else throw new Error('Unknown test edit');
  }
  return data;
}
for (const scenario of corpus.cases) test(scenario.name, () => {
  const data = modified(scenario), retained = structuredClone(data);
  const operation = () => validateCommonValueAttribution(data.attribution, data.receipts, data.fixture);
  if (scenario.accept) assert.equal(operation(), true); else assert.throws(operation);
  assert.deepEqual(data, retained, 'Validator must not normalize or change its evidence');
});
