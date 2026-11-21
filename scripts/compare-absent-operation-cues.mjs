import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import {
  newPreviewLearning,
  observePreviewBindings,
  visualLayout,
} from "../src/sic/witnessed-preview-transfer.ts";
import { hash } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";
const [mode, environment, output, ...files] = process.argv.slice(2);
assert.ok(["native", "source"].includes(mode));
const engine =
  mode === "source"
    ? await sourceBackend(resolve(environment))
    : (
        await import(
          pathToFileURL(
            resolve(environment, "src/runtime/native-game-dispatcher.ts"),
          ).href
        )
      ).createGameDispatcher(() => {
        throw Error("unexpected");
      });
const observer = (b, i) =>
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
    "comparison",
  );
const changed = (a, b) => a.frame_hash !== b.frame_hash;
const inside = (p, b) =>
  p[0] >= 2 * b[0] && p[0] <= 2 * b[2] && p[1] >= 2 * b[1] && p[1] <= 2 * b[3];
const act = (c) =>
  engine.dispatch({
    type: "action",
    actionId: c.id,
    ...(c.id === 6 ? { data: c.data } : {}),
  });
await writeFile(output, "", { flag: "wx" });
for (const file of files)
  for (const line of (await readFile(file, "utf8")).trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    assert.equal(
      getGameByCode(r.code)?.group === "custom_4",
      mode === "native",
    );
    assert.equal(r.start, 1);
    const tape = r.replayCommands.slice(0, r.levels[0].actions),
      resetAt = new Set(),
      load = () => engine.dispatch({ type: "load", code: r.code, level: 1 });
    async function restore(i) {
      let b = await load();
      for (let j = 0; j < i; j++) {
        if (resetAt.has(j)) b = await engine.dispatch({ type: "reset" });
        b = await act(tape[j]);
      }
      if (resetAt.has(i)) b = await engine.dispatch({ type: "reset" });
      assert.equal(hash(b).slice(0, 16), tape[i].from);
      return b;
    }
    const learned = newPreviewLearning(),
      origins = new Map(),
      steps = new Map();
    let b = await load(),
      o = await observer(b, 0);
    for (const [i, c] of tape.entries()) {
      if (hash(b).slice(0, 16) !== c.from) {
        resetAt.add(i);
        b = await engine.dispatch({ type: "reset" });
        o = await observer(b, i);
      }
      assert.equal(hash(b).slice(0, 16), c.from);
      const n = await act(c),
        a = await observer(n, i + 1);
      assert.equal(hash(n).slice(0, 16), c.to);
      steps.set(o.observation_ref, {
        i,
        before: visualLayout(o, b.frame),
        cmd: c.id,
      });
      if (!origins.has(c.from))
        origins.set(c.from, { i, o, before: visualLayout(o, b.frame) });
      if (n.level === 1 && n.state === b.state)
        observePreviewBindings(
          learned,
          o,
          a,
          visualLayout(o, b.frame),
          visualLayout(a, n.frame),
          "ACTION" + c.id + (c.id === 6 ? ":" + c.data.x + "," + c.data.y : ""),
        );
      b = n;
      o = a;
    }
    const pairs = Object.entries(learned.bindings)
      .filter(
        ([, w]) =>
          /^ACTION[1-57]$/.test(w.gesture.op) &&
          Object.keys(learned.partMotion?.[w.actor]?.axes ?? {}).some(
            (id) => /^ACTION[1-4]$/.test(id) && id !== w.gesture.op,
          ),
      )
      .map(([key, w]) => ({
        key,
        actor: w.actor,
        cue: w.indicator,
        id: Number(w.gesture.op.slice(6)),
        n: w.witnesses.length,
        exposedByPrecedingMove: w.witnesses.filter((sample) => {
          const step = steps.get(sample.before),
            previous = step && tape[step.i - 1];
          const at = previous && origins.get(previous.from);
          return (
            at &&
            previous.id <= 4 &&
            !at.before[w.indicator]?.length &&
            !resetAt.has(step.i)
          );
        }).length,
        visible: 0,
        arrived: 0,
        absent: 0,
        unchanged: 0,
      }));
    for (const { i, o, before } of origins.values()) {
      const eligible = pairs.filter(
        (w) =>
          before[w.actor]?.length === 1 &&
          o.available_action_refs.includes("ACTION" + w.id),
      );
      for (const id of new Set(eligible.map((w) => w.id))) {
        const origin = await restore(i),
          z = await act({ id }),
          a = await observer(z, i + 1),
          after = visualLayout(a, z.frame);
        for (const w of eligible.filter((w) => w.id === id)) {
          const u = before[w.actor][0],
            v = after[w.actor]?.length === 1 ? after[w.actor][0] : null;
          const markers = (before[w.cue] ?? []).filter(
            (m) => !inside(m.at, u.box),
          );
          if (!markers.length) {
            if (before[w.cue]?.length) continue;
            w.absent++;
            w.unchanged += Number(
              !changed(o, a) &&
                z.state === origin.state &&
                z.level === origin.level,
            );
          } else {
            w.visible++;
            w.arrived += Number(
              z.level === origin.level &&
                z.state === origin.state &&
                v &&
                markers.some((m) => inside(m.at, v.box)),
            );
          }
        }
      }
    }
    await appendFile(
      output,
      JSON.stringify({ code: r.code, states: origins.size, relations: pairs }) +
        "\n",
    );
  }
