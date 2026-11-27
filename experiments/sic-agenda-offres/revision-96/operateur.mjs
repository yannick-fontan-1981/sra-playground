import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { play } from './parcours.mjs';
import { gel, historique, pinned } from './moteurs.mjs';
const {values}=parseArgs({options:{fiche:{type:'string'},pyodide:{type:'string'},source:{type:'string'},
  recu:{type:'string'},moteur:{type:'string',default:'candidat'}}});
if (!values.fiche || !values.pyodide) throw Error('Indiquer --fiche et --pyodide');
const card=JSON.parse(await readFile(values.fiche,'utf8'));
const execute=engine=>play(card,resolve(values.pyodide),engine);
if (!['gel','historique','candidat'].includes(values.moteur) || (values.source && values.moteur!=='candidat'))
  throw Error('Choisir une seule source du moteur.');
const result=values.moteur==='candidat' ? await execute(values.source) : await pinned(values.moteur==='gel'?gel:historique,execute);
if (values.recu) await writeFile(values.recu,JSON.stringify(result)+'\n');
console.log(JSON.stringify({gestes:result.steps.length,
  retours:result.steps.filter(x=>x.pre.strategy || x.returned.matched===false).map(x=>({
    geste:x.step,commande:x.ticket.command,modele:x.pre.model,strategie:x.pre.strategy,
    pre:x.beforeChoice?.seal ?? null,accord:x.returned.matched,besoin:x.returned.need?.status ?? null})),
  arret:result.stop.reason ?? result.stop.kind ?? null,niveaux:result.stop.completed ?? result.steps.at(-1)?.returned.completed}));
