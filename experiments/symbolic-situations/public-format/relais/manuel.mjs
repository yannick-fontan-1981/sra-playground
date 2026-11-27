import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { publicCase } from '../reductions/cases.mjs';
import { translate } from './traduire.mjs';

const {values:v}=parseArgs({options:{fiche:{type:'string',default:'A'},monde:{type:'string'},
  message:{type:'boolean'},prefixe:{type:'string'}}});
const c=publicCase(v.fiche), fiche=translate(c.message);
const prefix=v.prefixe?JSON.parse(readFileSync(v.prefixe,'utf8')):[];
function reply(world,state,action) {
  const r=c.dynamics.step(world,state,action);
  return r ?? {feedback:'Action indisponible.',next:state};
}
if (!Array.isArray(prefix) || prefix.some(t=>!t || Object.keys(t).sort().join()!=='action,retour' ||
    ![t.action,t.retour].every(s=>typeof s==='string' && s.length>0 && !/[\r\n]/.test(s)))) throw Error('Préfixe public invalide');
const possible=[];
for(const [i,w] of c.worlds.entries()) {
  if (v.monde!==undefined && v.monde!==String(i+1)) continue;
  let state=c.dynamics.initialState(w);
  for (const t of prefix) {
    if (!state) break;
    const r=reply(w,state,t.action);
    if (r.feedback!==t.retour) {state=null;break;}
    state=r.next;
  }
  if (state) possible.push({w,state});
}
if(!possible.length) throw Error('Aucun départ ouvert ne reproduit ce préfixe');
if(v.message) {
  console.log('Joue une commande à la fois. Réponds uniquement par {"action":"…"} ou {"arret":"raison"}. Attends le retour avant le geste suivant.');
  console.log(JSON.stringify({fiche}));
  for(const {action,retour} of prefix) {console.log(JSON.stringify({action}));console.log(JSON.stringify({retour}));}
} else {
  if(possible.length!==1) throw Error('Choisir le monde côté opérateur avec --monde');
  let {w,state}=possible[0];
  for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})) {
    const m=JSON.parse(line);
    if(Object.keys(m).length!==1) throw Error('Une seule clé attendue');
    if(typeof m.arret==='string') break;
    if(typeof m.action!=='string' || !m.action.trim() || /[\r\n]/.test(m.action)) throw Error('Commande attendue');
    const r=reply(w,state,m.action.trim().replace(/\s+/g,' '));
    console.log(JSON.stringify({retour:r.feedback}));
    if(!r.next) break;
    state=r.next;
  }
}
