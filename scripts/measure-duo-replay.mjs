// Post-run physical measurements. This script never selects an action for the solver.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [engine, firstFile, secondFile] = process.argv.slice(2);
const readRun = async (file) => JSON.parse((await readFile(file, 'utf8')).trim());
const archive = firstFile.endsWith('custom4-rejeux.json') ? (await readRun(firstFile)).pairs[secondFile] : null;
function unpack(run) {
  let from = run.initial.slice(0, 16);
  const replayCommands = run.commands.map(([id, family, to, x, y]) => {
    const cmd = { id, from, to, family: run.families[family], ...(id === 6 ? { data: { x, y } } : {}) };
    from = to;
    return cmd;
  });
  return { ...run, replayCommands };
}
const [first, second] = archive ? archive.runs.map(unpack) : await Promise.all([readRun(firstFile), readRun(secondFile)]);
assert.equal(first.code, second.code);
assert.equal(first.start, second.start);
assert.equal(first.initial, second.initial);
const root = resolve(engine, 'experiments', 'sinking-star-' + first.code.toLowerCase(), 'src');
const moduleUrl = (file) => pathToFileURL(join(root, file)).href;
const [core, levels] = await Promise.all([import(moduleUrl('core.ts')), import(moduleUrl('levels.ts'))]);
const world = core.compileLevel(levels[first.code + '_LEVELS'][first.start - 1]);
const frameKey = (state) => createHash('sha256').update(JSON.stringify(core.renderWorld(world, state))).digest('hex');
const samePoint = (a, b) => a.x === b.x && a.y === b.y;
const distance = (p, q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
const commonHorizon = Math.min(first.issued, second.issued);
function measure(run) {
  let state = core.initialState(world);
  assert.equal(frameKey(state), run.initial);
  assert.equal(world.goals.length, 2);
  const coverage = state.heroes.map(() => new Set());
  const active = new Set();
  let peakOccupied = 0, minManhattan = Infinity, firstOccupied = null;
  let common, fatal;
  function observe(step) {
    const heroes = state.heroes;
    heroes.forEach((hero, i) => { if (!hero.dead) coverage[i].add(JSON.stringify(hero.at)); });
    active.add(heroes[state.active].kind);
    const occupied = world.goals.filter(p => heroes.some(h => !h.dead && samePoint(h.at, p))).length;
    peakOccupied = Math.max(peakOccupied, occupied);
    if (occupied && firstOccupied === null) firstOccupied = step;
    if (heroes.every(h => !h.dead)) {
      const [a, b] = heroes.map(h => h.at);
      const [c, d] = world.goals;
      minManhattan = Math.min(minManhattan, distance(a, c) + distance(b, d), distance(a, d) + distance(b, c));
    }
  }
  function snapshot() {
    return { peakOccupied, firstOccupied, minJointManhattan: minManhattan,
      cellsByHero: Object.fromEntries(state.heroes.map((h, i) => [h.kind, coverage[i].size])),
      controlled: [...active] };
  }
  observe(0);
  for (const [i, cmd] of run.replayCommands.entries()) {
    assert.equal(frameKey(state).slice(0, 16), cmd.from);
    const before = state, step = core.stepDetailed(world, before, cmd.id, cmd.data);
    state = step.state;
    assert.equal(frameKey(state).slice(0, 16), cmd.to);
    observe(i + 1);
    if (i + 1 === commonHorizon) common = snapshot();
    if (state.dead) {
      const surviving = [1, 2, 3, 4, 5].filter(id => !core.stepWorld(world, before, id).dead);
      fatal = { step: i + 1, action: cmd.id, family: cmd.family, phases: step.phases.map(p => p.kind),
        deaths: state.heroes.filter(h => h.dead).map(h => h.kind), survivingNonclickFromSameState: surviving };
    }
  }
  return { actions: run.issued, reason: run.levels[0].reason, frames: run.levels[0].uniqueImages,
    replayed: run.levels[0].replayed, victory: run.levels[0].won, trajectory: run.trajectory, common, final: snapshot(), fatal };
}
const divergence = first.replayCommands.slice(0, commonHorizon).findIndex((cmd, i) => {
  const other = second.replayCommands[i];
  return cmd.id !== other.id || cmd.data?.x !== other.data?.x || cmd.data?.y !== other.data?.y;
});
const metrics = { code: first.code, level: first.start, commonHorizon,
  firstDifferentAction: divergence < 0 ? null : divergence + 1, preMerge: measure(first), merged: measure(second) };
if (archive) assert.deepEqual(JSON.parse(JSON.stringify(metrics)), archive.physical);
console.log(JSON.stringify(metrics));
