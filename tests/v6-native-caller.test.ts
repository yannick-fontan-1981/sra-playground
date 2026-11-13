import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compareNativeCaller } from './helpers/v6-caller-differential.ts';

const COMMIT = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const source = new URL(`../reference/v6/${COMMIT}/source/`, import.meta.url);
const directory = new URL('./fixtures/v6-native-caller/', import.meta.url);
const cases = [
  { name: 'HANO first released prefix', file: 'hano-first-prefix.json', checks: 15,
    sha256: '6bfdfef94cf41b773e534e1c062f1ea6f332da026705dca7db9775abaedd2b35',
    excluded: ['addressed_material_event', 'framed_transfer_event', 'ordered_support_state',
      'repeated_series_state', 'support_navigation_event', 'temporal_selection_state'] },
  { name: 'public viewport exploration and acquired frontier', file: 'viewport-three-prefixes.json', checks: 29,
    sha256: 'f3f9db78d1da262de307739dc4a841ad28a8ac6c26141a3737dcd4d2bddf38ec',
    excluded: ['addressed_material_event', 'repeated_series_state', 'temporal_selection_state'] },
];

test('caller oracle provenance retains exact historical captures and pinned source', async () => {
  for (const item of cases) {
    const bytes = await readFile(new URL(item.file, directory));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    const oracle = JSON.parse(bytes.toString());
    assert.equal(oracle.commit, COMMIT);
    assert.equal(oracle.method.sourceModified, false);
    assert.equal(oracle.method.astTransformed, false);
    assert.equal(oracle.method.decisionInterception, false);
    assert.deepEqual(oracle.method.normalization, []);
    assert.equal(oracle.sourceVerification.verifiedOriginalFiles, 1786);
    assert.equal(oracle.sourceVerification.beforeOriginalMain, true);
    assert.equal(oracle.sourceVerification.afterOriginalMain, true);
    for (const [path, expected] of Object.entries(oracle.sourceHashes)) {
      assert.equal(createHash('sha256').update(await readFile(new URL(path, source))).digest('hex'), expected);
    }
    assert.deepEqual(oracle.budgets, { targetLevels: 3, levelActionCaps: [160, 160, 160] });
    assert.equal(oracle.publicProtocol.events.at(-1).observation.levelsCompleted, 0,
      'These short acquisition fixtures do not claim a completed game level');
  }
});

for (const item of cases) {
  test(`native common caller: ${item.name}`, async context => {
    const oracle = JSON.parse(await readFile(new URL(item.file, directory), 'utf8'));
    const result = await compareNativeCaller(oracle);
    assert.equal(result.checks.length, item.checks);
    // These missing source acquisitions remain an explicit limitation. A change
    // in the native scope must update its oracle and coverage, not hide a field.
    const outside = [...new Set(result.unsupported.flatMap(row =>
      row.sourceWritesOutsideCoordinator.map((fact: { key: string }) => fact.key.replace(/:\d+$/, ''))))].sort();
    assert.deepEqual(outside, item.excluded);
    for (const check of result.checks) await context.test(check.label, () => {
      assert.equal(check.passed, true, JSON.stringify(check.differences, null, 2));
    });
    assert.equal(result.failed, 0);
  });
}
