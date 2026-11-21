import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getGameByCode } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { groupsOf, observedRoleMoves } from '../src/sic/exchange-roles.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';
const [env, out, ...files] = process.argv.slice(2),
  engine = await sourceBackend(env),
  episodes = [];
const same = (p, q) => p[0] === q[0] && p[1] === q[1],
  sign = (p, q) => p.map((v, i) => Math.sign(q[i] - v));
async function groups(b) {
  const o = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      state: b.state,
      levels_completed: b.levelsCompleted,
      available_action_refs: b.availableActionIds.map((k) => 'ACTION' + k),
    },
    0,
    'source-exchange',
  );
  return groupsOf(o);
}
for (const file of files)
  for (const line of (await readFile(file, 'utf8')).trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    assert.ok(getGameByCode(r.code) && getGameByCode(r.code).group !== 'custom_4');
    if (r.error || r.resets || r.sourcePrefixActions || r.observedPriorLevelActions || r.start !== r.finish)
      continue;
    const rep = sourceReplay(engine, {}, r),
      rules = new Map(),
      seen = new Set(),
      result = {
        code: r.code,
        level: r.start,
        actions: 0,
        swaps: 0,
        predictions: 0,
        confirmed: 0,
        rivalConfirmed: 0,
        competingTargets: 0,
      };
    let b = rep.restore(0),
      before = await groups(b);
    for (const [i, c] of r.steps.entries()) {
      const cmd = op(c),
        pred = [],
        eligible = c.a >= 1 && c.a <= 4 && !seen.has(c.from + '/' + cmd);
      seen.add(c.from + '/' + cmd);
      if (eligible)
        for (const rule of rules.values()) {
          if (rule.cmd !== cmd) continue;
          const actors = before.get(rule.actor),
            parts = before.get(rule.piece);
          if (actors?.size !== 1 || !parts) continue;
          const origin = [...actors.values()][0].position;
          const targets = [...parts.values()]
            .map((v) => v.position)
            .filter((p) => same(rule.direction, sign(origin, p)))
            .sort(
              (a, b) =>
                Math.abs(a[0] - origin[0]) +
                Math.abs(a[1] - origin[1]) -
                Math.abs(b[0] - origin[0]) -
                Math.abs(b[1] - origin[1]),
            );
          if (targets.length)
            pred.push({ ...rule, origin, target: targets[0], alternatives: targets.length });
        }
      b = rep.act(cmd);
      assert.equal(hash(b).slice(0, 16), c.to);
      if (rep.win(b) || b.state !== 'NOT_FINISHED') break;
      const after = await groups(b);
      if (eligible) {
        result.actions++;
        const fulfilled = (p, ret) =>
          ret.get(p.actor)?.size === 1 &&
          ret.get(p.actor).has(p.target.join()) &&
          ret.get(p.piece)?.has(p.origin.join()) &&
          !ret.get(p.piece)?.has(p.target.join());
        if (pred.length) {
          result.predictions++;
          if (pred.some((p) => p.alternatives > 1)) result.competingTargets++;
          const correct = pred.filter((p) => fulfilled(p, after));
          if (correct.length) {
            result.confirmed++;
            rep.restore(i);
            const rival = b.availableActionIds.find((k) => k >= 1 && k <= 4 && k !== c.a);
            if (rival) {
              const cmp = rep.act('ACTION' + rival);
              if (cmp.state === 'NOT_FINISHED' && !rep.win(cmp)) {
                const alternative = await groups(cmp);
                if (correct.some((p) => fulfilled(p, alternative))) result.rivalConfirmed++;
              }
            }
            b = rep.restore(i + 1);
          }
        }
        const moves = observedRoleMoves(before, after);
        let witnessed = false;
        for (const a of moves)
          for (const p of moves) {
            if (
              a.role.signature === p.role.signature ||
              !same(a.from, p.to) ||
              !same(a.to, p.from) ||
              a.role.fixed.length
            )
              continue;
            const direction = sign(a.from, a.to);
            if ((direction[0] === 0) === (direction[1] === 0)) continue;
            const rule = { actor: a.role.signature, piece: p.role.signature, cmd, direction };
            rules.set(JSON.stringify(rule), rule);
            witnessed = true;
          }
        if (witnessed) result.swaps++;
      }
      before = after;
    }
    episodes.push(result);
  }
const counts = Object.fromEntries(
  ['actions', 'swaps', 'predictions', 'confirmed', 'rivalConfirmed', 'competingTargets'].map((k) => [
    k,
    episodes.reduce((n, r) => n + r[k], 0),
  ]),
);
await writeFile(out, JSON.stringify({ counts, episodes }));
console.log(JSON.stringify({ episodes: episodes.length, ...counts }));
