import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash } from './sic-study-source-replay.mjs';

const [env, code, levelText, out, files] = process.argv.slice(2);
const level = Number(levelText);
const engine = await sourceBackend(resolve(env));
const rows = (
  await Promise.all(
    files.split(',').map(async (f) => (await readFile(f, 'utf8')).trim().split(/\r?\n/).map(JSON.parse))
  )
).flat();
const recorded = rows.find((r) => r.code === code && r.start === level && r.levels[0].won);
let data = recorded?.replayCommands;
if (!data) {
  const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  );
  const keys =
    level === 1
      ? programs.niveau_1[code]?.suite_gagnante
      : programs.niveaux_supérieurs.find((r) => r.code === code && r.l === level)?.seq;
  assert.ok(keys, 'No verified example for this boundary');
  data = keys.map((k) => {
    const [n, point] = k.split('@'),
      [x, y] = point?.split(',').map(Number) ?? [];
    return { id: Number(n), ...(point ? { data: { x, y } } : {}) };
  });
}
let b = engine.dispatch({ type: 'load', code, level });
assert.equal(b.level, level);
const initial = b.levelsCompleted,
  commands = [];
for (const c of data) {
  assert.equal(b.level, level);
  const from = hash(b).slice(0, 16);
  b = engine.dispatch({ type: 'action', actionId: c.id, ...(c.data ? { data: c.data } : {}) });
  const to = hash(b).slice(0, 16);
  if (recorded) {
    assert.equal(c.from, from);
    assert.equal(c.to, to);
  }
  commands.push({ id: c.id, from, to, ...(c.data ? { data: c.data } : {}) });
}
assert.equal(b.level, level + 1);
assert.equal(b.levelsCompleted, initial + 1);
const lesson = {
  code,
  endLevel: level + 1,
  source: recorded ? 'verified_native_trajectory' : 'verified_public_demonstration',
  commands,
};
await writeFile(out, JSON.stringify(lesson) + '\n');
console.log(JSON.stringify({ code, level, source: lesson.source, length: commands.length }));
