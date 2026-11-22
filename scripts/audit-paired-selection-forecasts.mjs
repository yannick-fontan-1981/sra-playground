import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

// Compare the preview with the next public reading. Missing adjacent readings are counted separately.
const [output, ...tapes] = process.argv.slice(2);
if (!output || !tapes.length) throw new Error('Usage: node scripts/audit-paired-selection-forecasts.mjs output.json tape.jsonl ...');
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const material = pose => [...pose.subjects, ...pose.pieces, ...pose.supports];
const results = [];
for (const tape of tapes) {
  for (const line of (await readFile(tape, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line);
    if (run.error) throw new Error(run.error);
    const decisions = run.replayCommands, receipts = new Map(run.preparation.map(t => [t.actionIndex, t.result]));
    let end = 0;
    const boundaries = new Set(run.levels.map(level => (end += level.actions)));
    const row = { tape, game: run.code, start: run.start, finish: run.finish, budget: run.cap, issued: run.issued,
      pack: run.packDigest, clicksWithForecast: 0, unavailableNextReadings: 0, mismatchedPositions: 0,
      unchangedPlacements: 0, wrongGateForecasts: 0, wrongUncoveredGateForecasts: 0, tests: [] };
    for (const [i, action] of decisions.entries()) {
      const f = action.cooperative;
      if (action.id !== 6 || !f || !Array.isArray(f.from.opened) || !Array.isArray(f.expected.opened)) continue;
      row.clicksWithForecast++;
      if (f.gateSelectionTest) row.tests.push({ action: i + 1, origin: action.from, command: f.command,
        alternatives: f.open, purpose: f.purpose, result: receipts.get(i + 1) ?? null });
      const following = decisions[i + 1], after = following?.cooperative?.from;
      if (boundaries.has(i + 1) || !after || !Array.isArray(after.opened)) { row.unavailableNextReadings++; continue; }
      assert.equal(following.from, action.to);
      if (after.active !== f.expected.active || !same(after.subjects, f.expected.subjects) ||
          !same(after.pieces, f.expected.pieces) || !same(after.supports, f.expected.supports)) {
        row.mismatchedPositions++;
        continue;
      }
      if (after.active === f.from.active || !same(after.subjects, f.from.subjects) ||
          !same(after.pieces, f.from.pieces) || !same(after.supports, f.from.supports)) continue;
      row.unchangedPlacements++;
      const different = [...new Set([...f.expected.opened, ...after.opened])].filter(p =>
        after.opened.includes(p) !== f.expected.opened.includes(p));
      if (!different.length) continue;
      row.wrongGateForecasts++;
      const occluded = new Set([...material(f.from), ...material(after)]);
      if (different.some(p => !occluded.has(p))) row.wrongUncoveredGateForecasts++;
    }
    results.push(row);
  }
}
await writeFile(output, JSON.stringify(results, null, 2) + '\n');
