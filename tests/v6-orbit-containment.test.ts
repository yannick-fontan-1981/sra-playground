import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { OrbitConstraints, orbitSilhouette, orbitHull, orbitCycles, measureOrbitField, orbitValues, fitOrbit, orbitRoute } from '../src/logos-engine/v6-orbit-constraints.ts';
import { Containment, containmentNeighborhood, fillContainmentSupport, measureContainmentScene, containmentContactPose,
  measureContainmentPositions, containmentAdd, containmentDistance } from '../src/logos-engine/v6-containment.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

const reference = JSON.parse(await readFile(new URL('./fixtures/v6-orbit-containment-reference.json', import.meta.url), 'utf8'));
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const pointKey = (value: unknown) => JSON.stringify(value);

async function executeCase(sample: any): Promise<unknown> {
  const a = sample.arguments, scene = reference.scenes[a.scene];
  if (sample.family === 'orbit') switch (sample.operation) {
    case 'silhouette': return orbitSilhouette(a.entity);
    case 'hull': return orbitHull(a.positions);
    case 'cycles': return orbitCycles(a.positions);
    case 'field': {
      const field = measureOrbitField(scene.observation, scene.inputs);
      return field ? { positions: field.positions, size: field.size, targets: [...field.targets], controls: [...field.controls.values()].map(v => [v.key, v]) } : null;
    }
    case 'values': return orbitValues(scene.rows, a.positions, a.size);
    case 'fit': return fitOrbit(a.before, a.after, a.contours);
    case 'route': return orbitRoute(a.values, new Map(a.targets), new Map(a.operators.map(([key, permutation]: any) => [pointKey(key), { key, permutation }])), a.budget);
  }
  if (sample.family === 'containment') switch (sample.operation) {
    case 'scene': return measureContainmentScene(scene.observation, scene.rows);
    case 'neighborhood': return containmentNeighborhood(a.mask);
    case 'filled': return fillContainmentSupport(a.mask, a.width, a.height);
    case 'contact_pose': return containmentContactPose(scene.rows, a.bodies, a.predicted);
    case 'measured_positions': return measureContainmentPositions(scene.rows, a.bodies, a.prior);
    case 'add': return containmentAdd(a.point, a.delta);
    case 'distance': return containmentDistance(a.first, a.second);
  }
  throw new Error(`Unknown original case: ${sample.family}/${sample.operation}`);
}

for (const sample of reference.cases) test(`original V6 ${sample.family} helper parity: ${sample.id}`, async () => {
  if (sample.error) await assert.rejects(() => executeCase(sample), (error: unknown) => error instanceof Error && error.message === sample.error);
  else assert.deepEqual(plain(await executeCase(sample)), sample.expected);
});

for (const scenario of reference.scenarios) test(`original V6 ${scenario.family} complete memory parity: ${scenario.id}`, async () => {
  let memory: OrbitConstraints | Containment = scenario.family === 'orbit' ? new OrbitConstraints() : new Containment();
  let proposal: any = null, domain: ObservedInputDomain | null = null;
  for (const [ordinal, sample] of scenario.steps.entries()) {
    const op = sample.operation;
    const execute = async (): Promise<unknown> => {
      if (op.kind === 'propose') {
        const scene = reference.scenes[op.scene]; domain = new ObservedInputDomain(4096);
        const inputs = domain.candidates(scene.observation);
        proposal = await memory.propose(scene.observation, scene.rows, op.inputs ?? inputs, op.remaining ?? 100);
        return proposal;
      }
      if (op.kind === 'bind') { memory.bind(proposal, domain!); return proposal; }
      if (op.kind === 'before') return memory.before(proposal, op.index ?? 0, reference.scenes[op.scene].public, reference.scenes[op.observation ?? op.scene].observation);
      if (op.kind === 'after' || op.kind === 'record') {
        const before = reference.scenes[op.before], after = reference.scenes[op.after], index = op.index ?? 0;
        if (op.kind === 'after') return memory.after(proposal, index, before.observation, after.observation, before.rows, after.rows);
        return memory.record(before.observation, after.observation, op.command ?? proposal.actions[index], before.rows, after.rows, proposal, index);
      }
      if (op.kind === 'helper' && memory instanceof Containment) switch (op.function) {
        case 'graph': return [...memory.graph(op.index, op.positions, op.ignore).values()].map(value => [value.point, value.path]);
        case 'select': return memory.select(op.index, op.positions, reference.scenes[op.scene].inputs);
        case 'walk': return memory.walk(op.index, op.path, op.positions);
        case 'choices': return memory.choices(reference.scenes[op.scene].observation, reference.scenes[op.scene].inputs);
        case 'footprint': return [...memory.footprint(op.index, op.position).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        case 'region': return [...memory.region(op.index, op.goal).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      }
      throw new Error(`Unknown family operation: ${JSON.stringify(op)}`);
    };
    let actual: any;
    try { actual = { result: plain(await execute()), state: memory.state() }; }
    catch (error) { actual = { error: error instanceof Error ? error.message : String(error), state: memory.state() }; }
    assert.deepEqual(plain(actual), sample.expected, `${scenario.id}, step ${ordinal + 1}: ${op.kind}`);
    // Exercise the same persistence boundary as the native V7 authoritative
    // store: every next operation starts with a fresh restored family object.
    const restored = scenario.family === 'orbit' ? new OrbitConstraints() : new Containment();
    restored.restore(memory.state());
    assert.deepEqual(restored.state(), memory.state());
    memory = restored;
  }
});

test('both family native states round-trip before observation and reject another format', () => {
  for (const memory of [new OrbitConstraints(), new Containment()]) {
    const state = memory.state(); memory.restore(state); assert.deepEqual(memory.state(), state);
    assert.throws(() => memory.restore({ ...state, format: 'unrelated' }), /Incompatible/);
  }
});

test('oracle invokes every named original orbit/containment function and pins exact source bytes', async () => {
  assert.deepEqual(reference.coveredSourceFunctions.orbit, ['__init__', 'after', 'before', 'bind', 'cross', 'cycles', 'field', 'fit', 'half', 'hull', 'propose', 'record', 'route', 'silhouette', 'values']);
  assert.deepEqual(reference.coveredSourceFunctions.containment, ['__init__', '_region', 'add', 'after', 'assign', 'assign_cost', 'before', 'bind', 'choices', 'contact_pose', 'distance', 'filled', 'footprint', 'graph', 'measured_positions', 'neighborhood', 'propose', 'record', 'scene', 'select', 'start', 'walk']);
  for (const [path, expected] of Object.entries(reference.sourceHashes)) {
    const bytes = await readFile(new URL(`../reference/v6/${reference.commit}/source/${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected);
  }
});
