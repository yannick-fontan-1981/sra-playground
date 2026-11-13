import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WindowConstraints, SymmetricField } from '../src/logos-engine/v6-field-constraints.ts';
import { measureNativeObservation, ObservedInputDomain } from '../src/logos-engine/v6-native-observer.ts';

const fixture = JSON.parse(await readFile(new URL('./fixtures/v6-field-reference.json', import.meta.url), 'utf8'));
const root = new URL('../reference/v6/786dcf51ca57773d8e3a8948ce9ea3655e7baf8e/source/', import.meta.url);
test('V6 field oracle binds unchanged Python sources at the common reference commit', async () => {
  assert.equal(fixture.provenance.commit, '786dcf51ca57773d8e3a8948ce9ea3655e7baf8e');
  for (const [name, entry] of Object.entries(fixture.provenance.sources) as [string, { bytes: number; sha256: string }][]) {
    const bytes = await readFile(new URL(name, root));
    assert.equal(bytes.length, entry.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, name);
  }
});
for (const item of fixture.cases) {
  test(`native V6 field decisions and evidence match Python through ${item.game} (${item.actions} actions, ${item.levelsCompleted} levels)`, async () => {
    const families = [new WindowConstraints(), new SymmetricField(fixture.policy)];
    const domain = new ObservedInputDomain(fixture.provenance.inputDomainLimit);
    let current = item.initial.public;
    let obs = await measureNativeObservation(current, 0, 'native-field-oracle');
    assert.deepEqual(obs, item.initial.observation);
    let actions = 0;
    for (const event of item.transitions) {
      const inputs = domain.candidates(obs);
      assert.deepEqual(inputs, event.inputs, `input domain after ${actions} actions`);
      let choice = null;
      for (let family = 0; family < families.length; family++) {
        const proposed = await families[family]!.propose(obs, current.frame_rows, inputs, 160 - actions);
        if (proposed) { choice = { family, proposal: proposed }; break; }
      }
      assert.ok(choice, `no proposal after ${actions} actions`);
      assert.equal(choice.family, event.family);
      assert.deepEqual(choice.proposal, event.proposal, `proposal after ${actions} actions`);
      const family = families[choice.family]!;
      for (let index = 0; index < event.steps.length; index++) {
        const step = event.steps[index];
        assert.deepEqual(await family.before(choice.proposal, index, obs, current.frame_rows), step.beforeGuard, `before action ${actions + 1}`);
        if (!step.beforeGuard.admitted) break;
        const after = await measureNativeObservation(step.afterPublic, actions + 1, 'native-field-oracle');
        assert.deepEqual(after, step.afterObservation);
        assert.deepEqual(await family.after(choice.proposal, index, obs, after, step.afterPublic.frame_rows), step.afterGuard);
        assert.deepEqual(family.record(obs, after, choice.proposal.actions[index]!, current.frame_rows, step.afterPublic.frame_rows, choice.proposal, index), step.record);
        current = step.afterPublic; obs = after; actions++;
      }
    }
    assert.equal(actions, item.actions);
    assert.equal(current.levels_completed, item.levelsCompleted);
    assert.equal(current.state, item.state);
    // A non-matching scene stays unclaimed: these field families must not
    // invent a sequence solver or a substitute action.
    if (!item.transitions.length) for (const family of families) assert.equal(await family.propose(obs, current.frame_rows, domain.candidates(obs), 160), null);
  });
}
