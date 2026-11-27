import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import type { V6AgentResult, V6PublicObservation, V6Ticket } from '../src/runtime/v6-agent-protocol.ts';
import { createSicVerifyProfileTransfer } from '../src/sic/profile-transfer.ts';

const equal = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b);
type Alteration = 'ambiguous_marker' | 'changed_tool';

// Independent public workshop: selection, grip, exchange, fit and framed tools.
// The second geometry reflects the stations, adds a tooth, changes all colors
// and uses the opposite fit/tool controls. No game raster or route is read.
function workshop(variant: boolean) {
  const extend = (values: number[]) => variant ? [...values, values[0]!] : [...values];
  const fit = variant ? 'ACTION3' : 'ACTION4', transform = variant ? 'ACTION4' : 'ACTION3';
  const ink = (value: number) => variant ? (value * 5 + 3) % 16 : value;
  let level = 1, completed = 0, focus = 0, held = false;
  let profiles: number[][] = [], receivers: number[][] = [], acquired: boolean[] = [];
  function initialize() {
    const a = extend([1, 3, 2]), b = extend([2, 1, 3]);
    profiles = level < 3 ? [a, b] : [extend([1, 1, 2]), extend([2, 3, 4]), extend([4, 3, 2])];
    receivers = level === 1 ? [b, a] : level === 2 ? [[...a].reverse(), b]
      : [extend([3, 3, 4]), extend([2, 3, 4]), extend([3, 2, 1])];
    profiles = structuredClone(profiles); receivers = structuredClone(receivers);
    acquired = receivers.map(() => false); focus = 0; held = false;
  }
  initialize();
  const stems = () => level < 3 ? [16, 40] : [12, 30, 48];
  function packet(stepIndex: number, alteration?: Alteration): V6PublicObservation {
    const source = Array.from({ length: 64 }, () => Array<number>(64).fill(0));
    const rect = (left: number, top: number, right: number, bottom: number, color: number) => {
      for (let x = left; x <= right; x++) source[top]![x] = source[bottom]![x] = color;
      for (let y = top; y <= bottom; y++) source[y]![left] = source[y]![right] = color;
    };
    const marker = (index: number) => {
      const stem = stems()[index]!, last = 18 + (profiles[index]!.length - 1) * 3;
      for (const [top, left, side] of [[stem - 6, 16, 'tl'], [stem - 6, last + 1, 'tr'],
        [stem + 1, 16, 'bl'], [stem + 1, last + 1, 'br']] as const) {
        const y = side[0] === 't' ? 0 : 1, x = side[1] === 'l' ? 0 : 1;
        for (let d = 0; d < 2; d++) { source[top + y]![left + d] = 2; source[top + d]![left + x] = 2; }
      }
      if (held) source[stem - 2]![19] = 2;
    };
    for (const [index, stem] of stems().entries()) {
      const values = profiles[index]!, last = 18 + (values.length - 1) * 3;
      for (let x = 18; x <= last; x++) source[stem]![x] = 4;
      for (const [rank, height] of values.entries()) for (let y = stem - height; y < stem; y++) source[y]![18 + rank * 3] = 4;
      const top = stem - 7, bottom = stem + 3, left = 40, right = left + 3 * values.length - 1, reference = stem - 4;
      rect(left, top, right, bottom, 7);
      for (let rank = 0; rank < values.length; rank++) {
        const seam = reference + (acquired[index] ? 0 : receivers[index]![rank]!);
        for (let y = top + 1; y < bottom; y++) source[y]![left + 1 + rank * 3] = y < seam ? 8 : y === seam ? 6 : 9;
      }
      for (const x of [left - 1, ...Array.from({ length: values.length - 1 }, (_, i) => left + 2 + i * 3), right + 1]) source[reference]![x] = 5;
      if (level >= 2 && (index === 0 || level === 3 && index === 2)) {
        for (let y = stem - 6; y <= stem + 4; y++) for (let x = 2; x <= 12; x++) source[y]![x] = 10;
        const color = alteration === 'changed_tool' ? 13 : 11;
        if (level === 2) for (let y = stem - 4; y <= stem - 3; y++) for (let x = 7; x <= 8; x++) source[y]![x] = color;
        else {
          for (let x = 6; x <= 8; x++) source[stem - 3]![x] = color;
          if (index === 0) for (let y = stem - 4; y <= stem - 2; y++) source[y]![7] = color;
        }
      }
    }
    marker(focus);
    if (alteration === 'ambiguous_marker') marker((focus + 1) % profiles.length);
    const rows = Array.from({ length: 64 }, () => Array<number>(64).fill(ink(0)));
    for (let y = 0; y < 62; y++) for (let x = 1; x < 64; x++) {
      const tx = variant ? 64 - x : x, ty = y + (variant ? 2 : 0);
      if (tx < 64) rows[ty]![tx] = ink(source[y]![x]!);
    }
    return { frame: rows, frames: [rows], state: completed === 3 ? 'WIN' : 'NOT_FINISHED', level,
      levelsCompleted: completed, availableActionIds: [1, 2, 3, 4, 5], stepIndex };
  }
  function act(ticket: V6Ticket, contradict = false) {
    if (contradict) return;
    const action = ticket.actionRef;
    if (action === 'ACTION1' || action === 'ACTION2') {
      const next = focus + (action === 'ACTION1' ? -1 : 1);
      if (next >= 0 && next < profiles.length) {
        if (held) [profiles[focus], profiles[next]] = [profiles[next]!, profiles[focus]!];
        focus = next;
      }
    } else if (action === 'ACTION5') held = !held;
    else if (held && action === fit && equal(profiles[focus]!, receivers[focus]!)) acquired[focus] = true;
    else if (held && action === transform) {
      if (level === 2 && focus === 0) profiles[focus]!.reverse();
      if (level === 3 && (focus === 0 || focus === 2)) {
        const shifted = profiles[focus]!.map(value => value + (focus === 0 ? 1 : -1));
        if (shifted.every(value => value >= 1 && value <= 4)) profiles[focus] = shifted;
      }
    }
    if (acquired.every(Boolean)) { completed++; if (completed < 3) { level++; initialize(); } }
  }
  return { packet, act, transform, get level() { return level; }, get completed() { return completed; } };
}

