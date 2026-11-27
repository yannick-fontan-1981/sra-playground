import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import test from 'node:test';
import { NativeV6Runtime } from '../src/logos-engine/v6-native-runtime.ts';
import { V6AgentService } from '../src/runtime/v6-agent-service.ts';
import { toV6PublicObservation } from '../src/runtime/v6-agent-protocol.ts';
import { createSicSwitchedSurface } from '../src/sic/switched-surface.ts';
import { measureSurface, preferredPassageContext, type SurfacePassageEvidence } from '../src/sic/observed-surfaces.ts';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/sic-surface-continuation-learning.json.gz', import.meta.url))));

for (const variant of [false, true]) for (const restored of [false, true]) test('native surface exploration reuses actual onward/dead-end evidence'
  + (variant ? ' after mirror, palette, position and command changes' : '')
  + (restored ? ' despite retained evidence from another scope' : ''), async () => {
  const family = createSicSwitchedSurface(), sessionId = 'surface-exploration-' + variant;
  const bottom = fixture.roles.origin[1] + Math.floor((fixture.steps[0].before.frame.length - fixture.roles.origin[1]) / fixture.roles.pitch) * fixture.roles.pitch;
  const transform = (packet: any) => {
    const frame = packet.frame.map((row: number[], y: number) => [...packet.frame[variant && y < bottom ? bottom - 1 - y : y]]
      .map((ink: number) => variant ? (ink * 5 + 3) % 16 : ink));
    return { ...packet, frame, frames: [frame], gameCode: 'PUBLIC', levelCount: 2, availableActionIds: [1, 2, 3, 4],
      canUndo: false, canSelectLevel: false, defaultFps: 10 };
  };
  const action = (id: number) => variant && id <= 2 ? 3 - id : id;
  const foreignCases: SurfacePassageEvidence[] = [
    { throughSupport: true, onward: true, refs: ['other:epoch:2:revision:7:frame:aaa', 'other:epoch:2:revision:8:frame:bbb'] },
    { throughSupport: false, onward: false, refs: ['other:epoch:2:revision:12:frame:ccc', 'other:epoch:2:revision:13:frame:ddd'] },
  ];
  if (restored) family.restore({ ...family.state(), passageEvidence: structuredClone(foreignCases) });
  const service = new V6AgentService(() => new NativeV6Runtime({ families: [family], sourceDigest: sessionId, maxPointOccurrences: 250 }));
  let sequence = 0, reply = await service.handle({ type: 'init', sessionId, sequence,
    observation: toV6PublicObservation(transform(fixture.steps[0].before)), budgets: { targetLevels: 2, levelActionCaps: [80, 80] } });
  let witness: any;
  for (const [index, step] of fixture.steps.slice(0, 13).entries()) {
    if (!reply.ticket) reply = await service.handle({ type: 'resume', sessionId, sequence });
    assert.ok(reply.ticket); assert.equal(reply.ticket.actionRef, 'ACTION' + action(step.action));
    reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
      observation: toV6PublicObservation(transform(step.after), sequence) });
    if (index === 6) {
      witness = structuredClone(family.state().witness); assert.equal(witness.score, 1);
    }
  }
  const retained = structuredClone(family.state().passageEvidence) as SurfacePassageEvidence[];
  const learned = retained.filter(item => item.refs.every(ref => ref.includes(sessionId)));
  assert.equal(learned.length, 2, 'A foreign case cannot prevent an actual return being acquired in the current scope');
  if (restored) assert.deepEqual(retained.filter(item => item.refs.every(ref => ref.startsWith('other:'))), foreignCases);
  assert.equal(preferredPassageContext(learned), true);
  assert.deepEqual(family.state().witness, witness, 'Exploration evidence does not replace the independently acquired role');
  reply = await service.handle({ type: 'resume', sessionId, sequence });
  const proposal = reply.snapshot.proposal as any;
  assert.ok(reply.ticket);
  assert.equal(reply.ticket.actionRef, 'ACTION' + action(2), 'The first useful ticket reuses the acquired return passage');
  assert.ok(proposal.actions.length > 1);
  const last = proposal.transfer.walk.at(-1);
  assert.equal(last.kind, 'probe'); assert.equal(last.expected, null);
  assert.deepEqual(last.focus.cell, variant ? [2, 8] : [2, 3], 'The experiment targets the context supported by actual earlier returns');
  for (const item of learned) for (const ref of item.refs) assert.ok(proposal.route_refs.includes(ref));
  assert.ok(proposal.route_refs.every((ref: string) => !ref.startsWith('other:')), 'A foreign retained case is never consumed as current evidence');
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(transform(fixture.steps[13].after), sequence) });
  assert.ok(reply.ticket); assert.equal(reply.ticket.actionIndex, 1, 'The known crossing continues natively');
  assert.deepEqual(family.state().passageEvidence, retained, 'No acquisition before the committed prefix seals');
  // A stationary or ambiguous public return closes the next ordinary movement.
  const negative = transform(fixture.steps[13].after);
  if (variant) {
    const roles = (family.state().witness as any).roles, view = measureSurface(negative.frame, roles)!;
    const cell = view.surface.free.map(value => value.split(',').map(Number)).find(value => value.join(',') !== view.address.cell.join(','))!;
    const x = roles.origin[0] + cell[0]! * roles.pitch + 1, y = roles.origin[1] + cell[1]! * roles.pitch + 1;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) negative.frame[y + dy]![x + dx] = roles.actor;
  }
  reply = await service.handle({ type: 'advance', sessionId, sequence: ++sequence, ticketId: reply.ticket.id, executionMs: 1,
    observation: toV6PublicObservation(negative, sequence) });
  assert.equal(reply.ticket, null);
  assert.equal((reply.snapshot.trace as any[]).findLast(event => event.kind === 'actual_outcome')?.matched, false);
  assert.deepEqual(family.state().passageEvidence, retained);
  assert.deepEqual(family.state().witness, witness);
  await service.handle({ type: 'close', sessionId, sequence });
});

test('passage preference is learned symmetrically and a contradictory return removes it', () => {
  const sample = (throughSupport: boolean, onward: boolean): SurfacePassageEvidence => ({ throughSupport, onward, refs: ['before', 'after'] });
  assert.equal(preferredPassageContext([]), null);
  assert.equal(preferredPassageContext([sample(true, true)]), null, 'One successful class cannot invent a contrast');
  const cases = [sample(false, true), sample(true, false)];
  assert.equal(preferredPassageContext(cases), false, 'The other geometric context can be preferred when actual returns support it');
  cases.push(sample(false, false));
  assert.equal(preferredPassageContext(cases), null, 'A contradiction removes only the unsupported ranking');
  assert.equal(cases.length, 3, 'Independent observed cases remain available');
});
