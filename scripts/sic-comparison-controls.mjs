import assert from 'node:assert/strict';
import { appendFileSync, closeSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareTraces, traceEvents } from './compare-sic-decisions.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2] ? resolve(process.argv[2]) :
  join(JSON.parse(readFileSync(join(root, 'artifacts/sic-comparison/last-run.json'))).directory, 'AS66-A.jsonl');
const directory = mkdtempSync(join(dirname(source), 'controls-'));
const both = join(directory, 'two-changes.jsonl'), later = join(directory, 'command-only.jsonl');
const short = join(directory, 'prefix.jsonl');
const prefix = 'sra-v6-98d555fa-6cf9-42fc-b483-9225bfc834d9:epoch:1:revision:';
const current = prefix + '2:frame:f7b0a6951802004b', previous = prefix + '1:frame:39bddf2920c3e13f';
const at = { equal: false, game: 'AS66', level: 1, kind: 'decision' };
const reasoning = { ...at, turn: 2, event: 16, field: '/value/proposal/sicLocalDecision/need/evidence/0',
  before: current, after: previous };
const action = { ...at, turn: 3, event: 26, field: '/value/command/actionRef', before: 'ACTION3', after: 'ACTION4' };

async function copy(input, output, edit) {
  const fd = openSync(output, 'wx');
  let count = 0;
  try {
    for await (const event of traceEvents(input)) {
      if (edit(event, ++count) === false) break;
      writeFileSync(fd, JSON.stringify(event) + '\n');
    }
  } finally {
    closeSync(fd);
  }
}
function decision(event, turn) {
  return event.game === 'AS66' && event.level === 1 && event.turn === turn && event.kind === 'decision';
}
await copy(source, both, event => {
  if (decision(event, 2)) {
    assert.deepEqual(event.value.command, { actionRef: 'ACTION2', data: {} });
    const evidence = event.value.proposal.sicLocalDecision.need.evidence;
    assert.equal(evidence[0], current);
    evidence[0] = previous;
  }
  if (decision(event, 3)) {
    assert.equal(event.value.command.actionRef, action.before);
    event.value.command.actionRef = action.after;
  }
});
const first = await compareTraces(source, both);
assert.deepEqual(first, reasoning);
await copy(both, later, event => {
  if (!decision(event, 2)) return;
  const evidence = event.value.proposal.sicLocalDecision.need.evidence;
  assert.equal(evidence[0], previous);
  evidence[0] = current;
});
const second = await compareTraces(source, later);
assert.deepEqual(second, action);

await copy(source, short, (_, i) => i < 26);
const truncated = await compareTraces(source, short);
assert.deepEqual(truncated, { ...at, turn: 3, event: 26, field: '$event', before: 'decision', after: { missing: true } });
const reversed = await compareTraces(short, source);
assert.deepEqual(reversed, { ...truncated, before: { missing: true }, after: 'decision' });
appendFileSync(short, '{"game":"AS');
assert.deepEqual(await compareTraces(source, short), truncated);
console.log(JSON.stringify({ first, second, truncated, reversed }, null, 2));
