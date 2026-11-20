import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { publicParts, same } from './source-transfer-demonstration.mjs';
import { add, diff, length } from './source-corresponding-sites.mjs';
const [environment, directory, out, cohort, split = '0/1', selection] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const read = async (p) => JSON.parse(await readFile(p, 'utf8'));
const programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const cases = [];
if (cohort === 'upper') {
  const metadata = await read(
    new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url)
  );
  for (const { code, level, entry, confirmed } of metadata.upperLevels) {
    if (!confirmed) throw Error('Unconfirmed source');
    cases.push({
      run: { code, start: level, sourcePrefixActions: Number(entry === 'chronological') },
      won: true,
      word: programs.niveaux_supérieurs
        .find((r) => r.code === code && r.l === level)
        .seq.map((k) => 'ACTION' + k.replace('@', ':')),
    });
  }
} else if (cohort === 'lower') {
  for (let i = 0; i < 8; i++)
    for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
      .trim()
      .split('\n')) {
      const run = JSON.parse(line);
      cases.push({ run, word: run.steps.map(op), won: run.levels[0].won });
    }
} else throw Error('Expected source cohort');
const transforms = ([x, y]) => [
  [x, y],
  [x, 0],
  [0, y],
  [-x, -y],
  [-y, x],
  [y, -x],
  [-x, y],
  [x, -y],
  [y, x],
  [-y, -x],
];
const seal = (xs) => createHash('sha256').update(JSON.stringify(xs)).digest('hex');
async function measure({ run, won, word }) {
  if (!allowed.has(run.code)) throw Error('Source only');
  const res = {
    code: run.code,
    level: run.start,
    prepared: 0,
    eligible: 0,
    queries: 0,
    predictions: 0,
    exact: 0,
    official: 0,
    pairs: 0,
    verifiedPairs: 0,
    followPredictions: 0,
    followExact: 0,
    followWon: 0,
    examples: [],
  };
  if (word.length < 3) return res;
  const { buttons, origin } = await read(
    join(directory, 'forks-source11', run.code + '-' + run.start + '.json')
  );
  const replay = sourceReplay(engine, programs, run),
    observe = publicParts(),
    begin = won ? word.length - 3 : Math.min(8, word.length - 3);
  const root = replay.openEntry().b,
    complete = root.levelsCompleted;
  const win = (b) => !!b && (b.level > run.start || b.levelsCompleted > complete || b.state === 'WIN');
  const active = (b) => b && !win(b) && b.state !== 'GAME_OVER';
  const fire = (b, k) =>
    active(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? replay.act(k) : null;
  const prefix = () =>
    run.steps ? replay.restore(begin) : word.slice(0, begin).reduce(fire, replay.openEntry().b);
  if (hash(prefix()) !== origin) throw Error('Source entrance mismatch');
  const play = (keys) => keys.reduce(fire, prefix());
  const states = new Map(),
    ids = new Set(),
    stateAfter = new Map();
  for (const w of [[], ...buttons.map((k) => [k]), ...buttons.flatMap((a) => buttons.map((b) => [a, b]))]) {
    const b = play(w);
    if (!active(b)) continue;
    const key = hash(b);
    if (states.has(key)) continue;
    const s = await observe(b);
    const positions = new Map([...s.ids].map(([id, e]) => [id, e.position]));
    for (const id of positions.keys()) ids.add(id);
    states.set(key, { word: w, key, positions });
  }
  res.prepared = states.size;
  const sceneList = [...states.values()];
  const moving = [...ids].filter(
    (id) =>
      new Set(sceneList.flatMap((s) => (s.positions.has(id) ? [s.positions.get(id).join()] : []))).size > 1
  );
  async function outcome(s, b) {
    const key = s.key + '/' + b;
    if (!stateAfter.has(key)) {
      const x = fire(play(s.word), b);
      stateAfter.set(key, { positions: active(x) ? (await observe(x)).ids : null, win: win(x) });
    }
    return stateAfter.get(key);
  }
  const plans = [];
  for (const actor of ids)
    for (const partner of moving) {
      if (actor === partner) continue;
      const groups = new Map();
      for (const s of sceneList) {
        const a = s.positions.get(actor),
          p = s.positions.get(partner);
        if (!a || !p) continue;
        let map = groups.get(a.join());
        if (!map) {
          map = new Map();
          groups.set(a.join(), map);
        }
        let zs = map.get(p.join());
        if (!zs) {
          zs = [];
          map.set(p.join(), zs);
        }
        zs.push(s);
      }
      for (const [departure, byPartner] of groups) {
        if (byPartner.size < 3) continue;
        const train = (s) => s.word.length < 2 || parseInt(s.key.slice(0, 2), 16) % 2 === 0;
        const places = [...byPartner.values()].map((xs) => xs.filter(train)).filter((xs) => xs.length);
        const held = [...byPartner.values()].filter((xs) => xs.every((s) => !train(s)));
        if (places.length < 2 || !held.length) continue;
        let ends = null,
          separation = 0;
        for (let i = 0; i < places.length; i++)
          for (let j = i + 1; j < places.length; j++) {
            const a = places[i][0].positions.get(partner),
              b = places[j][0].positions.get(partner),
              d = length(diff(a, b));
            if (d > separation) {
              ends = [i, j];
              separation = d;
            }
          }
        const [l, r] = ends;
        res.eligible++;
        const left = places[l],
          right = places[r];
        for (const b of buttons) {
          const arm = async (ss) => {
            const seen = new Set();
            for (const s of ss) {
              const p = (await outcome(s, b)).positions?.get(actor)?.position;
              seen.add(p ? p.join() : 'unobserved');
            }
            return seen.size === 1 && !seen.has('unobserved') ? [...seen][0].split(',').map(Number) : null;
          };
          const y0 = await arm(left),
            y1 = await arm(right);
          if (!y0 || !y1 || same(y0, y1)) continue;
          const x0 = left[0].positions.get(partner),
            x1 = right[0].positions.get(partner),
            d = diff(x1, x0);
          let valid = transforms(d).flatMap((v, i) => (same(v, diff(y1, y0)) ? [i] : []));
          if (!valid.length) continue;
          const allowed = new Set([y0.join(), y1.join(), departure]),
            fresh = new Map();
          for (const [i, ss] of places.entries()) {
            if (i === l || i === r) continue;
            const yy = await arm(ss);
            if (!yy) {
              valid = [];
              break;
            }
            allowed.add(yy.join());
            const ds = transforms(diff(ss[0].positions.get(partner), x0));
            valid = valid.filter((t) => same(add(y0, ds[t]), yy));
            if (!valid.length) break;
          }
          if (!valid.length) continue;
          for (const ss of held) {
            const seenAt = ss[0].positions.get(partner),
              ds = transforms(diff(seenAt, x0));
            const targets = new Set(valid.map((i) => add(y0, ds[i]).join()));
            if (targets.size !== 1) continue;
            const target = [...targets][0];
            if (allowed.has(target) || fresh.has(target)) continue;
            const chosen = [...ss].sort(
              (a, b) => a.word.length - b.word.length || a.key.localeCompare(b.key)
            )[0];
            fresh.set(target, {
              word: chosen.word,
              key: chosen.key,
              partnerAt: seenAt,
              target: target.split(',').map(Number),
            });
          }
          if (!fresh.size) continue;
          let follow = null;
          for (const cmd of buttons) {
            const next = async (s) => {
              const n = play([...s.word, b, cmd]);
              return { pos: active(n) ? (await observe(n)).ids.get(actor)?.position : null, won: win(n) };
            };
            const a = await next(left[0]),
              q = await next(right[0]);
            if (a.won && q.won) {
              follow = { cmd, win: true };
              break;
            }
            if (!a.pos || !q.pos) continue;
            const dv = diff(a.pos, y0);
            if (length(dv) && same(dv, diff(q.pos, y1)) && !follow) follow = { cmd, delta: dv };
          }
          plans.push({
            actor,
            partner,
            departure: departure.split(',').map(Number),
            trigger: b,
            follow,
            training: [
              { word: left[0].word, key: left[0].key, x: x0, y: y0 },
              { word: right[0].word, key: right[0].key, x: x1, y: y1 },
            ],
            constraints: valid,
            targets: [...fresh.values()],
          });
        }
      }
    }
  // The targets were derived without consulting their probe observations. Re-execute the selected interventions in fresh copies.
  res.sealed = seal(plans);
  res.queries = plans.length;
  for (const p of plans) {
    let exact = 0;
    const verified = [];
    for (const c of p.targets) {
      const b = play(c.word);
      if (hash(b) !== c.key) throw Error('Failed preparation replay');
      const obs = await observe(b);
      if (
        !same(obs.ids.get(p.actor)?.position, p.departure) ||
        !same(obs.ids.get(p.partner)?.position, c.partnerAt)
      )
        throw Error('Failed causal layout');
      const n = fire(b, p.trigger),
        pos = active(n) ? (await observe(n)).ids.get(p.actor)?.position : null;
      const good = same(pos, c.target);
      exact += Number(good);
      res.predictions++;
      res.exact += Number(good);
      res.official += Number(win(n));
      let continuation = null;
      if (good && p.follow) {
        const end = fire(n, p.follow.cmd),
          next = active(end) ? (await observe(end)).ids.get(p.actor)?.position : null;
        const predicted = p.follow.delta ? add(c.target, p.follow.delta) : null;
        const exact = p.follow.win ? win(end) : same(next, predicted);
        res.followPredictions++;
        res.followExact += Number(exact);
        res.followWon += Number(win(end));
        continuation = { expected: predicted, actual: next ?? null, exact, won: win(end) };
      }
      verified.push({ ...c, actual: pos ?? null, exact: good, won: win(n), continuation });
    }
    res.pairs += Number(p.targets.length >= 2);
    res.verifiedPairs += Number(exact >= 2);
    res.examples.push({ ...p, targets: verified });
  }
  res.examples.sort(
    (a, b) => b.targets.filter((x) => x.exact).length - a.targets.filter((x) => x.exact).length
  );
  return res;
}
const [shard, count] = split.split('/').map(Number),
  results = [];
const include = selection ? new Set(selection.split(',')) : null;
if (include && [...include].some((code) => !allowed.has(code))) throw Error('Expected original source games');
for (const [i, c] of cases.filter((c) => !include || include.has(c.run.code)).entries())
  if (i % count === shard) results.push(await measure(c));
await writeFile(out, JSON.stringify(results));
