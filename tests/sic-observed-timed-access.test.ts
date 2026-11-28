import assert from 'node:assert/strict';
import test from 'node:test';
import { composeObservedTimedAccess, type ObservedTimedAccess } from '../src/sic/observed-timed-access.ts';
import { P05AcquisitionLedger, type P05Observation, type P05PublicReturn } from '../src/sic/p05-acquisition.ts';
import { createTemporalEvidence } from '../src/sic/temporal-evidence.ts';
import { createNativeBridge } from '../experiments/sic-blind-composition/native.mjs';

// The executor owns the cause and timing of the gate. The policy receives its returns only.
function room(epoch: string) {
  let tick = 0, position = 'start', reserve = 1, readyAt = Infinity;
  const observation = (): P05Observation => ({ ref: `${epoch}:${tick}`, epoch, tick, selected: 'body',
    subjects: [{ id: 'body', position: [position === 'exit' ? 1 : 0, 0] }],
    context: { floor: 'panel' }, reserve, remote: Number(tick >= readyAt) });
  const frame = () => ({ tick, ref: `${epoch}:clock:${tick}`, reliable: true, value: Number([2, 3].includes(tick % 5)) });
  function step(command: string) {
    const before = observation(), frames = [];
    if (command === 'press') {
      assert.equal(reserve, 1);
      reserve--;
      readyAt = tick + 3;
    }
    const duration = command === 'cross' ? 2 : 1;
    for (let i = 0; i < duration; i++) { tick++; frames.push(frame()); }
    if (command === 'cross' && frames.every(item => item.value === 1 && item.tick >= readyAt)) position = 'exit';
    const after = observation();
    const receipt: P05PublicReturn = { id: after.ref, kind: command === 'wait' ? 'wait' : 'command',
      command, before, after, elapsed: duration };
    return { frames, receipt };
  }
  return { observation, step, position: () => position, frame };
}

test('P05 acquisition and dated P14 evidence yield an executed two-tick P07 crossing via P09', () => {
  const ledger = new P05AcquisitionLedger({ maxLatency: 2 }), trial = room('probe'), control = room('control');
  for (const action of ['wait', 'wait', 'wait']) ledger.addReturn(control.step(action).receipt);
  for (const action of ['press', 'wait', 'wait']) ledger.addReturn(trial.step(action).receipt);
  const claim = ledger.claims()[0];
  assert.ok(claim);
  assert.equal(claim.delay, 2);
  assert.equal(claim.remoteDelta, 1);

  const world = room('play'), clock = createTemporalEvidence({ witnesses: 4 });
  clock.observe(world.frame());
  let moves = 6; // Both acquisition trials are real commands in the common budget.
  for (let i = 0; i < 22; i++) {
    clock.observe(world.step('wait').frames[0]!);
    moves++;
  }
  let explored = 0, pendingUntil: number | undefined;
  function input(): ObservedTimedAccess {
    const observation = world.observation();
    return { observation, position: world.position(), target: 'exit', activation: { command: 'press', from: 'start' },
      wait: 'wait', pendingUntil, enabled: observation.reserve ? ['press', 'wait', 'cross'] : ['wait', 'cross'],
      edges: [{ command: 'cross', from: 'start', to: 'exit', duration: 2, timed: true }], ledger,
      windowAt: tick => clock.predict(tick), budget: { commands: 64 - moves, states: 12_000, lastTick: 40 },
      chargeState: () => { if (explored >= 12_000) return false; explored++; return true; } };
  }
  const ablated = ledger.withoutReturn(claim.supportingReturnIds[0]!);
  assert.equal(composeObservedTimedAccess({ ...input(), ledger: ablated }).step, null);
  assert.equal(composeObservedTimedAccess({ ...input(), windowAt: () => undefined }).step, null);
  const played: string[] = [];
  while (world.position() !== 'exit' && moves < 64) {
    const at = input(), decision = composeObservedTimedAccess(at);
    assert.ok(decision.step);
    const { command, openingTicks } = decision.step;
    if (command === 'press') assert.ok(decision.evidence.includes(claim.supportingReturnIds[0]!));
    if (command === 'cross') {
      assert.equal(at.observation.remote, 1);
      assert.equal(openingTicks.length, 2);
      assert.ok(decision.evidence.some(ref => ref.startsWith('play:clock:')));
      for (const tick of openingTicks) {
        const partial = composeObservedTimedAccess({ ...at, budget: { ...at.budget, lastTick: openingTicks.at(-1)! },
          windowAt: next => next === tick ? undefined : at.windowAt(next) });
        assert.equal(partial.step, null);
      }
    }
    const result = world.step(command);
    if (command === 'press') pendingUntil = result.receipt.after!.tick + claim.delay;
    for (const frame of result.frames) clock.observe(frame);
    played.push(command);
    moves++;
  }
  assert.equal(world.position(), 'exit');
  assert.equal(played.filter(action => action === 'press').length, 1);
  assert.equal(played.at(-1), 'cross');
  assert.ok(explored < 12_000);
  assert.equal(composeObservedTimedAccess({ ...input(), position: 'start', chargeState: () => false }).explored, 0);
});

