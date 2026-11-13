/** Deterministic public presentations of the retained BranchRouting component corpus.
 * This module reads data only. It imports no engine, runs no oracle or scenario,
 * and produces expected contracts, never qualification evidence.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const FIXTURE = 'tests/fixtures/v6-branch-routing-reference.json';
const FIXTURE_SHA256 = 'e6ae197b7b982bd41f561b9df8e458436d7ce0797f39bbf86d972e55472b6769';
const REFERENCE = '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e';
const SINGLE = 'cold_four_calibrations_move_propagate_epoch';
const TRIPLE = 'cold_equal_cost_select_first_point_bind_move';
const CONTRARY = 'contrary_measured_move_revises_motion';
const SIZE = 64;
const copy = value => structuredClone(value);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonSha256 = value => sha256(JSON.stringify(value));

function scenario(fixture, id) {
  const result = fixture.scenarios.find(row => row.id === id);
  assert.ok(result, `Missing retained scenario: ${id}`);
  return result;
}

function command(action) {
  assert.match(action.action_ref, /^ACTION[1-7]$/);
  return { actionRef: action.action_ref, data: copy(action.data ?? {}) };
}

function expectedCommonCommand(sourceCommand, sourceStep) {
  if (sourceStep.mode !== 'select') return command(sourceCommand);
  // The source corpus supplied (7,13) first in its manual binding list.
  // The retained common-caller contract selects the floor of the box centre.
  // Keep both expectations; this is not a claim that those two clicks agree.
  assert.equal(sourceCommand.action_ref, 'ACTION6');
  const [x0, y0, x1, y1] = sourceStep.box;
  return { actionRef: 'ACTION6', data: { x: Math.floor((x0 + x1) / 2), y: Math.floor((y0 + y1) / 2) } };
}

function pad(rows, label) {
  assert.ok(Array.isArray(rows) && rows.length > 0 && rows.length <= SIZE, label);
  const width = rows[0]?.length;
  assert.ok(Number.isInteger(width) && width > 0 && width <= SIZE, label);
  assert.ok(rows.every(row => Array.isArray(row) && row.length === width
    && row.every(pixel => Number.isInteger(pixel) && pixel >= 0 && pixel <= 15)), label);
  return Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => rows[y]?.[x] ?? 0));
}

function presentFrame(fixture, key) {
  const original = fixture.frames[key];
  assert.ok(original, `Missing retained frame: ${key}`);
  const source = original.public;
  assert.ok(Array.isArray(source.frame_packet) && source.frame_packet.length > 0);
  assert.deepEqual(source.frame_packet.at(-1), source.frame_rows, `${key}: last source animation frame`);
  const sourceFrameSha256 = jsonSha256(source.frame_rows);
  assert.equal(sourceFrameSha256.slice(0, 16), source.frame_hash, `${key}: source frame digest`);
  const frame = pad(source.frame_rows, key);
  const frames = source.frame_packet.map((rows, index) => {
    assert.equal(rows.length, source.frame_rows.length, `${key}: animation height ${index}`);
    assert.equal(rows[0].length, source.frame_rows[0].length, `${key}: animation width ${index}`);
    return pad(rows, `${key}: animation ${index}`);
  });
  assert.deepEqual(frames.at(-1), frame, `${key}: last public animation frame`);
  const availableActionIds = source.available_action_refs.map(ref => {
    assert.match(ref, /^ACTION[1-7]$/);
    return Number(ref.slice('ACTION'.length));
  });
  const observation = {
    frame, frames, availableActionIds,
    state: source.state, level: source.level, levelsCompleted: source.levels_completed,
    stepIndex: source.step_index,
  };
  const frameSha256 = jsonSha256(frame);
  return {
    key, observation,
    sourceDimensions: { width: source.frame_rows[0].length, height: source.frame_rows.length },
    sourceObservationRef: original.observation.observation_ref,
    sourceFrameHash: source.frame_hash, sourceFrameSha256,
    sourceAnimationSha256: jsonSha256(source.frame_packet),
    frameHash: frameSha256.slice(0, 16), frameSha256,
    animationSha256: jsonSha256(frames), observationSha256: jsonSha256(observation),
  };
}

function originalRecords(fixture, id) {
  const source = scenario(fixture, id);
  let proposeStep = null;
  return source.steps.flatMap((record, recordStep) => {
    if (record.operation === 'propose') proposeStep = recordStep;
    if (record.operation !== 'record') return [];
    assert.notEqual(proposeStep, null);
    const proposal = source.steps[proposeStep].result;
    const actionIndex = record.index ?? 0;
    const proposalStep = proposal?.steps[actionIndex];
    assert.ok(proposalStep, `${id}: source proposal for record ${recordStep}`);
    assert.equal(record.result.mode, proposalStep.mode);
    const preceding = source.steps.slice(proposeStep + 1, recordStep);
    const before = preceding.findLast(row => row.operation === 'before'
      && (row.index ?? 0) === actionIndex && row.frame === record.before);
    const after = preceding.findLast(row => row.operation === 'after'
      && (row.index ?? 0) === actionIndex && row.before === record.before && row.after === record.after);
    const afterState = record.afterState;
    return [{
      beforeFrameKey: record.before, afterFrameKey: record.after,
      expectedCommand: expectedCommonCommand(proposal.actions[actionIndex], proposalStep),
      expectedMode: proposalStep.mode,
      source: { scenarioId: id, proposeStep, recordStep, actionIndex, command: copy(proposal.actions[actionIndex]) },
      sourceExpected: {
        proposalStep: copy(proposalStep), recordEvent: copy(record.result),
        afterRecord: {
          epoch: afterState.epoch, motion: copy(afterState.motion), verified: copy(afterState.verified),
          current: copy(afterState.current), finished: afterState.finished, passed: copy(afterState.passed),
          eventCount: afterState.events.length,
        },
        guards: { before: copy(before?.result ?? null), after: copy(after?.result ?? null) },
      },
      prefix: {
        actionIndex, length: proposal.actions.length,
        sealAfterReturn: after?.result.seal_prefix ?? actionIndex + 1 === proposal.actions.length,
      },
    }];
  });
}

function terminalProposal(fixture, row) {
  const source = scenario(fixture, row.source.scenarioId);
  const index = source.steps.findIndex((step, i) => i > row.source.recordStep
    && step.operation === 'propose' && step.frame === row.afterFrameKey);
  assert.ok(index >= 0, `${source.id}: retained proposal after final return`);
  const proposal = source.steps[index].result;
  return {
    source: { scenarioId: source.id, proposeStep: index, frameKey: row.afterFrameKey },
    sourceReturnedNull: proposal === null,
    finalQuestion: proposal === null ? null : {
      expectedCommand: expectedCommonCommand(proposal.actions[0], proposal.steps[0]),
      expectedMode: proposal.steps[0].mode,
      source: { scenarioId: source.id, proposeStep: index, actionIndex: 0, command: copy(proposal.actions[0]) },
      expectedOnly: true, executeInThisCase: false,
    },
  };
}

/**
 * Return unexecuted, detached test inputs and source expectations.
 * The three cases start cold; the contrary case includes four real-return inputs
 * before its retained contrary return. No retained acquisition state is injected.
 * Each .initial and .steps[n].observation is the seven-field public wire packet.
 * sourceExpected contains expectations from the ORIGINAL small component domain,
 * not observed 64x64 results. Consumers must capture their own actual results.
 */
