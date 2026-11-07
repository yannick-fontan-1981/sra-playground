/** Development-only differential; restored source state is never product input. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { NativeCallerCoordinator } from '../../src/logos-engine/v6-native-caller.ts';
import { NativeReasoningMemory } from '../../src/logos-engine/v6-reasoning-memory.ts';
import { ObservedInputDomain } from '../../src/logos-engine/v6-native-observer.ts';
import { assessTransition, assessPropertyTransition } from '../../src/logos-engine/v6-transition-learning.ts';

const SITE = resolve(import.meta.dirname, '../..');
const source = SITE + '/reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6';
const common = JSON.parse(await readFile(source + '/laya_proto/common_frontier_policy.drm.json', 'utf8'));
const strategy = JSON.parse(await readFile(source + '/morphology_policy/strategy.drm', 'utf8')).declarations[0].configuration;
export async function compareNativeCaller(oracle: any) {
const read = (reference: any) => structuredClone(oracle.objects[reference.$object]);
const episode = 'common-observation-frontier';
const checks: any[] = [], unsupported: any[] = [];

function differences(a: any, b: any, path = '$', result: any[] = []): any[] {
  if (isDeepStrictEqual(a, b) || result.length >= 12) return result;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    result.push({ path, native: a, original: b }); return result;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (result.length >= 12) break;
    if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) result.push({ path: path + '.' + key, nativePresent: Object.hasOwn(a, key), originalPresent: Object.hasOwn(b, key) });
    else differences(a[key], b[key], path + '.' + key, result);
  }
  return result;
}
function check(label: string, actual: any, expected: any): void {
  checks.push({ label, passed: isDeepStrictEqual(actual, expected), differences: differences(actual, expected) });
}
function freeze(value: any): any {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function packet(input: any): any {
  return { frame_rows: input.frame, frame_packet: input.frames,
    available_action_refs: input.availableActionIds.map((id: number) => 'ACTION' + id),
    state: input.state, level: input.level, levels_completed: input.levelsCompleted, step_index: input.stepIndex };
}
function memoryFrom(snapshot: any): NativeReasoningMemory {
  const memory = new NativeReasoningMemory({ clock: () => 0 }); memory.importCatalog();
  const state = read(snapshot.memory); memory.restoreDynamic({ facts: state.facts, traces: state.traces }); return memory;
}
function makeCaller(memory: NativeReasoningMemory): NativeCallerCoordinator {
  return new NativeCallerCoordinator(memory, { targetLevels: 3, domain: new ObservedInputDomain(common.input_domain.max_point_occurrences),
    strategy, informationGoal: 'accessible_view_frontier' });
}
const callerKeys = (key: string) => /^(view_evidence:|goal_access_event:|goal_access_event_count$|point_experiment:|control_experiment:|information_experiment:|coupled_display_schema$|attention$|attention_composition$|frontier_delta:|frontier_last_sequence$)/.test(key);
function compareFacts(memory: NativeReasoningMemory, snapshot: any, label: string): void {
  const actual = memory.dynamicState().facts.filter(fact => callerKeys(fact.key));
  const expected = read(snapshot.memory).facts.filter((fact: any) => callerKeys(fact.key));
  check(label, actual.sort((a, b) => a.key.localeCompare(b.key)), expected.sort((a: any, b: any) => a.key.localeCompare(b.key)));
}

let memory: NativeReasoningMemory | null = null, caller: NativeCallerCoordinator | null = null;
let release: any = null, proposal: any = null, transition: any = null;
for (const snapshot of oracle.snapshots) {
  if (snapshot.stage === 'initialized') {
    memory = memoryFrom(snapshot);
    // Check the native constructor/initial frontier against the source. Source
    // initial facts include the one observation delta; no source state is used
    // to initialize the native frontier itself.
    caller = makeCaller(memory); await caller.initialize(freeze(read(snapshot.observation)));
    check('initial caller objects', caller.state(), read(snapshot.state)); compareFacts(memory, snapshot, 'initial caller facts');
  } else if (snapshot.stage === 'released') {
    memory = memoryFrom(snapshot); caller = makeCaller(memory); caller.restore(read(snapshot.state));
    release = snapshot; proposal = read(snapshot.proposal);
    check('source checkpoint round-trip ' + snapshot.decisionRevision, caller.state(), read(snapshot.state));
  } else if (snapshot.stage === 'before_assessment') {
    if (!memory || !caller || !release) throw new Error('Acquisition without a captured released prefix');
    const before = freeze(read(snapshot.observation)), after = freeze(read(snapshot.after));
    transition = { before, after, command: read(snapshot.command), first: packet(read(snapshot.beforePublic)), second: packet(read(snapshot.afterPublic)),
      index: snapshot.transitionIndex, outcome: { status: 'witnessed_public_outcome' } };
    if (proposal.kind === 'experiment' || proposal.view_plan) {
      const guard = oracle.execution.find((event: any) => event.event === 'path_guard'
        && event.decision_revision === release.decisionRevision && event.action_index === transition.index);
      if (!guard) throw new Error('Original physical guard receipt missing');
      check('actual path guard at revision ' + snapshot.revision,
        await caller.before(proposal, transition.index, transition.first, before), guard.result);
      const sealed = oracle.snapshots.find((event: any) => event.stage === 'prefix_analyzed' && event.decisionRevision === release.decisionRevision);
      const expectedOutcome = read(sealed.set_record).step_expectations[transition.index].frontier_outcome;
      check('actual outcome guard at revision ' + snapshot.revision,
        await caller.after(proposal, transition.index, before, after, transition.first.frame_rows, transition.second.frame_rows), expectedOutcome);
    }
    const actual = await caller.beforeAssessment(transition, proposal);
    const expected = {
      attention_result: snapshot.attention_result ? read(snapshot.attention_result) : null,
      view_result: snapshot.sight ? read(snapshot.sight) : null,
      selected_result: null, // Selected-family acquisition has its own source oracle.
      goal_events: read(snapshot.goal_events), point_experiment_result: read(snapshot.comparison),
      control_experiment_result: read(snapshot.control_result),
      information_goal_result: snapshot.transitionIndex === 0 && proposal.question?.curiosity ? read(snapshot.curiosity_result) : null,
    };
    check('acquisition returns at revision ' + snapshot.revision, actual, expected);
    check('caller state before assessment at revision ' + snapshot.revision, caller.state(), read(snapshot.state));
    compareFacts(memory, snapshot, 'caller facts before assessment at revision ' + snapshot.revision);
    const have = new Set(memory.dynamicState().facts.map(fact => fact.key));
    const missing = read(snapshot.memory).facts.filter((fact: any) => !have.has(fact.key));
    unsupported.push({ revision: snapshot.revision, sourceWritesOutsideCoordinator: missing.map((fact: any) => ({ key: fact.key, evidence: fact.evidence, revision: fact.revision })) });
  } else if (snapshot.stage === 'transition_acquired' || snapshot.stage === 'boundary_acquired') {
    if (!memory || !caller || !transition) throw new Error('Acquired boundary without public transition');
    let assessment: any = null;
    if (snapshot.stage !== 'boundary_acquired') {
      let prior: any[] = read(release.frozen).prior_rules;
      if (transition.index !== 0) prior = memory.get(episode, 'empirical_registry').value;
      assessment = await assessTransition(transition.before, transition.after, transition.command, prior);
      if (transition.command.action_ref === 'ACTION6') {
        const priorProperties = transition.index === 0 ? read(release.frozen).prior_property_rules : memory.get(episode, 'property_rules').value;
        const properties = await assessPropertyTransition(transition.before, transition.after, transition.command, priorProperties);
        assessment.property_rules = properties.property_rules; assessment.addressed_assessment = properties;
        memory.put(episode, 'property_rules', properties.property_rules, transition.after.observation_ref, transition.after.revision);
      }
      check('full learning assessment at revision ' + transition.before.revision, assessment, read(snapshot.assessment));
    }
    await caller.recordAssessment(transition, assessment);
    if (assessment) memory.put(episode, 'empirical_registry', assessment.empirical_rules, transition.after.observation_ref, transition.after.revision);
    check('caller state after acquisition at revision ' + snapshot.revision, caller.state(), read(snapshot.state));
    compareFacts(memory, snapshot, 'caller facts after acquisition at revision ' + snapshot.revision);
  }
}

const result = { schema: 'v6-native-caller-differential.v1', oracle: oracle.publicProtocol.provenance,
  qualifications: ['Original main and per-transition memory were captured without source/AST modification.',
    'This differential restores each original released-prefix checkpoint; it tests common acquisition, not complete strategy selection.',
    'Selected-family acquisition is excluded here and verified by its separate original-family differential.',
    'Original post-prefix WHY/ACT reports/facts/traces are in the fixture; this driver does not rerun those operations.',
    'Source acquisitions outside the current coordinator remain explicitly listed and are not claimed as transferred.'],
  passed: checks.filter(check => check.passed).length, failed: checks.filter(check => !check.passed).length, checks, unsupported };
return result;
}
