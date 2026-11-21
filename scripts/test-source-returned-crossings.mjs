import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getGameByCode } from "../src/games/catalog.ts";
import { changedFootprints, footprints } from "./source-contact-footprints.mjs";
import { hash, op, sourceReplay } from "./sic-study-source-replay.mjs";
import { sourceBackend } from "./sic-study-source-games.mjs";

const [environment, output, ...files] = process.argv.slice(2);
const engine = await sourceBackend(resolve(environment));
const seen = new Set();
await writeFile(output, "", { flag: "wx" });
const alone = (view, role) =>
  view.get(role)?.size === 1 ? view.get(role).values().next().value.bbox : null;
const rect = (frame, [x, y, r, b]) =>
  frame
    .slice(y, b + 1)
    .map((row) => row.slice(x, r + 1).join(","))
    .join("/");
const legal = (board, word) =>
  board.availableActionIds.includes(Number(word.split(":")[0].slice(6)));
const digestWord = (word) => word.join("/");

function proposals(boards, views, tape) {
  const motions = new Map(),
    candidates = [],
    unique = new Set();
  for (let i = 0; i + 1 < views.length; i++) {
    const action = tape[i];
    if (!/^ACTION[1-4]$/.test(action)) continue;
    for (const m of changedFootprints(views[i], views[i + 1])) {
      if (m.copies !== 1) continue;
      const key = JSON.stringify([m.shape, action]),
        delta = [m.dx, m.dy].join();
      if (!motions.has(key)) motions.set(key, []);
      const history = motions.get(key);
      const from = m.from.bbox,
        to = m.to.bbox;
      // A crossing is the first recorded entry here by this subject, even under other controls.
      const newSite = !views
        .slice(0, i + 1)
        .some((v) => alone(v, m.shape)?.join() === to.join());
      if (
        newSite &&
        history.length &&
        history.every((h) => h.delta === delta)
      ) {
        const clean = rect(boards[i].frame, to);
        for (let end = i; end >= Math.max(1, i - 12); end--) {
          const endBox = alone(views[end], m.shape);
          if (!endBox) continue;
          for (let start = end - 1; start >= Math.max(0, end - 18); start--) {
            if (alone(views[start], m.shape)?.join() !== endBox.join())
              continue;
            if (
              boards[start].key === boards[end].key ||
              !history.some((h) => h.i < start)
            )
              continue;
            // Restrict to an uninterrupted identity for the intervening approach.
            if (
              views.slice(start, end + 1).some((view) => !alone(view, m.shape))
            )
              continue;
            const signature = JSON.stringify([m.shape, i, start, end]);
            if (unique.has(signature)) continue;
            unique.add(signature);
            const initial = rect(boards[start].frame, to),
              result = rect(boards[end].frame, to);
            const surfaces = new Set(
              history.filter((h) => h.i < start).map((h) => h.entered),
            );
            candidates.push({
              start,
              end,
              i,
              role: m.shape,
              from,
              to,
              action,
              changed: initial !== result,
              restoresGround: !surfaces.has(initial) && surfaces.has(result),
              heldGround: result === clean,
              prepLength: end - start,
              delay: i - end,
            });
          }
        }
      }
      history.push({ i, delta, entered: rect(boards[i].frame, to) });
    }
  }
  // Test one preparation for each distinct crossing, then sample evenly along the trace.
  // The geometric preference uses prior successful entries, never the outcomes of ablations.
  const best = new Map();
  function merit(p) {
    return (
      Number(p.restoresGround) * 8 +
      Number(p.changed) * 4 +
      Number(p.heldGround) * 2
    );
  }
  candidates.sort(
    (a, b) =>
      merit(b) - merit(a) ||
      a.prepLength - b.prepLength ||
      a.delay - b.delay ||
      a.start - b.start,
  );
  for (const p of candidates) {
    const k = JSON.stringify([p.i, p.role]);
    if (!best.has(k)) best.set(k, p);
  }
  const selected = [...best.values()].sort((a, b) => a.i - b.i);
  const cap = 10;
  return {
    opportunities: candidates.length,
    distinct: selected.length,
    selected:
      selected.length <= cap
        ? selected
        : Array.from(
            { length: cap },
            (_, i) =>
              selected[Math.round((i * (selected.length - 1)) / (cap - 1))],
          ),
  };
}

