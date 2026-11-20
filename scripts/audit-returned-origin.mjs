import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { hash, op, sourceReplay } from './sic-study-source-replay.mjs';

// The first excursion is chosen before observing either reachable set.
// Compare every word of length <= 2 over the same public control vocabulary.
const [environment, output, ...files] = process.argv.slice(2);
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const knownGames = new Set(GAME_CATALOG.map((g) => g.code));
const engine = await sourceBackend(resolve(environment));
function firstExcursion(history) {
  const end = history.length - 1;
  for (let begin = end - 2; begin >= Math.max(0, end - 6); begin--) {
    const states = history.slice(begin),
      last = states.at(-1),
      first = states[0];
    if (first.key === last.key) continue;
    const visible = [...first.poses.keys()].filter((id) => states.every((s) => s.poses.has(id)));
    const partners = visible.filter((id) => first.poses.get(id) !== last.poses.get(id));
    if (!partners.length) continue;
    const actor = visible.find(
      (id) =>
        first.poses.get(id) === last.poses.get(id) &&
        states.some((s) => s.poses.get(id) !== first.poses.get(id))
    );
    if (actor) return { begin, end, actor, partners };
  }
  return null;
}
async function audit(run) {
  if (!knownGames.has(run.code) || run.resets || run.issued !== run.steps?.length)
    throw Error('Invalid source trajectory');
  const { act, restore, win } = sourceReplay(engine, programs, run);
  const result = { code: run.code, level: run.start, eligible: false };
  const cache = new Map();
  async function poses(b) {
    const key = hash(b);
    if (!cache.has(key)) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: key,
          level: b.level - run.start + 1,
          state: b.state,
          levels_completed: b.levelsCompleted - run.initialCompleted,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        1
      );
      cache.set(
        key,
        new Map(
          o.entities
            .filter((e) => !e.identity_ambiguous && e.area < (b.frame.length * b.frame[0].length) / 4)
            .map((e) => [e.signature, e.position.join()])
        )
      );
    }
    return { key, poses: cache.get(key) };
  }
  let b = restore(0);
  const history = [await poses(b)];
  let excursion;
  for (const cmd of run.steps) {
    if (hash(b).slice(0, 16) !== cmd.from) throw Error('Divergent source observation');
    b = act(op(cmd));
    if (hash(b).slice(0, 16) !== cmd.to) throw Error('Divergent source action');
    if (win(b) || b.state === 'GAME_OVER') break;
    history.push(await poses(b));
    excursion = firstExcursion(history);
    if (excursion) break;
  }
  if (!excursion) return result;
  const { begin, end, actor, partners } = excursion;
  const sourceClicks = [
    ...new Set(
      run.steps
        .slice(0, end)
        .map(op)
        .reverse()
        .filter((s) => s.startsWith('ACTION6:'))
    ),
  ].slice(0, 4);
  // Discover availability at each step. Repeating the experiment from its exact prefix
  // also covers histories sharing a public frame but carrying different latent state.
  function actions(board) {
    return board.availableActionIds.flatMap((id) => (id === 6 ? sourceClicks : ['ACTION' + id]));
  }
  async function reachable(index) {
    const base = restore(index),
      positions = new Map();
    const counts = { executed: 0, unknown: 0, terminal: 0, wins: 0 };
    let winningWord = null;
    async function record(board, word) {
      counts.executed++;
      if (win(board)) {
        counts.wins++;
        if (!winningWord || word.length < winningWord.length) winningWord = word;
        return;
      }
      if (board.state === 'GAME_OVER') {
        counts.terminal++;
        return;
      }
      const at = (await poses(board)).poses.get(actor);
      if (!at) {
        counts.unknown++;
        return;
      }
      if (!positions.has(at) || positions.get(at).length > word.length) positions.set(at, word);
    }
    await record(base, []);
    for (const first of actions(base)) {
      restore(index);
      const child = act(first);
      await record(child, [first]);
      if (win(child) || child.state === 'GAME_OVER') continue;
      for (const second of actions(child)) {
        restore(index);
        act(first);
        await record(act(second), [first, second]);
      }
    }
    return { counts, positions, winningWord };
  }
  const bare = await reachable(begin),
    placed = await reachable(end);
  const visited = new Set(history.map((s) => s.poses.get(actor)).filter(Boolean));
  const additions = [...placed.positions].filter(([at]) => !bare.positions.has(at));
  const fresh = additions.filter(([at]) => !visited.has(at));
  const newlyWinning = !bare.counts.wins && !!placed.counts.wins;
  const capability = newlyWinning
    ? ['WIN', placed.winningWord]
    : !bare.counts.unknown && (fresh[0] ?? additions[0]);
  const placement = run.steps.slice(begin, end).map(op);
  // Same gestures, same duration. Keep the traveller at the same observed origin and
  // distinguish layouts with the chosen capability from those without it.
  let swaps = null;
  if (capability) {
    const [destination, suffix] = capability,
      tested = new Set(),
      layouts = new Map();
    let wrongOrigin = 0,
      unknown = 0;
    function execute(b, word) {
      for (const key of word) {
        if (
          win(b) ||
          b.state === 'GAME_OVER' ||
          !b.availableActionIds.includes(Number(key.split(':')[0].slice(6)))
        )
          return null;
        b = act(key);
      }
      return b;
    }
    for (let i = 0; i < placement.length; i++)
      for (let j = i; j < placement.length; j++) {
        const word = placement.slice();
        [word[i], word[j]] = [word[j], word[i]];
        if (tested.has(word.join('/'))) continue;
        tested.add(word.join('/'));
        const b = execute(restore(begin), word);
        if (!b || win(b) || b.state === 'GAME_OVER') {
          unknown++;
          continue;
        }
        const { poses: parts } = await poses(b);
        if (parts.get(actor) !== history[begin].poses.get(actor)) {
          wrongOrigin++;
          continue;
        }
        if (!partners.every((id) => parts.has(id))) {
          unknown++;
          continue;
        }
        const q = execute(b, suffix);
        if (!q) {
          unknown++;
          continue;
        }
        const after = win(q)
          ? 'WIN'
          : q.state === 'GAME_OVER'
            ? 'GAME_OVER'
            : (await poses(q)).poses.get(actor);
        if (!after && destination !== 'WIN') {
          unknown++;
          continue;
        }
        const layout = partners.map((id) => parts.get(id)),
          k = layout.join('/');
        const cell = layouts.get(k) ?? { layout, yes: 0, no: 0 };
        if (after === destination) cell.yes++;
        else cell.no++;
        layouts.set(k, cell);
      }
    swaps = { tested: tested.size, wrongOrigin, unknown, capability, layouts: [...layouts.values()] };
  }
  return {
    ...result,
    eligible: true,
    begin,
    end,
    actor,
    partners: partners.length,
    clicks: sourceClicks.length,
    placement,
    origin: history[begin].poses.get(actor),
    bare: bare.counts,
    placed: placed.counts,
    before: bare.positions.size,
    after: placed.positions.size,
    additional: additions.length,
    fresh: fresh.length,
    certified: !bare.counts.unknown && !!additions.length,
    certifiedFresh: !bare.counts.unknown && !!fresh.length,
    witness: fresh[0] ?? additions[0] ?? null,
    newlyWinning,
    swaps,
  };
}
const rows = [];
if (files[0] === '--archived-upper') {
  const entries = JSON.parse(await readFile(files[1], 'utf8')).upperLevels;
  for (const { code, level, entry, confirmed } of entries) {
    if (!confirmed || !knownGames.has(code)) throw Error('Unverified source entry');
    const run = {
      code,
      start: level,
      steps: [],
      resets: 0,
      sourcePrefixActions: entry === 'chronological' ? 1 : 0,
    };
    const { openEntry, act, win } = sourceReplay(engine, programs, run);
    const initial = openEntry();
    let b = initial.b;
    run.sourcePrefixActions = initial.entry;
    run.initialCompleted = b.levelsCompleted;
    run.initial = hash(b);
    const seq = programs.niveaux_supérieurs.find((r) => r.code === code && r.l === level).seq;
    for (const command of seq) {
      if (win(b) || b.state === 'GAME_OVER') throw Error('Premature archived ending');
      const [n, xy] = command.split('@'),
        [x, y] = xy?.split(',').map(Number) ?? [];
      const step = { a: Number(n), ...(xy ? { data: { x, y } } : {}), from: hash(b).slice(0, 16) };
      b = act(op(step));
      run.steps.push({ ...step, to: hash(b).slice(0, 16) });
    }
    if (!win(b)) throw Error('Archived program failed');
    run.issued = run.steps.length;
    rows.push(await audit(run));
  }
} else {
  for (const file of files)
    for (const line of (await readFile(file, 'utf8')).trim().split('\n'))
      rows.push(await audit(JSON.parse(line)));
}
await writeFile(output, JSON.stringify(rows));
console.log(
  JSON.stringify({
    levels: rows.length,
    loops: rows.filter((r) => r.eligible).length,
    added: rows.filter((r) => r.certified).length,
    fresh: rows.filter((r) => r.certifiedFresh).length,
    winning: rows.filter((r) => r.newlyWinning).length,
  })
);
