import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";
// Both arms start at the same public image, and end with the same scalar motor.
// Candidate click points come from the public silhouettes in that image.
const [env, tape, observations, scalar, out, continuationLimit] =
    process.argv.slice(2),
  r = JSON.parse(await readFile(tape, "utf8")),
  graph = JSON.parse(await readFile(observations, "utf8")),
  op = Number(scalar);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(env, "src/runtime/native-game-dispatcher.ts")).href
);
const g = createGameDispatcher(() => {
  throw Error("Unexpected engine");
});
const act = (id, data) =>
  g.dispatch({ type: "action", actionId: id, ...(data ? { data } : {}) });
async function restore(path) {
  let b = await g.dispatch({ type: "load", code: r.code, level: r.start });
  if (b.level !== r.start)
    b = await g.dispatch({ type: "selectLevel", level: r.start });
  for (const id of path) b = await act(id);
  return b;
}
const paths = new Map([[graph.initial, []]]),
  edges = new Map();
for (const e of graph.edges) {
  if (!e.live || !graph.projections[e.to] || e.id < 1 || e.id > 4) continue;
  if (!edges.has(e.from)) edges.set(e.from, []);
  edges.get(e.from).push(e);
}
const queue = [graph.initial];
for (const h of queue)
  for (const e of edges.get(h) ?? [])
    if (!paths.has(e.to)) {
      paths.set(e.to, [...paths.get(h), e.id]);
      queue.push(e.to);
    }
const safe = (b) => b.state === "NOT_FINISHED" || b.state === "WIN";
const result = {
  code: r.code,
  states: paths.size,
  pairedTrials: 0,
  changedImmediately: 0,
  changedScalarReturn: 0,
  safeAfterLosingControl: 0,
  official: 0,
  affectedOrigins: 0,
};
async function continued(point, limit) {
  const search = [[]],
    known = new Set(),
    controlHashes = new Set(),
    selectedHashes = new Set();
  const initialScore = (await restore([])).levelsCompleted;
  const tally = {
    examined: 0,
    differentDirectionalReturns: 0,
    safePreparedScalar: 0,
    safeAndChanged: 0,
    firstSafeAfterMovements: null,
    winningPreparedScalar: 0,
    directionalWin: false,
  };
  async function arm(path, selected) {
    let b = await restore([]);
    if (selected) b = await act(6, point);
    for (const dir of path) {
      if (b.state !== "NOT_FINISHED" || b.level !== r.start) break;
      b = await act(dir);
    }
    return b;
  }
  let cursor = 0;
  for (; cursor < search.length && tally.examined < limit; cursor++) {
    const path = search[cursor],
      positive = await arm(path, true),
      positiveKey = hash(positive);
    const z =
      positive.state === "NOT_FINISHED" &&
      positive.level === r.start &&
      positive.availableActionIds.includes(op)
        ? await act(op)
        : positive;
    const control = await arm(path, false),
      controlKey = hash(control);
    const c =
      control.state === "NOT_FINISHED" &&
      control.level === r.start &&
      control.availableActionIds.includes(op)
        ? await act(op)
        : control;
    const key = positiveKey + "/" + controlKey;
    if (known.has(key)) continue;
    known.add(key);
    controlHashes.add(controlKey);
    selectedHashes.add(positiveKey);
    tally.examined++;
    if (
      positive.level === r.start &&
      positive.state === "NOT_FINISHED" &&
      positive.availableActionIds.includes(op) &&
      control.level === r.start &&
      control.state === "NOT_FINISHED" &&
      control.availableActionIds.includes(op) &&
      safe(z) &&
      !safe(c)
    ) {
      tally.safePreparedScalar++;
      if (hash(z) !== positiveKey) tally.safeAndChanged++;
      tally.firstSafeAfterMovements ??= path.length;
    }
    if (z.levelsCompleted > positive.levelsCompleted || z.state === "WIN")
      tally.winningPreparedScalar++;
    if (positive.levelsCompleted > initialScore || positive.state === "WIN")
      tally.directionalWin = true;
    if (
      positive.state !== "NOT_FINISHED" ||
      control.state !== "NOT_FINISHED" ||
      positive.level !== r.start ||
      control.level !== r.start
    )
      continue;
    for (const dir of positive.availableActionIds.filter(
      (k) => k >= 1 && k <= 4,
    )) {
      await arm(path, true);
      const a = await act(dir);
      await arm(path, false);
      const b = await act(dir);
      if ((hash(a) !== positiveKey) !== (hash(b) !== controlKey))
        tally.differentDirectionalReturns++;
      if (!known.has(hash(a) + "/" + hash(b))) search.push([...path, dir]);
    }
  }
  return {
    ...tally,
    controlImages: controlHashes.size,
    selectedImages: selectedHashes.size,
    queueDrained: cursor === search.length,
  };
}
let firstSelection;
for (const [origin, path] of paths) {
  const b = await restore(path);
  assert.equal(hash(b), origin);
  if (!b.availableActionIds.includes(6) || !b.availableActionIds.includes(op))
    continue;
  const control = await act(op),
    points = new Map();
  for (const group of Object.values(graph.projections[origin]))
    for (const [cx, cy] of group)
      for (const x of new Set([Math.floor(cx / 2), Math.ceil(cx / 2)]))
        for (const y of new Set([Math.floor(cy / 2), Math.ceil(cy / 2)]))
          points.set(x + "," + y, { x, y });
  let affected = false;
  for (const point of points.values()) {
    const before = await restore(path);
    assert.equal(hash(before), origin);
    const after = await act(6, point);
    result.pairedTrials++;
    if (hash(after) !== origin) {
      result.changedImmediately++;
      if (origin === graph.initial) firstSelection ??= point;
    }
    if (
      after.levelsCompleted > before.levelsCompleted ||
      after.state === "WIN"
    ) {
      result.official++;
      continue;
    }
    if (!safe(after) || !after.availableActionIds.includes(op)) continue;
    const z = await act(op);
    if (hash(z) !== hash(control) || z.state !== control.state)
      result.changedScalarReturn++;
    if (!safe(control) && safe(z)) {
      result.safeAfterLosingControl++;
      affected = true;
    }
    if (z.levelsCompleted > before.levelsCompleted || z.state === "WIN")
      result.official++;
  }
  if (affected) result.affectedOrigins++;
}
if (firstSelection && Number(continuationLimit) > 0)
  result.afterInitialSelection = await continued(
    firstSelection,
    Number(continuationLimit),
  );
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
