import assert from "node:assert/strict";
import { hash } from "./sic-study-source-replay.mjs";

export function dispatchWord(engine, word) {
  const match = /^ACTION([1-7])(?::(\d+),(\d+))?$/.exec(word);
  assert.ok(match && (match[1] === "6") === (match[2] !== undefined));
  return engine.dispatch({
    type: "action",
    actionId: Number(match[1]),
    ...(match[2] === undefined
      ? {}
      : { data: { x: Number(match[2]), y: Number(match[3]) } }),
  });
}

// Each fork is reproduced in the public engine before the fresh agent starts.
// Restore the same experimental starting position if the agent requests a reset.
export function fromSourceFork(engine, entry) {
  function restore() {
    let b = engine.dispatch({
      type: "load",
      code: entry.code,
      level: entry.level,
    });
    if (b.level !== entry.level && b.canSelectLevel)
      b = engine.dispatch({ type: "selectLevel", level: entry.level });
    assert.equal(hash(b), entry.original);
    assert.equal(b.level, entry.level);
    const completed = b.levelsCompleted;
    for (const c of entry.commands) {
      assert.equal(b.state, "NOT_FINISHED");
      assert.ok(b.availableActionIds.includes(Number(c.word[6])));
      assert.equal(hash(b).slice(0, 16), c.from);
      b = dispatchWord(engine, c.word);
      assert.equal(hash(b).slice(0, 16), c.to);
    }
    assert.equal(hash(b), entry.initial);
    assert.equal(b.level, entry.level);
    assert.equal(b.state, "NOT_FINISHED");
    assert.equal(b.levelsCompleted, completed);
    return b;
  }
  return {
    dispatch(request) {
      if (request.type === "load" || request.type === "reset") {
        if (request.type === "load") {
          assert.equal(request.code, entry.code);
          assert.equal(request.level, entry.level);
        }
        return restore();
      }
      return engine.dispatch(request);
    },
  };
}
