import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { sourceReplay, hash, op } from './sic-study-source-replay.mjs';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import { observedCommandKey } from '../src/sic/observed-command-frontier.ts';
import {
  initialMemory,
  recordExperiment,
  sceneKey,
  selectExperiment,
} from '../src/sic/preparation-experiments.ts';
const [env, directory, output, cohort, split = '0/1'] = process.argv.slice(2);
const engine = await sourceBackend(resolve(env)),
  allowed = new Set(GAME_CATALOG.map((g) => g.code));
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const cases = [];
if (cohort === 'lower')
  for (let i = 0; i < 8; i++)
    for (const line of (await readFile(join(directory, 'source-final-' + i + '.jsonl'), 'utf8'))
      .trim()
      .split('\n')) {
      const run = JSON.parse(line);
      cases.push({ run, word: run.steps.map(op) });
    }
else if (cohort === 'upper') {
  const info = JSON.parse(
    await readFile(
      new URL('../docs/architecture/sic-projected-affordances-results.json', import.meta.url),
      'utf8'
    )
  );
  for (const { code, level, entry, confirmed } of info.upperLevels)
    if (confirmed) {
      const seq = programs.niveaux_supérieurs.find((r) => r.code === code && r.l === level).seq;
      cases.push({
        run: { code, start: level, sourcePrefixActions: Number(entry === 'chronological') },
        word: seq.map((k) => 'ACTION' + k.replace('@', ':')),
      });
    }
} else throw Error('Invalid source cohort');
function command(key) {
  const [id, p] = key.split(':');
  const [x, y] = p?.split(',').map(Number) ?? [];
  return { action_ref: id, data: p ? { x, y } : {} };
}
async function audit({ run, word }) {
  if (!allowed.has(run.code)) throw Error('Source only');
  const replay = sourceReplay(engine, programs, run),
    memory = initialMemory(1);
  let board = run.steps ? replay.restore(0) : replay.openEntry().b;
  if (board.level !== run.start) throw Error('Wrong entry');
  const init = hash(board),
    completed = board.levelsCompleted,
    cache = new Map();
  const win = (b) => !!b && (b.level > run.start || b.levelsCompleted > completed || b.state === 'WIN');
  const active = (b) => b && !win(b) && b.state !== 'GAME_OVER';
  async function obs(b, rev) {
    const key = hash(b);
    if (!cache.has(key))
      cache.set(
        key,
        await measureNativeObservation(
          {
            frame_rows: b.frame,
            frame_hash: key,
            state: b.state,
            level: b.level - run.start + 1,
            levels_completed: b.levelsCompleted - completed,
            available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
          },
          rev
        )
      );
    return { ...cache.get(key), revision: rev };
  }
  const inputs = (o, b) => {
    const domain = new ObservedInputDomain(16).candidates(o);
    return [
      ...new Map(
        [...domain, ...b.availableActionIds.filter((n) => n !== 6).map((n) => command('ACTION' + n))].map(
          (c) => [observedCommandKey(c), c]
        )
      ).values(),
    ];
  };
  const result = { code: run.code, level: run.start, initial: init, decision: null, verdict: [] };
  for (let i = 0; i < word.length; i++) {
    const o = await obs(board, i + 1);
    const beforeHash = hash(board);
    if (run.steps && run.steps[i].from !== beforeHash.slice(0, 16)) throw Error('Mismatched source prefix');
    const next = replay.act(word[i]);
    if (run.steps && run.steps[i].to !== hash(next).slice(0, 16)) throw Error('Mismatched source action');
    if (!active(next)) break;
    const after = await obs(next, i + 2);
    recordExperiment(memory, o, after, command(word[i]), board.frame, next.frame);
    board = next;
    const options = inputs(after, board);
    let offer = selectExperiment(memory, after, options, true, board.frame);
    if (!offer?.transfer) continue;
    const plan = offer.transfer.plan;
    result.decision = {
      after: i + 1,
      observed: hash(board),
      entry: plan.entry,
      exit: plan.exit,
      role: plan.role,
      shape: plan.shape,
      destination: plan.desired,
      following: plan.following,
      steps: plan.steps,
      alternatives: plan.alternatives,
      refs: plan.refs,
    };
    for (let j = 0; j < plan.steps.length && offer?.transfer; j++) {
      const step = plan.steps[j],
        pre = await obs(board, i + j + 2);
      if (offer.b !== step.op || !inputs(pre, board).some((c) => observedCommandKey(c) === step.op))
        throw Error('Unauthorized or divergent step');
      const n = replay.act(step.op),
        post = await obs(n, i + j + 3);
      const out = recordExperiment(memory, pre, post, command(step.op), board.frame, n.frame, offer);
      result.verdict.push({
        stage: step.stage,
        result: out.result,
        matched: out.transfer.matched,
        official: win(n),
        actual: out.transfer.actual,
      });
      if (!active(n) || !memory.transfers.active) break;
      board = n;
      offer = selectExperiment(memory, post, inputs(post, n), true, n.frame);
    }
    break;
  }
  return result;
}
const [ix, n] = split.split('/').map(Number),
  reports = [];
for (const [i, c] of cases.entries()) if (i % n === ix) reports.push(await audit(c));
await writeFile(output, JSON.stringify(reports));
