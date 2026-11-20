import { PushPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS02_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';
import { heroCell, lessonPrompt, observeLesson, pushedCount, type TutorialLesson } from './tutorial.js';

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
let learned = new Set<TutorialLesson>();
function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const hex = PALETTE[frame[y]![x]!]!.slice(1), rgb = parseInt(hex, 16), at = (y * 64 + x) * 4;
    image.data[at] = rgb >>> 16; image.data[at + 1] = (rgb >>> 8) & 255;
    image.data[at + 2] = rgb & 255; image.data[at + 3] = 255;
  }
  ctx!.putImageData(image, 0, 0);
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
    item.classList.toggle('done', learned.has(item.dataset.lesson as TutorialLesson));
  }
  $('lesson-next').textContent = lessonPrompt(learned);
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
  moves++; observeLesson(learned,before,next,action);
  $('feedback').textContent = next.levelsCompleted > before.levelsCompleted ? 'Niveau terminé !'
    : pushedCount(before,next,action) > 0 ? 'Poussée réussie.'
    : heroCell(before.frame) === heroCell(next.frame) ? 'Passage bloqué : vérifie les obstacles et la fin de la file.' : '';
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
  const a: Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4};
  if (a[event.key]) {event.preventDefault();act(a[event.key]!);}
});
void present(observation);
canvas.focus({preventScroll:true});
