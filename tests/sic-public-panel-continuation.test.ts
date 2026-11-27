import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { measureNativeObservation, ObservedInputDomain, rowsDigest } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeCommand, NativeFamily, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { createSicPublicInputExploration, continueObservedPanelGroup, observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { learnPatternAccessId } from '../src/sic/framed-contact.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { commandPanelState, visibleCommandPanel } from '../src/sic/visible-command-panel.ts';

type Uncertain = 'missing_actor' | 'ambiguous_actor' | 'missing_control';

// Two independent public rooms vary the control shapes, palette, positions and
// command bindings. The second room also mirrors the complete interface.
function panelRoom(varied: boolean, uncertain?: Uncertain) {
  const pigment = (value: number) => varied ? (value * 5 + 3) % 16 : value;
  const point = ([x, y]: NativePoint): NativePoint => varied ? [63 - x, y] : [x, y];
  const controls: Record<string, NativePoint> = varied
    ? { ACTION1: [-2, 0], ACTION2: [2, 0], ACTION3: [0, -2], ACTION4: [0, 2] }
    : { ACTION1: [0, -2], ACTION2: [0, 2], ACTION3: [-2, 0], ACTION4: [2, 0] };
  let actor: NativePoint = varied ? [8, 22] : [10, 20], phase = 0, moves = 0, completed = false;
  const target: NativePoint = varied ? [20, 12] : [18, 14];
  const buttons = [0, 1, 2, 3].map(index => varied
    ? [43 + 5 * index, 6, 46 + 5 * index, 7] as const
    : [44 + 5 * index, 8, 46 + 5 * index, 10] as const);
  const clickPoint = point(varied ? [44, 6] : [45, 9]);
  const training: NativeCommand[] = [
    { action_ref: varied ? 'ACTION2' : 'ACTION4', data: {} },
    { action_ref: varied ? 'ACTION3' : 'ACTION1', data: {} },
    { action_ref: 'ACTION6', data: { x: clickPoint[0], y: clickPoint[1] } },
  ];
  function frame() {
    const rows = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, x) => {
      if (x < 38) return 2;
      return x < 40 ? 0 : 3;
    }));
    for (const [index, [left, top, right, bottom]] of buttons.entries()) {
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
        rows[y]![x] = moves >= 3 && uncertain === 'missing_control' && index === 0 ? 12 : 6 + index;
      }
    }
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) rows[target[1] + y]![target[0] + x] = (x + y + phase) % 2 ? 6 : 7;
    const paint = ([left, top]: NativePoint) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) rows[top + y]![left + x] = 14;
    };
    if (!(moves >= 3 && uncertain === 'missing_actor')) paint(actor);
    if (moves >= 3 && uncertain === 'ambiguous_actor') paint([30, 30]);
    return rows.map(row => (varied ? [...row].reverse() : row).map(pigment));
  }
  function packet(): GameObservation {
    const rows = frame();
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], state: completed ? 'WIN' : 'NOT_FINISHED',
      level: 1, levelCount: 1, levelsCompleted: Number(completed), availableActionIds: [1, 2, 3, 4, 6],
      canUndo: false, canSelectLevel: false, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, contradiction = false) {
    const motion = controls[ticket.actionRef];
    if (motion) {
      if (!contradiction) actor = [actor[0] + motion[0], actor[1] + motion[1]];
    } else if (ticket.actionRef === 'ACTION6') {
      const physical = point([ticket.data!.x!, ticket.data!.y!]);
      const [left, top, right, bottom] = buttons[0]!;
      if (physical[0] >= left && physical[0] <= right && physical[1] >= top && physical[1] <= bottom) {
        if (actor[0] === target[0] && actor[1] === target[1]) completed = true;
        else phase = 1 - phase;
      }
    }
    moves++;
  }
  assert.ok(visibleCommandPanel(frame()));
  return { packet, act, training, get completed() { return completed; } };
}

