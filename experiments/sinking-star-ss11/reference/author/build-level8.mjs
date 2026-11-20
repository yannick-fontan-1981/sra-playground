import {Author,board} from './author.mjs';

/**
 * Adaptation of Heroes and Water, puzzle 11, from the guide screenshot.
 * Keep the five islands, seven crates, central pair of destinations, and the
 * unique short water crossing between the northeast and the central island.
 * The northeast loses one column to fit 20 cells. The southeast lower turning
 * bay gains one row; crate starts are recentered for SS11's fixed sunken crates.
 * This is deliberately an adaptation, not a certified cell-for-cell extraction.
 */
const b=board(20,18,'~');
b.fill(3,0,6,2);                  // Northwest: initial Warrior / crate parking.
b.fill(0,9,5,12);                 // Southwest: initial Wizard and two crates.
b.fill(9,5,12,9);                 // Centre: only one initial occupant, two goals.
b.fill(14,2,19,5);                // Northeast: the only one-cell bridge to centre.
b.fill(15,11,18,16);              // Southeast: main island and turning room.
b.fill(11,15,14,17);              // Southeast: lower-left lobe, same connected island.

b.put(5,0,'W');
b.put(3,11,'Z');
for(const [x,y] of [[1,9],[0,10],[9,6],[17,3],[18,4],[17,13],[12,16]])b.put(x,y,'o');
b.put(10,8,'g');b.put(11,8,'g');

const spec={id:'ss11-08',title:'Les cinq îles — le vrai transfert',rows:b.strings(),facing:'S'};
const a=new Author(spec);

// Manual author route. No puzzle search or exhaustive solver is used here.
a.act('DD').select('wizard');
a.act('UUL DRRRRDD U LLD');
a.stage('Le Guerrier rejoint le sud-ouest ; une caisse remplace le Magicien au nord-ouest.');

a.select('warrior').act('UULLLLUL DDD RRRRR');
a.stage('Une caisse devient un appui sous le bord sud-ouest et crée la ligne vers le sud-est.');

a.select('wizard').act('DDDLLLDR DLLUUL');
a.stage('Le Magicien atteint le sud-est puis échange le Guerrier à sa place.');

a.select('warrior').act('DDDDLLDL U LU RRRRR DR UUU R');
a.stage('Le détour dans le lobe inférieur ramène la seconde caisse sur la ligne du sud-ouest.');

a.select('wizard').act('R U R D D');
a.stage('Le Magicien revient au sud-est, monte au nord-est et y échange le Guerrier.');

a.select('warrior').act('LUURDD RD LLLLL LL');
a.stage('Le Guerrier construit le pont nord-est et entre à pied sur l’île centrale.');

a.act('LLL DDD RR');
a.stage('La caisse centrale descend sur la ligne de retour du Magicien.');

a.select('wizard').act('L UU RR UU RR U');
a.stage('Le Magicien revient par le sud-ouest et rejoint la deuxième destination.');

const source={
  piston:false,
  platform:false,
  label:'Adaptation de Heroes and Water · énigme 11 · les cinq îles',
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-11',
  puzzle:11,
  image:'https://sinkingstarwalkthrough.com/img/crossovers/heroes-and-water/puzzle-11.webp',
  objective:'Les échanges conservent le nombre d’occupants de chaque îlot. Le Guerrier doit créer un appui au nord-est et traverser à pied pour que les deux héros puissent rejoindre le centre.',
};
const adaptation={
  kind:'source-topology-adaptation',
  preserved:[
    'Guerrier et Magicien, cinq îlots et sept caisses.',
    'Guerrier au nord-ouest, Magicien au sud-ouest, deux destinations au centre.',
    'Îlot sud-est en L : une caisse doit changer de rangée avant de servir de relais.',
    'Une seule case d’eau entre le nord-est et le centre ; les autres trajets exigent des échanges.',
    'Une entrée à pied, et non un échange seul, augmente le nombre d’occupants de l’île centrale.',
  ],
  changed:[
    'Nord-est réduit de sept à six colonnes pour respecter la limite de vingt cellules.',
    'Bande de retournement au sud-est agrandie d’une rangée pour les poussées orthogonales du moteur SS11.',
    'Positions de départ des caisses recentrées ; la capture de référence ne permet pas de certifier chaque cellule sous les sprites.',
  ],
  sourceReading:'Lecture visuelle de la capture du guide et de ses étapes. Aucune prétention de reproduction exacte.',
  authoredRoute:'Parcours écrit à la main puis rejoué ; aucune recherche exhaustive.',
  resourceRoles:{
    northwestRelay:'La caisse (1,9) permet de ramener le Magicien après son échange avec le Guerrier.',
    southwestSupport:'La caisse (0,10) crée l’appui qui aligne le Magicien avec le sud-est.',
    southeastFirstRelay:'La caisse (17,13) reçoit le premier échange vers le sud-est puis sert au retour.',
    southeastTurningCrate:'La caisse (12,16) doit contourner le lobe inférieur pour ramener le Magicien.',
    northeastFirstRelay:'La caisse (17,3) permet au Magicien de gagner le nord-est.',
    northeastBridge:'La caisse (18,4) devient l’appui indispensable vers l’île centrale.',
    centralRelay:'La caisse (9,6) descend vers le sud-ouest pour le dernier échange.',
  },
};
a.save(new URL('../level8-design.json',import.meta.url),source,adaptation);
