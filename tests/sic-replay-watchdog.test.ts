import assert from 'node:assert/strict';
import { mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { superviseSicReplay } from '../scripts/sic-replay-watchdog.mjs';

test('the supervisor stops a blocked level and retains the completed levels and applied commands', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sic-watchdog-'));
  const script = join(directory, 'blocked.mjs');
  try {
    await writeFile(script, `
      const firstBudget = { actions: 6, activeTimeMs: 1000 };
      const secondBudget = { actions: 8, activeTimeMs: 100 };
      process.send({ kind: 'level-started', level: 1, target: 2, budget: firstBudget });
      process.send({ kind: 'command-applied', sicAuthorized: true });
      process.send({ kind: 'level-finished', level: { level: 1, won: true, actions: 1, budget: firstBudget } });
      process.send({ kind: 'level-started', level: 2, target: 2, budget: secondBudget });
      process.send({ kind: 'command-applied', sicAuthorized: true }, () => { for (;;) {} });
    `);
    const result = await superviseSicReplay(script, [], 'FIXTURE');
    assert.equal(result.reason, 'level_wall_time_budget');
    assert.equal(result.target, 2);
    assert.equal(result.levels, 1);
    assert.equal(result.actions, 2);
    assert.equal(result.authority, 2);
    assert.deepEqual(result.levelStats.map(level => [level.level, level.won, level.actions]), [[1, true, 1], [2, false, 1]]);
    assert.equal(result.levelStats[1].budget.activeTimeMs, 100);
  } finally {
    await unlink(script);
    await rmdir(directory);
  }
});
