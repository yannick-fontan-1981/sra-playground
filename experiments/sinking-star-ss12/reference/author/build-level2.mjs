import {Author,board} from './author.mjs';

// North / Bard 14: two weights must stay on their plates while the Warrior
// moves the Bard without a song. The adaptation replaces monsters with
// crates and extends the forced convoy into a three-cell water crossing.
const b=board(20,13);
b.fill(1,8,7,11);
b.fill(1,5,18,5);
b.fill(1,5,1,8);
b.fill(2,3,7,3);
b.fill(2,7,7,7);
b.fill(13,5,15,5,'~');
b.fill(17,4,18,6);
b.put(2,5,'B');b.put(2,9,'W');
b.put(2,3,'o');b.put(2,7,'o');
b.put(10,5,'o');b.put(11,5,'o');b.put(12,5,'o');
b.put(18,4,'g');b.put(18,6,'g');
const spec={id:'ss12-02',title:'Les deux rails et le convoi',rows:b.strings(),
 circuits:[{id:'rails',buttons:[{x:5,y:3},{x:5,y:7}],color:0}],
 gates:[{at:{x:8,y:5},circuit:'rails',direction:'E',closedWhen:'released'}]};
const a=new Author(spec);
a.select('bard').act('RRR').stage('Deux caisses chantées sur leurs boutons, avec deux cases de rail encore libres à l’est');
a.go(4,5,'warrior').act('RRRRRRRRRRRR').stage('Le Guerrier pousse le Barde sans entraîner les poids, puis la file de trois caisses : trois appuis permanents');
a.select('bard').act('UR').stage('Le Barde quitte le pont, dont les appuis sont arrêtés par la rive');
a.select('warrior').act('DR');
a.save(new URL('../level2-design.json',import.meta.url),{
 label:'Adaptation de Heroes 3: Bard, Druid · énigme 14',
 url:'https://sinkingstarwalkthrough.com/fr/heroes-3-bard-druid-solutions/#%C3%A9nigme-14',puzzle:14,
 image:'https://sinkingstarwalkthrough.com/img/north/hauling-3/puzzle-14.webp',
 objective:'Poser les deux poids au milieu de leurs rails, puis faire avancer le Barde sans chant pour préserver l’ouverture et construire le pont.'
},'La contrainte de l’énigme 14 est reprise : deux poids chantés doivent rester sur leurs boutons pendant que le Guerrier déplace le Barde sans chant. Les deux monstres de la source deviennent des caisses dans des rails séparés. Les rails continuent deux cases après les boutons : depuis la position de commande, marcher volontairement vers l’est entraîne les poids et referme la porte. Le déplacement imposé par le Guerrier les conserve. La géométrie est reconstruite et prolongée par un convoi de trois caisses qui comblent trois cases d’eau. Une route valide de 31 actions démontre cette combinaison, sans affirmation d’unicité ou d’optimalité.');
