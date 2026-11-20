import {Author} from './author.mjs';
const spec={
  id:'ss10-08',
  title:'Les cinq points d’appui',
  rows:[
    '~~~~~~~~~~~~~',
    '~~~~~~......~',
    '~~~~~~.ooooo~',
    '~~~~~~......~',
    '~~~.........~',
    '~~~.~#.T.W..~',
    '~~~~~.###~~~~',
    '~g~...~g~~~~~',
    '~~~~~~~~~~~~~',
  ],
  facing:'W',
};
const a=new Author(spec);
a.save(new URL('../level8-design.json',import.meta.url),{
  piston:false,
  platform:false,
  label:'Reprise de Heroes and Water · énigme 3 · les cinq points d’appui',
  url:'https://sinkingstarwalkthrough.com/fr/heroes-and-water-solutions/#%C3%A9nigme-3',
  puzzle:3,
  objective:'Construire les cinq appuis dans les directions gauche, haut, bas, droite puis gauche, et échanger les positions des héros pour livrer la dernière caisse.',
});
