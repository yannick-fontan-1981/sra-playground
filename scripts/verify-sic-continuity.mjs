import assert from 'node:assert/strict';
import { measureManipulation, requireManipulation } from './measure-ss01-manipulation.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Contracts are per level. A high count elsewhere must never mask a loss.
// Reference pairs are [commands, commands executed after index zero].
const campaign = [
  [36, 17],
  [32, 5],
  [42, 8],
  [79, 17],
  [62, 4],
  [116, 21],
  [37, 9],
  [41, 13],
];
const sources = { AR25: 'move', HANO: 'click', DC22: 'mixed' };
export function checkRun(run) {
  const { code, executedTickets: tickets, levels } = run;
  const reference = code === 'SS01' ? campaign : null;
  assert.ok(reference || code in sources, 'Unexpected game ' + code);
  assert.equal(run.solver, 'sic');
  assert.ok(Array.isArray(tickets) && tickets.length > 0, 'Missing executed tickets');
  assert.equal(tickets.length, run.sic);
  assert.equal(tickets.length, run.issued);
  assert.equal(levels.length, reference?.length ?? 1, code + ' incomplete campaign');
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
    const physical = reference ? measureManipulation(row.level, issued) : [];
    const required = row.level === 2 ? ['mirror', 'position'] : row.level === 8 ? ['crate', 'mirror', 'position'] : [];
    if (reference) requireManipulation(physical, required, row.level);
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
    for (const [cohort, end] of [
      ['SS01', '8'],
      ['source:AR25,HANO,DC22', '1'],
    ]) {
      const output = join(temp, 'cohort-' + end + '.jsonl');
      files.push(output);
      execute(['scripts/compare-source100.mjs', '.', '.', output, cohort, '1', end, '120']);
    }
  }
  const runs = files.flatMap((file) =>
    readFileSync(file, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line)),
  );
  assert.deepEqual(runs.map((r) => r.code).sort(), ['AR25', 'DC22', 'HANO', 'SS01']);
  console.table(runs.flatMap(checkRun));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
