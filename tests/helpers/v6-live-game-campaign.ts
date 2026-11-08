/** Real games stay in the outer host; SRA receives only browser-public packets. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { loadPyodide } from '../../public/vendor/pyodide/pyodide.mjs';
import { BrowserV6Agent } from '../../src/runtime/v6-agent.ts';
import { V6AgentService } from '../../src/runtime/v6-agent-service.ts';
import { V6_REFERENCE_COMMIT, toV6PublicObservation } from '../../src/runtime/v6-agent-protocol.ts';
import { createNativeV6Runtime } from '../../src/logos-engine/v6-native-runtime.ts';
import { hydrateNativeState } from '../../src/logos-engine/v6-native-state-graph.ts';
import type { NativeV6Declarations } from '../../src/logos-engine/v6-native-runtime.ts';
import type { NativeCommand, NativePublicObservation } from '../../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../../src/runtime/browser-games.ts';
import type { V6AgentResult, V6AgentTransport, V6PublicObservation } from '../../src/runtime/v6-agent-protocol.ts';

type R = Record<string, any>;
const ROOT = new URL('../../', import.meta.url);
const COMPONENTS = ['goal', 'frontier', 'view', 'attention', 'points', 'displays', 'controls', 'counters'];
const PUBLIC_KEYS = ['availableActionIds', 'frame', 'frames', 'level', 'levelsCompleted', 'state', 'stepIndex'];
const hash = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');
export interface NativeGameCampaignOptions {
  gameCode: string;
  targetLevels: number;
  progress?: (event: R) => void;
  /** Evidence sink only; returned values never enter the production agent. */
  publicTrace?: (packet: NativePublicObservation, command: NativeCommand | null) => void;
}

async function nativeSourceManifest(): Promise<R> {
  const files: Record<string, string> = {};
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(new URL(path, ROOT), { withFileTypes: true })) {
      const name = `${path}/${entry.name}`;
      if (entry.isDirectory()) await walk(name);
      else if (/\.(?:ts|json|drm)$/.test(entry.name)) files[name] = hash(await readFile(new URL(name, ROOT)));
    }
  }
  await walk('src/logos-engine'); await walk('src/runtime');
  const ordered = Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right, 'en')));
  return { digest: hash(JSON.stringify(ordered)), fileCount: Object.keys(ordered).length, files: ordered };
}
function publicPacket(input: V6PublicObservation): NativePublicObservation {
  return { frame_rows: input.frame, frame_packet: input.frames, level: input.level, levels_completed: input.levelsCompleted,
    state: input.state, step_index: input.stepIndex, available_action_refs: input.availableActionIds.map(id => `ACTION${id}`),
    frame_hash: hash(JSON.stringify(input.frame)).slice(0, 16) };
}
function packetHash(packet: NativePublicObservation): string {
  // Fixed field order, full frames and animations. No hidden game metadata.
  return hash(JSON.stringify({ frame_rows: packet.frame_rows, frame_packet: packet.frame_packet,
    level: packet.level, levels_completed: packet.levels_completed, state: packet.state, step_index: packet.step_index,
    available_action_refs: packet.available_action_refs, frame_hash: packet.frame_hash }));
}
async function baselineFor(game: string): Promise<R | null> {
  const path = game === 'HANO' ? 'tests/fixtures/v6-ordered-support-reference.json'
    : ['SYME', 'DNOI'].includes(game) ? 'tests/fixtures/v6-field-reference.json' : null;
  if (!path) return null;
  const bytes = await readFile(new URL(path, ROOT)), document = JSON.parse(bytes.toString());
  const fixture = game === 'HANO' ? document.session : document.cases.find((item: R) => item.game === game);
  return { path, sha256: hash(bytes), fixture, stream: fixture.transitions.flatMap((prefix: R) => prefix.steps.map((step: R, index: number) => ({
    command: prefix.proposal.actions[index] as NativeCommand, after: step.afterPublic as NativePublicObservation,
  }))) };
}

