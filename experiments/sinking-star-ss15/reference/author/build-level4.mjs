import {Author,board} from './author.mjs';
import {writeFileSync} from 'node:fs';
import {stepDetailed,circuitPressed} from '../../dist/core.js';
import {decodeCommand} from '../../scripts/solver.mjs';
import assert from 'node:assert/strict';

const b=board(20,20);
b.fill(1,1,8,9);b.fill(10,1,18,9);b.put(9,6);
b.put(3,5,'#');b.put(4,6,'#');
b.fill(1,10,18,10,'~');b.put(6,10,'#');
b.fill(1,11,13,18);b.fill(14,11,14,18,'~');b.fill(15,11,18,12);
// Empty final chamber: only the closed west-facing press admits entry.
b.fill(16,14,18,18);b.put(15,16);
// The second final weight can only enter this dead end through the mirror.
b.put(13,5,'#');b.put(15,5,'#');b.put(14,6,'#');
b.put(2,2,'Z');b.put(4,5,'B');
for(const [x,y] of [[6,2],[2,5],[4,7],[6,7],[17,4]])b.put(x,y,'o');
b.put(10,16,'m');b.put(13,16,'m');
b.put(17,17,'g');b.put(18,17,'g');
export const spec={id:'ss15-04',title:'L’atelier des passages croisés',rows:b.strings(),
 mirrors:[{at:{x:14,y:4},facing:'NE'}],
 circuits:[
  {id:'releve',buttons:[{x:2,y:2},{x:4,y:5}],color:10},
  {id:'depot-miroir',buttons:[{x:12,y:9}],color:15},
  {id:'trois-postes',buttons:[{x:2,y:5},{x:16,y:4},{x:14,y:5}],color:11},
 ],
 gates:[
  {at:{x:9,y:6},circuit:'releve',direction:'W',closedWhen:'released'},
  {at:{x:14,y:4},circuit:'depot-miroir',direction:'S',closedWhen:'pressed'},
  {at:{x:15,y:16},circuit:'trois-postes',direction:'W',closedWhen:'released'},
 ],
};