// Another registered role supplies three measured acquisition commands. The
// public family learns only through the real native advance/seal observer.
function witnessSource(actions: NativeCommand[]) {
  let calls = 0;
  const family: NativeFamily = {
    id: learnPatternAccessId,
    async propose(observation, rows) {
      const action = actions[calls];
      if (!action) return null;
      const point_binding = action.action_ref === 'ACTION6' ? await ObservedInputDomain.makeLocusWitness(observation, rows,
        [action.data.x!, action.data.y!], { reason: 'Observe the current public control', evidence: [observation.observation_ref] }) : undefined;
      return { status: 'proposed', kind: this.id, actions: [action], steps: [point_binding ? { point_binding } : {}],
        sicLocalDecision: { strategy: 'observe_public_control' } };
    },
    before: () => ({ admitted: true, reason: 'public_acquisition_bound' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'public_acquisition_return' }),
    record: () => { calls++; return { events: [] }; },
    state: () => ({ calls }), restore: state => { calls = state.calls as number; },
  };
  return { family, get complete() { return calls === actions.length; } };
}

async function acquiredPanel(varied = false, uncertain?: Uncertain, knownMechanism = false) {
  const room = panelRoom(varied, uncertain), learner = witnessSource(knownMechanism ? [...room.training, room.training[2]!] : room.training), family = createSicPublicInputExploration(true);
  const calls: { group: string; proposed: boolean }[] = [];
  const propose = family.proposeInGroup!.bind(family);
  family.proposeInGroup = async (group, ...args) => {
    const proposal = await propose(group, ...args);
    calls.push({ group, proposed: !!proposal });
    return proposal;
  };
  const fallback: NativeFamily = {
    id: preparedEffectsId,
    proposeInSubquestion(group, _entry, ...args) {
      return group === observedPressureRecoveryGroup ? null : this.propose(...args);
    },
    propose(observation) {
      if (!learner.complete) return null;
      const action = { action_ref: 'ACTION2', data: {} };
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }],
        binding: { observation_ref: observation.observation_ref } };
    },
    before: () => ({ admitted: true, reason: 'independent_probe_bound' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'independent_probe_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const families = [family, learner.family, fallback];
  const groups = planningGroupsWithExperiments(standalonePlanningGroups, false, false).map(group => {
    const entries = group.families.flatMap((id, index) => families.some(item => item.id === id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  const runtime = new NativeV6Runtime({ families, groups, adaptiveReasoning: true,
    sourceDigest: 'public-panel-continuation', maxPointOccurrences: 100 });
  const service = new V6AgentService(() => runtime), sessionId = 'panel-continuation-' + varied + '-' + uncertain;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 1, levelActionCaps: [40] } });
  const issued: V6Ticket[] = [], outcomes: Record<string, unknown>[] = [], seals: Record<string, unknown>[] = [];
  async function advance(contradiction = false, resume = true) {
    assert.ok(result.ticket, JSON.stringify({ reason: result.snapshot.reason, actions: result.snapshot.actions }));
    const ticket = result.ticket; issued.push(ticket); room.act(ticket, contradiction);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(), sequence) });
    const trace = result.snapshot.trace as Record<string, unknown>[];
    const outcome = trace.findLast(event => event.kind === 'actual_outcome');
    if (outcome) outcomes.push(outcome);
    if (result.kind === 'boundary' || result.kind === 'stopped') {
      const seal = trace.findLast(event => event.kind === 'sealed_prefix');
      if (seal) seals.push(seal);
    }
    if (resume && !result.ticket && !room.completed) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  for (let i = 0; i < 3; i++) {
    assert.equal(result.snapshot.proposal?.kind, learner.family.id);
    assert.equal(result.ticket!.actionRef, room.training[i]!.action_ref);
    await advance();
  }
  return { room, family, runtime, calls, issued, outcomes, seals, advance, get result() { return result; } };
}

