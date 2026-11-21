import { discriminatesAction } from './local-response-controls.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { localPatch, separation } from '../src/sic/local-response.ts';

const [env, file, lessonFile] = process.argv.slice(2);
const run = JSON.parse((await readFile(file, 'utf8')).trim());
if (lessonFile) {
  const packed=JSON.parse(await readFile(lessonFile,'utf8')), lesson=packed.lesson??packed;
  assert.equal(lesson.code,run.code);
  assert.ok(lesson.endLevel===run.start || lesson.transferTo===run.start);
  run.publicLesson=lesson.commands;run.lessonEndLevel=lesson.endLevel;
}
const replay = sourceReplay(await sourceBackend(resolve(env)), {}, run);
const commands = run.replayCommands,
  checked = [],
  claims = new Map(),
  publicOrigins = new Map();
const digest = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const live = (b) =>
  b && b.level === run.start && b.levelsCompleted === run.initialCompleted && b.state === 'NOT_FINISHED';
function fork(root, seq) {
  let b = replay.restore(root);
  for (const k of seq) {
    if (!live(b)) return null;
    b = replay.act(k);
  }
  return live(b) ? b : null;
}
let board = replay.restore(0);
for (let i = 0; i < commands.length; i++) {
  const cmd = commands[i],
    before = board,
    initialHash = hash(before);
  assert.equal(initialHash.slice(0, 16), cmd.from);
  const p = cmd.localCapacity;
  if (p) {
    assert.equal(digest(p), cmd.localSeal);
    assert.ok(separation(p.site, p.trainedSite) >= 3);
    if (p.stage === 'prepare' || p.stage === 'control') publicOrigins.set(p.origin, i);
    const root = publicOrigins.get(p.origin);
    assert.notEqual(root, undefined, 'Lost native origin');
    const key = JSON.stringify([p.origin, p.a, p.b, p.c, p.site, p.siteB, p.siteC, p.afterB, p.afterC]);
    if (!claims.has(key)) {
      const base = fork(root, []),
        va = fork(root, [p.a]),
        vb = fork(root, [p.b]),
        vab = fork(root, [p.a, p.b]);
      const aOK = localPatch(base, p.site) === p.firstBefore && localPatch(va, p.site) === p.firstAfter;
      const enabled =
        !!vb &&
        aOK &&
        localPatch(vb, p.siteB) !== p.afterB &&
        localPatch(va, p.siteB) === p.beforeB &&
        localPatch(vab, p.siteB) === p.afterB;
      let use = false;
      if (enabled && p.siteC && localPatch(vab, p.siteC) === p.beforeC) {
        const ac = fork(root, [p.a, p.c]),
          bc = fork(root, [p.b, p.c]),
          abc = fork(root, [p.a, p.b, p.c]);
        use =
          !!ac &&
          !!bc &&
          localPatch(ac, p.siteC) !== p.afterC &&
          localPatch(bc, p.siteC) !== p.afterC &&
          localPatch(abc, p.siteC) === p.afterC;
      }
      const alternatives = enabled
        ? discriminatesAction(base, run.steps.slice(0, root), p, (keys) => fork(root, keys), false)
        : null;
      const extraUse = use
        ? discriminatesAction(base, run.steps.slice(0, root), p, (keys) => fork(root, keys), true)
        : null;
      const item = {
        selective: alternatives?.selective ?? false,
        selectiveUse: extraUse?.selective ?? false,
        i: i + 1,
        root: root + 1,
        aOK,
        enabled,
        use,
        revised: p.revised,
        actedB: false,
        actedC: false,
        site: p.site,
        trainedSite: p.trainedSite,
        siteB: p.siteB,
        siteC: p.siteC,
        a: p.a,
        b: p.b,
        c: p.c,
        seal: cmd.localSeal,
      };
      claims.set(key, item);
      checked.push(item);
    }
    const item = claims.get(key);
    board = replay.restore(i);
    board = replay.act(op(run.steps[i]));
    if (
      p.stage === 'test' &&
      localPatch(before, p.siteB) === p.beforeB &&
      localPatch(board, p.siteB) === p.afterB
    )
      item.actedB = true;
    if (
      p.stage === 'use' &&
      localPatch(before, p.siteC) === p.beforeC &&
      localPatch(board, p.siteC) === p.afterC
    )
      item.actedC = true;
  } else board = replay.act(op(run.steps[i]));
  assert.equal(hash(board).slice(0, 16), cmd.to);
}
console.log(
  JSON.stringify({
    code: run.code,
    level: run.start,
    prior: run.observedPriorLevelActions ?? 0,
    actions: run.issued,
    won: run.levels[0].won,
    proposals: commands.filter((c) => c.localSeal).length,
    claims: checked.length,
    verified: checked.filter((x) => x.enabled).length,
    selective: checked.filter((x) => x.selective).length,
    selectiveUse: checked.filter((x) => x.selectiveUse).length,
    playedB: checked.filter((x) => x.enabled && x.actedB).length,
    verifiedUse: checked.filter((x) => x.use).length,
    playedUse: checked.filter((x) => x.use && x.actedC).length,
    revisions: checked.filter((x) => x.revised).length,
    successfulRevisions: checked.filter((x) => x.revised && x.enabled && x.actedB).length,
    checked,
  })
);
