import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { getGameByCode } from "../src/games/catalog.ts";
import { changedFootprints } from "./source-contact-footprints.mjs";
import {
  scene,
  locate,
  learnConditions,
  rankLayouts,
} from "./source-crossing-conditions.mjs";
import {
  preparationModel,
  project,
  predictionHolds,
} from "./source-project-preparations.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { hash, op, sourceReplay } from "./sic-study-source-replay.mjs";

const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(environment);
await writeFile(output, "", { flag: "wx" });
const digest = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const same = (a, b) => a && b && a.join() === b.join();
const uniqueRuns = new Set();

// Merge the local effects of one command only where their forecasts agree.
function nextLayouts(rows, model, available) {
  const byCommand = Map.groupBy(model.options(rows, available), (e) => e.op);
  const candidates = [];
  for (const [word, effects] of byCommand) {
    const pixels = new Map();
    let agrees = true;
    for (const effect of effects)
      for (const change of effect.changes) {
        const key = change[0] + "," + change[1],
          prior = pixels.get(key);
        if (prior && prior[3] !== change[3]) agrees = false;
        pixels.set(key, change);
      }
    if (!agrees) continue;
    const predicted = { changes: [...pixels.values()] },
      next = project(rows, predicted);
    if (next) candidates.push({ word, predicted, next });
  }
  return candidates.sort((a, b) => a.word.localeCompare(b.word));
}

function selectPlan(rows, commands, role, from, delta, available, model) {
  const current = rows.at(-1),
    samples = learnConditions(rows, commands, role);
  if (!samples.some((s) => s.moved) || !samples.some((s) => !s.moved))
    return null;
  const options = [];
  for (const first of nextLayouts(current, model, available).slice(0, 10)) {
    options.push([first]);
    for (const second of nextLayouts(first.next, model, available).slice(0, 10))
      options.push([first, second]);
  }
  const ranked = rankLayouts(
    [current, ...options.map((chain) => chain.at(-1).next)],
    role,
    from,
    delta,
    samples,
  );
  const base = ranked.scores[0];
  if (base === null) return null;
  const choices = options
    .map((chain, i) => ({ chain, score: ranked.scores[i + 1] }))
    .filter((v) => v.score !== null && v.score > base)
    .sort((a, b) => b.score - a.score || a.chain.length - b.chain.length);
  return choices[0]
    ? {
        ...choices[0],
        gain: choices[0].score - base,
        alternatives: choices.length,
      }
    : null;
}

