import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [environment, directory, output] = process.argv.slice(2);
const games = Array.from({ length: 8 }, (_, i) =>
  readFileSync(resolve(directory, 'source-final-' + i + '.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .map(JSON.parse)
).flat();
if (
  games
    .map((g) => g.code)
    .sort()
    .join() !==
  GAME_CATALOG.map((g) => g.code)
    .sort()
    .join()
)
  throw Error('Expected the 100 source games');
const e = await sourceBackend(resolve(environment));
const result = [];
const hash = (b) => createHash('sha256').update(JSON.stringify(b.frame)).digest('hex').slice(0, 16);
for (const g of games) {
  const steps = g.steps;
  const chosen = steps.findIndex((s, i) => s.from !== s.to && i + 5 < steps.length);
  if (chosen < 0) {
    result.push({ code: g.code, eligible: false });
    continue;
  }
  const snapshots = new Map();
  async function snap(b) {
    const h = hash(b);
    if (!snapshots.has(h)) {
      const m = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: h,
          level: b.level,
          state: b.state,
          levels_completed: b.levelsCompleted,
          available_action_refs: [],
        },
        1
      );
      snapshots.set(
        h,
        new Map(m.entities.filter((x) => !x.identity_ambiguous).map((x) => [x.signature, x.position.join()]))
      );
    }
    return { parts: snapshots.get(h), h, terminal: b.level > 1 || b.state !== 'NOT_FINISHED' };
  }
  async function arm(omit) {
    let b = e.dispatch({ type: 'load', code: g.code, level: 1 });
    const out = [];
    for (let i = 0; i <= chosen + 5; i++) {
      if (i >= chosen) out.push(await snap(b));
      const s = steps[i];
      if (!omit && hash(b) !== s.from) throw Error(g.code + ' start mismatch');
      if ((i !== chosen || !omit) && b.level === 1 && b.state === 'NOT_FINISHED')
        b = e.dispatch({ type: 'action', actionId: s.a, ...(s.a === 6 ? { data: s.data } : {}) });
      if (!omit && hash(b) !== s.to) throw Error(g.code + ' end mismatch');
    }
    out.push(await snap(b));
    return out;
  }
  const full = await arm(false),
    bare = await arm(true);
  let first = null,
    terminal = null;
  for (let j = 1; j <= 5; j++) {
    if (full[j + 1].terminal || bare[j + 1].terminal) {
      terminal = j;
      break;
    }
    if (
      [...full[j].parts].some(
        ([id, at]) =>
          bare[j].parts.get(id) === at &&
          full[j + 1].parts.has(id) &&
          bare[j + 1].parts.has(id) &&
          full[j + 1].parts.get(id) !== at &&
          full[j + 1].parts.get(id) !== bare[j + 1].parts.get(id)
      )
    ) {
      first = j;
      break;
    }
  }
  result.push({ code: g.code, eligible: true, chosen, first, terminal });
}
writeFileSync(output, JSON.stringify(result) + '\n');
console.log(
  JSON.stringify({
    cohort: result.length,
    eligible: result.filter((g) => g.eligible).length,
    delayed: result.filter((g) => g.first > 1).length,
  })
);
