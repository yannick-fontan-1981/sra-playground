// Diagnostic postérieur au gel des 11 départs. Croise B3 (formulation) et N2 (retour de Q).
import { frozen } from '../reductions/consumer.mjs';
import { situations } from './situations.mjs';
import { probe } from './dialogue.mjs';

const [sha,depot] = process.argv.slice(2);
const solver = frozen(sha,depot);
const base = situations().find(c=>c.id==='B5');
base.message.sources[3] = 'La commande indexer P renvoie exactement « indexé ». Elle est disponible si P est non indexé et indexe P.';
for (const c of [{...base,id:'X1'}, {...base,id:'X2',negative:true,substitution:base.other}])
  console.log(JSON.stringify(await probe(c,solver)));
