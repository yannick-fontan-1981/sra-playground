import assert from 'node:assert/strict';
import { measureManipulation, requireManipulation } from './measure-ss01-manipulation.mjs';
import { compileLevel, equal, initialState, stepWorld } from '../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../experiments/sinking-star-ss02/src/levels.ts';
import { compileLevel as compilePullLevel, initialState as initialPullState, stepDetailed as stepPullWorld } from '../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../experiments/sinking-star-ss03/src/levels.ts';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Contracts are per level. A high count elsewhere must never mask a loss.
// Reference pairs are [commands, commands executed after index zero].
const campaign = [
  [36, 17],
  [32, 22],
  [42, 20],
  [79, 58],
  [62, 14],
  [116, 59],
  [37, 23],
  [41, 30],
];
const requiredPhysical = {
  2: ['mirror', 'position'],
  3: ['crate', 'position'],
  4: ['crate', 'mirror', 'position'],
  5: ['crate', 'mirror'],
  6: ['crate', 'mirror', 'position'],
  7: ['crate', 'position'],
  8: ['crate', 'mirror', 'position'],
};
const sources = { AR25: 'move', HANO: 'click', DC22: 'mixed', SS02: 'move', SS03: 'move' };

function consecutiveStonePushes(level, tickets) {
  const world = compileLevel(SS02_LEVELS[level - 1]);
  let state = initialState(world), previous;
  const pairs = [];
  const crossed = new Set();
  const pushingFootings = new Set();
  let exitFooting;
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.resets !== previous?.resets) state = initialState(world);
    const next = stepWorld(world, state, Number(ticket.action.slice(6)));
    if (next.supports.some(support => equal(support, next.hero))) crossed.add(`${next.hero.x},${next.hero.y}`);
    // The engine preserves stone order unless a stone is converted into a bridge.
    const moved = state.stones.length === next.stones.length
      ? state.stones.flatMap((stone, i) => equal(stone, next.stones[i]) ? [] : [i]) : [];
    if (state.supports.some(support => equal(support, state.hero))) {
      const footing = `${state.hero.x},${state.hero.y}`;
      if (moved.length || next.stones.length < state.stones.length) pushingFootings.add(footing);
      if (world.doors.some(door => equal(door, next.hero))) exitFooting = footing;
    }
    if (ticket.actionIndex > 0 && ticket.decisionRevision === previous?.revision
      && ticket.resets === previous.resets && moved.some(i => previous.moved.includes(i))) {
      pairs.push({ kind: 'stone', first: index, last: index + 1 });
    }
    previous = { revision: ticket.decisionRevision, resets: ticket.resets, moved };
    state = next;
  }
  assert.equal(state.complete, true, 'Executed SS02 L' + level + ' tickets do not reproduce the official goal');
  assert.ok(pairs.length, 'SS02 L' + level + ' lost consecutive pushes of the same stone');
  if (level >= 3) {
    assert.ok(crossed.size > 0 && state.supports.length > world.supports.length,
      'SS02 L' + level + ' did not build and traverse an immersed support');
    assert.ok(world.buttons.every(mark => state.stones.some(stone => equal(mark, stone))),
      'SS02 L' + level + ' did not leave a stone holding each pressure mark');
  }
  if (level === 5) {
    assert.ok(pushingFootings.size >= 2, 'SS02 L5 did not use separate supports as pushing stances');
    assert.ok(exitFooting && !pushingFootings.has(exitFooting), 'SS02 L5 did not cross a separate support into the exit gate');
  }
  return pairs;
}

function consecutiveStonePulls(level, tickets) {
  const world = compilePullLevel(SS03_LEVELS[level - 1]);
  let state = initialPullState(world), previous;
  const pairs = [];
  for (const [index, ticket] of tickets.entries()) {
    if (ticket.resets !== previous?.resets) state = initialPullState(world);
    const detail = stepPullWorld(world, state, Number(ticket.action.slice(6)));
    const phase = detail.phases[0];
    const pull = detail.phases.length === 1 && phase?.kind === 'pull' ? phase.moves.find(move => move.actor === 'stone') : undefined;
    if (pull && previous?.pull && equal(previous.pull.to, pull.from)
      && ticket.actionIndex > 0 && ticket.decisionRevision === previous.revision && ticket.resets === previous.resets) {
      pairs.push({ kind: 'pull', first: index, last: index + 1 });
    }
    previous = { revision: ticket.decisionRevision, resets: ticket.resets, pull };
    state = detail.state;
  }
  assert.equal(state.complete, true, 'Executed SS03 L' + level + ' tickets do not reproduce the official goal');
  assert.ok(pairs.length, 'SS03 L' + level + ' lost consecutive pulls of the same stone');
  return pairs;
}

