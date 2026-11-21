import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";
import { dispatchWord } from "./sic-study-source-fork.mjs";

// Post-run assay. Carry forward only an operation whose removal spoiled the
// recorded prior-level win under both omission and an equal-duration control.
const [solver, environment, tapeFile, priorFile, output] =
  process.argv.slice(2);
const mod = (root, path) => import(pathToFileURL(resolve(root, path)).href);
const { measureNativeObservation } = await mod(
  solver,
  "src/logos-engine/v6-native-observer.ts",
);
const { visualLayout } = await mod(
  solver,
  "src/sic/witnessed-preview-transfer.ts",
);
const { cellMatches } = await mod(
  solver,
  "src/sic/calibrate-spatial-controls.ts",
);
const { createGameDispatcher } = await mod(
  environment,
  "src/runtime/native-game-dispatcher.ts",
);
const r = JSON.parse((await readFile(tapeFile, "utf8")).trim());
const prior = JSON.parse(await readFile(priorFile, "utf8")).find(
  (row) => row.code === r.code,
);
assert.ok(
  r.start === 1 &&
    r.levels[0].won &&
    r.levels.length === 2 &&
    prior?.actions === r.levels[0].actions,
);
const tape = r.replayCommands,
  word = (c) =>
    c.id === 6 ? "ACTION6:" + c.data.x + "," + c.data.y : "ACTION" + c.id;
assert.equal(
  prior.winningTapeDigest,
  createHash("sha256")
    .update(
      JSON.stringify(
        tape.slice(0, prior.actions).map((c) => [word(c), c.from, c.to]),
      ),
    )
    .digest("hex"),
);
const preps = new Set(
  prior.trials
    .filter((t) => {
      const [omit, ...rest] = t.arms,
        shams = rest.filter((x) => x.sameImageAsOrigin);
      return !omit.won && shams.length && shams.every((v) => !v.won);
    })
    .map((t) => word(tape[t.action - 1])),
);
const game = createGameDispatcher(() => {
    throw Error("Unexpected backend");
  }),
  resets = new Set();
const load = () => game.dispatch({ type: "load", code: r.code, level: 1 });
let b = await load();
assert.equal(hash(b), r.initial);
for (const [j, c] of tape.entries()) {
  if (hash(b).slice(0, 16) !== c.from) {
    assert.ok(resets.size < r.resets);
    b = await game.dispatch({ type: "reset" });
    resets.add(j);
  }
  assert.equal(hash(b).slice(0, 16), c.from);
  b = await dispatchWord(game, word(c));
  assert.equal(hash(b).slice(0, 16), c.to);
}
async function restore(i) {
  let b = await load();
  for (let j = 0; j < i; j++) {
    if (resets.has(j)) b = await game.dispatch({ type: "reset" });
    b = await dispatchWord(game, word(tape[j]));
  }
  if (resets.has(i)) b = await game.dispatch({ type: "reset" });
  assert.equal(hash(b).slice(0, 16), tape[i].from);
  return b;
}
async function layout(b) {
  const o = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((n) => "ACTION" + n),
    },
    1,
    "audit",
  );
  return visualLayout(o, b.frame);
}
const tests = [],
  seen = new Set();
for (const p of r.preparation) {
  if (p.level !== 2 || p.phase !== "seekTerminalContact") continue;
  const det = p.terminalContact,
    t = det.trial,
    i = p.actionIndex - 1;
  if (
    t.distance !== 1 ||
    det.matched ||
    !cellMatches(det.actual, t.from, t.pitch)
  )
    continue;
  assert.equal(t.before.split(":").at(-1).slice(0, 16), tape[i].from);
  assert.equal(t.op, word(tape[i]));
  const key = JSON.stringify([tape[i].from, t.op, t.witness.actor, t.to]);
  if (seen.has(key)) continue;
  seen.add(key);
  const root = await restore(i);
  assert.equal(root.level, 2);
  const live = (b) =>
    b.level === root.level &&
    b.levelsCompleted === root.levelsCompleted &&
    b.state === "NOT_FINISHED";
  const present = (parts, where) =>
    parts.some((v) => cellMatches(v.at, where, t.pitch)) &&
    parts.length === 1 + t.peers.length &&
    t.peers.every((peer) =>
      parts.some((v) => cellMatches(v.at, peer, t.pitch)),
    );
  const actual = async (prep) => {
    let b = await restore(i);
    if (prep) b = await dispatchWord(game, prep);
    if (!live(b) || !b.availableActionIds.includes(Number(t.op.slice(6))))
      return { comparable: false };
    if (!present((await layout(b))[t.witness.actor] ?? [], t.from))
      return { comparable: false };
    b = await dispatchWord(game, t.op);
    const won = b.levelsCompleted > root.levelsCompleted || b.state === "WIN";
    return {
      comparable: true,
      won,
      opened:
        won ||
        (live(b) && present((await layout(b))[t.witness.actor] ?? [], t.to)),
    };
  };
  for (const prep of preps) {
    if (!root.availableActionIds.includes(Number(prep.slice(6)))) continue;
    const alone = await actual(null),
      repeat = await actual(t.op),
      withPrior = await actual(prep);
    assert.ok(alone.comparable && !alone.opened);
    tests.push({
      decision: i + 1,
      prior: prep,
      test: t.op,
      alone,
      repeat,
      withPrior,
    });
  }
}
await writeFile(
  output,
  JSON.stringify({
    code: r.code,
    source: r.trajectory,
    preparations: [...preps],
    tests,
  }),
  { flag: "wx" },
);
console.log(
  r.code,
  tests.length,
  "blocked contact(s),",
  tests.filter(
    (t) => t.withPrior.opened && t.repeat.comparable && !t.repeat.opened,
  ).length,
  "contrastive openings",
);
