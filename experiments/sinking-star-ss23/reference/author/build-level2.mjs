import {fileURLToPath} from 'node:url';
import {Author,board} from './author.mjs';

export function spec(){
 const b=board(14,11),{fill,put}=b;
 fill(1,1,3,9);fill(9,1,12,9);
 for(const[x,y]of[[4,2],[4,3],[4,5],[4,7],[4,8],[6,2],[7,2],[8,4]])put(x,y);
 fill(5,3,7,7);
 for(let y=4;y<=6;y++)for(let x=5;x<=7;x++)put(x,y,'o');
 put(1,5,'M');put(2,5,'W');put(3,5,'Z');put(4,7,'B');
 for(const[x,y]of[[10,2],[12,3],[10,6],[12,8]])put(x,y,'g');
 return{id:'ss23-02',title:'La grille des places libres',mode:'quartet',rows:b.strings(),facing:'E'};
}

export function build(){
 const a=new Author(spec());
 a.select('wizard').act('RRRURR');
 a.stage('Le Magicien traverse la grille de neuf caisses par échanges successifs, puis atteint la chambre droite. Chaque échange laisse une caisse à son départ ; aucune charge ne disparaît.');
 a.select('bard').act('D');
 a.stage('Depuis le poste inférieur, le Barde descend les deux colonnes proches. La colonne droite reste hors de portée. Le Guerrier et la caisse ramenée par le Magicien descendent aussi, sans pouvoir secondaire.');
 a.go(5,5,'warrior').act('URRRR').go(12,8);
 a.stage('Le Guerrier utilise la rangée libérée pour pousser une caisse vers le renfoncement haut, puis dégage le port droit. Sa file transporte le Magicien sans lancer de rayon.');
 a.go(5,4,'wizard').act('DDL').go(2,8).act('R');
 a.stage('Deux échanges verticaux déplacent la place de travail au bas de la grille. Le Magicien rejoint le poste extérieur et échange avec le Barde : celui-ci quitte sa butée sans chanter.');
 a.go(4,3,'wizard').act('RDR').go(12,3);
 a.stage('Le Magicien reprend le poste supérieur par une caisse, change de rangée, puis utilise la caisse envoyée dans la chambre droite comme cible de sortie. Ses échanges préservent les neuf charges.');
 a.go(2,9,'merchant').act('UUU').go(1,5).act('RRR');
 a.stage('Le Marchand conduit le Barde jusqu’au centre depuis le côté libre. Les six poussées déplacent un seul partenaire et laissent toutes les caisses en place.');
 a.select('bard').act('RURRRDDR');
 a.stage('Le décalage latéral, puis le dégagement haut, ouvrent le port. Les butées retiennent les rangs inférieurs ; le chant transporte le Marchand dans la chambre d’arrivée en même temps que le Barde.');
 a.go(10,2,'merchant');
 a.stage('Les quatre héros vivants occupent les quatre destinations. Les neuf caisses sont conservées, sans commande de poids ni objectif de rangement caché.');
 return a;
}

export const source={
 label:'Adaptation · Heroes of Hauling · énigme 11',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#%C3%A9nigme-11',
 puzzle:11,
 objective:'Traverser une grille de neuf caisses par échanges, déplacer les postes de travail puis dégager le sas pour les quatre héros.'
};
export const adaptation={
 sourcePrinciple:'L’énigme 11 fait progresser le Magicien à travers une grille de cristaux 3 × 3 par échanges successifs, avant un dernier transfert vers le côté de la sortie.',
 changes:'SS23 conserve la grille pleine et la mobilité de la place de travail, mais remplace le bouton et le bloc de sortie du guide par un sas sec à deux accès décalés. Le Barde désaligne les rangées depuis des postes distincts, le Guerrier ouvre le port droit et le Marchand replace le Barde sans chant. Les neuf caisses restent présentes ; quatre destinations remplacent la sortie du personnage seul.',
 limits:'Le plan et la coopération MWZB constituent une adaptation, pas une reproduction exacte. Les contrôles locaux comparent les premières cibles, la portée et les butées du chant ainsi que le replacement sans chant. Ils ne prouvent ni un ordre unique ni l’impossibilité globale sans une capacité.',
 localChecks:[
  {name:'Première cible et conservation des places',observed:'Le premier échange atteint la caisse proche et laisse les deux autres caisses de sa rangée en place ; les neuf charges subsistent à chaque étape.',scope:'Rejeu des premières commandes et du témoin complet ; aucune nécessité globale du rayon déduite.'},
  {name:'La poussée frontale ne remplace pas le premier désalignement',observed:'Avant le chant inférieur, la rangée de trois caisses bute contre le mur de droite et refuse la poussée ; après le chant, le Guerrier entre dans la rangée libérée.',scope:'Deux branches locales depuis le premier transfert du Magicien ; aucune impasse permanente revendiquée.'},
  {name:'Le décalage précède le dégagement haut',observed:'Au centre, chanter vers le haut immédiatement est refusé. Décaler vers la droite puis monter permet le transport ; condamner la case haute de dégagement bloque cette montée.',scope:'Comparaison locale du même poste du Barde et d’une variante de terrain avec une case fermée ; aucune impossibilité globale démontrée.'},
  {name:'Le replacement silencieux préserve les charges',observed:'Les six poussées du Marchand amènent le Barde au centre sans déplacer une caisse. Un pas volontaire du Barde vers le haut déplace au contraire la caisse proche.',scope:'Comparaison entre transport imposé et un pas chanté depuis le même état intermédiaire.'},
  {name:'Deux affectations gagnantes des destinations',observed:'Le Marchand et le Magicien peuvent échanger leurs destinations finales, avec neuf caisses conservées et sans refus ni décès.',scope:'Variante gagnante explicite ; pas d’affectation cachée d’une destination à un héros.'}
 ]
};

if(process.argv[1]===fileURLToPath(import.meta.url))build().save(new URL('../level2-design.json',import.meta.url),source,adaptation);
