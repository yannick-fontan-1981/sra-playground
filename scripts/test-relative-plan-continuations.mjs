import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";
const [solver, environment, trace, out, starts, capArg] = process.argv.slice(2),
  run = JSON.parse(await readFile(trace, "utf8")),
  load = (r, f) => import(pathToFileURL(resolve(r, f)).href);
const { createGameDispatcher } = await load(
    environment,
    "src/runtime/native-game-dispatcher.ts",
  ),
  { measureNativeObservation } = await load(
    solver,
    "src/logos-engine/v6-native-observer.ts",
  ),
  { completionContacts } = await load(solver, "src/sic/terminal-contact.ts"),
  { newPreviewLearning, observePreviewBindings, visualLayout } = await load(
    solver,
    "src/sic/witnessed-preview-transfer.ts",
  ),
  { observeRelativeMotion, fitReach, readGroup, equalPose } = await load(
    solver,
    "src/sic/relative-motion-learning.ts",
  ),
  { chooseRelativePlan } = await load(
    solver,
    "src/sic/relative-motion-plan.ts",
  );
const { continueRelativePlan } = await load(
  solver,
  "src/sic/relative-motion-plan.ts",
);
const obs = (b, t) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((k) => "ACTION" + k),
    },
    t,
    "branch",
  );
const cap = Number(capArg),
  result = [];
assert.equal(run.start, 1);
for (const skip of starts.split(",").map(Number)) {
  const g = createGameDispatcher(() => {
      throw Error("unexpected");
    }),
    act = (c) =>
      g.dispatch({
        type: "action",
        actionId: c.id,
        ...(c.id === 6 ? { data: c.data } : {}),
      });
  let memory = { models: {} },
    learn = newPreviewLearning(),
    contacts = [],
    b = await g.dispatch({ type: "load", code: run.code, level: 1 }),
    o = await obs(b, 0),
    l = visualLayout(o, b.frame),
    prefix = run.levels[0].actions + skip;
  if (prefix >= run.issued) continue;
  for (let i = 0; i < prefix; i++) {
    const c = run.replayCommands[i];
    if (hash(b).slice(0, 16) !== c.from) {
      b = await g.dispatch({ type: "reset" });
      o = await obs(b, i);
      l = visualLayout(o, b.frame);
      memory = { models: {} };
    }
    assert.equal(hash(b).slice(0, 16), c.from);
    const n = await act(c),
      a = await obs(n, i + 1),
      after = visualLayout(a, n.frame),
      op =
        "ACTION" + c.id + (c.id === 6 ? ":" + c.data.x + "," + c.data.y : "");
    assert.equal(hash(n).slice(0, 16), c.to);
    if (b.level === 1 && n.levelsCompleted > b.levelsCompleted)
      contacts = completionContacts(learn, o, a, l, op);
    if (b.level === 2)
      observeRelativeMotion(
        memory,
        contacts,
        o,
        a,
        b.frame,
        l,
        after,
        op,
        learn.partMotion,
      );
    if (b.level === n.level) observePreviewBindings(learn, o, a, l, after, op);
    b = n;
    o = a;
    l = after;
  }
  const origins = hash(b),
    records = [];
  let won = false,
    repeat = false;
  const signs = new Set();
  for (let j = 0; j < cap; j++) {
    const plan = chooseRelativePlan(
      memory,
      l,
      o,
      b.frame,
      Object.fromEntries(contacts.map((w) => [w.marker, w.after])),
      { maxDepth: 88, maxNodes: 1000 },
    );
    if (!plan) break;
    const key = JSON.stringify([
      hash(b),
      plan.op,
      plan.law.metric,
      plan.law.radius,
      plan.purpose,
      plan.goal,
      plan.remaining,
    ]);
    if (signs.has(key)) {
      repeat = true;
      break;
    }
    signs.add(key);
    const n = await act({ id: Number(plan.op.slice(6)) }),
      a = await obs(n, prefix + j + 1),
      after = visualLayout(a, n.frame);
    won = n.levelsCompleted > b.levelsCompleted || n.state === "WIN";
    const model = memory.models[plan.model],
      pose = readGroup(model, after),
      match = !!pose && equalPose(pose, plan.next);
    records.push({
      op: plan.op,
      model: plan.model,
      law: plan.law,
      goal: plan.goal,
      purpose: plan.purpose,
      remaining: plan.remaining,
      match,
      won,
      desired: plan.desired ?? null,
      rigid: plan.objective.rigidRoute,
      open: Object.values(model.playerTerrain).filter((v) => v.open).length,
      blocked: Object.values(model.playerTerrain).filter((v) => !v.open).length,
    });
    continueRelativePlan?.(memory, plan, a, match, won);
    if (won || n.state !== "NOT_FINISHED") break;
    observeRelativeMotion(
      memory,
      contacts,
      o,
      a,
      b.frame,
      l,
      after,
      plan.op,
      learn.partMotion,
    );
    observePreviewBindings(learn, o, a, l, after, plan.op);
    b = n;
    o = a;
    l = after;
  }
  result.push({ skip, origins, won, repeat, records });
  console.log(
    JSON.stringify([
      skip,
      won,
      repeat,
      records.length,
      records.filter((r) => r.match).length,
      records[0]?.remaining,
      records.at(-1)?.remaining,
      records.at(-1)?.law.metric,
    ]),
  );
}
await writeFile(out, JSON.stringify(result));
