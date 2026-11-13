/** Audit the public restart marker without printing frames or a full trace. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { observeLs20Restart } from '../src/sic/recovery.ts';

const path = new URL('../docs/migration/lot2c-cost-evidence/final/ls20-regression/ls20-public-trace.json.gz', import.meta.url);
const { packets } = JSON.parse(gunzipSync(readFileSync(path)));
const restarts = [];
for (let i = 1; i < packets.length; i++) {
  const previous = packets[i - 1].packet;
  const { packet, command } = packets[i];
  if (packet.level !== previous.level) continue;
  const result = observeLs20Restart(previous.frame_rows, packet.frame_rows, packet.frame_packet);
  if (result) restarts.push({ action: i, level: packet.level, command: command.action_ref, frames: packet.frame_packet.length });
}
assert.deepEqual(restarts.filter(item => item.level === 2), [{ action: 39, level: 2, command: 'ACTION3', frames: 6 }]);
console.log(JSON.stringify(restarts));
