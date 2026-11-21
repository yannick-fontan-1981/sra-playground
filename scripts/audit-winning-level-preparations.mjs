import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getGameByCode } from "../src/games/catalog.ts";
import { hash } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { dispatchWord } from "./sic-study-source-fork.mjs";
import { motions } from "./source-control-transfer.mjs";
import { footprints } from "./source-contact-footprints.mjs";

// A counterfactual about a recorded success, never an action proposal.
// Hold the entire suffix fixed and change only one public scalar action.
const [mode, environment, output, ...files] = process.argv.slice(2);
assert.ok(["source", "native"].includes(mode));
const backend =
  mode === "source"
    ? await sourceBackend(resolve(environment))
    : (
        await import(
          pathToFileURL(
            resolve(environment, "src/runtime/native-game-dispatcher.ts"),
          ).href
        )
      ).createGameDispatcher(() => {
        throw Error("Unexpected backend");
      });
const records = [],
  seen = new Set();
const word = (c) =>
  c.id === 6 ? "ACTION6:" + c.data.x + "," + c.data.y : "ACTION" + c.id;
for (const file of files)
  for (const line of (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const run = JSON.parse(line);
    assert.ok(
      getGameByCode(run.code) &&
        (getGameByCode(run.code).group === "custom_4") === (mode === "native"),
    );
    if (
      run.error ||
      run.start !== 1 ||
      !run.levels[0]?.won ||
      seen.has(run.code)
    )
      continue;
    seen.add(run.code);
    const tape = run.replayCommands.slice(0, run.levels[0].actions);
    const open = () =>
      backend.dispatch({ type: "load", code: run.code, level: 1 });
    const act = (op) => dispatchWord(backend, op);
    const won = (b) =>
      b.level > 1 ||
      b.levelsCompleted > run.initialCompleted ||
      b.state === "WIN";
    const live = (b) => b.state === "NOT_FINISHED" && !won(b);
    const resets = new Set();
    const observations = [];
    let observed = await open();
    for (const [index, c] of tape.entries()) {
      if (hash(observed).slice(0, 16) !== c.from) {
        assert.ok(resets.size < run.resets);
        observed = await backend.dispatch({ type: "reset" });
        resets.add(index);
      }
      assert.equal(hash(observed).slice(0, 16), c.from);
      observations.push(observed);
      observed = await act(word(c));
      assert.equal(hash(observed).slice(0, 16), c.to);
    }
    const lastReset = resets.size ? Math.max(...resets) : 0;
    observations.push(observed);
    async function restore(n) {
      let b = await open();
      assert.equal(hash(b), run.initial);
      for (const [index, c] of tape.slice(0, n).entries()) {
        if (resets.has(index)) b = await backend.dispatch({ type: "reset" });
        assert.equal(hash(b).slice(0, 16), c.from);
        b = await act(word(c));
        assert.equal(hash(b).slice(0, 16), c.to);
      }
      return resets.has(n) ? backend.dispatch({ type: "reset" }) : b;
    }
    assert.ok(won(await restore(tape.length)));
    const trials = [];
    for (const [i, c] of tape.entries()) {
      if (c.id !== 5 || i < lastReset || i + 1 === tape.length) continue;
      const before = await restore(i),
        after = await act(word(c));
      const options = before.availableActionIds
        .filter((id) => id >= 1 && id <= 4)
        .map((id) => "ACTION" + id);
      const arms = [];
      for (const substitute of [null, ...options]) {
        let b = await restore(i);
        if (substitute) b = await act(substitute);
        const sameImageAsOrigin = hash(b).slice(0, 16) === c.from;
        const openings = [];
        let index = i + 1,
          firstSuffixDivergence = null,
          rejoinedAt = null;
        for (; index < tape.length && live(b); index++) {
          const step = tape[index];
          if (!b.availableActionIds.includes(step.id)) break;
          const unprepared = b;
          b = await act(word(step));
          // The same intact outline starts at the same location in both arms.
          // Only the prepared trajectory translates it on this directional input.
          if (
            sameImageAsOrigin &&
            step.id <= 4 &&
            index + 1 < tape.length &&
            live(b)
          ) {
            const from = footprints(unprepared.frame);
            const to = footprints(b.frame);
            for (const move of motions(
              observations[index].frame,
              observations[index + 1].frame,
            )) {
              const key = move.from.bbox.join();
              if (
                !from.get(move.shape)?.has(key) ||
                !to.get(move.shape)?.has(key) ||
                from.get(move.shape).size !== to.get(move.shape).size
              )
                continue;
              const [left, top, right, bottom] = move.to.bbox;
              let alteredDestination = false;
              for (let y = top; y <= bottom; y++)
                for (let x = left; x <= right; x++) {
                  if (before.frame[y][x] !== after.frame[y][x])
                    alteredDestination = true;
                }
              openings.push({
                at: index + 1,
                command: step.id,
                dx: move.dx,
                dy: move.dy,
                from: move.from.bbox,
                to: move.to.bbox,
                alteredDestination,
              });
            }
          }
          const match = hash(b).slice(0, 16) === step.to;
          if (!match && firstSuffixDivergence === null)
            firstSuffixDivergence = index + 1;
          if (match && rejoinedAt === null) rejoinedAt = index + 1;
        }
        arms.push({
          substitute,
          sameImageAsOrigin,
          won: won(b),
          consumedSuffix: index - i - 1,
          firstSuffixDivergence,
          rejoinedAt,
          openings,
        });
      }
      trials.push({
        action: i + 1,
        suffix: tape.length - i - 1,
        changed: c.from !== c.to,
        movingOutlines: motions(before.frame, after.frame).length,
        arms,
      });
    }
    records.push({ code: run.code, actions: tape.length, trials });
  }
await writeFile(output, JSON.stringify(records), { flag: "wx" });
console.log(
  records.length,
  "winning starts,",
  records.reduce((n, r) => n + r.trials.length, 0),
  "tested actions",
);
