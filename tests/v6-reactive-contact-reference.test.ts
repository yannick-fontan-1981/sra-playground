import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { ReactiveContactPolicy, REACTIVE_CONTACT_POLICY_SUBSET } from '../src/logos-engine/v6-reactive-contact-policy.ts';
import * as geometry from '../src/logos-engine/v6-reactive-contact-geometry.ts';
import { measure_reactive_pursuit_observation } from '../src/logos-engine/v6-reactive-contact-measurements.ts';
import { supportCompare } from '../src/logos-engine/v6-support-measurements.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v6-reactive-contact-reference.json.gz', import.meta.url))).toString());
const policy = ReactiveContactPolicy.create();
const plain = (value: any): any => value instanceof Set ? [...value].sort(supportCompare) : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

test('reactive source projection subset and pinned originals retain exact bytes', () => {
  const root = new URL('../reference/v6/' + fixture.referenceCommit + '/source/', import.meta.url);
  for (const [path, hash] of Object.entries(fixture.sourceHashes)) assert.equal(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex'), hash);
  const original = JSON.parse(readFileSync(new URL('agents/yf_arc3_v5/drm/interaction.drm', root), 'utf8'));
  const expected = Object.fromEntries(original.declarations.flatMap((d: any) => d.fact_projections ?? []).filter((p: any) => Object.hasOwn(REACTIVE_CONTACT_POLICY_SUBSET.projections, p.id)).map((p: any) => [p.id, p]));
  assert.deepEqual(REACTIVE_CONTACT_POLICY_SUBSET.projections, expected);
});

for (const row of fixture.cases) test('reactive unchanged Python ' + row.id, async () => {
  const args = structuredClone(row.arguments); let actual: any;
  const execute = async () => {
    const p = await policy;
    if (['bind_control', 'choose', 'contact', 'ready_operator', 'source81_entry'].includes(row.operation)) return (p as any)[row.operation](args);
    if (row.operation === 'reconcile_binding') return p.reconcile_binding(args.facts, args.receipt);
    if (row.operation === 'relative') return geometry.relative(args.before, args.after, args.first, args.second, args.core, args.quantum);
    if (row.operation === 'scene') return { scene: geometry.scene(args.obs, args.rows, args.control, args.peer, args.floor), control: args.control };
    if (row.operation === 'current_body_box') return geometry.current_body_box(args.rows, args.body);
    if (row.operation === 'current_member_scene') return geometry.current_member_scene(args.rows, args.offer, args.expected_part);
    if (row.operation === 'routes') return geometry.routes(args.scene, args.directions, args.excluded);
    if (row.operation === 'support_collisions') return geometry.support_collisions(args.carrier, args.part, new Map(args.terrain.map(([point, value]: any[]) => [point.join(','), value])), args.obstacles, args.extra);
    if (row.operation === 'candidate_grasp_roots') return geometry.candidate_grasp_roots(args.carrier_offsets, args.part_cells, args.vectors, args.maximum_evaluations);
    if (row.operation === 'pursuit') return measure_reactive_pursuit_observation({ frame: args.rows, ...args.fields }, args.options);
    throw new Error('Unmapped original test operation: ' + row.operation);
  };
  if (row.error) {
    await assert.rejects(execute, (error: Error) => error.name === row.error.name);
    return;
  }
  actual = plain(await execute());
  if (['bind_control', 'choose', 'contact', 'ready_operator', 'source81_entry', 'reconcile_binding'].includes(row.operation)) {
    assert.deepEqual(actual, row.value);
  } else assert.deepEqual(actual, row.value);
});

test('reactive policy outputs do not share caller or source mutable state', async () => {
  const p = await policy, original = fixture.cases.find((c: any) => c.id === 'binding:valid');
  const request = structuredClone(original.arguments), [result] = await p.reconcile_binding(request.facts, request.receipt);
  assert.throws(() => { result.claim.receipt.body_delta_xy[0] = 999; }, TypeError);
  const detached = structuredClone(result); detached.claim.receipt.body_delta_xy[0] = 999;
  assert.deepEqual(request, original.arguments);
  assert.deepEqual((await p.reconcile_binding(request.facts, request.receipt))[0], original.value[0]);
});
