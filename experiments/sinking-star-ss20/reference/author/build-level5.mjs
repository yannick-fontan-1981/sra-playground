import {Author,board} from './author.mjs';
const b=board(20,20);
// A single offset changes the diagonal class; walls keep both monsters on
// visible rails. Their removal opens the only route to the cargo niche.
b.fill(5,2,8,4);b.put(5,2,'M');b.put(5,4,'T');b.put(8,3,'B');
b.fill(9,4,10,4);b.fill(10,5,10,10);b.put(10,5,'m');
b.put(11,8);b.put(11,9);b.put(12,9);b.fill(11,10,16,10);b.put(13,10,'m');b.put(16,10,'o');b.put(15,9);
b.fill(11,11,11,13);b.put(11,14,'~');b.fill(10,15,16,17);
b.put(10,18,'g');b.put(13,18,'g');b.put(16,18,'g');
const spec={id:'ss20-05',title:'Le pas qui manque',rows:b.strings(),facing:'E',
 circuits:[{id:'rail',buttons:[{x:10,y:5}],color:9},{id:'coude',buttons:[{x:11,y:10}],color:3}],
 gates:[{at:{x:9,y:4},circuit:'rail',direction:'N',closedWhen:'pressed'},{at:{x:12,y:9},circuit:'coude',direction:'N',closedWhen:'pressed'}],
 mirrors:[{at:{x:10,y:10},facing:'NE'}]};
const a=new Author(spec);
a.select('bard').act('D').stage('Un seul pas vers le sud déplace le gardien du haut ; le rail libère son bouton et ouvre l’entrée.');
a.act('X').go(8,3).stage('Le reflet dépose l’autre gardien à côté du premier : leur rencontre libère le passage, sans marche autonome.');
a.go(15,9,'merchant').stage('Préparer le Marchand dans le renfoncement droit avant de tirer la charge dans le couloir.');
a.go(15,10,'thief').act('LLLL').go(5,2).stage('Extraire la caisse du fond : le Voleur la ramène à portée, puis évacue le coude.');
a.go(13,10,'merchant').act('L').stage('Pousser la caisse jusqu’au coude ; le Marchand ne peut pas passer derrière pour tourner.');
a.go(10,8,'bard').act('D').stage('Le chant descend seulement la caisse dans la branche sud ; le mur retient le Marchand.');
a.go(11,10,'merchant').act('DDD').go(10,18).stage('Conserver la caisse sèche jusqu’au dernier goulet, puis la poser dans l’eau.');
a.go(13,18,'thief');a.go(16,18,'bard').stage('Franchir le passage créé et réunir les trois personnages.');
a.save(new URL('../level5-design.json',import.meta.url),{
 label:'Adaptation de Héros et Miroirs — énigmes 24–25',url:'https://sinkingstarwalkthrough.com/fr/heroes-and-mirrors-solutions/',puzzle:'24–25',
 objective:'Reconnaître une contrainte de diagonale, puis modifier un seul départ pour rendre une rencontre possible.'
},{kind:'adaptation',preserved:['Un reflet conserve la classe de diagonale de son acteur ; répéter la même image ne rapproche pas automatiquement les monstres.','Une rencontre orthogonale élimine une paire et libère matériellement le passage.','Les positions se préparent avant le reflet.'],changed:['Les deux monstres sont stables et aucun n’effectue de chasse ou de déplacement automatique.','Un déplacement sélectif du Barde modifie la géométrie ; aucun cristal dupliqué, fusionné ou créé.','Après la rencontre, un coude étroit exige extraction Voleur, poussée Marchand et décalage Barde avant l’unique traversée d’eau.','Les monstres ne deviennent pas des poids permanents sur deux boutons de sortie.'],sourceReading:'Les énigmes 24–25 exposent les restrictions de diagonale des monstres réfléchis ; SS20 en tire une seule correction visible, puis une manutention au coude propre au trio M/T/B.',localChecks:[]});
