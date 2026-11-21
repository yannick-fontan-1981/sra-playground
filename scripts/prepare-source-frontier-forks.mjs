import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { hash, op, sourceReplay } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";
const [environment, experiments, output, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
const readLines = async (f) =>
  (await readFile(f, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(JSON.parse);
const cases = new Map(
  (await readLines(experiments)).map((r) => [[r.code, r.level].join("/"), r]),
);
const entries = [];
for (const f of files)
  for (const r of await readLines(f)) {
    const k = [r.code, r.start].join("/"),
      group = cases.get(k);
    if (!group) continue;
    cases.delete(k);
    assert.ok(
      getGameByCode(r.code) && getGameByCode(r.code).group !== "custom_4",
    );
    const replay = sourceReplay(engine, {}, r);
    for (const t of group.tests) {
      if (![t.prepared, t.alone, t.sameLength].every((o) => o.launch && o.used))
        continue;
      const alt = t.substitutions
        .filter((v) => v.launch && v.used)
        .sort((a, b) => a.replacement.localeCompare(b.replacement))[0];
      const arms = {
        prepared: [...t.preparations, t.use],
        alone: [t.use],
        repeated: Array(t.preparations.length + 1).fill(t.use),
      };
      if (alt)
        arms.substitute = [
          ...t.preparations.slice(0, -1),
          alt.replacement,
          t.use,
        ];
      for (const [arm, words] of Object.entries(arms)) {
        const prefix = t.prefix,
          commands = r.steps
            .slice(0, prefix)
            .map((c) => ({ word: op(c), from: c.from, to: c.to }));
        let b = replay.restore(prefix);
        for (const word of words) {
          const from = hash(b).slice(0, 16);
          assert.equal(b.state, "NOT_FINISHED");
          assert.ok(!replay.win(b));
          b = replay.act(word);
          commands.push({ word, from, to: hash(b).slice(0, 16) });
        }
        if (replay.win(b) || b.state !== "NOT_FINISHED") continue;
        entries.push({
          id: k + "/" + prefix + "/" + arm,
          code: r.code,
          level: r.start,
          prefix,
          arm,
          commands,
          original: r.initial,
          initial: hash(b),
          crossed: t[arm]?.crossed ?? alt?.crossed,
        });
      }
    }
  }
assert.equal(cases.size, 0);
await writeFile(output, JSON.stringify(entries), { flag: "wx" });
console.log("sealed", entries.length, "experimental starting states");
