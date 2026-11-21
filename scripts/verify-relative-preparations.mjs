import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";

// After the autonomous run, change only a short preparation. Require the bard
// to finish the alternative at the same cell before playing the original suffix.
const [solver, environment, tape, graphPath, output] = process.argv.slice(2);
const load = (root, file) => import(pathToFileURL(resolve(root, file)).href);
const { createGameDispatcher } = await load(
  environment,
  "src/runtime/native-game-dispatcher.ts",
);
const { measureNativeObservation } = await load(
  solver,
  "src/logos-engine/v6-native-observer.ts",
);
const { visualLayout } = await load(
  solver,
  "src/sic/witnessed-preview-transfer.ts",
);
const { readGroup, destinations, vector, rangeOf } = await load(
  solver,
  "src/sic/relative-motion-learning.ts",
);
const run = JSON.parse(await readFile(tape, "utf8"));
const trials = run.preparation.filter((t) => t.relativePlacement);
const witness = run.preparation.find((t) => t.terminalContact)?.terminalContact
  .trial.witness;
assert.ok(trials.length && witness && run.levels.at(-1).won);
const first = trials[0],
  targetLevel = first.level;
const commands = run.replayCommands;
const key = (b) => hash(b).slice(0, 16);
const send = (g, c) =>
  g.dispatch({
    type: "action",
    actionId: c.id,
    ...(c.id === 6 ? { data: c.data } : {}),
  });
const loadGame = () =>
  createGameDispatcher(() => {
    throw Error("Unexpected engine");
  });
async function restore(count) {
  const g = loadGame();
  let b = await g.dispatch({ type: "load", code: run.code, level: run.start });
  for (const c of commands.slice(0, count)) {
    if (key(b) !== c.from) b = await g.dispatch({ type: "reset" });
    assert.equal(key(b), c.from);
    b = await send(g, c);
    assert.equal(key(b), c.to);
  }
  return { g, b };
}
async function layout(b) {
  const obs = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((id) => "ACTION" + id),
    },
    0,
    "post-run-pair",
  );
  return visualLayout(obs, b.frame);
}
const { b: start } = await restore(first.actionIndex - 1);
const firstPlan = first.relativePlacement.plan;
const pitch = witness.pitch[0];
assert.equal(pitch, witness.pitch[1]);
const partner = firstPlan.partner,
  firstParts = (await layout(start))[partner];
const m = {
  actor: firstPlan.actor,
  partner,
  pitch,
  origin: firstParts[0].at.map((n) => ((n % pitch) + pitch) % pitch),
  width: Math.ceil((2 * start.frame[0].length) / pitch) + 2,
};
assert.deepEqual(readGroup(m, await layout(start)), firstPlan.from);
const completed = (b) =>
  b.levelsCompleted > start.levelsCompleted || b.state === "WIN";
// Independently identify terrain using other native attempts to enter an
// unoccupied site. Exclude every site seen occupied by the subject or a piece.
const graph = JSON.parse(await readFile(graphPath, "utf8"));
const poses = new Map(
  Object.entries(graph.projections).map(([id, projection]) => {
    const parts = Object.fromEntries(
      [m.actor, m.partner].map((role) => [
        role,
        projection[role].map((at) => ({ at })),
      ]),
    );
    return [id, readGroup(m, parts)];
  }),
);
const direction = new Map();
for (const t of trials) {
  const { plan, actual, matched } = t.relativePlacement;
  if (!matched || actual.actor === plan.from.actor) continue;
  const op = commands[t.actionIndex - 1].id,
    d = actual.actor - plan.from.actor;
  if (direction.has(op)) assert.equal(direction.get(op), d);
  direction.set(op, d);
}
const ground = new Set(),
  bareFailures = new Map(),
  held = [];
for (const pose of poses.values())
  if (pose) for (const cell of [pose.actor, ...pose.pieces]) ground.add(cell);
for (const e of graph.edges) {
  const s = poses.get(e.from),
    q = poses.get(e.to),
    d = direction.get(e.id);
  if (!s || !q || !d || s.actor !== q.actor) continue;
  const site = s.actor + d;
  if (!s.pieces.includes(site) && !ground.has(site))
    bareFailures.set(site, e.from.slice(0, 16));
}
for (const t of trials) {
  const { plan: p, matched, actual } = t.relativePlacement;
  if (!matched) continue;
  assert.deepEqual(p.next, actual);
  for (const s of [p.from, p.next])
    for (const cell of [s.actor, ...s.pieces]) ground.add(cell);
}
for (const t of trials) {
  const { plan: p, matched } = t.relativePlacement;
  if (!matched) continue;
  const step = p.next.actor - p.from.actor;
  if (!step) continue;
  const pairs = destinations(p.from.pieces, p.next.pieces, step);
  assert.ok(pairs);
  for (const [a, b] of pairs) {
    if (
      a !== b ||
      (p.law.metric !== "global" &&
        rangeOf(m, p.from.actor, a, p.law.metric) > p.law.radius)
    )
      continue;
    held.push({
      index: t.actionIndex,
      occupied: p.next.pieces.includes(a + step),
      bareFailure: bareFailures.get(a + step),
      before: vector(m, p.from.actor, a),
      after: vector(m, p.next.actor, b),
    });
  }
}
const priorCount = run.levels
  .filter((l) => l.level < targetLevel)
  .reduce((n, l) => n + l.actions, 0);
