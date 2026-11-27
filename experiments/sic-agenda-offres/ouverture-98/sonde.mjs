import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
export const sha = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

export function observeOpening(root, substitute = false) {
  const url = new URL('src/logos-engine/v6-observed-frontier.ts',root).href, records = [];
  globalThis[Symbol.for('sic.opening.pre')] = pre => records.push({ pre: structuredClone(pre), sha256: sha(pre) });
  registerHooks({ load(request, ctx, next) {
    const result = next(request,ctx);
    if (request !== url) return result;
    const source = result.source.toString();
    const old = 'for (const [i, target] of targets.entries()) if (target &&';
    const current = 'opening = selectOpeningOffer(offers);';
    const legacy = source.includes(old), marker = legacy ? old : current;
    assert.equal(source.split(marker).length,2,'point de sélection unique');
    if (substitute) assert.equal(legacy,false);
    const tap = `globalThis[Symbol.for('sic.opening.pre')]({
      observation: current.observation_ref, epoch: protocol.level_epoch, frame: protocol.frame_hash,
      baseline: normalQuestion.question_ref,
      tier: normalQuestion.priority,
      eligible: eligible.map((q,i)=>({ref:q.question_ref,command:q.action,priority:q.priority,
        target:targets[i] ? {entity:targets[i].entity,box:targets[i].box,count:targets[i].distinctRelations,
          witnesses:targets[i].related.map(o=>({entity:o.entity,box:o.box}))} : null})),
      offered: ${legacy ? 'eligible.filter((q,i)=>targets[i]).map(q=>q.question_ref)' : 'offers.map(o=>o.question.question_ref)'}
    });`;
    // Le processus témoin inverse le départage ici. Le service joue la commande qu'il délivre ensuite.
    const choose = substitute ? 'opening = selectOpeningOffer(offers.slice().reverse());' : marker;
    return { ...result, source:source.replace(marker,tap + '\n      '+choose) };
  }});
  return records;
}
