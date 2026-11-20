import test from 'node:test';
import assert from 'node:assert/strict';
import { observedEdit, projectEdit, imageKey } from '../src/sic/relative-edits.ts';
import { transferDisplacement } from '../src/sic/instrument-sites.ts';
import { compareSiteArms } from '../src/sic/instrument-experiment.ts';
import { newRetainedMemory, recordRetained, type RetainedTrial } from '../src/sic/retained-edits.ts';
import type { Memory } from '../src/sic/preparation-experiments.ts';
import type { NativeObservation } from '../src/logos-engine/v6-native-types.ts';
import type { XY } from '../src/sic/access-terrain.ts';

test('retaining a preparation-independent edit predicts the return before the inverse is executed', () => {
  const root = [[1, 0, 0, 0]],
    site = [[0, 1, 0, 0]],
    operand = [[0, 1, 0, 2]],
    destination = [[1, 0, 0, 2]];
  const m = {
    retained: newRetainedMemory(),
    turns: 15,
    edges: [
      { ref: 2, s: 0, t: 1, cmd: 'A', stable: true, manipulation: { edit: observedEdit(root, site) } },
      { ref: 3, s: 0, t: 0, cmd: 'B', stable: true },
      { ref: 4, s: 1, t: 0, cmd: 'U', stable: true },
      { ref: 5, s: 0, t: 0, cmd: 'C', stable: true },
    ],
  } as unknown as Memory;
  const start: RetainedTrial = {
    entry: {
      origin: 0,
      site: 1,
      a: { cmd: 'A', ref: 2 },
      b: { cmd: 'B', ref: 3 },
      undo: [{ cmd: 'U', ref: 4 }],
    },
    index: 0,
    prediction: null,
  };
  const at = (revision: number) =>
    ({ level_epoch: 'e', state: 'PLAYING', levels_completed: 0, revision }) as NativeObservation;
  const probe = recordRetained(m, start, at(6), at(7), site, operand, 2);
  assert.equal(probe.detail.forecast?.image, imageKey(destination));
  const returning = m.retained!.active!;
  assert.equal(
    recordRetained(m, returning, at(7), at(8), operand, destination, 3).result,
    'retained_landing_verified'
  );
  assert.equal(m.retained!.active!.prediction!.use, 'C');
  assert.equal(
    recordRetained(m, returning, at(7), at(8), operand, root, 0).result,
    'retained_landing_refuted'
  );
  assert.equal(m.retained!.active, null);
});
test('strict inversion rejects a foreign image and calibrated displacements rotate with the control', () => {
  const change = observedEdit([[0, 1]], [[1, 0]])!;
  assert.equal(projectEdit([[1, 4]], change, { reverse: true, strict: true }), null);
  const fact = { ref: 9, driver: true, control: [2, 0] as XY, delta: [0, 4] as XY, setup: [0, 0] as XY };
  assert.deepEqual(transferDisplacement(fact, [0, 2]), [-4, 0]);
});
test('a new endpoint after binding is only a capacity if the exercise itself moves the tracked role', () => {
  const origin: XY = [2, 1],
    site: XY = [4, 1],
    end: XY = [8, 1],
    target: XY = [0, 3];
  const arm = (a: XY, b: XY) => ({
    ref: 8,
    scene: 2,
    from: [a, target] as [XY, XY],
    to: [b, target] as [XY, XY],
  });
  const bare = arm(origin, origin);
  assert.equal(compareSiteArms(bare, arm(site, site)).displacedDriver, false);
  assert.equal(compareSiteArms(bare, arm(site, end)).displacedDriver, true);
  assert.equal(compareSiteArms(bare, arm(origin, end)).driver, true);
});
