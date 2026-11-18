import { WizardPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS04_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

const session = new WizardPuzzleSession(SS04_LEVELS);
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS04_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
$('tutorial-title').textContent = `Niveau 1 · ${SS04_LEVELS[0]!.title}`;
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

/** Tutorial and feedback read only public pixels, never the internal game state. */
function heroCell(frame: number[][]): number {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    const arms=[frame[y]![x+1],frame[y+1]![x],frame[y+1]![x+2],frame[y+2]![x+1]];
    if (frame[y + 1]![x + 1] === 15 && arms.filter(c=>c===15).length>=3) return y * 64 + x;
  }
  return -1;
}
function stoneAt(frame: number[][], x: number, y: number): boolean {
  return frame[y+1]?.[x+1] === 5 && frame[y]?.[x+1] === 13
    && frame[y+1]?.[x] === 13 && frame[y+1]?.[x+2] === 13 && frame[y+2]?.[x+1] === 13;
}
function monsterAt(frame: number[][], x: number, y: number): boolean {
  return frame[y+1]?.[x+1] === 8 && frame[y]?.[x+1] === 5
    && frame[y+1]?.[x] === 5 && frame[y+1]?.[x+2] === 5 && frame[y+2]?.[x+1] === 5;
}
function actorAt(frame: number[][], cell: number): boolean {
  if (cell < 0) return false;
  const x=cell%64,y=Math.floor(cell/64);
  return stoneAt(frame,x,y) || monsterAt(frame,x,y);
}
function sameLevelFrames(before: Observation, after: Observation): number[][][] {
  // A completed room may append the first image of the next room.
  return after.level !== before.level ? after.frames.slice(0,-1) : after.frames;
}
function exchangedFrame(before: Observation, after: Observation): number[][] | undefined {
  const origin=heroCell(before.frame);
  return sameLevelFrames(before,after).find(frame=>{
    const target=heroCell(frame);
    return target>=0 && target!==origin && actorAt(before.frame,target) && actorAt(frame,origin);
  });
}
function actionFrame(before: Observation, after: Observation): number[][] {
  return sameLevelFrames(before,after).at(-1) ?? after.frame;
}
function openGateCells(frame: number[][]): Set<number> {
  const open=new Set<number>();
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x] === 7 && frame[y]![x+2] === 7
      && frame[y+2]![x] === 7 && frame[y+2]![x+2] === 7
      && frame[y+1]![x+1] === 3) open.add(y*64+x);
  }
  return open;
}
function supportCount(frame: number[][]): number {
  let count=0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x]===10 && frame[y]![x+2]===10 && frame[y+2]![x]===10 && frame[y+2]![x+2]===10) count++;
  }
  return count;
}
function observeLesson(before: Observation, after: Observation): void {
  if (before.level!==1) return;
  const final=actionFrame(before,after), exchange=exchangedFrame(before,after);
  if (heroCell(before.frame)!==heroCell(final) && heroCell(final)>=0) learned.add('move');
  if (exchange) {
    learned.add('swap');
    const a=heroCell(before.frame),b=heroCell(exchange);
    if (a%64!==b%64 && Math.floor(a/64)!==Math.floor(b/64)) learned.add('mirror');
  }
  for (const frame of sameLevelFrames(before,after)) {
    for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
      if (frame[y]![x+2]===7 && frame[y+2]![x]===7 && frame[y+2]![x+2]===7
        && (stoneAt(frame,x,y)||monsterAt(frame,x,y))) learned.add('place');
    }
    if (supportCount(frame)>supportCount(before.frame)) learned.add('platform');
  }
  const previouslyOpen=openGateCells(before.frame);
  if ([...openGateCells(final)].some(cell=>!previouslyOpen.has(cell))) learned.add('gate');
}
function updateUI(): void {
  select.value = String(observation.level);
  $('level-title').textContent = SS04_LEVELS[observation.level - 1]!.title;
  $('progress').textContent = `${observation.levelsCompleted} / ${SS04_LEVELS.length} terminés`;
  $('moves').textContent = `${moves} actions`;
  const victory = observation.state === 'WIN';
  $('victory').hidden = !victory || busy;
  const gameOver = observation.state === 'GAME_OVER';
  $('defeat').hidden = !gameOver || busy;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.disabled = busy || victory || gameOver;
  $<HTMLButtonElement>('undo').disabled = !observation.canUndo;
  $('tutorial').hidden = observation.level !== 1;
  const info = LEVEL_INFO[observation.level - 1]!;
  $('source-label').textContent = info.label;
  const link = $<HTMLAnchorElement>('source-link');
  link.hidden = !info.url;
  link.href = info.url;
  link.textContent = info.puzzle ? `Voir l’énigme ${info.puzzle} de référence ↗` : 'Voir la source ↗';
  $('piston-help').hidden = !info.piston;
  for (const item of document.querySelectorAll<HTMLElement>('[data-lesson]')) item.classList.toggle('done', learned.has(item.dataset.lesson!));
  const stage = !learned.has('swap') ? 'Une flèche lance ta visée dans cette direction. Si elle rencontre une caisse, vous échangez vos places ; sinon, tu marches d’une case.'
    : !learned.has('platform') ? 'Dépose une caisse sur la presse, puis occupe son bouton. La presse peut l’envoyer dans l’eau : elle devient un appui marron marqué d’un X cyan.'
    : !learned.has('mirror') ? 'Traverse le nouvel appui. Depuis le bouton de sortie, vise vers le haut : le côté blanc du miroir dévie ta visée vers la caisse de l’autre îlot.'
    : !learned.has('place') ? 'Tiens-toi sur un + rose, puis vise une caisse. Après l’échange, elle occupe ta place et maintient le bouton.'
    : 'Garde une caisse sur le bouton de sortie pour laisser le passage ouvert, puis rejoins le contour jaune. Z permet de revoir chaque coup.';
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
  if (busy || observation.state !== 'NOT_FINISHED') return;
  const before = observation, next = session.action(action);
  moves++; observeLesson(before,next);
  const exchange=exchangedFrame(before,next),final=actionFrame(before,next);
  $('feedback').textContent = next.state === 'GAME_OVER' ? 'Le Magicien est en danger. Z annule ; R recommence.'
    : next.levelsCompleted > before.levelsCompleted ? 'Niveau terminé !'
    : exchange ? 'Échange réussi : chaque occupant prend la place de l’autre.'
    : heroCell(before.frame) === heroCell(final) ? 'Aucune cible accessible, et cette case bloque la marche. Essaie un autre axe.' : '';
  void present(next);
}
function reset(kind: 'undo' | 'reset' | 'restart'): void {
  generation++; busy = false;
  if (kind !== 'undo') {moves = 0; learned = new Set();}
  $('feedback').textContent = kind === 'undo' ? 'Dernière action annulée.' : 'Position initiale restaurée.';
  void present(session[kind]());
  canvas.focus({preventScroll:true});
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-action]')) b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for (const id of ['undo','reset','restart'] as const) $(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
$('undo-defeat').addEventListener('click',()=>reset('undo'));
$('reset-defeat').addEventListener('click',()=>reset('reset'));
select.addEventListener('change',()=>{generation++;busy=false;moves=0;learned=new Set();void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});});
canvas.addEventListener('keydown',event=>{
  if (event.altKey || event.metaKey) return;
  const key=event.key.toLowerCase();
  if (key==='z') {event.preventDefault();reset('undo');return;}
  if (event.ctrlKey) return;
  if (key==='r') {event.preventDefault();reset('reset');return;}
  const a: Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4};
  if (a[event.key]) {event.preventDefault();act(a[event.key]!);}
  if (event.key===' ') event.preventDefault();
});
void present(observation);
canvas.focus({preventScroll:true});
