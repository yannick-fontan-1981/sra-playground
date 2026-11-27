// Rebind the observed ninth-level sector after an independently executed directional return.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { NativeKnowledgeStore } from '../../../src/logos-engine/v6-knowledge-store.ts';
import { measureNativeObservation } from '../../../src/logos-engine/v6-native-observer.ts';
import { orientedCouplingInitial } from '../../../src/logos-engine/v6-oriented-coupling.ts';
import { v6FrameHash } from '../../../src/runtime/v6-agent-protocol.ts';
import { createSicVerifyOrientedDelivery, verifyOrientedDeliveryId } from '../../../src/sic/oriented-delivery.ts';
import { observedMechanicsGroup } from '../../../src/sic/strategy-agenda.ts';

const receipt = JSON.parse(gunzipSync(await readFile(new URL('./wa30-level9-first-loss-public.json.gz', import.meta.url))));
const { entry, returns, oldRefusal } = receipt;
const [, firstMove, secondMove, thirdMove] = returns;
assert.equal(oldRefusal.answer, null);
assert.equal(firstMove.family, 'sic_test_prepared_effects');
assert.equal(secondMove.family, 'sic_test_prepared_effects');
assert.equal(thirdMove.family, 'sic_verify_coupled_route');
const [scope] = entry.observation.observation_ref.split(':epoch:');
const [before, current, after] = await Promise.all([firstMove, secondMove, thirdMove].map(async (row, index) => {
  assert.equal(await v6FrameHash(row.observation.frame_rows), row.observation.frame_hash);
  return measureNativeObservation(row.observation, entry.observation.revision + index + 1, scope);
}));
assert.equal(current.revision, oldRefusal.revision);
assert.equal(before.observation_ref, secondMove.before);
assert.equal(current.observation_ref, thirdMove.before);
assert.equal(orientedCouplingInitial(firstMove.observation.frame_rows, true).initial_boxes.length, 9);
assert.equal(orientedCouplingInitial(secondMove.observation.frame_rows, true).initial_boxes.length, 8);

const family = createSicVerifyOrientedDelivery();
await family.attachPrograms(new NativeKnowledgeStore('wa30-sector-rebind', scope));
const carried = entry.families.find(item => item.family === verifyOrientedDeliveryId).owner;
family.restore(carried);
const propose = (observation, packet, extra = {}) => family.proposeInGroup(observedMechanicsGroup, observation,
  packet.frame_rows, [], 80, { reasoningMode: 'solving', ...extra });
assert.equal(await propose(current, secondMove.observation), null);
const first = await propose(current, secondMove.observation, { readPriorDirectionalScene(project) {
  const scene = project(firstMove.observation.frame_rows, before);
  return scene && { scene, beforeRef: before.observation_ref, afterRef: current.observation_ref,
    levelEpoch: current.level_epoch, command: secondMove.command.action_ref };
}});
assert.ok(first?.local.sectorNetwork);
assert.equal(first.local.geometry.initial_boxes.length, 9);
assert.deepEqual(family.state(), carried);
assert.ok(first.route_refs.includes(before.observation_ref));
assert.ok(first.route_refs.includes(current.observation_ref));
assert.equal(first.actions[0].action_ref, thirdMove.command.action_ref);
assert.equal((await family.before(first, 0, secondMove.observation, current)).admitted, true);
const ownReturn = await family.after(first, 0, current, after, secondMove.observation.frame_rows, thirdMove.observation.frame_rows);
assert.equal(ownReturn.matched, true);
await family.record(current, after, thirdMove.command, secondMove.observation.frame_rows, thirdMove.observation.frame_rows, first, 0);
const next = await propose(after, thirdMove.observation);
assert.ok(next?.local.sectorNetwork);
assert.equal(next.actions[0].action_ref, 'ACTION4');
assert.equal((await family.before(next, 0, thirdMove.observation, after)).admitted, true);
console.log(JSON.stringify({ receipt: receipt.run, before: before.observation_ref, matched: ownReturn.matched,
  first: first.actions[0].action_ref, following: next.actions[0].action_ref, followingAdmitted: true,
  scope: 'archived public transition through revision 551 and the following guard' }, null, 2));