export function buildPublicBranchPresentation({ fixturePath = resolve(ROOT, FIXTURE) } = {}) {
  const bytes = readFileSync(fixturePath);
  assert.equal(sha256(bytes), FIXTURE_SHA256, 'The retained source fixture must remain unchanged');
  const fixture = JSON.parse(bytes);
  assert.equal(fixture.schema, 'logos-engine.v6.branch-routing-reference.v1');
  assert.equal(fixture.referenceCommit, REFERENCE);
  for (const id of [SINGLE, TRIPLE]) {
    assert.equal(scenario(fixture, id).initialStateOrigin.kind, 'cold_original_constructor');
  }
  assert.deepEqual(scenario(fixture, CONTRARY).initialStateOrigin,
    { kind: 'retained_original_acquisition', scenario: SINGLE, stepIndex: 7 });
  // Check the provenance of the splice without restoring either state anywhere.
  assert.deepEqual(scenario(fixture, CONTRARY).initialState, scenario(fixture, SINGLE).steps[7].afterState);
  const single = originalRecords(fixture, SINGLE);
  const triple = originalRecords(fixture, TRIPLE);
  const contrary = originalRecords(fixture, CONTRARY);
  assert.deepEqual([single.length, triple.length, contrary.length], [6, 7, 1]);
  const definitions = [
    { id: 'single-positive', intent: 'positive', records: single },
    { id: 'triple-prefix', intent: 'positive', records: triple },
    { id: 'contrary-return', intent: 'counterexample', records: [...single.slice(0, 4), ...contrary] },
  ];
  const keys = [...new Set(definitions.flatMap(row => row.records.flatMap(step => [step.beforeFrameKey, step.afterFrameKey])))].sort();
  const frames = Object.fromEntries(keys.map(key => [key, presentFrame(fixture, key)]));
  const cases = definitions.map(definition => {
    const first = definition.records[0];
    const source = scenario(fixture, first.source.scenarioId);
    const model = source.steps[first.source.proposeStep].afterState.model;
    assert.deepEqual([model.sign, model.unit, model.limit], [1, 2, 14]);
    const publicLimit = Math.floor(SIZE / model.unit);
    let acquired = 0;
    const steps = definition.records.map((row, index) => {
      if (index > 0) assert.equal(row.beforeFrameKey, definition.records[index - 1].afterFrameKey);
      assert.equal(frames[row.beforeFrameKey].observation.stepIndex, index);
      assert.equal(frames[row.afterFrameKey].observation.stepIndex, index + 1);
      if (row.prefix.sealAfterReturn) acquired = index + 1;
      return {
        ...copy(row), sequence: index + 1,
        observation: copy(frames[row.afterFrameKey].observation),
        prefix: { ...row.prefix, acquiredRecordCountAfterReturn: acquired },
      };
    });
    const terminal = terminalProposal(fixture, definition.records.at(-1));
    return {
      id: definition.id, intent: definition.intent, coldStartRequired: true,
      initialFrameKey: first.beforeFrameKey, initial: copy(frames[first.beforeFrameKey].observation),
      expectedReturnCount: steps.length, steps,
      sourceModel: copy(model),
      presentationBounds: {
        sourceLimit: model.limit, publicLimit,
        sourcePlacementCandidates: model.bars.reduce((n, bar) => n * (model.limit - bar.length + 1), 1),
        publicPlacementCandidates: model.bars.reduce((n, bar) => n * (publicLimit - bar.length + 1), 1),
      },
      sourceTerminalProposal: { source: terminal.source, returnedNull: terminal.sourceReturnedNull },
      finalQuestion: terminal.finalQuestion,
    };
  });
  return {
    schema: 'logos-engine.lot8b.public-branch-presentation.v1',
    status: 'unexecuted_presentation_contract',
    sourceFixture: { path: FIXTURE, bytes: bytes.length, sha256: FIXTURE_SHA256,
      schema: fixture.schema, referenceCommit: fixture.referenceCommit, inputOrigin: copy(fixture.inputOrigin) },
    presentation: {
      kind: 'top_left_anchored_zero_padding', width: SIZE, height: SIZE,
      padding: { color: 0, right: true, bottom: true }, coordinateTranslation: [0, 0],
      animation: 'pad_every_source_frame_and_preserve_last_frame_equality',
      stepIndex: 'preserve_source_sequence_per_case', sourceLimit: 14, publicLimit: 32,
      completeModelIdentityPreserved: false, fullSearchDomainIdentityPreserved: false,
      excludedPresentations: ['mirror', 'transpose', 'mirror_transpose'],
      limitations: [
        'The enlarged limit changes the search domain and offscreen-exit semantics.',
        'Whole-frame hashes, observation references and the background extent change.',
        'Source expectations are not observed public results; the full native factory must qualify them.',
        'A null final source proposal constrains BranchRouting only, not every owner in the full runtime.',
        'The selection source click and common-caller box-centre click are retained separately.',
        'No official score, solved level, whole-caller parity or performance result is claimed.',
      ],
    },
    publicBudgets: { targetLevels: 3, levelActionCaps: [24, 24, 24], maxActions: 72 },
    sourceExpectationContract: {
      frameHashesAndReferences: 'original_domain_only_do_not_compare_verbatim_to_public_packets',
      afterRecordTiming: 'component_record_result_only_compare_after_common_prefix_acquisition',
      prefixCounts: 'expected_common_caller_seal_semantics_not_observed_execution',
      pointRuleOrigin: 'docs/migration/lot8b-evidence/tools/final-functional/branch-common-capture-v2.mjs',
    },
    qualification: {
      publicServiceQualified: false, publicWorkerQualified: false, publicTicketsQualified: false,
      officialPerformanceEligible: false, nativeRuns: 0, originalOraclesExecuted: 0,
      gamePayloadsInterpreted: 0, gameActionsDispatched: 0, acquiredStateInjected: false,
    },
    packetContract: {
      source: 'src/runtime/v6-agent-protocol.ts#V6PublicObservation',
      fields: ['frame', 'frames', 'availableActionIds', 'state', 'level', 'levelsCompleted', 'stepIndex'],
      palette: { minimum: 0, maximum: 15 }, frameHash: 'SHA-256(compact JSON rows), first 16 hexadecimal digits',
      metadataOnWire: false,
    },
    frames, cases,
  };
}
