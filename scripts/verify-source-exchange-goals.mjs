import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash } from './sic-study-source-replay.mjs';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
const [environment, input, out] = process.argv.slice(2);
const read = async (p) => JSON.parse(await readFile(p, 'utf8')),
  engine = await sourceBackend(resolve(environment)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const programs = await read(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url));
const reports = [];
const same = (p, q) => !!p && !!q && p.join() === q.join();
for (const r of await read(input)) {
  if (!allowed.has(r.code) || !r.records) throw Error('Expected sealed source programs');
  const plans = r.records.map(({ exchanged, exact, finished, required, ...plan }) => plan);
  if (createHash('sha256').update(JSON.stringify(plans)).digest('hex') !== r.seal)
    throw Error('Program seal mismatch');
  const replay = sourceReplay(engine, programs, { code: r.code, start: r.level }),
    open = () => {
      let b = replay.openEntry().b;
      if (b.level !== r.level) {
        b = engine.dispatch({ type: 'load', code: r.code, level: 1 });
        for (let l = 1; l < r.level; l++) {
          const seq =
            l === 1
              ? programs.niveau_1[r.code]?.suite_gagnante
              : programs.niveaux_supérieurs.find((e) => e.code === r.code && e.l === l)?.seq;
          if (!seq || b.level !== l) throw Error('Missing entry');
          for (const op of seq) b = replay.act('ACTION' + op.replace('@', ':'));
        }
      }
      if (hash(b) !== r.initial) throw Error('Divergent baseline');
      return b;
    };
  const completed = open().levelsCompleted,
    won = (b) => !!b && (b.level > r.level || b.levelsCompleted > completed || b.state === 'WIN');
  const live = (b) => !!b && !won(b) && b.state !== 'GAME_OVER';
  const step = (b, k) =>
    live(b) && b.availableActionIds.includes(Number(k.split(':')[0].slice(6))) ? replay.act(k) : null;
  const run = (keys) => [...r.prelude, ...keys].reduce(step, open());
  const cache = new Map();
  async function groups(b) {
    if (!live(b)) return new Map();
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: b.level,
          state: b.state,
          levels_completed: b.levelsCompleted,
          available_action_refs: b.availableActionIds.map((i) => 'ACTION' + i),
        },
        1
      );
      const sets = new Map();
      for (const e of o.entities) {
        const list = sets.get(e.signature) ?? new Set();
        list.add(e.position.join());
        sets.set(e.signature, list);
      }
      cache.set(key, sets);
    }
    return cache.get(key);
  }
  const base = run([]);
  if (hash(base) !== r.prepared) throw Error('Calibration prefix mismatch');
  const home = await groups(base);
  function locate(s, role) {
    const [sig, slot] = role.split('@'),
      now = s.get(sig);
    if (!now) return null;
    if (!slot) return now.size === 1 ? [...now][0].split(',').map(Number) : null;
    const all = home.get(sig);
    if (!all || !all.has(slot) || all.size !== now.size) return null;
    const frozen = [...all].filter((p) => p !== slot);
    if (!frozen.every((p) => now.has(p))) return null;
    const residual = [...now].filter((p) => !frozen.includes(p));
    return residual.length === 1 ? residual[0].split(',').map(Number) : null;
  }
  const stats = {
    programs: 0,
    exchanges: 0,
    uses: 0,
    exactUses: 0,
    onDeliveredRole: 0,
    differentBareEndpoint: 0,
    official: 0,
    ambiguousExchanges: 0,
  };
  const goals = new Set(),
    landings = new Set(),
    follow = new Set(),
    examples = [];
  for (const p of r.records) {
    stats.programs++;
    const equipped = run(p.setup),
      s = await groups(equipped);
    if (!same(locate(s, p.actor), p.from) || !same(locate(s, p.partner), p.q))
      throw Error('Wrong planned configuration');
    const n = step(equipped, p.trigger),
      t = await groups(n);
    const exchanged = same(locate(t, p.actor), p.q) && same(locate(t, p.partner), p.from);
    if (exchanged !== p.exchanged) throw Error('Wrong exchange');
    if (!exchanged) continue;
    stats.exchanges++;
    goals.add(p.q.join());
    landings.add(p.actor + '/' + p.q.join());
    stats.ambiguousExchanges += Number(p.actor.includes('@') || p.partner.includes('@'));
    if (!p.follow) continue;
    stats.uses++;
    const end = step(n, p.follow.op),
      position = locate(await groups(end), p.follow.role),
      exact = same(position, p.expected),
      official = won(end);
    if (exact !== p.exact || official !== p.finished) throw Error('Incorrect continuation');
    stats.exactUses += Number(exact);
    stats.official += Number(official);
    if (exact) {
      follow.add(p.follow.role + '/' + position.join());
      stats.onDeliveredRole += Number(p.follow.role === p.actor);
    }
    const noSwap = run([...p.setup, p.follow.op]),
      bare = locate(await groups(noSwap), p.follow.role);
    stats.differentBareEndpoint += Number(exact && !!bare && !same(position, bare));
    if (examples.length < 2)
      examples.push({
        prelude: r.prelude,
        setup: p.setup,
        origin: p.from,
        destination: p.q,
        trigger: p.trigger,
        use: p.follow.op,
        following: p.expected,
        actual: position,
        bare,
        official,
      });
  }
  if (
    stats.programs !== r.stats.planned ||
    stats.exchanges !== r.stats.exchanges ||
    stats.exactUses !== r.stats.useExact ||
    goals.size !== r.distinctDestinations
  )
    throw Error('Published counts mismatch');
  reports.push({
    code: r.code,
    level: r.level,
    initial: r.initial,
    seal: r.seal,
    stats,
    distinctDestinations: goals.size,
    distinctFollowCoordinates: follow.size,
    examples,
  });
}
await writeFile(out, JSON.stringify(reports));
