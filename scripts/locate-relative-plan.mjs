import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { hash } from "./sic-study-source-replay.mjs";
const [root, env, trace, dest] = process.argv.slice(2),
  r = JSON.parse(await readFile(trace, "utf8")),
  load = (p, f) => import(pathToFileURL(resolve(p, f)).href);
const { createGameDispatcher } = await load(
    env,
    "src/runtime/native-game-dispatcher.ts",
  ),
  { measureNativeObservation } = await load(
    root,
    "src/logos-engine/v6-native-observer.ts",
  ),
  { newPreviewLearning, visualLayout, observePreviewBindings } = await load(
    root,
    "src/sic/witnessed-preview-transfer.ts",
  ),
  { completionContacts } = await load(root, "src/sic/terminal-contact.ts"),
  { observeRelativeMotion, fitReach } = await load(
    root,
    "src/sic/relative-motion-learning.ts",
  ),
  { chooseRelativePlan } = await load(root, "src/sic/relative-motion-plan.ts");
const g = createGameDispatcher(() => {
  throw Error("unexpected");
});
const obs = (b, n) =>
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
    "coupon",
  );
let b = await g.dispatch({ type: "load", code: r.code, level: 1 }),
  o = await obs(b, 0),
  l = visualLayout(o, b.frame),
  contacts = [],
  memory = { models: {} },
  history = [];
const learn = newPreviewLearning();
let proposals = 0,
  first = null;
for (const [i, cmd] of r.replayCommands.entries()) {
  if (hash(b).slice(0, 16) !== cmd.from) {
    b = await g.dispatch({ type: "reset" });
    o = await obs(b, i);
    l = visualLayout(o, b.frame);
    memory = { models: {} };
  }
  assert.equal(hash(b).slice(0, 16), cmd.from);
  const z = await g.dispatch({
      type: "action",
      actionId: cmd.id,
      ...(cmd.id === 6 ? { data: cmd.data } : {}),
    }),
    a = await obs(z, i + 1),
    after = visualLayout(a, z.frame);
  assert.equal(hash(z).slice(0, 16), cmd.to);
  const op =
    "ACTION" +
    cmd.id +
    (cmd.id === 6 ? ":" + cmd.data.x + "," + cmd.data.y : "");
  if (b.level === 1) {
    if (z.levelsCompleted > b.levelsCompleted)
      contacts = completionContacts(learn, o, a, l, op);
    else observePreviewBindings(learn, o, a, l, after, op);
  } else if (b.level === 2) {
    const choice = chooseRelativePlan(
      memory,
      l,
      o,
      b.frame,
      Object.fromEntries(contacts.map((c) => [c.marker, c.after])),
      { maxNodes: 1000, maxDepth: 88 },
    );
    if (choice) {
      proposals++;
      first ??= i + 1;
    }
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
    if (i % 10 === 0) {
      const models = Object.values(memory.models).filter(
        (m) => m.contrasts && m.positive >= 2 && !m.invalid,
      );
      history.push({
        i,
        models: models.map((m) => [
          m.partner.substring(0, 8),
          m.positive,
          m.contrasts,
          Object.keys(m.moves).length,
          fitReach(m).metric,
          fitReach(m).radius,
        ]),
        offer: choice?.remaining ?? null,
      });
    }
  }
  b = z;
  o = a;
  l = after;
}
const result = {
  code: r.code,
  contacts: contacts.length,
  proposals,
  first,
  history,
  models: Object.values(memory.models).map((m) => [
    m.partner,
    m.positive,
    m.contrasts,
    m.invalid,
    Object.keys(m.moves).length,
  ]),
};
if (dest) await writeFile(dest, JSON.stringify(result));
console.log(
  JSON.stringify({
    code: r.code,
    contacts: contacts.length,
    proposals,
    first,
    sample: history.slice(0, 8),
  }),
);
