import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import { measureRadialPorts, radialAtGeometry, radialAssemblyModel, selectedRadialOccurrence, rotateRadialPorts } from '../src/logos-engine/v6-radial-port-observation.ts';
import { RadialPortMemory, radialPortBefore, radialPortAfter, commonRadialPortProposal, bindRadialPort } from '../src/logos-engine/v6-radial-port-access.ts';
import { assemblePorts, type PortModel } from '../src/logos-engine/v6-port-assembly.ts';
import { PointSet, comparePoints } from '../src/logos-engine/v6-point-set.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const root = new URL('../', import.meta.url);
const fixture = JSON.parse(gunzipSync(await readFile(new URL('fixtures/v6-radial-port-reference.json.gz', import.meta.url))).toString()) as R;
const clone = <T>(value: T): T => structuredClone(value);
const hash = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const restored = (events: readonly R[] = []): RadialPortMemory => {
  const memory = new RadialPortMemory();
  for (const event of events) memory.applyEvent(clone(event));
  return memory;
};
function normalized(value: any): any {
  if (value instanceof PointSet) return [...value].sort(comparePoints).map(normalized);
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalized(child)]));
  return value;
}

test('radial reference pins unchanged source, generator and opaque public host assets', async () => {
  assert.equal(fixture.sourceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.qualification.sourceModified, false);
  assert.match(fixture.qualification.realTrajectory, /component only/);
  assert.match(fixture.qualification.importedMethodMode, /use_prior_method=false/);
  const manifest = JSON.parse(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/manifest.json`, root), 'utf8'));
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(hash(await readFile(new URL(`reference/v6/${fixture.sourceCommit}/source/${path}`, root))), expected, path);
    assert.equal(manifest.files[path].sha256, expected, path);
  }
  assert.equal(hash(await readFile(new URL(fixture.generator, root))), fixture.generatorSha256);
  for (const [name, expected] of Object.entries(fixture.gameAssetHashes)) {
    assert.equal(hash(await readFile(new URL(`public/python/${name}`, root))), expected, name);
  }
});

for (const c of fixture.cases as R[]) test(`Python ↔ TypeScript radial port: ${c.id}`, async () => {
  const a = c.arguments, scene = a.scene ? fixture.scenes[a.scene] : null;
  const memory = restored(a.ownEvents), beforeState = memory.currentState();
  const proposal = a.proposal ? clone(fixture.plans[a.proposal]) : null;
  let actual: any;
  switch (c.operation) {
    case 'measure': actual = measureRadialPorts(scene.rows); break;
    case 'at_geometry': actual = radialAtGeometry(scene.rows, clone(a.geometry)); break;
    case 'selected': actual = selectedRadialOccurrence(scene.rows, clone(a.geometry)); break;
    case 'rotate': actual = rotateRadialPorts(a.ports, a.turn); break;
    case 'assembly_model': actual = radialAssemblyModel(clone(a.geometry)); break;
    case 'assembly': {
      const [model, current] = radialAssemblyModel(clone(a.geometry));
      const target = assemblePorts(model as PortModel, current, null, a.sign);
      actual = { target, nodes: model.search_nodes ?? null }; break;
    }
    case 'propose':
      actual = memory.proposeRadial(clone(scene.observation), clone(scene.rows), [], a.remaining,
        { radial_port_composition: clone(a.policy) }, clone(a.parentResult));
      assert.deepEqual(memory.currentState(), beforeState, 'Question construction cannot acquire a radial effect');
      break;
    case 'common_propose':
      actual = await commonRadialPortProposal(memory, clone(scene.observation), clone(scene.rows), [], a.remaining, clone(a.policy), clone(a.parentResult));
      assert.deepEqual(memory.currentState(), beforeState, 'The point wrapper cannot acquire a radial effect');
      break;
    case 'bind': {
      const domain = new ObservedInputDomain(4096);
      if (a.observed) domain.candidates(scene.observation);
      if (c.expected?.rejected) {
        assert.throws(() => bindRadialPort(proposal!, domain), /not currently observed/);
        return;
      }
      bindRadialPort(proposal!, domain); actual = proposal; break;
    }
    case 'before': actual = radialPortBefore(proposal!, a.index, clone(scene.rows), clone(a.meta)); break;
    case 'after': actual = radialPortAfter(proposal!, a.index, clone(fixture.scenes[a.before].rows), clone(fixture.scenes[a.after].rows), clone(a.meta)); break;
    case 'record': {
      const first = fixture.scenes[a.before], second = fixture.scenes[a.after];
      const inputs = [clone(first.observation), clone(a.command), clone(second.observation), clone(first.rows), clone(second.rows), proposal!, a.index] as const;
      const unchanged = clone(inputs);
      const events = memory.record(...inputs);
      assert.deepEqual(inputs, unchanged, 'Acquisition cannot rewrite its input evidence');
      assert.deepEqual(events, c.expected.events);
      assert.deepEqual(memory.currentState(), c.expected.state.projection);
      assert.equal(memory.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest,
        'Exact original own-layer digest around the separately supplied original ancestor digest');
      const rebuilt = restored(memory.currentState().port_events);
      assert.deepEqual(rebuilt.currentState(), memory.currentState());
      assert.equal(rebuilt.retainedDigest(c.expected.state.parentDigest), c.expected.state.digest);
      return;
    }
    default: throw new Error(`Unknown radial contract operation ${c.operation}`);
  }
  assert.deepEqual(normalized(actual), c.expected);
});

test('radial source trajectory remains explicitly an unprimed isolated-component result', () => {
  const run = fixture.realComponent;
  assert.equal(run.sessionCount, 1);
  assert.equal(run.manualPrimingActions, 0);
  assert.match(run.scope, /not full common caller/);
  assert.equal(run.packets.length, run.actions + 1);
  assert.equal(run.targetLevels, 3);
  assert.equal(run.status, 'passed');
  assert.equal(run.levelsCompleted, 3);
  assert.deepEqual(run.boundaries.map((boundary: R) => boundary.levelsCompleted), [1, 2, 3]);
  for (const prefix of run.prefixes) {
    const plan = fixture.plans[prefix.proposal].radial_port_plan;
    if (!plan.point_method_revalidated) assert.equal(plan.steps.length, 1, 'Every unvalidated input relation is a one-action experiment');
    assert.equal(plan.goal_status, 'closed_connected_acyclic_composition_hypothesis_official_terminal_unknown');
  }
});

test('radial memory owns event payloads and exposes no mutable retained state', () => {
  const item = fixture.cases.find((entry: R) => entry.operation === 'record' && entry.expected.events.some((event: R) => event.rule));
  assert.ok(item);
  const memory = new RadialPortMemory(), event = clone(item.expected.events.find((entry: R) => entry.rule));
  memory.applyEvent(event);
  const state = memory.currentState(), revision = memory.nativeRevision, digest = memory.retainedDigest('ancestor');
  event.rule.turn = 99; state.port_point_rule!.turn = 98; state.port_events.splice(0);
  assert.equal(memory.nativeRevision, revision);
  assert.equal(memory.retainedDigest('ancestor'), digest);
  assert.notEqual(memory.currentState().port_point_rule!.turn, 98);
  assert.throws(() => memory.applyEvent({ kind: 'unrelated_event' }), /Outside radial layer/);
});

test('the common radial entry refuses imported action methods and preserves earlier inherited proposals', async () => {
  const scene = fixture.scenes['public:0'], memory = new RadialPortMemory();
  await assert.rejects(() => commonRadialPortProposal(memory, scene.observation, scene.rows, [], 16,
    { ...fixture.policy, use_prior_method: true }), /forbids imported/);
  const earlier = { status: 'proposed', kind: 'earlier_source_question', proposal_id: 'existing' };
  assert.equal(memory.proposeRadial(scene.observation, scene.rows, [], 16,
    { radial_port_composition: fixture.policy }, earlier), earlier);
  assert.equal(await commonRadialPortProposal(memory, scene.observation, scene.rows, [], 16, fixture.policy, earlier), null);
  assert.deepEqual(memory.currentState().port_events, []);
});
