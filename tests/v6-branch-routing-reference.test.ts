import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { BranchRouting, BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS } from '../src/logos-engine/v6-branch-routing.ts';
import { branchLayout, branchBbox, branchReadState, branchObservedState, branchPropagated } from '../src/logos-engine/v6-branch-routing-geometry.ts';
import { geometricComponents, projection } from '../src/logos-engine/v6-native-observer.ts';
import { motifRowsDigest } from '../src/logos-engine/v6-motif-access-geometry.ts';

type R = Record<string, any>;
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-branch-routing-reference.json', import.meta.url), 'utf8')) as R;
const clone = <T>(value: T): T => structuredClone(value);
const sha = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const frame = (name: string): R => fixture.frames[name];
/** Source JSON representation only; no semantic field, digest or identity is removed. */
const plain = (value: any): any => value === undefined ? null : value instanceof Set ? [...value].sort((a, b) => a - b).map(plain)
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plain(child)])) : value;

test('BranchRouting reference pins the unchanged original and declares its bounded synthetic scope', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.branch-routing-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.deepEqual(fixture.sourceFilesVerifiedBeforeAndAfter, [1786, 1786]);
  assert.equal(fixture.inputOrigin.kind, 'independently_constructed_contract_geometry');
  assert.equal(fixture.inputOrigin.gamePayloadsInterpreted, 0);
  assert.equal(fixture.inputOrigin.gameActionsDispatched, 0);
  assert.equal(fixture.inputOrigin.nativeOracleAnswersInProduction, false);
  assert.match(fixture.normalization.restoreAdapter, /source has no state\/restore API/);
  assert.match(fixture.normalization.counterfactuals, /never claim fresh physical acquisition/);
  assert.match(fixture.qualification, /no game data, live dispatch, original caller integration or solved-level claim/);
  for (const record of [fixture.generator, fixture.sourceManifest]) {
    assert.equal(sha(await readFile(new URL('../' + record.path, import.meta.url))), record.sha256);
  }
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(sha(await readFile(new URL('../reference/v6/' + fixture.referenceCommit + '/source/' + path, import.meta.url))), expected, path);
  }
  for (const name of ['layout', 'bbox', 'read_state', 'observed_state', 'propagated', 'BranchRouting.__init__',
    'BranchRouting.propose', 'BranchRouting.bind', 'BranchRouting.before', 'BranchRouting.after', 'BranchRouting.record']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
  assert.equal(Object.keys(fixture.frames).length, 37);
  assert.equal(fixture.geometry.length, 20);
  assert.equal(fixture.scenarios.length, 12);
  assert.equal(fixture.scenarios.reduce((sum: number, row: R) => sum + row.steps.length, 0), 83);
  assert.ok(fixture.bounds.maximumStatefulOperations <= 100);
});

for (const [name, input] of Object.entries(fixture.frames) as [string, R][]) {
  test('independent BranchRouting observation and frame identity: ' + name, () => {
    const rows = input.public.frame_rows;
    assert.ok(rows.length <= 32 && rows[0].length <= 32);
    const entities = geometricComponents(rows).map(part => ({
      id: part.id, bbox: part.bbox, area: part.area, mask: part.mask, rectangular: part.rectangular,
      palette_value: part.color, position: [part.bbox[0], part.bbox[1]],
    }));
    assert.deepEqual(entities, input.observation.entities);
    assert.equal(sha(JSON.stringify(rows)).slice(0, 16), input.public.frame_hash);
    assert.equal(input.observation.frame_hash, input.public.frame_hash);
    assert.deepEqual(input.public.frame_packet, [rows]);
    assert.deepEqual(input.public.available_action_refs, [...new Set(input.inputs.map((command: R) => command.action_ref))]);
  });
}

