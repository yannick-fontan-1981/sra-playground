import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { sourceReplay, op, hash } from "./sic-study-source-replay.mjs";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import {
  newPreviewLearning,
  observePreviewBindings,
  visualLayout,
} from "../src/sic/witnessed-preview-transfer.ts";
import { completionContacts } from "../src/sic/terminal-contact.ts";
import {
  observeRelativeMotion,
  fitReach,
} from "../src/sic/relative-motion-learning.ts";

const [env, file, ...runs] = process.argv.slice(2),
  engine = await sourceBackend(resolve(env));
const observe = (b, i) =>
  measureNativeObservation(
    {
      frame_rows: b.frame,
      frame_hash: hash(b),
      level: b.level,
      levels_completed: b.levelsCompleted,
      state: b.state,
      available_action_refs: b.availableActionIds.map((id) => "ACTION" + id),
    },
    i,
    "source-only",
  );
await writeFile(file, "", { flag: "wx" });
for (const path of runs)
  for (const line of (await readFile(path, "utf8")).trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    assert.notEqual(getGameByCode(r.code)?.group, "custom_4");
    if (r.resets || !r.levels[0].won) continue;
    const replay = sourceReplay(engine, {}, r),
      learn = newPreviewLearning(),
      transitions = [];
    let b = replay.restore(0),
      o = await observe(b, 0),
      l = visualLayout(o, b.frame),
      contacts = [];
    for (const [i, c] of r.steps.entries()) {
      const n = replay.act(op(c)),
        a = await observe(n, i + 1),
        next = visualLayout(a, n.frame);
      assert.equal(hash(n).slice(0, 16), c.to);
      if (a.levels_completed > o.levels_completed || a.state === "WIN") {
        contacts = completionContacts(learn, o, a, l, op(c));
        break;
      }
      transitions.push([o, a, b.frame, l, next, op(c)]);
      observePreviewBindings(learn, o, a, l, next, op(c));
      b = n;
      o = a;
      l = next;
    }
    const mem = { models: {} };
    for (const t of transitions) observeRelativeMotion(mem, contacts, ...t);
    const models = Object.values(mem.models)
      .filter(
        (m) =>
          m.positive >= 2 &&
          m.contrasts > 0 &&
          !m.invalid &&
          Object.keys(m.moves).length >= 2,
      )
      .map((m) => ({
        positive: m.positive,
        contrast: m.contrasts,
        blocked: m.blocked,
        roles: [m.actor, m.partner],
        controls: Object.keys(m.moves).length,
        law: fitReach(m),
        ...(m.contact ? { contact: m.contact } : {}),
      }));
    await appendFile(
      file,
      JSON.stringify({
        code: r.code,
        level: r.start,
        contacts: contacts.length,
        models,
      }) + "\n",
    );
  }
