import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
// Compteur à l'entrée de la branche de recherche, y compris si sa boucle a zéro règle.
const target=new URL('./src/logos-engine/v6-view-frontier.ts',import.meta.url).href;
registerHooks({load(url,context,next){
  const source=next(url,context);
  if(url!==target)return source;
  const code=source.source.toString(),mark='const candidates: R[] = [];';
  assert.equal(code.split(mark).length,2);
  return {...source,source:code.replace(mark,'globalThis.vueBord?.(obs.revision); '+mark)};
}});
