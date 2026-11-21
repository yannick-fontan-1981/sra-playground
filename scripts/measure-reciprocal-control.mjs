import assert from "node:assert/strict";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureNativeObservation } from "../src/logos-engine/v6-native-observer.ts";
import { visualLayout } from "../src/sic/witnessed-preview-transfer.ts";

const [mode, env, out, ...files] = process.argv.slice(2);
assert.ok(["native", "source"].includes(mode));
const engine =
  mode === "source"
    ? await sourceBackend(resolve(env))
    : (
        await import(
          pathToFileURL(resolve(env, "src/runtime/native-game-dispatcher.ts"))
            .href
        )
      ).createGameDispatcher(() => {
        throw Error("Unexpected backend");
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
      "matched-branches",
    ),
    b.frame,
  );
const same = (p, q) => p && q && p.every((v, i) => v === q[i]);
const unique = (v, k) => (v[k]?.length === 1 ? v[k][0] : undefined);
const delta = (a, b) =>
  a && b ? [b.at[0] - a.at[0], b.at[1] - a.at[1]] : null;
const overlaps = (a, b) =>
  a.box[0] <= b.box[2] &&
  a.box[2] >= b.box[0] &&
  a.box[1] <= b.box[3] &&
  a.box[3] >= b.box[1];
function swaps(before, after) {
  const moved = Object.keys(before).flatMap((role) => {
    const u = unique(before, role),
      v = unique(after, role);
    return u && v && !overlaps(u, v) ? [{ role, u, v, d: delta(u, v) }] : [];
  });
  return moved.flatMap((a, i) =>
    moved
      .slice(i + 1)
      .filter(
        (b) =>
          overlaps(a.u, b.v) &&
          overlaps(b.u, a.v) &&
          same(
            a.d,
            b.d.map((x) => -x),
          ),
      )
      .map((b) => [a, b]),
  );
}
await writeFile(out, "", { flag: "wx" });
for (const file of files)
  for (const line of (await readFile(file, "utf8")).trim().split(/\r?\n/)) {
    const r = JSON.parse(line);
    assert.equal(
      getGameByCode(r.code)?.group === "custom_4",
      mode === "native",
    );
    assert.equal(r.start, 1);
    const tape = r.replayCommands.slice(0, r.levels[0].actions),
      resetAt = new Set();
    const act = (c) =>
      engine.dispatch({
        type: "action",
        actionId: c.id,
        ...(c.id === 6 ? { data: c.data } : {}),
      });
    const load = () =>
      engine.dispatch({ type: "load", code: r.code, level: 1 });
    let b = await load();
    assert.equal(hash(b), r.initial);
    const live = (v) => v.level === 1 && v.state === "NOT_FINISHED";
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
    const cases = [];
    let examined = 0;
    for (const [i, c] of tape.entries()) {
      if (hash(b).slice(0, 16) !== c.from) {
        resetAt.add(i);
        b = await engine.dispatch({ type: "reset" });
      }
      assert.equal(hash(b).slice(0, 16), c.from);
      const n = await act(c);
      assert.equal(hash(n).slice(0, 16), c.to);
      if (c.id >= 5 && live(n) && c.from !== c.to) {
        examined++;
        const before = await layout(b),
          after = await layout(n),
          pairs = swaps(before, after);
        if (pairs.length) {
          const branches = [];
          // A point selection can be undone by addressing the previous holder.
          // Keep the pixel offset of the original action within the clicked role.
          const reversals = new Map([["same action", c]]);
          if (c.id === 6)
            for (const pair of pairs)
              for (const { u, v } of pair) {
                const { x, y } = c.data;
                if (
                  x < u.box[0] ||
                  x > u.box[2] ||
                  y < u.box[1] ||
                  y > u.box[3]
                )
                  continue;
                const data = {
                  x: x + v.box[0] - u.box[0],
                  y: y + v.box[1] - u.box[1],
                };
                reversals.set("other site " + data.x + "," + data.y, {
                  id: 6,
                  data,
                });
              }
          const preparations = [
            [],
            [c],
            ...[...reversals.values()].map((back) => [c, back]),
          ];
          for (const id of b.availableActionIds.filter(
            (id) => id >= 1 && id <= 4,
          )) {
            const arms = [];
            for (const preparation of preparations) {
              let x = await restore(i);
              for (const action of preparation)
                if (live(x)) x = await act(action);
              if (!live(x) || !x.availableActionIds.includes(id)) {
                arms.push(null);
                continue;
              }
              const root = await layout(x),
                z = await act({ id });
              const end = live(z) ? await layout(z) : {};
              arms.push({
                sameAsOrigin: hash(x) === hash(b),
                won: z.levelsCompleted > x.levelsCompleted,
                state: z.state,
                pointOfDeparture: pairs.map((pair) =>
                  pair.map(({ role }) => unique(root, role)?.at ?? null),
                ),
                endImage: hash(z),
                motion: pairs.map((pair) =>
                  pair.map(({ role }) =>
                    delta(unique(root, role), unique(end, role)),
                  ),
                ),
              });
            }
            branches.push({ id, arms });
          }
          cases.push({
            action: i + 1,
            op: c.id,
            roles: pairs.map((pair) => pair.map(({ role }) => role)),
            preparations,
            branches,
          });
          await restore(i);
          await act(c);
        }
      }
      b = n;
    }
    await appendFile(
      out,
      JSON.stringify({ code: r.code, examined, cases }) + "\n",
    );
  }
