import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { matchObservedRotation, observeDirectionalReturn } from '../src/sic/directional-return.ts';

const read = file => readFileSync(new URL(file, import.meta.url));
const { rotations } = JSON.parse(read('../src/sic/ls20-review-evidence.json'));
const { packets } = JSON.parse(gunzipSync(read('../docs/migration/lot2c-cost-evidence/final/ls20-regression/ls20-public-trace.json.gz')));
const found = [];
for (let sequence = 1; sequence < packets.length; sequence++) {
  const before = packets[sequence - 1].packet;
  const { packet: after, command } = packets[sequence];
  const witness = rotations.find(item => item.level === before.level);
  if (!witness || before.level !== after.level) continue;
  const receipt = observeDirectionalReturn({ sessionId: 'archive', sequence, command: Number(command.action_ref.slice(6)),
    fromLevel: before.level, toLevel: after.level }, before.frame_rows, after.frame_rows, false);
  if (matchObservedRotation(receipt, before.frame_rows, after.frame_rows, witness)) found.push({ sequence, level: before.level });
}
for (const witness of rotations) assert.ok(found.some(item => item.sequence === witness.action && item.level === witness.level));
console.log(JSON.stringify({ firstMatches: rotations.map(w => found.find(item => item.level === w.level)), total: found.length }));
