import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { budget, signal, validate } from './domain.mjs';

const directory = fileURLToPath(new URL('.', import.meta.url));
const worker = fileURLToPath(new URL('./policy.mjs', import.meta.url));
const composer = fileURLToPath(new URL('../../src/sic/effect-composer.ts', import.meta.url));
const sourceDirectory = fileURLToPath(new URL('../../src/', import.meta.url));
const referenceTree = fileURLToPath(new URL('../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/composition_target_tree.json', import.meta.url));
const earliest = (a, b) => {
  for (let index = 0; index <= Math.max(a.moves.length, b.moves.length); index++) {
    const first = a.moves[index]?.action ?? a.stop;
    const second = b.moves[index]?.action ?? b.stop;
    if (first !== second) return { turn: index + 1, first, second };
  }
  return null;
};

function projection({ actions, worlds, objective, budget, scope }) {
  return { actions, objective, budget, scope, worlds: worlds.map(({ start, roles, nodes }) => ({
    start, roles, nodes: Object.fromEntries(Object.entries(nodes).map(([id, node]) =>
      [id, { view: node.view, outcome: node.outcome, next: node.next }])),
  })) };
}

async function play(test, mode, prior, native) {
  const { domain, actualWorld } = test;
  const world = domain.worlds[actualWorld];
  let cursor = world.start, known = {}, stop, states = 0;
  const moves = [];
  const readPaths = native ? [directory, sourceDirectory, referenceTree] : [directory, composer];
  const child = spawn(process.execPath, ['--permission', ...readPaths.map(path => '--allow-fs-read=' + path), worker, 'worker'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    timeout: 30_000,
  });
  const exited = new Promise(resolve => {
    child.once('close', (code, killed) => resolve({ code, killed }));
    child.once('error', error => resolve({ error: error.message }));
  });
  const output = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  async function request(message) {
    child.stdin.write(JSON.stringify(message) + '\n');
    const result = await output.next();
    assert.ok(!result.done, 'Policy exited before returning its public decision');
    return JSON.parse(result.value);
  }
  function recordCost(decision) {
    assert.ok(Number.isSafeInteger(decision.states) && decision.states >= states && decision.states <= budget.states);
    states = decision.states;
  }
  try {
    let decision = await request({ type: 'start', domain: projection(domain), mode, prior, native });
    while (!world.nodes[cursor].outcome) {
      recordCost(decision);
      const action = decision.action;
      if (action === undefined) {
        stop = decision.stop;
        break;
      }
      assert.ok(moves.length < budget.commands, 'Command budget exceeded');
      assert.ok(domain.actions.includes(action), 'Illegal command');
      if (native) assert.equal(decision.nativeTicket, true);
      const next = world.nodes[cursor].next[action];
      assert.ok(Object.hasOwn(world.nodes, next), 'Illegal world transition');
      const returned = signal(world.nodes[next]);
      const reply = await request({ type: 'return', signal: returned });
      if (native) assert.equal(reply.nativeSealed, true);
      moves.push({ action, route: decision.route, returned, states: decision.states,
        ...(native ? { nativeTicket: true, nativeSealed: true } : {}) });
      known = reply.acquisition.known;
      decision = reply.decision;
      cursor = next;
    }
    stop ??= world.nodes[cursor].outcome;
    assert.ok(stop);
    return { stop, moves, states, known };
  } finally {
    child.stdin.end();
    const completion = await exited;
    assert.deepEqual(completion, { code: 0, killed: null });
  }
}

