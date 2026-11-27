import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';
import type { NativeFamily, NativePoint } from '../src/logos-engine/v6-native-types.ts';
import { createSicObservedCarrierReduction } from '../src/sic/observed-carrier-reduction.ts';
import { planningGroupsWithExperiments } from '../src/sic/experiment-selection-groups.ts';
import { standalonePlanningGroups } from '../src/sic/standalone-families.ts';
import { observedPressureRecoveryGroup } from '../src/sic/public-input-exploration.ts';
import { preparedEffectsId } from '../src/sic/test-prepared-effects.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation, type V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import type { GameObservation } from '../src/runtime/browser-games.ts';

const key = (point: NativePoint) => point.join(',');
const same = (first: NativePoint, second: NativePoint) => key(first) === key(second);

// These small rooms implement public jumps and carrier movement independently
// of the production planner. The first room teaches reduction through actual
// native clicks; the second teaches the input relation; the third moves the
// instances and adds a carried auxiliary while a competing preview is ready.
function publicRooms(varied: boolean) {
  const unit = varied ? 4 : 3, pitch = unit + 2, phase: NativePoint = varied ? [2, 1] : [1, 2];
  const ink = (value: number) => varied ? (value * 5 + 3) % 16 : value;
  const at = ([x, y]: NativePoint): NativePoint => varied ? [y + 1, x] : [x, y];
  const vector = ([x, y]: NativePoint): NativePoint => varied ? [y, x] : [x, y];
  const controls: Record<string, NativePoint> = varied
    ? { ACTION1: vector([-1, 0]), ACTION2: vector([0, -1]), ACTION3: vector([0, 1]), ACTION4: vector([1, 0]) }
    : { ACTION1: [0, -1], ACTION2: [0, 1], ACTION3: [-1, 0], ACTION4: [1, 0] };
  let level = 1, completed = 0, selected: NativePoint | null = null;
  let pegs: NativePoint[] = [], auxiliaries: NativePoint[] = [], carriers: NativePoint[] = [], floor: NativePoint[] = [], rails: NativePoint[] = [];
  function enter() {
    selected = null;
    const column = level === 2 ? 3 : 2;
    pegs = (level === 1 ? [[1, 2], [2, 2], [4, 2]] : [[column, 5], [column + 1, 3]]).map(point => at(point as NativePoint));
    auxiliaries = level === 3 ? [at([6, 5])] : [];
    carriers = level === 1 ? [] : [at([column, 5]), ...auxiliaries.map(point => [...point] as NativePoint)];
    floor = (level === 1 ? [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [0, 1], [1, 1], [5, 1], [7, 4]]
      : [[column + 1, 3], [column + 2, 3], [0, 1], [1, 1], [5, 1], [7, 2], [0, 4], [7, 6]])
      .map(point => at(point as NativePoint));
    rails = level === 1 ? [] : [column, ...(level === 3 ? [6] : [])].flatMap(x =>
      Array.from({ length: 6 }, (_, y) => at([x, y + 1])));
  }
  enter();
  const pixels = ([x, y]: NativePoint): NativePoint => [phase[0] + x * pitch, phase[1] + y * pitch];
  function frame(ambiguous = false) {
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(0)));
    const fill = (point: NativePoint, color: number, token = false) => {
      const [x, y] = pixels(point);
      for (let dy = 0; dy < unit; dy++) for (let dx = 0; dx < unit; dx++) {
        const corner = varied ? (dx === 0 || dx === unit - 1) && (dy === 0 || dy === unit - 1)
          : dx === 0 && dy === 0 || dx === unit - 1 && dy === unit - 1;
        if (!token || !corner) rows[y + dy]![x + dx] = ink(color);
      }
    };
    for (const point of floor) fill(point, 3);
    const mid = Math.floor(unit / 2);
    for (const point of rails) {
      const [x, y] = pixels(point);
      rows[y + mid]![x + mid] = ink(5);
      for (const delta of [[0, 1], [1, 0]] as NativePoint[]) {
        if (!rails.some(other => same(other, [point[0] + delta[0], point[1] + delta[1]]))) continue;
        for (let i = 0; i <= pitch; i++) rows[y + mid + delta[1] * i]![x + mid + delta[0] * i] = ink(5);
      }
    }
    for (const point of carriers) {
      const [x, y] = pixels(point);
      for (let dy = -1; dy <= unit; dy++) for (let dx = -1; dx <= unit; dx++) {
        if (dy === -1 || dy === unit || dx === -1 || dx === unit) rows[y + dy]![x + dx] = ink(11);
      }
    }
    for (const point of pegs) fill(point, 7, true);
    for (const point of auxiliaries) fill(point, 9, true);
    if (selected) { const [x, y] = pixels(selected); rows[y]![x] = ink(14); }
    if (ambiguous) fill(at([0, 6]), 13, true);
    return rows;
  }
  function packet(ambiguous = false): GameObservation {
    const rows = frame(ambiguous);
    return { gameCode: 'PUBLIC', frame: rows, frames: [rows], state: completed === 3 ? 'WIN' : 'NOT_FINISHED',
      level, levelCount: 3, levelsCompleted: completed, availableActionIds: [1, 2, 3, 4, 6], canUndo: false, canSelectLevel: true, defaultFps: 10 };
  }
  function act(ticket: V6Ticket, contradiction = false) {
    if (contradiction) return;
    if (ticket.actionRef === 'ACTION6') {
      const point: NativePoint = [Math.floor((Number(ticket.data.x) - phase[0]) / pitch), Math.floor((Number(ticket.data.y) - phase[1]) / pitch)];
      if (pegs.some(peg => same(peg, point))) selected = point;
      else if (selected && (floor.some(cell => same(cell, point)) || carriers.some(cell => same(cell, point)))) {
        const mid: NativePoint = [(selected[0] + point[0]) / 2, (selected[1] + point[1]) / 2];
        const distance = Math.abs(selected[0] - point[0]) + Math.abs(selected[1] - point[1]);
        if (distance === 2 && (selected[0] === point[0] || selected[1] === point[1]) && pegs.some(peg => same(peg, mid))) {
          pegs = [...pegs.filter(peg => !same(peg, selected!) && !same(peg, mid)), point];
          selected = null;
        }
      }
    } else {
      const delta = controls[ticket.actionRef]!;
      const occupied = new Set(carriers.map(key));
      carriers = carriers.map(point => {
        const next: NativePoint = [point[0] + delta[0], point[1] + delta[1]];
        if (!rails.some(cell => same(cell, next)) || occupied.has(key(next))
          || pegs.some(peg => same(peg, next)) || auxiliaries.some(auxiliary => same(auxiliary, next))) return point;
        pegs = pegs.map(peg => same(peg, point) ? next : peg);
        auxiliaries = auxiliaries.map(auxiliary => same(auxiliary, point) ? next : auxiliary);
        return next;
      });
      selected = null;
    }
    if (pegs.length === 1) { completed++; if (completed < 3) { level++; enter(); } }
  }
  const training = [[1, 2], [3, 2], [3, 2], [5, 2]].map(point => {
    const [x, y] = pixels(at(point as NativePoint));
    return { action_ref: 'ACTION6', data: { x: x + Math.floor(unit / 2), y: y + Math.floor(unit / 2) } };
  });
  return { packet, act, training, controls, get level() { return level; }, get completed() { return completed; } };
}

