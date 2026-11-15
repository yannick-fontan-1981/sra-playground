import type { LevelSpec } from './core.js';
/** Original tutorial layouts, not copied from Order of the Sinking Star. */
export const SS01_LEVELS: readonly LevelSpec[] = [
  { id: 'SS01-L1', title: 'Première réflexion', facing: 'N', rows: [
    '#######',
    '#~~~~~#',
    '#~~~~~#',
    '#~~2.g#',
    '#~~.~~#',
    '#~~M~~#',
    '#######',
  ] },
  { id: 'SS01-L2', title: 'La bonne distance', facing: 'N', rows: [
    '#########',
    '#~~~~~~~#',
    '#~~~~~~~#',
    '#~~2~~g~#',
    '#~~.~~~~#',
    '#~~.~~~~#',
    '#~~.~~~~#',
    '#~~M~~~~#',
    '#########',
  ] },
  { id: 'SS01-L3', title: 'Reflet bloqué', facing: 'N', rows: [
    '#########',
    '#~~~~~~~#',
    '#~~~~~~~#',
    '#~~2~g#~#',
    '#~~.~~~~#',
    '#~~.~~~~#',
    '#~~M~~~~#',
    '#~~~~~~~#',
    '#########',
  ] },
];
