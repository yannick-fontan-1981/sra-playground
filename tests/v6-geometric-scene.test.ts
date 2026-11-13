import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { compactComponents, framedPatterns, matchingGeometricRules, alignmentScene, movedBody, geometricGridPaths } from '../src/logos-engine/v6-geometric-scene.ts';
import { detectV5Components } from '../src/logos-engine/v6-native-observer.ts';
import { enumerateComponentMatches } from '../src/logos-engine/v6-component-matches.ts';
import { targetMethodAtBoundary, recalledDirections } from '../src/logos-engine/v6-target-method.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-geometry-reference.json', import.meta.url), 'utf8'));
test('geometry comparisons identify the unchanged reference files', async () => {
  for (const [name, hash] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${name}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  }
  assert.equal(fixture.cases.filter((c: any) => c.operation === 'alignment' && c.expected).length, 3);
});
for (const item of fixture.cases) test(`geometry reference ${item.operation}/${item.id}`, async () => {
  const a = item.args;
  const run = async () => {
    if (item.operation === 'compact') return compactComponents(a[0]);
    if (item.operation === 'patterns') return framedPatterns(a[0], a[1], a[2]);
    if (item.operation === 'alignment') return alignmentScene(a[0], a[1], a[2]);
    if (item.operation === 'rules') return matchingGeometricRules(a[0], a[1]);
    if (item.operation === 'moved') return movedBody(a[0], a[1], a[2]);
    if (item.operation === 'paths') {
      const result = geometricGridPaths(a[0], a[1], a[2], a[3]);
      const pairs = (map: Map<string, unknown>) => [...map].map(([key, value]) => [key.split(',').map(Number), value]);
      return { cells: pairs(result.cells), paths: pairs(result.paths) };
    }
    if (item.operation === 'matches') return enumerateComponentMatches(await detectV5Components(a[0], a[2]), await detectV5Components(a[1], a[2]), a[3]);
    if (item.operation === 'boundary') return targetMethodAtBoundary(a[0], a[1]);
    if (item.operation === 'recall') return recalledDirections(a[0], a[1], a[2]);
    throw new Error(`Unknown reference operation ${item.operation}`);
  };
  if (item.error) await assert.rejects(run, (error: unknown) => error instanceof Error && error.message === item.error);
  else assert.deepEqual(await run(), item.expected);
});
