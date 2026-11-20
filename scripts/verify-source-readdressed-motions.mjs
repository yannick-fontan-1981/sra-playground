import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';

const [environment, dir, out, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  all = new Map(),
  checks = [];
for (const n of [
  ...Array.from({ length: 8 }, (_, i) => 'source-final-' + i),
  ...['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s),
]) {
  for (const l of (await readFile(join(dir, n + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    all.set(r.code + '/' + r.start, r);
  }
}
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const f of files)
  for (const row of JSON.parse(await readFile(f, 'utf8'))) {
    if (!allowed.has(row.code)) throw Error('Expected a source game');
    const r = all.get(row.code + '/' + row.level),
      rep = sourceReplay(engine, programs, r),
      read = publicParts();
    for (const x of row.rows) {
      if (createHash('sha256').update(JSON.stringify(x.predictions)).digest('hex') !== x.seal)
        throw Error('Forecast seal differs');
      const receipts = [];
      const vocabulary = [...new Set(x.predictions.map((p) => p.k))];
      let calibration = null;
      const held = [];
      for (const [j, k] of vocabulary.entries()) {
        const examples = x.predictions.filter((p, i) => p.k === k && x.results[i].matched);
        if (!examples.length) continue;
        calibration = k;
        for (const [i, p] of x.predictions.entries())
          if (
            vocabulary.slice(j + 1).includes(p.k) &&
            examples.some((seed) => eq(seed.a, p.a) && eq(seed.partner, p.partner))
          )
            held.push(i);
        break;
      }
      const reuseSeal = createHash('sha256')
        .update(JSON.stringify(held.map((i) => x.predictions[i])))
        .digest('hex');
      const reused = [];
      for (const [i, p] of x.predictions.entries()) {
        if (!x.results[i].matched && !held.includes(i)) continue;
        const { k, undo, index } = x.edge;
        const initial = rep.restore(index);
        async function trial(word) {
          let b = rep.restore(index);
          if (hash(b) !== x.root) throw Error('Wrong experimental origin');
          for (const v of word) {
            if (
              b.state === 'WIN' ||
              b.state === 'GAME_OVER' ||
              b.levelsCompleted !== initial.levelsCompleted ||
              b.level !== initial.level
            )
              break;
            if (!b.availableActionIds.includes(Number(v.split(':')[0].slice(6))))
              return { match: false, visible: false };
            b = rep.act(v);
          }
          if (
            b.level !== initial.level ||
            b.state === 'WIN' ||
            b.state === 'GAME_OVER' ||
            b.levelsCompleted !== initial.levelsCompleted
          )
            return { match: false, visible: false };
          const { parts } = await read(b);
          function position(role) {
            const all = parts.filter((e) => e.signature === role.sig).map((e) => e.position.join());
            const rest = all.filter((v) => !role.fixed.includes(v));
            if (
              all.length !== role.fixed.length + 1 ||
              !role.fixed.every((v) => all.includes(v)) ||
              rest.length !== 1
            )
              return null;
            return rest[0].split(',').map(Number);
          }
          const a = position(p.a),
            s = position(p.partner);
          return { a, s, match: eq(a, p.a.at) && eq(s, p.q), visible: !!a && !!s, root: hash(b) === x.root };
        }
        const full = await trial([k, p.k, ...undo]);
        if (full.match !== x.results[i].matched) throw Error('Held prediction differs on replay');
        if (held.includes(i))
          reused.push({ op: p.k, target: p.partner.at, destination: p.q, matched: full.match });
        if (!full.match) continue;
        const bare = await trial([p.k]),
          noPrep = await trial([p.k, ...undo]),
          noCommand = await trial([k, ...undo]),
          noRestore = await trial([k, p.k]);
        if (!full.match || !eq(bare.a, p.direct) || !eq(bare.s, p.partner.at) || !noCommand.root)
          throw Error('Unreproducible transported gesture');
        let oneButton = false;
        for (const id of initial.availableActionIds.filter((n) => n !== 6))
          if ((await trial(['ACTION' + id])).match) {
            oneButton = true;
            break;
          }
        receipts.push({
          op: p.k,
          source: p.a.at,
          target: p.partner.at,
          destination: p.q,
          requiredPreparation: noPrep.visible && !noPrep.match,
          requiredPreparationForVisibleEndpoint: !noPrep.match,
          withoutPreparation: noPrep,
          withoutRestoration: noRestore,
          noSingleButton: !oneButton,
        });
      }
      if (receipts.length)
        checks.push({
          code: row.code,
          level: row.level,
          index: x.edge.index,
          root: x.root,
          setup: x.edge.k,
          inverse: x.edge.undo,
          seal: x.seal,
          receipts,
          calibration,
          reuseSeal,
          reused,
        });
    }
  }
await writeFile(out, JSON.stringify(checks));
