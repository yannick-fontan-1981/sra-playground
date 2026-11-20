import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment, sceneKey } from '../src/sic/preparation-experiments.ts';
import { offerTerritory, recordTerritory, inTerritory } from '../src/sic/pursue-territory.ts';
import { groupsOf, resolveRole } from '../src/sic/exchange-roles.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, op, hash } from './sic-study-source-replay.mjs';

const [env, dir, cohort, partition, output, extension] = process.argv.slice(2);
const [n, total] = partition.split('/').map(Number),
  engine = await sourceBackend(resolve(env));
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  runs = [],
  results = [];
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n'))
    runs.push(JSON.parse(l));
const read = (b, i) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((x) => 'ACTION' + x),
    },
    i
  );
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
for (const [k, r] of runs.entries()) {
  if (k % total !== n) continue;
  if (!allowed.has(r.code)) throw Error('Source cohort only');
  const rep = sourceReplay(engine, programs, r),
    m = initialMemory(r.start),
    tested = new Set(),
    cases = [];
  let board = rep.restore(0),
    o = await read(board, 1);
  const actorAt = (obs, g) => resolveRole(groupsOf(obs), { signature: g.actor, fixed: [] })?.position ?? null;
  const cmd = (b, key) =>
    b.availableActionIds.includes(Number(key.slice(6).split(':')[0])) ? rep.act(key) : null;
  for (const [i, c] of r.steps.entries()) {
    if (!hash(board).startsWith(c.from)) throw Error('Wrong source before');
    if (i >= 4 && i % 3 === 1 && cases.length < 24) {
      const input = new Set(board.availableActionIds.filter((x) => x !== 6).map((x) => 'ACTION' + x));
      const s = m.scenes.indexOf(sceneKey(o)),
        saved = m.territory.tried;
      // At most two distinct configurations per kind and prefix; failure of a lower ranked arm is retained too.
      const local = new Map();
      m.territory.tried = { ...saved };
      for (let j = 0; j < 28 && cases.length < 24; j++) {
        const t = offerTerritory(m, o, board.frame, s, input)?.territorial;
        if (!t) break;
        m.territory.tried[t.plan.key] = o.revision;
        const p = t.plan,
          g = t.goal,
          kind = p.kind;
        if ((local.get(kind) ?? 0) >= 2) continue;
        const id = JSON.stringify([
          g.actor,
          g.foothold,
          kind,
          p.siteAt,
          p.ideal,
          p.program.filter((x) => x.stage !== 'approach').map((v) => v.op),
        ]);
        if (tested.has(id)) continue;
        tested.add(id);
        local.set(kind, (local.get(kind) ?? 0) + 1);
        let b = rep.restore(i),
          v = await read(b, o.revision),
          active = t,
          entered = false,
          used = false,
          official = false,
          placements = 0,
          refuted = false,
          lastOp = null,
          lastFrom = null;
        const physical = [],
          branch = structuredClone(m),
          role = { signature: g.actor, fixed: [] };
        let pre = 0,
          started = false,
          failedManipulation = null;
        for (let z = 0; active && z < 28; z++) {
          const step = active.plan.program[active.cursor],
            before = actorAt(v, g);
          if (!step || (step.from && !eq(before, step.from))) {
            refuted = true;
            break;
          }
          if (!started && step.stage === 'approach') pre++;
          else started = true;
          const after = cmd(b, step.op);
          if (!after) {
            refuted = true;
            break;
          }
          const next = await read(after, v.revision + 1);
          physical.push(step.op);
          const result = recordTerritory(branch, active, v, next).detail;
          const isEntry = !entered && result.crossed && !inTerritory(g, before ?? [-1, -1]);
          if (isEntry) {
            lastOp = step.op;
            lastFrom = before;
            entered = true;
          }
          if (step.stage === 'explore' && result.success && result.crossed && !eq(result.landed, before))
            used = true;
          if (step.stage === 'displace' && result.success) placements++;
          if (result.won) {
            lastOp ??= step.op;
            lastFrom ??= before;
            official = true;
          }
          if (
            !result.success &&
            !result.crossed &&
            ['displace', 'interact'].includes(step.stage) &&
            !result.won &&
            next.state === v.state
          ) {
            failedManipulation = { prefix: physical.slice(0, -1), a: step.op };
          }
          b = after;
          v = next;
          if (!result.success && !result.crossed) refuted = true;
          active = result.won ? null : branch.territory.active;
        }
        let bare = null,
          sameOrigin = null,
          withoutPreparation = null,
          directWin = null;
        if (lastOp) {
          let base = rep.restore(i);
          for (const op of physical.slice(0, pre)) base = cmd(base, op);
          const root = await read(base, 1);
          sameOrigin = eq(lastFrom, actorAt(root, g));
          const bareBoard = cmd(base, lastOp);
          if (bareBoard) {
            directWin = rep.win(bareBoard);
            const obs = await read(bareBoard, 2);
            bare = directWin || obs.state !== root.state ? null : actorAt(obs, g);
            withoutPreparation = bare ? inTerritory(g, bare) : null;
          }
        }
        let delayed = null;
        if (extension === 'delayed' && failedManipulation && cases.filter((c) => c.delayed).length < 4) {
          const { prefix, a } = failedManipulation;
          const origin = () => {
            let b = rep.restore(i);
            for (const key of prefix) b = rep.act(key);
            return b;
          };
          const neutral = origin(),
            options = neutral.availableActionIds.filter((k) => k !== 6).map((k) => 'ACTION' + k);
          const obsOf = async (word) => {
            let b = origin();
            for (const k of word) {
              if (b.state !== neutral.state || rep.win(b)) break;
              b = cmd(b, k);
              if (!b) return null;
            }
            const win = rep.win(b);
            if (win || b.state !== neutral.state) return { win, p: null, marker: null };
            const obs = await read(b, 1);
            return {
              win,
              p: actorAt(obs, g),
              marker: p.site ? (resolveRole(groupsOf(obs), p.site)?.position ?? null) : null,
            };
          };
          const cache = new Map(),
            get = async (word) => {
              const k = word.join('/');
              if (!cache.has(k)) cache.set(k, await obsOf(word));
              return cache.get(k);
            };
          const bare = await get([]),
            prepared = await get([a]),
            evidence = [];
          if (bare && prepared)
            for (const b of options)
              for (const second of [null, ...options]) {
                const suffix = second ? [b, second] : [b],
                  alone = await get(suffix),
                  joint = await get([a, ...suffix]);
                if (!alone || !joint) continue;
                const entry = !!joint.p && inTerritory(g, joint.p) && !!alone.p && !inTerritory(g, alone.p);
                const win = joint.win && !alone.win && !prepared.win;
                const newMotion =
                  eq(bare.p, prepared.p) && eq(alone.p, bare.p) && !!joint.p && !eq(joint.p, prepared.p);
                const markerMoves =
                  eq(bare.marker, prepared.marker) &&
                  eq(alone.marker, bare.marker) &&
                  !!joint.marker &&
                  !eq(joint.marker, prepared.marker);
                if (entry || win || newMotion || markerMoves)
                  evidence.push({ suffix, entry, win, newMotion, markerMoves, alone, joint });
              }
          delayed = {
            a,
            prefix,
            sameTraveller: eq(bare?.p, prepared?.p),
            sameMarker: eq(bare?.marker, prepared?.marker),
            tested: options.length * (1 + options.length),
            entries: evidence.filter((e) => e.entry).length,
            wins: evidence.filter((e) => e.win).length,
            newMotion: evidence.filter((e) => e.newMotion).length,
            newActuation: evidence.filter((e) => e.markerMoves).length,
            examples: evidence
              .sort((a, b) => Number(b.entry || b.win) - Number(a.entry || a.win))
              .slice(0, 3),
          };
        }
        cases.push({
          i,
          kind,
          delayed,
          from: g.from,
          foothold: g.foothold,
          site: p.siteAt,
          ideal: p.ideal,
          limit: g.failed !== null,
          basis: g.basis,
          commands: physical.length,
          placements,
          entered,
          used,
          official,
          refuted,
          sameOrigin,
          bare,
          withoutPreparation,
          directWin,
          steps: entered || official ? physical : undefined,
        });
      }
      m.territory.tried = saved;
      board = rep.restore(i);
    }
    const next = rep.act(op(c));
    if (!hash(next).startsWith(c.to)) throw Error('Wrong source after');
    const after = await read(next, i + 2);
    if (o.level_epoch === after.level_epoch && o.state === after.state)
      recordExperiment(
        m,
        o,
        after,
        { action_ref: 'ACTION' + c.a, data: c.data ?? {} },
        board.frame,
        next.frame
      );
    board = next;
    o = after;
  }
  results.push({ code: r.code, level: r.start, cases });
}
await writeFile(output, JSON.stringify(results));
