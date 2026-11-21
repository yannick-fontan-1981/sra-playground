import { test } from "node:test";
import assert from "node:assert/strict";
import type { NativeObservation } from "../src/logos-engine/v6-native-types.ts";
import type {
  RelativeModel,
  RelativeMemory,
} from "../src/sic/relative-motion-learning.ts";
import { projectContactPreparation } from "../src/sic/contact-preparation.ts";
import {
  continueRelativePlan,
  type RelativeTrial,
} from "../src/sic/relative-motion-plan.ts";

test("two setups predict distinct responses to the same motor, and the next test cites its verified predecessor", () => {
  const model = {
    width: 12,
    measured: {},
    contact: {
      first: "observed-displacement",
      freeWalk: "unprepared-motor",
      longest: 1,
      contradicted: false,
    },
  } as unknown as RelativeModel;
  const floor = new Int8Array(36);
  for (let x = 1; x <= 8; x++) floor[12 + x] = 1;
  const origin = { actor: 14, pieces: [16, 17] },
    goals = new Set([17]),
    motors: [string, number][] = [
      ["forward", 1],
      ["back", -1],
    ];
  const found = projectContactPreparation(
    model,
    origin,
    goals,
    motors,
    floor,
    { remaining: 32 },
    8,
  );
  assert.ok(found);
  const [walk, probe, reuse] = found.steps;
  assert.equal(walk?.next.actor, 15);
  assert.equal(probe?.test?.commonCommand, "forward");
  assert.deepEqual(probe?.test?.selectedPreparation, ["forward"]);
  assert.deepEqual(probe?.test?.comparisonPreparation, []);
  assert.equal(probe?.test?.expectedPiecesMoved, 2);
  assert.equal(probe?.test?.comparisonPiecesMoved, 0);
  assert.equal(probe?.test?.previouslyObservedLength, 1);
  assert.deepEqual(probe?.next, { actor: 16, pieces: [17, 18] });
  assert.deepEqual(reuse?.next, { actor: 17, pieces: [18, 19] });
  const mem: RelativeMemory = { models: { group: model } };
  const trial = {
    model: "group",
    capacity: probe!.test,
    checkingContact: true,
    next: probe!.next,
    route: [reuse],
  } as RelativeTrial;
  const after = { observation_ref: "real-displacement" } as NativeObservation;
  continueRelativePlan(mem, trial, after, true, false);
  assert.equal(mem.active?.capacity?.verifiedUse, "real-displacement");
  const miss: RelativeMemory = { models: { group: model } };
  continueRelativePlan(miss, trial, after, false, false);
  assert.equal(miss.active, undefined);
  assert.equal(miss.verifiedContact, undefined);
  assert.equal(
    projectContactPreparation(
      model,
      origin,
      goals,
      motors,
      floor,
      { remaining: 0 },
      8,
    ),
    null,
  );
  assert.equal(
    projectContactPreparation(
      model,
      origin,
      new Set([13]),
      motors,
      floor,
      { remaining: 32 },
      8,
    ),
    null,
  );
});
