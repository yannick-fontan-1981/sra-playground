import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile('src/main.ts', 'utf8');

test('main owns a durable autosave coordinator without replacing explicit invalidation', () => {
  assert.match(source, /BrowserDurableSessionAutosave/);
  assert.match(source, /durableAutosave\?\.reset\(\);\s*durableSessionStore\?\.clear\(\);/s);
  assert.match(source, /captureDurableSessionCheckpoint/);
  assert.match(source, /status === 'unsafe'/);
  assert.doesNotMatch(
    source,
    /if \(!agent\) \{\s*durableSessionStore\.clear\(\);/s,
    'a transient unsafe boundary must not erase the last good crash checkpoint',
  );
});

test('controller state changes request a coalesced autosave', () => {
  assert.match(
    source,
    /onStateChange: snapshot => \{[\s\S]*?requestDurableAutosave\(\);[\s\S]*?updateInterface\(\);/,
  );
});

test('physical Agent dispatch flushes the pending runtime and needId boundary synchronously', () => {
  assert.match(
    source,
    /action: \(action, data\) => \{\s*const pending = runtime\.action\(action, data\);\s*durableAutosave\?\.flush\(\);\s*return pending;\s*\}/s,
  );
});

test('hidden and frozen documents flush without relying on pagehide', () => {
  assert.match(
    source,
    /document\.addEventListener\('visibilitychange',[\s\S]*?document\.visibilityState === 'hidden'[\s\S]*?persistDurableSession\(\)/,
  );
  assert.match(source, /document\.addEventListener\('freeze',[\s\S]*?persistDurableSession\(\)/);
  assert.match(source, /window\.addEventListener\('pagehide',[\s\S]*?persistDurableSession\(\)/);
});

test('restoration keeps the durable checkpoint until a newer safe boundary is committed', () => {
  const durableBranch = source.match(/async function selectGame[\s\S]*?element<HTMLSelectElement>\('#game-select'\)/)?.[0] ?? '';
  assert.ok(durableBranch, 'selectGame source was not found');
  assert.doesNotMatch(
    durableBranch,
    /if \(durable\) \{\s*durableSessionStore\?\.clear\(\);/s,
  );
  assert.match(source, /if \(initialDurable\) durableAutosave\?\.prime\(initialDurable\);/);
  assert.match(source, /Durable browser session restore was rejected; loading a fresh game\.[\s\S]*?invalidateDurableResume\(\);/);
});
