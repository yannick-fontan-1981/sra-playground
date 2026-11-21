import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { sourceReplay, op, hash } from "./sic-study-source-replay.mjs";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import {
  visualLayout,
  newPreviewLearning,
  observePreviewBindings,
} from "../src/sic/witnessed-preview-transfer.ts";
import { completionContacts } from "../src/sic/terminal-contact.ts";
import {
  observeRelativeMotion,
  readGroup,
} from "../src/sic/relative-motion-learning.ts";
const [env, qualifications, out, ...files] = process.argv.slice(2);
const parse = async (f) =>
  (await readFile(f, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
const eligible = new Set(
  (await Promise.all(qualifications.split(",").map(parse)))
    .flat()
    .filter((r) =>
      r.models.some(
        (m) =>
          m.contact?.first && m.contact.freeWalk && !m.contact.contradicted,
      ),
    )
    .map((r) => r.code),
);
const engine = await sourceBackend(env),
  all = [];
const obs = (b, i) =>
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
    "source-push",
  );
for (const file of files)
  for (const run of await parse(file)) {
    if (!eligible.has(run.code)) continue;
    assert.notEqual(getGameByCode(run.code)?.group, "custom_4");
    const rep = sourceReplay(engine, {}, run),
      witnesses = [],
      history = [],
      learn = newPreviewLearning();
    let b = rep.restore(0),
      o = await obs(b, 0),
      l = visualLayout(o, b.frame);
    for (const [i, c] of run.steps.entries()) {
      const a = rep.act(op(c)),
        n = await obs(a, i + 1),
        v = visualLayout(n, a.frame);
      assert.equal(hash(a).slice(0, 16), c.to);
      if (a.levelsCompleted > b.levelsCompleted || a.state === "WIN") {
        witnesses.push(...completionContacts(learn, o, n, l, op(c)));
        break;
      }
      history.push([o, n, b.frame, l, v, op(c)]);
      observePreviewBindings(learn, o, n, l, v, op(c));
      b = a;
      o = n;
      l = v;
    }
    const memory = { models: {} },
      tested = new Set(),
      counts = { proposed: 0, preparedOnly: 0, refuted: 0, unobservable: 0 };
    for (const [i, t] of history.entries()) {
      for (const m of Object.values(memory.models)) {
        if (
          !m.contact?.first ||
          !m.contact.freeWalk ||
          m.contact.contradicted ||
          m.invalid
        )
          continue;
        const initial = readGroup(m, t[3]);
        if (!initial) continue;
        for (const [walk, d] of Object.entries(m.moves))
          for (const [test, k] of Object.entries(m.moves)) {
            const stand = initial.actor + d,
              target = stand + k;
            if (
              initial.pieces.includes(stand) ||
              initial.pieces.includes(initial.actor + k) ||
              !initial.pieces.includes(target)
            )
              continue;
            const key = [i, m.partner, walk, test].join(":");
            if (tested.has(key)) continue;
            tested.add(key);
            const baseline = rep.restore(i),
              originalHash = hash(baseline),
              control = rep.act(test);
            assert.equal(hash(rep.restore(i)), originalHash);
            const prepared = rep.act(walk),
              pa = readGroup(
                m,
                visualLayout(await obs(prepared, i + 1), prepared.frame),
              );
            if (
              !pa ||
              pa.actor !== stand ||
              String(pa.pieces) !== String(initial.pieces)
            )
              continue;
            const after = rep.act(test),
              read = async (board) =>
                readGroup(
                  m,
                  visualLayout(await obs(board, i + 2), board.frame),
                );
            counts.proposed++;
            if (
              [control, after].some(
                (board) =>
                  board.levelsCompleted > baseline.levelsCompleted ||
                  board.state === "WIN",
              )
            ) {
              counts.unobservable++;
              continue;
            }
            const x = await read(control),
              y = await read(after);
            if (!x || !y) {
              counts.unobservable++;
              continue;
            }
            let end = target;
            while (initial.pieces.includes(end)) end += k;
            const wanted = initial.pieces
              .filter((p) => p !== target)
              .concat(end)
              .sort((a, b) => a - b);
            if (
              x.actor === initial.actor + k &&
              String(x.pieces) === String(initial.pieces) &&
              y.actor === target &&
              String(y.pieces) === String(wanted)
            )
              counts.preparedOnly++;
            else counts.refuted++;
          }
      }
      observeRelativeMotion(memory, witnesses, ...t);
    }
    all.push({ code: run.code, ...counts });
  }
await writeFile(out, JSON.stringify(all));
console.log(JSON.stringify(all));
