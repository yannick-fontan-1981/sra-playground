import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mock } from 'node:test';
import { NativeV6Runtime } from '../../../src/logos-engine/v6-native-runtime.ts';
import { measureNativeObservation } from '../../../src/logos-engine/v6-native-observer.ts';
import { V6AgentService } from '../../../src/runtime/v6-agent-service.ts';
import { v6FrameHash } from '../../../src/runtime/v6-agent-protocol.ts';
import { beginRecording } from '../../../src/sic/recorded-replay-access.ts';
import { createSicVerifyRemoteReplay, verifyRemoteReplayId } from '../../../src/sic/replay-access.ts';
import { RecordingDecisionObservations } from '../../../src/sic/recording-decision-observation.ts';
import { digest, seal } from './sceau.mjs';

const sessionId = 'fixture-approche-contact';
const vectors = { ACTION1: [0, -3], ACTION2: [0, 3], ACTION3: [-3, 0], ACTION4: [3, 0] };
const availableActionIds = [1, 2, 3, 4, 5];
const start = [1, 1], contact = [7, 1], landing = [13, 1];
const commonURL = new URL('../../../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/agents/yf_arc3_v6/laya_proto/common_frontier_policy.drm.json', import.meta.url);

function packet(x, stepIndex) {
  const frame = Array.from({ length: 64 }, (_, y) => Array.from({ length: 64 }, (_, col) => {
    if (y < 1 || y > 2) return 0;
    if (col >= x && col < x + 2) return 3;
    return (col >= 1 && col <= 8) || (col >= 13 && col <= 17) ? 1 : 0;
  }));
  const frames = [frame];
  if (x === contact[0]) {
    const flash = structuredClone(frame);
    flash[1][9] = flash[1][10] = 4;
    frames.push(flash, flash, frame);
  }
  return { frame, frames, stepIndex, availableActionIds, level: 1, levelsCompleted: 0, state: 'NOT_FINISHED' };
}

async function initialMemory(initial) {
  const measured = await measureNativeObservation({ frame_rows: initial.frame, frame_hash: await v6FrameHash(initial.frame),
    level: 1, levels_completed: 0, state: initial.state, available_action_refs: availableActionIds.map(id => 'ACTION' + id) }, 1, sessionId);
  const actor = measured.entities.find(e => e.palette_value === 3 && e.bbox[0] === start[0]);
  assert.ok(actor && !actor.identity_ambiguous);
  const scene = { body: { signature: actor.signature, start, floor: 1, size: [2, 2], quantum: 3,
    mask: [[0, 0], [1, 0], [0, 1], [1, 1]] }, goal: [16, 1], nodes: [],
    slots: [[1, 5, 1, 5], [3, 5, 3, 5], [5, 5, 5, 5]], transfer: { contact, frames: [contact, landing], channel: [9, 1, 11, 2] } };
  const recording = beginRecording(scene, 1, vectors, 'ACTION5', ['fixture:directions-acquises'], initial.frame);
  assert.ok(recording);
  return { state: null, recording };
}

function silentFamily(id) {
  return { id, propose: () => null, state: () => ({}), restore() {} };
}

