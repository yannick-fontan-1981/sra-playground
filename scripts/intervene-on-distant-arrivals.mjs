import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { sourceBackend } from './sic-study-source-games.mjs';
import { geometryIndex, alternatives, add, diff, length } from './source-corresponding-sites.mjs';

const [environment, directory, output, ...reports] = process.argv.slice(2);
const runs = new Map(),
  sources = new Set(GAME_CATALOG.map((x) => x.code));
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n')) {
    const r = JSON.parse(line);
    runs.set(r.code, r);
  }
const engine = await sourceBackend(resolve(environment)),
  results = [];
async function audit(run, event) {
  if (!run || !sources.has(run.code) || run.start !== 1 || !run.steps || run.resets)
    throw Error('Original source only');
  const replay = sourceReplay(engine, {}, run),
    cache = new Map();
  const active = (b) => b && !replay.win(b) && b.state !== 'GAME_OVER';
  const fire = (b, c) =>
    active(b) && b.availableActionIds.includes(Number(c.split(':')[0].slice(6))) ? replay.act(c) : null;
  async function snap(b) {
    if (!active(b)) return null;
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: 1,
          levels_completed: 0,
          state: b.state,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      const domain = new ObservedInputDomain(16)
        .candidates(o)
        .filter((c) => c.action_ref === 'ACTION6')
        .map((c) => c.action_ref + ':' + c.data.x + ',' + c.data.y);
      cache.set(key, {
        key,
        ...geometryIndex(o.entities, b.frame),
        commands: [...b.availableActionIds.filter((n) => n !== 6).map((n) => 'ACTION' + n), ...domain],
      });
    }
    return cache.get(key);
  }
  const before = event.step - 1,
    probe = op(run.steps[before]),
    next = run.steps[before + 1] && op(run.steps[before + 1]);
  const original = replay.restore(before),
    prepared = await snap(original),
    after = await snap(fire(original, probe));
  if (!prepared || !after || !next || before > 7) return { code: run.code, eligible: false };
  if (prepared.key.slice(0, 16) !== run.steps[before].from || after.key.slice(0, 16) !== run.steps[before].to)
    throw Error('Source preparation or trigger diverged');
  const possible = [...prepared.ids.values()].filter(
    (e) =>
      e.position.join() === event.origin.join() &&
      after.ids.get(e.signature)?.position.join() === event.actual.join()
  );
  if (possible.length !== 1) return { code: run.code, eligible: false };
  const role = possible[0].signature,
    word = run.steps.slice(0, before).map(op),
    root = replay.restore(0),
    initial = await snap(root);
  const direct = await snap(fire(root, probe)),
    origin = initial.ids.get(role)?.position;
  const bare = direct?.ids.get(role)?.position;
  if (!origin || !bare || !length(diff(bare, origin))) return { code: run.code, eligible: false };
  const stride = diff(bare, origin);
  const alternativesAtRoot = [...new Set([...initial.commands, ...word])];
  const words = new Map();
  const addWord = (keys, kind) => {
    const k = keys.join('/');
    if (!words.has(k)) words.set(k, { keys, kind });
  };
  addWord(word, 'original');
  for (let mask = 0; mask < 1 << word.length; mask++)
    addWord(
      word.filter((_, i) => mask & (1 << i)),
      'omission'
    );
  function permute(prefix, remaining) {
    if (!remaining.length) addWord(prefix, 'permutation');
    else
      for (const [i, k] of remaining.entries())
        permute(
          [...prefix, k],
          remaining.filter((_, j) => i !== j)
        );
  }
  permute([], word);
  for (const i of word.keys())
    for (const k of alternativesAtRoot)
      addWord(
        word.map((x, j) => (i === j ? k : x)),
        'replacement'
      );
  const originalImages = new Set(run.steps.slice(0, before + 1).map((s) => s.from));
  const joint = new Map(),
    rows = [];
  for (const { keys, kind } of words.values()) {
    let b = replay.restore(0);
    for (const k of keys) b = fire(b, k);
    const s = await snap(b);
    if (!s) {
      rows.push({ kind, keys, active: false });
      continue;
    }
    const e = s.ids.get(role);
    if (!e) {
      rows.push({ kind, keys, active: true, tracked: false });
      continue;
    }
    const p = e.position,
      nominal = add(p, stride);
    const selected = alternatives(e, stride, s.parts, s.groups, b.frame)[0];
    const frozen = alternatives({ ...e, position: p }, stride, initial.parts, initial.groups, b.frame)[0];
    // Both hypotheses and the followup are now fixed; restore a fresh world for every experiment.
    const b2 = fire(b, probe),
      s2 = await snap(b2),
      actual = s2?.ids.get(role)?.position ?? null;
    const finish = fire(b2, next),
      won = !!finish && replay.win(finish),
      exact = !!selected && actual?.join() === selected.landing.join();
    const row = {
      kind,
      keys,
      image: s.key,
      active: true,
      tracked: true,
      novelImage: !originalImages.has(s.key.slice(0, 16)),
      p,
      nominal,
      selected: selected ? { entry: selected.entry, exit: selected.exit, landing: selected.landing } : null,
      frozen: frozen?.landing ?? null,
      actual,
      exact,
      ordinaryExact: actual?.join() === nominal.join(),
      won,
    };
    rows.push(row);
    if (!joint.has(s.key)) joint.set(s.key, row);
    else if (joint.get(s.key).actual?.join() !== actual?.join() || joint.get(s.key).won !== won)
      row.alias = true;
  }
  const unique = [...joint.values()];
  const stats = (xs) => ({
    arms: xs.length,
    measured: xs.filter((r) => r.actual).length,
    offered: xs.filter((r) => r.selected).length,
    exact: xs.filter((r) => r.exact).length,
    frozenExact: xs.filter((r) => r.actual && r.frozen?.join() === r.actual.join()).length,
    won: xs.filter((r) => r.won).length,
    exactAndWon: xs.filter((r) => r.exact && r.won).length,
  });
  const differing = [];
  for (const [i, r] of unique.entries())
    for (const q of unique.slice(i + 1)) {
      if (!r.exact || !q.exact || r.p.join() !== q.p.join() || r.actual.join() === q.actual.join()) continue;
      differing.push([r, q]);
      break;
    }
  return {
    code: run.code,
    eligible: true,
    probe,
    next,
    ordinary: stride,
    selectedBefore: before + 1,
    original: rows[0],
    novelExample: unique.find((r) => r.novelImage && r.exact && r.won) ?? null,
    singleChangeControl:
      rows.find(
        (r) =>
          r.actual &&
          !r.won &&
          r.p.join() === rows[0].p.join() &&
          r.keys.length === word.length &&
          r.keys.filter((k, i) => k !== word[i]).length === 1
      ) ?? null,
    byProgram: stats(rows),
    unique: stats(unique),
    novel: stats(unique.filter((r) => r.novelImage)),
    alias: rows.filter((r) => r.alias).length,
    byKind: Object.fromEntries(
      ['original', 'omission', 'permutation', 'replacement'].map((k) => [
        k,
        stats(rows.filter((r) => r.kind === k)),
      ])
    ),
    distinctLandings: differing.length,
    example: differing[0] ?? null,
  };
}
for (const file of reports)
  for (const r of JSON.parse(await readFile(file, 'utf8'))) {
    for (const e of r.examples.filter((x) => x.rank === 1)) results.push(await audit(runs.get(r.code), e));
  }
await writeFile(output, JSON.stringify(results));
