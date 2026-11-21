import assert from "node:assert/strict";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureExposedReception as measure } from "../src/logos-engine/v6-exposed-reception-observation.ts";
import {
  exposureLayout,
  exposureRules,
  exposureMatches,
  planExposure,
  finishedExposure,
  readTrackedExposure,
} from "../src/sic/coupled-exposure.ts";
import { observeExposureConditions as learn } from "../src/sic/observed-exposure-conditions.ts";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { sourceInterface } from "./sic-study-source-interface.mjs";
import { sourceReplay, hash, op } from "./sic-study-source-replay.mjs";
import {
  motorChoices,
  latentModels,
  firstRevealingSequence,
  bindMeasuredAppearance,
} from "./source-latent-motion.mjs";
const [environment, output, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
await writeFile(output, "", { flag: "wx" });
for (const f of files)
  for (const line of (await readFile(f, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const r = JSON.parse(line);
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== "custom_4",
    );
    if (
      r.resets ||
      r.error ||
      r.observedPriorLevelActions ||
      r.sourcePrefixActions
    )
      continue;
    const replay = sourceReplay(
        sourceInterface(engine, r.sourceInterface),
        {},
        r,
      ),
      tests = [];
    let b = replay.restore(0),
      s = measure(b.frame),
      mem = null;
    for (let i = 0; i < Math.min(r.steps.length, 32); i++) {
      const c = r.steps[i];
      b = replay.act(op(c));
      assert.equal(hash(b).slice(0, 16), c.to);
      if (replay.win(b) || b.state !== "NOT_FINISHED") break;
      const next = measure(b.frame);
      if (s && next)
        mem = learn(
          mem,
          1,
          s,
          next,
          { action_ref: "ACTION" + c.a, data: c.data ?? {} },
          String(i + 1),
        );
      s = next;
      if (![4, 8, 16, 32].includes(i + 1) || !s || mem?.layout !== s.layout)
        continue;
      const models = latentModels(s, mem),
        commands = motorChoices(s, mem.directions, b.availableActionIds),
        q = firstRevealingSequence(models, commands);
      if (!q) continue;
      const tested = {
        prefix: i + 1,
        models: models.length,
        planned: q.path.length,
        examined: q.examined,
        matched: 0,
        bound: false,
        stages: [],
        won: false,
      };
      tests.push(tested);
      let states = models.map((m) => m.current),
        colors = null;
      for (const [j, action] of q.path.entries()) {
        states = models.map((m, k) => m.rules.project(states[k], action));
        b = replay.act(commands.get(action));
        if (replay.win(b)) {
          tested.won = true;
          break;
        }
        const observed = measure(b.frame);
        if (!observed || observed.layout !== s.layout) break;
        if (j === q.path.length - 1) {
          const valid = models.flatMap((m, k) => {
            const v = bindMeasuredAppearance(m, states[k], observed);
            return v ? [v] : [];
          });
          if (valid.length === 1) {
            colors = valid[0];
            tested.bound = true;
            tested.matched++;
          }
        } else if (
          models.every((m, k) => exposureMatches(m.board, states[k], observed))
        )
          tested.matched++;
        else break;
      }
      const layouts = new Set();
      let used = i + 1 + tested.matched;
      while (colors && !tested.won && used < 120) {
        const visible = measure(b.frame);
        if (!visible || layouts.has(visible.layout)) break;
        layouts.add(visible.layout);
        const layout = exposureLayout(visible, colors);
        if (!layout) break;
        const [board, state] = layout,
          choices = motorChoices(visible, mem.directions, b.availableActionIds),
          rules = exposureRules(board);
        const path = await planExposure(
          board,
          state,
          [...choices.keys()].sort((x, y) => x - y),
          120 - used,
        );
        if (!path.length) break;
        const stage = {
          planned: path.length,
          executed: 0,
          confirmedLayout: false,
        };
        tested.stages.push(stage);
        const p = visible.dial.find((d) => d.active).point,
          ink = b.frame[p[1]][p[0]];
        let prior = state;
        for (const a of path) {
          prior = rules.project(prior, a);
          b = replay.act(choices.get(a));
          used++;
          stage.executed++;
          if (replay.win(b)) {
            tested.won = true;
            break;
          }
          const actual = measure(b.frame),
            matches = (scene) => scene && exposureMatches(board, prior, scene);
          if (
            matches(actual) ||
            matches(readTrackedExposure(b.frame, visible, board, ink))
          )
            continue;
          if (
            actual?.layout !== visible.layout &&
            finishedExposure(board, prior) &&
            b.frames?.some(
              (frame) =>
                matches(measure(frame)) ||
                matches(readTrackedExposure(frame, visible, board, ink)),
            )
          )
            stage.confirmedLayout = true;
          break;
        }
        if (!stage.confirmedLayout) break;
      }
      b = replay.restore(i + 1);
    }
    await appendFile(
      output,
      JSON.stringify({
        code: r.code,
        level: r.start,
        view: r.sourceInterface ?? "original",
        tests,
      }) + "\n",
    );
  }
