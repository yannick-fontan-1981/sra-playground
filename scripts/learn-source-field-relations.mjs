import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getGameByCode } from '../src/games/catalog.ts';

const [output, ...files] = process.argv.slice(2);
const rows = (await Promise.all(files.map(async f => JSON.parse(await readFile(f,'utf8'))))).flat();
assert.equal(rows.length,100);
assert.equal(new Set(rows.map(r => r.code)).size,100);
const accepted = new Map();
for (const row of rows) {
  const game = getGameByCode(row.code);
  assert.ok(game && game.group !== 'custom_4' && row.level === 1);
  const t = row.trials.find(t => t.prefix === 0);
  if (!t?.won || !t.controls?.repeat.won || t.controls.omitFirst.won || t.controls.repeatFirst.won) continue;
  if (t.predictions.some(p => !p.won && (!p.kept || p.observed !== p.desired))) continue;
  for (const rule of t.relativeRules) accepted.set(JSON.stringify(rule),rule);
}
await writeFile(output,JSON.stringify({rules:[...accepted.values()]},null,2)+'\n');
console.log('source games',rows.length,'retained relations',accepted.size);
