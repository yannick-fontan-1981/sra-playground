import assert from "node:assert/strict";
import test from "node:test";
import type { NativeObservation } from "../src/logos-engine/v6-native-types.ts";
import {
  destinations,
  fitReach,
  poseKey,
  type RelativeModel,
  type GroupPose,
} from "../src/sic/relative-motion-learning.ts";
import { chooseRelativePlan } from "../src/sic/relative-motion-plan.ts";

const model = (): RelativeModel => ({
  actor: "walker",
  partner: "stone",
  pitch: 2,
  origin: [0, 0],
  width: 6,
  height: 6,
  goals: { exit: [8] },
  moves: { up: -6, down: 6, left: -1, right: 1 },
  samples: [],
  measured: {},
  playerTerrain: {},
  positive: 8,
  contrasts: 2,
  blocked: 2,
  invalid: 0,
  first: "t1",
  last: "t9",
  differingRef: "t5",
  blockedRef: "t8",
});
test("a formerly mobile destination separates range from a wall and estimates reach from observations", () => {
  const m = model();
  m.width = 12;
  for (const [p, q, d, moved] of [
    [25, 39, 40, 1],
    [13, 39, 40, 0],
    [26, 39, 40, 1],
    [30, 42, 43, 0],
  ] as const)
    m.samples.push({ p, q, destination: d, moved: !!moved, clear: true });
  assert.deepEqual(fitReach(m), {metric:'diamond',radius:3,disagreements:0,evidence:3});
  // The remote, never entered destination does not supply a negative range example.
  assert.deepEqual(
    destinations([20, 21], [21, 22], 1),
    new Map([
      [21, 22],
      [20, 21],
    ]),
  );
  assert.deepEqual(
    destinations([20, 21], [20, 21], 1),
    new Map([
      [21, 21],
      [20, 20],
    ]),
  );
});
test("backchain from a goal and change the relative vector using a wall; the live movement is verified independently", () => {
  const m = model(),
    grid = [
      [0, 2],
      [0, 3],
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
      [3, 0],
      [3, 2],
      [3, 3],
    ];
  const cell = (x: number, y: number) => (y + 1) * 6 + x + 1,
    free = new Set(grid.map(([x, y]) => cell(x!, y!)));
  const rows = Array.from({ length: 4 }, (_, y) =>
    Array.from({ length: 4 }, (_, x) => (free.has(cell(x, y)) ? 0 : 4)),
  );
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++)
      m.playerTerrain[cell(x, y)] = {
        open: free.has(cell(x, y)),
        texture: String(rows[y]![x]),
      };
  const render = (p: number) => ({
    at: [((p % 6) - 1) * 2, (Math.floor(p / 6) - 1) * 2] as [number, number],
    box: [0, 0, 0, 0],
    form: "observed",
  });
  const goal = cell(1, 0);
  m.goals.exit = [goal];
  let s: GroupPose = { actor: cell(3, 0), pieces: [cell(2, 0)] };
  let witnessed = false;
  for (let n = 0; n < 8 && s.actor !== goal; n++) {
    const obs = {
      available_action_refs: Object.keys(m.moves),
      observation_ref: "test" + n,
    } as NativeObservation;
    const trial = chooseRelativePlan(
      { models: { e: m } },
      {
        walker: [render(s.actor)],
        stone: s.pieces.map(render),
        exit: [render(goal)],
      },
      obs,
      rows,
      { exit: "score" },
      { maxDepth: 16, maxNodes: 150 },
    );
    assert.ok(trial);
    if (!n) {
      assert.equal(trial.objective.rigidRoute, false);
      assert.ok(trial.desired);
      assert.equal(trial.desired.cause, "blocked_translation");
    }
    const d = m.moves[trial.op]!,
      p = s.pieces[0]!,
      q = free.has(p + d) ? p + d : p;
    const landed =
      free.has(s.actor + d) && q !== s.actor + d ? s.actor + d : s.actor;
    assert.notEqual(landed, s.actor);
    witnessed ||= q === p;
    s = { actor: landed, pieces: [q] };
    assert.equal(poseKey(trial.next), poseKey(s));
  }
  assert.equal(s.actor, goal);
  assert.equal(witnessed, true);
});
