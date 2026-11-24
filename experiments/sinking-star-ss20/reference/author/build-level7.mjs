import {writeFileSync} from 'node:fs';
import {Author,board} from './author.mjs';
const b=board(20,20);
b.fill(1,3,4,5);b.fill(4,5,14,5);b.fill(10,1,14,5);b.fill(12,6,13,6);
b.fill(6,9,8,11);b.fill(8,9,13,9);b.fill(13,7,13,11);
b.fill(7,2,8,4);b.put(7,3,'o');b.put(7,6);b.put(7,7);b.put(7,8,'T');b.put(6,8,'~');b.put(6,7,'m');b.put(11,9,'m');b.put(11,10,'~');
b.put(3,5,'M');b.put(5,5,'B');b.put(14,1,'o');
b.put(15,5);b.fill(16,3,18,6);for(const x of [16,17,18])b.put(x,3,'g');
export const spec={id:'ss20-07',title:'La relève du passeur',rows:b.strings(),facing:'E',circuits:[{id:'releve',color:15,buttons:[{x:7,y:8}]},{id:'sortie',color:14,buttons:[{x:13,y:6}]}],gates:[{at:{x:7,y:7},circuit:'releve',direction:'S',closedWhen:'released'},{at:{x:6,y:5},circuit:'releve',direction:'E',closedWhen:'released'},{at:{x:9,y:9},circuit:'releve',direction:'E',closedWhen:'released'},{at:{x:15,y:5},circuit:'sortie',direction:'E',closedWhen:'released'}]};
export function build(){const a=new Author(spec);
 a.select('merchant').act('RRRR');
 a.stage('Le Marchand pousse le Barde à travers le sas : chanter aurait rapproché le gardien du Voleur, immobilisé sur son bouton.');
 a.select('merchant').act('URUULDDDD');
 a.stage('Depuis l’autre côté du sas, le Marchand contourne la réserve haute et la descend sur la presse ouverte.');
 a.select('thief').act('D');a.select('merchant').act('UUUU');
 a.stage('Le Voleur tire la caisse depuis la presse jusque sur son propre bouton en quittant celui-ci. La relève conserve les accès ouverts ; avant la livraison, sortir vers le haut l’aurait renvoyé sur son bouton.');
 a.select('bard').act('RRRRRDDDD');
 a.stage('Depuis l’angle sec, un pas de chant vers le bas retire le second gardien dans l’eau. Le couloir du Voleur devient praticable.');
 a.go(14,5);
 a.select('thief').go(13,1).act('L');
 a.stage('La réserve est sortie latéralement de son alvéole. Sa face droite et son arrière sont des murs : il faut changer de côté.');
 a.go(13,2).act('DDDD').act('L');
 a.select('merchant').go(13,4).act('D');
 a.stage('Après un second tirage dans l’autre axe, le Marchand dépose la réserve sur la commande d’arrivée. La première caisse reste au relais.');
 a.select('bard').act('RRRUU');
 a.stage('La dernière marche chantée entraîne aussi le Marchand ; la caisse d’arrivée est retenue par le mur à droite.');
 a.select('thief').go(18,3);
 return a.result({objective:'Faire passer le Barde sans chant dangereux, établir la relève du Voleur puis extraire la réserve dans deux axes.',label:'Heroes and Water — énigmes 28 et 29',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/',puzzles:[28,29],secondaryLabel:'Heroes and Light — énigme 2',secondaryUrl:'https://sinkingstarwalkthrough.com/fr/heroes-and-light-solutions/'},'Water 28 fournit le départ forcé du Barde, sans déclencher son chant ; Water 29 fournit la réserve qu’un tirage extrait d’un accès fermé à la poussée. Ici le départ forcé protège un Voleur sur son bouton, puis une caisse livrée depuis la réserve supérieure remplace ce passeur. Une presse orientée vers le bas empêche le Voleur d’extraire lui-même cette réserve avant le passage du Barde. Le gardien du couloir est noyé depuis un angle distinct. Les salles et le double changement d’axe remplacent entièrement les cartes sources ; il n’y a ni dragon, feu, échange magique ni déplacement autonome des monstres.');}
if(process.argv[1]?.endsWith('build-level7.mjs')){const d=build();writeFileSync(new URL('../level7-design.json',import.meta.url),JSON.stringify(d,null,2)+'\n');console.log(JSON.stringify({title:spec.title,metrics:d.metrics,commands:d.commands}));}