function summarize(cases, transfers) {
  function counts(rows) {
    const totals = { cases: rows.length, fixedWins: 0, activeWins: 0, gains: 0, regressions: 0,
      fixedCommands: 0, activeCommands: 0, fixedStates: 0, activeStates: 0,
      sharedWins: 0, fixedSharedWinCommands: 0, activeSharedWinCommands: 0, firstDivergences: 0,
      fixedStops: {}, activeStops: {} };
    for (const { fixed, active, firstDifference } of rows) {
      const fixedWon = fixed.stop === 'win', activeWon = active.stop === 'win';
      totals.fixedWins += Number(fixedWon);
      totals.activeWins += Number(activeWon);
      totals.gains += Number(activeWon && !fixedWon);
      totals.regressions += Number(fixedWon && !activeWon);
      totals.fixedCommands += fixed.moves.length;
      totals.activeCommands += active.moves.length;
      totals.fixedStates += fixed.states;
      totals.activeStates += active.states;
      if (fixedWon && activeWon) {
        totals.sharedWins++;
        totals.fixedSharedWinCommands += fixed.moves.length;
        totals.activeSharedWinCommands += active.moves.length;
      }
      totals.firstDivergences += Number(firstDifference !== null);
      totals.fixedStops[fixed.stop] = (totals.fixedStops[fixed.stop] ?? 0) + 1;
      totals.activeStops[active.stop] = (totals.activeStops[active.stop] ?? 0) + 1;
    }
    return totals;
  }
  const names = [...new Set(cases.map(row => row.family))];
  const families = Object.fromEntries(names.map(name => [name, counts(cases.filter(row => row.family === name))]));
  const ambiguous = cases.filter(row => row.pair !== undefined);
  const lost = (row, arm) => row[arm].stop === 'loss';
  const total = counts(cases);
  const gate = { familiesWithNetGain: names.filter(name => families[name].activeWins > families[name].fixedWins).length,
    regressions: total.regressions, candidateLossesOnPairs: ambiguous.filter(row => lost(row, 'active')).length,
    passed: false };
  gate.passed = gate.familiesWithNetGain >= 2 && gate.regressions === 0 && gate.candidateLossesOnPairs === 0;
  return { total, families, gate,
    ambiguity: { pairs: new Set(ambiguous.map(row => row.pair)).size,
      cases: ambiguous.length, fixedLosses: ambiguous.filter(row => lost(row, 'fixed')).length,
      activeLosses: gate.candidateLossesOnPairs, outcomes: counts(ambiguous) },
    firstDifferencesByTurn: cases.reduce((histogram, row) => {
      if (row.firstDifference) histogram[row.firstDifference.turn] = (histogram[row.firstDifference.turn] ?? 0) + 1;
      return histogram;
    }, {}),
    transfers: { pairs: transfers.length, exported: transfers.filter(row => row.prior).length,
      changesInExecutedAction: transfers.filter(row => row.actionChanged).length,
      winsWith: transfers.filter(row => row.withEvidence.stop === 'win').length,
      winsWithout: transfers.filter(row => row.withoutEvidence.stop === 'win').length,
      commandsWith: transfers.reduce((sum, row) => sum + row.withEvidence.moves.length, 0),
      commandsWithout: transfers.reduce((sum, row) => sum + row.withoutEvidence.moves.length, 0) },
  };
}

const { values } = parseArgs({ options: {
  cases: { type: 'string' }, sha256: { type: 'string' }, report: { type: 'string' },
  summary: { type: 'string' },
  native: { type: 'boolean', default: false },
} });
assert.ok(values.cases && values.report && /^[0-9a-f]{64}$/.test(values.sha256 ?? ''),
  'Usage: node compare.mjs --cases private.json --sha256 digest --report private-report.json [--summary aggregate.json] [--native]');
const bytes = await readFile(values.cases);
const hash = createHash('sha256').update(bytes).digest('hex');
assert.equal(hash, values.sha256, 'Reserve digest mismatch');
const input = JSON.parse(bytes);
assert.equal(input.version, 1);
assert.ok(Array.isArray(input.cases) && input.cases.length > 0 && Array.isArray(input.transfers));
const records = new Map(), inputs = new Map(), pairs = new Map();
for (const test of input.cases) {
  const { id, family, domain, actualWorld, pair } = test;
  assert.ok(typeof id === 'string' && typeof family === 'string' && id && family && !inputs.has(id));
  validate(domain);
  assert.ok(Number.isInteger(actualWorld) && actualWorld >= 0 && actualWorld < domain.worlds.length);
  inputs.set(id, test);
  if (pair !== undefined) {
    assert.ok(typeof pair === 'string' && pair);
    const members = pairs.get(pair) ?? [];
    members.push(test);
    pairs.set(pair, members);
  }
}
for (const members of pairs.values()) {
  assert.equal(members.length, 2);
  assert.deepEqual(members[0].domain, members[1].domain);
  assert.notEqual(members[0].actualWorld, members[1].actualWorld);
}
for (const test of inputs.values()) {
  const fixed = await play(test, 'fixed', undefined, values.native);
  const active = await play(test, 'active', undefined, values.native);
  records.set(test.id, { id: test.id, family: test.family, pair: test.pair, fixed, active,
    firstDifference: earliest(fixed, active) });
}
const transfers = [];
for (const { from, to, role } of input.transfers) {
  const source = records.get(from), target = records.get(to), test = inputs.get(to);
  assert.ok(source && target && source.family !== target.family);
  assert.ok(typeof role === 'string' && role);
  const prior = Object.hasOwn(source.active.known, role) ? source.active.known[role] : undefined;
  const withoutEvidence = target.active;
  const withEvidence = await play(test, 'active', prior, values.native);
  if (!prior) assert.deepEqual(withEvidence, withoutEvidence);
  const firstDifference = earliest(withoutEvidence, withEvidence);
  const turn = firstDifference?.turn;
  const actionChanged = turn !== undefined && withEvidence.moves[turn - 1] !== undefined;
  transfers.push({ from, to, role, prior, withEvidence, withoutEvidence, firstDifference, actionChanged });
}
const cases = [...records.values()];
const summary = { sha256: hash, budget, native: values.native, illegalCommands: 0, ...summarize(cases, transfers) };
await writeFile(values.report, JSON.stringify({ summary, cases, transfers }, null, 2) + '\n', { flag: 'wx' });
if (values.summary) await writeFile(values.summary, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sha256: hash, budget, gate: summary.gate,
  results: Object.fromEntries(Object.entries(summary.families).map(([name, row]) =>
    [name, [row.cases, row.fixedWins, row.activeWins, row.fixedCommands, row.activeCommands]])),
  transfers: summary.transfers, firstDifferencesByTurn: summary.firstDifferencesByTurn }));
