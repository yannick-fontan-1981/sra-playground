import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { play } from './jouer.mjs';
import { withEngine } from './moteurs.mjs';
const {values}=parseArgs({options:{pyodide:{type:'string'},condition:{type:'string',default:'nominal'},
  source:{type:'string'},moteur:{type:'string',default:'candidat'},recu:{type:'string'},'sans-sonde':{type:'boolean'}}});
if(!values.pyodide) throw Error('Indiquer --pyodide');
const execute=engine=>play(resolve(values.pyodide),values.condition,engine,!values['sans-sonde']);
if(values.source && values.moteur!=='candidat') throw Error('Deux sources de moteur indiquées.');
const result=values.moteur==='candidat' ? await execute(values.source) : await withEngine(values.moteur,execute);
if(values.recu) await writeFile(values.recu,JSON.stringify(result)+'\n');
console.log(JSON.stringify({condition:values.condition,prefixe:result.prefix.length,
  tours:result.history.slice(12).map(r=>[r.i,r.family,r.strategy,r.ticket.command,r.returned.matched,r.returned.acquisition?.status]),
  arret:result.stop}));