for (const varied of [false, true]) test('native panel interaction reuses foreign measured controls before independent probes' + (varied ? ' after changing shapes, pigments, placement and commands' : ''), async () => {
  const run = await acquiredPanel(varied);
  try {
    assert.equal(run.result.snapshot.proposal?.kind, run.family.id);
    assert.equal(run.calls.at(-1)?.group, continueObservedPanelGroup);
    assert.ok(run.result.snapshot.proposal?.panelApproach);
    const proof = structuredClone(run.family.state());
    const controls = proof.panelWalker as { controls: Record<string, { evidence: string }> };
    assert.equal(Object.keys(controls.controls).length, 2);
    const refs = Object.values(controls.controls).map(control => control.evidence);
    assert.ok(refs.every(ref => run.result.snapshot.proposal?.route_refs?.includes(ref)));
    assert.ok(refs.every(ref => ref.includes(sessionScope(run.result.ticket!.observationRef))));
    const revision = run.result.ticket!.decisionRevision;
    const planned = run.result.snapshot.proposal!.actions.length;
    assert.ok(planned > 1 && planned <= 16);
    while (run.result.ticket?.decisionRevision === revision) await run.advance();
    assert.deepEqual(run.issued.slice(3).map(ticket => ticket.actionIndex), Array.from({ length: planned }, (_, i) => i));
    assert.ok(run.outcomes.slice(3).every(event => event.matched === true));
    assert.equal(run.seals.filter(seal => seal.family === run.family.id).length, 1);
    assert.equal(run.seals.at(-1)?.acquired_actions, planned);
    assert.equal(run.result.snapshot.proposal?.kind, run.family.id);
    assert.ok(run.result.snapshot.proposal?.panelComparison);
    assert.equal(run.result.ticket?.actionRef, 'ACTION6');
    await run.advance();
    assert.equal(run.room.completed, true, 'The actual marked contact, after the preparation, produces the official score');
    assert.equal(run.result.snapshot.levelsCompleted, 1);
    assert.equal(run.issued.length, 3 + planned + 1);
  } finally { run.runtime.close('test_complete'); }
});

function sessionScope(ref: string) { return ref.split(':epoch:')[0]! + ':epoch:'; }

for (const uncertain of ['missing_actor', 'ambiguous_actor', 'missing_control'] as const) test('native acquired panel priority refuses ' + uncertain, async () => {
  const run = await acquiredPanel(false, uncertain);
  try {
    assert.ok(run.calls.some(call => call.group === continueObservedPanelGroup && !call.proposed));
    assert.equal(run.result.snapshot.proposal?.kind, preparedEffectsId);
    assert.ok(run.family.state().panelWalker, 'Previously measured directions remain documented');
  } finally { run.runtime.close('test_complete'); }
});

test('a contradictory panel movement seals only the executed prefix and preserves the other public facts', async () => {
  const run = await acquiredPanel(), prior = structuredClone(run.family.state());
  try {
    const reply = await run.advance(true, false);
    assert.equal(reply.kind, 'boundary');
    assert.equal(reply.ticket, null);
    assert.equal(run.outcomes.at(-1)?.matched, false);
    assert.equal(run.outcomes.at(-1)?.reason, 'panel_walk_step_contradicted');
    assert.equal(run.seals.at(-1)?.acquired_actions, 1);
    assert.equal(run.issued.length, 4);
    assert.deepEqual(run.family.state().panelWalker, prior.panelWalker);
    assert.deepEqual(run.family.state().panelEffects, prior.panelEffects);
    assert.equal((run.family.state().testedPanelMarkers as unknown[]).length, 1);
  } finally { run.runtime.close('test_complete'); }
});

