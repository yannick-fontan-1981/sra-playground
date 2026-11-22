import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { measureEffect } from '../src/sic/preparation-experiments.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceInterface } from './sic-study-source-interface.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

const [environment, output, ...files] = process.argv.slice(2);
if (!files.length) throw Error('Expected a source environment, output file and direct-entry tapes.');
const source = await sourceBackend(resolve(environment));
const image = board => hash(board).slice(0,16);

function changedInks(before, after) {
  const groups = new Map();
  for (const [y,row] of before.entries()) for (const [x,ink] of row.entries()) {
    const mark = after[y][x];
    if (ink === mark) continue;
    const key = ink + '/' + mark;
    if (!groups.has(key)) groups.set(key, { ink, mark, pixels: [] });
    groups.get(key).pixels.push([x,y]);
  }
  return [...groups.values()];
}

function displacementTest(group, marked, controlAfter, markedAfter, dx, dy) {
  const { ink, mark, pixels } = group;
  const contains = new Set(pixels.map(p => p.join(',')));
  const entering = pixels.map(([x,y]) => [x+dx,y+dy]).filter(p => !contains.has(p.join(',')));
  const leaving = pixels.filter(([x,y]) => !contains.has([x-dx,y-dy].join(',')));
  const at = (rows,[x,y]) => rows[y]?.[x];
  const controlled = pixels.every(p => at(controlAfter,p) === ink);
  const visibleEntry = entering.filter(p => at(marked,p) !== mark && at(controlAfter,p) !== mark);
  const visibleExit = leaving.filter(p => at(marked,p) === mark);
  const appears = visibleEntry.filter(p => at(markedAfter,p) === mark).length;
  const disappears = visibleExit.filter(p => at(markedAfter,p) !== mark).length;
  const translated = controlled && visibleEntry.length > 0 && visibleExit.length > 0
    && appears === visibleEntry.length && disappears === visibleExit.length
    && pixels.every(([x,y]) => at(markedAfter,[x+dx,y+dy]) === mark);
  const stationary = controlled && visibleEntry.length > 0 && visibleExit.length > 0 && appears === 0
    && pixels.every(p => at(markedAfter,p) === mark);
  return { ink, mark, size: pixels.length, dx, dy, originalInkStayedInControl: controlled,
    visibleEntry: visibleEntry.length, appears, visibleExit: visibleExit.length, disappears, translated, stationary };
}

async function compare(run, i) {
  const tape = run.replayCommands, q = tape[i].silentInput, replay = sourceReplay(sourceInterface(source,run.sourceInterface),{},run);
  const observations = new Map();
  async function observation(board) {
    const key = hash(board);
    if (!observations.has(key)) observations.set(key, await measureNativeObservation({
      frame_rows: board.frame, frame_hash: key, level: board.level, levels_completed: board.levelsCompleted,
      state: board.state, available_action_refs: board.availableActionIds.map(n => 'ACTION'+n),
    }, 0, 'comparison'));
    return observations.get(key);
  }
  const movements = async (a,b) => measureEffect(await observation(a),await observation(b),a.frame,b.frame).moves;
  const prepared = () => {
    const b = replay.restore(i);
    assert.equal(image(b), tape[i].from);
    return b;
  };
  const bare = prepared(), marked = replay.act(q.probe);
  assert.equal(image(marked), tape[i].to);
  const groups = changedInks(bare.frame,marked.frame);
  const witnessedMotors = new Set(), alternatives = [], observedReturns = new Map();
  let before = replay.restore(0);
  for (const [j,step] of run.steps.slice(0,i).entries()) {
    const input = op(step), after = replay.act(input);
    const motion = await movements(before,after);
    if (!input.includes(':') && input !== q.probe && motion.length) witnessedMotors.add(input);
    if (image(before)===image(bare)) {
      const returns = observedReturns.get(input) ?? new Set();
      returns.add(hash(after));
      observedReturns.set(input,returns);
      const [move] = motion;
      if (motion.length===1 && (await observation(marked)).entities.some(e =>
          !e.identity_ambiguous && e.signature===move.actor && e.position.join(',')===move.from)) {
        for (const g of groups) {
          if (!g.pixels.every(([x,y]) => marked.frame[y+move.dy]?.[x+move.dx]!==undefined)) continue;
          const geometry = displacementTest(g,marked.frame,after.frame,marked.frame,move.dx,move.dy);
          if (geometry.stationary) alternatives.push({motor:input,ink:g.ink,mark:g.mark,dx:move.dx,dy:move.dy,
            support:j+1,distinguishingPixels:geometry.visibleEntry+geometry.visibleExit});
        }
      }
    }
    before = after;
  }
  // Choose using only the public prefix. The paired interventions below score this choice.
  const chosen = alternatives.filter(p => observedReturns.get(p.motor).size===1 && witnessedMotors.has(p.motor))
    .sort((a,b) => b.distinguishingPixels-a.distinguishingPixels || b.support-a.support)[0] ?? null;
  const trials = [];
  for (const motor of witnessedMotors) {
    const actionId = Number(motor.slice(6));
    if (![bare,marked].every(b => b.availableActionIds.includes(actionId))) continue;
    function branches() {
      prepared();
      const control = replay.act(motor);
      prepared();
      assert.equal(image(replay.act(q.probe)),image(marked));
      return {control,experimental:replay.act(motor)};
    }
    const {control,experimental} = branches(), again = branches();
    assert.equal(hash(control),hash(again.control));
    assert.equal(hash(experimental),hash(again.experimental));
    const normal = await movements(bare,control), changed = await movements(marked,experimental);
    const vectors = new Set(normal.filter(m => changed.some(n => n.actor===m.actor && n.from===m.from && n.to===m.to))
      .map(m => [m.dx,m.dy].join(',')));
    const tests = [...vectors].flatMap(v => {
      const [dx,dy] = v.split(',').map(Number);
      return groups.map(g => displacementTest(g,marked.frame,control.frame,experimental.frame,dx,dy));
    });
    trials.push({motor, control:image(control), afterTest:image(experimental), tests,
      official:{control:replay.win(control),afterTest:replay.win(experimental)}});
  }
  const t = chosen && trials.find(t=>t.motor===chosen.motor)?.tests.find(t=>
    t.ink===chosen.ink && t.mark===chosen.mark && t.dx===chosen.dx && t.dy===chosen.dy);
  return {game:run.code,level:run.start,action:i+1,preparation:q.prepare,probe:q.probe,
    prepared:image(bare),marked:image(marked),chosen,
    result:!chosen?'no_discriminating_motor':t?.translated?'mark_followed_the_movement':
      t?.stationary?'mark_stayed_fixed':'neither_prediction_verified',trials};
}

const results = [];
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run = JSON.parse(line.replace(/^\uFEFF/,''));
  if (run.error || run.resets || run.start!==run.finish || run.observedPriorLevelActions || run.sourcePrefixActions) continue;
  for (const [i,step] of run.replayCommands.entries()) {
    if (step.silentInput?.phase!=='probe' || step.from===step.to || run.preparation.find(p => p.actionIndex===i+1)?.result!=='previously_silent_input_changed_the_arrangement') continue;
    results.push(await compare(run,i));
  }
}
await writeFile(output,JSON.stringify(results,null,2)+'\n');
