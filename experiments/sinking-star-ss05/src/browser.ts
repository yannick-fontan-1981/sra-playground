import { BardPuzzleSession, PALETTE } from './core.js';
import type { Observation } from './core.js';
import { SS05_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

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

type VisiblePiece = 'stone' | 'monster' | 'support';
type VisibleCell = {x: number; y: number; kind: VisiblePiece};
/** Teaching and feedback use only the public 64×64 image, never hidden game state. */
function heroCell(frame: number[][]): {x: number; y: number} | undefined {
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const px=2+x*3,py=2+y*3;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if (frame[py+1]![px+1]===6 && arms.filter(c=>c===6).length>=3) return {x,y};
  }
  return undefined;
}
function visiblePieces(frame: number[][]): VisibleCell[] {
  const cells: VisibleCell[]=[];
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) {
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(center===5 && arms.every(c=>c===13)) cells.push({x,y,kind:'stone'});
    else if(center===8 && arms.every(c=>c===5)) cells.push({x,y,kind:'monster'});
    else if(center===10 && arms.every(c=>c===13)) cells.push({x,y,kind:'support'});
  }
  return cells;
}
const sameCell=(a:{x:number;y:number}|undefined,b:{x:number;y:number}|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
const hasPiece=(cells:VisibleCell[],p:VisibleCell):boolean=>cells.some(c=>c.kind===p.kind&&sameCell(c,p));
function sameLevelFrames(before: Observation, after: Observation): number[][][] {
  // The last image after a completed room can belong to the next room.
  return after.level !== before.level ? after.frames.slice(0,-1) : after.frames;
}
function actionFrame(before: Observation, after: Observation): number[][] {
  return sameLevelFrames(before,after).at(-1) ?? after.frame;
}
function openGateCells(frame: number[][]): Set<number> {
  const open=new Set<number>();
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) {
    const px=2+x*3,py=2+y*3;
    const corners=[frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]];
    if (corners.every(c=>c===7 || c===11) && frame[py+1]![px+1]===3) open.add(y*20+x);
  }
  return open;
}
function movedWithSong(before: Observation, after: Observation): boolean {
  const final=actionFrame(before,after),a=heroCell(before.frame),b=heroCell(final);
  if(!a||!b||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
  const initial=visiblePieces(before.frame),current=visiblePieces(final),dx=b.x-a.x,dy=b.y-a.y;
  return initial.some(p=>Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y))<=2
    && !hasPiece(current,p) && current.some(q=>q.x===p.x+dx&&q.y===p.y+dy&&(q.kind===p.kind || p.kind==='stone'&&q.kind==='support')));
}
function reflected(before: Observation, after: Observation, action: number): boolean {
  if(action!==5)return false;
  const final=actionFrame(before,after);
  return !sameCell(heroCell(before.frame),heroCell(final))
    || JSON.stringify(visiblePieces(before.frame))!==JSON.stringify(visiblePieces(final));
}
function observeLesson(before: Observation, after: Observation, action: number): void {
  if (before.level!==1) return;
  const final=actionFrame(before,after),a=heroCell(before.frame),b=heroCell(final);
  const initial=visiblePieces(before.frame),current=visiblePieces(final);
  if (a&&b&&!sameCell(a,b)) learned.add('move');
  if (action<=4 && movedWithSong(before,after)) learned.add('song');
  if (action<=4 && a&&b&&!sameCell(a,b) && initial.some(p=>Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y))<=2&&hasPiece(current,p))) learned.add('anchor');
  const previouslyOpen=openGateCells(before.frame);
  for (const frame of sameLevelFrames(before,after)) {
    const pieces=visiblePieces(frame);
    if (pieces.some(p=>p.kind==='support'&&!hasPiece(initial,p))) learned.add('platform');
    if ([...openGateCells(frame)].some(cell=>!previouslyOpen.has(cell))) learned.add('gate');
  }
  if (reflected(before,after,action)) learned.add('mirror');
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
  for(const item of document.querySelectorAll<HTMLElement>('[data-lesson]')) item.classList.toggle('done',learned.has(item.dataset.lesson!));
  $('lesson-next').textContent = !learned.has('song')
    ? 'Avance avec une flèche : les caisses et monstres situés à deux cases de toi au maximum tentent de faire le même pas. Les diagonales sont comprises.'
    : !learned.has('anchor')
      ? 'Un objet bloqué reste sur place pendant que tu avances. Utilise un bord ou un mur pour modifier son écart avec toi ; le chant traverse les murs.'
      : !learned.has('platform')
        ? 'Amène une caisse dans l’eau : elle devient un appui marron marqué d’un X cyan. Ton chant peut ensuite déplacer cet appui vers une autre case d’eau.'
        : !learned.has('mirror')
          ? 'Espace active les miroirs. Le + gris clair indique l’arrivée du Barde ; le carré gris clair celle d’une caisse. X fonctionne aussi.'
          : !learned.has('gate')
            ? 'Place un poids sur un + rose. Observe les portes de même repère : certaines s’ouvrent, d’autres poussent quand elles se ferment.'
            : 'Combine le chant, les appuis et les reflets pour rejoindre le contour jaune. Un objet peut quitter son bouton si tu passes trop près : Z annule le dernier coup.';
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
  moves++;observeLesson(before,next,action);
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
  if(kind!=='undo'){moves=0;learned=new Set();}
  $('feedback').textContent=kind==='undo'?'Dernière action annulée.':'Position initiale restaurée.';
  void present(session[kind]());canvas.focus({preventScroll:true});
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-action]'))b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for(const id of ['undo','reset','restart'] as const)$(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
$('undo-defeat').addEventListener('click',()=>reset('undo'));
$('reset-defeat').addEventListener('click',()=>reset('reset'));
select.addEventListener('change',()=>{generation++;busy=false;moves=0;learned=new Set();void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});});
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
