import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourcePoseIndex } from './source-numbered-poses.mjs';
import { hash, sourceReplay } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';

const [environment, forecastsPath, output, ...poseFiles] = process.argv.slice(2);
const load = async file => JSON.parse(await readFile(file, 'utf8'));
const sourceEntries = await load(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const hypotheses = new Map((await load(forecastsPath)).map(row => [row.code + '/' + row.level, row.predictions]));
const engine = await sourceBackend(resolve(environment));
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const point = (rows, role) => {
  const parts = rows.filter(part => part[0] === role);
  return parts.length === 1 ? parts[0].slice(2, 4) : null;
};
function landing(origin, reference, model) {
  const x = origin[0] - reference[0], y = origin[1] - reference[1];
  const [u, v] = [[0, 0], [x, y], [-y, x], [-x, -y], [y, -x], [-x, y], [x, -y], [y, x], [-y, -x]][model.transform];
  return [reference[0] + u + model.offset[0], reference[1] + v + model.offset[1]];
}
function select(predictions) {
  const chosen = [], seen = new Set(), counts = new Map();
  for (const p of predictions) {
    const kind = p.reference < 0 ? 'gesture' : 'subject';
    const key = [p.step, kind].join('/');
    if (seen.has(key) || (counts.get(kind) ?? 0) >= 8) continue;
    seen.add(key); counts.set(kind, (counts.get(kind) ?? 0) + 1); chosen.push(p);
  }
  return chosen;
}
const records = [];
for (const file of poseFiles) for (const episode of await load(file)) {
  const cases = select(hypotheses.get(episode.code + '/' + episode.level) ?? []);
  if (!cases.length) continue;
  assert.ok(getGameByCode(episode.code)?.group && getGameByCode(episode.code).group !== 'custom_4');
  const entry = {code: episode.code, start: episode.level};
  let {b: initial} = sourceReplay(engine, {}, entry).openEntry();
  if (hash(initial).slice(0, 16) !== episode.steps[0][0]) {
    // Some source recordings entered through the publicly recorded previous level.
    // Verify the original entry image before accepting any intervention at that prefix.
    assert.ok(episode.level > 1 && sourceEntries.niveau_1[episode.code]);
    entry.sourcePrefixActions = sourceEntries.niveau_1[episode.code].suite_gagnante.length;
    for (let level = 2; level < episode.level; level++) {
      entry.sourcePrefixActions += sourceEntries.niveaux_supérieurs.find(run => run.code === episode.code && run.l === level).seq.length;
    }
    const restored = sourceReplay(engine, sourceEntries, entry).openEntry();
    initial = restored.b;
    assert.equal(restored.entry, entry.sourcePrefixActions);
  }
  assert.equal(hash(initial).slice(0, 16), episode.steps[0][0]);
  const steps = episode.steps.map(([from, command, to]) => {
    const [name, xy] = command.split(':'), [x, y] = xy?.split(',').map(Number) ?? [];
    return {from, to, a: Number(name.slice(6)), ...(xy ? {data: {x, y}} : {})};
  });
  const replay = sourceReplay(engine, sourceEntries, {...entry, initial: hash(initial),
    initialCompleted: initial.levelsCompleted, steps});
  for (const model of cases) {
    const at = model.step - 1, pose = sourcePoseIndex(), rows = async b => (await pose(b)).rows;
    let base = replay.restore(0);
    await rows(base);
    for (const [from, cmd, to] of episode.steps.slice(0, at)) {
      assert.equal(hash(base).slice(0, 16), from);
      base = replay.act(cmd);
      assert.equal(hash(base).slice(0, 16), to);
      await rows(base);
    }
    const start = await rows(base);
    assert.deepEqual(start, episode.frames[episode.steps[at][0]]);
    assert.deepEqual(point(start, model.subject), model.source);
    const terminal = b => replay.win(b) || b.state !== 'NOT_FINISHED';
    const inputId = op => Number(op.split(':')[0].slice(6));
    const scalar = base.availableActionIds.filter(n => n > 0 && n !== 6).map(n => 'ACTION' + n);
    const record = {code: episode.code, level: episode.level, step: model.step, role: model.subject,
      reference: model.reference, command: model.action, support: model.support, priorLevelActions: entry.sourcePrefixActions ?? 0, probes: []};
    records.push(record);
    // Every alternative starts from a separately restored and authenticated public prefix.
    const branches = new Map();
    async function branch(commands) {
      const id = JSON.stringify(commands);
      if (!branches.has(id)) {
        let board = replay.restore(at), used = 0;
        for (const cmd of commands) {
          if (terminal(board) || !board.availableActionIds.includes(inputId(cmd))) break;
          board = replay.act(cmd); used++;
        }
        branches.set(id, {used, won: replay.win(board), done: terminal(board),
          pose: terminal(board) ? [] : await rows(board), hash: hash(board).slice(0, 16)});
      }
      return branches.get(id);
    }
    if (model.reference >= 0) {
      const arms = [];
      assert.deepEqual(point(start, model.reference), model.at);
      for (const prep of [null, ...scalar]) {
        const prefix = prep ? [prep] : [], middle = await branch(prefix);
        const a = point(middle.pose, model.subject), b = point(middle.pose, model.reference);
        if (!a || !b) continue;
        const end = await branch([...prefix, model.action]);
        const expected = landing(a, b, model), actual = point(end.pose, model.subject);
        arms.push({prep, a, b, expected, actual, matched: Boolean(same(expected, actual)), won: end.won, used: end.used});
      }
      record.probes = arms;
      continue;
    }
    if (model.transform !== 0) continue;
    // Solve target = click + observed offset. Choose other visible landmarks before executing the click.
    const targets = new Map(), oldClick = model.action.split(':')[1]?.split(',').map(Number);
    const width = base.frame[0].length, height = base.frame.length;
    for (const [shape, , x, y] of start) {
      const dest = [x, y], click = dest.map((v, i) => (v - model.offset[i]) / 2);
      if (shape === model.subject || same(dest, model.source) || same(click, oldClick) || !click.every(Number.isInteger)
          || click[0] < 0 || click[0] >= width || click[1] < 0 || click[1] >= height) continue;
      if (!targets.has(dest.join())) targets.set(dest.join(), {dest, click, unique: Boolean(point(start, shape))});
    }
    const distance = p => p.dest.reduce((sum, v, i) => sum + Math.abs(v - model.source[i]), 0);
    const ranked = [...targets.values()].sort((a, b) => Number(b.unique) - Number(a.unique) || distance(a) - distance(b));
    for (const {dest, click} of ranked.slice(0, 6)) {
      const cmd = 'ACTION6:' + click.join(), centre = 'ACTION6:' + dest.map(v => Math.floor(v / 2)).join();
      const outcome = await branch([cmd]), centreOutcome = await branch([centre]);
      const follow = [];
      for (const use of [...scalar, centre]) {
        const full = await branch([cmd, use]), alone = await branch([use]);
        const naive = await branch([centre, use]), reverse = await branch([use, cmd]);
        follow.push({use, wonAfter: full.won && full.used === 2, alone: alone.won, centreThenUse: naive.won, reverse: reverse.won});
      }
      const actual = point(outcome.pose, model.subject);
      record.probes.push({dest, cmd, centre, actual, matched: Boolean(same(dest, actual)),
        sameAsCentre: centreOutcome.hash === outcome.hash, won: outcome.won, centreWon: centreOutcome.won, follow});
    }
  }
}
await writeFile(output, JSON.stringify(records));
console.log('source prefixes', records.length, 'probes', records.reduce((n, r) => n + r.probes.length, 0));
