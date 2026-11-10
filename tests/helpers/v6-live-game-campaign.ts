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
/** JSON otherwise turns -0 into 0; preserve the exact observed numeric payload. */
function negativeZeroPaths(value: unknown, path: (string | number)[] = []): (string | number)[][] {
  if (typeof value === 'number') return Object.is(value, -0) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => negativeZeroPaths(item, [...path, index]));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => negativeZeroPaths(item, [...path, key]));
  return [];
}
export interface NativeGameCampaignOptions {
  gameCode: string;
  targetLevels: number;
  progress?: (event: R) => void;
  /** Evidence sink only; returned values never enter the production agent. */
  publicTrace?: (packet: NativePublicObservation, command: NativeCommand | null) => void;
  /** Development diagnostics only, outside the production transport. */
  providerDiagnostics?: boolean;
  checkpoint?: (partialReport: R) => void;
  /** Test host only: expected commands stay outside the production transport. */
  recordedPublic?: {
    trace: { path: string; sha256: string };
    baseline: { path: string; sha256: string };
    gameAssets: R;
    packets: { command: NativeCommand | null; packet: NativePublicObservation }[];
  };
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
    schema: options.recordedPublic ? 'logos-engine.v6.recorded-public-regression.v1' : 'logos-engine.v6.integrated-game-campaign.v1', game: gameCode, targetLevels,
    status: 'running', referenceCommit: V6_REFERENCE_COMMIT,
    budget: { levelActionCaps: Array(targetLevels).fill(600), activeSecondsPerLevel: 360, clock: 'real active compute and native execution' },
    source: sourceBefore, gameAssets: {}, actions: [], boundaries: [], prefixes: [], requests: [], domainAssessments: [],
    baseline: null, pythonAgentModules: null, failure: null, inventorySourceCalls: [], recolorSourceCalls: [], motionSourceCalls: [], motionSnapshots: {}, morphologySourceCalls: [], controlAttentionSourceCalls: [],
  };
  if (options.recordedPublic) report.recordedPublicReplay = {
    trace: options.recordedPublic.trace, baseline: options.recordedPublic.baseline,
    qualification: 'A cold native common session recomputes every command before the recorded complete public return is supplied. No game host executes and no new live completion or speed comparison is claimed. Expected commands never enter the production transport.',
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
    const service = new V6AgentService(async () => {
      runtime = await createNativeV6Runtime(declarations);
      // Evidence-only source-call observer. It preserves the method's sync or
      // async return, inputs, ordering and state, and never supplies a decision.
      // Inventory propose() can acquire memories even when another provider
      // wins, so record-only replay would miss source mutations.
      const inventory = (runtime as unknown as { families: R[] }).families.find(f => f.id === 'public_observed_inventory');
      if (inventory) {
        let sourceDepth = 0;
        for (const method of ['observeCallerContext', 'recordCallerContext', 'proposeSource', 'preservation_obligations', 'recordSource']) {
          const original = inventory[method];
          assert.equal(typeof original, 'function', `Missing observed inventory source surface: ${method}`);
          inventory[method] = function (...args: any[]) {
            if (sourceDepth) return original.apply(this, args);
            const capturedArgs = method === 'proposeSource'
              ? [args[0], args[1], args[2], args[3], args[4] ?? null, args[5] ?? [], args[6]?.retained_state() ?? null] : args;
            const event: R = { index: report.inventorySourceCalls.length, method, arguments: structuredClone(capturedArgs),
              sourceBefore: this.state(), callerContextBefore: this.callerContextState() };
            sourceDepth++;
            const complete = (result: any): any => {
              event.result = structuredClone(result ?? null); event.sourceAfter = this.state(); event.callerContextAfter = this.callerContextState();
              report.inventorySourceCalls.push(event); sourceDepth--; return result;
            };
            const failed = (error: unknown): never => {
              event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              event.sourceAfter = this.state(); event.callerContextAfter = this.callerContextState();
              report.inventorySourceCalls.push(event); sourceDepth--; throw error;
            };
            try {
              const result = original.apply(this, args);
              return result && typeof result.then === 'function' ? result.then(complete, failed) : complete(result);
            } catch (error) { return failed(error); }
          };
        }
      }
      const recolor = (runtime as unknown as { families: R[] }).families.find(f => f.id === 'public_topological_recolor');
      if (recolor) {
        let sourceDepth = 0;
        for (const method of ['proposeSource', 'recordSource']) {
          const original = recolor[method];
          assert.equal(typeof original, 'function', `Missing topological recolor source surface: ${method}`);
          recolor[method] = function (...args: any[]) {
            if (sourceDepth) return original.apply(this, args);
            const event: R = { index: report.recolorSourceCalls.length, method,
              arguments: structuredClone(args), sourceBefore: this.state() };
            sourceDepth++;
            const complete = (result: any): any => {
              event.result = structuredClone(result ?? null); event.sourceAfter = this.state();
              report.recolorSourceCalls.push(event); sourceDepth--; return result;
            };
            const failed = (error: unknown): never => {
              event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              event.sourceAfter = this.state(); report.recolorSourceCalls.push(event); sourceDepth--; throw error;
            };
            try {
              const result = original.apply(this, args);
              return result && typeof result.then === 'function' ? result.then(complete, failed) : complete(result);
            } catch (error) { return failed(error); }
          };
        }
      }
      // The caller is constructed during initialize. Observe its actual instance
      // before the first plan, without replacing any producer or supplying state.
      const backend = runtime as unknown as R, originalPlan = backend.plan, observedCallers = new WeakSet<object>();
      const observedSnapshots = new WeakMap<object, string>();
      const snapshotRef = (snapshot: R): string => {
        const previous = observedSnapshots.get(snapshot); if (previous) return previous;
        const ref = snapshot.ref as string, value = structuredClone(snapshot);
        if (Object.hasOwn(report.motionSnapshots, ref)) assert.deepEqual(value, report.motionSnapshots[ref], `Conflicting public motion snapshot: ${ref}`);
        else report.motionSnapshots[ref] = value;
        observedSnapshots.set(snapshot, ref); return ref;
      };
      const morphology = (runtime as unknown as { families: R[] }).families.find(f => f.id === 'morphology');
      if (morphology) {
        for (const method of ['propose', 'record', 'observeDepartures']) {
          const original = morphology[method];
          assert.equal(typeof original, 'function', `Missing morphology source surface: ${method}`);
          morphology[method] = async function (...args: any[]) {
            const capturedArgs = method === 'propose' ? args.slice(0, 4) : args;
            const event: R = { index: report.morphologySourceCalls.length, method,
              arguments: structuredClone(capturedArgs), sourceBefore: this.state() };
            if (method === 'propose') {
              const memory = backend.caller.goal.memory;
              event.history = memory.episode.map(([before, command, after]: [R, string, R]) => [snapshotRef(before), command, snapshotRef(after)]);
              event.current = snapshotRef(memory.snapshot(args[0], args[1]));
              // Read the one caller-owned method at this actual decision. The
              // observer never supplies a method, contact or return to the agent.
              event.targetMethod = structuredClone(backend.caller.targetMethod);
            }
            try {
              const result = await original.apply(this, args);
              event.result = structuredClone(result ?? null); event.sourceAfter = this.state();
              if (method === 'propose') {
                event.measurement = this.currentMeasurementReceipt(args[0]);
                event.refusal = this.currentProposalRefusal(args[0]);
                event.currentDecision = this.currentDecision(args[0]);
              }
              report.morphologySourceCalls.push(event); return result;
            } catch (error) {
              event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
              event.sourceAfter = this.state(); report.morphologySourceCalls.push(event); throw error;
            }
          };
        }
      }
      backend.plan = function (...args: any[]) {
        const caller = this.caller;
        if (caller && !observedCallers.has(caller)) {
          observedCallers.add(caller);
          const original = caller.currentMotionOffers;
          caller.currentMotionOffers = async function (...inputs: any[]) {
            // Store each public snapshot once. Repeating complete historical
            // rasters per planning call would make this evidence grow quadratically.
            const event: R = { index: report.motionSourceCalls.length, arguments: structuredClone(inputs),
              history: this.goal.memory.episode.map(([before, command, after]: [R, string, R]) => [snapshotRef(before), command, snapshotRef(after)]),
              current: snapshotRef(this.goal.memory.snapshot(inputs[0], inputs[1])) };
            try { const result = await original.apply(this, inputs); event.result = structuredClone(result); report.motionSourceCalls.push(event); return result; }
            catch (error) { event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error); report.motionSourceCalls.push(event); throw error; }
          };
          let controlCallSequence = 0;
          for (const method of ['acquireControlForTarget', 'attentionParentReturnOffer', 'currentInformationOffer']) {
            const sourceMethod = caller[method];
            caller[method] = async function (...inputs: any[]) {
              const event: R = { index: controlCallSequence++, method, arguments: structuredClone(inputs),
                history: this.goal.memory.episode.map(([before, command, after]: [R, string, R]) => [snapshotRef(before), command, snapshotRef(after)]),
                current: snapshotRef(this.goal.memory.snapshot(inputs[0], inputs[1])),
                targetMethod: structuredClone(this.targetMethod), returnedAttention: structuredClone(this.returnedAttention),
                attentionBefore: this.attention.state(), deferredBefore: this.deferredCuriosity };
              try {
                const result = await sourceMethod.apply(this, inputs);
                event.result = structuredClone(result ?? null);
                event.attentionAfter = this.attention.state(); event.deferredAfter = this.deferredCuriosity;
                report.controlAttentionSourceCalls.push(event); return result;
              } catch (error) {
                event.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
                event.attentionAfter = this.attention.state(); event.deferredAfter = this.deferredCuriosity;
                report.controlAttentionSourceCalls.push(event); throw error;
              }
            };
          }
        }
        return originalPlan.apply(this, args);
      };
      if (options.providerDiagnostics) {
        // Observe the actual instance call without altering its inputs, result,
        // budget, priority or retained state. No game object enters the runtime.
        const families = (runtime as unknown as { families: R[] }).families;
        for (const family of families) for (const method of ['propose', 'proposeInGroup', 'proposeInSubquestion']) {
          if (typeof family[method] !== 'function') continue;
          const original = family[method];
          family[method] = async function (...args: any[]) {
            const offset = method === 'propose' ? 0 : method === 'proposeInGroup' ? 1 : 2;
            const context = { family: family.id, method, group: offset ? args[0] : null, entry: offset === 2 ? args[1] : null,
              observation_ref: args[offset].observation_ref, level_epoch: args[offset].level_epoch };
            progress({ phase: 'provider-start', ...context, memory: process.memoryUsage() });
            const result = await original.apply(this, args);
            progress({ phase: 'provider-end', ...context, proposed: result !== null, memory: process.memoryUsage() });
            return result;
          };
        }
      }
      return runtime;
    });
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
          const framedCheckpoint = read('family_state:public_framed_transfer');
          const outlineCheckpoint = read('family_state:public_outline_service');
          const reactiveCheckpoint = graph.nodes['family_state:public_reactive_contact']
            ? read('family_state:public_reactive_contact') : null;
          const reactionCheckpoint = graph.nodes['family_state:public_ordered_reaction']
            ? read('family_state:public_ordered_reaction') : null;
          const inventoryCheckpoint = graph.nodes['family_state:public_observed_inventory']
            ? read('family_state:public_observed_inventory') : null;
          const recolorCheckpoint = graph.nodes['family_state:public_topological_recolor']
            ? read('family_state:public_topological_recolor') : null;
          const morphologyCheckpoint = graph.nodes['family_state:morphology']
            ? read('family_state:morphology') : null;
          const reasoningFacts = (read('reasoning:memory').facts as string[]).map(read);
          const compositionAttention = read('caller:attention').composition;
          const framedFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `framed_transfer_event:${evidence.decision_revision + index}`));
          const outlineFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `outline_service_event:${evidence.decision_revision + index}`));
          const reactiveFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `reactive_event:${evidence.decision_revision + index}`));
          const reactionFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `reaction_event:${evidence.decision_revision + index}`));
          const inventoryFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `observed_inventory_event:${evidence.decision_revision + index}`));
          const recolorFacts = reasoningFacts
            .filter(fact => evidence.transitions.some((_: R, index: number) =>
              fact.key === `topological_recolor_event:${evidence.decision_revision + index}`));
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
          const rootedStates = (series.events as R[]).filter(event => event.kind === 'rooted_quota_state');
          const queuedModels = (series.events as R[]).filter(event => event.kind === 'observed_queue_field_model');
          const catalogueEvents = (series.events as R[]).filter(event =>
            ['catalogue_observation', 'catalogue_response', 'catalogue_field_input_observed'].includes(event.kind));
          const materialEvents = (series.events as R[]).filter(event =>
            ['typed_carrier_response', 'typed_material_flow', 'typed_pose_scope', 'typed_pose_model', 'typed_pose_response'].includes(event.kind));
          const previousMaterialCount = report.prefixes.at(-1)?.sharedSeries.typedMaterialEventCount ?? 0;
          const serviceEvents = (series.events as R[]).filter(event =>
            ['nested_control_response', 'envelope_fill_context', 'field_service_context', 'field_service_transfer'].includes(event.kind));
          const previousServiceCount = report.prefixes.at(-1)?.sharedSeries.fieldServiceEventCount ?? 0;
          const panelServiceEvents = (series.events as R[]).filter(event => event.kind === 'observed_panel_service');
          const previousPanelServiceCount = report.prefixes.at(-1)?.sharedSeries.panelServiceEventCount ?? 0;
          const chamberRelationEvents = (series.events as R[]).filter(event => event.kind === 'observed_chamber_relations');
          const previousChamberRelationCount = report.prefixes.at(-1)?.sharedSeries.chamberRelationEventCount ?? 0;
          const productStates = (series.events as R[]).filter(event => event.kind === 'observed_factor_product');
          const labeledSubmissions = (series.events as R[]).filter(event => event.kind === 'labeled_sequence_submission');
          const traceExtensions = (series.events as R[]).filter(event => event.kind === 'observed_trace_extension');
          const linkedEvidence = (series.events as R[]).filter(event => event.kind === 'linked_packet_evidence');
          const relationModels = (series.events as R[]).filter(event => event.kind === 'native_program_relation_model');
          const relationTrials = (series.events as R[]).filter(event => event.kind === 'native_program_relation_trial');
          const relationRefutations = (series.events as R[]).filter(event => event.kind === 'native_program_relation_refutation');
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
            materialSubquestion: evidence.proposal.material_access_subquestion ?? null,
            selectionGroup: evidence.proposal.strategy_receipt?.selected ?? null,
            controlAttention: { morphology: evidence.proposal.morphology ?? null,
              controlAcquisition: evidence.proposal.question?.control_acquisition ?? null,
              sharedControl: evidence.proposal.question?.curiosity?.also_tests_current_control ?? null,
              deferredCuriosity: evidence.proposal.strategy_receipt?.deferred_curiosity ?? [],
              returnedAttention: evidence.proposal.strategy_receipt?.attention_return ?? null,
              acquiredAttention: read('caller:attention'),
              qualification: 'Observed source decisions and acquired attention in the actual common prefix; this recorder supplies no state or action.' },
            ...(morphologyCheckpoint ? { morphologyOwnership: {
              stateNode: 'family_state:morphology', nativeCheckpoint: morphologyCheckpoint,
              proposal: evidence.proposal.kind === 'morphology_probe' ? evidence.proposal : null,
              targetMethod: read('caller:counters').targetMethod,
              qualification: 'Passive evidence from the actual common family. Contacts, tried trials, feature returns and entry access returns have one owner; the retained method, public motion history and meter/collection stay with their existing owners. This observer supplies no command, learned state or expected return.',
            } } : {}),
            ...(evidence.native_bindings?.length
              ? { nativeBindings: evidence.native_bindings.map((binding: R) => ({ ...binding, retainedGuard: read(binding.evidence_node) })) } : {}),
            ...(evidence.proposal.strategy_receipt?.native_coordination?.length
              ? { nativeCoordination: evidence.proposal.strategy_receipt.native_coordination } : {}),
            ...(evidence.proposal.strategy_receipt?.native_proposal_refusals?.length
              ? { nativeProposalRefusals: evidence.proposal.strategy_receipt.native_proposal_refusals } : {}),
            ...((evidence.proposal.program_composition_plan ?? evidence.proposal.respondent_probe_plan)?.current_program_access
              ? { currentProgramAccess: (evidence.proposal.program_composition_plan ?? evidence.proposal.respondent_probe_plan).current_program_access } : {}),
            ...(evidence.proposal.program_control_probe_plan
              ? { programControlProbeMode: evidence.proposal.program_control_probe_plan.mode } : {}),
            ...(evidence.proposal.program_relation_plan
              ? { programRelationMode: evidence.proposal.program_relation_plan.mode } : {}),
            ...(evidence.proposal.rooted_quota_plan
              ? { rootedQuotaPhase: evidence.proposal.rooted_quota_plan.phase } : {}),
            ...(evidence.proposal.product_panel_plan
              ? { productPanelFactors: evidence.proposal.product_panel_plan.scene.controls.length,
                  productPanelEstimated: evidence.proposal.product_panel_plan.estimate !== null,
                  productPanelObservedSteps: evidence.proposal.steps.map((step: R) => step.relation_observed) } : {}),
            ...(evidence.proposal.panel_service_plan
              ? { observedPanelService: { proposal: evidence.proposal,
                    stateNode: 'family_state:public_occurrence_recall',
                    qualification: 'Passive capture of the selected common proposal. All panel measurements and acquired events are computed by production; this recorder supplies no decision or expected return.' } } : {}),
            ...(evidence.proposal.chamber_relation_plan
              ? { observedChamberRelations: { proposal: evidence.proposal,
                    stateNode: 'family_state:public_occurrence_recall',
                    qualification: 'Passive capture of the selected common proposal. Production measures the relations, enumerates its finite conditional domain and acquires each actual return. The recorder supplies no decision or expected return.' } } : {}),
            ...(evidence.proposal.queued_field_plan
              ? { queuedField: { plan: evidence.proposal.queued_field_plan,
                    stateNode: 'family_state:public_occurrence_recall' } } : {}),
            ...(evidence.proposal.occluded_catalogue_plan
              ? { occludedCatalogue: { plan: evidence.proposal.occluded_catalogue_plan, proposal: evidence.proposal,
                    stateNode: 'family_state:public_occurrence_recall' } } : {}),
            ...(['typed_carrier_plan', 'material_flow_plan', 'material_pose_plan'].some(key => evidence.proposal[key])
              ? { typedMaterial: { proposal: evidence.proposal,
                    negativeZeroPaths: negativeZeroPaths(evidence.proposal),
                    stateNode: 'family_state:public_occurrence_recall',
                    numericScope: 'Finite native numerical identities; source and native derived hashes are verified independently. Float JSON spelling equality with Python is not asserted.' } } : {}),
            ...(evidence.proposal.nested_control_plan
              ? { fieldService: { proposal: evidence.proposal,
                    negativeZeroPaths: negativeZeroPaths(evidence.proposal),
                    stateNode: 'family_state:public_occurrence_recall',
                    numericScope: 'Native numerical identities and source identities are verified independently; complete Python caller or float JSON spelling parity is not asserted.' } } : {}),
            ...(evidence.proposal.framed_transfer_plan
              ? { framedTransfer: { proposal: evidence.proposal,
                    stateNode: 'family_state:public_framed_transfer' } } : {}),
            framedAcquisition: {
              stateNode: 'family_state:public_framed_transfer',
              checkpointFormat: framedCheckpoint.format,
              sourceState: framedCheckpoint.source_state,
              nativeCheckpoint: framedCheckpoint,
              acquired: framedFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              qualification: 'One shared FramedTransfer owner acquires actual selected or foreign public transitions. The six-field source projection and the complete native checkpoint are retained separately. Additional public-packet measurements, when enabled, have their own native provenance. Current level facts and historical portable records remain separate. This is not a complete-original-caller parity claim.',
            },
            ...(evidence.proposal.outline_plan
              ? { outlineService: { proposal: evidence.proposal, stateNode: 'family_state:public_outline_service' } } : {}),
            outlineAcquisition: {
              stateNode: 'family_state:public_outline_service',
              checkpointFormat: outlineCheckpoint.format,
              sourceState: outlineCheckpoint.source_state,
              nativeCheckpoint: outlineCheckpoint,
              acquired: outlineFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              qualification: 'The actual common Kernel owner acquires selected or foreign public transitions once after prefix sealing. The seven-field V6 source state and immutable native checkpoint are retained separately. Recalled evidence is not current transition evidence. No checkpoint or expected action is supplied to the agent by this passive evidence observer.',
            },
            ...(reactiveCheckpoint ? { reactiveAcquisition: {
              stateNode: 'family_state:public_reactive_contact', checkpointFormat: reactiveCheckpoint.format,
              sourceState: reactiveCheckpoint.source_state, nativeCheckpoint: reactiveCheckpoint,
              transitions: evidence.transitions, selectionReceipt: evidence.proposal.strategy_receipt,
              acquired: reactiveFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              ...(evidence.proposal.reactive_plan ? { selectedProposal: evidence.proposal } : {}),
              qualification: 'Passive evidence only: the one actual ReactiveContact owner, its thirteen source fields, source transition references and complete native checkpoint. No state, action or expected return is supplied by this observer.',
            } } : {}),
            ...(reactionCheckpoint ? { reactionAcquisition: {
              stateNode: 'family_state:public_ordered_reaction', checkpointFormat: reactionCheckpoint.format,
              sourceState: reactionCheckpoint.source_state, nativeCheckpoint: reactionCheckpoint,
              transitions: evidence.transitions, selectionReceipt: evidence.proposal.strategy_receipt,
              acquired: reactionFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              ...(evidence.proposal.reaction_plan ? { selectedProposal: evidence.proposal } : {}),
              qualification: 'Passive evidence only: the one actual OrderedReaction owner, its six source fields, source transition references and complete native checkpoint. No state, action or expected return is supplied by this observer.',
            } } : {}),
            ...(inventoryCheckpoint ? { inventoryAcquisition: {
              stateNode: 'family_state:public_observed_inventory', checkpointFormat: inventoryCheckpoint.format,
              sourceState: inventoryCheckpoint.source_state, callerContext: inventoryCheckpoint.caller_context, nativeCheckpoint: inventoryCheckpoint,
              transitions: evidence.transitions, selectionReceipt: evidence.proposal.strategy_receipt,
              sourceCallsThrough: report.inventorySourceCalls.length,
              acquired: inventoryFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              ...(evidence.proposal.inventory_plan ? { selectedProposal: evidence.proposal } : {}),
              qualification: 'Evidence only: actual eight-field inventory owner, caller meter/collection context, sealed transition references and complete native checkpoint. Source method calls retain losing proposal evaluation and acquisition order without providing inputs, state or actions to the production agent.',
            } } : {}),
            ...(recolorCheckpoint ? { recolorAcquisition: {
              stateNode: 'family_state:public_topological_recolor', checkpointFormat: recolorCheckpoint.format,
              sourceState: recolorCheckpoint.source_state, nativeCheckpoint: recolorCheckpoint,
              transitions: evidence.transitions, sourceCallsThrough: report.recolorSourceCalls.length,
              acquired: recolorFacts.map(fact => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision, result: fact.value })),
              ...(evidence.proposal.recolor_plan ? { selectedProposal: evidence.proposal } : {}),
              qualification: 'Actual single six-field source owner. Only selected recolor actions call record; foreign returns do not become recolor experiments. Complete losing proposal evaluations and sealed checkpoints are observed without providing state or decisions.',
            } } : {}),
            informationGoal: evidence.proposal.question?.curiosity ?? null,
            motionSourceCallsThrough: report.motionSourceCalls.length,
            ...(compositionAttention ? { compositionAttention: {
              stateNode: 'caller:attention', state: compositionAttention,
              selectedTarget: evidence.proposal.composition_target_tree ?? null,
              transitions: evidence.transitions.map((_: R, index: number) => {
                const node = `reasoning:transition:${evidence.decision_revision + index}`;
                const acquired = read(node);
                return { node, before: acquired.before, after: acquired.after,
                  callerAcquisition: acquired.caller_acquisition, frontierAcquisition: acquired.frontier_acquisition };
              }),
              qualification: 'Read-only projection of the actual retained composition-attention owner and ordinary acquired transition nodes. No parent, result, proposal or permission is supplied by this observer; motion attention remains a separate source contract.',
            } } : {}),
            ...(evidence.proposal.labeled_sequence_plan
              ? { labeledSequenceLabel: evidence.proposal.labeled_sequence_plan.label,
                  labeledSequenceQuery: evidence.proposal.labeled_sequence_plan.scene.query.words[0].values,
                  labeledSequenceTrainingReused: evidence.proposal.labeled_sequence_plan.inference.training_reused,
                  labeledSequenceCompatiblePredicates: evidence.proposal.labeled_sequence_plan.inference.induction.values.observation_compatible_version_space,
                  labeledSequenceAgreement: evidence.proposal.labeled_sequence_plan.inference.induction.values.robust_answer_and_submission_agreement,
                  labeledSequenceGrammarSize: evidence.proposal.labeled_sequence_plan.inference.grammar.length,
                  labeledSequenceNativeComposition: evidence.proposal.labeled_sequence_plan.inference.native_composition ?? null } : {}),
            ...(evidence.proposal.reduction_plan
              ? { reductionTransport: { plan: evidence.proposal.reduction_plan,
                    stepModes: evidence.proposal.steps.map((step: R) => step.mode),
                    stateNode: 'family_state:reduction_transport',
                    acquiredState: read('family_state:reduction_transport') } } : {}),
            ...(evidence.proposal.trace_field_plan
              ? { traceField: { plan: evidence.proposal.trace_field_plan,
                    observedSteps: evidence.proposal.steps.map((step: R) => step.relation_observed),
                    stateNode: 'family_state:public_occurrence_recall' } } : {}),
            ...(evidence.proposal.linked_packet_plan
              ? { linkedPacket: { plan: evidence.proposal.linked_packet_plan,
                    stateNode: 'family_state:public_occurrence_recall',
                    numericScope: 'Finite IEEE-754 values preserved bit-exactly by the native state graph; Python libm and float digest identity are not asserted.' } } : {}),
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
              rootedQuotaStateCount: rootedStates.length,
              rootedQuotaLatestState: rootedStates.at(-1) ?? null,
              queuedFieldModelCount: queuedModels.length,
              queuedFieldLatestModel: queuedModels.at(-1) ?? null,
              queuedFieldAcquiredModels: queuedModels.filter(event => evidence.transitions.some((transition: R) => transition.before === event.evidence?.[0])),
              catalogueEventCount: catalogueEvents.length,
              catalogueLatestEvent: catalogueEvents.at(-1) ?? null,
              catalogueAcquiredEvents: catalogueEvents.filter(event => evidence.transitions.some((transition: R) => transition.before === event.evidence?.[0])),
              typedMaterialEventCount: materialEvents.length,
              typedMaterialLatestEvent: materialEvents.at(-1) ?? null,
              // Model events can carry cumulative evidence. The newly appended
              // journal range, rather than its oldest witness, defines this prefix.
              typedMaterialAcquiredEvents: materialEvents.slice(previousMaterialCount),
              typedMaterialAcquiredNegativeZeroPaths: negativeZeroPaths(materialEvents.slice(previousMaterialCount)),
              fieldServiceEventCount: serviceEvents.length,
              fieldServiceLatestEvent: serviceEvents.at(-1) ?? null,
              fieldServiceAcquiredEvents: serviceEvents.slice(previousServiceCount),
              fieldServiceAcquiredNegativeZeroPaths: negativeZeroPaths(serviceEvents.slice(previousServiceCount)),
              panelServiceEventCount: panelServiceEvents.length,
              panelServiceAcquiredEvents: panelServiceEvents.slice(previousPanelServiceCount),
              chamberRelationEventCount: chamberRelationEvents.length,
              chamberRelationAcquiredEvents: chamberRelationEvents.slice(previousChamberRelationCount),
              productPanelStateCount: productStates.length,
              productPanelLatestState: productStates.at(-1) ?? null,
              labeledSequenceSubmissionCount: labeledSubmissions.length,
              labeledSequenceLatestSubmission: labeledSubmissions.at(-1) ?? null,
              traceFieldExtensionCount: traceExtensions.length,
              traceFieldLatestExtension: traceExtensions.at(-1) ?? null,
              linkedPacketEvidenceCount: linkedEvidence.length,
              linkedPacketLatestEvidence: linkedEvidence.at(-1) ?? null,
              nativeProgramRelations: { modelCount: relationModels.length, trialCount: relationTrials.length,
                refutationCount: relationRefutations.length, latestModel: relationModels.at(-1) ?? null,
                latestTrial: relationTrials.at(-1) ?? null, latestRefutation: relationRefutations.at(-1) ?? null },
              alternatingGraphEvidenceCount: alternating.length,
              alternatingGraphSampleCount: graphEvidence?.samples?.length ?? 0,
              alternatingGraphContactCount: graphEvidence?.contacts?.length ?? 0,
              alternatingGraphRemovalCount: graphEvidence?.removals?.length ?? 0,
              pairEvidenceCount: (series.events as R[]).filter(event => event.kind === 'coupled_pair_evidence').length,
              supportPreparationCount: (series.events as R[]).filter(event => event.kind === 'coupled_support_preparation').length,
              supportControlModelCount: (series.events as R[]).filter(event => event.kind === 'coupled_support_control_model').length } });
          lastCycles = snapshot.cycles;
          options.checkpoint?.(report);
        }
        return result;
      },
      reset() { assert.fail('The campaign must retain one native reasoning session across levels'); }, dispose() {},
    };

    // Host-side games only. A recorded regression is a separate, explicit host.
    if (!options.recordedPublic) {
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
    } else report.gameAssets = structuredClone(options.recordedPublic.gameAssets);
    const hostRequests: R[] = [];
    function game(request: R): GameObservation {
      hostRequests.push(request);
      if (options.recordedPublic) {
        const index = hostRequests.length - 1, item = options.recordedPublic.packets[index];
        assert.ok(item, 'The recorded trace must supply the next complete public return');
        if (index === 0) {
          assert.deepEqual(request, { type: 'load', code: gameCode, level: 1 });
          assert.equal(item.command, null);
        } else {
          assert.equal(request.type, 'action');
          assert.deepEqual({ action_ref: `ACTION${request.actionId}`, data: request.actionId === 6 ? request.data : {} },
            item.command, `The recomputed command differs before recorded return ${index}`);
        }
        const packet = structuredClone(item.packet);
        return { gameCode, frame: packet.frame_rows as number[][], frames: packet.frame_packet as number[][][],
          state: packet.state, availableActionIds: packet.available_action_refs.map(ref => Number(ref.slice(6))),
          canUndo: false, canSelectLevel: false, level: packet.level, levelCount: targetLevels,
          levelsCompleted: packet.levels_completed, defaultFps: 0 };
      }
      native!.globals.set('_native_game_request', JSON.stringify(request));
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
    if (options.recordedPublic) assert.equal(hostRequests.length, options.recordedPublic.packets.length,
      'The complete declared recorded trajectory is consumed');
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
  else if (options.recordedPublic) report.pythonAgentModules = [];
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
