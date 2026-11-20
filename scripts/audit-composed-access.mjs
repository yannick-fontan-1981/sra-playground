import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';

// Reproduce the first complete, agent-chosen placement per source entry. Two identical
// visible endpoints can still have different futures, so each intervention gets a fresh world.
const [environment, output, ...files] = process.argv.slice(2);
const allBoard = files[0] === '--all-board';
if (allBoard) files.shift();
if (!files.length) throw Error('Expected source trajectories');
const catalogue = new Set(GAME_CATALOG.map((g) => g.code));
const engine = await sourceBackend(resolve(environment));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
async function audit(run, event = run.preparation.find((e) => e.result === 'condition_used')) {
  if (
    !catalogue.has(run.code) ||
    !run.steps ||
    run.resets ||
    run.issued !== run.sic ||
    run.steps.length !== run.issued
  )
    throw Error('Expected a complete autonomous source run');
  const result = {
    code: run.code,
    level: run.start,
    actions: run.issued,
    won: run.levels[0].won,
    completed: false,
  };
  const { act, restore, win } = sourceReplay(engine, programs, run);
  const final = restore(run.steps.length);
  if (win(final) !== result.won || final.state !== run.levels[0].state)
    throw Error('Divergent official result');
  if (!event) return result;
  const { plan, index } = event.condition;
  const first = event.actionIndex - 1 - index;
  const word = [...plan.preparation, plan.trigger, plan.use].map((s) => s.op);
  if (
    first < 0 ||
    word.length > 6 ||
    word.length !== index + 1 ||
    word.join('/') !==
      run.steps
        .slice(first, first + word.length)
        .map(op)
        .join('/')
  )
    throw Error('Recorded program differs from the executed actions');
  const positions = new Map();
  async function position(b) {
    const key = hash(b);
    if (!positions.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: b.level - run.start + 1,
          levels_completed: b.levelsCompleted - run.initialCompleted,
          state: b.state,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      positions.set(
        key,
        o.entities.find((e) => !e.identity_ambiguous && e.signature === plan.actor)?.position.join() ?? null
      );
    }
    return positions.get(key);
  }
  async function play(keys, exact = false) {
    let b = restore(first);
    for (const [i, key] of keys.entries()) {
      if (
        win(b) ||
        b.state === 'GAME_OVER' ||
        !b.availableActionIds.includes(Number(key.split(':')[0].slice(6)))
      )
        return null;
      b = act(key);
      if (exact && hash(b).slice(0, 16) !== run.steps[first + i].to)
        throw Error('Divergent composition replay');
    }
    return b;
  }
  async function state(b) {
    if (!b || b.state === 'GAME_OVER') return null;
    return win(b) ? 'WIN' : await position(b);
  }
  const bare = await play([plan.trigger.op]);
  if (!bare || win(bare) || (await position(bare)) !== plan.origin.join())
    throw Error('Inactive control differs');
  const full = await play(word, true);
  const endpoint = await state(full);
  if (endpoint !== plan.use.to.join()) throw Error('Final role position differs');
  const words = new Map();
  for (let mask = 0; mask < (1 << word.length) - 1; mask++) {
    const sub = word.filter((_, i) => mask & (1 << i));
    words.set(sub.join('/'), sub);
  }
  const matched = [];
  let missing = 0,
    terminal = 0;
  for (const sub of words.values()) {
    const b = await play(sub),
      value = await state(b);
    if (b && (win(b) || b.state === 'GAME_OVER')) terminal++;
    else if (!value) missing++;
    else if (value === endpoint) matched.push(sub);
  }
  const checks = [];
  // Buttons are exhaustive. For spatial clicks, only coordinates already used in the
  // selected program are eligible. A matching shorter history is a genuine shortcut.
  const buttons = full.availableActionIds.filter((id) => id !== 6).map((id) => 'ACTION' + id);
  const clicks = full.availableActionIds.includes(6) ? word.filter((key) => key.startsWith('ACTION6:')) : [];
  for (const key of new Set([...buttons, ...clicks])) {
    const extended = await state(await play([...word, key]));
    if (!extended || extended === endpoint) continue;
    let matches = 0,
      unknown = missing + terminal;
    for (const sub of matched) {
      const b = await play([...sub, key]),
        alternative = await state(b);
      if (!alternative) unknown++;
      else if (alternative === extended) matches++;
    }
    checks.push({ key, extended, matches, unknown, distinct: matches === 0 && unknown === 0 });
  }
  return {
    ...result,
    completed: true,
    first,
    word,
    alreadyPlaced: plan.alreadyPlaced ?? 0,
    endpoint,
    ...(allBoard
      ? {
          origin: plan.origin,
          partnerInitial: plan.preparation[0].from,
          departure: plan.trigger.from,
          partnerPrepared: plan.preparation.at(-1).to,
          arrival: plan.trigger.to,
        }
      : {}),
    shorter: words.size,
    matches: matched.length,
    shortest: matched.length ? Math.min(...matched.map((s) => s.length)) : null,
    missing,
    terminal,
    uniquePosition: !matched.length && !missing && !terminal,
    checks,
    distinctFutureAtSharedPosition: matched.length > 0 && checks.some((c) => c.distinct),
  };
}
const results = [];
for (const file of files) {
  const rows = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
  for (const row of rows) {
    if (allBoard) {
      for (const e of row.preparation.filter((e) => e.result === 'condition_used' && e.condition?.plan.frame))
        results.push(await audit(row, e));
    } else results.push(await audit(row));
  }
}
await writeFile(output, JSON.stringify(results));
console.log(
  JSON.stringify({
    games: results.length,
    completed: results.filter((r) => r.completed).length,
    uniquePosition: results.filter((r) => r.uniquePosition).length,
    distinctFutureAtSharedPosition: results.filter((r) => r.distinctFutureAtSharedPosition).length,
  })
);
