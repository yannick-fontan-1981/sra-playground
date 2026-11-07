import assert from 'node:assert/strict';
import test from 'node:test';
import { NativeSrcProgram, nativeProgramDescriptions } from '../src/logos-engine/v6-src-program.ts';
import type { Primitive } from '../src/logos-engine/ir.ts';

test('all transferred SRC programs validate their exact source, semantic and transitive identities', async () => {
  const descriptions = nativeProgramDescriptions();
  assert.equal(descriptions.length, 33);
  let executed = 0;
  for (const description of descriptions) {
    const callbacks: Record<string, Primitive> = Object.fromEntries(description.callbackRefs.map(id => [id, () => { executed++; throw new Error('No test capability is executable'); }]));
    const program = await NativeSrcProgram.create(description.id, callbacks);
    assert.equal(program.module.semantic_hash, description.semanticHash);
    assert.equal(program.module.source_hash, description.sourceHash);
    assert.equal(program.transitiveSourceHash, description.transitiveSourceHash);
    assert.ok(Object.isFrozen(program.module));
    if (description.callbackRefs.length) {
      delete callbacks[description.callbackRefs[0]!];
      await assert.rejects(NativeSrcProgram.create(description.id, callbacks), /unavailable/);
    }
  }
  assert.equal(executed, 0);
});

test('a transferred tree cannot resolve an inherited or missing capability', async () => {
  const description = nativeProgramDescriptions().find(value => value.id === 'v6.morphology.evaluate')!;
  assert.ok(description);
  const inherited = Object.create({ 'morph.project': () => ({}) });
  await assert.rejects(NativeSrcProgram.create(description.id, inherited), /unavailable/);
  await assert.rejects(NativeSrcProgram.create('missing.program', {}), /No transferred/);
});
