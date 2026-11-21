import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { groupsOf, observedRoleMoves } from '../src/sic/exchange-roles.ts';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';

const [env, out, ...files] = process.argv.slice(2),
  engine = await sourceBackend(env),
  episodes = [];
const add = (a, d, n = 1) => a.map((x, i) => x + n * d[i]),
  same = (a, b) => a.every((v, i) => v === b[i]);
async function observe(b) {
  return groupsOf(
    await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        state: b.state,
        levels_completed: b.levelsCompleted,
        available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
      },
      0,
      'contact',
    ),
  );
}
for (const name of files)
  for (const line of (await readFile(name, 'utf8')).trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== 'custom_4',
    );
    if (
      r.error ||
      r.resets ||
      r.sourcePrefixActions ||
      r.observedPriorLevelActions ||
      r.start !== r.finish
    )
      continue;
    const rep = sourceReplay(engine, {}, r),
      seen = new Set(),
      models = new Map();
    const result = {
      code: r.code,
      level: r.start,
      push: { observed: 0, tested: 0, matched: 0, rivalMatched: 0 },
      pull: { observed: 0, tested: 0, matched: 0, rivalMatched: 0 },
    };
    let b = rep.restore(0),
      prior = await observe(b);
    for (const [i, c] of r.steps.entries()) {
      const cmd = op(c),
        unique = c.a >= 1 && c.a <= 4 && !seen.has(c.from + '/' + cmd);
      seen.add(c.from + '/' + cmd);
      const forecasts = [];
      if (unique)
        for (const m of models.values()) {
          if (m.cmd !== cmd || prior.get(m.subject)?.size !== 1) continue;
          const origin = [...prior.get(m.subject).values()][0].position,
            near = add(origin, m.delta, m.kind === 'push' ? 1 : -1);
          if (!prior.get(m.piece)?.has(near.join())) continue;
          forecasts.push({
            ...m,
            to: add(origin, m.delta),
            near,
            destination: add(near, m.delta),
          });
        }
      b = rep.act(cmd);
      assert.equal(hash(b).slice(0, 16), c.to);
      if (rep.win(b) || b.state !== 'NOT_FINISHED') break;
      const returned = await observe(b);
      if (unique) {
        const matches = (m, l) =>
          l.get(m.subject)?.has(m.to.join()) &&
          l.get(m.piece)?.has(m.destination.join()) &&
          !l.get(m.piece)?.has(m.near.join());
        for (const kind of ['push', 'pull']) {
          const predicted = forecasts.filter((v) => v.kind === kind);
          if (!predicted.length) continue;
          result[kind].tested++;
          const got = predicted.filter((v) => matches(v, returned));
          if (!got.length) continue;
          result[kind].matched++;
          const other = b.availableActionIds.find(
            (n) => n >= 1 && n <= 4 && n !== c.a,
          );
          if (other) {
            rep.restore(i);
            const rival = rep.act('ACTION' + other);
            if (rival.state === 'NOT_FINISHED' && !rep.win(rival)) {
              const l = await observe(rival);
              if (got.some((v) => matches(v, l))) result[kind].rivalMatched++;
            }
            b = rep.restore(i + 1);
          }
        }
        const moves = observedRoleMoves(prior, returned),
          kinds = new Set();
        for (const a of moves) {
          if (a.role.fixed.length) continue;
          const delta = a.to.map((v, i) => v - a.from[i]);
          if ((delta[0] === 0) === (delta[1] === 0)) continue;
          for (const p of moves) {
            if (
              p.role.signature === a.role.signature ||
              !same(add(p.from, delta), p.to)
            )
              continue;
            const kind = same(a.to, p.from)
              ? 'push'
              : same(a.from, p.to)
                ? 'pull'
                : null;
            if (!kind) continue;
            const model = {
              kind,
              cmd,
              delta,
              subject: a.role.signature,
              piece: p.role.signature,
            };
            models.set(JSON.stringify(model), model);
            kinds.add(kind);
          }
        }
        for (const kind of kinds) result[kind].observed++;
      }
      prior = returned;
    }
    episodes.push(result);
  }
const sums = Object.fromEntries(
  ['pull', 'push'].map((kind) => [
    kind,
    Object.fromEntries(
      ['observed', 'tested', 'matched', 'rivalMatched'].map((k) => [
        k,
        episodes.reduce((n, r) => n + r[kind][k], 0),
      ]),
    ),
  ]),
);
await writeFile(out, JSON.stringify({ sums, episodes }));
console.log(JSON.stringify({ episodes: episodes.length, ...sums }));
