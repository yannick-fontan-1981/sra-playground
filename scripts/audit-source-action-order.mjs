import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG, getGameByCode } from '../src/games/catalog.ts';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { evaluateForks, historyStep } from './source-history-predictions.mjs';

const [env, output, ...files] = process.argv.slice(2);
const heldout = new Set(['hanoi_order', ...GAME_CATALOG.filter(g=>g.group === 'official').map(g=>g.family)]);
const engine = await sourceBackend(resolve(env));
const programs = JSON.parse(await readFile(new URL('../docs/architecture/sic-source-seven-programs.json',import.meta.url),'utf8'));
const publicState = b => [hash(b).slice(0,16),b.level,b.levelsCompleted,b.state,[...b.availableActionIds].sort().join(',')].join('/');
const entries = [];
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const r = JSON.parse(line), game = getGameByCode(r.code);
  assert.ok(game && game.group !== 'custom_4');
  if (r.error || heldout.has(game.family)) {
    entries.push({code:r.code,excluded:r.error ?? 'reserved family'});
    continue;
  }
  assert.ok(!r.resets && !r.observedPriorLevelActions && r.start === r.finish && r.steps.length === r.issued);
  const tape = sourceReplay(engine, programs, r), reference = [], history = [], forks = [];
  let board = tape.restore(0);
  reference.push(publicState(board));
  for (const s of r.steps) {
    assert.equal(hash(board).slice(0,16),s.from);
    board = tape.act(op(s));
    assert.equal(hash(board).slice(0,16),s.to);
    const next = publicState(board);
    history.push(historyStep(history.at(-1),history.at(-2),op(s),reference.at(-1),next));
    reference.push(next);
  }
  const won = tape.win(board);
  assert.equal(won,r.levels[0].won);
  const seen = new Set(), samples = [];
  for (let i=0;i+1<r.steps.length;i++) {
    const a = r.steps[i], b = r.steps[i+1];
    const sameCommand = op(a) === op(b);
    // Limit each game to the first encounter of each ordered control kind
    // and visible response, in chronological order. No score enters this choice.
    const key = [a.a,b.a,sameCommand,a.from===a.to].join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    if (samples.length === 12) break;
    const paths=[];
    forks.push(paths);
    function intervene(swap) {
      let state = tape.restore(i), pos = i, lostAgreement = null, firstMatch = null, firstDiff = null, previousSame = false;
      const branch=[];
      paths.push(branch);
      let prev=history[i-1], penultimate=history[i-2], source=reference[i];
      function compare() {
        const agrees = publicState(state) === reference[pos];
        if (agrees && firstMatch === null) firstMatch = pos-i;
        if (!agrees && firstDiff === null) firstDiff = pos-i;
        if (!agrees && previousSame && lostAgreement === null) lostAgreement = pos-i;
        previousSame = agrees;
      }
      function act(s) {
        if (tape.win(state) || state.state !== 'NOT_FINISHED' || !state.availableActionIds.includes(s.a)) return false;
        state = tape.act(op(s));
        const next=publicState(state);
        const observed=historyStep(prev,penultimate,op(s),source,next);
        branch.push(observed);
        penultimate=prev; prev=observed; source=next;
        return true;
      }
      if (swap) {
        if (!act(b) || !act(a)) return { comparable:false, won:tape.win(state) };
        pos+=2;
      } else pos++;
      compare();
      const startSame = previousSame;
      for (;pos<r.steps.length;) {
        if (!act(r.steps[pos])) {
          if (!tape.win(state) && state.state === 'NOT_FINISHED') return {comparable:false,unavailableAt:pos-i};
          break;
        }
        pos++; compare();
      }
      return {comparable:true, startSame, firstMatch, firstDiff, lostAgreement, alignedThrough:pos-i,
        won:tape.win(state), scoredDifferent:tape.win(state)!==won, completed:pos===r.steps.length };
    }
    samples.push({at:i+1,a:op(a),b:op(b),unchanged:reference[i]===reference[i+1],
      deleteA:intervene(false), swap:sameCommand ? null : intervene(true)});
  }
  entries.push({code:r.code,level:r.start,actions:r.issued,won,samples,
    historyPrediction:evaluateForks(history,forks)});
}
const trials=entries.flatMap(e=>e.samples??[]);
function stats(which) {
  const valid=trials.flatMap(t=>t[which]?.comparable?[t[which]]:[]);
  return {evaluated:valid.length,scoreChanged:valid.filter(t=>t.scoredDifferent).length,
    immediateAgreement:valid.filter(t=>t.startSame).length,
    divergedAfterAgreement:valid.filter(t=>t.lostAgreement!==null).length,
    scoreChangedDespiteImmediateAgreement:valid.filter(t=>t.startSame && t.scoredDifferent).length,
    positiveOnlyLater:valid.filter(t=>t.firstMatch!==null && t.firstMatch>(which==='swap'?2:1)).length };
}
const summary={entries:entries.filter(e=>e.samples).length,excluded:entries.filter(e=>e.excluded).length,
  originallyWon:entries.filter(e=>e.won).length,pairs:trials.length,deleteA:stats('deleteA'),swap:stats('swap')};
await writeFile(output,JSON.stringify({summary,entries},null,2)+'\n');
console.log(JSON.stringify(summary));
