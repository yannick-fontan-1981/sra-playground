import assert from "node:assert/strict";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { getGameByCode } from "../src/games/catalog.ts";
import {
  ObservedInputDomain,
  measureNativeObservation,
} from "../src/logos-engine/v6-native-observer.ts";
import { hash, op, sourceReplay } from "./sic-study-source-replay.mjs";
import { motions, responses } from "./source-control-transfer.mjs";
import { controlCandidateFeatures } from "./source-control-candidates.mjs";
const [environment, study, output, ...files] = process.argv.slice(2);
const parse = async (f) =>
  (await readFile(f, "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const engine = await sourceBackend(resolve(environment)),
  cases = new Map(
    (await parse(study)).map((r) => [[r.code, r.level].join("/"), r]),
  );
await writeFile(output, "", { flag: "wx" });
for (const file of files)
  for (const run of await parse(file)) {
    const key = [run.code, run.start].join("/"),
      casesForRun = cases.get(key);
    if (!casesForRun) continue;
    cases.delete(key);
    assert.ok(
      getGameByCode(run.code) && getGameByCode(run.code).group !== "custom_4",
    );
    const starts = new Map();
    for (const q of casesForRun.results) {
      const test = q.tests.find((t) => t.equal);
      if (test && !starts.has(q.prefix)) starts.set(q.prefix, { q, test });
    }
    const replay = sourceReplay(engine, {}, run),
      results = [];
    let b = replay.restore(0),
      recent = [];
    for (let i = 0; i <= Math.max(-1, ...starts.keys()); i++) {
      if (starts.has(i)) {
        const { q, test } = starts.get(i),
          before = b,
          known = run.steps[i];
        const o = await measureNativeObservation(
          {
            frame_rows: b.frame,
            frame_hash: hash(b),
            level: b.level,
            levels_completed: b.levelsCompleted,
            state: b.state,
            available_action_refs: b.availableActionIds.map(
              (n) => "ACTION" + n,
            ),
          },
          i + 1,
          "source-locus",
        );
        const points = new ObservedInputDomain(32)
          .candidates(o)
          .filter((c) => c.action_ref === "ACTION6")
          .map((c) => [c.data.x, c.data.y]);
        const features = controlCandidateFeatures(before.frame, recent, points);
        const candidates = [];
        for (const [j, p] of points.entries()) {
          const word = "ACTION6:" + p.join();
          replay.restore(i);
          const middle = replay.act(word);
          let movesOther = false,
            sameObservedSelection = false;
          if (middle.state === "NOT_FINISHED" && !replay.win(middle)) {
            sameObservedSelection = hash(middle).slice(0, 16) === known.to;
            const next = replay.act(test.cmd);
            if (next.state === "NOT_FINISHED" && !replay.win(next)) {
              const effects = motions(middle.frame, next.frame);
              movesOther =
                responses(effects, q.to, q.radius).includes(test.selected) &&
                !responses(effects, q.from, q.radius).length;
            }
          }
          candidates.push({
            point: p,
            features: features[j],
            movesOther,
            sameObservedSelection,
          });
        }
        results.push({
          prefix: i,
          hosts: recent.length,
          cmd: test.cmd,
          candidates,
        });
        b = replay.restore(i);
      }
      if (i >= run.steps.length) break;
      const c = run.steps[i],
        old = b;
      b = replay.act(op(c));
      assert.equal(hash(b).slice(0, 16), c.to);
      if (c.a <= 4) {
        const m = motions(old.frame, b.frame);
        if (m.length) recent = [...m, ...recent].slice(0, 8);
      }
    }
    await appendFile(
      output,
      JSON.stringify({ code: run.code, level: run.start, results }) + "\n",
    );
  }
