import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { prepareFixture } from '../fiche.mjs';
import { withEngine, current } from '../versions.mjs';

const { values } = parseArgs({options:{ fiche:{type:'string'},mode:{type:'string',default:'active'},moteur:{type:'string',default:'candidat'} }});
if (!values.fiche) throw Error('Indiquer --fiche et son chemin');
const card = JSON.parse(await readFile(values.fiche,'utf8'));
const play = async root => console.log(JSON.stringify(await (await prepareFixture(root))(card,values.mode)));
if (values.moteur === 'candidat') await play(current.href);
else if (values.moteur === 'gel') await withEngine('gel',play);
else throw Error('Moteur gel ou candidat attendu');
