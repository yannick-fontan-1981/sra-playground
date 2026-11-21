// Evaluate native proposals at eligible new public states. The historical policy owns the root trajectory.
import { discriminatesAction } from './local-response-controls.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { localPatch, separation } from '../src/sic/local-response.ts';
import {
  assessLocal,
  newLocalMemory,
  nextLocalLevel,
  observeLocal,
  proposeLocal,
} from '../src/sic/prospective-local-use.ts';

const [env, code, levelText, files, out, lessonFile] = process.argv.slice(2);
const records = (
  await Promise.all(
    files.split(',').map(async (f) => (await readFile(f, 'utf8')).trim().split(/\r?\n/).map(JSON.parse))
  )
).flat();
const pairedRevision=process.env.SIC_STUDY_MATCHED_REVISION==='1';
const level = Number(levelText),
  run = records.find((r) => r.code === code && r.start === level);
assert.ok(run && run.sic === run.issued && !run.resets);
const engine = await sourceBackend(resolve(env)),
  replay = sourceReplay(engine, {}, run);
const digest = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const obs = (b, i, epoch) => ({
  frame_hash: hash(b),
  observation_ref: 'public:' + epoch + ':' + i + ':' + hash(b).slice(0, 16),
  level_epoch: epoch,
  levels_completed: b.levelsCompleted,
  state: b.state,
  available_action_refs: b.availableActionIds.map((id) => 'ACTION' + id),
});
let memory = newLocalMemory(),
  priorActions = 0;
if (lessonFile) {
  const {commands,endLevel,transferTo}=JSON.parse(await readFile(lessonFile,'utf8'));
  assert.ok(endLevel===level || transferTo===level);
  let b = engine.dispatch({ type: 'load', code, level:endLevel-1 });
  for (const [i, c] of commands.entries()) {
    assert.equal(hash(b).slice(0, 16), c.from);
    const key = op({ a: c.id, data: c.data }),
      n = replay.act(key);
    assert.equal(hash(n).slice(0, 16), c.to);
    if (n.level === b.level) observeLocal(memory, obs(b, i, 1), obs(n, i + 1, 1), b.frame, n.frame, key);
    b = n;
    priorActions++;
  }
  assert.equal(b.level,endLevel);
  memory = nextLocalLevel(memory);
}
const eligible = (b) =>
  b && b.level === run.start && b.state === 'NOT_FINISHED' && b.levelsCompleted === run.initialCompleted;
function branch(i, keys) {
  let b = replay.restore(i);
  for (const k of keys) {
    if (!eligible(b)) return null;
    b = replay.act(k);
  }
  return eligible(b) ? b : null;
}
const checked = [],
  seen = new Set();
