import assert from "node:assert/strict";
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { getGameByCode } from "../src/games/catalog.ts";
import { hash, op, sourceReplay } from "./sic-study-source-replay.mjs";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import {
  newPreviewLearning,
  visualLayout,
  observePreviewBindings,
} from "../src/sic/witnessed-preview-transfer.ts";
import { observedSituatedOperations } from "../src/sic/situated-preparation.ts";
import { add, same } from "../src/sic/access-terrain.ts";
const [environment, matched, output, ...files] = process.argv.slice(2);
const read = async (f) =>
  (await readFile(f, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
const observed = async (b, n) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((id) => "ACTION" + id),
    },
    n,
    "source-projection",
  );
const engine = await sourceBackend(resolve(environment)),
  cases = new Map((await read(matched)).map((x) => [x.code, x]));
await writeFile(output, "", { flag: "wx" });
for (const file of files)
  for (const r of await read(file)) {
    const selected = cases.get(r.code)?.reports;
    if (!selected?.length) continue;
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== "custom_4",
    );
    const replay = sourceReplay(engine, {}, r),
      learn = newPreviewLearning(),
      results = [];
    let b = replay.restore(0),
      o = await observed(b, 1),
      layout = visualLayout(o, b.frame);
    for (const [i, c] of r.steps.entries()) {
      const next = replay.act(op(c));
      assert.equal(hash(next).slice(0, 16), c.to);
      const a = await observed(next, i + 2),
        after = visualLayout(a, next.frame);
      const test = selected.find((t) => t.action === i + 1);
      if (test) {
        const witnesses = observedSituatedOperations(
          learn,
          o,
          a,
          layout,
          after,
          op(c),
        );
        for (const v of test.tests.filter((v) => v.comparable)) {
          replay.restore(i);
          const away = replay.act(v.forward),
            ao = await observed(away, i + 2),
            al = visualLayout(ao, away.frame);
          const changed = replay.act(op(c)),
            co = await observed(changed, i + 3),
            cl = visualLayout(co, changed.frame);
          const variants = witnesses.map((w) => {
            const pos = learn.lastActor[w.actor],
              site = add(pos, w.offset),
              has = (l, r, p) => l[r]?.some((x) => same(x.at, p)) ?? false;
            const independent =
              !has(al, w.actor, pos) && has(al, w.marker, site);
            return {
              offset: w.offset,
              stride: w.stride,
              independent,
              distinguishes: independent && has(cl, w.marker, site),
              actor: w.actor,
              marker: w.marker,
              support: w.support,
            };
          });
          results.push({
            action: i + 1,
            forward: v.forward,
            inverse: v.inverse,
            original: v.atOrigin.won && v.afterReturn.won,
            other: v.atOther.won,
            variants,
          });
        }
        replay.restore(i + 1);
      }
      observePreviewBindings(learn, o, a, layout, after, op(c));
      b = next;
      o = a;
      layout = after;
    }
    await appendFile(output, JSON.stringify({ code: r.code, results }) + "\n");
  }
