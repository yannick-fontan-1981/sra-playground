import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ViewFrontier, globalViewRegistration, uniqueViewEntities, viewRectangle, shiftedViewCells, viewMotionKey } from '../src/logos-engine/v6-view-frontier.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-view-reference.json', import.meta.url), 'utf8'));
const cells = (values: [number, number][]) => new Map(values.map(p => [JSON.stringify(p), p]));
const sorted = (value: Map<string, readonly [number, number]>) => [...value.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
async function helper(row: any): Promise<unknown> {
  const a = row.args;
  if (row.operation === 'registration') {
    const one = fixture.scenes[a[0]], two = fixture.scenes[a[1]];
    return globalViewRegistration(one.observation, two.observation, one.rows, two.rows);
  }
  if (row.operation === 'unique') return uniqueViewEntities(fixture.scenes[a[0]].observation);
  if (row.operation === 'rectangle') return sorted(viewRectangle(a[0], a[1], a[2]));
  if (row.operation === 'shifted') return sorted(shiftedViewCells(cells(a[0]), a[1]));
  if (row.operation === 'motion_key') return viewMotionKey(a[0], a[1], a[2], cells(a[3]));
  if (row.operation === 'movement') {
    const result = await ViewFrontier.movement(a[0], fixture.scenes[a[1]].observation);
    return result === null ? null : [result[0], result[1], result[2], sorted(result[3])];
  }
  throw new Error(`Unknown view reference operation: ${row.operation}`);
}
for (const row of fixture.cases) test(`V6 public view helper original parity: ${row.id}`, async () => {
  if (row.error) await assert.rejects(() => helper(row), (e: any) => e.message === row.error);
  else assert.deepEqual(await helper(row), row.expected);
});

async function step(view: ViewFrontier, row: any, saved: Map<string, any>, authority?: 'shadow' | 'active'): Promise<any> {
  const a = row.args;
  if (row.operation === 'initialize') { const s = fixture.scenes[a[0]]; return view.initialize(s.observation, s.rows); }
  if (row.operation === 'has_question') return view.hasObservedViewQuestion();
  if (row.operation === 'propose') { const s = fixture.scenes[a[0]]; return view.propose(s.observation, s.rows, a[1], a[2], a[3], authority); }
  if (row.operation === 'before') {
    const s = fixture.scenes[a[2]], o = s.observation;
    return view.before(saved.get(a[0]), a[1], { level: o.level_epoch, levels_completed: o.levels_completed, available_action_refs: o.available_action_refs } as any, o);
  }
  if (row.operation === 'after') { const b = fixture.scenes[a[2]], c = fixture.scenes[a[3]]; return view.after(saved.get(a[0]), a[1], b.observation, c.observation, b.rows, c.rows); }
  if (row.operation === 'record') { const b = fixture.scenes[a[0]], c = fixture.scenes[a[1]]; return view.record(b.observation, c.observation, a[2], b.rows, c.rows, saved.get(a[3]) ?? {}, a[4]); }
  throw new Error(`Unknown view scenario operation: ${row.operation}`);
}
for (const scenario of fixture.scenarios) test(`V6 public view original sequence with native state replay: ${scenario.id}`, async () => {
  let view = new ViewFrontier(); const saved = new Map<string, any>();
  for (const [index, row] of scenario.steps.entries()) {
    const label = `${scenario.id} ${index}: ${row.operation}`;
    if (row.error) await assert.rejects(() => step(view, row, saved), (e: any) => e.message === row.error, label);
    else { const result = await step(view, row, saved); assert.deepEqual(result ?? null, row.expected, label); if (row.save) saved.set(row.save, structuredClone(result)); }
    assert.deepEqual(view.state(), row.state, `${label} complete memory`);
    const state = view.state(); view = new ViewFrontier(); view.restore(state); assert.deepEqual(view.state(), state, `${label} restored`);
  }
});

test('view-access shadow and active preserve original steps, guards and acquired state', async () => {
  const strategies = new Set<string>();
  for (const mode of ['shadow', 'active'] as const) {
    for (const scenario of fixture.scenarios) {
      const view = new ViewFrontier(), saved = new Map<string, any>();
      for (const row of scenario.steps) {
        if (row.error) {
          await assert.rejects(() => step(view, row, saved, mode), (error: Error) => error.message === row.error);
          continue;
        }
        const result = await step(view, row, saved, mode);
        if (result && row.operation === 'propose') {
          const { sic_view_decision: decision, ...proposal } = result;
          assert.equal(decision.mode, mode);
          assert.equal(decision.strategy, proposal.view_plan.kind);
          assert.equal(decision.objective.parent, proposal.bundle_template.objective_ref);
          assert.match(decision.need.id, /^sic-need:/);
          assert.ok(decision.need.evidence.includes(proposal.binding.observation_ref));
          assert.deepEqual(proposal, row.expected);
          strategies.add(decision.strategy);
        } else if (result?.sic_view_return) {
          const { sic_view_return: returned, ...record } = result;
          assert.equal(mode, 'active');
          assert.equal(returned.evidence, record.after_ref);
          assert.equal(returned.newPixels, row.expected.new_viewport_pixels);
          assert.deepEqual(record, row.expected);
        } else assert.deepEqual(result ?? null, row.expected);
        if (row.save) saved.set(row.save, structuredClone(result));
        assert.deepEqual(view.state(), row.state);
      }
    }
  }
  assert.deepEqual([...strategies].sort(), ['approach_view_edge', 'confirm_access_obstruction',
    'test_change_of_witnessed_obstruction', 'test_reopened_access']);
});
test('V6 public view source remains pinned and observational', async () => {
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${fixture.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
