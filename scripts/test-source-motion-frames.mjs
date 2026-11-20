import { unseenResponse } from './hypothesize-unseen-response.mjs';
import { naturalControls } from '../src/sic/natural-reference-controls.ts';
import { projectPreparation } from './project-source-preparations.mjs';
import { bases } from '../src/sic/motion-frames.ts';
import { proposeIdentification } from '../src/sic/identify-moving-frames.ts';
// Prequential experiment on archived source commands. An endpoint is committed before its observation.
import { inversePlans } from './predict-source-inverse-sites.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts } from './source-transfer-demonstration.mjs';
import { groupsOf, observedRoleMoves, resolveRole } from '../src/sic/exchange-roles.ts';
const [environment, dir, out, cohort, split = '0/1'] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : cohort === 'extra'
      ? [2, 3, 4, 5].map((l) => 'cold13-f' + l)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const runs = [];
for (const f of files)
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(line));
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1],
  sub = (a, b) => a.map((x, i) => x - b[i]),
  add = (a, b) => a.map((x, i) => x + b[i]);
const sizeDiff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const name = (r) => JSON.stringify([r.signature, r.fixed]);
const [shard, total] = split.split('/').map(Number),
  reports = [];
for (const [t, r] of runs.entries())
  if (t % total === shard) {
    if (!allowed.has(r.code)) throw Error('Source games only');
    const rep = sourceReplay(engine, programs, r),
      read = publicParts(),
      history = new Map(),
      known = new Map(),
      cache = new Map();
    const transitions = [];
    const inverses = [],
      tried = new Set();
    const counts = {},
      examples = [],
      seal = createHash('sha256');
    const inc = (family, out, n = 1) => {
      const s = (counts[family] ??= {});
      s[out] = (s[out] ?? 0) + n;
    };
    async function scene(b) {
      const s = hash(b).slice(0, 16);
      if (!cache.has(s)) cache.set(s, groupsOf({ entities: (await read(b)).parts }));
      return { s, g: cache.get(s) };
    }
    let board = rep.restore(0),
      now = await scene(board),
      prev = null;
    for (const [i, cmd] of r.steps.entries()) {
      if (now.s !== cmd.from) throw Error('Discontinuous source trace');
      const action = op(cmd),
        pool = known.get(action) ?? new Map(),
        queries = [];
      function sample(g, s, role) {
        const actor = resolveRole(g, role);
        if (!actor) return null;
        const anchors = new Map([
          ['world', [0, 0]],
          ['self', actor.position],
        ]);
        for (const [sig, group] of g)
          if (sig !== role.signature && group.size === 1) {
            const e = group.values().next().value;
            if (e.area <= (board.frame.length * board.frame[0].length) / 10) anchors.set(sig, e.position);
          }
        return { anchors, from: actor.position, scene: s, index: i, role };
      }
      function pairAt(e, r) {
        const before = cache.get(e.scene),
          after = cache.get(e.afterScene);
        if (!before || !after) return null;
        const from = resolveRole(before, r)?.position,
          to = resolveRole(after, r)?.position;
        return from && to ? { from, to } : null;
      }
      if (process.env.SIC_STUDY_UNSEEN === '1' && inverses.length < 32) {
        const available = [
          ...board.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n),
          ...(board.availableActionIds.includes(6)
            ? [...known.keys()].filter((k) => k.startsWith('ACTION6:'))
            : []),
        ];
        const proposal = unseenResponse({
          i,
          now,
          known,
          history,
          pairAt,
          sample,
          tried,
          transitions,
          cache,
          available,
        })[0];
        if (proposal) {
          inverses.push(proposal);
          tried.add(proposal.key);
        }
      }
      if (process.env.SIC_STUDY_NATURAL === '1' && inverses.length < 18) {
        const proposal = naturalControls({
          i,
          now,
          rows: board.frame,
          known,
          history,
          pairAt,
          sample,
          tried,
        })[0];
        if (proposal) {
          inverses.push(proposal);
          tried.add(proposal.key);
        }
      }
      if (process.env.SIC_STUDY_PAIRED_IDENTIFY === '1' && i % 3 === 0 && inverses.length < 20)
        inverses.push(
          ...proposeIdentification({
            i,
            now,
            rows: board.frame,
            known,
            history,
            sample,
            bases,
            tried,
            pairAt,
          })
        );
      if (process.env.SIC_STUDY_IDENTIFY === '1' && i % 3 === 0 && inverses.length < 20)
        inverses.push(
          ...proposeIdentification({ i, now, rows: board.frame, known, history, sample, bases, tried })
        );
      if (process.env.SIC_STUDY_INVERSE === '1' && i % 3 === 0 && inverses.length < 30) {
        const candidates = inversePlans({ i, now, rows: board.frame, known, history, sample, bases, tried });
        for (const p of candidates)
          if (process.env.SIC_STUDY_NESTED === '1')
            p.nested = projectPreparation(p, now, history, known, board.frame);
        inverses.push(...candidates);
      }
      for (const [id, role] of pool) {
        const cur = sample(now.g, now.s, role);
        if (!cur) continue;
        const h = history.get(action + '/' + id) ?? [];
        if (h.some((e) => e.scene === now.s)) continue;
        const models = bases(h, cur),
          last = h.findLast((e) => !eq(e.from, e.to));
        if (!models.length || !last) continue;
        const defaultTo = add(cur.from, sub(last.to, last.from));
        const chosen = models[0];
        const nearest = h.reduce(
          (best, e) => (sizeDiff(e.from, cur.from) < sizeDiff(best.from, cur.from) ? e : best),
          last
        );
        queries.push({
          id,
          cur,
          models: [chosen, ...models.filter((x) => x.family === 'mechanism')],
          defaultTo,
          plain: models.find((x) => x.family !== 'mechanism')?.to ?? defaultTo,
          selfOnly: models.find((x) => x.family === 'self')?.to ?? defaultTo,
          local: add(cur.from, sub(nearest.to, nearest.from)),
          h,
        });
      }
      seal.update(
        JSON.stringify(
          queries.map((q) => [
            i,
            q.id,
            q.models.map((x) => [x.family, x.to, x.refs]),
            q.defaultTo,
            q.plain,
            q.selfOnly,
            q.local,
          ])
        )
      );
      board = rep.act(action);
      const next = await scene(board);
      if (next.s !== cmd.to) throw Error('Divergent archive');
      if (!rep.win(board) && board.state !== 'GAME_OVER') {
        for (const q of queries) {
          const target = resolveRole(next.g, q.cur.role)?.position;
          for (const [j, m] of q.models.entries()) {
            const tag = j === 0 ? 'chosen' : 'mechanism',
              fid = m.family;
            inc(tag, 'issued');
            if (!target) continue;
            inc(tag, 'visible');
            for (const [k, to] of Object.entries({
              all: m.to,
              last: q.defaultTo,
              withoutMechanism: q.plain,
              trainedStride: q.selfOnly,
              nearest: q.local,
            }))
              if (eq(to, target)) inc(tag, k + 'VisibleExact');
            if (eq(target, q.cur.from)) {
              inc(tag, 'still');
              if (!eq(q.cur.from, m.to)) inc(tag, 'falseMotion');
              continue;
            }
            inc(tag, 'moved');
            if (eq(q.selfOnly, target)) inc(tag, 'trainedStrideExact');
            if (eq(q.local, target)) inc(tag, 'nearestExact');
            const exact = eq(target, m.to);
            if (exact) inc(tag, 'exact');
            if (eq(q.defaultTo, target)) inc(tag, 'lastStrideExact');
            if (eq(q.plain, target)) inc(tag, 'plainExact');
            const novel = !q.h.some((e) => eq(e.to, target));
            if (novel) {
              inc(tag, 'novel');
              if (exact) inc(tag, 'novelExact');
            }
            if (m.object && prev) {
              const prior = prev.g.get(m.object),
                here = q.cur.anchors.get(m.object);
              const old = prior?.size === 1 ? prior.values().next().value.position : null;
              const placed = old && here && !eq(old, here);
              if (placed) {
                inc(tag, 'afterPlacement');
                if (exact) inc(tag, 'afterPlacementExact');
              }
            }
            if (j === 0 && exact) inc('winningFrame', fid);
            if (exact && !eq(q.defaultTo, target) && examples.length < 3)
              examples.push({
                i: i + 1,
                action,
                family: fid,
                from: q.cur.from,
                forecast: m.to,
                defaultTo: q.defaultTo,
                novel,
                refs: m.refs.slice(-4).map((k) => k + 1),
              });
          }
        }
        for (const v of observedRoleMoves(now.g, next.g)) pool.set(name(v.role), v.role);
        known.set(action, pool);
        for (const [id, role] of pool) {
          const cur = sample(now.g, now.s, role),
            tgt = resolveRole(next.g, role);
          if (!cur || !tgt) continue;
          const k = action + '/' + id,
            hs = history.get(k) ?? [];
          if (!hs.some((e) => e.scene === now.s)) {
            hs.push({ ...cur, to: tgt.position, afterScene: next.s });
            history.set(k, hs);
          }
        }
      }
      transitions.push({ op: action, from: now.s, to: next.s, index: i });
      prev = now;
      now = next;
    }
    reports.push({
      code: r.code,
      level: r.start,
      counts,
      examples,
      seal: seal.digest('hex'),
      inverses,
      inverseSeal: createHash('sha256').update(JSON.stringify(inverses)).digest('hex'),
    });
  }
await writeFile(out, JSON.stringify(reports));
