import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const target=new URL('./src/logos-engine/v6-native-caller.ts',import.meta.url).href;
globalThis.offresRetirées=0;
registerHooks({load(url,context,next){
  const result=next(url,context);if(url!==target)return result;
  const source=result.source.toString(),cut='const offer = offerTranslationReplication(pairs, current);';
  assert.equal(source.split(cut).length,2);
  const replacement='let offer = offerTranslationReplication(pairs, current); if(offer && current.ref.includes(":revision:15:")){globalThis.offresRetirées++; offer=null;}';
  return {...result,source:source.replace(cut,replacement)};
}});
