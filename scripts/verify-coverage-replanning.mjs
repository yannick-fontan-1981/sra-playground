import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';

const [directory, archive, tape, pack, predicate, out] = process.argv.slice(2);
assert.ok(['partner', 'opened'].includes(predicate));
const load = (p) => import(pathToFileURL(resolve(p)));
const { createGameDispatcher } = await load(
  resolve(directory, 'src/runtime/native-game-dispatcher.ts'),
);
const {
  registerCoverage,
  registerCoverageFromControl,
  observeCoverage,
  readCoverage,
} = await load(resolve(archive, 'src/sic/controlled-coverage.ts'));
const { proposeCoverage } = await load(
  resolve(archive, 'src/sic/plan-controlled-coverage.ts'),
);
const { detectTransportSelection } = await load(
  resolve(archive, 'src/sic/transport-observations.ts'),
);
const { visualLayout } = await load(
  resolve(archive, 'src/sic/witnessed-preview-transfer.ts'),
);
const { measureNativeObservation } = await load(
  resolve(archive, 'src/logos-engine/v6-native-observer.ts'),
);
const r = JSON.parse(await readFile(tape)),
  revision = JSON.parse(await readFile(pack)),
  cfg = revision.configuration;
assert.equal(r.packDigest, revision.digest);
assert.equal(r.start, r.finish);
const engine = createGameDispatcher(() => {
  throw Error('Public dispatcher required');
});
let b = await engine.dispatch({ type: 'load', code: r.code, level: r.start });
if (b.level !== r.start)
  b = await engine.dispatch({ type: 'selectLevel', level: r.start });
const start = b.levelsCompleted,
  step = (cmd) =>
    engine.dispatch({
      type: 'action',
      actionId: cmd.id,
      ...(cmd.data ? { data: cmd.data } : {}),
    });
const parse = (op) => {
  const [action, data] = op.split(':');
  return {
    id: +action.slice(6),
    ...(data
      ? { data: { x: +data.split(',')[0], y: +data.split(',')[1] } }
      : {}),
  };
};
const propose = (c, b) =>
  proposeCoverage(
    c,
    b.frame,
    b.availableActionIds.map((n) => 'ACTION' + n),
    cfg.maxDepth,
    cfg.maxNodes,
  );
let c,
  cut,
  discarded,
  prefixChoices = 0;
for (const [i, command] of r.replayCommands.entries()) {
  if (command.cooperative?.coverage && c) {
    const hypothesis = propose(c, b);
    assert.equal(
      hypothesis?.command,
      command.cooperative.command,
      'Reconstructed choice ' + (i + 1),
    );
    prefixChoices++;
  }
  const a = await step(command);
  assert.equal(hash(a).slice(0, 16), command.to);
  if (!c && command.id === 6) {
    const boxes = command.observedSubjects;
    if (boxes)
      c = registerCoverage(b.frame, a.frame, boxes[0], boxes[1], 'read' + i);
    if (!c) {
      const o = await measureNativeObservation(
        {
          frame_rows: b.frame,
          frame_hash: hash(b),
          state: b.state,
          level: b.level,
          levels_completed: b.levelsCompleted,
          available_action_refs: b.availableActionIds.map((n) => 'ACTION' + n),
        },
        i,
        'audit',
      );
      const m = detectTransportSelection(
        visualLayout(o, b.frame),
        b.frame,
        a.frame,
        [command.data.x, command.data.y],
        'read' + i,
      );
      if (m) c = registerCoverageFromControl(b.frame, a.frame, m, 'read' + i);
    }
    if (c) {
      c.testContacts = [
        'test_contact_on_another_subject',
        'prepare_a_contact_stance',
        'prefer_a_verified_coverage_experiment',
        'compose_a_sustained_crossing',
        'bind_earlier_motions_to_registered_subjects',
      ].includes(cfg.informationPreference.strategy);
      if (
        [
          'prepare_a_contact_stance',
          'prefer_a_verified_coverage_experiment',
          'compose_a_sustained_crossing',
          'bind_earlier_motions_to_registered_subjects',
        ].includes(cfg.informationPreference.strategy)
      )
        c.prepareStance = true;
    }
  }
  const input =
    command.id === 6
      ? 'ACTION6:' + command.data.x + ',' + command.data.y
      : 'ACTION' + command.id;
  if (c)
    observeCoverage(
      c,
      b.frame,
      a.frame,
      input,
      'read' + i,
      command.cooperative,
    );
  b = a;
  if (
    c &&
    (predicate === 'partner'
      ? Object.values(c.peerPush ?? {}).length
      : c.opening)
  ) {
    cut = i + 1;
    discarded = c.plan?.length ?? 0;
    delete c.plan;
    break;
  }
}
assert.ok(
  c && cut && discarded > 0,
  'Expected a confirmed effect and a remaining cached plan',
);
const starting = readCoverage(c, b.frame),
  replanned = [];
for (let i = 0; i < cfg.maxDepth && b.levelsCompleted === start; i++) {
  const f = propose(c, b);
  if (!f) break;
  const a = await step(parse(f.command));
  const result = observeCoverage(c, b.frame, a.frame, f.command, 'new' + i, f);
  replanned.push({
    command: f.command,
    result: a.levelsCompleted > start ? 'official' : result,
  });
  b = a;
}
const measure = {
  code: r.code,
  level: r.start,
  cut,
  prefixChoices,
  discarded,
  starting,
  replanned,
  won: b.levelsCompleted > start,
  final: hash(b),
};
await writeFile(out, JSON.stringify(measure));
console.log(
  JSON.stringify({
    cut,
    discarded,
    recomputed: replanned.length,
    won: measure.won,
  }),
);
