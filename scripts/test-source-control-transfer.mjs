import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { sourceBackend } from "./sic-study-source-games.mjs";
import { op, hash, sourceReplay } from "./sic-study-source-replay.mjs";
import {
  motions,
  onSite,
  responses,
  transferredMarkers,
} from "./source-control-transfer.mjs";
import { footprints } from "./source-contact-footprints.mjs";

const [environment, output, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
await writeFile(output, "", { flag: "wx" });
const levels = new Set();
const xy = (w) => w.slice(8).split(",").map(Number);
const clickAt = (p) => "ACTION6:" + p.map(Math.round).join();
// Compare outline and position independently of ink, which can change with selection.
const silhouette = (p) =>
  [
    p.bbox.join(),
    p.mask
      .map((q) => q.join())
      .sort()
      .join("/"),
  ].join(":");
const nearby = (box, p, r) =>
  box[0] - r <= p[0] &&
  p[0] <= box[2] + r &&
  box[1] - r <= p[1] &&
  p[1] <= box[3] + r;
for (const file of files)
  for (const l of (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const run = JSON.parse(l);
    assert.ok(
      getGameByCode(run.code) && getGameByCode(run.code).group !== "custom_4",
    );
    const level = [run.code, run.start].join("/");
    if (
      levels.has(level) ||
      run.error ||
      run.resets ||
      run.sourcePrefixActions ||
      run.observedPriorLevelActions
    )
      continue;
    levels.add(level);
    const replay = sourceReplay(engine, {}, run),
      active = (b) => b.state === "NOT_FINISHED" && !replay.win(b),
      known = new Map(),
      seen = new Set(),
      proposals = [];
    let b = replay.restore(0),
      clicks = 0,
      marks = 0;
    for (const [i, c] of run.steps.entries()) {
      const word = op(c),
        prev = b;
      b = replay.act(word);
      assert.equal(hash(b).slice(0, 16), c.to);
      if (!active(b)) break;
      if (/^ACTION[1-4]$/.test(word)) {
        if (!known.has(word)) known.set(word, new Map());
        for (const m of motions(prev.frame, b.frame)) {
          const k = [m.dx, m.dy].join(),
            support = known.get(word).get(k) ?? new Set();
          support.add(c.from);
          known.get(word).set(k, support);
        }
      } else if (word.startsWith("ACTION6:")) {
        clicks++;
        const directions = [...known].flatMap(([cmd, v]) =>
          [...v].map(([d, examples]) => ({
            cmd,
            d,
            support: examples.size,
            pitch: d
              .split(",")
              .reduce((sum, n) => sum + Math.abs(Number(n)), 0),
          })),
        );
        if (!directions.length) continue;
        const prefer = directions.sort(
            (a, b) => b.support - a.support || a.pitch - b.pitch,
          )[0],
          radius = Math.max(1, Math.floor(prefer.pitch / 2));
        const terms = transferredMarkers(prev.frame, b.frame, xy(word), radius);
        if (!terms.length) continue;
        marks++;
        for (const term of terms.slice(0, 3)) {
          const k = [term.from.map(Math.round), term.to.map(Math.round)].join(
            "|",
          );
          if (seen.has(k)) continue;
          seen.add(k);
          const options = directions
            .filter((v) => v.pitch === prefer.pitch)
            .sort((a, b) => b.support - a.support)
            .slice(0, 8);
          proposals.push({
            i,
            word,
            radius,
            term,
            options,
            source: c.from,
            at: c.to,
          });
        }
      }
    }
    // The choice of locations and commands uses the observed interaction and its earlier history alone.
    const results = [];
    for (const q of proposals.slice(0, 8)) {
      const { i, word, radius, term, options } = q;
      const tests = [];
      for (const cmd of [...new Set(options.map((o) => o.cmd))]) {
        function respond(setup, from = term.from, to = term.to) {
          let b = replay.restore(i);
          for (const w of setup) {
            if (!active(b) || !b.availableActionIds.includes(Number(w[6])))
              return null;
            b = replay.act(w);
          }
          if (!active(b) || !b.availableActionIds.includes(Number(cmd[6])))
            return null;
          const prev = b;
          b = replay.act(cmd);
          if (!active(b))
            return { terminal: true, won: replay.win(b), a: [], b: [] };
          const changed = motions(prev.frame, b.frame);
          const old = new Set(
            [...footprints(prev.frame).values()].flatMap((g) =>
              [...g.values()].map(silhouette),
            ),
          );
          const stable = new Set(
            [...footprints(b.frame).values()]
              .flatMap((g) => [...g.values()].map(silhouette))
              .filter((k) => old.has(k)),
          );
          const tracked = (p, d) =>
            changed.filter(
              (m) =>
                nearby(m.from.bbox, p, radius) && [m.dx, m.dy].join() === d,
            );
          return {
            a: responses(changed, from, radius),
            b: responses(changed, to, radius),
            stable,
            tracked,
          };
        }
        const direct = respond([]),
          withClick = respond([word]);
        if (!direct || !withClick) continue;
        const relevant = options.filter((v) => v.cmd === cmd).map((v) => v.d);
        const switched = direct.a.filter(
          (d) =>
            relevant.includes(d) &&
            withClick.b.includes(d) &&
            !direct.b.length &&
            !withClick.a.length,
        );
        const selected = switched.length === 1 ? switched[0] : null,
          control = selected && respond([clickAt(term.from)]);
        const equal = !!(
          selected &&
          control?.a.includes(selected) &&
          !control?.b.length
        );
        let returned = null,
          kept = null,
          sameDelay = null,
          composed = false,
          retainedBoth = false;
        if (equal) {
          const d = selected.split(",").map(Number),
            newB = term.to.map((x, k) => x + d[k]);
          if (!onSite(newB, term.from, radius)) {
            kept = respond([word, cmd], term.from, newB);
            returned = respond(
              [word, cmd, clickAt(term.from)],
              term.from,
              newB,
            );
            sameDelay = respond([word, cmd, clickAt(newB)], term.from, newB);
            composed = !!(
              returned?.a.includes(selected) &&
              !returned?.b.length &&
              kept?.b.includes(selected) &&
              !kept?.a.length
            );
            if (
              composed &&
              sameDelay?.b.includes(selected) &&
              !sameDelay?.a.length
            ) {
              const still = (active, site, passive) =>
                active
                  .tracked?.(site, selected)
                  .some((m) => passive?.stable?.has(silhouette(m.from)));
              retainedBoth = !!(
                still(returned, term.from, sameDelay) &&
                still(sameDelay, newB, returned)
              );
            }
          }
        }
        const summary = (r) =>
          r && {
            a: r.a,
            b: r.b,
            ...(r.terminal ? { terminal: true, won: r.won } : {}),
          };
        tests.push({
          cmd,
          selected,
          equal,
          composed,
          retainedBoth,
          direct: summary(direct),
          withClick: summary(withClick),
          ...(equal
            ? {
                control: summary(control),
                returned: summary(returned),
                kept: summary(kept),
                sameDelay: summary(sameDelay),
              }
            : {}),
        });
      }
      results.push({
        prefix: i,
        action: word,
        radius,
        from: term.from,
        to: term.to,
        exact: term.exact,
        seal: createHash("sha256").update(JSON.stringify(q)).digest("hex"),
        tests,
      });
    }
    await appendFile(
      output,
      JSON.stringify({
        code: run.code,
        level: run.start,
        clicks,
        marks,
        distinct: proposals.length,
        results,
      }) + "\n",
    );
  }