for (const row of fixture.geometry as R[]) {
  test('exact pinned BranchRouting geometry ' + row.operation + ': ' + row.id, () => {
    const args = row.arguments, input = args.frame ? frame(args.frame) : null;
    let actual: any;
    switch (row.operation) {
      case 'layout': actual = branchLayout(clone(input!.observation), clone(input!.public.frame_rows), clone(input!.inputs)); break;
      case 'bbox': actual = branchBbox(clone(args.position), args.length, clone(args.model)); break;
      case 'read_state': actual = branchReadState(clone(input!.public.frame_rows), clone(args.model), clone(args.expected)); break;
      case 'observed_state': actual = branchObservedState(clone(input!.observation), clone(args.model), clone(args.prior)); break;
      case 'propagated': actual = branchPropagated(clone(args.starts), clone(args.model), args.withExits); break;
      case 'projection_digest': {
        const rows = projection(clone(input!.public.frame_rows), clone(args.box));
        actual = { rows, digest: motifRowsDigest(rows) }; break;
      }
      default: assert.fail('Unknown source geometry operation: ' + row.operation);
    }
    assert.deepEqual(plain(actual), row.result, 'Complete original result and ordering');
  });
}

for (const bounded of [false, true]) for (const scenario of fixture.scenarios as R[]) {
  test('exact pinned BranchRouting stateful contract [' + (bounded ? 'bounded complete' : 'source exact') + ']: ' + scenario.id, async context => {
    const owner = new BranchRouting(bounded ? { boundedSearch: BRANCH_ROUTING_NATIVE_SEARCH_BOUNDS } : {});
    if (Object.hasOwn(scenario.initialState, 'model')) owner.restore(clone(scenario.initialState));
    assert.deepEqual(owner.state(), scenario.initialState, 'Cold or explicitly declared original retained state');
    let proposal: R | null = null;
    for (const [index, step] of (scenario.steps as R[]).entries()) {
      await context.test(String(index + 1) + ' ' + step.operation, async () => {
        let actual: any;
        switch (step.operation) {
          case 'propose': {
            const input = frame(step.frame);
            actual = proposal = await owner.propose(clone(input.observation), clone(input.public.frame_rows), clone(input.inputs), step.remaining ?? 16);
            assert.equal(owner.currentProposalRefusal(input.observation), null, 'Complete declared small domain has no resource refusal');
            break;
          }
          case 'bind': {
            const input = frame(step.frame);
            const domain = { bindings: new Map([[String(input.observation.level_epoch) + ':' + input.observation.frame_hash,
              new Map(step.records.map((record: R) => [record.point.join(','), clone(record.binding)]))]]) };
            actual = owner.bind(proposal!, domain as any);
            assert.deepEqual(proposal, step.proposalAfter, 'Every bound witness property is preserved');
            break;
          }
          case 'before': {
            const input = frame(step.frame), packet = clone(input.public), observation = clone(input.observation);
            Object.assign(packet, clone(step.publicPatch ?? {}));
            Object.assign(observation, clone(step.observationPatch ?? {}));
            actual = owner.before(proposal!, step.index ?? 0, packet as any, observation); break;
          }
          case 'after': {
            const first = frame(step.before), second = frame(step.after);
            actual = owner.after(proposal!, step.index ?? 0, clone(first.observation), clone(second.observation), clone(first.public.frame_rows), clone(second.public.frame_rows)); break;
          }
          case 'record': {
            const first = frame(step.before), second = frame(step.after), i = step.index ?? 0;
            actual = owner.record(clone(first.observation), clone(second.observation), clone(proposal!.actions[i]),
              clone(first.public.frame_rows), clone(second.public.frame_rows), proposal!, i); break;
          }
          case 'restore': actual = owner.restore(JSON.parse(JSON.stringify(owner.state()))); break;
          default: assert.fail('Unknown source contract operation: ' + step.operation);
        }
        assert.deepEqual(plain(await actual), step.result, 'Every source proposal, guard and acquisition field');
        assert.deepEqual(owner.state(), step.afterState, 'Every persistent source field after this operation');
      });
    }
  });
}

test('source cold chains cover all modes while counterfactuals remain separate from physical acquisition', () => {
  const cold = fixture.scenarios.filter((row: R) => row.initialStateOrigin.kind === 'cold_original_constructor');
  const modes = new Set(cold.flatMap((row: R) => row.steps.filter((step: R) => step.operation === 'propose' && step.result)
    .flatMap((step: R) => step.result.steps.map((s: R) => s.mode))));
  assert.deepEqual([...modes].sort(), ['calibrate', 'move', 'propagate', 'select']);
  const seeds = fixture.scenarios.filter((row: R) => row.initialStateOrigin.kind === 'declared_retained_counterfactual');
  assert.equal(seeds.length, 3);
  assert.ok(seeds.every((row: R) => row.initialStateOrigin.newPhysicalAcquisitionClaim === false));
});
