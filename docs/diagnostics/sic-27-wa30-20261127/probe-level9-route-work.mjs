// Count search work on the archived physical ninth-level owner replay.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const base = '01226397e5b868d2d511d4b385f5f8c109cb1374';
const relative = 'src/sic/oriented-delivery.ts';
const ownerProbe = 'docs/diagnostics/sic-27-wa30-20261127/probe-level9-owner.mjs';
const entries = [
  ['baseline', execFileSync('git', ['show', base + ':' + relative], { encoding: 'utf8' })],
  ['mutualized', readFileSync(relative, 'utf8')],
];
const assets = resolve(process.env.WA30_PUBLIC_DIAGNOSTIC_PYODIDE ?? 'public/vendor/pyodide');
const out = mkdtempSync(join(tmpdir(), 'wa30-route-benchmark-'));
const result = [];
for (const [name, code] of entries) {
  const file = 'src/sic/.wa30-route-benchmark-' + name + '.mts';
  const trace = join(out, name + '.jsonl');
  const start = code.indexOf(name === 'baseline' ? 'function shortest(' : 'function* routeNodes(');
  const end = code.indexOf('function deliveryFloor(', start);
  assert.ok(start >= 0 && end > start);
  const source = code.slice(start, end);
  const counters = "const bench = { searches: 0, visited: 0 };\nprocess.once('exit', () => console.log(JSON.stringify({ routeBenchmark: bench })));\n";
  const pattern = '  const moves = Object.entries(vectors);';
  const loop = '  for (let index = 0; index < queue.length; index++) {';
  for (const marker of [pattern, loop]) assert.equal(source.split(marker).length, 2);
  const instrumented = counters + source.replace(pattern, pattern + '\n  bench.searches++;').replace(loop, loop + '\n    bench.visited++;');
  writeFileSync(file, code.slice(0, start) + instrumented + code.slice(end), { flag: 'wx' });
  try {
    const output = execFileSync(process.execPath, [ownerProbe, trace], {
      encoding: 'utf8',
      env: { ...process.env, WA30_PUBLIC_DIAGNOSTIC_OWNER: file,
        WA30_PUBLIC_DIAGNOSTIC_PYODIDE: assets },
    });
    const counters = JSON.parse(output.trim().split('\n').at(-1)).routeBenchmark;
    const commands = readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(commands.length, 66);
    assert.equal(commands.at(-1).reason, 'official_boundary');
    result.push({ name, counters, commands, sourceSHA256: createHash('sha256').update(code).digest('hex') });
  } finally {
    unlinkSync(file);
  }
}
const trajectory = record => record.commands.map(row => [row.action, row.after, row.index]);
assert.deepEqual(trajectory(result[1]), trajectory(result[0]));
const digest = createHash('sha256').update(JSON.stringify(trajectory(result[0]))).digest('hex');
console.log(JSON.stringify({ sourceBefore: base, scope: 'public owner-only L9 diagnostic',
  commands: result[0].commands.length, continued: result[0].commands.filter(row => row.index > 0).length,
  trajectoryAndTicketIndexSHA256: digest,
  results: result.map(({ name, counters, sourceSHA256 }) => ({ name, ...counters, sourceSHA256 })) }, null, 2));
