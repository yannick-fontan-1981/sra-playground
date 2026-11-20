import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { initialMemory, recordExperiment, sceneKey } from '../src/sic/preparation-experiments.ts';
import { frameEvidence, offerFrame } from '../src/sic/inverse-frame-experiment.ts';
import { naturalControls } from '../src/sic/natural-reference-controls.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { op, hash, sourceReplay } from './sic-study-source-replay.mjs';
const [env, dir, sealed, out, cohort] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const files =
  cohort === 'lower'
    ? Array.from({ length: 8 }, (_, i) => 'source-final-' + i)
    : cohort === 'extra'
      ? [2, 3, 4, 5].map((l) => 'cold13-f' + l)
      : ['u2', 'u2entry', 'u3', 'u3entry', 'u4', 'u5'].map((s) => 'cold12-' + s);
const all = new Map(),
  programs = JSON.parse(
    await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
  );
for (const f of files)
  for (const line of (await readFile(join(dir, f + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(line);
    all.set(r.code + '/' + r.start, r);
  }
const reports = [],
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
for (const group of JSON.parse(await readFile(sealed, 'utf8'))) {
  if (!allowed.has(group.code)) throw Error('Source games only');
  const r = all.get(group.code + '/' + group.level),
    rep = sourceReplay(engine, programs, r),
    counts = {},
    events = [],
    m = initialMemory(r.start);
  const proposals = new Map(group.inverses.map((p) => [p.i, p]));
  const inc = (k, b = true) => {
    if (b) counts[k] = (counts[k] ?? 0) + 1;
  };
  const measure = (b, i) =>
    measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
      },
      i + 1
    );
  let b = rep.restore(0),
    o = await measure(b, 0);
  for (const [i, c] of r.steps.entries()) {
    if (!hash(b).startsWith(c.from)) throw Error('Discontinuous source');
    const p = proposals.get(i + 1),
      s = m.scenes.indexOf(sceneKey(o)),
      avail = new Set(o.available_action_refs);
    if (p && s >= 0) {
      const inputs = frameEvidence(m, o, b.frame, s, avail),
        alt = inputs ? naturalControls(inputs) : [];
      const same = alt.find((q) => q.key === p.key),
        chosen = offerFrame(m, o, b.frame, s, avail, 'opportunity')?.frame?.plan;
      inc('laboratory');
      inc('visibleNative', !!same);
      inc(
        'zeroOffset',
        p.offset.every((v) => v === 0)
      );
      inc('nativeOffer', chosen?.key === p.key);
      if (p.offset.every((v) => v === 0)) inc('sameZero', !!same);
      if (!same && events.length < 3) {
        const writer = JSON.stringify([p.anchor, []]),
          id = JSON.stringify([p.role.signature, p.role.fixed]);
        events.push({
          i: i + 1,
          writer: (inputs?.history.get(p.a + '/' + writer) ?? []).some((e) => e.afterScene === s),
          response: !!inputs?.history.get(p.q + '/' + id)?.length,
          measured: !!inputs?.sample(inputs.now.g, s, p.role),
          labOffset: p.offset,
        });
      }
    }
    const cmd = { action_ref: 'ACTION' + c.a, data: c.data ?? {} };
    const next = rep.act(op(c));
    if (!hash(next).startsWith(c.to)) throw Error('Unmatched command');
    const no = await measure(next, i + 1);
    if (b.level === next.level && b.state === next.state)
      recordExperiment(m, o, no, cmd, b.frame, next.frame);
    b = next;
    o = no;
  }
  reports.push({ code: r.code, level: r.start, counts, events });
}
await writeFile(out, JSON.stringify(reports));
