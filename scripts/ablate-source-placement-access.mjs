import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, dir, proofFile, output] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  source = new Map(),
  report = [];
for (let i = 0; i < 8; i++)
  for (const l of (await readFile(join(dir, 'source-final-' + i + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    source.set(r.code, r);
  }
const equal = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
for (const row of JSON.parse(await readFile(proofFile, 'utf8'))) {
  if (!allowed.has(row.code) || row.level !== 1) throw Error('Original source games only');
  if (!row.examples.length) continue;
  const r = source.get(row.code),
    rep = sourceReplay(engine, {}, r),
    read = publicParts(),
    sealedName = proofFile.replace('-proof-', '-');
  const data = JSON.parse(await readFile(sealedName, 'utf8')).find((v) => v.code === r.code);
  for (const example of row.examples) {
    const p = data.inverses.find(
      (p) =>
        p.i === example.i &&
        p.a === example.setup &&
        p.q === example.act &&
        p.length === example.length &&
        equal(p.to, example.arrival)
    );
    if (!p) throw Error('Missing prospective plan');
    const active = (b) => b && !rep.win(b) && b.state !== 'GAME_OVER',
      ops = new Set(
        r.steps
          .slice(0, p.i - 1)
          .map(op)
          .filter((k) => k.startsWith('ACTION6:'))
          .reverse()
      );
    const root = rep.restore(p.i - 1);
    if (!hash(root).startsWith(p.root)) throw Error('Wrong origin');
    const keys = (b) => [
      ...b.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n),
      ...(b.availableActionIds.includes(6) ? [...ops] : []),
    ];
    function run(ks) {
      let b = rep.restore(p.i - 1);
      for (const k of ks) {
        if (!active(b)) break;
        b = rep.act(k);
      }
      return b;
    }
    const coords = async (b) => {
      if (!active(b)) return [];
      const parts = (await read(b)).parts;
      return [p.role, { signature: p.anchor, fixed: [] }].map((r) => {
        const c = parts.filter((e) => e.signature === r.signature);
        if (c.length !== r.fixed.length + 1 || !r.fixed.every((k) => c.some((e) => e.position.join() === k)))
          return null;
        return c.find((e) => !r.fixed.includes(e.position.join()))?.position ?? null;
      });
    };
    const achieved = await coords(run([...Array(p.length).fill(p.a), p.q]));
    if (!equal(achieved[0], p.to)) throw Error('Official landing changed');
    const result = {
      code: r.code,
      i: p.i,
      from: p.from,
      to: p.to,
      placement: p.placement,
      ideal: equal(p.goal, p.to),
      shortest: null,
      shortestPair: null,
      shortestWithoutA: null,
      shortestPairWithoutA: null,
      one: 0,
      two: 0,
      missingRoles: 0,
      terminal: 0,
      clicks: ops.size,
    };
    async function measure(b, word) {
      result[word.length === 1 ? 'one' : 'two']++;
      if (!active(b)) {
        result.terminal++;
        return;
      }
      const pose = await coords(b);
      if (!pose[0] || !pose[1]) result.missingRoles++;
      if (!equal(pose[0], achieved[0])) return;
      function shortest(k) {
        if (result[k] === null || word.length < result[k]) result[k] = word.length;
      }
      shortest('shortest');
      if (!word.includes(p.a)) shortest('shortestWithoutA');
      if (equal(pose[1], achieved[1])) {
        shortest('shortestPair');
        if (!word.includes(p.a)) shortest('shortestPairWithoutA');
      }
    }
    for (const a of keys(root)) {
      const b = run([a]);
      await measure(b, [a]);
      if (!active(b)) continue;
      for (const c of keys(b)) await measure(run([a, c]), [a, c]);
    }
    report.push(result);
  }
}
await writeFile(output, JSON.stringify(report));
