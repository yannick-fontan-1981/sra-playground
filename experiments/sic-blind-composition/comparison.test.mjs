import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { budget } from './domain.mjs';
import { createPolicy } from './policy.mjs';

const actions = ['first', 'second', 'pulse', 'inspect'];
const scope = 'development';
function world(correct, indirect) {
  const key = correct === 'first' ? 'one' : 'two';
  const losing = correct === 'first' ? 'second' : 'first';
  const node = (view, next) => ({ view, next });
  return { start: 's', roles: { control: correct }, nodes: {
    s: node('start', { first: correct === 'first' ? 'win' : 'loss',
      second: correct === 'second' ? 'win' : 'loss', pulse: indirect ? 'pending' : 's', inspect: 's' }),
    pending: node('start', { first: 'loss', second: 'loss', pulse: 'pending', inspect: 'revealed' }),
    revealed: node(key, { [correct]: 'win', [losing]: 'loss', pulse: 'revealed', inspect: 'revealed' }),
    win: { view: 'finish', outcome: 'win' }, loss: { view: 'finish', outcome: 'loss' },
  } };
}
const makeDomain = indirect => ({ objective: 'win', actions, budget, scope,
  worlds: ['first', 'second'].map(correct => world(correct, indirect)) });

test('conditional planning takes a step that produces information only later', () => {
  const domain = makeDomain(true);
  const fixed = createPolicy(domain, 'fixed');
  assert.equal(fixed.decide().stop, 'observation_needed');
  const active = createPolicy(domain, 'active', { scope, role: 'control', action: 'first' });
  assert.equal(active.decide().action, 'pulse');
  const saved = JSON.parse(JSON.stringify(active.checkpoint()));
  assert.equal(active.expects({ view: 'two', outcome: null }), false);
  assert.deepEqual(active.record({ view: 'start', outcome: null }).known, {});
  active.restore(saved);
  assert.deepEqual(active.record({ view: 'start', outcome: null }).known, {});
  assert.equal(active.decide().action, 'inspect');
  const evidence = active.record({ view: 'two', outcome: null }).known.control;
  assert.deepEqual(evidence, { scope, role: 'control', action: 'second', turn: 2 });
  assert.equal(active.decide().action, 'second');
});

test('both policies abstain when compatible worlds require opposing irreversible commands', () => {
  const domain = makeDomain(false);
  for (const mode of ['fixed', 'active']) {
    const policy = createPolicy(domain, mode, { scope, role: 'control', action: 'first' });
    const decision = policy.decide();
    assert.equal(decision.stop, 'observation_needed');
    assert.ok(decision.states <= budget.states);
  }
});

for (const native of [false, true]) test('isolated comparator and digest verification, native=' + native, () => {
  const dir = mkdtempSync(join(tmpdir(), 'sic-blind-development-'));
  const cases = join(dir, 'cases.json'), report = join(dir, 'report.json');
  const domain = makeDomain(true), ambiguous = makeDomain(false);
  writeFileSync(cases, JSON.stringify({ version: 1, cases: [
    { id: 'public', family: 'development-a', domain, actualWorld: 1 },
    { id: 'paired-a', family: 'development-b', domain: ambiguous, actualWorld: 0, pair: 'paired' },
    { id: 'paired-b', family: 'development-b', domain: ambiguous, actualWorld: 1, pair: 'paired' },
  ], transfers: [{ from: 'public', to: 'paired-a', role: 'control' }] }));
  const compare = fileURLToPath(new URL('./compare.mjs', import.meta.url));
  const run = digest => spawnSync(process.execPath,
    [compare, '--cases', cases, '--sha256', digest, '--report', report, ...(native ? ['--native'] : [])],
    { encoding: 'utf8' });
  const mismatch = run('0'.repeat(64));
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /Reserve digest mismatch/);
  const result = run(createHash('sha256').update(readFileSync(cases)).digest('hex'));
  assert.equal(result.status, 0, result.stderr);
  const { summary, cases: recordings } = JSON.parse(readFileSync(report));
  assert.equal(summary.total.fixedWins, 0);
  assert.equal(summary.total.activeWins, 1);
  assert.equal(summary.ambiguity.activeLosses, 0);
  assert.equal(summary.transfers.exported, 1);
  assert.equal(summary.transfers.changesInExecutedAction, 0);
  assert.equal(summary.gate.passed, false);
  if (native) assert.ok(recordings[0].active.moves.every(move => move.nativeTicket && move.nativeSealed));
});
