import assert from "node:assert/strict";
import { readFile, appendFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { measureExposedReception as read } from "../src/logos-engine/v6-exposed-reception-observation.ts";
import {
  exposureBearing,
  exposureLayout,
  exposureMatches,
  exposureRules,
  finishedExposure,
  planExposure,
  readTrackedExposure,
} from "../src/sic/coupled-exposure.ts";
import { op, hash, sourceReplay } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";

const [environment, output, ...files] = process.argv.slice(2),
  engine = await sourceBackend(resolve(environment));
await writeFile(output, "", { flag: "wx" });
const seen = new Set(),
  eq = (p, q) => p.join() === q.join();
function describe(scene, shadow, lit) {
  if (!scene || scene.bodies.length > 5) return;
  const measured = exposureLayout(scene, {
    shadow,
    lit,
    linked: null,
    released: null,
  });
  if (measured) return { board: measured[0], current: measured[1] };
}
function action(scene, word) {
  if (/^ACTION[1-5]$/.test(word)) return Number(word.slice(6)) - 1;
  const p = word.startsWith("ACTION6:")
    ? word.slice(8).split(",").map(Number)
    : null;
  // Public clicks within a dial cell can have the same effect as its centre.
  const dial =
    p &&
    scene.dial.find((d) =>
      d.point.every((v, i) => Math.abs(p[i] - v) < scene.pitch / 2),
    );
  return dial ? 5 + exposureBearing(dial.vector) : -1;
}
function cmd(scene, id) {
  if (id < 5) return "ACTION" + (id + 1);
  const dial = scene.dial.find((d) => exposureBearing(d.vector) === id - 5);
  return dial ? "ACTION6:" + dial.point.join() : null;
}
for (const f of files)
  for (const l of (await readFile(f, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)) {
    const r = JSON.parse(l),
      game = getGameByCode(r.code),
      key = r.code + "/" + r.start;
    assert.ok(game && game.group !== "custom_4");
    if (
      seen.has(key) ||
      r.error ||
      r.resets ||
      r.sourcePrefixActions ||
      r.observedPriorLevelActions ||
      r.start !== r.finish
    )
      continue;
    seen.add(key);
    const replay = sourceReplay(engine, {}, r),
      tape = r.steps.map(op),
      alive = (b) => !replay.win(b) && b.state === "NOT_FINISHED";
    let b = replay.restore(0),
      s = read(b.frame),
      samples = [],
      encountered = new Set(),
      tests = [];
    const tried = new Set();
    for (let i = 0; i < tape.length && alive(b); i++) {
      b = replay.act(tape[i]);
      assert.equal(hash(b).slice(0, 16), r.steps[i].to);
      const t = alive(b) ? read(b.frame) : null;
      if (s && t && s.layout === t.layout) {
        const id = action(s, tape[i]);
        if (id >= 0) {
          samples.push({ s, t, id });
          for (const piece of [...s.bodies, ...t.bodies])
            encountered.add(piece.color);
        }
        if (id >= 0 && encountered.size === 2 && !tried.has(t.layout)) {
          const pair = [...encountered],
            models = [];
          for (const [shadow, lit] of [pair, [...pair].reverse()]) {
            const current = describe(t, shadow, lit);
            if (!current) continue;
            let supported = 0,
              rejected = 0,
              discriminating = 0;
            for (const step of samples) {
              const initial = describe(step.s, shadow, lit);
              if (!initial) continue;
              const projected = exposureRules(initial.board).project(
                initial.current,
                step.id,
              );
              const correct = exposureMatches(initial.board, projected, step.t);
              if (correct) supported++;
              else rejected++;
              if (
                correct &&
                step.s.bodies.some(
                  (piece, k) =>
                    step.t.bodies[k]?.color !== piece.color ||
                    (step.t.bodies[k] && !eq(piece.pos, step.t.bodies[k].pos)),
                )
              )
                discriminating++;
            }
            models.push({
              shadow,
              lit,
              supported,
              rejected,
              discriminating,
              ...current,
            });
          }
          const admissible = models.filter(
            (m) => m.discriminating > 0 && m.rejected === 0,
          );
          if (admissible.length === 1) {
            tried.add(t.layout);
            const m = admissible[0],
              commands = Array.from({ length: 13 }, (_, i) => i).filter((i) => {
                const word = cmd(t, i);
                return (
                  word &&
                  b.availableActionIds.includes(
                    Number(word.split(":")[0].slice(6)),
                  )
                );
              });
            const route = await planExposure(
              m.board,
              m.current,
              commands,
              Math.max(0, 120 - i - 1),
            );
            let state = m.current,
              count = 0,
              matched = 0,
              won = false,
              divergence;
            const sequence = [];
            const dial = t.dial.find((d) => d.active).point,
              dialInk = b.frame[dial[1]][dial[0]];
            for (const id of route) {
              const word = cmd(t, id);
              state = exposureRules(m.board).project(state, id);
              sequence.push(word);
              b = replay.act(word);
              count++;
              if (replay.win(b)) {
                won = true;
                break;
              }
              const actual =
                alive(b) &&
                (read(b.frame) ??
                  readTrackedExposure(b.frame, t, m.board, dialInk));
              if (!actual || !exposureMatches(m.board, state, actual)) {
                const value = actual && describe(actual, m.shadow, m.lit);
                divergence = {
                  terminalPrediction: finishedExposure(m.board, state),
                  stillPlaying: alive(b),
                  expected: state,
                  actual: value?.current ?? null,
                  goals: m.board.goals,
                  newGoals: value?.board.goals ?? null,
                  changedLayout: actual && actual.layout !== t.layout,
                  animation: b.frames?.length ?? 0,
                  verifiedInAnimation: (b.frames ?? []).some((frame) => {
                    const measured = readTrackedExposure(
                      frame,
                      t,
                      m.board,
                      dialInk,
                    );
                    return (
                      measured && exposureMatches(m.board, state, measured)
                    );
                  }),
                };
                break;
              }
              matched++;
            }
            const stages = [];
            const visited = new Set([t.layout]);
            let continued =
              divergence?.verifiedInAnimation &&
              divergence.changedLayout &&
              divergence.terminalPrediction;
            while (continued && !won && i + 1 + count < 120) {
              const layout = read(b.frame),
                next = layout && describe(layout, m.shadow, m.lit);
              if (!next || visited.has(layout.layout)) break;
              visited.add(layout.layout);
              const inkPoint = layout.dial.find((d) => d.active).point,
                ink = b.frame[inkPoint[1]][inkPoint[0]];
              const choices = Array.from({ length: 13 }, (_, n) => n).filter(
                (id) => {
                  const w = cmd(layout, id);
                  return (
                    w &&
                    b.availableActionIds.includes(
                      Number(w.split(":")[0].slice(6)),
                    )
                  );
                },
              );
              const path = await planExposure(
                next.board,
                next.current,
                choices,
                120 - i - 1 - count,
              );
              const journal = {
                planned: path.length,
                executed: 0,
                matched: 0,
                confirmedBoundary: false,
              };
              stages.push(journal);
              continued = false;
              let prediction = next.current;
              for (const id of path) {
                prediction = exposureRules(next.board).project(prediction, id);
                const word = cmd(layout, id);
                b = replay.act(word);
                sequence.push(word);
                count++;
                journal.executed++;
                if (replay.win(b)) {
                  won = true;
                  break;
                }
                if (!alive(b)) break;
                const actual =
                  read(b.frame) ??
                  readTrackedExposure(b.frame, layout, next.board, ink);
                if (actual && exposureMatches(next.board, prediction, actual)) {
                  journal.matched++;
                  continue;
                }
                continued =
                  !!actual &&
                  actual.layout !== layout.layout &&
                  finishedExposure(next.board, prediction) &&
                  (b.frames ?? []).some((frame) => {
                    const measured = readTrackedExposure(
                      frame,
                      layout,
                      next.board,
                      ink,
                    );
                    return (
                      measured &&
                      exposureMatches(next.board, prediction, measured)
                    );
                  });
                journal.confirmedBoundary = continued;
                break;
              }
            }
            tests.push({
              prefix: i + 1,
              supported: m.supported,
              discriminating: m.discriminating,
              route: route.length,
              count,
              matched,
              won,
              sequence,
              divergence,
              stages,
            });
            b = replay.restore(i + 1);
          }
        }
      }
      s = t;
    }
    await appendFile(
      output,
      JSON.stringify({
        code: r.code,
        level: r.start,
        layoutsTried: tried.size,
        samples: samples.length,
        colors: encountered.size,
        tests,
      }) + "\n",
    );
  }
