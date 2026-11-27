import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
export const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function observeQueries(root, capture, substitute = false) {
  const target = new URL('src/logos-engine/v6-subset-diagnosis.ts', root).href;
  globalThis[Symbol.for('sic.subset.pre')] = capture;
  return registerHooks({ load(url, context, next) {
    const loaded = next(url, context);
    if (url !== target) return loaded;
    const source = loaded.source.toString();
    const legacy = 'offers.sort((a,b)=>compare(a.slice(0,3),b.slice(0,3)));';
    const candidate = 'const selected = selectSubsetQuery(offers);';
    const old = source.includes(legacy), marker = old ? legacy : candidate;
    assert.equal(source.split(marker).length, 2, 'coupe de choix unique');
    if (substitute) assert.equal(old, false, 'ce témoin exige le point de raccordement du candidat');
    const fields = old
      ? `offers.map(([remaining,kind,tested,command])=>{
          const global=candidates.filter(i=>tested.includes(i)).length;
          return {remaining,kind:kind===0?"scope":"member",tested,command,global,local:candidates.length-global};
        })`
      : 'offers.map(({remaining,kind,tested,command,global,local})=>({remaining,kind,tested,command,global,local}))';
    const tap = `globalThis[Symbol.for('sic.subset.pre')](this, obs, rows, remaining, {
      observation: obs.observation_ref, epoch: obs.level_epoch, universe: scene.universe_ref,
      focus: scene.focus, candidates, evidence: this.method_refs.slice(-8), offers: ${fields}
    });`;
    // Intervention exclusivement dans le processus témoin. Le classement normal
    // reste celui de production dans les rejeux nominaux.
    const selection = substitute ? `const first = selectSubsetQuery(offers);
      const selected = offers.find(o => first && o !== first && o.kind === first.kind
        && o.remaining === first.remaining) ?? first;` : marker;
    return { ...loaded, source: source.replace(marker, tap + '\n' + selection) };
  } });
}
