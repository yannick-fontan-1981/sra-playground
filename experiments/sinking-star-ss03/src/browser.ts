import { PullPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS03_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

const session = new PullPuzzleSession(SS03_LEVELS);
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS03_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
let observation: Observation = session.observe();
let generation = 0;
let busy = false;
let moves = 0;
let learned = new Set<string>();
let lastPullAction = 0;
const directions = [{x:0,y:-3},{x:0,y:3},{x:-3,y:0},{x:3,y:0}] as const;

function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const hex = PALETTE[frame[y]![x]!]!.slice(1), rgb = parseInt(hex, 16), at = (y * 64 + x) * 4;
    image.data[at] = rgb >>> 16; image.data[at + 1] = (rgb >>> 8) & 255;
    image.data[at + 2] = rgb & 255; image.data[at + 3] = 255;
  }
  ctx!.putImageData(image, 0, 0);
}

/** Tutorial progress uses public pixels and the player's inputs, never the internal map. */
function heroCell(frame: number[][]): number {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y + 1]![x + 1] === 14) return y * 64 + x;
  }
  return -1;
}
function stoneAt(frame: number[][], x: number, y: number): boolean {
  return x >= 2 && x < 62 && y >= 2 && y < 62 && frame[y+1]![x+1] === 5
    && frame[y]![x+1] === 13 && frame[y+1]![x] === 13
    && frame[y+1]![x+2] === 13 && frame[y+2]![x+1] === 13;
}
function actionFrame(before: Observation, after: Observation): number[][] {
  // A successful exit can append the next room after the last image of this room.
  return after.level !== before.level && after.frames.length > 1 ? after.frames.at(-2)! : after.frame;
}
function pulled(before: Observation, after: Observation, action: number): boolean {
  const origin = heroCell(before.frame), direction = directions[action-1];
  if (origin < 0 || !direction) return false;
  const x = origin % 64, y = Math.floor(origin / 64), final = actionFrame(before,after);
  return heroCell(final) === (y+direction.y)*64+x+direction.x
    && stoneAt(before.frame,x-direction.x,y-direction.y) && stoneAt(final,x,y);
}
function observeLesson(before: Observation, after: Observation, action: number): void {
  if (before.level !== 1) return;
  const final = actionFrame(before,after), moved = heroCell(before.frame) !== heroCell(final);
  const didPull = pulled(before,after,action);
  if (moved) learned.add('move');
  if (didPull) {learned.add('pull');lastPullAction = action;}
  else if (moved) {
    const previous = directions[lastPullAction-1], current = directions[action-1];
    if (previous && current && previous.x*current.x+previous.y*current.y === 0) learned.add('release');
    lastPullAction = 0;
  }
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    const pinkCorners = final[y]![x] === 7 && final[y]![x+2] === 7
      && final[y+2]![x] === 7 && final[y+2]![x+2] === 7;
    if (pinkCorners && stoneAt(final,x,y)) learned.add('place');
    if (pinkCorners && final[y+1]![x+1] === 3 && final[y]![x+1] === 3) learned.add('gate');
  }
}
function visibleOpenGate(frame: number[][]): boolean {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x] === 7 && frame[y]![x+2] === 7
      && frame[y+2]![x] === 7 && frame[y+2]![x+2] === 7
      && frame[y+1]![x+1] === 3 && frame[y]![x+1] === 3) return true;
  }
  return false;
}
function updateUI(): void {
  select.value = String(observation.level);
  $('level-title').textContent = SS03_LEVELS[observation.level - 1]!.title;
  $('progress').textContent = `${observation.levelsCompleted} / ${SS03_LEVELS.length} terminés`;
  $('moves').textContent = `${moves} actions`;
  const victory = observation.state === 'WIN';
  $('victory').hidden = !victory;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.disabled = busy || victory;
  $<HTMLButtonElement>('undo').disabled = !observation.canUndo;
  $('tutorial').hidden = observation.level !== 1;
  const info = LEVEL_INFO[observation.level - 1]!;
  $('source-label').textContent = info.label;
  const link = $<HTMLAnchorElement>('source-link');
  link.hidden = !info.puzzle;
  link.href = `https://sinkingstarwalkthrough.com/fr/heroes-of-hauling-solutions/#${encodeURIComponent('énigme-' + info.puzzle)}`;
  link.textContent = `Voir l’énigme ${info.puzzle} de référence ↗`;
  for (const item of document.querySelectorAll<HTMLElement>('[data-lesson]')) {
    item.classList.toggle('done', learned.has(item.dataset.lesson!));
  }
  const stage = !learned.has('pull') ? 'Place-toi à côté d’une caisse, avec une case libre devant toi. Éloigne-toi d’elle avec une flèche : elle occupe la case que tu quittes.'
    : !learned.has('release') ? 'Pour laisser la caisse en place, pars sur le côté après une traction. Contourne-la pour la tirer ensuite dans une autre direction.'
    : !learned.has('place') ? 'Amène une caisse sur un + rose. Il faut pouvoir dépasser le bouton d’une case pour y tirer la caisse, puis partir sur le côté.'
    : !visibleOpenGate(observation.frame) ? 'Les trois + roses doivent être occupés ensemble. Garde de la place pour te repositionner autour des autres caisses.'
    : 'Le passage est ouvert. Rejoins le contour jaune en laissant les trois caisses sur leurs boutons.';
  $('lesson-next').textContent = stage;
  canvas.dataset.level = String(observation.level);
  canvas.dataset.completed = String(observation.levelsCompleted);
  canvas.dataset.state = observation.state;
  canvas.dataset.busy = String(busy);
}
async function present(next: Observation): Promise<void> {
  const token = ++generation;
  observation = next; busy = next.frames.length > 1; updateUI();
  for (let i = 0; i < next.frames.length; i++) {
    if (token !== generation) return;
    paint(next.frames[i]!);
    if (i < next.frames.length-1) await new Promise<void>(resolve => setTimeout(resolve,next.frameDurationsMs?.[i] ?? 70));
  }
  if (token !== generation) return;
  busy = false; paint(next.frame); updateUI();
}
function act(action: number): void {
  if (busy || observation.state === 'WIN') return;
  const before = observation, next = session.action(action);
  moves++; observeLesson(before,next,action);
  $('feedback').textContent = next.levelsCompleted > before.levelsCompleted ? 'Niveau terminé !'
    : pulled(before,next,action) ? 'Traction réussie : la caisse suit le Voleur.'
    : heroCell(before.frame) === heroCell(next.frame) ? 'Passage bloqué. Le Voleur tire les caisses ; il ne les pousse pas.' : '';
  void present(next);
}
function reset(kind: 'undo' | 'reset' | 'restart'): void {
  generation++; busy = false; lastPullAction = 0;
  if (kind !== 'undo') {moves = 0; learned = new Set();}
  $('feedback').textContent = kind === 'undo' ? 'Dernière action annulée.' : 'Position initiale restaurée.';
  void present(session[kind]());
  canvas.focus({preventScroll:true});
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for (const id of ['undo','reset','restart'] as const) $(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
select.addEventListener('change',()=>{generation++;busy=false;moves=0;learned=new Set();lastPullAction=0;void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});});
canvas.addEventListener('keydown',event=>{
  if (event.altKey || event.metaKey) return;
  const key=event.key.toLowerCase();
  if (key==='z') {event.preventDefault();reset('undo');return;}
  if (event.ctrlKey) return;
  if (key==='r') {event.preventDefault();reset('reset');return;}
  const a: Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4};
  if (a[event.key]) {event.preventDefault();act(a[event.key]!);}
});
void present(observation);
canvas.focus({preventScroll:true});
