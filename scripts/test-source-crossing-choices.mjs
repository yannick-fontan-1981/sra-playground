import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import {
  measureNativeObservation,
  ObservedInputDomain,
} from "../src/logos-engine/v6-native-observer.ts";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { op, hash, sourceReplay } from "./sic-study-source-replay.mjs";
import {
  scene,
  locate,
  learnConditions,
  rankLayouts,
} from "./source-crossing-conditions.mjs";
import { preparationModel, project } from "./source-project-preparations.mjs";
import { preparationSites } from "./source-preparation-sites.mjs";

const [environment, questions, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const read = async (f) =>
  (await readFile(f, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
const study = new Map(
  (await read(questions)).map((r) => [[r.code, r.level].join("/"), r]),
);
const digest = (s) => createHash("sha256").update(s).digest("hex");
await writeFile(output, "", { flag: "wx" });
const legal = (b, cmd) =>
  b.availableActionIds.includes(Number(cmd.split(":")[0].slice(6)));

async function possible(board, sites) {
  const ops = board.availableActionIds
    .filter((n) => n > 0 && n !== 6)
    .map((n) => "ACTION" + n);
  if (!board.availableActionIds.includes(6)) return ops;
  const view = await measureNativeObservation(
    {
      frame_rows: board.frame,
      frame_hash: hash(board),
      state: board.state,
      level: board.level,
      levels_completed: board.levelsCompleted,
      available_action_refs: board.availableActionIds.map((n) => "ACTION" + n),
    },
    1,
    "source-crossing",
  );
  const visible = new ObservedInputDomain(32)
    .candidates(view)
    .filter((c) => c.action_ref === "ACTION6")
    .map((c) => "ACTION6:" + c.data.x + "," + c.data.y);
  return [
    ...ops,
    ...sites
      .nominate(board.frame, null, visible)
      .slice(0, 6)
      .map((p) => p.op),
  ];
}
function imagine(rows, words, model, available) {
  for (const word of words) {
    const effects = model.options(rows, available).filter((s) => s.op === word);
    if (!effects.length) return null;
    // Only combine predictions that assign the same value to any overlapping cell.
    const changes = new Map();
    for (const effect of effects)
      for (const change of effect.changes) {
        const key = change.slice(0, 2).join(),
          prior = changes.get(key);
        if (prior && prior[3] !== change[3]) return null;
        changes.set(key, change);
      }
    rows = project(rows, { changes: [...changes.values()] });
    if (!rows) return null;
  }
  return rows;
}
for (const file of files)
  for (const r of await read(file)) {
    const id = [r.code, r.start].join("/"),
      trial = study.get(id);
    if (!trial) continue;
    study.delete(id);
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== "custom_4",
    );
    const replay = sourceReplay(engine, {}, r),
      tape = r.steps.map(op),
      active = (b) => !replay.win(b) && b.state === "NOT_FINISHED";
    const cases = [],
      unique = new Set();
    for (const q of trial.experiments) {
      if (q.end - q.start !== 1) continue;
      // Nested sprites can give several masks for one physical crossing. Use one question per event.
      const event = [q.start, q.end, q.useIndex].join("/");
      if (unique.has(event)) continue;
      unique.add(event);
      const prefix = tape.slice(0, q.start),
        approach = tape.slice(q.end, q.useIndex);
      const model = preparationModel(),
        sites = preparationSites();
      let board = replay.restore(0);
      const frames = [board.frame];
      for (const word of prefix) {
        const before = board;
        board = replay.act(word);
        model.observe(before.frame, board.frame, word, hash(before));
        sites.observe(before.frame, board.frame, word);
        frames.push(board.frame);
      }
      const origin = hash(board);
      assert.ok(origin.startsWith(r.steps[q.start].from));
      const role = [...scene(board.frame).keys()].find(
        (key) => digest(key) === q.subject,
      );
      assert.ok(role);
      const delta = [q.to[0] - q.from[0], q.to[1] - q.from[1]],
        training = learnConditions(frames, prefix, role);
      const available = new Set(
        board.availableActionIds.map((n) => "ACTION" + n),
      );
      const alternatives = (await possible(board, sites)).sort((a, b) =>
        digest(origin + a).localeCompare(digest(origin + b)),
      );
      const forecasts = alternatives.map((word) =>
        imagine(board.frame, [word, ...approach], model, available),
      );
      const imagined = rankLayouts(forecasts, role, q.from, delta, training);
      function play(commands) {
        let b = replay.restore(q.start);
        for (const cmd of commands) {
          if (!active(b) || !legal(b, cmd)) break;
          b = replay.act(cmd);
        }
        return b;
      }
      // Observe the end of the preparation and approach, never the requested use during ranking.
      const setups = alternatives.map((word) => play([word, ...approach]));
      const observed = rankLayouts(
        setups.map((b) => (active(b) ? b.frame : null)),
        role,
        q.from,
        delta,
        training,
      );
      const sealed = digest(
        JSON.stringify({ origin, alternatives, imagined, observed }),
      );
      function score(words) {
        const at = play([...words, ...approach]);
        const matched =
          active(at) && locate(at.frame, role)?.join() === q.from.join();
        const next =
          active(at) && legal(at, q.action) ? replay.act(q.action) : at;
        const pos = active(next) ? locate(next.frame, role) : null;
        const crossed = !!matched && pos?.join() === q.to.join(),
          stayed = !!matched && pos?.join() === q.from.join();
        let last = next;
        for (const cmd of tape.slice(q.useIndex + 1)) {
          if (!active(last) || !legal(last, cmd)) break;
          last = replay.act(cmd);
        }
        return { matched: !!matched, crossed, stayed, won: replay.win(last) };
      }
      const options = alternatives.map((w) => score([w])),
        omitted = score([]);
      const original = score(tape.slice(q.start, q.end));
      assert.ok(original.crossed && original.won === r.levels[0].won);
      const wins = options.map((o, k) => ({
        crossed: o.crossed,
        scored: o.won,
        necessary:
          o.crossed &&
          o.won &&
          omitted.stayed &&
          !omitted.won &&
          options.some((a, j) => j !== k && a.stayed && !a.won),
      }));
      cases.push({
        event,
        action: q.action,
        from: q.from.slice(0, 2),
        to: q.to.slice(0, 2),
        approach: approach.length,
        sealed,
        alternatives,
        historicalOffered: alternatives.includes(tape[q.start]),
        imagined,
        observed,
        omitted,
        options,
        wins,
      });
    }
    await appendFile(
      output,
      JSON.stringify({ code: r.code, level: r.start, cases }) + "\n",
    );
  }
assert.equal(study.size, 0);
