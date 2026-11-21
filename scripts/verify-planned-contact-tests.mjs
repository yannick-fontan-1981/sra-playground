import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { hash } from "./sic-study-source-replay.mjs";

const [solver, environment, file, out] = process.argv.slice(2),
  run = JSON.parse(await readFile(file, "utf8"));
const load = (r, p) => import(pathToFileURL(resolve(r, p)).href);
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
const { readGroup, destinations, equalPose } = await load(
  solver,
  "src/sic/relative-motion-learning.ts",
);
const frame = (b) => hash(b).slice(0, 16);
const send = (g, c) =>
  g.dispatch({
    type: "action",
    actionId: c.id,
    ...(c.id === 6 ? { data: c.data } : {}),
  });
const id = (op) => Number(op.replace(/^ACTION/, ""));
async function restore(n) {
  const g = createGameDispatcher(() => {
    throw Error("Unexpected engine");
  });
  let b = await g.dispatch({ type: "load", code: run.code, level: run.start });
  if (b.level !== run.start)
    b = await g.dispatch({ type: "selectLevel", level: run.start });
  for (const c of run.replayCommands.slice(0, n)) {
    if (frame(b) !== c.from) b = await g.dispatch({ type: "reset" });
    assert.equal(frame(b), c.from);
    b = await send(g, c);
    assert.equal(frame(b), c.to);
  }
  return { g, b };
}
async function layout(b) {
  const o = await measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((i) => "ACTION" + i),
    },
    0,
    "after-run",
  );
  return visualLayout(o, b.frame);
}
const decisions = run.preparation.filter(
    (t) => t.relativePlacement?.plan.capacity,
  ),
  pairs = [];
for (const t of decisions.filter(
  (r) => r.relativePlacement.plan.checkingContact,
)) {
  const { plan, matched, won } = t.relativePlacement,
    test = plan.capacity,
    length = test.selectedPreparation.length;
  const origin = t.actionIndex - length - 1,
    chosen = await restore(origin),
    alternative = await restore(origin);
  assert.equal(frame(chosen.b), frame(alternative.b));
  const start = frame(chosen.b);
  for (const [i, op] of test.selectedPreparation.entries()) {
    assert.equal(id(op), run.replayCommands[origin + i].id);
    chosen.b = await send(chosen.g, { id: id(op) });
  }
  assert.equal(frame(chosen.b), run.replayCommands[t.actionIndex - 1].from);
  for (const op of test.comparisonPreparation)
    alternative.b = await send(alternative.g, { id: id(op) });
  const scene = await layout(chosen.b),
    pitch = Number(plan.model.split("/").at(-1)),
    m = {
      actor: plan.actor,
      partner: plan.partner,
      pitch,
      width: Math.ceil((2 * chosen.b.frame[0].length) / pitch) + 2,
      origin: scene[plan.partner][0].at.map(
        (v) => ((v % pitch) + pitch) % pitch,
      ),
    };
  const x = readGroup(m, scene),
    y = readGroup(m, await layout(alternative.b));
  assert.ok(x && equalPose(x, plan.from));
  const samePieces = !!y && String(x.pieces) === String(y.pieces);
  const motor = { id: id(test.commonCommand) };
  assert.equal(motor.id, run.replayCommands[t.actionIndex - 1].id);
  const p = await send(chosen.g, motor),
    q = await send(alternative.g, motor);
  assert.equal(frame(p), run.replayCommands[t.actionIndex - 1].to);
  const d = plan.next.actor - plan.from.actor;
  async function shifted(before, after) {
    const actual = readGroup(m, await layout(after));
    if (!before || !actual || actual.actor - before.actor !== d) return null;
    const changes = destinations(before.pieces, actual.pieces, d);
    return changes ? [...changes].filter(([a, b]) => a !== b).length : null;
  }
  const observed = [await shifted(x, p), await shifted(y, q)],
    predicted = [test.expectedPiecesMoved, test.comparisonPiecesMoved];
  let access;
  if (
    !won &&
    (pairs.length === 0 ||
      (test.expectedPiecesMoved > test.previouslyObservedLength &&
        !pairs.some((v) => v.predicted[0] === test.expectedPiecesMoved)))
  ) {
    async function walkable(board, preparation) {
      const fixed = readGroup(m, await layout(board)).pieces;
      const queue = [{ path: [], key: frame(board) }],
        seen = new Set([frame(board)]),
        sites = new Set();
      const maxImages = 256;
      for (let i = 0; i < queue.length && i < maxImages; i++) {
        const entry = queue[i];
        for (const op of board.availableActionIds.filter(
          (v) => v >= 1 && v <= 4,
        )) {
          const arm = await restore(origin);
          for (const step of [...preparation.map(id), motor.id, ...entry.path])
            arm.b = await send(arm.g, { id: step });
          assert.equal(frame(arm.b), entry.key);
          const next = await send(arm.g, { id: op });
          if (next.level !== board.level || next.state !== "NOT_FINISHED")
            continue;
          const pose = readGroup(m, await layout(next));
          if (!pose || String(pose.pieces) !== String(fixed)) continue;
          sites.add(pose.actor);
          const key = frame(next);
          if (!seen.has(key)) {
            seen.add(key);
            queue.push({ path: [...entry.path, op], key });
          }
        }
      }
      sites.add(readGroup(m, await layout(board)).actor);
      return {
        sites,
        images: queue.length,
        exhausted: queue.length <= maxImages,
      };
    }
    const positive = await walkable(p, test.selectedPreparation),
      control = await walkable(q, test.comparisonPreparation);
    access = {
      predictedGained: test.gainedSites,
      measuredGained: [...positive.sites].filter(
        (site) => !control.sites.has(site),
      ).length,
      positiveSites: positive.sites.size,
      controlSites: control.sites.size,
      exhausted: positive.exhausted && control.exhausted,
      exploredImages: [positive.images, control.images],
    };
  }
  pairs.push({
    action: t.actionIndex,
    origin: start,
    matchingStances:
      !!y && y.actor === test.comparisonAt && x.actor === test.preparedAt,
    samePieces,
    predicted,
    observed,
    ...(access ? { access } : {}),
    bothConfirmed:
      samePieces &&
      !!y &&
      y.actor === test.comparisonAt &&
      String(observed) === String(predicted),
    matched,
    won,
    usedEarlierTest: !!test.verifiedUse,
    distinctOptions:
      String(test.selectedPreparation) !== String(test.comparisonPreparation),
  });
}
const result = {
  code: run.code,
  firstDecision: decisions[0]?.actionIndex ?? null,
  proposalsPlayed: decisions.length,
  pairs,
  verifiedReuses: pairs.filter((v) => v.usedEarlierTest && v.matched).length,
  score: run.levels.map(({ level, actions, won }) => ({ level, actions, won })),
};
await writeFile(out, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    code: run.code,
    proposals: decisions.length,
    tests: pairs.length,
    confirmed: pairs.filter((v) => v.bothConfirmed).length,
    reuses: result.verifiedReuses,
    score: result.score,
  }),
);