async function start(varied = false, ambiguous = false) {
  const room = publicRooms(varied), family = createSicObservedCarrierReduction();
  let trained = 0;
  const trainer: NativeFamily = {
    id: 'public_reduction_demonstration',
    async propose(observation, rows) {
      if (observation.levels_completed) return null;
      const action = room.training[trained]!;
      const point = await ObservedInputDomain.makeLocusWitness(observation, rows, [action.data.x, action.data.y],
        { reason: 'Observe a supported population-reducing jump', evidence: [observation.observation_ref] });
      assert.ok(point);
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action, point_binding: point }], binding: { observation_ref: observation.observation_ref } };
    },
    before: (proposal, _index, _packet, observation) => ({ admitted: proposal.binding?.observation_ref === observation.observation_ref, reason: 'public_training_click' }),
    after: () => ({ matched: true, seal_prefix: true, reason: 'public_training_return' }),
    async record(before, after, action, first, second) {
      await family.observePublicOutcome!(before, after, action, first, second);
      trained++;
      return { events: [] };
    }, state: () => ({ trained }), restore(value) { trained = Number(value.trained); },
  };
  const fallback: NativeFamily = {
    id: preparedEffectsId,
    proposeInSubquestion(_group, _entry, ...args) { return this.propose(...args); },
    propose(observation) {
      const state = family.state().state as Record<string, any> | null;
      if (observation.levels_completed !== 2 || state?.epoch !== observation.level_epoch) return null;
      const action = { action_ref: 'ACTION4', data: {} };
      return { status: 'proposed', kind: this.id, actions: [action], steps: [{ action }], binding: { observation_ref: observation.observation_ref } };
    },
    before: () => ({ admitted: true, reason: 'independent_preview' }),
    after: () => ({ matched: null, seal_prefix: true, reason: 'independent_preview_return' }),
    record: () => ({ events: [] }), state: () => ({}), restore() {},
  };
  const calls: { group: string; epoch: number; proposed: boolean }[] = [];
  const original = family.proposeInGroup!.bind(family);
  family.proposeInGroup = async (group, observation, ...args) => {
    const proposal = await original(group, observation, ...args);
    calls.push({ group, epoch: observation.level_epoch, proposed: proposal !== null });
    return proposal;
  };
  const groups = planningGroupsWithExperiments(standalonePlanningGroups).map(group => {
    const entries = group.families.flatMap((id, index) => [family.id, fallback.id].includes(id)
      ? [{ id, entry: group.entryPoints?.[index] ?? null }] : []);
    return { ...group, families: entries.map(item => item.id), entryPoints: entries.map(item => item.entry) };
  }).filter(group => group.families.length);
  groups.unshift({ id: 'public_demonstration', families: [trainer.id], entryPoints: [null] });
  const runtime = new NativeV6Runtime({ families: [trainer, family, fallback], groups, sourceDigest: 'carrier-preparation-transfer', maxPointOccurrences: 200 });
  const service = new V6AgentService(() => runtime), sessionId = 'carrier-transfer-' + varied + '-' + ambiguous;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(room.packet()), budgets: { targetLevels: 3, levelActionCaps: [30, 30, 30] } });
  const issued: V6Ticket[] = [];
  async function next(contradiction = false) {
    assert.ok(result.ticket, JSON.stringify({ sequence, level: room.level, reason: result.snapshot.reason, trace: result.snapshot.trace.slice(-5), state: family.state() }));
    const ticket = result.ticket; issued.push(ticket); room.act(ticket, contradiction);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id, executionMs: 1,
      observation: toV6PublicObservation(room.packet(ambiguous && room.level === 3), sequence) });
    if (!result.ticket && room.completed < 3) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  while (room.level < 3) { assert.ok(issued.length < 25); await next(); }
  return { room, family, runtime, issued, calls, next, get result() { return result; } };
}

