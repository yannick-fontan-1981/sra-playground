/** Compare recorded public returns locally. Output counts and a few coordinates only. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { observeDirectionalReturn } from '../src/sic/directional-return.ts';

const file = new URL('../docs/migration/lot2c-cost-evidence/final/ls20-regression/ls20-public-trace.json.gz', import.meta.url);
const { packets } = JSON.parse(gunzipSync(readFileSync(file)));
const counts = {};
const examples = {};
const aheadPatterns = {};
let previous;
for (let sequence = 1; sequence < packets.length; sequence++) {
  const { packet: before } = packets[sequence - 1];
  const { packet: after, command } = packets[sequence];
  const action = Number(command.action_ref.slice(6));
  if (action < 1 || action > 4) continue;
  const boundary = before.level !== after.level || before.state !== after.state;
  const item = observeDirectionalReturn({ sessionId: 'ls20-public', sequence, command: action,
    fromLevel: before.level, toLevel: after.level }, before.frame_rows, after.frame_rows, boundary, previous);
  const status = item.translation ? 'moved' : item.stationary ? 'stationary' : item.changes ? 'unresolved' : 'boundary';
  const row = counts[item.fromLevel] ??= { moved: 0, stationary: 0, unresolved: 0, boundary: 0, movedWithOtherChanges: 0 };
  row[status]++;
  if (item.translation && item.changes.totalPixels) row.movedWithOtherChanges++;
  if (item.stationary) {
    const colors = [...new Set(item.stationary.ahead?.flat() ?? [])].sort((a, b) => a - b).join(',');
    aheadPatterns[colors] = (aheadPatterns[colors] ?? 0) + 1;
  }
  if (['moved', 'stationary'].includes(status)) {
    const key = `${item.fromLevel}:${status}`;
    examples[key] ??= { sequence, action, from: item.translation?.from, to: item.translation?.to,
      stationary: item.stationary?.box, other: item.changes.samples.map(sample => [sample.box, sample.pixels]) };
  }
  previous = item;
}
assert.equal(counts[2].stationary, 5);
assert.equal(examples['2:stationary'].other[0][1], 4);
assert.deepEqual(examples['2:moved'].to, examples['2:stationary'].stationary);
console.log(JSON.stringify({ counts, examples, aheadPatterns }));
