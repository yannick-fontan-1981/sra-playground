import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
import {solve} from '../../scripts/solver.mjs';
const {put,fill,strings}=board(20,18);
// Two starting shores; the shallow support track bends twice before the final gap.
fill(2,8,3,15);fill(5,8,7,15);fill(2,8,12,8);fill(12,3,12,8);put(13,3);
fill(15,2,18,4);
fill(4,6,4,16,'~');fill(4,6,14,6,'~');fill(14,3,14,6,'~');
put(7,10,'#');
put(2,14,'B');put(6,14,'M');put(4,12,'s');put(6,8,'o');put(6,12,'o');put(16,3,'g');put(17,3,'g');
const spec={id:'ss09-06',title:'Les trois passages de l’écluse',rows:strings(),facing:'N',circuits:[{id:'quay',buttons:[{x:6,y:10}],color:10}],platforms:[{at:{x:12,y:6},circuit:'quay',activeWhen:'pressed'}]};
const a=new Author(spec);
a.go(6,13,'merchant').act('UU').stage('Le Marchand immobilise une caisse contre le mur du bouton et déploie la passerelle');
a.go(7,8).select('bard').act('UUUUUU').stage('Le Barde remonte l’appui au-delà du futur pont entre les deux rives');
a.select('merchant').act('LL').stage('Le Marchand immerge la seconde caisse après le passage de l’appui mobile');
a.go(6,13).select('bard').act('RRRRRRRRRR').stage('La butée retient le poids tandis que le Barde transporte l’appui jusqu’au second coude');
a.act('UUUUU').stage('L’appui remonte le dernier canal et se cale contre la paroi nord');
a.act('RRRR').stage('Le Barde emprunte l’appui final ; le premier quai reste alimenté');
a.go(17,3,'merchant').stage('Le Marchand traverse les deux ouvrages et rejoint la seconde destination');
const design=a.save(new URL('../level6-design.json',import.meta.url),{label:'Adaptation de Heroes and Water 27 · guider un appui dans un labyrinthe',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-27',puzzle:27,objective:'Guider l’appui dans le canal, construire le pont après son passage et conserver le poids de la passerelle.'},'Géométrie originale de deux rives et d’un canal coudé. La référence utilise les murs pour modifier l’écart entre la Barde et le cristal immergé ; SS09 conserve le guidage et les butées, puis ajoute une coopération obligatoire : le Marchand prépare le poids de la passerelle et construit le pont seulement après le passage de l’appui. Les empilements et translations de deux cases du jeu source ne sont pas repris.');

// Exhaustion certifies only the disabled Merchant-push experiment; bounded runs
// for the other abilities are reported as inconclusive, never as a proof.
design.necessity={protocol:'BFS over full logical states, 60000-state/2500-ms caps; limit is inconclusive',ablations:{}};
for(const ability of ['disableMerchantPushes','disableBardSong','disableSupportMotion'])design.necessity.ablations[ability]=solve(spec,{maxStates:60000,maxMs:2500,[ability]:true});
if(design.necessity.ablations.disableMerchantPushes.status!=='unsolvable')throw Error('Merchant necessity not established');
writeFileSync(new URL('../level6-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
console.log(JSON.stringify({necessity:design.necessity}));