async function run(observed) {
  const mailbox = observed ? new RecordingDecisionObservations() : undefined;
  const initial = packet(start[0], 0);
  const family = createSicVerifyRemoteReplay(verifyRemoteReplayId, mailbox);
  family.restore(await initialMemory(initial));
  const entries = [], calls = [], work = [], tickets = [], receipts = [], selections = [], writes = [];

  // Même sonde de test dans les deux bras. Vérifie que la capture existe à
  // l'entrée du VRAI workflow. Un seul appel au handle que le registre fournit.
  const attach = family.attachPrograms.bind(family);
  family.attachPrograms = registry => attach({ async registerProgram(...args) {
    const handle = await registry.registerProgram(...args);
    return { workflowId: handle.workflowId, run(inputs, options) {
      work.push(handle.workflowId);
      if (mailbox) {
        const { entries: pending, omitted } = mailbox.drain();
        assert.equal(omitted, 0);
        assert.equal(pending.length, 1);
        const [event] = pending;
        assert.deepEqual(event.facts, inputs.situation);
        assert.notEqual(event.facts, inputs.situation);
        assert.ok(Object.isFrozen(event) && Object.isFrozen(event.facts) && Object.isFrozen(event.evidence));
        entries.push(seal(event));
      }
      return handle.run(inputs, options);
    } };
  } });
  const families = [silentFamily('entree_vide'), family, silentFamily('entree_suivante')];
  for (const f of families) {
    const propose = f.propose.bind(f);
    f.propose = (...args) => { calls.push(f.id); return propose(...args); };
  }
  const groups = families.map(f => ({ id: f === family ? 'coordinate_visible_motion' : f.id, families: [f.id] }));
  const policy = JSON.parse(await readFile(commonURL, 'utf8'));
  const runtime = new NativeV6Runtime({ groups, families, authorityPolicy: policy, familyAgenda: 'active', adaptiveReasoning: true,
    sourceDigest: 'fixture-sic-recording', maxPointOccurrences: 32, now: () => 0 });
  const service = new V6AgentService(() => runtime);
  let x = start[0];
  let reply = await service.handle({ type: 'init', sequence: 0, sessionId, observation: initial,
    budgets: { targetLevels: 1, levelActionCaps: [8] } });
  const checkpoint = () => {
    const memory = runtime.inspectKnowledge();
    writes.push({ count: memory.deltas.length, chain: memory.chain, digest: digest(memory.deltas) });
  };
  for (const step of [1, 2]) {
    assert.ok(reply.ticket, 'Ticket natif attendu : ' + reply.reason + ' / ' + reply.snapshot.reason);
    checkpoint();
    const ticket = reply.ticket;
    const native = reply.snapshot.trace.findLast(e => e.kind === 'sic_native_plan');
    const release = reply.snapshot.trace.findLast(e => e.kind === 'why_act_release');
    assert.ok(release?.admitted && release.native_gate);
    assert.equal(native?.id, 'sic-plan:' + ticket.observationRef);
    assert.equal(native.strategy, reply.snapshot.proposal.sicLocalDecision.strategy);
    tickets.push(ticket);
    selections.push(reply.snapshot.sicFamilySelection);
    receipts.push({ observationRef: ticket.observationRef, family: native.family, strategy: native.strategy,
      proposalDigest: digest(reply.snapshot.proposal), command: reply.command, index: ticket.actionIndex });
    assert.equal(ticket.actionRef, 'ACTION4');
    x += vectors[ticket.actionRef][0];
    reply = await service.handle({ type: 'advance', sessionId, sequence: step, ticketId: ticket.id,
      executionMs: 1, observation: packet(x, step) });
    assert.equal(reply.kind, 'boundary');
    checkpoint();
    if (step === 1) reply = await service.handle({ type: 'resume', sessionId, sequence: step });
  }
  const memory = family.state();
  assert.equal(memory.recording.pendingPulse.tick, 2);
  assert.equal(x, contact[0]);
  assert.equal(work.length, 2);
  assert.deepEqual(calls, ['entree_vide', family.id, 'entree_vide', family.id]);
  assert.ok(selections.every(s => s.selected === 'coordinate_visible_motion' &&
    s.visited.join() === 'entree_vide,coordinate_visible_motion'));
  return { entries, native: { calls, work, tickets, receipts, selections, writes, stateDigest: digest(memory),
    pulseTick: memory.recording.pendingPulse.tick } };
}

export async function compareRuns() {
  // Horloge de création des nœuds du journal, fixée uniquement dans ce processus de test.
  const clock = mock.method(Date, 'now', () => 1700000000000);
  try {
    const off = await run(false), on = await run(true);
    assert.deepEqual(off.entries, []);
    assert.equal(on.entries.length, 2);
    assert.deepEqual(on.native, off.native);
    return on;
  } finally {
    clock.mock.restore();
  }
}
