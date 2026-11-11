import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MotifAccess } from '../src/logos-engine/v6-motif-access.ts';
import { motifLattice, motifBody, motifTarget, motifPaths, motifRoute } from '../src/logos-engine/v6-motif-access-geometry.ts';
import { geometricComponents } from '../src/logos-engine/v6-native-observer.ts';

type R = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-motif-access-reference.json', import.meta.url), 'utf8')) as R;
const sha = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const frame = (name: string): R => fixture.frames[name];
const plain = (value: unknown): unknown => value === undefined ? null : value;

test('Motif oracle pins the unmodified original and discloses synthetic scope and state normalization', async () => {
  assert.equal(fixture.schema, 'logos-engine.v6.motif-access-reference.v1');
  assert.equal(fixture.referenceCommit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  assert.equal(fixture.sourceModified, false);
  assert.deepEqual(fixture.sourceFilesVerifiedBeforeAndAfter, [1786, 1786]);
  assert.equal(fixture.inputOrigin.kind, 'independently_constructed_contract_geometry');
  assert.equal(fixture.inputOrigin.gamePayloadsInterpreted, 0);
  assert.equal(fixture.inputOrigin.gameActionsDispatched, 0);
  assert.equal(fixture.inputOrigin.nativeOracleAnswersInProduction, false);
  assert.equal(fixture.inputOrigin.opaqueOriginalManifestIntegrityOnly, true);
  assert.match(fixture.normalization.restoreAdapter, /source has no state\/restore API/);
  assert.match(fixture.normalization.rayCounterfactuals, /never a fresh acquisition claim/);
  assert.match(fixture.qualification, /no game data, live dispatch, original caller integration or solved-level claim/);
  assert.equal(sha(await readFile(new URL('../' + fixture.generator.path, import.meta.url))), fixture.generator.sha256);
  assert.equal(sha(await readFile(new URL('../' + fixture.sourceManifest.path, import.meta.url))), fixture.sourceManifest.sha256);
  const original = new URL('../reference/v6/' + fixture.referenceCommit + '/source/', import.meta.url);
  assert.deepEqual(Object.keys(fixture.sourceHashes).sort(), [
    'agents/yf_arc3_v6/laya_proto/common_motif_access.py',
    'agents/yf_arc3_v6/laya_proto/common_multiscale_constraints.py',
    'agents/yf_arc3_v6/laya_proto/geometric_observer.py',
  ]);
  for (const [path, expected] of Object.entries(fixture.sourceHashes)) {
    assert.equal(sha(await readFile(new URL(path, original))), expected, path);
  }
  for (const name of ['lattice', 'body', 'target', 'paths', 'route', 'MotifAccess.start', 'MotifAccess.bits',
    'MotifAccess.aligned', 'MotifAccess.aim_path', 'MotifAccess.infer_ray', 'MotifAccess.context',
    'MotifAccess.propose', 'MotifAccess.bind', 'MotifAccess.before', 'MotifAccess.after', 'MotifAccess.record']) {
    assert.ok(fixture.executedSourceFunctions.some((row: R) => row.function === name && row.calls > 0), name);
  }
  assert.equal(fixture.geometry.length, 33);
  assert.equal(fixture.scenarios.length, 17);
  assert.equal(fixture.scenarios.reduce((count: number, row: R) => count + row.steps.length, 0), 100);
});

for (const [name, input] of Object.entries(fixture.frames) as [string, R][]) {
  test('independent Motif public entities and frame identity: ' + name, () => {
    const rows = input.public.frame_rows;
    const entities = geometricComponents(rows).map(part => ({
      id: part.id, bbox: part.bbox, area: part.area, rectangular: part.rectangular,
      palette_value: part.color, position: [part.bbox[0], part.bbox[1]],
    }));
    assert.deepEqual(entities, input.observation.entities);
    assert.equal(sha(JSON.stringify(rows)).slice(0, 16), input.public.frame_hash);
    assert.equal(input.observation.frame_hash, input.public.frame_hash);
    assert.deepEqual(input.public.frame_packet, [rows]);
    assert.deepEqual(input.public.available_action_refs,
      [...new Set(input.inputs.map((command: R) => command.action_ref))]);
  });
}

for (const row of fixture.geometry as R[]) {
  test('exact pinned Motif geometry ' + row.operation + ': ' + row.id, async () => {
    const supplied = row.arguments, input = frame(supplied.frame);
    const rows = clone(input.public.frame_rows);
    let actual: unknown;
    switch (row.operation) {
      case 'lattice':
        actual = motifLattice(clone(input.observation), rows, clone(input.inputs)); break;
      case 'body':
        actual = motifBody(rows, supplied.uiTop, clone(supplied.colors), clone(supplied.expected)); break;
      case 'target':
        actual = motifTarget(rows, supplied.uiTop, clone(supplied.colors)); break;
      case 'paths':
      case 'route': {
        const blocked = new Map<string, string>(supplied.blocked.map(([key, digest]: [unknown, string]) =>
          [JSON.stringify(key), digest]));
        actual = row.operation === 'paths'
          ? motifPaths(rows, clone(supplied.body), clone(supplied.motion), supplied.uiTop, blocked)
          : motifRoute(rows, clone(supplied.body), clone(supplied.goal), clone(supplied.motion), supplied.uiTop, blocked);
        break;
      }
      default: assert.fail('Unknown geometry operation: ' + row.operation);
    }
    assert.deepEqual(await actual, row.result, 'Complete original result, including path insertion order');
  });
}

for (const scenario of fixture.scenarios as R[]) {
  test('exact pinned Motif stateful contract: ' + scenario.id, async context => {
    const owner = new MotifAccess();
    if (Object.hasOwn(scenario.initialState, 'grid')) owner.restore(clone(scenario.initialState));
    assert.deepEqual(owner.state(), scenario.initialState,
      'Cold construction or explicitly declared synthetic restoration matches every source field');
    let proposal: R | null = null;
    for (const [index, step] of (scenario.steps as R[]).entries()) {
      await context.test(String(index + 1) + ' ' + step.operation, async () => {
        let actual: unknown;
        switch (step.operation) {
          case 'propose': {
            const input = frame(step.frame);
            actual = proposal = await owner.propose(clone(input.observation), clone(input.public.frame_rows),
              clone(input.inputs), step.remaining ?? 16);
            break;
          }
          case 'bind': {
            const input = frame(step.frame);
            const domain = { bindings: new Map([[String(input.observation.level_epoch) + ':' + input.observation.frame_hash,
              new Map(step.records.map((record: R) => [record.point.join(','), clone(record.binding)]))]]) };
            actual = owner.bind(proposal!, domain as any);
            assert.deepEqual(proposal, step.proposalAfter, 'All bound witness properties are preserved');
            break;
          }
          case 'before': {
            const input = frame(step.frame), packet = clone(input.public), observation = clone(input.observation);
            Object.assign(packet, clone(step.publicPatch ?? {}));
            Object.assign(observation, clone(step.observationPatch ?? {}));
            actual = owner.before(proposal!, step.index ?? 0, packet as any, observation);
            break;
          }
          case 'after': {
            const first = frame(step.before), second = frame(step.after);
            actual = owner.after(proposal!, step.index ?? 0, clone(first.observation), clone(second.observation),
              clone(first.public.frame_rows), clone(second.public.frame_rows));
            break;
          }
          case 'record': {
            const first = frame(step.before), second = frame(step.after), i = step.index ?? 0;
            actual = owner.record(clone(first.observation), clone(second.observation), clone(proposal!.actions[i]),
              clone(first.public.frame_rows), clone(second.public.frame_rows), proposal!, i,
              (step.frames ?? []).map((name: string) => clone(frame(name).public.frame_rows)));
            break;
          }
          case 'restore':
            actual = owner.restore(JSON.parse(JSON.stringify(owner.state()))); break;
          case 'bits':
            actual = owner.bits(clone(frame(step.frame).public.frame_rows)); break;
          case 'context':
            actual = owner.context(clone(frame(step.frame).public.frame_rows), clone(step.expected ?? null)); break;
          case 'aligned':
            actual = owner.aligned(clone(step.position), step.size, step.key, clone(step.receiver)); break;
          default: assert.fail('Unknown source contract operation: ' + step.operation);
        }
        assert.deepEqual(plain(await actual), step.result,
          'Compare every proposal/guard/event field without identity or digest exemptions');
        assert.deepEqual(owner.state(), step.afterState,
          'Compare every persistent source attribute after this operation');
      });
    }
  });
}

test('fixture explicitly exercises causal limits, full cold chain and retained epoch memory', () => {
  const cold = fixture.scenarios.find((row: R) => row.id === 'cold_calibrate_toggle_invoke_effect_access_epoch');
  const proposals = cold.steps.filter((step: R) => step.operation === 'propose' && step.result).map((step: R) => step.result);
  assert.deepEqual(proposals.map((value: R) => value.steps[0].mode), ['calibrate', 'toggle', 'invoke', 'walk', 'walk', 'toggle']);
  assert.equal(cold.steps[10].result.reason, 'compare_predicted_bit_or_body_effect');
  assert.equal(cold.steps[11].result.status, 'public_response');
  assert.equal(cold.steps[11].result.grid_cleared, true);
  assert.equal(cold.steps[11].afterState.passed.length, 0, 'Plausible access effect is not official completion');
  const epoch = cold.steps[25].afterState;
  assert.equal(epoch.epoch, 2);
  assert.deepEqual(epoch.motion, { ACTION4: [2, 0] });
  assert.equal(epoch.learned.length, 1);
  assert.deepEqual(epoch.selected, [1, 2], 'Unlearned card precedes learned card on a new scope');
  assert.deepEqual(epoch.tried, []);
  assert.deepEqual(epoch.seen, []);
  assert.deepEqual(epoch.verified, []);
  assert.equal(cold.steps[27].afterState.grid, null);
  assert.equal(cold.steps[27].afterState.ui_top, epoch.ui_top, 'Original stale field retention is represented exactly');
  const zero = fixture.scenarios.find((row: R) => row.id === 'remaining_zero_is_caller_boundary_not_source_calibration');
  assert.equal(zero.steps[0].result.steps.length, 1);
  assert.equal(zero.steps[0].result.steps[0].mode, 'calibrate');
  assert.equal(zero.steps[2].result, null);
  const far = fixture.scenarios.find((row: R) => row.id === 'long_measured_route_caps_at_sixteen');
  assert.equal(far.steps[0].result.steps.length, 16);
  assert.equal(far.steps[2].result.steps.length, 1);
  assert.equal(far.steps[3].result, null);
  const missing = fixture.scenarios.find((row: R) => row.id === 'invoke_unmeasurable_body_is_source_body_change_true');
  assert.equal(missing.steps[10].afterState.learned[0][1].body_change, true);
  assert.equal(missing.steps[10].result.after, null);
  const contrary = fixture.scenarios.find((row: R) => row.id === 'toggle_contrary_effect_retires_owner');
  assert.equal(contrary.steps[4].result.status, 'grid_effect_refuted');
  assert.equal(contrary.steps[6].result, null);
  const official = fixture.scenarios.find((row: R) => row.id === 'guards_and_official_boundary_are_separate_from_geometry');
  for (const index of [8, 9, 10]) assert.deepEqual(official.steps[index].result,
    { matched: null, seal_prefix: true, reason: 'official_boundary' });
  assert.equal(official.steps[11].result.status, 'official_boundary');
  assert.equal(official.steps[11].afterState.passed.length, 1);
  const emptyPath = fixture.geometry.find((row: R) => row.operation === 'route' &&
    JSON.stringify(row.arguments.goal) === '[3,4,4,5]');
  assert.deepEqual(emptyPath.result, []);
  const aimed = fixture.scenarios.find((row: R) => row.id === 'empty_aim_path_falls_back_to_card_not_official_success');
  assert.equal(aimed.steps[0].result.steps[0].mode, 'toggle');
  assert.equal(aimed.steps[0].afterState.passed.length, 0);
});
