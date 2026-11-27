// Reproduce one refusal from the strict runner using its recorded public frames.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { NativeKnowledgeStore } from '../../../src/logos-engine/v6-knowledge-store.ts';
import { measureNativeObservation } from '../../../src/logos-engine/v6-native-observer.ts';
import { v6FrameHash } from '../../../src/runtime/v6-agent-protocol.ts';
import { createSicVerifyOrientedDelivery } from '../../../src/sic/oriented-delivery.ts';

const records = gunzipSync(await readFile(new URL('./wa30-strict-d0d41f3a.jsonl.public.jsonl.gz', import.meta.url)))
  .toString().trim().split('\n').map(JSON.parse);
const record = records.find(row => row.beforeRef.includes(':revision:349:'));
assert.ok(record);
assert.equal(record.outcome.matched, false);
const [scope] = record.beforeRef.split(':epoch:');
const makePacket = async rows => ({
  frame_rows: rows, frame_hash: await v6FrameHash(rows), level: record.level,
  state: 'NOT_FINISHED', levels_completed: record.level - 1,
  available_action_refs: ['ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5'],
});
const first = await makePacket(record.first);
const second = await makePacket(record.second);
const before = await measureNativeObservation(first, 349, scope);
const after = await measureNativeObservation(second, 350, scope);
assert.equal(before.observation_ref, record.beforeRef);
assert.equal(after.observation_ref, record.outcome.observation_ref);

const owner = createSicVerifyOrientedDelivery(record.outcome.family);
await owner.attachPrograms(new NativeKnowledgeStore('contact-withdrawal', scope));
owner.restore(record.ownerBefore);
const initialState = structuredClone(owner.state());
const evidence = initialState.state.contactAppearance.sources;
assert.deepEqual(evidence.map(ref => Number(ref.split(':revision:')[1].split(':')[0])), [296, 297, 298]);
const proposal = await owner.propose(before, record.first, [], record.proposal.actions.length, { reasoningMode: 'solving' });
assert.ok(proposal);
assert.deepEqual(owner.state(), initialState);
assert.equal(proposal.actions[0].action_ref, 'ACTION' + record.command.id);
assert.deepEqual(proposal.actions, record.proposal.actions, 'The source must retain the observed command path');
assert.equal(proposal.sicSrcDecision.hash, record.proposal.sicSrcDecision.hash);
assert.ok(evidence.every(ref => proposal.route_refs.includes(ref)));
assert.deepEqual(proposal.walk[0].withdrawnContact, [8, 4]);
assert.deepEqual(proposal.walk[0].after, proposal.walk[1].before);

const initial = owner.before(proposal, 0, first, before);
assert.equal(initial.admitted, true);
const returned = await owner.after(proposal, 0, before, after, record.first, record.second);
assert.equal(returned.matched, true);
assert.equal(returned.seal_prefix, false);
const following = owner.before(proposal, 1, second, after);
assert.equal(following.admitted, true);
assert.deepEqual(owner.state(), initialState, 'The guard must leave acquisition to reconciliation');
console.log(JSON.stringify({
  beforeRef: before.observation_ref, afterRef: after.observation_ref, acquisitionRefs: evidence,
  prefixLength: proposal.actions.length, contact: proposal.walk[0].withdrawnContact,
  previous: record.outcome.reason, initial: initial.reason, returned: returned.reason, following: following.reason,
  scope: 'public diagnostic of the observed first return and the unexecuted next guard',
}, null, 2));