/** Production time/action limits; no injected replay clock or Python solver. */
export async function runNativeGameCampaign(options: NativeGameCampaignOptions): Promise<R> {
  const { gameCode, targetLevels } = options;
  assert.match(gameCode, /^[A-Z0-9]{4}$/);
  assert.ok(Number.isInteger(targetLevels) && targetLevels >= 1 && targetLevels <= 100);
  const started = performance.now(), sourceBefore = await nativeSourceManifest();
  const report: R = {
    schema: 'logos-engine.v6.integrated-game-campaign.v1', game: gameCode, targetLevels,
    status: 'running', referenceCommit: V6_REFERENCE_COMMIT,
    budget: { levelActionCaps: Array(targetLevels).fill(600), activeSecondsPerLevel: 360, clock: 'real active compute and native execution' },
    source: sourceBefore, gameAssets: {}, actions: [], boundaries: [], prefixes: [], requests: [], domainAssessments: [],
    baseline: null, pythonAgentModules: null, failure: null,
  };
  let runtime: Awaited<ReturnType<typeof createNativeV6Runtime>> | undefined;
  let native: Awaited<ReturnType<typeof loadPyodide>> | undefined;
  let agent: BrowserV6Agent | undefined, current: GameObservation | undefined;
  let lastResponse: V6AgentResult | undefined, lastCycles = 0, previousActions = 0, previousSeconds = 0;
  const sessions = new Set<string>(), operationCounts: Record<string, number> = {};
  const progress = (event: R) => options.progress?.({ game: gameCode, ...event });
  try {
    const baseline = await baselineFor(gameCode);
    if (baseline) report.baseline = { path: baseline.path, sha256: baseline.sha256,
      qualification: 'Available reference prefix only: public commands and all animation packets previously matched the unchanged complete original caller. Further levels are live tests, not differential claims.',
      referenceCommands: baseline.stream.length,
      packetsCompared: 0, commandsCompared: 0, passed: false };
    const reference = new URL(`reference/v6/${V6_REFERENCE_COMMIT}/source/agents/yf_arc3_v6/`, ROOT);
    const declarations = {
      common: JSON.parse(await readFile(new URL('laya_proto/common_frontier_policy.drm.json', reference), 'utf8')),
      strategy: JSON.parse(await readFile(new URL('morphology_policy/strategy.drm', reference), 'utf8')),
    } as NativeV6Declarations;
    const service = new V6AgentService(async () => { runtime = await createNativeV6Runtime(declarations); return runtime; });
    const transport: V6AgentTransport = {
      async request(operation) {
        operationCounts[operation.type] = (operationCounts[operation.type] ?? 0) + 1;
        sessions.add(operation.sessionId);
        if (operation.type === 'init' || operation.type === 'advance') {
          assert.deepEqual(Object.keys(operation.observation).sort(), PUBLIC_KEYS, 'Only public transport fields reach the agent');
        }
        const begin = performance.now();
        progress({ phase: 'request', operation: operation.type, sequence: operation.sequence });
        const result = await service.handle(operation), snapshot = result.snapshot as R;
        lastResponse = result;
        assert.equal(snapshot.caller?.enabled, true, 'The actual common coordinator must be connected');
        assert.equal(snapshot.whyAct?.enabled, true, 'The actual WHY/ACT gate must be connected');
        const row: R = { operation: operation.type, sequence: operation.sequence, kind: result.kind,
          reason: result.reason, level: snapshot.level, levelsCompleted: snapshot.levelsCompleted,
          actions: snapshot.actions, cycles: snapshot.cycles, activeSeconds: snapshot.activeSeconds,
          elapsedMs: performance.now() - begin, family: snapshot.lastDecision, caller: structuredClone(snapshot.caller) };
        report.requests.push(row); progress({ phase: 'response', ...row });
        if (snapshot.cycles > lastCycles) {
          assert.equal(snapshot.cycles, lastCycles + 1, 'One response acquires at most one committed prefix');
          assert.deepEqual(snapshot.whyAct.analysis.map((item: R) => item.operation), ['OP29', 'OP30', 'OP31']);
          assert.equal(snapshot.caller.acquiredTransitions, snapshot.actions, 'Every physical action reaches the common acquisition at the sealed boundary');
          const graph = runtime!.inspectKnowledge();
          const read = (id: string): R => {
            assert.ok(graph.nodes[id], `Missing real knowledge node ${id}`);
            return hydrateNativeState(graph.nodes[id]!.value, ref => graph.nodes[ref]?.value) as R;
          };
          const evidenceId = `prefix_evidence:${snapshot.prefix.revision}`, evidence = read(evidenceId);
          assert.ok(evidence.transitions.length > 0);
          for (const [index, transition] of evidence.transitions.entries()) {
            const record = read(`reasoning:transition:${evidence.decision_revision + index}`);
            assert.equal(record.before, transition.before); assert.equal(record.after, transition.after);
            assert.ok(record.caller_acquisition && typeof record.caller_acquisition === 'object', 'Caller acquisition must be retained, not only counted');
            assert.ok(record.frontier_acquisition && typeof record.frontier_acquisition === 'object', 'Frontier acquisition must be retained for every witnessed transition');
            if (record.assessment?.domain?.status === 'outside_source_domain') {
              assert.equal(record.assessment.status, 'unknown');
              assert.equal(record.assessment.registry_update, 'none');
              assert.equal(record.assessment.release_authority, false);
              assert.ok(record.prospective_prediction_checks.every((check: R) => check.validation_performed === false));
              report.domainAssessments.push({ transition: `reasoning:transition:${evidence.decision_revision + index}`,
                before: record.before, after: record.after, domain: record.assessment.domain,
                status: record.assessment.status, registryUpdate: record.assessment.registry_update });
            }
          }
          const series = read('family_state:public_occurrence_recall');
          const anchors = (series.events as R[]).filter(event => event.kind === 'coupled_pair_epoch_anchor');
          const alternating = (series.events as R[]).filter(event => event.kind === 'alternating_graph_evidence');
          const graphEvidence = alternating.at(-1);
          const cells = (series.events as R[]).filter(event => event.kind === 'cell_patch_placement_evidence');
          const programModels = (series.events as R[]).filter(event => event.kind === 'fitted_program_composition');
          const programReconciliations = (series.events as R[]).filter(event => event.kind === 'program_composition_reconciled');
          const radialEffects = (series.events as R[]).filter(event => event.kind === 'radial_port_effect');
          const controlTrials = (series.events as R[]).filter(event => event.kind === 'native_program_control_trial');
          const controlBindings = (series.events as R[]).filter(event => event.kind === 'native_program_control_binding');
          const controlEffects = (series.events as R[]).filter(event => event.kind === 'native_program_control_effect');
          const programRefutedEpochs = new Set<number>();
          for (const event of series.events as R[]) {
            if (event.kind === 'program_composition_reconciled' && event.refuted) programRefutedEpochs.add(event.epoch);
            else if (event.kind === 'exact_program_extension_refusal') programRefutedEpochs.delete(event.epoch);
          }
          assert.deepEqual(anchors.map(event => event.epoch), [...new Set(report.actions.map((action: R) => action.levelBefore))],
            'One anchor belongs to each publicly witnessed before-epoch, including natural boundary transitions');
          report.prefixes.push({ id: evidenceId, decisionRevision: evidence.decision_revision,
            acquiredActions: evidence.transitions.length, family: snapshot.lastDecision, operations: ['OP29', 'OP30', 'OP31'],
            proposalKind: evidence.proposal.kind ?? null, fieldSubquestion: evidence.proposal.field_subquestion ?? null,
            ...(evidence.proposal.strategy_receipt?.native_coordination?.length
              ? { nativeCoordination: evidence.proposal.strategy_receipt.native_coordination } : {}),
            ...((evidence.proposal.program_composition_plan ?? evidence.proposal.respondent_probe_plan)?.current_program_access
              ? { currentProgramAccess: (evidence.proposal.program_composition_plan ?? evidence.proposal.respondent_probe_plan).current_program_access } : {}),
            ...(evidence.proposal.program_control_probe_plan
              ? { programControlProbeMode: evidence.proposal.program_control_probe_plan.mode } : {}),
            supportMode: evidence.proposal.support_preparation_plan?.mode ?? null,
            graphChain: graph.chain, graphRevision: snapshot.graphRevision, callerAcquiredTransitions: snapshot.caller.acquiredTransitions,
            sharedSeries: { digestScope: snapshot.coverage.sharedSeriesDigestScope, digest: series.digest,
              eventCount: series.events.length, epochAnchors: anchors,
              cellPlacementEvidenceCount: cells.length,
              cellPlacementModels: cells.at(-1)?.models ?? {},
              cellPlacementRefusals: cells.at(-1)?.refused ?? [],
              markedCollectionResultCount: series.events.filter((event: R) => event.kind === 'marked_collection_result').length,
              programEditSampleCount: series.events.filter((event: R) => event.kind === 'program_edit_sample').length,
              programPhaseAlignmentCount: series.events.filter((event: R) => event.kind === 'public_program_phase_alignment').length,
              programModels: programModels.map(event => ({ modelId: event.model.model_id, epoch: event.model.acquisition_epoch,
                evidence: event.evidence, observedMoves: event.model.moves.filter((move: R) => move.status === 'phase_observed_translation').length,
                inferredMoves: event.model.moves.filter((move: R) => move.status !== 'phase_observed_translation').length })),
              programReconciliationCount: programReconciliations.length,
              programRefutedEpochs: [...programRefutedEpochs].sort((left, right) => left - right),
              respondentProbeCount: series.events.filter((event: R) => event.kind === 'respondent_probe_result').length,
              respondentModelCount: series.events.filter((event: R) => event.kind === 'observed_respondent_order').length,
              programExtensionRefusalCount: series.events.filter((event: R) => event.kind === 'exact_program_extension_refusal').length,
              programInputSupportCount: series.events.filter((event: R) => event.kind === 'observed_input_support').length,
              radialPortEffectCount: radialEffects.length,
              radialPortLatestEffect: radialEffects.at(-1) ?? null,
              nativeControlDiscovery: { trialCount: controlTrials.length, bindingCount: controlBindings.length, effectCount: controlEffects.length,
                latestTrial: controlTrials.at(-1) ?? null, latestBinding: controlBindings.at(-1) ?? null, latestEffect: controlEffects.at(-1) ?? null },
              alternatingGraphEvidenceCount: alternating.length,
              alternatingGraphSampleCount: graphEvidence?.samples?.length ?? 0,
              alternatingGraphContactCount: graphEvidence?.contacts?.length ?? 0,
              alternatingGraphRemovalCount: graphEvidence?.removals?.length ?? 0,
              pairEvidenceCount: (series.events as R[]).filter(event => event.kind === 'coupled_pair_evidence').length,
              supportPreparationCount: (series.events as R[]).filter(event => event.kind === 'coupled_support_preparation').length,
              supportControlModelCount: (series.events as R[]).filter(event => event.kind === 'coupled_support_control_model').length } });
          lastCycles = snapshot.cycles;
        }
        return result;
      },
      reset() { assert.fail('The campaign must retain one native reasoning session across levels'); }, dispose() {},
    };

    // Host-side games only. Reference Python and fixture files stay outside.
    native = await loadPyodide({ indexURL: new URL('public/vendor/pyodide/', ROOT).pathname,
      stdout: () => {}, stderr: (text: string) => progress({ phase: 'game-stderr', message: text }) });
    await native.loadPackage(['numpy', 'pydantic', 'typing-extensions']);
    for (const name of ['custom-games.zip', 'official-games.zip']) {
      const bytes = await readFile(new URL(`public/python/${name}`, ROOT)); report.gameAssets[name] = hash(bytes);
      native.unpackArchive(new Uint8Array(bytes), 'zip', { extractDir: '/games' });
    }
    for (const name of ['game_bridge.py', 'official_adapter.py', 'custom_level_navigation.py']) {
      const bytes = await readFile(new URL(`public/python/${name}`, ROOT)); report.gameAssets[name] = hash(bytes);
      native.FS.writeFile(`/games/${name}`, bytes.toString());
    }
    native.runPython("import sys\nsys.path.insert(0, '/games')\nfrom game_bridge import dispatch");
    const hostRequests: R[] = [];
    function game(request: R): GameObservation {
      hostRequests.push(request); native!.globals.set('_native_game_request', JSON.stringify(request));
      let result: R;
      try { result = JSON.parse(native!.runPython('dispatch(_native_game_request)')); }
      finally { native!.globals.delete('_native_game_request'); }
      if (result.error) throw new Error(result.error);
      return { ...result, gameCode: result.code ?? result.gameCode } as GameObservation;
    }
    current = game({ type: 'load', code: gameCode, level: 1 });
    const initial = publicPacket(toV6PublicObservation(current, 0));
    options.publicTrace?.(structuredClone(initial), null);
    report.initial = { publicPacketSha256: packetHash(initial), state: current.state, level: current.level, levelsCompleted: current.levelsCompleted };
    if (baseline) {
      assert.equal(packetHash(initial), packetHash(baseline.fixture.initial.public), 'The initial real game matches the original public scene');
      report.baseline.packetsCompared += 1;
    }
    agent = new BrowserV6Agent({ transport, targetLevels, actionsPerLevel: 600, getObservation: () => current!, canDispatch: () => true, onState: () => {},
      dispatch: async action => {
        assert.equal((lastResponse!.snapshot as R).whyAct.decision.decision.status, 'action_set_released');
        const command = { action_ref: `ACTION${action.id}`, data: action.id === 6 ? { ...action.data } : {} };
        const expected = baseline?.stream[report.actions.length];
        if (baseline && expected) {
          assert.deepEqual(command, expected.command, `Original command differs at physical action ${report.actions.length + 1}`);
          report.baseline.commandsCompared += 1;
        }
        const levelBefore = current!.level, completedBefore = current!.levelsCompleted, executionStart = performance.now();
        current = game({ type: 'action', actionId: action.id, ...(action.id === 6 ? { data: action.data } : {}) });
        const executionMs = performance.now() - executionStart;
        const packet = publicPacket(toV6PublicObservation(current, report.actions.length + 1));
        options.publicTrace?.(structuredClone(packet), structuredClone(command));
        report.actions.push({ sequence: report.actions.length + 1, command, levelBefore, completedBefore,
          levelAfter: current.level, completedAfter: current.levelsCompleted, state: current.state,
          publicPacketSha256: packetHash(packet), frameHash: packet.frame_hash, animationFrames: packet.frame_packet.length,
          decisionRevision: lastResponse!.ticket!.decisionRevision, actionIndex: lastResponse!.ticket!.actionIndex,
          family: lastResponse!.snapshot.lastDecision, executionMs });
        if (baseline && expected) {
          assert.equal(packetHash(packet), packetHash(expected.after), `Original public packet differs at physical action ${report.actions.length}`);
          report.baseline.packetsCompared += 1;
        }
        return { observation: current, executionMs };
      },
    });
    for (let level = 1; level <= targetLevels; level += 1) {
      await agent.run(600);
      const snapshot = agent.snapshot as R;
      assert.notEqual(snapshot.status, 'error', snapshot.message);
      assert.ok(current.levelsCompleted >= level, `Did not complete ${gameCode} level ${level}: ${snapshot.message}`);
      assert.equal(sessions.size, 1, 'Natural progression must preserve the native session');
      const graph = runtime!.inspectKnowledge();
      for (const component of COMPONENTS) assert.ok(graph.nodes[`caller:${component}`], `Missing authoritative caller:${component}`);
      assert.equal(snapshot.caller.boundaryReplays, Math.min(level, targetLevels - 1), 'Only boundaries before the target are replayed, as in the original caller');
      const boundary = { completedLevel: level, nativeLevel: current.level, levelsCompleted: current.levelsCompleted,
        levelActions: report.actions.length - previousActions, totalActions: report.actions.length,
        levelActiveSeconds: snapshot.activeSeconds - previousSeconds, activeSeconds: snapshot.activeSeconds,
        prefixCount: snapshot.cycles, graphChain: graph.chain, graphRevision: snapshot.graphRevision, nodeCount: snapshot.nodeCount,
        caller: structuredClone(snapshot.caller), phase: snapshot.phase, sessionRetained: true };
      report.boundaries.push(boundary); progress({ phase: 'completed-level', ...boundary });
      previousActions = report.actions.length; previousSeconds = snapshot.activeSeconds;
      if (level < targetLevels) { assert.equal(snapshot.requiresNewSession, false); assert.equal(snapshot.canStep, true); }
    }
    assert.equal(agent.snapshot.actionCount, report.actions.length);
    assert.equal(agent.snapshot.actions, report.actions.length);
    assert.equal(operationCounts.advance, report.actions.length);
    assert.equal(report.prefixes.reduce((sum: number, prefix: R) => sum + prefix.acquiredActions, 0), report.actions.length);
    assert.equal(hostRequests.filter(request => request.type === 'load').length, 1);
    assert.equal(hostRequests.filter(request => request.type === 'action').length, report.actions.length);
    assert.equal(hostRequests.length, report.actions.length + 1, 'No reset, undo, hidden probe or free game step');
    if (baseline) {
      assert.equal(report.baseline.commandsCompared, Math.min(report.actions.length, baseline.stream.length));
      report.baseline.passed = true;
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = error instanceof Error ? error.message : String(error);
    progress({ phase: 'failure', message: report.failure });
  }
  if (native) {
    report.pythonAgentModules = JSON.parse(native.runPython("__import__('json').dumps(sorted(name for name in sys.modules if name == 'agents' or name.startswith(('agents.', 'v6_python_bridge')) or name in {'common_frontier_runtime', 'src_bridge', 'common_ordered_support', 'prospective_contact_adapter'}))"));
    if (report.pythonAgentModules.length) { report.status = 'failed'; report.failure ??= 'Python agent module loaded in game interpreter'; }
  }
  const sourceAfter = await nativeSourceManifest();
  report.sourceUnchangedDuringRun = sourceBefore.digest === sourceAfter.digest;
  if (!report.sourceUnchangedDuringRun) { report.status = 'failed'; report.failure ??= 'Native source changed during campaign; rerun the fixed source'; }
  const final = agent?.snapshot as R | undefined;
  report.final = { actions: report.actions.length, levelsCompleted: current?.levelsCompleted ?? 0, level: current?.level ?? null,
    state: current?.state ?? null, status: final?.status ?? null, reason: final?.reason ?? null,
    activeSeconds: final?.activeSeconds ?? null, prefixes: final?.cycles ?? 0, caller: final?.caller ?? null,
    fullV6Parity: final?.coverage?.fullV6Parity ?? false, sessions: sessions.size, operationCounts,
    nativeImplementation: (lastResponse?.snapshot as R | undefined)?.implementation ?? null };
  report.elapsedSeconds = (performance.now() - started) / 1000;
  return report;
}