export function checkRun(run) {
  const { code, executedTickets: tickets, levels } = run;
  const reference = code === 'SS01' ? campaign : null;
  assert.ok(reference || code in sources, 'Unexpected game ' + code);
  assert.equal(run.solver, 'sic');
  assert.ok(Array.isArray(tickets) && tickets.length > 0, 'Missing executed tickets');
  assert.equal(tickets.length, run.sic);
  assert.equal(tickets.length, run.issued);
  assert.equal(levels.length, reference?.length ?? (code === 'SS02' ? 6 : code === 'SS03' ? 2 : 1), code + ' incomplete campaign');
  assert.equal(
    tickets.length,
    levels.reduce((n, l) => n + l.actions, 0),
  );
  const result = [];
  for (const [i, row] of levels.entries()) {
    assert.equal(row.level, i + 1);
    assert.equal(row.won, true, code + ' L' + row.level + ' failed to win');
    const issued = tickets.filter((t) => t.level === row.level);
    assert.equal(issued.length, row.actions);
    if (code === 'SS02' && row.level > 1) {
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS02 must preserve learned access without resetting');
      assert.equal(issued[1]?.decisionRevision, issued[0]?.decisionRevision,
        'SS02 L' + row.level + ' must begin with a plan from the learned controls');
      if (row.level === 6) assert.ok(issued.length <= 110, 'SS02 L6 exceeded its verified action ceiling');
    }
    const groups = new Map();
    let last;
    for (const t of issued) {
      assert.ok(
        Number.isInteger(t.decisionRevision) && /^ACTION[1-7]$/.test(t.action),
        'Missing native command identity',
      );
      if (!groups.has(t.decisionRevision)) groups.set(t.decisionRevision, []);
      else assert.equal(last, t.decisionRevision, 'A sealed decision resumed later');
      const group = groups.get(t.decisionRevision);
      assert.equal(t.actionIndex, group.length, 'Unexpected step inside decision');
      group.push(t);
      last = t.decisionRevision;
    }
    const lengths = [],
      kinds = new Set();
    for (const group of groups.values()) {
      assert.ok(group.length <= 16, 'More than 16 commands under one decision');
      for (const t of group.slice(0, -1)) assert.equal(t.sealed, null, 'Reconciliation before end of series');
      assert.equal(group.at(-1).sealed, group.length, 'Missing final reconciliation of actual commands');
      if (group.length < 2) continue;
      lengths.push(group.length);
      const clicks = group.filter((t) => t.action === 'ACTION6').length;
      kinds.add(clicks === group.length ? 'click' : clicks ? 'mixed' : 'move');
    }
    const continued = issued.length - groups.size;
    if (reference) {
      const [actions, minContinued] = reference[i];
      assert.ok(
        continued >= Math.min(issued.length - 1, Math.ceil((minContinued * issued.length) / actions)),
        code + ' L' + row.level + ' lost executed continuity (' + continued + '/' + issued.length + ')',
      );
    } else assert.ok(kinds.has(sources[code]), code + ' lost its ' + sources[code] + ' series');
    if (code === 'SS03' && row.level === 2) {
      // The exploratory route needed 111 commands and 95 decisions; the composed route needs 27 and 7.
      assert.ok(issued.length <= 35 && groups.size <= 10, 'SS03 L2 lost the direct pull and gate route');
      assert.ok(issued.every(ticket => ticket.resets === 0), 'SS03 L2 reset during the direct route');
    }
    const physical = reference ? measureManipulation(row.level, issued)
      : code === 'SS02' ? consecutiveStonePushes(row.level, issued) : code === 'SS03' ? consecutiveStonePulls(row.level, issued) : [];
    if (reference) requireManipulation(physical, requiredPhysical[row.level] ?? [], row.level);
    result.push({
      game: code,
      level: row.level,
      commands: issued.length,
      continued,
      physical: physical.map(r => r.kind + ' ' + r.first + '-' + r.last).join(', '),
      series: lengths.length,
      longest: Math.max(1, ...lengths),
    });
  }
  return result;
}
function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), 'sic-continuity-'));
  const env = { ...process.env, SIC_STUDY_CONTINUITY: '1', SIC_STUDY_WORKERS: '1', SIC_STUDY_SOLVER: 'sic' };
  const execute = (args) => {
    const r = spawnSync(process.execPath, args, { env, cwd: root, stdio: 'inherit' });
    if (r.error) throw r.error;
    assert.equal(r.status, 0, 'Check failed: ' + args.join(' '));
  };
  let files = process.argv.slice(2);
  if (!files.length) {
    execute(['scripts/prepare-python.mjs']);
    files = [];
    for (const [name, cohort, end, cap] of [
      ['mirror-isles', 'SS01', '8', '120'],
      ['la-force-rouge', 'SS02', '6', '160'],
      ['la-ruse-verte', 'SS03', '2', '120'],
      ['native-sources', 'source:AR25,HANO,DC22', '1', '120'],
    ]) {
      const output = join(temp, name + '.jsonl');
      files.push(output);
      execute(['scripts/compare-source100.mjs', '.', '.', output, cohort, '1', end, cap]);
    }
  }
  const runs = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line)),
  );
  assert.deepEqual(runs.map((r) => r.code).sort(), ['AR25', 'DC22', 'HANO', 'SS01', 'SS02', 'SS03']);
  console.table(runs.flatMap(checkRun));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
