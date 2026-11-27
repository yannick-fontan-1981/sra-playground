import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
export const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function observeQueries(root,capture,filter){
  const path=new URL('src/logos-engine/v6-subset-diagnosis.ts',root).href;
  globalThis[Symbol.for('operateur.partition')]=capture;
  return registerHooks({load(url,context,next){
    const r=next(url,context);if(url!==path)return r;
    const text=r.source.toString(),legacy='offers.sort((a,b)=>compare(a.slice(0,3),b.slice(0,3)));';
    const old=text.includes(legacy),cut=old?legacy:'const selected = selectSubsetQuery(offers);';
    assert.equal(text.split(cut).length,2);
    const value=old?'offers.map(([remaining,tag,tested,command])=>({remaining,kind:tag?"member":"scope",tested,command,global:candidates.filter(v=>tested.includes(v)).length,local:candidates.filter(v=>!tested.includes(v)).length}))':
      'offers.map(({remaining,kind,tested,command,global,local})=>({remaining,kind,tested,command,global,local}))';
    const tap='globalThis[Symbol.for("operateur.partition")](this,obs,rows,remaining,{observation:obs.observation_ref,epoch:obs.level_epoch,universe:scene.universe_ref,focus:scene.focus,candidates,evidence:this.method_refs.slice(-8),offers:'+value+'});';
    // Une intervention sur la liste en entrée. Le sélecteur appelé et le plan issu du choix restent natifs.
    if(filter)assert.ok(!old);
    const injection=filter?'const best=selectSubsetQuery(offers); if(best && offers.some(o=>o!==best && o.remaining===best.remaining && o.kind===best.kind))offers.splice(offers.indexOf(best),1);':'';
    return {...r,source:text.replace(cut,tap+injection+cut)};
  }});
}
