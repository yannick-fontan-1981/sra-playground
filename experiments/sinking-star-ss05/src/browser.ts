import { BardPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS05_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';
import { actionFrame, heroCell, lessonPrompt, movedWithSong, observeLesson, reflected, sameCell, type BardLesson } from './tutorial.js';

const session = new BardPuzzleSession(SS05_LEVELS);
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS05_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
$('tutorial-title').textContent = `Niveau 1 · ${SS05_LEVELS[0]!.title}`;
let observation: Observation = session.observe();
let generation = 0;
let busy = false;
let moves = 0;
const learned = new Set<BardLesson>();

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
  $('level-title').textContent = SS05_LEVELS[observation.level - 1]!.title;
  $('progress').textContent = `${observation.levelsCompleted} / ${SS05_LEVELS.length} terminés`;
  $('moves').textContent = `${moves} actions`;
  const victory=observation.state==='WIN',gameOver=observation.state==='GAME_OVER';
  $('victory').hidden=!victory||busy;
  $('defeat').hidden=!gameOver||busy;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.disabled=busy||victory||gameOver;
  $<HTMLButtonElement>('undo').disabled=!observation.canUndo;
  $('tutorial').hidden=observation.level!==1;
  const info=LEVEL_INFO[observation.level-1]!;
  $('source-label').textContent=info.label;
  const link=$<HTMLAnchorElement>('source-link');
  link.hidden=!info.url;link.href=info.url;
  link.textContent=info.puzzle?`Voir l’énigme ${info.puzzle} de référence ↗`:'Voir la source ↗';
  $('piston-help').hidden=!info.piston;
  for(const item of document.querySelectorAll<HTMLElement>('[data-lesson]')) item.classList.toggle('done',learned.has(item.dataset.lesson as BardLesson));
  $('lesson-next').textContent = lessonPrompt(learned);
  canvas.dataset.level=String(observation.level);
  canvas.dataset.completed=String(observation.levelsCompleted);
  canvas.dataset.state=observation.state;
  canvas.dataset.busy=String(busy);
}
async function present(next: Observation): Promise<void> {
  const token=++generation;
  observation=next;busy=next.frames.length>1;updateUI();
  for(let i=0;i<next.frames.length;i++){
    if(token!==generation)return;
    paint(next.frames[i]!);
    if(i<next.frames.length-1)await new Promise<void>(resolve=>setTimeout(resolve,next.frameDurationsMs?.[i]??70));
  }
  if(token!==generation)return;
  busy=false;paint(next.frame);updateUI();
}
function act(action: number): void {
  if(busy||observation.state!=='NOT_FINISHED')return;
  const before=observation,next=session.action(action);
  moves++;observeLesson(learned,before,next,action);
  const final=actionFrame(before,next);
  $('feedback').textContent=next.state==='GAME_OVER'?'Le Barde est tombé. Z annule ; R recommence.'
    :next.levelsCompleted>before.levelsCompleted?'Niveau terminé !'
    :reflected(before,next,action)?'Reflet activé : les occupants changent d’axe.'
    :action===5?'Aucun reflet possible ici. Vérifie les arrivées et les faces blanches des miroirs.'
    :sameCell(heroCell(before.frame),heroCell(final))?'Ce pas est bloqué : le Barde et son cortège restent en place.'
    :movedWithSong(before,next)?'Le chant entraîne les objets proches dans ton déplacement.':'';
  void present(next);
}
function reset(kind:'undo'|'reset'|'restart'): void {
  generation++;busy=false;
  if(kind!=='undo'){moves=0;learned.clear();}
  $('feedback').textContent=kind==='undo'?'Dernière action annulée.':'Position initiale restaurée.';
  void present(session[kind]());canvas.focus({preventScroll:true});
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-action]'))b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for(const id of ['undo','reset','restart'] as const)$(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
$('undo-defeat').addEventListener('click',()=>reset('undo'));
$('reset-defeat').addEventListener('click',()=>reset('reset'));
select.addEventListener('change',()=>{generation++;busy=false;moves=0;learned.clear();void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});});
canvas.addEventListener('keydown',event=>{
  if(event.altKey||event.metaKey)return;
  const key=event.key.toLowerCase();
  if(key==='z'){event.preventDefault();reset('undo');return;}
  if(event.ctrlKey)return;
  if(key==='r'){event.preventDefault();reset('reset');return;}
  const actions:Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4,' ':5,x:5,X:5};
  if(actions[event.key]){event.preventDefault();act(actions[event.key]!);}
});
void present(observation);
canvas.focus({preventScroll:true});
