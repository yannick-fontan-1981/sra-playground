import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [engineRoot, tapeFile, output] = process.argv.slice(2);
const tape = JSON.parse(await readFile(tapeFile, 'utf8'));
assert.equal(tape.start, tape.finish);
assert.equal(tape.resets, 0);
assert.equal(tape.observedPriorLevelActions ?? 0, 0);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(engineRoot, 'src/runtime/native-game-dispatcher.ts'))
);
const frameHash = (rows) =>
  createHash('sha256').update(JSON.stringify(rows)).digest('hex').slice(0, 16);
const trials = [];
for (const [index, command] of tape.replayCommands.entries()) {
  const f = command.cooperative;
  if (!f || command.id < 1 || command.id > 4) continue;
  const covered = (s) =>
    f.coverage?.controls.every((p) => s.pieces.includes(p));
  const purpose =
    f.crossing && f.expected.supports.length > f.from.supports.length
      ? 'extend_walkable_ground'
      : f.coverage?.testPeerPush &&
          f.from.subjects[1 - f.from.active] !==
            f.expected.subjects[1 - f.from.active]
        ? 'displace_the_parked_partner'
        : f.coverage && !covered(f.from) && covered(f.expected)
          ? 'maintain_all_controls'
          : undefined;
  if (!purpose) continue;
  async function replay(replacement) {
    const engine = createGameDispatcher(() => {
      throw Error('Unexpected engine');
    });
    let b = await engine.dispatch({
      type: 'load',
      code: tape.code,
      level: tape.start,
    });
    if (b.level !== tape.start)
      b = await engine.dispatch({ type: 'selectLevel', level: tape.start });
    const initial = b.levelsCompleted;
    let outcome, candidates;
    for (const [i, c] of tape.replayCommands.entries()) {
      if (i <= index || replacement === undefined)
        assert.equal(frameHash(b.frame), c.from);
      if (i === index)
        candidates = b.availableActionIds.filter(
          (op) => op >= 1 && op <= 4 && op !== command.id,
        );
      const id = i === index && replacement !== undefined ? replacement : c.id;
      b = await engine.dispatch({
        type: 'action',
        actionId: id,
        ...(id === 6 ? { data: c.data } : {}),
      });
      const image = frameHash(b.frame);
      if (replacement === undefined) assert.equal(image, c.to);
      if (i === index) outcome = image;
      if (b.levelsCompleted > initial || b.state === 'WIN')
        return { won: true, length: i + 1, outcome, candidates };
      if (b.state === 'GAME_OVER')
        return { won: false, length: i + 1, outcome, candidates };
    }
    return {
      won: false,
      length: tape.replayCommands.length,
      outcome,
      candidates,
    };
  }
  const { candidates, ...reference } = await replay();
  assert.equal(reference.won, true);
  const alternatives = [];
  for (const id of candidates) {
    const { candidates: _unused, ...result } = await replay(id);
    alternatives.push({ id, ...result });
  }
  trials.push({
    step: index + 1,
    purpose,
    choice: command.id,
    commonFrame: command.from,
    reference,
    alternatives,
  });
}
assert.ok(trials.length, 'No prospective preparation in this tape');
await writeFile(
  output,
  JSON.stringify(
    { code: tape.code, entry: tape.start, pack: tape.packDigest, trials },
    null,
    2,
  ) + '\n',
);
console.log(tape.code, trials.length, 'preparations compared');
