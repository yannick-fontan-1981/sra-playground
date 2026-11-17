import { PushPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS02_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

const session = new PushPuzzleSession(SS02_LEVELS);
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS02_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
let observation: Observation = session.observe();
let generation = 0;
let busy = false;
let moves = 0;
let learned = new Set<string>();
function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const hex = PALETTE[frame[y]![x]!]!.slice(1), rgb = parseInt(hex, 16), at = (y * 64 + x) * 4;
    image.data[at] = rgb >>> 16; image.data[at + 1] = (rgb >>> 8) & 255;
    image.data[at + 2] = rgb & 255; image.data[at + 3] = 255;
  }
  ctx!.putImageData(image, 0, 0);
}
/** Tutorial progress is inferred from public frames, not the engine's internal map. */
function observeLesson(before: Observation, after: Observation, action: number): void {
  if (before.level !== 1) return;
  if (action >= 1 && action <= 4 && JSON.stringify(before.frame) !== JSON.stringify(after.frame)) learned.add('move');
  const f = after.frame;
  let outlines = 0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (f[y]![x] === 1 && f[y]![x+2] === 1 && f[y+2]![x] === 1 && f[y+2]![x+2] === 1) outlines++;
    if (f[y]![x] === 10 && f[y]![x+2] === 10 && f[y+1]![x+1] === 10 && f[y+2]![x] === 10 && f[y+2]![x+2] === 10) learned.add('bridge');
    if (f[y]![x] === 7 && f[y]![x+2] === 7 && f[y+2]![x] === 7 && f[y+2]![x+2] === 7 && f[y+1]![x+1] === 3 && f[y]![x+1] === 3) learned.add('gate');
  }
  if (outlines > 0) learned.add('preview');
  if (action === 5 && after.frames.length > 1) {
    learned.add('push');
    let ghosts = 0;
    for (let y=2; y<62; y+=3) for (let x=2; x<62; x+=3) {
      const p = before.frame;
      if (p[y]![x]===1 && p[y]![x+2]===1 && p[y+2]![x]===1 && p[y+2]![x+2]===1) ghosts++;
    }
    if (ghosts > 1) learned.add('chain');
  }
}
function updateUI(): void {
  select.value = String(observation.level);
  $('level-title').textContent = SS02_LEVELS[observation.level - 1]!.title;
  $('progress').textContent = `${observation.levelsCompleted} / 8 terminés`;
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
  const stage = !learned.has('preview') ? 'Approche-toi des deux pierres du passage. Une flèche vers elles oriente le Guerrier sans les pousser.'
    : !learned.has('chain') ? 'Appuie sur Espace : une file entière avance d’une case si son extrémité est libre.'
    : !learned.has('bridge') ? 'Une pierre poussée dans l’eau devient un pont. Préserve les deux autres pour les boutons.'
    : !learned.has('gate') ? 'Place une pierre sur chacun des deux + roses. Le Guerrier peut aussi peser sur un bouton, mais pas le laisser libre en traversant.'
    : 'Les deux boutons doivent rester occupés. Dès que la porte est ouverte, rejoins le contour jaune.';
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
  $('feedback').textContent = next.level !== before.level ? 'Niveau terminé !' : action === 5 ? (next.frames.length > 1 ? 'Poussée réussie.' : 'Poussée impossible : vérifie la fin de la file et les portes.') : '';
  void present(next);
}
function reset(kind: 'undo' | 'reset' | 'restart'): void {
  // New generation invalidates any pending animation callback immediately.
  generation++; busy = false;
  if (kind !== 'undo') {moves = 0; learned = new Set();}
  $('feedback').textContent = kind === 'undo' ? 'Dernière action annulée.' : 'Position initiale restaurée.';
  void present(session[kind]());
  canvas.focus({preventScroll:true});
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for (const id of ['undo','reset','restart'] as const) $(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
select.addEventListener('change',()=>{generation++;busy=false;moves=0;learned=new Set();void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});});
canvas.addEventListener('keydown',event=>{
  if (event.altKey || event.metaKey) return;
  const key=event.key.toLowerCase();
  if (key==='z') {event.preventDefault();reset('undo');return;}
  if (event.ctrlKey) return;
  if (key==='r') {event.preventDefault();reset('reset');return;}
  const a: Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4,' ':5};
  if (a[event.key]) {event.preventDefault();act(a[event.key]!);}
});
void present(observation);
canvas.focus({preventScroll:true});
