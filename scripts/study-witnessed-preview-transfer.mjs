// Source-only study. Reproduce archived public commands, including scored level transitions.
// A forecast is chosen before a fork. An available rival is executed from the identical board.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { GAME_CATALOG } from '../src/games/catalog.ts';
import { measureNativeObservation } from '../src/logos-engine/v6-native-observer.ts';
import {
  acceptPreviewCarry,
  carryPreviewBindings,
  measureWitnessedArrival,
  newPreviewLearning,
  observePreviewBindings,
  offerWitnessedPreview,
  visualLayout,
} from '../src/sic/witnessed-preview-transfer.ts';
import { sourceBackend } from './sic-study-source-games.mjs';
import { pathToFileURL } from 'node:url';
const [env, study, selection, shard, output, research, frozenSolver] = process.argv.slice(2);
const baselineReader = frozenSolver
  ? (await import(pathToFileURL(join(resolve(frozenSolver), 'src/sic/witnessed-preview-transfer.ts'))))
      .offerWitnessedPreview
  : undefined;
const programs = JSON.parse(
  await readFile(new URL('../docs/architecture/sic-source-seven-programs.json', import.meta.url), 'utf8')
);
const games = GAME_CATALOG.map((g) => g.code).sort(),
  chosen = selection === 'all' ? games : selection.split(',');
if (chosen.some((g) => !games.includes(g))) throw Error('Outside original source cohort');
const archived = new Map();
for (let i = 0; i < 8; i++) {
  for (const l of (await readFile(join(study, 'source-final-' + i + '.jsonl'), 'utf8')).trim().split('\n')) {
    const r = JSON.parse(l);
    archived.set(r.code, r);
  }
}
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const engine = await sourceBackend(resolve(env)),
  reports = [];
const [idx, parts] = shard.split('/').map(Number);
function act(command) {
  const [name, xy] = command.split(':'),
    [x, y] = xy?.split(',').map(Number) ?? [];
  return engine.dispatch({
    type: 'action',
    actionId: Number(name.slice(6)),
    ...(xy ? { data: { x, y } } : {}),
  });
}
function read(b, i, scope) {
  return measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b.frame),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((x) => 'ACTION' + x),
    },
    i,
    scope
  );
}
for (const code of chosen.filter((_, i) => i % parts === idx)) {
  let b = engine.dispatch({ type: 'load', code, level: 1 }),
    i = 1,
    learned = newPreviewLearning();
  const report = { code, observed: 0, scored: 0, byLevel: {}, tests: [] },
    history = [],
    tried = new Set();
  const competition =
    research === 'competition'
      ? (await import('./source-preview-competition.mjs')).previewCompetition(baselineReader)
      : null;
  if (competition) report.competition = competition.rows;
  reports.push(report);
  let o = await read(b, i, code),
    layout = visualLayout(o, b.frame);
  const words = programs.niveau_1[code]
    ? [
        programs.niveau_1[code].suite_gagnante,
        ...programs.niveaux_supérieurs
          .filter((r) => r.code === code)
          .sort((a, b) => a.l - b.l)
          .map((r) => r.seq),
      ].map((w) => w.map((k) => ({ q: 'ACTION' + k.replace('@', ':') })))
    : [
        archived
          .get(code)
          .steps.slice(0, 64)
          .map((s) => ({
            q: 'ACTION' + s.a + (s.a === 6 ? ':' + s.data.x + ',' + s.data.y : ''),
            from: s.from,
            to: s.to,
          })),
      ];
  for (const [l, word] of words.entries()) {
    if (b.level !== l + 1) throw Error('Divergent source entry ' + code + '/' + (l + 1));
    report.byLevel[l + 1] = { steps: 0, bindings: 0, inherited: Object.keys(learned.bindings).length };
    for (const step of [...word, null]) {
      if (b.level !== l + 1) break;
      const available = new Set(o.available_action_refs);
      const forecast = l > 0 && !tried.has(l) ? offerWitnessedPreview(learned, o, layout, available) : null;
      if (forecast?.basis === 'observed_in_previous_level') {
        tried.add(l);
        const seal = hash(forecast),
          rival = o.available_action_refs.find(
            (q) => q !== forecast.command.split(':')[0] && q !== 'ACTION6'
          );
        const branches = [];
        for (const q of [forecast.command, ...(rival ? [rival] : [])]) {
          const trial = act(q),
            after = await read(trial, i + 1, code),
            post = visualLayout(after, trial.frame);
          const matching = measureWitnessedArrival(forecast, o, after, layout, post);
          branches.push({
            q,
            publicHash: after.frame_hash,
            subject: matching.actual,
            status: matching.status,
          });
          let restored = engine.dispatch({ type: 'load', code, level: 1 });
          for (const key of history) restored = act(key);
          if (
            hash(restored.frame) !== o.frame_hash ||
            restored.level !== b.level ||
            restored.levelsCompleted !== b.levelsCompleted
          )
            throw Error('Divergent source fork');
        }
        report.tests.push({ level: b.level, seal, forecast, branches });
      }
      if (!step) break;
      if (step.from && o.frame_hash.slice(0, 16) !== step.from)
        throw Error('Divergent archived source at ' + code + '/' + i);
      const prospective = competition?.pre(learned, o, layout, step.q);
      const next = act(step.q),
        after = await read(next, ++i, code),
        post = visualLayout(after, next.frame);
      if (step.to && after.frame_hash.slice(0, 16) !== step.to)
        throw Error('Divergent archived return ' + code + '/' + i);
      if (competition) competition.post(prospective, o, after, layout, post);
      history.push(step.q);
      report.observed++;
      report.byLevel[l + 1].steps++;
      const carry = carryPreviewBindings(learned, o, after);
      observePreviewBindings(learned, o, after, layout, post, step.q);
      report.byLevel[l + 1].bindings = Object.keys(learned.bindings).length;
      if (after.levels_completed > o.levels_completed) report.scored++;
      if (after.level_epoch !== o.level_epoch) learned = acceptPreviewCarry(carry, after);
      b = next;
      o = after;
      layout = post;
    }
  }
  await writeFile(output, JSON.stringify(reports));
  console.log(code, report.observed, report.tests.length);
}
