import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { hash } from "./sic-study-source-replay.mjs";
import { dispatchWord } from "./sic-study-source-fork.mjs";
import { motions } from "./source-control-transfer.mjs";
import { footprints } from "./source-contact-footprints.mjs";
import { getGameByCode } from "../src/games/catalog.ts";

// Permute the same three actions from the same prefix. The displacement must
// have an observed inverse. Compare the official outcome with the same suffix.
const [mode, environment, creditFile, output, ...files] = process.argv.slice(2);
assert.ok(["source", "native"].includes(mode));
const engine =
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
const credits = new Map(
  JSON.parse(await readFile(creditFile, "utf8")).map((r) => [r.code, r]),
);
const moves = (b) =>
  b.availableActionIds.filter((k) => k >= 1 && k <= 4).map((k) => "ACTION" + k);
const word = (c) =>
  c.id === 6 ? "ACTION6:" + c.data.x + "," + c.data.y : "ACTION" + c.id;
const act = (w) => dispatchWord(engine, w);
await writeFile(output, "", { flag: "wx" });
for (const f of files)
  for (const line of (await readFile(f, "utf8")).trim().split(/\r?\n/)) {
    const r = JSON.parse(line),
      g = getGameByCode(r.code);
    assert.ok(g && (g.group === "custom_4") === (mode === "native"));
    const row = credits.get(r.code);
    if (!row) continue;
    const selected = row.trials.filter(({ arms: [omit, ...rest] }) => {
      const same = rest.filter((a) => a.sameImageAsOrigin);
      return !omit.won && same.length && same.every((a) => !a.won);
    });
    if (!selected.length) continue;
    assert.equal(row.actions, r.levels[0].actions);
    const tape = r.replayCommands.slice(0, row.actions),
      load = () => engine.dispatch({ type: "load", code: r.code, level: 1 });
    const won = (b) =>
      b.levelsCompleted > r.initialCompleted ||
      b.level > 1 ||
      b.state === "WIN";
    const live = (b) => b.state === "NOT_FINISHED" && !won(b);
    const resetAt = new Set();
    let b = await load();
    assert.equal(hash(b), r.initial);
    for (const [i, c] of tape.entries()) {
      if (hash(b).slice(0, 16) !== c.from) {
        assert.ok(resetAt.size < r.resets);
        b = await engine.dispatch({ type: "reset" });
        resetAt.add(i);
      }
      assert.equal(hash(b).slice(0, 16), c.from);
      b = await act(word(c));
      assert.equal(hash(b).slice(0, 16), c.to);
    }
    assert.ok(won(b));
    async function restore(i) {
      let b = await load();
      for (let j = 0; j < i; j++) {
        if (resetAt.has(j)) b = await engine.dispatch({ type: "reset" });
        b = await act(word(tape[j]));
      }
      if (resetAt.has(i)) b = await engine.dispatch({ type: "reset" });
      assert.equal(hash(b).slice(0, 16), tape[i].from);
      return b;
    }
    async function continuation(b, i) {
      let used = 0;
      for (const c of tape.slice(i + 1)) {
        if (!live(b) || !b.availableActionIds.includes(c.id)) break;
        b = await act(word(c));
        used++;
      }
      return { won: won(b), state: b.state, suffix: used };
    }
    const reports = [];
    for (const trial of selected) {
      const i = trial.action - 1,
        A = word(tape[i]),
        root = await restore(i),
        tests = [];
      const original = await act(A);
      assert.equal(hash(original).slice(0, 16), tape[i].to);
      for (const forward of moves(root)) {
        await restore(i);
        const away = await act(forward);
        if (!live(away)) continue;
        const displaced = motions(root.frame, away.frame);
        if (!displaced.length) continue;
        for (const inverse of moves(away)) {
          await restore(i);
          await act(forward);
          const back = await act(inverse);
          if (hash(back) !== hash(root) || !live(back)) continue;
          const execute = async (seq) => {
            let b = await restore(i);
            const history = [b];
            for (const w of seq) {
              if (
                !live(b) ||
                !b.availableActionIds.includes(Number(w.slice(6)))
              )
                break;
              b = await act(w);
              history.push(b);
            }
            const atEnd =
              history.length === 4 ? footprints(b.frame) : new Map();
            const returned = displaced
              .filter((m) => atEnd.get(m.shape)?.has(m.from.bbox.join()))
              .map((m) => m.from.bbox);
            const outcome = await continuation(b, i);
            return {
              history,
              summary: {
                ...outcome,
                cut: history.length !== 4,
                returned,
                exit: hash(b).slice(0, 16),
              },
            };
          };
          const before = await execute([A, forward, inverse]);
          const middle = await execute([forward, A, inverse]);
          const after = await execute([forward, inverse, A]);
          const common = before.summary.returned.filter((box) =>
            [middle, after].every((arm) =>
              arm.summary.returned.some((b) => b.join() === box.join()),
            ),
          );
          const edit = (arm) =>
            arm.history.length === 4
              ? hash(arm.history[1]).slice(0, 16) !==
                hash(arm.history[2]).slice(0, 16)
              : null;
          tests.push({
            forward,
            inverse,
            sourceMotion: displaced.map((m) => [m.from.bbox, m.dx, m.dy]),
            atOrigin: before.summary,
            atOther: middle.summary,
            afterReturn: after.summary,
            sameFinalActor: common.length > 0,
            changedAtOther: edit(middle),
            comparable:
              common.length > 0 &&
              [before, middle, after].every((a) => !a.summary.cut),
          });
        }
      }
      reports.push({ action: trial.action, operation: A, tests });
    }
    const result = {
      code: r.code,
      initial: r.initial,
      level: 1,
      officialActions: row.actions,
      reports,
    };
    await appendFile(output, JSON.stringify(result) + "\n");
    console.log(
      r.code,
      reports.length,
      reports.reduce((n, r) => n + r.tests.length, 0),
    );
  }
