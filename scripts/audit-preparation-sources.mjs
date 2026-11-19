import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureComponentTranslations } from '../src/sic/observed-translation.ts';
const [environment, ...files] = process.argv.slice(2);
const traces = (
  await Promise.all(files.map(async (f) => (await readFile(f, 'utf8')).trim().split('\n').map(JSON.parse)))
).flat();
if (
  traces.length !== 100 ||
  traces
    .map((r) => r.code)
    .sort()
    .join() !==
    GAME_CATALOG.map((g) => g.code)
      .sort()
      .join()
)
  throw Error('Require exactly the 100 originals');
const engine = await sourceBackend(resolve(environment));
const hash = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const rows = [];
for (const r of traces.sort(
  (a, b) => Number(['KEYD', 'SWCH'].includes(b.code)) - Number(['KEYD', 'SWCH'].includes(a.code))
)) {
  let scene = engine.dispatch({ type: 'load', code: r.code, level: 1 });
  const edges = [],
    directions = {};
  for (const step of r.steps) {
    if (hash(scene.frame) !== step.from) throw Error('Prefix ' + r.code);
    const next = engine.dispatch({
      type: 'action',
      actionId: step.a,
      ...(step.a === 6 ? { data: step.data } : {}),
    });
    if (hash(next.frame) !== step.to) throw Error('Return ' + r.code);
    const moves =
      next.level === scene.level ? measureComponentTranslations(scene.frame, next.frame, (p) => p.area > 1) : [];
    const action = step.a === 6 ? '6@' + JSON.stringify(step.data) : String(step.a);
    const effect =
      moves
        .map((m) => [hash([m.from.color, m.from.mask]), ...m.displacement].join('/'))
        .sort()
        .join('|') || (step.to === step.from ? 'stationary' : 'edit');
    edges.push({ s: step.from, d: step.to, a: action, effect });
    for (const m of moves) {
      const k = [action, hash([m.from.color, m.from.mask])].join('/');
      (directions[k] ??= new Set()).add(m.displacement.join(','));
    }
    scene = next;
  }
  const pairs = [];
  for (let i = 1; i < edges.length; i++) {
    const a = edges[i - 1],
      b = edges[i];
    if (a.s === a.d || a.a === b.a) continue;
    const plain = edges.find((e) => e.s === a.s && e.a === b.a && e.effect !== b.effect);
    if (plain) pairs.push([a.a, b.a, plain.effect, b.effect]);
  }
  const varied = Object.values(directions).filter((v) => v.size > 1).length;
  rows.push({ code: r.code, pairs: pairs.length, varied });
  if (['KEYD', 'SWCH'].includes(r.code))
    console.log(
      JSON.stringify({
        code: r.code,
        actions: edges.length,
        states: new Set(edges.map((e) => e.s)).size,
        pairs: pairs.length,
        examples: pairs.slice(0, 2),
        motions: Object.entries(directions)
          .slice(0, 10)
          .map(([k, v]) => [k, [...v].slice(0, 6)]),
        effects: Object.fromEntries(
          [...new Set(edges.map((e) => e.a))].map((a) => [
            a,
            new Set(edges.filter((e) => e.a === a).map((e) => e.effect)).size,
          ])
        ),
      })
    );
}
console.log(
  JSON.stringify({
    sourceGames: rows.length,
    withMatchedContrasts: rows.filter((r) => r.pairs > 0).length,
    withVariableDisplacement: rows.filter((r) => r.varied > 0).length,
  })
);
