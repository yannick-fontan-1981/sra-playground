import { createReadStream } from 'node:fs';
import { pathToFileURL } from 'node:url';

// JSON Pointer paths, including empty keys. Object key order is immaterial;
// event order and every array index are significant.
const missing = { missing: true };
function difference(a, b, path = '') {
  if (a === b) return null;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object'
      || Array.isArray(a) !== Array.isArray(b)) return { field: path, before: a, after: b };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const child = path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
    if (!Object.hasOwn(a, key)) return { field: child, before: missing, after: b[key] };
    if (!Object.hasOwn(b, key)) return { field: child, before: a[key], after: missing };
    const diff = difference(a[key], b[key], child);
    if (diff) return diff;
  }
  return null;
}

export async function* traceEvents(file) {
  const input = createReadStream(file, { encoding: 'utf8' });
  let line = 0, rest = '';
  function parse(raw) {
    const event = JSON.parse(raw);
    if (typeof event.game !== 'string' || !Number.isInteger(event.level) || event.level < 1
        || !Number.isInteger(event.turn) || event.turn < 1 || typeof event.kind !== 'string'
        || !Object.hasOwn(event, 'value')) throw Error('Invalid event envelope');
    return event;
  }
  try {
    for await (const chunk of input) {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const raw of lines) {
        line++;
        yield parse(raw);
      }
    }
    if (rest) {
      line++;
      try {
        yield parse(rest);
      } catch (error) {
        if (error instanceof SyntaxError) return 'partial-event';
        throw error;
      }
    }
  } catch (error) {
    throw Error(file + ' line ' + line + ': ' + error.message);
  } finally {
    input.destroy();
  }
}

export async function compareTraces(left, right) {
  const a = traceEvents(left), b = traceEvents(right);
  let events = 0, decisions = 0, last;
  try {
    while (true) {
      const [before, after] = await Promise.all([a.next(), b.next()]);
      if (before.done && after.done) {
        if (before.value || after.value) throw Error('Incomplete final event ' + (events + 1));
        if (last?.kind !== 'stop') throw Error('Both traces end before the stop event (after ' + events + ' events)');
        return { equal: true, game: last.game, events, decisions };
      }
      const { game, level, turn, kind } = before.value ?? after.value;
      const at = { event: events + 1, game, level, turn, kind };
      if (before.done || after.done) return { equal: false, ...at, field: '$event',
        before: before.done ? missing : kind, after: after.done ? missing : kind };
      if (last?.kind === 'stop') throw Error('Unexpected event after stop in ' + left);
      const diff = difference(before.value, after.value);
      if (diff) return { equal: false, ...at, ...diff };
      events++;
      if (kind === 'decision') decisions++;
      last = before.value;
    }
  } finally {
    await Promise.all([a.return(), b.return()]);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 4) throw Error('Usage: node scripts/compare-sic-decisions.mjs LEFT.jsonl RIGHT.jsonl');
  const result = await compareTraces(process.argv[2], process.argv[3]);
  console.log(JSON.stringify(result));
  process.exitCode = result.equal ? 0 : 1;
}
