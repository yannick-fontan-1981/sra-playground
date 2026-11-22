import assert from 'node:assert/strict';
import test from 'node:test';
import { measureNativeObservation, publicFrameHash } from '../src/logos-engine/v6-native-observer.ts';
import { visualLayout } from '../src/sic/witnessed-preview-transfer.ts';
import { newContactMemory } from '../src/sic/contact-frontier.ts';
import { preparedSpatialSeries, spatialStance } from '../src/sic/prepared-spatial-series.ts';
import { preparedExperimentAt } from '../src/sic/prepared-walking-series.ts';
import type { Experiment } from '../src/sic/preparation-experiments.ts';

async function room(actor: number, piece: number, peer = 8) {
  const rows = Array.from({ length: 12 }, (_, y) => Array.from({ length: 24 }, (_, x) => {
    if (Math.floor(y / 2) !== 2) return 0;
    const cell = Math.floor(x / 2);
    return cell === actor ? 7 : cell === piece || cell === peer ? 5 : 0;
  }));
  const o = await measureNativeObservation({ frame_rows: rows, frame_hash: await publicFrameHash(rows), level: 1,
    levels_completed: 0, state: 'NOT_FINISHED', available_action_refs: ['ACTION4', 'ACTION5'] }, 1);
  const role = (col: number) => Object.entries(visualLayout(o, rows)).find(([, bodies]) =>
    bodies.some(b => b.at[0] === col * 4 + 1 && b.at[1] === 9))![0];
  return { o, rows, role };
}

test('two retained pushes check the moving subject, displaced part and stationary peer before continuation', async () => {
  const start = await room(2, 3), role = start.role(3), actor = start.role(2);
  const steps = [2, 3].map(from => ({ op: 'ACTION4', from, to: from + 1, placed: from + 2, role }));
  const t = { actor, role, origin: [1, 9] as const, pitch: [4, 4] as const, width: 12, parts: [3, 8],
    step: steps[0]!, project: { purpose: 'reach_goal' as const, steps, site: 6 },
    ref: start.o.observation_ref, acquired: false, transform: null, previousEntry: null, priorContact: null, terrain: 0 };
  const x: Experiment = { phase: 'investigateContactFrontier', origin: -1, a: 'ACTION4', b: 'ACTION4', refs: [], contactProject: t };
  const memory = newContactMemory();
  assert.equal(preparedSpatialSeries(x, start.o, start.rows, 16, memory), undefined);
  memory.displaced.push(role);
  const series = preparedSpatialSeries(x, start.o, start.rows, 16, memory)!;
  assert.deepEqual(series.map(s => s.kind), ['push', 'push']);
  const ok = await room(3, 4), wrongPart = await room(3, 6), movedPeer = await room(3, 4, 9);
  assert.ok(spatialStance(x, series[0]!, 0, ok.o, ok.rows, true));
  assert.ok(spatialStance(x, series[1]!, 1, ok.o, ok.rows, false));
  for (const bad of [wrongPart, movedPeer])
    assert.equal(spatialStance(x, series[0]!, 0, bad.o, bad.rows, true), false);
  assert.deepEqual(preparedExperimentAt(x, 1, ok.o).contactProject?.parts, [4, 8]);
  assert.equal(preparedSpatialSeries(x, start.o, start.rows, 1, memory), undefined);
  const support: Experiment = { ...x, contactProject: { ...t, project: { ...t.project, purpose: 'test_support' } } };
  assert.equal(preparedSpatialSeries(support, start.o, start.rows, 16, memory)?.length, 2);
  assert.equal(preparedSpatialSeries(support, start.o, start.rows, 16, newContactMemory()), undefined);
  const control = { ...support, contactProject: { ...support.contactProject!, controlRole: role } };
  assert.equal(preparedSpatialSeries(control, start.o, start.rows, 16, memory), undefined);
  const passive: Experiment = { ...x, contactProject: { ...t, transform: 'ACTION5',
    project: { ...t.project, purpose: 'test_passenger', steps: [...steps, {
      from: 4, to: 4, op: 'ACTION5', role, placed: 9, passenger: { source: 5, pushes: ['ACTION4'] },
    }] } } };
  const setup = preparedSpatialSeries(passive, start.o, start.rows, 16, memory);
  assert.deepEqual(setup?.map(s => s.command.action_ref), ['ACTION4', 'ACTION4']);
  assert.equal(preparedSpatialSeries(passive, start.o, start.rows, 16, newContactMemory()), undefined);
  const boundary = { ...x, contactProject: { ...t, project: { ...t.project, steps: [steps[0]!, { ...steps[1]!, boundary: true }] } } };
  assert.equal(preparedSpatialSeries(boundary, start.o, start.rows, 16, memory), undefined);
});
