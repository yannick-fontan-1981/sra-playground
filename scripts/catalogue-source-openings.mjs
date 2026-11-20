import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';

// Offline intervention. Replay the same publicly reached source entry for each branch.
const [env, programFile, entryFile, code, levelArg, output] = process.argv.slice(2);
const level = Number(levelArg),
  src = JSON.parse(await readFile(programFile, 'utf8')),
  entries = JSON.parse(await readFile(entryFile, 'utf8'));
const word = src.niveaux_supérieurs.find((r) => r.code === code && r.l === level)?.seq;
if (!word || word.length < 3) throw Error('No verified source program');
const entry = entries.find((r) => r.code === code && r.level === level && r.confirmed);
if (!entry) throw Error('Missing source entry');
const stopping = process.argv[8] === 'stopping';
const compose = process.argv[8] === 'compose' || stopping;
if (compose && word.length < 4) throw Error('Two preparations require four recorded commands');
const start = word.slice(0, compose ? -4 : -3),
  [setup, transport, use] = word.slice(-3);
const commands = [
  ...new Set([
    ...src.niveau_1[code].suite_gagnante,
    ...src.niveaux_supérieurs.filter((r) => r.code === code).flatMap((r) => r.seq),
  ]),
];
const engine = await sourceBackend(resolve(env));
function act(c) {
  const [id, loc] = c.split('@'),
    [x, y] = loc ? loc.split(',').map(Number) : [];
  return engine.dispatch({ type: 'action', actionId: Number(id), ...(loc ? { data: { x, y } } : {}) });
}
const won = (b) => Boolean(b && (b.level > level || b.state === 'WIN'));
const legal = (b, c) => b.availableActionIds.includes(Number(c.split('@')[0]));
const key = (b) =>
  createHash('sha256')
    .update(JSON.stringify([b.level, b.state, b.availableActionIds, b.frame]))
    .digest('hex')
    .slice(0, 24);
function replay(extra) {
  let b = engine.dispatch({ type: 'load', code, level: entry.entry === 'direct' ? level : 1 });
  if (entry.entry === 'chronological')
    for (let i = 1; i < level; i++) {
      if (b.level !== i) throw Error('Bad lower level');
      for (const op of i === 1
        ? src.niveau_1[code].suite_gagnante
        : src.niveaux_supérieurs.find((r) => r.code === code && r.l === i).seq)
        b = act(op);
    }
  else if (b.level !== level && b.canSelectLevel) b = engine.dispatch({ type: 'selectLevel', level });
  if (b.level !== level) throw Error('Bad source entry');
  for (const c of [...start, ...extra]) {
    if (won(b) || b.state === 'GAME_OVER') break;
    if (!legal(b, c)) return null;
    b = act(c);
  }
  return b;
}
const cache = new Map();
const extents = new Map();
async function parts(b) {
  const k = key(b);
  if (!cache.has(k)) {
    const o = await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: k,
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
      },
      1
    );
    cache.set(
      k,
      new Map(o.entities.filter((e) => !e.identity_ambiguous).map((e) => [e.signature, e.position.join()]))
    );
    if (stopping)
      extents.set(
        k,
        new Map(
          o.entities
            .filter((e) => !e.identity_ambiguous)
            .map((e) => [e.signature, [e.bbox[2] - e.bbox[0] + 1, e.bbox[3] - e.bbox[1] + 1]])
        )
      );
  }
  return cache.get(k);
}
if (!won(replay(word.slice(start.length)))) throw Error('Reference program failed');
if (stopping) {
  const { qualifyStoppingSurfaces } = await import('./qualify-source-stopping-surfaces.mjs');
  const data = await qualifyStoppingSurfaces({ commands, replay, parts, extents, key, won, legal });
  await writeFile(output, JSON.stringify({ code, level, ...data }) + '\n');
} else if (compose || process.argv[8] === 'inverse') {
  const { studyInversePlacements } = await import('./study-inverse-source-placements.mjs');
  const result = await studyInversePlacements({
    commands,
    replay,
    parts,
    key,
    won,
    legal,
    act,
    transport,
    use,
    compose,
  });
  await writeFile(output, JSON.stringify({ code, level, transport, use, ...result }) + '\n');
} else await catalogue();

async function catalogue() {
  const base = replay([]),
    unprepared = replay([transport]),
    first = await parts(base),
    bare = unprepared ? await parts(unprepared) : new Map();
  const represented = new Map();
  for (const prep of [
    [],
    ...commands.map((c) => [c]),
    ...commands.flatMap((a) => commands.map((b) => [a, b])),
  ]) {
    const state = replay(prep);
    if (!state || won(state) || state.state === 'GAME_OVER') continue;
    const id = key(state);
    if (!represented.has(id)) represented.set(id, prep);
  }
  const baseWin = won(replay([transport, use])),
    ref = await parts(replay([setup]));
  const catalogue = [];
  for (const [state, prep] of represented) {
    const b = replay(prep);
    if (!legal(b, transport)) continue;
    const prepared = await parts(b),
      after = act(transport);
    if (won(after) || after.state === 'GAME_OVER') continue;
    const landing = await parts(after),
      changes = [];
    for (const [actor, from] of prepared) {
      const end = landing.get(actor),
        bareTo = bare.get(actor);
      if (
        unprepared &&
        !won(unprepared) &&
        unprepared.state !== 'GAME_OVER' &&
        first.get(actor) === from &&
        end !== undefined &&
        bareTo !== undefined &&
        end !== from &&
        end !== bareTo
      )
        changes.push({ actor, from, bareTo, after: end });
    }
    const placements = [...prepared]
      .filter(([id, at]) => first.has(id) && first.get(id) !== at)
      .map(([id, at]) => ({ role: id, from: first.get(id), at }));
    const winners = [];
    for (const c of commands) {
      if (!legal(after, c)) continue;
      const registered = replay([...prep, transport]);
      if (key(registered) !== key(after)) throw Error('Unstable landing');
      if (won(act(c))) winners.push(c);
    }
    catalogue.push({
      state,
      prep,
      placements,
      unseenPlacement: placements.some((p) => ref.has(p.role) && ref.get(p.role) !== p.at),
      changedLanding: changes,
      winners,
    });
  }
  const result = {
    code,
    level,
    setup,
    transport,
    use,
    controls: commands.length,
    baseWin,
    states: catalogue.length,
    catalogued: catalogue.filter((s) => s.winners.length).length,
    alternativeOnly: catalogue.filter((s) => s.winners.length && !s.winners.includes(use)).length,
    matchedNewAccess: catalogue.filter((s) => s.changedLanding.length && s.winners.length).length,
    catalogue: catalogue.filter((s) => s.winners.length || s.changedLanding.length),
  };
  await writeFile(output, JSON.stringify(result) + '\n');
  console.log(JSON.stringify({ ...result, catalogue: undefined }));
}
