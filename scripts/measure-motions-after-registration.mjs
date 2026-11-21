import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash } from './sic-study-source-replay.mjs';
const [engineDir, archive, out, ...files] = process.argv.slice(2);
const load = (p) => import(pathToFileURL(resolve(p)));
const { createGameDispatcher } = await load(
  resolve(engineDir, 'src/runtime/native-game-dispatcher.ts'),
);
const { detectTransportSelection, observeTransport, readTransport } =
  await load(resolve(archive, 'src/sic/transport-observations.ts'));
const { retainMotion, recoverRegisteredMotions } = await load(
  resolve(archive, 'src/sic/motion-before-selection.ts'),
);
const { measureNativeObservation } = await load(
  resolve(archive, 'src/logos-engine/v6-native-observer.ts'),
);
const { visualLayout } = await load(
  resolve(archive, 'src/sic/witnessed-preview-transfer.ts'),
);
const report = [];
for (const file of files) {
  const tape = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(tape.start, tape.finish);
  assert.equal(tape.resets, 0);
  const e = createGameDispatcher(() => {
    throw Error('Public dispatcher required');
  });
  let b = await e.dispatch({
    type: 'load',
    code: tape.code,
    level: tape.start,
  });
  if (b.level !== tape.start)
    b = await e.dispatch({ type: 'selectLevel', level: tape.start });
  const history = {},
    tested = {},
    mismatches = [];
  let m,
    registration,
    predictions = {};
  for (const [i, cmd] of tape.replayCommands.entries()) {
    assert.equal(hash(b).slice(0, 16), cmd.from);
    const a = await e.dispatch({
      type: 'action',
      actionId: cmd.id,
      ...(cmd.data ? { data: cmd.data } : {}),
    });
    assert.equal(hash(a).slice(0, 16), cmd.to);
    const op =
        'ACTION' +
        cmd.id +
        (cmd.data ? ':' + cmd.data.x + ',' + cmd.data.y : ''),
      ref = 'step/' + (i + 1);
    if (!m && cmd.id <= 4 && cmd.from !== cmd.to)
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
        registration = i + 1;
        recoverRegisteredMotions(m, history);
        predictions = { ...m.motors };
      }
    }
    if (m) {
      if (predictions[op]) {
        const pre = readTransport(m, b.frame),
          post = readTransport(m, a.frame),
          side = m.active,
          peer = 1 - side;
        if (pre && post && post.subject[peer] === pre.subject[peer]) {
          const p = pre.subject[side],
            q = post.subject[side],
            w = m.grid.columns;
          const dx = (q % w) - (p % w),
            dy = Math.floor(q / w) - Math.floor(p / w);
          if (Math.abs(dx) + Math.abs(dy) === 1) {
            const found = (tested[op] ??= { tested: 0, matched: 0 });
            found.tested++;
            const v = predictions[op];
            if (v.dx === dx && v.dy === dy) found.matched++;
            else mismatches.push(i + 1);
          }
        }
      }
      observeTransport(m, b.frame, a.frame, op, ref);
    }
    b = a;
  }
  report.push({
    code: tape.code,
    level: tape.start,
    registration,
    predictions,
    tested,
    mismatches,
  });
}
await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log(
  report.map((r) => [
    r.code,
    r.registration ?? null,
    Object.keys(r.predictions).length,
    Object.values(r.tested).reduce((n, x) => n + x.matched, 0),
    r.mismatches.length,
  ]),
);