test('a foreign, future or previous-epoch panel proof cannot establish current priority', async () => {
  const run = await acquiredPanel(), learned = structuredClone(run.family.state());
  try {
    const observation = (run.runtime as any).observation, rows = run.room.packet().frame;
    const domain = new ObservedInputDomain(100), inputs = domain.candidates(observation);
    for (const proof of ['unbound', observation.observation_ref.replace(sessionScope(observation.observation_ref), 'another-session:epoch:'),
      observation.observation_ref.replace(':epoch:1:', ':epoch:0:'),
      observation.observation_ref.replace(/:revision:\d+:/, ':revision:999:')]) {
      const state = structuredClone(learned) as any;
      for (const control of Object.values(state.panelWalker.controls) as any[]) control.evidence = proof;
      run.family.restore(state);
      assert.equal(await run.family.proposeInGroup!(continueObservedPanelGroup, observation, rows, inputs, 30), null);
    }
    run.family.restore(learned);
    assert.ok(await run.family.proposeInGroup!(continueObservedPanelGroup, observation, rows, inputs, 30));
    assert.equal(await run.family.proposeInSubquestion!('place_incoming_groups', 'unknown-entry', observation, rows, inputs, 30), null);
    assert.ok(await run.family.proposeInSubquestion!('place_incoming_groups', continueObservedPanelGroup, observation, rows, inputs, 30));
  } finally { run.runtime.close('test_complete'); }
});

test('an unmeasured direction at a landing remains an ordinary experiment without acquired panel priority', async () => {
  const run = await acquiredPanel();
  try {
    const prior = (run.runtime as any).observation, rows = run.room.packet().frame.map(row => [...row]);
    const proposal = run.result.snapshot.proposal as any, learned = structuredClone(run.family.state()) as any;
    const [left, top, right, bottom] = proposal.panelApproach.target.marker;
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) rows[y]![x] = learned.panelWalker.floor;
    const observation = await measureNativeObservation({ frame_rows: rows, frame_hash: await rowsDigest(rows),
      available_action_refs: prior.available_action_refs, state: 'NOT_FINISHED', level: prior.level_epoch,
      levels_completed: prior.levels_completed }, prior.revision + 1, prior.observation_ref.split(':epoch:')[0]);
    const panel = visibleCommandPanel(rows)!;
    // Even granting an arrival context cannot promote a direction with no
    // measured effect. This negative case does not claim a new acquired role.
    learned.panelArrival = observation.observation_ref;
    learned.lastPanelContext = commandPanelState(rows, panel, observation.available_action_refs);
    run.family.restore(learned);
    const inputs = new ObservedInputDomain(100).candidates(observation);
    const ordinary = await run.family.propose(observation, rows, inputs, 1);
    assert.ok(ordinary);
    assert.equal((ordinary.sicSrcDecision as any).situation.stage, 'calibrate_at_landing');
    assert.equal(learned.panelWalker.controls[ordinary.actions[0]!.action_ref], undefined);
    assert.equal(ordinary.panelContinuation, undefined);
    assert.equal(await run.family.proposeInGroup!(continueObservedPanelGroup, observation, rows, inputs, 1), null);
  } finally { run.runtime.close('test_complete'); }
});


test('an already bound mechanism retains priority over a competing panel approach in the native group order', async () => {
  const run = await acquiredPanel(false, undefined, true);
  try {
    assert.ok(run.family.state().panelWalker, 'The public panel controls have already been acquired');
    assert.ok((run.family.state().panelEffects as unknown[]).length, 'A public panel effect has been measured');
    assert.equal(run.result.snapshot.proposal?.kind, learnPatternAccessId,
      'The current bound mechanism is consulted before the alternative public-panel approach');
    assert.equal(run.result.ticket?.actionRef, 'ACTION6');
    await run.advance();
    assert.equal(run.issued.length, 4, 'The competing mechanism contact was actually executed');
    assert.equal(run.outcomes.at(-1)?.matched, true);
    assert.equal(run.seals.at(-1)?.acquired_actions, 1);
    assert.equal(run.result.snapshot.proposal?.kind, run.family.id,
      'The acquired panel interaction becomes available when the earlier mechanism has no next step');
  } finally { run.runtime.close('test_complete'); }
});
