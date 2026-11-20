import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
const [env, dir, output] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const fixed = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  allowed = new Set(GAME_CATALOG.map((v) => v.code));
const runs = new Map(),
  reports = [];
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(dir, 'source-final-' + i + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code, r);
  }
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const at = (es, role) => {
  const parts = es.filter((x) => x.signature === role.signature);
  return parts.length === role.fixed.length + 1 &&
    role.fixed.every((k) => parts.some((v) => v.position.join() === k))
    ? (parts.find((x) => !role.fixed.includes(x.position.join()))?.position ?? null)
    : null;
};
for (let shard = 0; shard < 5; shard++) {
  const fields = JSON.parse(await readFile(join(dir, 'field17-lower' + shard + '.json'), 'utf8')),
    rects = JSON.parse(await readFile(join(dir, 'rectangle20-lower' + shard + '.json'), 'utf8'));
  for (const group of rects) {
    if (!allowed.has(group.code)) throw Error('Source games only');
    const r = runs.get(group.code),
      rep = sourceReplay(engine, fixed, r),
      inspect = publicParts();
    for (const row of group.cases)
      for (const t of row.tickets) {
        if (!t.nonAdditive && !t.jointWin) continue;
        const selection = fields
            .find((v) => v.code === group.code)
            .cases.find((v) => v.i === row.i && v.a === row.a && v.q === row.q),
          reference = { signature: selection.anchor, fixed: [] };
        const root = rep.restore(selection.write),
          keys = root.availableActionIds
            .filter((x) => x !== 6)
            .map((x) => 'ACTION' + x)
            .filter((k) => k !== row.q);
        const play = (word) => {
          let b = rep.restore(selection.write);
          for (const k of word) {
            if (b.state !== root.state || rep.win(b)) return null;
            b = rep.act(k);
          }
          return b;
        };
        const rounds = [];
        let words = [[]];
        for (let n = 0; n <= 4; n++) {
          const slots = t.origins.map(() => ({
            images: new Set(),
            count: 0,
            correct: 0,
            actual: [],
            witnesses: [],
          }));
          for (const word of words) {
            const b = play(word);
            if (!b || rep.win(b) || b.state !== root.state) continue;
            const state = await inspect(b),
              p = at(state.parts, selection.role),
              a = at(state.parts, reference);
            const ix = t.origins.findIndex(([x, y]) => eq(p, x) && eq(a, y));
            if (ix < 0) continue;
            const slot = slots[ix];
            slot.count++;
            const h = state.hash ?? JSON.stringify(b.frame);
            if (slot.images.has(h) || slot.images.size >= 5) continue;
            slot.images.add(h);
            const result = rep.act(row.q),
              next =
                rep.win(result) || result.state !== root.state
                  ? null
                  : at((await inspect(result)).parts, selection.role);
            const d = next ? [next[0] - p[0], next[1] - p[1]] : null;
            slot.actual.push(d);
            slot.witnesses.push(word);
            slot.correct += Number(eq(d, t.ds[ix]) || (!d && rep.win(result) === t.wins[ix] && !t.ds[ix]));
          }
          rounds.push({ length: n, slots: slots.map(({ images, ...v }) => ({ ...v, images: images.size })) });
          if (n < 4) words = words.flatMap((w) => keys.map((k) => [...w, k]));
        }
        reports.push({
          code: r.code,
          level: r.start,
          i: row.i,
          a: row.a,
          b: t.b,
          q: row.q,
          positions: t.origins,
          forecast: t.ds,
          rounds,
        });
      }
  }
}
await writeFile(output, JSON.stringify(reports));
