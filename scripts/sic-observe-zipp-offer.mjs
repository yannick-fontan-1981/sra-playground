// Optional Node preloader for the sealed line-1 candidate. Copy the value returned to the caller.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const checkout = process.env.SIC_ZIPP_ENGINE;
const output = process.env.SIC_ZIPP_CALLS;
if (!checkout || !output) throw Error('Set SIC_ZIPP_ENGINE and SIC_ZIPP_CALLS');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
assert.equal(sha, '16f3c5e8d300903e475400fb9b67a513f2834663');
const path = 'src/logos-engine/v6-native-caller.ts';
execFileSync('git', ['diff', '--exit-code', 'HEAD', '--', 'src'], { cwd: checkout });
const caller = pathToFileURL(resolve(checkout, path)).href;
const marker = 'const offer = offerTranslationReplication(pairs, current);';
const calls = [];
const key = 'sic.bench.zipp.offer';
globalThis[Symbol.for(key)] = (command, current, trialCount, offer) => {
  calls.push({ command, current, trialCount, offer: structuredClone(offer) });
};
let loadedCaller = false;
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  if (url !== caller) return loaded;
  const code = Buffer.from(loaded.source).toString();
  assert.equal(code.split(marker).length, 2);
  loadedCaller = true;
  return { ...loaded, source: code.replace(marker,
    marker + 'globalThis[Symbol.for("sic.bench.zipp.offer")](command, current.ref, pairs.length, offer);') };
} });
process.on('exit', () => {
  assert.ok(loadedCaller, 'The native caller must have been loaded');
  writeFileSync(output, JSON.stringify({ sha, calls }) + '\n', { flag: 'wx' });
});
