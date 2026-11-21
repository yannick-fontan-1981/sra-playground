import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { hash } from "./sic-study-source-replay.mjs";
import { dispatchWord } from "./sic-study-source-fork.mjs";
import { footprints } from "./source-contact-footprints.mjs";
import { motions } from "./source-control-transfer.mjs";
import { geometricComponents } from "../src/logos-engine/v6-native-observer.ts";
import { poseFamilyKey } from "../src/sic/pose-families.ts";
const unchanged = (before, after, [l, t, r, b]) =>
  before.frame
    .slice(t, b + 1)
    .every((row, i) =>
      row.slice(l, r + 1).every((v, j) => after.frame[t + i][l + j] === v),
    );

const [environment, output, ...files] = process.argv.slice(2);
const { createGameDispatcher } = await import(
  pathToFileURL(resolve(environment, "src/runtime/native-game-dispatcher.ts"))
    .href
);
const word = (c) =>
  c.id === 6 ? "ACTION6:" + c.data.x + "," + c.data.y : "ACTION" + c.id;
const inner = (a, b) =>
  a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
const centre = (b) => [
  Math.round((b[0] + b[2]) / 2),
  Math.round((b[1] + b[3]) / 2),
];
const silhouette = (p) => p.bbox.join() + ":" + JSON.stringify(p.mask);
function stable(before, after) {
  const outlines = (b) =>
    new Set(
      [...footprints(b.frame).values()].flatMap((g) =>
        [...g.values()].map(silhouette),
      ),
    );
  const a = outlines(before),
    b = outlines(after);
  return new Set([...a].filter((k) => b.has(k)));
}
// Compare the driver's declared source and target in each arm independently.
// A turn can change the exact mask and the two subjects can have different strides.
function departure(before,after,box){
  const grouped=frame=>{
    const groups=new Map();
    for(const part of geometricComponents(frame)){
      if(part.area<2 || part.area>frame.length*frame[0].length/12)continue;
      const role=poseFamilyKey({...part,palette_value:part.color});
      const batch=groups.get(role)??[];batch.push(part.bbox);groups.set(role,batch);
    }
    return groups;
  };
  const start=grouped(before.frame),end=grouped(after.frame),departures=[];
  for(const [role,group] of start){
    const pair=end.get(role);
    if(group.length!==1 || pair?.length!==1)continue;
    const b=group[0],q=pair[0];
    const [x,y]=centre(b);
    if(x<box[0]||x>box[2]||y<box[1]||y>box[3])continue;
    const dx=q[0]+q[2]-b[0]-b[2],dy=q[1]+q[3]-b[1]-b[3];
    if(Math.max(Math.abs(dx),Math.abs(dy))>=Math.max(2,b[2]-b[0]+1,b[3]-b[1]+1))departures.push([dx/2,dy/2]);
  }
  return departures;
}
const results = [];
for (const file of files) {
  const r = JSON.parse((await readFile(file, "utf8")).trim());
  assert.equal(r.start, r.finish);
  assert.ok(!r.error);
  const game = createGameDispatcher(() => {
    throw Error("Unexpected backend");
  });
  const tape = r.replayCommands,
    frames = [],
    resetAt = new Set();
  const load = async () => {
    let b = await game.dispatch({ type: "load", code: r.code, level: r.start });
    if (b.level !== r.start && b.canSelectLevel)
      b = await game.dispatch({ type: "selectLevel", level: r.start });
    assert.equal(hash(b), r.initial);
    return b;
  };
  const live = (b) =>
    b.state === "NOT_FINISHED" &&
    b.level === r.start &&
    b.levelsCompleted === r.initialCompleted;
  let b = await load();
  for (const [i, c] of tape.entries()) {
    if (hash(b).slice(0, 16) !== c.from) {
      assert.ok(resetAt.size < r.resets);
      b = await game.dispatch({ type: "reset" });
      resetAt.add(i);
    }
    assert.equal(hash(b).slice(0, 16), c.from);
    frames.push(b);
    b = await dispatchWord(game, word(c));
    assert.equal(hash(b).slice(0, 16), c.to);
  }
  frames.push(b);
  async function restore(i) {
    let b = await load();
    for (let j = 0; j < i; j++) {
      if (resetAt.has(j)) b = await game.dispatch({ type: "reset" });
      b = await dispatchWord(game, word(tape[j]));
    }
    if (resetAt.has(i)) b = await game.dispatch({ type: "reset" });
    assert.equal(hash(b), hash(frames[i]));
    return b;
  }
  const tests = [];
  for (const [i, c] of tape.entries()) {
    if (c.cursorStage !== "select" || !c.controlContrast) continue;
    const next = tape[i + 1],
      tested =
        next?.cursorStage === "verify" &&
        word(next) === c.controlContrast.motor &&
        !resetAt.has(i + 1);
    const record = {
      decision: i + 1,
      select: word(c),
      motor: c.controlContrast.motor,
      outcomes: c.controlContrast.outcomes,
      followed: tested,
      cueChanged: c.from !== c.to,
      scoreAtTest: false,
      differential: false,
      reciprocal: false,
      declaredSite: false,
      subsequentMoves: [],
    };
    tests.push(record);
    if (!tested) continue;
    const old = await restore(i),
      direct = await dispatchWord(game, record.motor),
      sel = frames[i + 1],
      acted = frames[i + 2];
    if (!live(acted)) {
      record.scoreAtTest =
        acted.levelsCompleted > r.initialCompleted || acted.state === "WIN";
      continue;
    }
    if (!live(direct) || !live(sel)) continue;
    const [source,target]=c.observedSubjects;
    const ordinary=departure(old,direct,source),selected=departure(sel,acted,target);
    const shamRoot=await restore(i);
    const sham=await dispatchWord(game,"ACTION6:"+centre(source).join(","));
    const shamMotor=live(sham)?await dispatchWord(game,record.motor):sham;
    const shamMoves=live(shamMotor)?departure(sham,shamMotor,source):[];
    record.placementComparison={ordinary,selected,shamMoves,
      selectedStayedWithoutClick:unchanged(old,direct,target),previousStayedAfterClick:unchanged(sel,acted,source),
      controlClickNeutral:hash(shamRoot)===hash(sham)};
    const factual = motions(sel.frame, acted.frame),
      oldStable = stable(sel, acted),
      baseStable = stable(old, direct);
    for (const a of motions(old.frame, direct.frame)) {
      if (
        !oldStable.has(silhouette(a.from)) &&
        !unchanged(sel, acted, a.from.bbox)
      )
        continue;
      const [x, y] = centre(a.from.bbox);
      await restore(i);
      const sham = await dispatchWord(game, "ACTION6:" + x + "," + y);
      if (!live(sham)) continue;
      const shamMoved = await dispatchWord(game, record.motor);
      if (
        !live(shamMoved) ||
        !motions(sham.frame, shamMoved.frame).some(
          (m) =>
            silhouette(m.from) === silhouette(a.from) &&
            m.dx === a.dx &&
            m.dy === a.dy,
        )
      )
        continue;
      const alternativeStable = stable(sham, shamMoved);
      for (const b of factual) {
        if (
          b.dx !== a.dx ||
          b.dy !== a.dy ||
          (!baseStable.has(silhouette(b.from)) &&
            !unchanged(old, direct, b.from.bbox)) ||
          (!alternativeStable.has(silhouette(b.from)) &&
            !unchanged(sham, shamMoved, b.from.bbox))
        )
          continue;
        if (
          !(
            a.from.bbox[2] < b.from.bbox[0] ||
            b.from.bbox[2] < a.from.bbox[0] ||
            a.from.bbox[3] < b.from.bbox[1] ||
            b.from.bbox[3] < a.from.bbox[1]
          )
        )
          continue;
        // Selection can change the mark and thereby the component's mask. Verify
        // role identity by actually returning control and comparing a matched stay.
        async function selectAndMove(box) {
          await restore(i + 2);
          const middle = await dispatchWord(
            game,
            "ACTION6:" + centre(box).join(),
          );
          if (!live(middle)) return null;
          const after = await dispatchWord(game, record.motor);
          return live(after)
            ? { middle, after, moves: motions(middle.frame, after.frame) }
            : null;
        }
        const back = await selectAndMove(a.from.bbox),
          stay = await selectAndMove(b.to.bbox);
        const movedAt = (arm, box) =>
          arm?.moves.some(
            (m) => m.dx === a.dx && m.dy === a.dy && inner(m.from.bbox, box),
          );
        const returned = !!(
          movedAt(back, a.from.bbox) &&
          unchanged(back.middle, back.after, b.to.bbox) &&
          movedAt(stay, b.to.bbox) &&
          unchanged(stay.middle, stay.after, a.from.bbox)
        );
        record.reciprocal ||= returned;
        if (
          !returned &&
          !(
            oldStable.has(silhouette(a.from)) &&
            baseStable.has(silhouette(b.from)) &&
            alternativeStable.has(silhouette(b.from))
          )
        )
          continue;
        record.differential = true;
        record.declaredSite ||=
          inner(a.from.bbox, c.observedSubjects[0]) &&
          inner(b.from.bbox, c.observedSubjects[1]);
        let peer = b.to;
        for (let j = i + 2; j < tape.length; j++) {
          const step = tape[j],
            before = frames[j],
            after = frames[j + 1];
          if (
            resetAt.has(j) ||
            !live(after) ||
            !unchanged(before, after, a.from.bbox)
          )
            break;
          if (step.id > 4 && step.from !== step.to) break;
          const moved = motions(before.frame, after.frame).find(
            (m) => silhouette(m.from) === silhouette(peer),
          );
          if (moved && step.id <= 4) {
            if (!record.subsequentMoves.some((x) => x.decision === j + 1))
              record.subsequentMoves.push({
                decision: j + 1,
                family: step.family,
              });
            peer = moved.to;
          } else if (!unchanged(before, after, peer.bbox)) break;
        }
      }
    }
  }
  const receipts = r.preparation.filter(
    (v) => v.phase === "verifyMarkedCursor",
  );
  results.push({
    code: r.code,
    pack: r.packDigest ?? null,
    level: r.start,
    actions: r.issued,
    won: r.levels[0].won,
    proposals: r.cursorAudit?.filter((e) => e.offered).length ?? null,
    tests,
    recognized: receipts
      .filter(
        (v) => v.result === "new_cursor_moved_while_previous_cursor_stayed",
      )
      .map((v) => v.actionIndex),
  });
}
await writeFile(output, JSON.stringify(results), { flag: "wx" });
console.log(
  results.map((x) => [
    x.code,
    x.actions,
    x.tests.length,
    x.tests.filter((t) => t.followed).length,
    x.tests.filter((t) => t.differential).length,
    x.recognized.length,
    x.won,
  ]),
);
