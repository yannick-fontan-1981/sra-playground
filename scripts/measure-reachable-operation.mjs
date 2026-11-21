import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { hash } from "./sic-study-source-replay.mjs";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import { visualLayout } from "../src/sic/witnessed-preview-transfer.ts";
// Offline intervention only. Restore a public prefix for each arm. Record aggregate depths and outcomes.
const [env, runfile, input, output, maxArg, graphOutput] =
    process.argv.slice(2),
  r = JSON.parse(await readFile(runfile, "utf8")),
  c =
    input === "-"
      ? null
      : /^[57]$/.test(input)
        ? { op: Number(input) }
        : JSON.parse(await readFile(input, "utf8")).cases[0],
  max = Number(maxArg);
assert.ok(
  (!c || [5, 7].includes(c.op)) && max > 0 && Number.isSafeInteger(max),
  "Expected an optional scalar operation and a positive search budget",
);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, "src/runtime/native-game-dispatcher.ts")).href
);
const g = createGameDispatcher(() => {
    throw Error("unexpected");
  }),
  act = (id) => g.dispatch({ type: "action", actionId: id });
async function restore(path) {
  let b = await g.dispatch({ type: "load", code: r.code, level: 2 });
  if (b.level !== 2) b = await g.dispatch({ type: "selectLevel", level: 2 });
  for (const id of path) b = await act(id);
  return b;
}
const projections = new Map(),
  edges = [];
const init = await restore([]),
  queue = [{ path: [], h: hash(init), used: false }],
  seen = new Set([hash(init)]),
  tally = {
    states: 0,
    changed: 0,
    withCue: 0,
    positiveWithCue: 0,
    firstEffectDepth: null,
    winDepth: null,
    winUsedGesture: null,
    nativeActions: 0,
    maxFrontier: max,
  };
const entryIndex = r.levels
  .filter((level) => level.level < 2)
  .reduce((n, level) => n + level.actions, 0);
if (r.replayCommands?.[entryIndex])
  assert.equal(hash(init).slice(0, 16), r.replayCommands[entryIndex].from);
for (let i = 0; i < queue.length && i < max; i++) {
  const s = queue[i],
    b = await restore(s.path);
  tally.nativeActions += s.path.length;
  assert.equal(hash(b), s.h);
  const obs = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: s.h,
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((id) => "ACTION" + id),
    },
    i,
    "public-search",
  );
  const l = visualLayout(obs, b.frame),
    hasCue = !!c?.roles?.length && !!l[c.roles[0][1]]?.length;
  if (graphOutput)
    projections.set(
      s.h,
      Object.fromEntries(
        Object.entries(l).map(([role, parts]) => [
          role,
          parts.map((p) => p.at),
        ]),
      ),
    );
  tally.withCue += +hasCue;
  tally.states++;
  for (const id of [
    ...(c ? [c.op] : []),
    ...b.availableActionIds.filter((id) => id >= 1 && id <= 4),
  ]) {
    if (!b.availableActionIds.includes(id) || id === 6) continue;
    await restore(s.path);
    tally.nativeActions += 1 + s.path.length;
    const z = await act(id);
    const h = hash(z),
      changed = h !== s.h,
      used = s.used || (id === c?.op && changed);
    if (graphOutput)
      edges.push({
        from: s.h,
        id,
        to: h,
        won: z.levelsCompleted > b.levelsCompleted || z.state === "WIN",
        live: z.state === "NOT_FINISHED",
      });
    if (id === c?.op && changed) {
      tally.changed++;
      tally.positiveWithCue += +hasCue;
      tally.firstEffectDepth ??= s.path.length;
    }
    if (z.levelsCompleted > b.levelsCompleted || z.state === "WIN") {
      tally.winDepth = s.path.length + 1;
      tally.winUsedGesture = used;
      break;
    }
    if (z.state !== "NOT_FINISHED" || seen.has(h)) continue;
    seen.add(h);
    queue.push({ path: [...s.path, id], h, used });
  }
  if (tally.winDepth) break;
}
if (graphOutput)
  await writeFile(
    graphOutput,
    JSON.stringify({
      initial: hash(init),
      projections: Object.fromEntries(projections),
      edges,
    }),
  );
await writeFile(
  output,
  JSON.stringify({
    ...tally,
    queued: queue.length,
    exhausted: tally.states === queue.length,
  }),
);
