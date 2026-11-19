import { DuoPuzzleSession, PALETTE } from './core.js';
import type { HeroKind, Observation, Point } from './core.js';
import { SS07_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';
import { actionFeedback, heroSelection, lessonIds, lessonPrompt, observeLesson, sameCell, visibleHeroes, type ThiefLesson } from './tutorial.js';

const session = new DuoPuzzleSession(SS07_LEVELS);
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS07_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
$('tutorial-title').textContent = `Niveau 1 · ${SS07_LEVELS[0]!.title}`;
let observation: Observation = session.observe();
let generation = 0;
let busy = false;
let moves = 0;
let learned = new Set<ThiefLesson>();

function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64,64);
  for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
    const rgb=parseInt(PALETTE[frame[y]![x]!]!.slice(1),16),at=(y*64+x)*4;
    image.data[at]=rgb>>>16;image.data[at+1]=(rgb>>>8)&255;image.data[at+2]=rgb&255;image.data[at+3]=255;
  }
  ctx!.putImageData(image,0,0);
}

function updateUI():void {
  select.value=String(observation.level);
  $('level-title').textContent=SS07_LEVELS[observation.level-1]!.title;
  $('progress').textContent=`${observation.levelsCompleted} / ${SS07_LEVELS.length} terminés`;
  $('moves').textContent=`${moves} actions`;
  const terminal=observation.state!=='NOT_FINISHED';
  $('victory').hidden=observation.state!=='WIN'||busy;
  $('defeat').hidden=observation.state!=='GAME_OVER'||busy;
  const heroes=visibleHeroes(observation.frame),selected=heroes.find(h=>h.selected)?.kind;
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-action],[data-hero]')){
    b.disabled=busy||terminal;
    if(b.dataset.hero)b.setAttribute('aria-pressed',String(b.dataset.hero===selected));
  }
  $('selected-role').textContent=selected==='thief'?'Voleur sélectionné · tire la pièce derrière lui':selected==='merchant'?'Marchand sélectionné · pousse une pièce':'Les deux personnages coopèrent';
  $<HTMLButtonElement>('undo').disabled=!observation.canUndo;
  $('tutorial').hidden=observation.level!==1;
  const info=LEVEL_INFO[observation.level-1]!;
  $('source-label').textContent=info.label;
  const link=$<HTMLAnchorElement>('source-link');link.hidden=!info.url;link.href=info.url;
  link.textContent=info.puzzle?`Énigme ${info.puzzle} de référence ↗`:'Voir la source ↗';
  $('piston-help').hidden=!info.piston;
  const hasPlatforms=!!SS07_LEVELS[observation.level-1]!.platforms?.length;
  for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])$(id).hidden=!hasPlatforms;
  for(const item of document.querySelectorAll<HTMLElement>('[data-lesson]'))item.classList.toggle('done',learned.has(item.dataset.lesson as ThiefLesson));
  $('lesson-progress').textContent=`${lessonIds.filter(id=>learned.has(id)).length} / ${lessonIds.length} découvertes`;
  $('lesson-next').textContent=lessonPrompt(learned);
  canvas.dataset.level=String(observation.level);canvas.dataset.completed=String(observation.levelsCompleted);
  canvas.dataset.state=observation.state;canvas.dataset.busy=String(busy);
  canvas.dataset.selected=selected??'';
}
async function present(next:Observation):Promise<void> {
  const token=++generation;observation=next;busy=next.frames.length>1;updateUI();
  for(let i=0;i<next.frames.length;i++){
    if(token!==generation)return;
    paint(next.frames[i]!);
    if(i<next.frames.length-1)await new Promise<void>(resolve=>setTimeout(resolve,next.frameDurationsMs?.[i]??70));
  }
  if(token!==generation)return;
  busy=false;paint(next.frame);updateUI();
}
function act(action:number,data?:Point):void {
  if(busy||observation.state!=='NOT_FINISHED')return;
  const before=observation,next=session.action(action,data);
  if(action!==6)moves++;
  observeLesson(learned,before,next,action);
  $('feedback').textContent=actionFeedback(before,next,action);
  void present(next);
}
function selectHero(kind?:HeroKind):void {
  const target=heroSelection(observation.frame,kind);
  if(target)act(6,target);
}
function reset(kind:'undo'|'reset'|'restart'):void {
  generation++;busy=false;
  if(kind!=='undo'){moves=0;learned=new Set();}
  $('feedback').textContent=kind==='undo'?'Dernière action annulée, y compris tous ses effets en cascade.':'Position initiale restaurée.';
  void present(session[kind]());canvas.focus({preventScroll:true});
}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-action]'))b.addEventListener('click',()=>{act(Number(b.dataset.action));canvas.focus({preventScroll:true});});
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-hero]'))b.addEventListener('click',()=>{selectHero(b.dataset.hero as HeroKind);canvas.focus({preventScroll:true});});
for(const id of ['undo','reset','restart'] as const)$(id).addEventListener('click',()=>reset(id));
$('play-again').addEventListener('click',()=>reset('restart'));
$('undo-defeat').addEventListener('click',()=>reset('undo'));
$('reset-defeat').addEventListener('click',()=>reset('reset'));
select.addEventListener('change',()=>{
  generation++;busy=false;moves=0;learned=new Set();void present(session.selectLevel(Number(select.value)));canvas.focus({preventScroll:true});
});
canvas.addEventListener('click',event=>{
  const rect=canvas.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return;
  const x=Math.floor((event.clientX-rect.left)*64/rect.width),y=Math.floor((event.clientY-rect.top)*64/rect.height);
  if(x<0||x>=64||y<0||y>=64)return;
  const cell={x:Math.floor((x-2)/3),y:Math.floor((y-2)/3)};
  if(visibleHeroes(observation.frame).some(h=>sameCell(h,cell)&&!h.selected))act(6,{x,y});
  canvas.focus({preventScroll:true});
});
canvas.addEventListener('keydown',event=>{
  if(event.altKey||event.metaKey)return;
  const key=event.key.toLowerCase();
  if(key==='z'){event.preventDefault();reset('undo');return;}
  if(event.ctrlKey)return;
  if(key==='r'){event.preventDefault();reset('reset');return;}
  if(event.key==='Tab'&&!event.shiftKey){event.preventDefault();selectHero();return;}
  if(key==='1'||key==='2'){event.preventDefault();selectHero(key==='1'?'merchant':'thief');return;}
  const actions:Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4,' ':5,x:5,X:5};
  if(actions[event.key]){event.preventDefault();act(actions[event.key]!);}
});
void present(observation);canvas.focus({preventScroll:true});