test('the composed crossing needs a real terminal return through V6 tickets', async () => {
  const ledger = new P05AcquisitionLedger({ maxLatency: 2 }), trial = room('probe'), control = room('control');
  for (const action of ['wait', 'wait', 'wait']) ledger.addReturn(control.step(action).receipt);
  for (const action of ['press', 'wait', 'wait']) ledger.addReturn(trial.step(action).receipt);
  const world = room('play'), frames = [world.frame()];
  for (let i = 0; i < 22; i++) frames.push(world.step('wait').frames[0]!);

  // Encode the public alphabet independently of the actual room timing.
  const views: Record<string, { view: string }> = {};
  const encode = (tick: number, position: string, reserve: number, remote: number, bits: number[]) =>
    JSON.stringify([tick, position, reserve, remote, bits]);
  for (let tick = 22; tick <= 40; tick++) for (const position of ['start', 'exit']) {
    for (const reserve of [0, 1]) for (const remote of [0, 1]) for (const bits of [[0], [1], [0, 0], [0, 1], [1, 0], [1, 1]]) {
      const key = encode(tick, position, reserve, remote, bits);
      views[key] = { view: key };
    }
  }
  const initial = encode(22, 'start', 1, 0, [world.frame().value]);
  let recent = initial, pendingUntil: number | undefined, issued: string | undefined, states = 0, actions = 0;
  const clock = createTemporalEvidence({ witnesses: 4 });
  for (const sample of frames) clock.observe(sample);
  const runtime = createNativeBridge({ actions: ['press', 'wait', 'cross'], budget: { commands: 36, states: 12_000 },
    worlds: [{ start: initial, nodes: views }] }, {
    decide() {
      const [tick, position, reserve, remote] = JSON.parse(recent);
      const observation: P05Observation = { tick, ref: `play:${tick}`, epoch: 'play', selected: 'body',
        subjects: [{ id: 'body', position: [position === 'exit' ? 1 : 0, 0] }], context: { floor: 'panel' }, reserve, remote };
      const decision = composeObservedTimedAccess({ observation, position, target: 'exit',
        activation: { command: 'press', from: 'start' }, pendingUntil, wait: 'wait',
        enabled: reserve ? ['press', 'wait', 'cross'] : ['wait', 'cross'],
        edges: [{ command: 'cross', from: 'start', to: 'exit', duration: 2, timed: true }], ledger,
        windowAt: next => clock.predict(next), budget: { commands: 36 - actions, states: 12_000, lastTick: 40 },
        chargeState() { if (states >= 12_000) return false; states++; return true; } });
      issued = decision.step?.command;
      return issued ? { action: issued } : { stop: 'no_verified_route' };
    },
    expects: ({ view }: { view: string }) => Object.hasOwn(views, view),
    record({ view }: { view: string }) {
      const [tick, , , , bits] = JSON.parse(view);
      for (let i = 0; i < bits.length; i++) {
        const at = tick + i + 1 - bits.length;
        clock.observe({ tick: at, ref: `play:clock:${at}`, reliable: true, value: bits[i] });
      }
      if (issued === 'press') pendingUntil = tick + ledger.claims()[0]!.delay;
      recent = view;
      actions++;
      return { received: true };
    },
    // The authored fixture stays in one service session without rehydration.
    checkpoint: () => null,
    restore() { throw new Error('The fixture must replay from public returns'); },
  });

  let decision = await runtime.start(), sealed = 0;
  while (decision?.action && sealed < 36) {
    assert.equal(decision.nativeTicket, true);
    const actual = world.step(decision.action);
    const { tick, reserve, remote } = actual.receipt.after!;
    const outcome = world.position() === 'exit' ? 'win' : null;
    const next = await runtime.advance({ view: encode(tick, world.position(), reserve, remote,
      actual.frames.map(frame => frame.value)), outcome });
    assert.equal(next.nativeSealed, true);
    sealed++;
    decision = next.decision;
  }
  assert.equal(world.position(), 'exit');
  assert.equal(actions, sealed);
  assert.ok(sealed > 1 && actions + 28 <= 64 && states <= 12_000);
});
