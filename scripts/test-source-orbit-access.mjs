import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { initialMemory, recordExperiment } from '../src/sic/preparation-experiments.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { proposedOrbitTransfers } from '../src/sic/translated-orbit.ts';
const [env, dir, g, shard, selection, output] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const files =
  g === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  ),
  runs = new Map(),
  out = [],
  allowed = new Set(GAME_CATALOG.map((x) => x.code));
for (const f of files)
  for (const l of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    runs.set(r.code + '/' + r.start, r);
  }
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
    i + 1
  );
const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
for (const entry of JSON.parse(await readFile(selection, 'utf8'))) {
  if (!allowed.has(entry.code)) throw Error('Source games only');
  const r = runs.get(entry.code + '/' + entry.level),
    rep = sourceReplay(engine, programs, r),
    cases = [];
  for (const item of entry.cases.filter((v, i, a) => i === 0 || v.i !== a[0].i).slice(0, 2)) {
    const m = initialMemory(r.start);
    let root = rep.restore(0),
      o = await read(root, 0);
    for (const [i, c] of r.steps.slice(0, item.i).entries()) {
      const next = rep.act(op(c));
      if (!hash(next).startsWith(c.to)) throw Error('Broken source prefix');
      const y = await read(next, i + 1);
      if (y.level_epoch === o.level_epoch && y.state === o.state)
        recordExperiment(m, o, y, { action_ref: 'ACTION' + c.a, data: c.data ?? {} }, root.frame, next.frame);
      root = next;
      o = y;
    }
    const ticket = proposedOrbitTransfers(m, o, root.frame).find(
      (v) =>
        v.actor === item.actor &&
        v.signature === item.signature &&
        String(v.near) === String(item.near) &&
        String(v.far) === String(item.far)
    );
    if (!ticket) throw Error('Could not reconstruct sealed destination');
    const target = new Set(ticket.target.map((p) => p.join())),
      cache = new Map(),
      seen = new Set([hash(root)]);
    const queue = [{ word: [], score: 0 }],
      foot = ticket.foothold,
      examples = [];
    let expanded = 0,
      actions = 0,
      official = 0,
      reached = 0,
      first = null,
      best = Infinity,
      improvement = 0;
    const nearest = (p) => Math.min(...ticket.target.map((t) => distance(t, p)));
    const begin = nearest(ticket.from);
    // Keep breadth on every other expansion so an operation with no immediate spatial reward can be combined.
    while (queue.length && expanded < 48 && !first) {
      queue.sort(
        expanded % 2 === 0
          ? (a, b) => a.word.length - b.word.length || a.score - b.score
          : (a, b) => a.score - b.score || a.word.length - b.word.length
      );
      const node = queue.shift();
      if (node.word.length >= 7) continue;
      expanded++;
      let origin = rep.restore(item.i);
      for (const key of node.word) origin = rep.act(key);
      const keys = origin.availableActionIds.flatMap((k) =>
        k === 6 ? [ticket.near, ticket.far, ticket.at].map((p) => 'ACTION6:' + p.join()) : ['ACTION' + k]
      );
      for (const key of [...new Set(keys)]) {
        let b = rep.restore(item.i);
        for (const k of node.word) b = rep.act(k);
        b = rep.act(key);
        actions++;
        const word = [...node.word, key];
        if (rep.win(b)) {
          official++;
          if (examples.length < 2) examples.push(word);
          continue;
        }
        if (b.state !== root.state || b.level !== root.level) continue;
        const h = hash(b);
        if (seen.has(h)) continue;
        seen.add(h);
        let obs = cache.get(h);
        if (!obs) {
          obs = await read(b, 0);
          cache.set(h, obs);
        }
        const actor = obs.entities.find((e) => !e.identity_ambiguous && e.signature === ticket.actor);
        const p = actor?.position,
          near = p ? nearest(p) : Infinity;
        if (near < best) {
          best = near;
          improvement = begin - best;
        }
        if (p && target.has(p.join())) {
          reached++;
          first ??= { word, arrived: p, foothold: foot };
          continue;
        }
        const value = p ? Math.min(near, begin / 2 + distance(p, ticket.at)) : 1000;
        queue.push({ word, score: value + 0.25 * word.length });
      }
    }
    cases.push({
      i: item.i,
      from: ticket.from,
      near: ticket.near,
      far: ticket.far,
      foothold: ticket.foothold,
      component: ticket.component,
      support: ticket.support,
      expanded,
      actions,
      states: seen.size,
      official,
      firstWin: examples[0] ?? null,
      reached,
      first,
      improvement,
    });
  }
  out.push({ code: r.code, level: r.start, cases });
}
await writeFile(output, JSON.stringify(out));