async function start(variant: boolean, limit = 80) {
  const room = workshop(variant), family = createSicVerifyProfileTransfer(), records: { index: number; before: string; after: string }[] = [];
  const record = family.record!.bind(family);
  family.record = (...args) => { records.push({ index: args[6], before: args[0].observation_ref, after: args[1].observation_ref }); return record(...args); };
  const runtime = new NativeV6Runtime({ families: [family], sourceDigest: 'public-profile-continuity', maxPointOccurrences: 200 });
  const service = new V6AgentService(() => runtime), sessionId = 'profile-' + variant + '-' + limit;
  let sequence = 0, result = await service.handle({ type: 'init', sessionId, sequence,
    observation: room.packet(0), budgets: { targetLevels: 3, levelActionCaps: [80, 80, limit] } });
  const tickets: V6Ticket[] = [], outcomes: V6AgentResult[] = [], proposals: any[] = [];
  async function next(contradict = false, alteration?: Alteration, resume = true) {
    assert.ok(result.ticket, JSON.stringify({ level: room.level, reason: result.reason, state: family.state() }));
    const ticket = result.ticket;
    tickets.push(ticket); proposals.push(result.snapshot.proposal); room.act(ticket, contradict);
    result = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: ticket.id,
      observation: room.packet(sequence, alteration), executionMs: 1 });
    outcomes.push(result);
    if (resume && result.kind === 'boundary' && room.completed < 3) result = await service.handle({ type: 'resume', sessionId, sequence });
    return result;
  }
  while (room.level < 3) { assert.ok(tickets.length < 60); await next(); }
  return { room, family, runtime, records, tickets, proposals, outcomes, next, get result() { return result; } };
}

