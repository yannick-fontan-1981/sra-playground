import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const [output, ...pairs] = process.argv.slice(2);
assert.ok(pairs.length && pairs.length % 2 === 0);
const read = async (file) =>
  (await readFile(file, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const trials = [],
  skipped = [];
for (let i = 0; i < pairs.length; i += 2) {
  const forecasts = await read(pairs[i]),
    scores = await read(pairs[i + 1]);
  assert.equal(forecasts.length, scores.length);
  for (let j = 0; j < scores.length; j++) {
    const { forecastDigest, ...f } = forecasts[j],
      r = scores[j];
    if (f.reason) {
      assert.deepEqual(f, r);
      skipped.push(f);
      continue;
    }
    assert.equal(forecastDigest, createHash('sha256').update(JSON.stringify(f)).digest('hex'));
    assert.equal(r.forecastDigest, forecastDigest);
    assert.equal(f.offers.length, r.results.length);
    const choices = r.results.map((s, k) => {
      const { score, ...offered } = f.offers[k];
      const { a, b, use } = s;
      assert.deepEqual(offered, { a, b, use });
      return {
        score,
        action: [a, b, use],
        win: s.forward,
        necessary: s.forward && !!s.joint,
        independent: s.forward && s.reverse && !!s.joint,
      };
    });
    const top = Math.max(...choices.map((x) => x.score)),
      best = choices.filter((x) => x.score === top);
    const metrics = {};
    for (const key of ['win', 'necessary', 'independent']) {
      const n = choices.filter((x) => x[key]).length,
        high = best.filter((x) => x[key]).length;
      metrics[key] = {
        possible: n,
        first: best[0]?.[key] ?? false,
        topMean: best.length ? high / best.length : 0,
        uniform: choices.length ? n / choices.length : 0,
      };
    }
    trials.push({
      code: f.code,
      level: f.level,
      mode: f.mode,
      prefix: f.prefix,
      choices: choices.length,
      tied: best.length,
      metrics,
      first: best[0]?.action,
      firstIndependent: choices.find((c) => c.independent)?.action,
    });
  }
}
const aggregate = {};
for (const mode of new Set(trials.map((r) => r.mode))) {
  const states = trials.filter((r) => r.mode === mode),
    feasible = states.filter((r) => r.choices);
  const average = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
  const metrics = {};
  for (const key of ['win', 'necessary', 'independent']) {
    const rows = feasible.map((r) => r.metrics[key]);
    metrics[key] = {
      statesWithAWinningOption: rows.filter((r) => r.possible).length,
      winningOptions: rows.reduce((s, r) => s + r.possible, 0),
      firstWins: rows.filter((r) => r.first).length,
      meanOverTiedFirst: average(rows.map((r) => r.topMean)),
      uniform: average(rows.map((r) => r.uniform)),
    };
  }
  aggregate[mode] = {
    states: states.length,
    withAlternatives: feasible.length,
    decisiveRank: feasible.filter((r) => r.tied === 1).length,
    choices: states.reduce((n, r) => n + r.choices, 0),
    metrics,
  };
}
await writeFile(output, JSON.stringify({ aggregate, trials, skipped }));
console.log(JSON.stringify(aggregate));