const byIndex = new Map(trials.map((t) => [t.actionIndex, t]));
async function finish(g, b, index) {
  for (const c of commands.slice(index)) {
    if (completed(b) || b.state === "GAME_OVER") break;
    b = await send(g, c);
  }
  return completed(b);
}
function* words(ids, n, prefix = []) {
  if (!n) {
    yield prefix;
    return;
  }
  for (const id of ids) yield* words(ids, n - 1, [...prefix, id]);
}
let pair = null,
  comparisons = 0,
  sameActor = 0;
for (const event of held.filter((e) => !e.occupied && e.bareFailure)) {
  for (const length of [2, 3]) {
    const end = event.index,
      begin = end - length;
    if (!byIndex.has(begin + 1)) continue;
    const control = await restore(begin),
      positive = await restore(end);
    const expected = byIndex.get(end).relativePlacement.plan.next;
    assert.deepEqual(readGroup(m, await layout(positive.b)), expected);
    const positiveScore = await finish(positive.g, positive.b, end);
    assert.equal(positiveScore, true);
    const ids = control.b.availableActionIds.filter((id) => id >= 1 && id <= 4);
    const actualWord = commands.slice(begin, end).map((c) => c.id);
    for (const word of words(ids, length)) {
      if (String(word) === String(actualWord)) continue;
      const alternative = await restore(begin);
      assert.equal(key(alternative.b), key(control.b));
      let b = alternative.b;
      for (const id of word) {
        if (completed(b)) break;
        b = await send(alternative.g, { id });
      }
      if (b.level !== targetLevel || completed(b)) continue;
      comparisons++;
      const other = readGroup(m, await layout(b));
      if (
        !other ||
        expected.actor !== other.actor ||
        String(expected.pieces) === String(other.pieces)
      )
        continue;
      sameActor++;
      const alternateEnd = key(b);
      let firstActorDifference = null,
        alternateScore = false,
        previousAlternative = other;
      for (const [index, c] of commands.slice(end).entries()) {
        if (completed(b) || b.state === "GAME_OVER") break;
        b = await send(alternative.g, c);
        alternateScore = completed(b);
        if (alternateScore) break;
        const baseline = byIndex.get(end + index + 1)?.relativePlacement;
        const otherPose = readGroup(m, await layout(b));
        if (
          !firstActorDifference &&
          baseline?.matched &&
          otherPose &&
          previousAlternative &&
          baseline.actual.actor !== otherPose.actor
        ) {
          const destination = baseline.actual.actor;
          firstActorDifference = {
            horizon: index + 1,
            sameStartActor:
              baseline.plan.from.actor === previousAlternative.actor,
            destinationOccupiedBefore: {
              positive: baseline.plan.from.pieces.includes(destination),
              alternative: previousAlternative.pieces.includes(destination),
            },
            plannedDisplacement: vector(
              m,
              baseline.plan.from.actor,
              baseline.actual.actor,
            ),
            alternateDisplacement: vector(
              m,
              previousAlternative.actor,
              otherPose.actor,
            ),
          };
        }
        previousAlternative = otherPose;
      }
      if (alternateScore) continue;
      pair = {
        origin: key(control.b),
        stepL2: end - priorCount,
        length,
        positiveEnd: key(positive.b),
        alternateEnd,
        firstActorDifference,
        sameActor: true,
        positiveVectors: expected.pieces.map((p) =>
          vector(m, expected.actor, p),
        ),
        alternateVectors: other.pieces.map((p) => vector(m, other.actor, p)),
        heldVectorBefore: event.before,
        heldVectorAfter: event.after,
        independentWallWitness: event.bareFailure,
        commonSuffixLength: commands.length - end,
        positiveScore,
        alternateScore: false,
      };
      break;
    }
    if (pair) break;
  }
  if (pair) break;
}
const result = {
  code: run.code,
  level: targetLevel,
  firstPlannedStep: first.actionIndex - priorCount,
  projectedSteps: firstPlan.remaining,
  matchedBeforeScore: trials.filter((t) => t.relativePlacement.matched).length,
  committed: trials.filter((t) => t.relativePlacement.plan.continuedAfter)
    .length,
  score: trials.some((t) => t.relativePlacement.won),
  heldInRange: held.length,
  distinctStepsWithTerrainArrest: new Set(
    held.filter((e) => !e.occupied && e.bareFailure).map((e) => e.index),
  ).size,
  comparisons,
  sameActor,
  pair,
};
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
