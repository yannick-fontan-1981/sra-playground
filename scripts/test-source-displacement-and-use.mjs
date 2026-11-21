import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getGameByCode } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { changedFootprints, footprints } from './source-contact-footprints.mjs';

// From a witnessed ineffective B, compare two displacements of the same
// persistent shape at equal cost. B is identical in all three conditions.
const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const results = [];
const id = word => Number(word.split(':')[0].slice(6));
for (const file of files) {
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const run = JSON.parse(line), game = getGameByCode(run.code);
    assert.ok(game && game.group !== 'custom_4');
    if (run.error || run.resets || run.observedPriorLevelActions || run.sourcePrefixActions) continue;
    const replay = sourceReplay(engine, {}, run);
    const live = board => !replay.win(board) && board.state === 'NOT_FINISHED';
    const tested = new Set(), experiments = [];
    let preparationsTested = 0;
    for (const [i, step] of run.steps.entries()) {
      if (step.from !== step.to || i + 2 > run.cap || tested.size >= 8) continue;
      const use = op(step), scene = step.from + '/' + use;
      if (tested.has(scene)) continue;
      tested.add(scene);
      const root = replay.restore(i), rootView = footprints(root.frame);
      const alone = replay.act(use);
      assert.equal(hash(root), hash(alone));
      if (!live(alone)) continue;
      const recent = run.steps.slice(0, i).filter(s => s.a === 6).map(op).reverse();
      const controls = root.availableActionIds.flatMap(n => n === 6 ? [...new Set(recent)].slice(0, 4) : ['ACTION' + n]);
      const byRole = new Map();
      for (const prepare of controls.filter(a => a !== use)) {
        replay.restore(i);
        const placed = replay.act(prepare);
        preparationsTested++;
        if (!live(placed) || hash(placed) === hash(root) || !placed.availableActionIds.includes(id(use))) continue;
        const placedView = footprints(placed.frame);
        const moves = changedFootprints(rootView, placedView);
        if (!moves.length) continue;
        const after = replay.act(use), scored = replay.win(after);
        const changed = hash(after) !== hash(placed);
        if (!scored && !live(after)) continue;
        const afterView = !scored && changed ? footprints(after.frame) : placedView;
        const responses = !scored && changed ? changedFootprints(placedView, afterView) : [];
        const stationaryShapeMoved = responses.some(response => {
          const initial = rootView.get(response.shape), beforeUse = placedView.get(response.shape);
          return initial && beforeUse && initial.size === beforeUse.size && [...initial.keys()].every(box => beforeUse.has(box));
        });
        for (const move of moves) {
          const key = JSON.stringify([move.shape, move.from.bbox]);
          const items = byRole.get(key) ?? [];
          const returnedToRoot = !scored && hash(after) === hash(root);
          const locations = afterView.get(move.shape);
          const placementKept = !scored && !!locations?.has(move.to.bbox.join()) && !locations.has(move.from.bbox.join());
          items.push({prepare, destination: move.to.bbox, won:scored, changed, returnedToRoot, placementKept, stationaryShapeMoved});
          byRole.set(key, items);
        }
      }
      for (const [role, options] of byRole) {
        if (new Set(options.map(o => o.destination.join())).size < 2) continue;
        const contrasts = options.flatMap(positive => {
          if (!positive.changed && !positive.won) return [];
          return options.filter(rival => rival.destination.join() !== positive.destination.join() &&
            (positive.won ? !rival.won : !rival.changed && !rival.won))
            .map(rival => ({positive:positive.prepare, rival:rival.prepare, score:positive.won,
              returnedToRoot:positive.returnedToRoot, placementKept:positive.placementKept, stationaryShapeMoved:positive.stationaryShapeMoved}));
        });
        experiments.push({prefix:i, use, actorOrigin:JSON.parse(role)[1], options, contrasts});
      }
    }
    results.push({code:run.code, level:run.start, baselineWon:run.levels[0].won,
      blockedUsesTested:tested.size, preparationsTested, experiments});
  }
}
await writeFile(output, JSON.stringify(results));
console.log('matched displacement groups', results.reduce((sum, r) => sum + r.experiments.length, 0));
