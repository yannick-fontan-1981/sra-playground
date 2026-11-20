import { Author, board } from './author.mjs';

const floor = board(13, 15);
for (const [left, top, right, bottom] of [
  [1, 1, 4, 4],
  [6, 1, 10, 4],
  [7, 6, 10, 8],
  [2, 6, 5, 8],
  [2, 10, 5, 13],
  [7, 10, 11, 13],
]) floor.fill(left, top, right, bottom);
for (const [x, y] of [[4,1], [6,1], [10,4], [7,6], [10,8], [2,6], [5,10], [2,13], [7,10], [7,13], [11,10], [11,13]]) {
  floor.put(x, y, '#');
}
for (const [x, y] of [[5,3], [9,5], [6,7], [3,9], [6,11]]) floor.put(x, y, '~');
for (const [x, y] of [[2,1], [8,2], [9,8], [5,8], [3,12]]) floor.put(x, y, 'o');
floor.put(1, 3, 'W');
floor.put(3, 4, 'T');
floor.put(9, 11, 'g');
floor.put(10, 12, 'g');

const level = new Author({
  id: 'ss10-08',
  title: 'Les cinq points d’appui',
  rows: floor.strings(),
  facing: 'E',
});

level.go(2, 2, 'thief').act('DD')
  .go(1, 3, 'warrior').act('RRR')
  .stage('Le Voleur extrait la caisse de la rive nord et le Guerrier ouvre le passage est.');
level.go(7, 2, 'warrior').act('R')
  .go(9, 1).act('DDD').go(10, 6)
  .stage('Le Guerrier aligne la deuxième caisse avant de la pousser vers le sud.');
level.go(9, 7, 'thief').act('U')
  .go(10, 7, 'warrior').act('LLL').go(5, 6)
  .stage('Le Voleur remonte la caisse du bassin central, puis le Guerrier ouvre le passage ouest.');
level.go(4, 8, 'thief').act('LL')
  .go(3, 7, 'warrior').act('D')
  .stage('La traction sépare la caisse de la paroi droite. La poussée ouvre le passage sud.');
level.go(3, 13, 'warrior').act('U')
  .go(2, 11).act('RRR')
  .stage('Le Guerrier ramène la dernière caisse sur la bonne ligne et comble le passage est.');
level.go(9, 11, 'warrior').go(10, 12, 'thief')
  .stage('Les deux destinations sont occupées.');

level.save(new URL('../level8-design.json', import.meta.url), {
  label: 'Création originale · Relayer cinq caisses dans une traversée en chicane',
  url: '',
  objective: 'Construire un appui à chacune des cinq coupures. Extraire les caisses des bords avec le Voleur puis les pousser dans l’eau avec le Guerrier.',
}, {
  kind: 'original',
  design: 'Six secteurs en chicane, cinq coupures d’une case et cinq caisses réparties côté départ de chaque coupure.',
  proof: 'On peut isoler chaque coupure en autorisant les quatre autres. Même sans les contraintes de déplacement des caisses, retirer une seule liaison coupe l’accès aux deux destinations.',
});
