import { readFile } from 'node:fs/promises';

export async function readCard(file) {
  const card=JSON.parse(await readFile(file,'utf8'));
  if(card.version!=='sic.onde/1'||!Number.isInteger(card.gestes)||card.gestes<1||card.gestes>16||
    !Array.isArray(card.couleurs)||![0,2].includes(card.couleurs.length)||new Set(card.couleurs).size!==card.couleurs.length||
    card.couleurs.some(x=>!Number.isInteger(x)||x<0||x>15)) throw Error('Entrée publique invalide.');
  if(Object.keys(card).some(k=>!['version','couleurs','gestes','budget','substitution','variations','retirerPreimage','inverserQuestionsInitiales'].includes(k)) ||
    (card.inverserQuestionsInitiales!==undefined && typeof card.inverserQuestionsInitiales!=='boolean') ||
    (card.budget!==undefined && (!Number.isInteger(card.budget)||card.budget<card.gestes||card.budget>600)) ||
    (card.variations!==undefined && typeof card.variations!=='boolean') ||
    (card.retirerPreimage!==undefined && (!card.retirerPreimage || Object.keys(card.retirerPreimage).sort().join(',')!=='geste,phases' ||
      !Number.isInteger(card.retirerPreimage.geste)||card.retirerPreimage.geste<1||card.retirerPreimage.geste>card.gestes||
      !Array.isArray(card.retirerPreimage.phases)||card.retirerPreimage.phases.length<2||card.retirerPreimage.phases.length>4||
      card.retirerPreimage.phases.some(n=>!Number.isInteger(n)||n<0))) ||
    (card.substitution!==undefined && (!card.substitution || Object.keys(card.substitution).sort().join(',')!=='geste,indice' ||
      !Number.isInteger(card.substitution.geste)||card.substitution.geste<1||card.substitution.geste>card.gestes||
      !Number.isInteger(card.substitution.indice)||card.substitution.indice<0))) throw Error('Intervention publique invalide.');
  return card;
}
