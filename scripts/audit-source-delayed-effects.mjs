import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';

// Offline interventions in the source cohort. Original and omitted arms execute the same suffix.
const [environment, sourcePath, output] = process.argv.slice(2);
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const levels = source['niveaux_supérieurs'];
const allowed = new Set(Object.keys(source.niveau_1));
const backend = await sourceBackend(resolve(environment));
const summary = [];
for (const { code, l: level, seq } of levels) {
  if (!allowed.has(code) || level < 2) throw Error('Unexpected source level');
  const cache = new Map();
  async function snapshot(board) {
    const signature = createHash('sha256').update(JSON.stringify(board.frame)).digest('hex');
    if (!cache.has(signature)) {
      const measured = await measureNativeObservation(
        {
          frame_rows: board.frame,
          frame_hash: signature,
          level: board.level,
          state: board.state,
          levels_completed: board.levelsCompleted,
          available_action_refs: [],
        },
        1
      );
      cache.set(
        signature,
        new Map(
          measured.entities
            .filter((e) => !e.identity_ambiguous)
            .map((e) => [e.signature, e.position.join(',')])
        )
      );
    }
    return {
      won: board.level > level || board.state === 'WIN',
      image: signature,
      parts: cache.get(signature),
    };
  }
  function issue(command) {
    const [action, click] = command.split('@');
    const [x, y] = click ? click.split(',').map(Number) : [];
    return backend.dispatch({
      type: 'action',
      actionId: Number(action),
      ...(click ? { data: { x, y } } : {}),
    });
  }
  let entry = 'direct';
  async function replay(omit) {
    let board = backend.dispatch({ type: 'load', code, level: entry === 'direct' ? level : 1 });
    if (entry === 'chronological') {
      for (let l = 1; l < level; l++) {
        const prefix =
          l === 1
            ? source.niveau_1[code].suite_gagnante
            : levels.find((r) => r.code === code && r.l === l)?.seq;
        if (!prefix || board.level !== l) return [];
        for (const command of prefix) board = issue(command);
      }
      if (board.level !== level) return [];
    } else if (board.level !== level && board.canSelectLevel)
      board = backend.dispatch({ type: 'selectLevel', level });
    if (board.level !== level) throw Error('Wrong initial level for ' + code);
    const scenes = [await snapshot(board)];
    for (const [index, command] of seq.entries()) {
      if (index !== omit && !scenes.at(-1).won && board.state !== 'GAME_OVER') {
        board = issue(command);
      }
      scenes.push(await snapshot(board));
    }
    return scenes;
  }
  let full = await replay(-1);
  if (!full.at(-1)?.won) {
    entry = 'chronological';
    full = await replay(-1);
  }
  const cases = [];
  if (full.at(-1)?.won)
    for (let omit = 0; omit < seq.length - 1; omit++) {
      const bare = await replay(omit);
      if (bare[omit].image !== full[omit].image) throw Error('Unreproducible prefix');
      const movedAtSetup = [...full[omit].parts].filter(
        ([id, p]) => full[omit + 1].parts.has(id) && full[omit + 1].parts.get(id) !== p
      ).length;
      let firstMatchedMotion = null;
      for (let k = omit + 1; k < seq.length; k++) {
        if (full[k + 1].won || bare[k + 1].won) break;
        const found = [...full[k].parts].some(([id, start]) => {
          if (bare[k].parts.get(id) !== start) return false;
          const prepared = full[k + 1].parts.get(id),
            alone = bare[k + 1].parts.get(id);
          return prepared !== undefined && alone !== undefined && prepared !== start && prepared !== alone;
        });
        if (found) {
          firstMatchedMotion = k - omit;
          break;
        }
      }
      cases.push({
        omit,
        movedAtSetup,
        setupImageChanged: full[omit].image !== full[omit + 1].image,
        firstMatchedMotion,
        fixedSuffixLost: !bare.at(-1).won,
      });
    }
  summary.push({ code, level, entry, confirmed: Boolean(full.at(-1)?.won), length: seq.length, cases });
}
await writeFile(output, JSON.stringify(summary) + '\n');
console.log(
  JSON.stringify({
    levels: summary.length,
    confirmed: summary.filter((r) => r.confirmed).length,
    comparisons: summary.reduce((a, b) => a + b.cases.length, 0),
  })
);