async function measure(i, base, p, revision = false, returnToRoot = false) {
  assert.ok(separation(p.site, p.trainedSite) >= 3);
  const seal = digest(p);
  await appendFile(out + '.journal', JSON.stringify({ kind: 'forecast', i, seal, p }) + '\n');
  const va = branch(i, [p.a]),
    vb = branch(i, [p.b]),
    vab = branch(i, [p.a, p.b]);
  const aOK = !!va && localPatch(base, p.site) === p.firstBefore && localPatch(va, p.site) === p.firstAfter;
  const enabled =
    aOK &&
    !!vb &&
    localPatch(vb, p.siteB) !== p.afterB &&
    localPatch(va, p.siteB) === p.beforeB &&
    localPatch(vab, p.siteB) === p.afterB;
  let use = false;
  if (enabled && p.siteC && localPatch(vab, p.siteC) === p.beforeC) {
    const ac = branch(i, [p.a, p.c]),
      bc = branch(i, [p.b, p.c]),
      abc = branch(i, [p.a, p.b, p.c]);
    use =
      !!ac &&
      !!bc &&
      localPatch(ac, p.siteC) !== p.afterC &&
      localPatch(bc, p.siteC) !== p.afterC &&
      localPatch(abc, p.siteC) === p.afterC;
  }
  const alternatives = enabled
    ? discriminatesAction(base, run.steps.slice(0, i), p, (keys) => branch(i, keys), false)
    : null;
  const extraUse = use
    ? discriminatesAction(base, run.steps.slice(0, i), p, (keys) => branch(i, keys), true)
    : null;
  const r = {
    i,
    seal,
    aOK,
    enabled,
    use,
    revision,
    returnToRoot,
    selective: alternatives?.selective ?? false,
    selectiveUse: extraUse?.selective ?? false,
    prior: p.ref.startsWith('public:1:'),
  };
  checked.push(r);
  await appendFile(out + '.journal', JSON.stringify({ kind: 'outcome', ...r }) + '\n');
  return { r, va, vb, vab };
}
let b = replay.restore(0);
for (let i = 0; i < run.steps.length; i++) {
  const state = hash(b);
  assert.equal(state.slice(0, 16), run.steps[i].from);
  if (!seen.has(state) && eligible(b)) {
    seen.add(state);
    const p = proposeLocal(memory, obs(b, i, 2), b.frame, true);
    if (p) {
      const { r, va, vb, vab } = await measure(i, b, p);
      if (r.aOK && !r.enabled && va && vb && vab && localPatch(vb, p.siteB) !== p.afterB) {
        const forkMemory = structuredClone(memory),
          ref = obs(vb, i + 1, 2).observation_ref;
        observeLocal(forkMemory, obs(b, i, 2), obs(vb, i + 1, 2), b.frame, vb.frame, p.b);
        assessLocal(
          forkMemory,
          { ...p, stage: 'prepare', controlRef: ref },
          obs(b, i, 2),
          obs(va, i + 1, 2),
          b.frame,
          va.frame
        );
        assessLocal(
          forkMemory,
          { ...p, stage: 'test', controlRef: ref },
          obs(va, i + 1, 2),
          obs(vab, i + 2, 2),
          va.frame,
          vab.frame
        );
        if(pairedRevision){
          const candidates=[...new Set([...b.availableActionIds.filter(id=>id!==6&&id!==7).map(id=>'ACTION'+id),...run.steps.slice(0,i).filter(c=>c.a===6).map(op)])].slice(0,12);
          for(const key of candidates){
            if(key===p.b)continue;
            const observed=branch(i,[key]);
            if(observed)observeLocal(forkMemory,obs(b,i,2),obs(observed,i+1,2),b.frame,observed.frame,key);
          }
        }
        let alternative=proposeLocal(forkMemory,obs(vab,i+2,2),vab.frame,true);
        let returned=false;
        if(pairedRevision&&!alternative?.revised){
          alternative=proposeLocal(forkMemory,obs(b,i,2),b.frame,true);
          returned=true;
        }
        if (
          alternative?.revised &&
          alternative.origin === p.origin &&
          separation(alternative.site,p.site)===0 && alternative.firstAfter===p.firstAfter &&
          alternative.a === p.a &&
          alternative.b !== p.b
        )
          await measure(i, b, alternative, true, returned);
      }
      b = replay.restore(i);
    }
  }
  const key = op(run.steps[i]),
    after = replay.act(key);
  assert.equal(hash(after).slice(0, 16), run.steps[i].to);
  if (after.level === b.level)
    observeLocal(memory, obs(b, i, 2), obs(after, i + 1, 2), b.frame, after.frame, key);
  b = after;
}
const summary = {
  code,
  level,
  priorActions,
  ...(pairedRevision?{matchedRevision:true,verifiedAfterReturn:checked.filter(x=>x.returnToRoot&&x.enabled).length}:{}),
  roots: seen.size,
  forecasts: checked.length,
  verified: checked.filter((x) => x.enabled).length,
  selective: checked.filter((x) => x.selective).length,
  selectiveUse: checked.filter((x) => x.selectiveUse).length,
  uses: checked.filter((x) => x.use).length,
  revisions: checked.filter((x) => x.revision).length,
  revisedVerified: checked.filter((x) => x.revision && x.enabled).length,
  priorForecasts: checked.filter((x) => x.prior).length,
  priorVerified: checked.filter((x) => x.prior && x.enabled).length,
};
await writeFile(out, JSON.stringify(summary) + '\n');
console.log(JSON.stringify(summary));
