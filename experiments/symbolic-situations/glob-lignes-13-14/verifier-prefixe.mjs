import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { animation, readSelection, runsOfFrames } from './animation.mjs';

const base = 'd0e7527ca8033bd805a6d7a8bb021eff62e87021';
const trace = 'docs/migration/native-campaigns-v56/final/glob-public-trace.json.gz';
const bytes = execFileSync('git', ['show', base + ':' + trace], { maxBuffer: 16 * 1024 * 1024 });
const { packets } = JSON.parse(gunzipSync(bytes));
assert.deepEqual(packets.slice(1, 5).map(p => p.command), [
  { action_ref: 'ACTION5', data: {} },
  { action_ref: 'ACTION6', data: { x: 10, y: 16 } },
  { action_ref: 'ACTION5', data: {} },
  { action_ref: 'ACTION6', data: { x: 31, y: 12 } },
]);
const frames = packets[3].packet.frame_packet;
assert.equal(frames.length, 66);
const fingerprint = frame => createHash('sha256').update(JSON.stringify(frame)).digest('hex');
function visualTransitions(frames) {
  const runs = runsOfFrames(frames);
  const hashes = runs.map(({first}) => fingerprint(frames[first]));
  return new Set(hashes.slice(1).map((hash, i) => hashes[i] + '/' + hash));
}

const reference = visualTransitions(frames);
const variants = ['complet', 'bornes'];
let selection;
if (process.argv[2]) {
  selection = readSelection(process.argv[2]);
  variants.push('palier');
}
const counts = [];
for (const variant of variants) {
  const served = animation(frames, variant, selection);
  assert.equal(served.length, frames.length);
  assert.deepEqual(served[0], frames[0]);
  assert.deepEqual(served.at(-1), frames.at(-1));
  const observed = visualTransitions(served);
  const lost = reference.difference(observed);
  const newPairs = observed.difference(reference);
  if (variant === 'bornes') assert.ok(lost.size > 0);
  if (variant === 'complet') assert.equal(lost.size + newPairs.size, 0);
  counts.push({ variante: variant, images: served.length, paliers: runsOfFrames(served).length,
    couplesVisuelsDistincts: observed.size, couplesAbsents: lost.size, nouveauxVoisinages: newPairs.size });
}
console.log(JSON.stringify({ base, tour: 3, empreinteImageFinale: fingerprint(frames.at(-1)), contrôles: counts }, null, 2));