async function reachContinuation(run: Awaited<ReturnType<typeof start>>) {
  while (run.result.ticket && run.result.snapshot.proposal?.actions.length === 1) {
    assert.ok(run.tickets.filter(ticket => ticket.level === 3).length < 10);
    await run.next();
  }
  assert.ok(run.result.snapshot.proposal?.actions.length > 1);
}

for (const variant of [false, true]) test('native profile preparation continues acquired controls across a changed workshop' + (variant ? ' with reflected stations, new teeth, palette and tool control' : ''), async () => {
  const run = await start(variant), remembered = structuredClone(run.family.state().retained);
  try {
    assert.equal(remembered.toolControl, run.room.transform, 'The framed operation was acquired from actual L2 returns');
    assert.equal(remembered.completed, 2);
    assert.ok(run.result.snapshot.proposal?.route_refs.some((ref: string) => remembered.evidence.includes(ref)));
    while (run.room.completed < 3) { assert.ok(run.tickets.length < 110); await run.next(); }
    assert.equal(run.result.snapshot.levelsCompleted, 3);
    assert.ok(run.tickets.some(ticket => ticket.level === 3 && ticket.actionIndex > 0));
    assert.ok(run.proposals.some(proposal => proposal.actions.length >= 3));
    assert.ok(run.proposals.every(proposal => proposal.actions.length <= 16));
    const probes = run.proposals.filter(proposal => proposal.sicSituationCard?.strategy === 'P05');
    assert.ok(probes.some(proposal => proposal.strategy === 'test_framed_profile_tool'));
    assert.ok(probes.every(proposal => proposal.actions.length === 1), 'An unmeasured tool never enters a committed continuation');
    assert.equal(run.records.length, run.tickets.length);
    assert.equal(new Set(run.records.map(row => row.before + '/' + row.after)).size, run.tickets.length);
    assert.ok(run.records.some(row => row.index > 0), 'Actual later tickets are acquired once in their original order');
  } finally { run.runtime.close('test_complete'); }
});

test('a contradictory second profile step seals and acquires only the two commands actually executed', async () => {
  const run = await start(false);
  try {
    await reachContinuation(run);
    const before = run.family.state().count as number, acquired = run.records.length, retained = structuredClone(run.family.state().retained);
    await run.next(false, undefined, false);
    assert.equal(run.result.kind, 'action');
    assert.equal(run.result.ticket?.actionIndex, 1);
    assert.equal(run.records.length, acquired, 'The unsealed first return has not been acquired early');
    await run.next(true, undefined, false);
    assert.equal(run.result.kind, 'boundary');
    assert.equal(run.records.length, acquired + 2);
    assert.equal(run.family.state().count, before + 2);
    assert.deepEqual(run.records.slice(-2).map(row => row.index), [0, 1]);
    assert.equal(run.family.state().stopped, true);
    assert.deepEqual(run.family.state().retained, retained);
  } finally { run.runtime.close('test_complete'); }
});

for (const alteration of ['ambiguous_marker', 'changed_tool'] as const) test('a prepared profile prefix closes when its current interface has ' + alteration, async () => {
  const run = await start(true);
  try {
    await reachContinuation(run);
    const before = run.records.length;
    await run.next(false, alteration, false);
    assert.equal(run.result.kind, 'boundary');
    assert.equal(run.result.ticket, null);
    assert.equal(run.records.length, before + 1);
    assert.ok(run.result.snapshot.trace.some((event: any) => event.kind === 'actual_outcome' && event.matched === false)
      || run.result.snapshot.trace.some((event: any) => event.kind === 'before_guard' && event.admitted === false));
  } finally { run.runtime.close('test_complete'); }
});

test('a native profile owner declines a preparation that cannot fit the remaining budget', async () => {
  const run = await start(false, 2);
  try {
    assert.equal(run.result.ticket, null);
    assert.equal(run.tickets.filter(ticket => ticket.level === 3).length, 0);
    assert.equal(run.result.kind, 'stopped');
  } finally { run.runtime.close('test_complete'); }
});
