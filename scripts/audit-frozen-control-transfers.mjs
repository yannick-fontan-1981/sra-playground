import assert from "node:assert/strict";
import {
  controlCandidateFeatures,
  controlCandidateRanks,
} from "./source-control-candidates.mjs";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ObservedInputDomain,
  measureNativeObservation,
} from "../src/logos-engine/v6-native-observer.ts";
import {
  motions,
  responses,
  transferredMarkers,
} from "./source-control-transfer.mjs";

const [environment, output, ...files] = process.argv.slice(2);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(environment, "src/runtime/native-game-dispatcher.ts"))
    .href
);
const hash = (b) =>
  createHash("sha256").update(JSON.stringify(b.frame)).digest("hex");
const center = (p) => [
  Math.round((p[0] + p[2]) / 2),
  Math.round((p[1] + p[3]) / 2),
];
const word = (c) =>
  c.id === 6 ? "ACTION6:" + c.data.x + "," + c.data.y : "ACTION" + c.id;
const at = (p) => "ACTION6:" + p.join();
const gap = (p, q) => Math.max(...p.map((x, i) => Math.abs(x - q[i])));
const out = [];
for (const file of files)
  for (const line of (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)) {
    const r = JSON.parse(line);
    assert.equal(r.start, r.finish);
    assert.equal(r.resets, 0);
    assert.ok(!r.observedPriorLevelActions);
    const engine = createGameDispatcher(() => {
      throw Error("Unexpected backend");
    });
    const send = async (w) => {
      const [name, coordinates] = w.split(":"),
        id = Number(name.slice(6));
      const [x, y] = coordinates?.split(",").map(Number) ?? [];
      return engine.dispatch({
        type: "action",
        actionId: id,
        ...(id === 6 ? { data: { x, y } } : {}),
      });
    };
    async function restore(i) {
      let b = await engine.dispatch({
        type: "load",
        code: r.code,
        level: r.start,
      });
      if (b.level !== r.start && b.canSelectLevel)
        b = await engine.dispatch({ type: "selectLevel", level: r.start });
      assert.equal(hash(b), r.initial);
      for (const c of r.replayCommands.slice(0, i)) {
        assert.equal(hash(b).slice(0, 16), c.from);
        b = await send(word(c));
        assert.equal(hash(b).slice(0, 16), c.to);
      }
      return b;
    }
    const active = (b) =>
      b.level === r.start &&
      b.state === "NOT_FINISHED" &&
      b.levelsCompleted === r.initialCompleted;
    const checkpoints = [0, 8, 24, 48].filter((i) => i < r.issued);
    const measured = [];
    let b = await restore(0),
      observedClicks = 0,
      observedChangingClicks = 0,
      observedMarkerClicks = 0;
    const strides = new Map();
    let recent = [];
    const recentAt = new Map();
    for (const [index, c] of r.replayCommands.entries()) {
      if (checkpoints.includes(index)) recentAt.set(index, recent);
      const old = b;
      b = await send(word(c));
      assert.equal(hash(b).slice(0, 16), c.to);
      if (c.id <= 4) {
        const moving = motions(old.frame, b.frame);
        if (moving.length) recent = [...moving, ...recent].slice(0, 8);
        for (const m of moving) {
          const stride = Math.abs(m.dx) + Math.abs(m.dy);
          strides.set(stride, (strides.get(stride) ?? 0) + 1);
        }
      }
      if (c.id === 6) {
        observedClicks++;
        if (c.from !== c.to) observedChangingClicks++;
        const p = [c.data.x, c.data.y],
          pitch = [...strides].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 2;
        if (
          transferredMarkers(
            old.frame,
            b.frame,
            p,
            Math.max(1, Math.floor(pitch / 2)),
          ).length
        )
          observedMarkerClicks++;
      }
    }
    for (const i of checkpoints) {
      b = await restore(i);
      const old = b,
        cache = new Map(),
        obs = await measureNativeObservation(
          {
            frame_rows: b.frame,
            frame_hash: hash(b),
            level: b.level,
            levels_completed: b.levelsCompleted,
            state: b.state,
            available_action_refs: b.availableActionIds.map(
              (n) => "ACTION" + n,
            ),
          },
          i + 1,
          "fork",
        );
      const loci = new ObservedInputDomain(32)
        .candidates(obs)
        .filter((c) => c.action_ref === "ACTION6")
        .map((c) => at([c.data.x, c.data.y]));
      const ranks = controlCandidateRanks(
        controlCandidateFeatures(
          old.frame,
          recentAt.get(i),
          loci.map((w) => w.slice(8).split(",").map(Number)),
        ),
      );
      const selectors = [
        ...new Set([
          ...loci,
          ...b.availableActionIds
            .filter((n) => n === 5)
            .map((n) => "ACTION" + n),
        ]),
      ];
      async function after(words) {
        const k = words.join("|");
        if (cache.has(k)) return cache.get(k);
        let p = await restore(i);
        for (const w of words) {
          if (!active(p) || !p.availableActionIds.includes(Number(w[6]))) break;
          p = await send(w);
        }
        cache.set(k, p);
        return p;
      }
      const motors = b.availableActionIds
          .filter((n) => n >= 1 && n <= 4)
          .map((n) => "ACTION" + n),
        responsesFound = [];
      const base = new Map();
      for (const cmd of motors) {
        const next = await after([cmd]);
        if (active(next)) base.set(cmd, motions(old.frame, next.frame));
      }
      let visual = 0,
        changed = 0,
        alternatives = 0;
      for (const a of selectors) {
        const selected = await after([a]);
        if (!active(selected) || hash(old) === hash(selected)) continue;
        changed++;
        const p = a.startsWith("ACTION6:")
          ? a.slice(8).split(",").map(Number)
          : null;
        let prediction = false;
        const choices = [];
        for (const [cmd, direct] of base) {
          if (!direct.length) continue;
          const test = await after([a, cmd]);
          if (!active(test)) continue;
          const effect = motions(selected.frame, test.frame);
          for (const m of direct) {
            const from = center(m.from.bbox),
              d = [m.dx, m.dy],
              radius = Math.max(
                1,
                Math.floor((Math.abs(m.dx) + Math.abs(m.dy)) / 2),
              );
            const marks = p
              ? transferredMarkers(old.frame, selected.frame, p, radius)
              : [];
            prediction ||= marks.length > 0;
            if (responses(effect, from, radius).length) continue;
            for (const n of effect) {
              if (n.dx !== m.dx || n.dy !== m.dy) continue;
              const to = center(n.from.bbox);
              if (
                gap(from, to) <= 2 * radius ||
                responses(direct, to, radius).length
              )
                continue;
              if (
                choices.some(
                  (x) =>
                    x.cmd === cmd &&
                    gap(x.from, from) <= radius &&
                    gap(x.to, to) <= radius,
                )
              )
                continue;
              choices.push({
                cmd,
                from,
                to,
                radius,
                d,
                marker: marks.some(
                  (v) => gap(v.from, from) <= radius && gap(v.to, to) <= radius,
                ),
              });
            }
          }
        }
        visual += Number(prediction);
        for (const q of choices) {
          alternatives++;
          if (!b.availableActionIds.includes(6)) continue;
          const control = at(q.from),
            s = await after([control]),
            tested = await after([control, q.cmd]);
          if (!active(s) || !active(tested)) continue;
          const contrast = motions(s.frame, tested.frame);
          if (
            !responses(contrast, q.from, q.radius).includes(q.d.join()) ||
            responses(contrast, q.to, q.radius).length
          )
            continue;
          const atB = q.to.map((x, k) => x + q.d[k]),
            back = [a, q.cmd, control],
            stay = [a, q.cmd, at(atB)];
          const f = await after(back),
            f1 = await after([...back, q.cmd]),
            g = await after(stay),
            g1 = await after([...stay, q.cmd]);
          const fm = active(f) && active(f1) ? motions(f.frame, f1.frame) : [],
            gm = active(g) && active(g1) ? motions(g.frame, g1.frame) : [];
          const reciprocal =
            responses(fm, q.from, q.radius).includes(q.d.join()) &&
            !responses(fm, atB, q.radius).length &&
            responses(gm, atB, q.radius).includes(q.d.join()) &&
            !responses(gm, q.from, q.radius).length;
          responsesFound.push({
            selector: a,
            priorRank: ranks[loci.indexOf(a)] ?? null,
            cmd: q.cmd,
            directSite: q.from,
            alternateSite: q.to,
            delta: q.d,
            marker: q.marker,
            reciprocal,
          });
        }
      }
      measured.push({
        prefix: i,
        loci: loci.length,
        selectors: selectors.length,
        changed,
        visual,
        alternatives,
        matched: responsesFound,
      });
    }
    out.push({
      code: r.code,
      level: r.start,
      steps: r.issued,
      observedClicks,
      observedChangingClicks,
      observedMarkerClicks,
      measured,
    });
  }
await writeFile(output, JSON.stringify(out), { flag: "wx" });
console.log(
  JSON.stringify(
    out.map((r) => [
      r.code,
      r.observedClicks,
      r.measured.map((x) => [
        x.prefix,
        x.selectors,
        x.matched.length,
        x.matched.filter((v) => v.reciprocal).length,
      ]),
    ]),
  ),
);