function runEpisode(r) {
  const replay = sourceReplay(engine, {}, r),
    tape = r.steps.map(op);
  const active = (b) => !replay.win(b) && b.state === "NOT_FINISHED";
  let board = replay.restore(0);
  const boards = [],
    views = [],
    cache = new Map();
  function view(b) {
    const key = hash(b);
    if (!cache.has(key)) cache.set(key, footprints(b.frame));
    return cache.get(key);
  }
  for (let i = 0; active(board); i++) {
    boards.push({ frame: board.frame, key: hash(board) });
    views.push(view(board));
    if (i === tape.length) break;
    assert.equal(boards.at(-1).key.slice(0, 16), r.steps[i].from);
    board = replay.act(tape[i]);
    assert.equal(hash(board).slice(0, 16), r.steps[i].to);
  }
  const options = proposals(boards, views, tape),
    experiments = [];
  for (const p of options.selected) {
    const prep = tape.slice(p.start, p.end),
      approach = tape.slice(p.end, p.i),
      later = tape.slice(p.i + 1);
    function branch(word) {
      let b = replay.restore(p.start);
      function play(commands) {
        for (const cmd of commands) {
          if (!active(b) || !legal(b, cmd)) return false;
          b = replay.act(cmd);
        }
        return true;
      }
      const reached = play(word) && play(approach) && active(b);
      const box = reached ? alone(view(b), p.role) : null;
      const sameOrigin = box?.join() === p.from.join();
      const surface = reached ? rect(b.frame, p.to) : null;
      const sameSurface =
        surface !== null && surface === rect(boards[p.i].frame, p.to);
      const beforeUse = active(b) ? hash(b) : null;
      const played = !!beforeUse && play([p.action]);
      const end = played && active(b) ? alone(view(b), p.role) : null;
      const crossed = sameOrigin && end?.join() === p.to.join();
      const stayed = sameOrigin && end?.join() === p.from.join();
      play(later);
      return {
        sameOrigin,
        sameSurface,
        crossed,
        stayed,
        won: replay.win(b),
        beforeUse,
      };
    }
    const reference = branch(prep);
    assert.equal(reference.beforeUse, boards[p.i].key);
    assert.ok(reference.crossed);
    assert.equal(reference.won, r.levels[0].won);
    const omitted = branch([]);
    const variants = [
      ["repeat-use", Array(prep.length).fill(p.action)],
      ["reverse", [...prep].reverse()],
      ["rotate", [...prep.slice(1), prep[0]]],
    ];
    // A stationary equal-duration control may preserve the original actor position during a long detour.
    for (const input of replay
      .restore(p.start)
      .availableActionIds.filter((n) => n > 0 && n < 6)) {
      variants.push([
        "repeat-alternative",
        Array(prep.length).fill("ACTION" + input),
      ]);
    }
    const equal = [],
      words = new Set([digestWord(prep)]);
    if (
      omitted.stayed ||
      (reference.won && !omitted.won && omitted.sameOrigin)
    ) {
      for (const [kind, word] of variants) {
        const id = digestWord(word);
        if (words.has(id)) continue;
        words.add(id);
        const arm = branch(word);
        equal.push({ kind, ...arm });
      }
    }
    experiments.push({
      start: p.start,
      end: p.end,
      useIndex: p.i,
      action: p.action,
      prep,
      approach: approach.length,
      subject: createHash("sha256").update(p.role).digest("hex"),
      from: p.from,
      to: p.to,
      changed: p.changed,
      restoresGround: p.restoresGround,
      heldGround: p.heldGround,
      reference,
      omitted,
      equal,
    });
  }
  return {
    code: r.code,
    level: r.start,
    sourceWon: r.levels[0].won,
    opportunities: options.opportunities,
    distinct: options.distinct,
    experiments,
  };
}
for (const file of files)
  for (const line of (await readFile(file, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)) {
    const r = JSON.parse(line),
      game = getGameByCode(r.code),
      id = [r.code, r.start].join("/");
    assert.ok(game && game.group !== "custom_4");
    if (
      seen.has(id) ||
      r.error ||
      r.resets ||
      r.sourcePrefixActions ||
      r.observedPriorLevelActions ||
      r.start !== r.finish
    )
      continue;
    seen.add(id);
    await appendFile(output, JSON.stringify(runEpisode(r)) + "\n");
  }