export function build(){
 const a=new Author(spec);
 const stage=label=>{a.stage(label);if(process.env.SS15_AUTHOR_DEBUG)console.log(label,a.commands.length,JSON.stringify({heroes:a.state.heroes,stones:a.state.stones,supports:a.state.supports,mirrors:a.state.mirrors,monsters:a.state.monsters}));};
 a.act('R');
 a.go(4,3).act('DU');
 a.select('bard').act('RUUL');
 stage('Le premier échange et le chant sélectif garnissent les deux commandes de relève ; la caisse retenue reste sur le troisième circuit.');
 a.go(6,3,'wizard').act('L');
 stage('Le Magicien extrait le Barde de son cortège sans retirer les deux poids de la porte.');
 a.go(14,2,'wizard').act('D');
 stage('Le rayon dévié ramène la caisse du poste oriental sur l’axe nord du miroir.');
 a.act('X');
 stage('Le reflet place la caisse la plus proche sur la commande orientale, tandis que le Magicien reste sur l’autre axe.');
 a.go(12,8,'wizard').act('D');
 stage('La presse pousse le miroir dans son cul-de-sac : les trois postes ouvrent la chambre, encore séparée par l’eau.');
 a.go(10,8,'wizard');
 a.select('bard').act('DDDDDRDU');
 stage('Le Barde descend la caisse de traversée, utilise la butée puis l’immerge pour créer le seul appui.');
 a.go(7,9,'wizard').act('D');
 a.select('bard').act('DDD');
 stage('Le Magicien ancre l’appui ; le chant fait traverser les deux héros sans déplacer le passage sous leurs pieds.');
 a.go(2,15,'wizard');
 a.select('bard').act('DD').go(9,14).act('RR');
 stage('Le chant rapproche les deux gardiens : leur combat simultané libère l’approche du dernier bras d’eau.');
 a.go(7,12,'bard').act('LL');
 stage('La butée retient l’appui pendant que le Barde corrige son écart de deux cases.');
 a.select('bard').act('RRRRRRRUDDDDDD');
 stage('Le même appui glisse sur le bras horizontal, tourne dans le bras vertical et rejoint le seuil de la chambre.');
 a.go(12,16,'bard').act('RRRR').go(17,17);
 a.go(18,17,'wizard');
 stage('Les poids restent sur leurs postes ; les deux héros franchissent le passage préparé et occupent ensemble les destinations.');
 const design=a.result({
  label:'Atelier original renforcé · Magicien, Barde et passages croisés',url:'https://sinkingstarwalkthrough.com/fr/north/',
  secondaryLabel:'Zones mixtes · eau, miroirs et dépôts latéraux',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/crossovers/',
  objective:'Préparer les trois poids de la chambre, fabriquer l’appui puis le réemployer entre les deux bras d’eau pour faire arriver le duo.',
 },{
  kind:'original-tutorial',
  preserved:['Le Magicien remplace une cible par échange ; le Barde transporte les ressources.','Les départs forcés évitent le chant et conservent les poids.','Les vingt découvertes publiques restent réalisables au cours d’une route gagnante.'],
  changed:['L’ancien atelier libre est déplacé au niveau 4 et reconstruit autour d’une chambre finale murée, vide au départ et fermée par trois poids physiques.','Les premiers exercices garnissent deux commandes de relève ; la caisse retenue par une cloison conserve un poste du circuit final.','Le rayon dévié prépare un dépôt par reflet ; une presse range ensuite le miroir dans un cul-de-sac nécessaire au circuit final.','Une caisse devient un unique appui, ancré pour la première traversée puis réemployé dans deux bras d’eau après une correction d’écart par butée.','Les monstres gardent l’approche du dernier passage ; leur rapprochement par chant les élimine simultanément.'],
  sourceReading:'Composition pédagogique originale nourrie du monde Nord et des zones mixtes. Le réemploi d’un appui et le recalage par butée évoquent Heroes and Water ; les dépôts orientés et le reflet complètent la coopération Magicien/Barde. Aucune carte commerciale n’est reproduite.',
  localCounterfactuals:[],
  proofScope:'La route et les contre-branches vérifient leurs seuls résultats exécutés. Les variantes légales restent possibles ; aucune unicité ni optimalité globale n’est revendiquée.',
 });
 const checks=design.adaptation.localCounterfactuals;
 const at=(p,x,y)=>p.x===x&&p.y===y;
 function branch(label,stageIndex,prepare,commands,expected,meaning){
  const point=design.stages[stageIndex],trial=new Author(spec).act(design.commands.slice(0,point.turn));prepare(trial);
  let state=trial.state;const phases=[];
  for(const c of commands){const action=decodeCommand(c,state),d=stepDetailed(trial.world,state,action.id,action.data);state=d.state;phases.push(...d.phases);}
  assert(expected(state,phases),label);
  checks.push({label,afterTurn:point.turn,commands:trial.commands.slice(point.turn)+commands,meaning,refused:state.failed,dead:state.dead,complete:state.complete,heroes:state.heroes,stones:state.stones,supports:state.supports,monsters:state.monsters,mirrors:state.mirrors,circuits:Object.fromEntries(trial.world.circuits.map(c=>[c.id,circuitPressed(trial.world,state,c.id)])),phases:phases.map(p=>p.kind)});
 }
 branch('ordinary-departure-releases-the-relay',0,()=>{},'R',s=>!s.failed&&!s.dead&&!circuitPressed(a.world,s,'releve'),
  'Un départ volontaire du Barde retire la caisse de la commande de relève et referme la porte. L’extraction par échange du parcours auteur conserve ce poste ; un autre placement reste possible.');
 branch('press-before-the-crate-reflection',2,t=>t.go(12,8,'wizard').act('D'),'X',s=>s.failed&&!s.dead&&s.mirrors.some(m=>at(m.at,14,5))&&!circuitPressed(a.world,s,'trois-postes'),
  'Déplacer le miroir avant le reflet laisse la caisse sur l’axe nord. Le reflet tenté après cette fermeture est refusé ; il ne remplit pas la commande orientale.');
 branch('open-door-is-not-a-water-passage',4,()=>{},'D',s=>s.failed&&!s.dead&&s.supports.length===0&&circuitPressed(a.world,s,'trois-postes'),
  'Les trois commandes ouvrent la chambre, mais elles ne soutiennent pas l’eau : le pas direct du Magicien vers le bras horizontal est refusé.');
 branch('wrong-song-while-the-wizard-anchors',5,t=>t.go(7,9,'wizard').act('D').select('bard'),'R',s=>s.failed&&!s.dead&&at(s.heroes.find(h=>h.kind==='wizard').at,7,10)&&s.supports.some(p=>at(p,7,10)),
  'Le Magicien ancre l’appui. Un chant vers la droite tenterait de l’envoyer dans une case d’eau voisine sans soutien ; toute l’action est refusée. Le chant vers la rive fait traverser le duo.');
 branch('ignore-the-guardian-at-the-last-bank',6,t=>t.go(11,15,'wizard'),'D',s=>s.dead&&s.heroes.find(h=>h.kind==='wizard').dead,
  'Approcher le dernier bras sans écarter les gardiens expose le Magicien à un voisin orthogonal. Le combat du parcours auteur libère cette approche.');
 branch('approach-lifts-the-final-support',9,t=>t.act('U').go(13,16,'wizard'),'R',s=>s.failed&&!s.dead&&s.supports.some(p=>at(p,14,15)),
  'Remonter immédiatement avec le Barde emporte l’appui au-dessus du seuil. Le pas suivant du Magicien vers le passage prévu est refusé ; le Barde doit contourner pour conserver l’alignement.');
 design.difficultyNotes={role:'Atelier intermédiaire à vingt découvertes reliées par des commandes, une presse et le réemploi du même appui.',resources:{initialDryCrates:5,initialSupports:0,mirrors:1,monsters:2,finalWeights:3},finalChamber:{bounds:{x1:16,y1:14,x2:18,y2:18},threshold:{x:15,y:16},waterApproach:{x:14,y:16},initialActors:0,pressDirection:'W'},referencePlanDependencies:design.stages.map(s=>s.label),claimScope:'Les observations et branches locales sont exécutées. Le contrôle indépendant de la chambre et des approches figure dans le rapport de contraintes ; aucun résultat borné n’est présenté comme une preuve globale.'};
 return design;
}
if(process.argv[1]?.endsWith('build-level4.mjs')){
 const design=build();writeFileSync(new URL('../level4-design.json',import.meta.url),JSON.stringify(design,null,2)+'\n');
 console.log(JSON.stringify({title:design.spec.title,metrics:design.metrics,stages:design.stages.length}));
}