for (const file of files)
  for (const line of (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const run = JSON.parse(line),
      key = run.code + "/" + run.start;
    assert.ok(
      getGameByCode(run.code) && getGameByCode(run.code).group !== "custom_4",
    );
    if (
      uniqueRuns.has(key) ||
      run.error ||
      run.resets ||
      run.observedPriorLevelActions ||
      run.sourcePrefixActions ||
      run.start !== run.finish
    )
      continue;
    uniqueRuns.add(key);
    const replay = sourceReplay(engine, {}, run),
      tape = run.steps.map(op),
      model = preparationModel();
    let board = replay.restore(0),
      history = [board.frame];
    const laws = new Map(),
      seen = new Set(),
      tests = [];
    let stalls = 0,
      frontiers = 0;
    const active = (b) => !replay.win(b) && b.state === "NOT_FINISHED";
    for (let i = 0; i < tape.length && active(board); i++) {
      const word = tape[i],
        before = board;
      board = replay.act(word);
      assert.equal(hash(board).slice(0, 16), run.steps[i].to);
      if (!active(board)) break;
      model.observe(before.frame, board.frame, word, hash(before));
      history.push(board.frame);
      if (!/^ACTION[1-4]$/.test(word)) continue;
      const oldView = scene(before.frame),
        view = scene(board.frame);
      for (const move of changedFootprints(oldView, view)) {
        if (move.copies !== 1) continue;
        const id = JSON.stringify([word, move.shape]),
          law = laws.get(id) ?? { role: move.shape, word, byDelta: new Map() };
        const k = [move.dx, move.dy].join(),
          origins = law.byDelta.get(k) ?? new Set();
        origins.add(move.from.bbox.join());
        law.byDelta.set(k, origins);
        laws.set(id, law);
      }
      const proposals = [];
      for (const law of laws.values()) {
        if (law.word !== word || law.byDelta.size !== 1) continue;
        const [d, origins] = law.byDelta.entries().next().value;
        if (origins.size < 2) continue;
        const delta = d.split(",").map(Number),
          from = locate(board.frame, law.role),
          prior = locate(before.frame, law.role);
        if (!same(prior, from)) continue;
        stalls++;
        const to = from.map((n, k) => n + delta[k % 2]);
        if (
          to[0] < 0 ||
          to[1] < 0 ||
          to[2] >= board.frame[0].length ||
          to[3] >= board.frame.length ||
          history.some((rows) => same(locate(rows, law.role), to))
        )
          continue;
        const site = digest([hash(board), word, law.role]);
        if (seen.has(site)) continue;
        seen.add(site);
        frontiers++;
        const available = new Set(
          board.availableActionIds.map((n) => "ACTION" + n),
        );
        const proposal = selectPlan(
          history,
          tape.slice(0, i + 1),
          law.role,
          from,
          delta,
          available,
          model,
        );
        if (proposal) proposals.push({ ...proposal, role: law.role, from, to });
      }
      const best = proposals.sort(
        (a, b) => b.gain - a.gain || a.chain.length - b.chain.length,
      )[0];
      if (!best || tests.length >= 5) continue;
      // Seal the selected gestures before asking the engine about any alternative.
      const prefix = i + 1,
        words = best.chain.map((s) => s.word);
      function test(branch, check = false) {
        let b = replay.restore(prefix),
          verified = 0;
        for (let k = 0; k < branch.length; k++) {
          if (!active(b)) break;
          b = replay.act(branch[k]);
          if (check) {
            if (!predictionHolds(b.frame, best.chain[k].predicted)) break;
            verified++;
          }
        }
        const launch = same(locate(b.frame, best.role), best.from) === true;
        const alreadyWon = replay.win(b);
        let used = false;
        if (active(b) && (!check || verified === branch.length) && launch) {
          b = replay.act(word);
          used = true;
        }
        const crossed =
            used && same(locate(b.frame, best.role), best.to) === true,
          won = replay.win(b);
        // All arms get the same recorded continuation available to the historical arm after an equal time.
        // The suffix is used exclusively to score the preselected experiment.
        const suffix = tape.slice(prefix + words.length + 1);
        for (const next of suffix) {
          if (
            !active(b) ||
            !b.availableActionIds.includes(Number(next.split(":")[0].slice(6)))
          )
            break;
          b = replay.act(next);
        }
        return {
          verified,
          launch,
          used,
          crossed,
          alreadyWon,
          won,
          wonWithRecordedContinuation: replay.win(b),
        };
      }
      const prepared = test(words, true),
        alone = test([]);
      const sameLength = test(words.map(() => word));
      const substitutions = board.availableActionIds
        .filter((n) => n > 0 && n !== 6)
        .map((n) => "ACTION" + n)
        .filter((a) => a !== word && a !== words.at(-1))
        .map((a) => ({ replacement: a, ...test([...words.slice(0, -1), a]) }));
      tests.push({
        prefix,
        use: word,
        preparations: words,
        gain: best.gain,
        alternatives: best.alternatives,
        prepared,
        alone,
        sameLength,
        substitutions,
      });
      board = replay.restore(prefix);
    }
    await appendFile(
      output,
      JSON.stringify({
        code: run.code,
        level: run.start,
        stalls,
        frontiers,
        tests,
      }) + "\n",
    );
  }
