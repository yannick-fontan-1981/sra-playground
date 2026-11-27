import { registerHooks } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function observe(engine) {
  const key = Symbol.for('sic.contact.qualification.pre'), records = [];
  globalThis[key] = data => records.push({data:structuredClone(data),seal:sha(data)});
  const module = new URL('src/logos-engine/v6-rooted-line-access.ts',engine).href;
  registerHooks({load(url,context,next) {
    const result = next(url,context);
    if (url !== module) return result;
    const source = result.source.toString(), mark = 'const revision = resolveRootedRecovery(';
    assert.equal(source.split(mark).length,2);
    const tap = `globalThis[Symbol.for('sic.contact.qualification.pre')]({
      ref:observation.observation_ref,epoch:observation.level_epoch,layout:scene.layout,
      physical:physicalRootedLine(scene),order:scene.order,
      controls:Object.fromEntries(Object.entries(memory.controls).map(([key,e])=>[key,{
        translation:e.root_translation,extent:e.extent_delta,refs:e.evidence_refs}])),
      evidence:refutations.map(w=>({before:w.before,after:w.after,command:w.command,layout:w.layout ?? null,
        chain:w.cell_push_witness ?? null,expected:w.expected,observed:w.observed})),
      previous:memory.sic_recovery_need ?? null
    });`;
    return {...result,source:source.replace(mark,tap+'\n    '+mark)};
  }});
  return records;
}
