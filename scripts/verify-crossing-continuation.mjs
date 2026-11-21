import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';

const [engineDir, archive, tapeFile, packFile, output] = process.argv.slice(2);
const tape = JSON.parse(await readFile(tapeFile, 'utf8')),
  pack = JSON.parse(await readFile(packFile, 'utf8'));
assert.equal(tape.packDigest, pack.digest);
assert.equal(
  pack.configuration.informationPreference.strategy,
  'bind_earlier_motions_to_registered_subjects',
);
assert.equal(tape.start, tape.finish);
assert.equal(tape.resets, 0);
const load = (p) => import(pathToFileURL(resolve(p)));
const { createGameDispatcher } = await load(
  resolve(engineDir, 'src/runtime/native-game-dispatcher.ts'),
);
const { detectTransportSelection, observeTransport, readTransport } =
  await load(resolve(archive, 'src/sic/transport-observations.ts'));
const { retainMotion, recoverRegisteredMotions } = await load(
  resolve(archive, 'src/sic/motion-before-selection.ts'),
);
const { registerCrossing, observeCrossing, proposeCrossing } = await load(
  resolve(archive, 'src/sic/sustained-crossing.ts'),
);
const { measureNativeObservation } = await load(
  resolve(archive, 'src/logos-engine/v6-native-observer.ts'),
);
const { visualLayout } = await load(
  resolve(archive, 'src/sic/witnessed-preview-transfer.ts'),
);
const e = createGameDispatcher(() => {
  throw Error('Public dispatcher required');
});
let b = await e.dispatch({ type: 'load', code: tape.code, level: tape.start });
if (b.level !== tape.start)
  b = await e.dispatch({ type: 'selectLevel', level: tape.start });
const initial = b.levelsCompleted,
  history = {},
  built = [],
  stepped = {},
  limits = pack.configuration;
let m,
  c,
  cut,
  discarded,
  recomputed = 0,
  prefixForecasts = 0,
  won = false,
  length = 0;
for (let i = 0; i < tape.cap; i++) {
  const proposal =
    c && proposeCrossing(c, m, b.frame, limits.maxDepth, limits.maxNodes);
  let cmd;
  if (!cut) {
    cmd = tape.replayCommands[i];
    assert.ok(cmd);
    assert.equal(hash(b).slice(0, 16), cmd.from);
    assert.equal(
      proposal?.command,
      cmd.cooperative?.crossing ? cmd.cooperative.command : undefined,
    );
    if (proposal) prefixForecasts++;
  } else {
    assert.ok(proposal, 'No continuation after withdrawing the cached plan');
    const [name, point] = proposal.command.split(':');
    cmd = {
      id: Number(name.slice(6)),
      ...(point
        ? {
            data: {
              x: Number(point.split(',')[0]),
              y: Number(point.split(',')[1]),
            },
          }
        : {}),
    };
    recomputed++;
  }
  const op =
    'ACTION' + cmd.id + (cmd.data ? ':' + cmd.data.x + ',' + cmd.data.y : '');
  const a = await e.dispatch({
    type: 'action',
    actionId: cmd.id,
    ...(cmd.data ? { data: cmd.data } : {}),
  });
  const ref = 'step/' + (i + 1);
  if (!cut) assert.equal(hash(a).slice(0, 16), cmd.to);
  if (!m && cmd.id !== 6 && hash(b) !== hash(a))
    retainMotion(history, op, b.frame, a.frame, ref);
  if (!m && cmd.id === 6) {
    const obs = await measureNativeObservation(
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
    m = detectTransportSelection(
      visualLayout(obs, b.frame),
      b.frame,
      a.frame,
      [cmd.data.x, cmd.data.y],
      ref,
    );
    if (m) {
      c = registerCrossing(m, b.frame);
      if (c) recoverRegisteredMotions(m, history);
    }
  }
  const previous = c ? [...c.supports] : [];
  if (m) observeTransport(m, b.frame, a.frame, op, ref);
  if (c) {
    const result = observeCrossing(c, m, b.frame, a.frame, op, ref, proposal);
    const official = a.levelsCompleted > initial || a.state === 'WIN';
    if (proposal && !official)
      assert.equal(result, 'crossing_prediction_verified');
    const reading = readTransport(m, a.frame);
    for (const p of c.supports) {
      if (!previous.includes(p)) {
        built.push({ step: i + 1, site: p });
        assert.notEqual(readTransport(m, b.frame).tiles[p], reading.tiles[p]);
      }
      if (reading?.subject.includes(p) && !stepped[p]) stepped[p] = i + 1;
    }
    if (!cut && c.supports.length > previous.length) {
      cut = i + 1;
      discarded = c.plan?.length ?? 0;
      assert.ok(discarded, 'No saved continuation to withdraw');
      delete c.plan;
    }
  }
  b = a;
  length = i + 1;
  won = b.levelsCompleted > initial || b.state === 'WIN';
  if (won) break;
}
assert.ok(cut && recomputed && won);
await writeFile(
  output,
  JSON.stringify(
    {
      code: tape.code,
      cut,
      discarded,
      recomputed,
      prefixForecasts,
      built,
      stepped,
      won,
      length,
      final: hash(b),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  tape.code,
  'withdrew',
  discarded,
  'actions at',
  cut,
  'and won at',
  length,
);
