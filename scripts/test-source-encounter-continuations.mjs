import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {getGameByCode} from '../src/games/catalog.ts';
import {sourceBackend} from './sic-study-source-games.mjs';
import {sourceReplay, hash, op} from './sic-study-source-replay.mjs';
import {footprints} from './source-contact-footprints.mjs';
import {observeEncounterMotion, projectEncounters, preparationVisible} from './source-projected-encounters.mjs';

const [environment, evidence, ranking, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const scored = JSON.parse(await readFile(ranking,'utf8')), results = [];
const eligible = new Map(JSON.parse(await readFile(evidence,'utf8')).map(r => [r.code+'/'+r.level,r]));
const loaded = new Set();
for (const file of files) for (const line of (await readFile(file,'utf8')).trim().split(/\r?\n/)) {
  const run = JSON.parse(line), game = getGameByCode(run.code), key = run.code+'/'+run.start;
  assert.ok(game && game.group !== 'custom_4');
  if (loaded.has(key) || !eligible.has(key) || run.error || run.resets || run.sourcePrefixActions || run.observedPriorLevelActions || run.start !== run.finish) continue;
  loaded.add(key);
  const rep = sourceReplay(engine,{},run), flag = scored.rules[run.code];
  const alive = board => !rep.win(board) && board.state === 'NOT_FINISHED';
  for (const sample of eligible.get(key).samples) {
    const candidates = sample.choices.filter(p => p.flags.includes(flag) && p.verified && p.feasible && !p.win);
    if (!candidates.length) continue;
    const memory = new Map();
    let board = rep.restore(0), view = footprints(board.frame);
    const observedFrames = [board.frame];
    for (const step of run.steps.slice(0,sample.prefix)) {
      board = rep.act(op(step));
      assert.equal(hash(board).slice(0,16),step.to);
      const after = footprints(board.frame);
      if (step.a >= 1 && step.a <= 4) observeEncounterMotion(memory,view,after,op(step));
      view = after;
      observedFrames.push(board.frame);
    }
    const directions = Object.keys(sample.direct);
    const cache = new Map();
    function intervene(preparation,c) {
      const id = JSON.stringify([preparation,c]);
      if (cache.has(id)) return cache.get(id);
      let before = rep.restore(sample.prefix);
      for (const action of preparation) {
        if (!alive(before) || !before.availableActionIds.includes(Number(action.slice(6)))) return null;
        before = rep.act(action);
      }
      if (!alive(before) || !before.availableActionIds.includes(Number(c.slice(6)))) return null;
      const after = rep.act(c), won = rep.win(after), changed = hash(before) !== hash(after);
      // Compress the public difference locally. A scored transition may show
      // the next board, so spatial tests are restricted to ongoing play.
      const pixels = [];
      if (changed && alive(after)) {
        for (let y=0; y<before.frame.length; y++) for (let x=0; x<before.frame[y].length; x++)
          if (before.frame[y][x] !== after.frame[y][x]) pixels.push([x,y]);
      }
      const result = {won,changed,pixels,ongoing:alive(after)};
      cache.set(id,result);
      return result;
    }
    for (const {a,b} of candidates) {
      const projected = projectEncounters(view,memory,a,b,[board.frame[0].length,board.frame.length]);
      rep.restore(sample.prefix);
      const prepared = rep.act(a), middle = footprints(prepared.frame);
      const sites = projected.filter(p => p.flags.includes(flag) && preparationVisible(middle,p));
      if (!sites.length) continue;
      // Before observing C, propose either to reuse the last measured motor
      // or to try a distinct available non-point verb at the prepared site.
      const joined = rep.act(b);
      assert.ok(!rep.win(joined));
      if (!alive(joined)) continue;
      const commands = [b, ...joined.availableActionIds.filter(n => n > 4 && n !== 6).map(n => 'ACTION'+n)];
      for (const c of new Set(commands)) {
        const full = intervene([a,b],c);
        if (!full) continue;
        const short = [[],[a],[b]].map(p => intervene(p,c));
        const rivals = directions.filter(d => d !== a).map(d => intervene([d,b],c));
        if (a !== b) rivals.push(intervene([b,a],c));
        const valid = rivals.filter(Boolean);
        const controlsAvailable = short.every(Boolean) && valid.length > 0;
        const controls = [...short.filter(Boolean),...valid];
        const touches = (effect,site) => effect.pixels.some(xy =>
          xy.every((v,i) => Math.abs(v-site.end[i]) < site.size[i]/2));
        const atSite = sites.some(site => touches(full,site));
        const isolated = controlsAvailable && controls.every(v => v.ongoing) ? sites.filter(site =>
          touches(full,site) && controls.every(v => !touches(v,site))) : [];
        let unseenLocal = false;
        if (isolated.length) {
          rep.restore(sample.prefix);
          rep.act(a);rep.act(b);
          const next = rep.act(c);
          function patch(frame,site) {
            const [x,y] = site.end.map((v,k) => Math.ceil(v-(site.size[k]-1)/2));
            return JSON.stringify(frame.slice(y,y+site.size[1]).map(row => row.slice(x,x+site.size[0])));
          }
          unseenLocal = isolated.some(site => {
            const result = patch(next.frame,site);
            return [...observedFrames,prepared.frame,joined.frame].every(frame => patch(frame,site) !== result);
          });
        }
        results.push({code:run.code,level:run.start,prefix:sample.prefix,fixed:sample.fixed,atEnd:sample.atEnd,
          a,b,c,won:full.won,changed:full.changed,ongoing:full.ongoing,atSite,isolatedSite:isolated.length>0,unseenLocal,controlsAvailable,validRivals:valid.length,
          controlsWon:controls.some(v => v.won),controlsChanged:controls.some(v => v.changed)});
      }
    }
  }
}
await writeFile(output,JSON.stringify(results));
console.log('continuations',results.length,'scored',results.filter(v=>v.won).length);
