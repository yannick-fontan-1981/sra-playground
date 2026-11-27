import { readFileSync } from 'node:fs';
import { isDeepStrictEqual as equal } from 'node:util';
import { publicCase } from '../reductions/cases.mjs';
import { situations } from '../accuses/situations.mjs';
import { makeLedger, publish } from './contrat.mjs';

function edited(base,entries) {
  const declarations=makeLedger(base,entries);
  return {base,declarations,card:publish(base,declarations)};
}

// Déclarations d'auteur sur les seules fiches publiques. Les liens portent sur les commandes concrètes.
export function confirmation(page, command, label, effect) {
  const rule=page.rules.find(r=>equal(r.command,command) && !r.when && equal(r.effect,effect));
  if (!rule) throw new Error('Effet annoncé absent de la fiche');
  const reply={label,kind:'confirmed',source:[...rule.source],coverage:[{effect,source:[...rule.source]}]};
  return {command,status:'declared',replies:[reply]};
}

export function receiptVariation(c) {
  const declarations=[confirmation(c.message,c.action.split(' '),c.ack,{set:[['indexed','P'],true]})];
  if (c.other) declarations.push(confirmation(c.message,['indexer','Q'],c.other,{set:[['indexed','Q'],true]}));
  return edited(c.message,declarations);
}

// Ce témoin de vocabulaire illustre les cas que le petit appareil B d'origine ne produit pas.
export function vocabulary() {
  const base=structuredClone(publicCase('B').message);
  base.sources[3]='indexer P exige P non indexé. Une exécution indexe P et renvoie « indexé » ou « indexation faite ». Un refus sans effet renvoie « verrou local ». Le signal « compte rendu incomplet » ne permet pas de savoir si le geste a été exécuté.';
  base.sources[5]='toucher T confirme son exécution par « traité ». Aucun effet matériel de ce geste n’est annoncé.';
  base.sources[6]='toucher U possède deux notices incompatibles concernant son accusé. Le libellé applicable est indéterminé.';
  base.commands.push({command:['toucher','T'],source:[5]},{command:['toucher','U'],source:[6]});
  const p=confirmation(base,['indexer','P'],'indexé',{set:[['indexed','P'],true]});
  p.replies.push({...structuredClone(p.replies[0]),label:'indexation faite'},
    {label:'verrou local',kind:'refused',source:[3]},
    {label:'compte rendu incomplet',kind:'ambiguous',source:[3]});
  const declarations=[p,{command:['toucher','T'],status:'declared',
    replies:[{label:'traité',kind:'confirmed',source:[5],coverage:'unknown'}]},
    {command:['toucher','U'],status:'ambiguous',source:[6]}];
  return edited(base,declarations);
}

export function examples() {
  const variants=situations();
  const b=receiptVariation(variants.find(c=>c.id==='B0'));
  const b3=receiptVariation(variants.find(c=>c.id==='B3'));
  const a=publicCase('A').message;
  const declarations=[confirmation(a,['indexer','P'],'poste indexé',{set:[['indexed','P'],true]})];
  for (const label of ['R','S']) declarations.push(confirmation(a,['marquer','P',label],'marqué',{set:[['mark','P'],label]}));
  const old=JSON.parse(readFileSync(new URL('../examples/resource.json',import.meta.url)));
  return {B:b,B3:b3,A:edited(a,declarations),retours:vocabulary(),ressource:edited(old,[])};
}
