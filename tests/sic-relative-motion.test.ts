import assert from "node:assert/strict";
import test from "node:test";
import { splitNativeState } from "../src/logos-engine/v6-native-state-graph.ts";
import type { NativeObservation } from "../src/logos-engine/v6-native-types.ts";
import {
  destinations,
  observeRelativeMotion,
  fitReach,
  poseKey,
  type RelativeModel,
  type GroupPose,
} from "../src/sic/relative-motion-learning.ts";
import {
  chooseRelativePlan,
  continueRelativePlan,
} from "../src/sic/relative-motion-plan.ts";
import type { TerminalContact } from "../src/sic/terminal-contact.ts";
import type { PartMotion } from "../src/sic/controlled-parts.ts";
import type { RelativeMemory } from "../src/sic/relative-motion-learning.ts";
test("a verified motor from another room can be tried before the pair has used it in this one", () => {
  const previous: PartMotion = {
    sites: {},
    substrate: {},
    axes: {
      ACTION1: {
        "0,-2": { d: [0, -2], count: 3, first: "prior-up", last: "c" },
      },
      ACTION4: {
        "2,0": { d: [2, 0], count: 3, first: "prior-right", last: "d" },
      },
    },
  };
  const rows = Array.from({ length: 7 }, () => Array(8).fill(0));
  const part = (x: number, y: number) => ({
    at: [2 * x, 2 * y] as [number, number],
    box: [x, y, x, y],
    form: "observed",
  });
  const observation = (ref: string) =>
    ({
      observation_ref: ref,
      frame_hash: ref,
      state: "NOT_FINISHED",
      level_epoch: 2,
      available_action_refs: ["ACTION1", "ACTION4"],
    }) as NativeObservation;
  const witnesses = [
    {
      actor: "actor",
      marker: "marker",
      pitch: [2, 2],
      offset: [0, 0],
    } as TerminalContact,
  ];
  const state: RelativeMemory = { models: {} };
  observeRelativeMotion(
    state,
    witnesses,
    observation("a"),
    observation("b"),
    rows,
    { actor: [part(1, 3)], piece: [part(2, 4)], marker: [part(5, 4)] },
    { actor: [part(2, 3)], piece: [part(3, 4)], marker: [part(5, 4)] },
    "ACTION4",
    { actor: previous },
  );
  const m = Object.values(state.models)[0]!;
  assert.equal(m.moves.ACTION1, -m.width);
  assert.equal(m.inheritedMoves?.ACTION1, "prior-up");
  assert.equal(m.inheritedMoves?.ACTION4, undefined);
});

test("the first observed push can be contrasted immediately with an earlier walk past stationary pieces", () => {
  const part = (x: number, y: number) => ({
    at: [2 * x, 2 * y] as [number, number],
    box: [x, y, x, y],
    form: "piece",
  });
  const scene = (actor: number, boxes: number[]) => ({
    actor: [part(actor, 1)],
    boxes: boxes.map((x) => part(x, 1)),
    exit: [part(7, 2)],
  });
  const state = (n: number) =>
    ({
      observation_ref: "state-" + n,
      level_epoch: 2,
      state: "NOT_FINISHED",
      available_action_refs: ["ACTION4"],
    }) as NativeObservation;
  const rows = Array.from({ length: 4 }, () => Array(9).fill(2)),
    witness = {
      actor: "actor",
      marker: "exit",
      pitch: [2, 2],
      offset: [0, 0],
    } as TerminalContact;
  const mem: RelativeMemory = { models: {} };
  observeRelativeMotion(
    mem,
    [witness],
    state(0),
    state(1),
    rows,
    scene(1, [3, 4]),
    scene(2, [3, 4]),
    "ACTION4",
  );
  assert.equal(Object.keys(mem.models).length, 0);
  observeRelativeMotion(
    mem,
    [witness],
    state(1),
    state(2),
    rows,
    scene(2, [3, 4]),
    scene(3, [4, 5]),
    "ACTION4",
  );
  const learned = mem.models["actor/boxes/2"]!;
  assert.equal(learned.contact?.first, "state-2");
  assert.equal(learned.contact?.freeWalk, "state-1");
  assert.equal(learned.contact?.latestDisplacement, "state-2");
  assert.equal(learned.contact?.longest, 2);
});
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
  assert.deepEqual(fitReach(m), {
    metric: "diamond",
    radius: 3,
    disagreements: 0,
    evidence: 3,
  });
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
  const memory: RelativeMemory = { models: { e: m } };
  let witnessed = false;
  for (let n = 0; n < 8 && s.actor !== goal; n++) {
    const obs = {
      available_action_refs: Object.keys(m.moves),
      observation_ref: "test" + n,
    } as NativeObservation;
    const trial = chooseRelativePlan(
      memory,
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
    assert.doesNotThrow(() => splitNativeState(trial, "relative-plan"));
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
    if (n > 0) assert.equal(trial.predictions, 0);
    const returned = { ...obs, observation_ref: "test" + (n + 1) };
    continueRelativePlan(memory, trial, returned, true, landed === goal);
    if (!n) {
      const rejected: RelativeMemory = { ...memory };
      continueRelativePlan(rejected, trial, returned, false, false);
      assert.equal(rejected.active, undefined);
    }
  }
  assert.equal(s.actor, goal);
  assert.equal(witnessed, true);
});
