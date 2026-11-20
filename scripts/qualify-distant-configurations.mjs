import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op } from './sic-study-source-replay.mjs';
import { add, diff, length, geometryIndex, alternatives } from './source-corresponding-sites.mjs';

// Source-only prospective test. Freeze up to twelve different entry/exit experiments at the
// public entrance before issuing any multi-step preparation. Four single controls are calibration.
const [environment, directory, output, ...entries] = process.argv.slice(2);
const allowed = new Set(GAME_CATALOG.map((g) => g.code)),
  engine = await sourceBackend(resolve(environment));
const earlier = new Map();
for (let i = 0; i < 8; i++)
  for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
    .trim()
    .split('\n')) {
    const r = JSON.parse(line);
    if (r.levels[0].won) earlier.set(r.code + '/1', r.steps.map(op));
  }
const act = (k) => {
  const [name, xy] = k.split(':');
  const [x, y] = xy?.split(',').map(Number) ?? [];
  return engine.dispatch({
    type: 'action',
    actionId: Number(name.slice(6)),
    ...(xy ? { data: { x, y } } : {}),
  });
};
async function audit(code, level) {
  if (!allowed.has(code)) throw Error('Source only');
  function open() {
    let b = engine.dispatch({ type: 'load', code, level });
    if (b.level !== level && b.canSelectLevel) b = engine.dispatch({ type: 'selectLevel', level });
    if (b.level !== level) {
      b = engine.dispatch({ type: 'load', code, level: 1 });
      for (let i = 1; i < level; i++) {
        const known = earlier.get(code + '/' + i);
        if (b.level !== i || !known) return null;
        for (const k of known) b = act(k);
      }
    }
    return b.level === level ? b : null;
  }
  const root = open();
  if (!root) return { code, level, available: false };
  const win = (b) => b.level > level || b.levelsCompleted > root.levelsCompleted || b.state === 'WIN';
  const active = (b) => !win(b) && b.state !== 'GAME_OVER';
  const cache = new Map();
  async function measure(b) {
    if (!active(b)) return null;
    const key = hash(b);
    if (!cache.has(key)) {
      const obs = await measureNativeObservation(
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
      cache.set(key, geometryIndex(obs.entities, b.frame));
    }
    return cache.get(key);
  }
  const initial = await measure(root),
    buttons = root.availableActionIds.filter((n) => n >= 1 && n <= 4).map((n) => 'ACTION' + n);
  const singles = new Map();
  for (const k of buttons) {
    open();
    const b = act(k);
    singles.set(k, await measure(b));
  }
  const ranked = new Map();
  for (const [role, body] of initial.ids) {
    const moves = new Map();
    for (const [op, state] of singles) {
      const end = state?.ids.get(role)?.position;
      if (!end) continue;
      const d = diff(end, body.position);
      if (length(d)) moves.set(op, d);
    }
    if (moves.size < 1) continue;
    const q = [{ p: body.position, word: [], poses: [] }],
      seen = new Set([body.position.join()]);
    const extent = [body.bbox[2] - body.bbox[0], body.bbox[3] - body.bbox[1]];
    const fits = (p) =>
      p[0] >= 0 &&
      p[1] >= 0 &&
      p[0] + extent[0] < root.frame[0].length &&
      p[1] + extent[1] < root.frame.length;
    for (let i = 0; i < q.length && i < 300; i++) {
      const { p, word, poses } = q[i];
      for (const [k, d] of moves) {
        const nominal = add(p, d);
        if (word.length) {
          const endpoint = alternatives(
            { ...body, position: p },
            d,
            initial.parts,
            initial.groups,
            root.frame
          )[0];
          if (endpoint && length(diff(endpoint.landing, p)) >= 3 * length(d)) {
            const key = [role, k, endpoint.entry, endpoint.exit].join('/');
            const score = endpoint.score - word.length / 8;
            if (!ranked.has(key) || score > ranked.get(key).score)
              ranked.set(key, {
                role,
                word,
                poses,
                trigger: k,
                bare: singles.get(k).ids.get(role).position,
                from: p,
                normal: nominal,
                to: endpoint.landing,
                entry: endpoint.entry,
                exit: endpoint.exit,
                continuation: k,
                following: add(endpoint.landing, d),
                score,
              });
          }
        }
        if (word.length < 8 && fits(nominal) && !seen.has(nominal.join())) {
          seen.add(nominal.join());
          q.push({ p: nominal, word: [...word, k], poses: [...poses, nominal] });
        }
      }
    }
  }
  const plans = [...ranked.values()]
    .sort((x, y) => y.score - x.score || x.word.length - y.word.length)
    .slice(0, 12);
  const results = [];
  for (const plan of plans) {
    let b = open();
    if (!b || hash(b) !== hash(root)) throw Error('Entry changed');
    let matched = 0;
    const program = [];
    for (const k of plan.word) {
      if (!active(b)) break;
      b = act(k);
      program.push(k);
      if ((await measure(b))?.ids.get(plan.role)?.position.join() !== plan.poses[matched].join()) break;
      matched++;
    }
    const reached = matched === plan.word.length;
    let actual = null,
      following = null,
      wonAt = null;
    if (reached && active(b)) {
      b = act(plan.trigger);
      program.push(plan.trigger);
      if (win(b)) wonAt = 'trigger';
      actual = (await measure(b))?.ids.get(plan.role)?.position ?? null;
      if (actual?.join() === plan.to.join() && active(b)) {
        b = act(plan.continuation);
        program.push(plan.continuation);
        if (win(b)) wonAt = 'use';
        following = (await measure(b))?.ids.get(plan.role)?.position ?? null;
      }
    } else if (win(b)) wonAt = 'preparation';
    if (wonAt && !earlier.has(code + '/' + level)) earlier.set(code + '/' + level, program);
    results.push({
      plan,
      matched,
      reached,
      actual,
      exact: actual?.join() === plan.to.join(),
      following,
      continued: following?.join() === plan.following.join(),
      wonAt,
    });
  }
  return { code, level, available: true, initial: hash(root), buttons, experiments: results };
}
const results = [];
for (const entry of entries) {
  const [code, level] = entry.split('/');
  results.push(await audit(code, Number(level)));
}
await writeFile(output, JSON.stringify(results));
