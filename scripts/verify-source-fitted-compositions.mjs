import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { sourceInterface } from "./sic-study-source-interface.mjs";
import { sourceReplay, op, hash } from "./sic-study-source-replay.mjs";

const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment)),
  entries = [];
for (const f of files)
  for (const line of (await readFile(f, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const r = JSON.parse(line);
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== "custom_4",
    );
    assert.equal(r.resets, 0);
    assert.equal(r.levels.length, 1);
    const replay = sourceReplay(
      sourceInterface(engine, r.sourceInterface),
      {},
      r,
    );
    const end = replay.restore(r.issued);
    assert.equal(replay.win(end), r.levels[0].won);
    const row = {
      code: r.code,
      level: r.start,
      view: r.sourceInterface ?? "original",
      won: replay.win(end),
      actions: r.issued,
      trajectory: r.trajectory,
      end: hash(end),
    };
    entries.push(row);
    if (!row.won) continue;
    let start = r.steps.length;
    while (
      start > 0 &&
      r.steps[start - 1].family === "sic_learn_reception_from_motion"
    )
      start--;
    const route = r.steps.slice(start).map(op);
    if (route.length < 2) continue;
    const test = (words) => {
      let b = replay.restore(start),
        used = 0;
      for (const word of words) {
        if (replay.win(b) || b.state !== "NOT_FINISHED") break;
        b = replay.act(word);
        used++;
      }
      return { won: replay.win(b), used };
    };
    row.prefix = start;
    row.finalRoute = route;
    row.omitAll = test([]);
    row.singleOmissions = route.map((_, i) => test(route.toSpliced(i, 1)).won);
    row.swapNeighbours = route
      .slice(1)
      .map((_, i) =>
        route[i] === route[i + 1]
          ? null
          : test(route.toSpliced(i, 2, route[i + 1], route[i])).won,
      );
    assert.equal(test(route).won, true);
  }
await writeFile(output, JSON.stringify(entries, null, 2), { flag: "wx" });
console.log(
  "independently verified",
  entries.length,
  "won",
  entries.filter((e) => e.won).length,
);
