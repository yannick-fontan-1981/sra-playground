import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
const mode=readFileSync(new URL('./condition.txt',import.meta.url),'utf8');
const target=new URL('./src/logos-engine/v6-linked-temporal-contact.ts',import.meta.url).href;
registerHooks({load(url,context,next){
  const result=next(url,context);if(url!==target)return result;
  const text=result.source.toString(),cut='if (!route?.length) return null;';
  assert.equal(text.split(cut).length,2);
  const change=mode==='mesurée'?'byVector.set(pkey(route[0][2]),"ACTION1");':'for(const ref of available)this.tested.add(key([position,ref]));';
  const probe='if(observation.observation_ref.includes(":revision:3:")){globalThis.trajetPreuve={origine:position,site:this.selected.position,pas:route[0],domain:available};'+change+'}';
  return {...result,source:text.replace(cut,cut+probe)};
}});
