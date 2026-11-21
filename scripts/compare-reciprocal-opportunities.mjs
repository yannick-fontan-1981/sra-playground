import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { hash } from "./sic-study-source-replay.mjs";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import { visualLayout } from "../src/sic/witnessed-preview-transfer.ts";
const [env, trace, measured] = process.argv.slice(2),
  r = JSON.parse(await readFile(trace, "utf8")),
  caseFile = JSON.parse(await readFile(measured, "utf8"));
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, "src/runtime/native-game-dispatcher.ts")).href
);
assert.equal(r.code, caseFile.code);
assert.ok(
  caseFile.cases.every((c) => [5, 7].includes(c.op)),
  "Matched scalar interventions required",
);
const g = createGameDispatcher(() => {
  throw Error("unexpected");
});
const act = (c) =>
  g.dispatch({
    type: "action",
    actionId: c.id,
    ...(c.id === 6 ? { data: c.data } : {}),
  });
const layout = async (b) =>
  visualLayout(
    await measureNativeObservation(
      {
        frame_rows: b.frame,
        frame_hash: hash(b),
        level: b.level,
        levels_completed: b.levelsCompleted,
        state: b.state,
        available_action_refs: b.availableActionIds.map((id) => "ACTION" + id),
      },
      1,
      "branches",
    ),
    b.frame,
  );
const load = () => g.dispatch({ type: "load", code: r.code, level: r.start });
const resets = new Set();
async function restore(i) {
  let b = await load();
  for (let j = 0; j < i; j++) {
    if (resets.has(j)) b = await g.dispatch({ type: "reset" });
    b = await act(r.replayCommands[j]);
  }
  if (resets.has(i)) b = await g.dispatch({ type: "reset" });
  return b;
}
for (const c of caseFile.cases) {
  for (const pair of c.roles.slice(0, 1)) {
    let b = await load(),
      seen = new Set();
    const count = {};
    const relations = new Map();
    for (const [i, cmd] of r.replayCommands.entries()) {
      if (hash(b).slice(0, 16) !== cmd.from) {
        resets.add(i);
        b = await g.dispatch({ type: "reset" });
      }
      assert.equal(hash(b).slice(0, 16), cmd.from);
      if (
        !seen.has(b.level + "/" + cmd.from) &&
        b.availableActionIds.includes(c.op)
      ) {
        seen.add(b.level + "/" + cmd.from);
        const l = await layout(b),
          locs = pair.map((k) => l[k] ?? []),
          u = locs[0][0],
          v = locs[1][0];
        const n = await act({ id: c.op });
        const al = await layout(n),
          ar = pair.map((k) => al[k] ?? []);
        const gap = (p) => (u && v ? v.at.map((x, j) => x - u.at[j]) : null);
        const changed =
          hash(b) !== hash(n) ||
          b.state !== n.state ||
          b.levelsCompleted !== n.levelsCompleted;
        const k =
          b.level +
          "/" +
          locs.map((g) => g.length).join(",") +
          "/" +
          (changed ? "changed" : "same");
        count[k] = (count[k] ?? 0) + 1;
        if (locs.every((x) => x.length === 1)) {
          const g = gap();
          const key = [b.level, changed, g.join(",")].join("/");
          relations.set(key, (relations.get(key) ?? 0) + 1);
        }
        b = await restore(i);
        assert.equal(hash(b).slice(0, 16), cmd.from);
      }
      b = await act(cmd);
      assert.equal(hash(b).slice(0, 16), cmd.to);
    }
    console.log(
      JSON.stringify({
        counts: count,
        distinctOffsets: relations.size,
        positiveOffsets: [...relations]
          .filter(([k]) => k.includes("/true/"))
          .slice(0, 16),
        frequentNegativeOffsets: [...relations]
          .filter(([k]) => k.includes("/false/"))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8),
      }),
    );
  }
}