for (const varied of [false, true]) test('native carrier preparation continues its learned control before an independent preview'
  + (varied ? ' with a different shape, palette, layout and input mapping' : ''), async () => {
  const run = await start(varied);
  try {
    const recalled = structuredClone(run.family.state().recalled) as Record<string, any>;
    assert.ok(recalled.controls[varied ? 'ACTION2' : 'ACTION1']);
    assert.equal(run.result.snapshot.proposal?.kind, run.family.id);
    assert.equal(run.result.ticket?.actionRef, varied ? 'ACTION2' : 'ACTION1', 'The first useful input reuses the observed control');
    const transferred = run.result.snapshot.proposal!;
    assert.ok(Object.values(recalled.controls).every((value: any) => transferred.route_refs.includes(value.ref)));
    await run.next();
    assert.equal(run.result.snapshot.proposal?.kind, run.family.id);
    assert.equal(run.calls.at(-1)?.group, observedPressureRecoveryGroup);
    while (run.room.completed < 3) { assert.ok(run.issued.length < 30); await run.next(); }
    assert.equal(run.result.snapshot.levelsCompleted, 3);
    assert.ok(run.issued.filter(ticket => ticket.level === 3).every(ticket => ticket.nativeExecutionDigest && ticket.graphChain));
    const returns = run.result.snapshot.trace.filter(event => event.kind === 'actual_outcome' && event.family === run.family.id);
    assert.ok(returns.length >= 4 && returns.every(event => event.matched === true || event.matched === null));
    assert.ok(run.calls.some(call => call.epoch === 3 && call.group === observedPressureRecoveryGroup && call.proposed));
  } finally { run.runtime.close('test_complete'); }
});

test('an ambiguous auxiliary appearance cannot acquire early carrier ownership', async () => {
  const run = await start(false, true);
  try {
    assert.ok(run.family.state().recalled);
    assert.ok(!run.calls.some(call => call.epoch === 3 && call.group === observedPressureRecoveryGroup && call.proposed));
    assert.notEqual(run.result.snapshot.proposal?.kind, run.family.id);
  } finally { run.runtime.close('test_complete'); }
});

test('a contradicted carrier translation closes preparation and retains the established input evidence', async () => {
  const run = await start();
  try {
    const recalled = structuredClone(run.family.state().recalled);
    await run.next(true);
    assert.ok(run.result.snapshot.trace.some(event => event.kind === 'actual_outcome' && event.family === run.family.id && event.matched === false));
    assert.equal((run.family.state().state as Record<string, any>).stopped, true);
    assert.deepEqual(run.family.state().recalled, recalled);
    assert.equal(run.result.snapshot.proposal?.kind, preparedEffectsId);
    assert.ok(!run.calls.some(call => call.epoch === 3 && call.group === observedPressureRecoveryGroup && call.proposed));
  } finally { run.runtime.close('test_complete'); }
});

test('early carrier continuation requires current evidence and a known input for the retained preparation', async () => {
  const run = await start();
  try {
    await run.next();
    const retained = structuredClone(run.family.state()) as Record<string, any>;
    const observation = (run.runtime as any).observation, rows = run.room.packet().frame;
    const inputs = observation.available_action_refs.map((action_ref: string) => ({ action_ref, data: {} }));
    for (const state of [
      { ...retained.state, refs: retained.state.refs.slice(0, -1) },
      { ...retained.state, epoch: retained.state.epoch - 1 },
      { ...retained.state, stopped: true },
      { ...retained.state, segment: null },
      { ...retained.state, controls: {} },
    ]) {
      run.family.restore({ ...retained, state });
      assert.equal(await run.family.proposeInGroup!(observedPressureRecoveryGroup, observation, rows, inputs, 20), null);
      assert.deepEqual(run.family.state().recalled, retained.recalled);
    }
    run.family.restore(retained);
    const continued = await run.family.proposeInGroup!(observedPressureRecoveryGroup, observation, rows, inputs, 20);
    assert.equal(continued?.choice.stage, 'move');
  } finally { run.runtime.close('test_complete'); }
});
