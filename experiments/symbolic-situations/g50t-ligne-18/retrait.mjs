import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const target=new URL('./src/logos-engine/v6-linked-temporal-contact.ts',import.meta.url).href;
registerHooks({load(url,context,next){
  const result=next(url,context);if(url!==target)return result;
  const text=result.source.toString(),cut='if (!offer) return null;';
  assert.equal(text.split(cut).length,2);
  return {...result,source:text.replace(cut,'if (offer && observation.observation_ref.includes(":revision:3:")){globalThis.contactRetiré=true;return null;} '+cut)};
}});
