import { DuoPuzzleSession, PALETTE } from './core.js';
import type { Observation, Point } from './core.js';
import { SS07_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

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
let learned = new Set<string>();
const lessonIds = ['move','select','merchant-push','thief-pull','mirror-motion','platform','mirror','gate','goals'] as const;

function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64,64);
  for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
    const rgb=parseInt(PALETTE[frame[y]![x]!]!.slice(1),16),at=(y*64+x)*4;
    image.data[at]=rgb>>>16;image.data[at+1]=(rgb>>>8)&255;image.data[at+2]=rgb&255;image.data[at+3]=255;
  }
  ctx!.putImageData(image,0,0);
}

type HeroKind='merchant'|'thief';
type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==14)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':'thief',selected:arms.includes(0)});
  }
  return heroes;
}
function visiblePieces(frame:number[][]):VisiblePiece[] {
  const pieces:VisiblePiece[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    const corners=[frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]];
    if(center===5&&arms.every(c=>c===13))pieces.push({x,y,kind:'stone'});
    else if(corners.every(c=>c===10))pieces.push({x,y,kind:'support'});
    else if(center===8&&arms.every(c=>c===5))pieces.push({x,y,kind:'monster'});
    else if(center===0){
      const diagonal=(frame[py]![px]===0&&frame[py+2]![px+2]===0)||(frame[py]![px+2]===0&&frame[py+2]![px]===0);
      if(diagonal&&arms.filter(c=>c===5).length>=2)pieces.push({x,y,kind:'mirror'});
    }
  }
  return pieces;
}
const samePiece=(a:VisiblePiece,b:VisiblePiece):boolean=>a.kind===b.kind&&sameCell(a,b);
function sameLevelFrames(before:Observation,after:Observation):number[][][] {
  return after.level!==before.level?after.frames.slice(0,-1):after.frames;
}
function actionFrame(before:Observation,after:Observation):number[][] {
  return sameLevelFrames(before,after).at(-1)??after.frame;
}
function gateCells(frame:number[][]):Map<number,number> {
  const cells=new Map<number,number>();
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3;
    const corners=[frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]];
    const center=frame[py+1]![px+1],arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(corners.every(c=>c===7)&&(center===3||center===5)&&!arms.includes(13))cells.set(y*20+x,center);
  }
  return cells;
}
function reflected(before:Observation,after:Observation,action:number):boolean {
  if(action!==5||after.frames.length<3)return false;
  const final=actionFrame(before,after);
  return JSON.stringify(visibleHeroes(before.frame).map(h=>[h.kind,h.x,h.y]))!==JSON.stringify(visibleHeroes(final).map(h=>[h.kind,h.x,h.y]))
    || JSON.stringify(visiblePieces(before.frame))!==JSON.stringify(visiblePieces(final));
}
/** The third public frame ends the voluntary movement, before any forced cascade. */
function movementView(before:Observation,after:Observation,action:number):{hero:VisibleHero;later:VisibleHero;dx:number;dy:number;frame:number[][]}|null {
  if(action<1||action>4)return null;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  const frame=sameLevelFrames(before,after)[2]??actionFrame(before,after);
  const later=visibleHeroes(frame).find(h=>h.kind===hero?.kind);
  const [dx,dy]=({1:[0,-1],2:[0,1],3:[-1,0],4:[1,0]} as Record<number,[number,number]>)[action]!;
  return hero&&later&&later.x===hero.x+dx&&later.y===hero.y+dy?{hero,later,dx,dy,frame}:null;
}
function pushLength(before:Observation,after:Observation,action:number):number {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='merchant')return 0;
  const actors:Point[]=[...visiblePieces(before.frame).filter(p=>p.kind!=='support'),...visibleHeroes(before.frame).filter(h=>h.kind!==view.hero.kind)];
  return +actors.some(p=>p.x===view.hero.x+view.dx&&p.y===view.hero.y+view.dy);
}
function pulled(before:Observation,after:Observation,action:number):boolean {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='thief')return false;
  const from={x:view.hero.x-view.dx,y:view.hero.y-view.dy};
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,from));
  if(piece)return visiblePieces(view.frame).some(p=>p.kind===piece.kind&&sameCell(p,view.hero));
  const companion=visibleHeroes(before.frame).find(h=>h.kind!==view.hero.kind&&sameCell(h,from));
  return !!companion&&visibleHeroes(view.frame).some(h=>h.kind===companion.kind&&sameCell(h,view.hero));
}
function observeLesson(before:Observation,after:Observation,action:number):void {
  if(before.level!==1)return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action>=1&&action<=4&&initialHeroes.some(h=>!sameCell(h,currentHeroes.find(q=>q.kind===h.kind))))learned.add('move');
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const pushed=pushLength(before,after,action);
  if(selected?.kind==='merchant'&&pushed>=1)learned.add('merchant-push');
  if(pulled(before,after,action))learned.add('thief-pull');
  const moveView=movementView(before,after,action);
  if(moveView){const a=visiblePieces(before.frame).filter(p=>p.kind==='mirror'),b=visiblePieces(moveView.frame).filter(p=>p.kind==='mirror');if(a.length===b.length&&a.some(p=>!b.some(q=>sameCell(p,q))))learned.add('mirror-motion');}
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame);
  for(const frame of sameLevelFrames(before,after)){
    if(visiblePieces(frame).some(p=>p.kind==='support'&&!initial.some(q=>samePiece(p,q))
      &&[0,1,2].some(dy=>[0,1,2].some(dx=>before.frame[2+p.y*3+dy]![2+p.x*3+dx]===9))))learned.add('platform');
    for(const [cell,value] of gateCells(frame))if(gates.has(cell)&&gates.get(cell)!==value)learned.add('gate');
  }
  if(reflected(before,after,action))learned.add('mirror');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<string,string>={
  move:'Déplace le personnage portant le point blanc avec les flèches. Les autres restent en place : observe aussi leurs appuis et les monstres voisins.',
  select:'Clique sur l’autre personnage, utilise Tab dans la grille ou les boutons Marchand et Voleur. La sélection ne fait avancer ni les portes ni les monstres.',
  'merchant-push':'Le Marchand orange pousse une seule pièce devant lui. Cherche le côté d’où pousser une caisse ou un miroir ; une deuxième pièce en file bloque sa poussée.',
  'thief-pull':'Le Voleur vert tire la pièce juste derrière lui quand il avance vers une case libre. Il ne pousse jamais. Place-toi devant la caisse puis éloigne-toi ; un pas de côté permet de la lâcher.',
  'mirror-motion':'Pousse un miroir avec le Marchand ou tire-le avec le Voleur. Son orientation ne change pas, mais ses arrivées changent : observe les marques gris clair.',
  platform:'Une caisse envoyée dans l’eau devient un appui marron avec X cyan. Ce détour peut donner accès au côté nécessaire pour tirer ou pousser une autre pièce.',
  mirror:'Place les occupants devant la face blanche d’un miroir. Le + gris clair montre l’arrivée d’un héros, le contour carré celle d’une caisse. Espace active tous les miroirs ; ce départ ne tire pas la pièce derrière le Voleur.',
  gate:'Un + rose réagit au poids d’un héros ou d’un objet. Observe la porte liée : elle peut libérer le passage ou pousser en se fermant. Attention : tirer un objet hors du bouton peut relancer la presse.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Le premier arrivé reste sélectionnable et peut encore aider son partenaire.',
};
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
  for(const item of document.querySelectorAll<HTMLElement>('[data-lesson]'))item.classList.toggle('done',learned.has(item.dataset.lesson!));
  $('lesson-progress').textContent=`${lessonIds.filter(id=>learned.has(id)).length} / ${lessonIds.length} découvertes`;
  const next=lessonIds.find(id=>!learned.has(id));
  $('lesson-next').textContent=next?hints[next]!:'Les neuf découvertes sont acquises. Prépare les positions des deux héros et choisis entre marcher, tirer et partir par reflet.';
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
  observeLesson(before,next,action);
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final);
  $('feedback').textContent=next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les deux destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet simultané : le Voleur quitte sa case sans tirer ce qui était derrière lui.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :pulled(before,next,action)?'Une pièce tirée dans la case quittée par le Voleur. Un pas de côté permet de la lâcher.'
    :pushLength(before,next,action)===1?'Une pièce poussée d’une case par le Marchand.'
    :!changed?selected?.kind==='thief'?'Le Voleur ne pousse pas. Libère sa case d’arrivée ou approche la pièce par l’autre côté.':'Ce déplacement est bloqué. Change de côté ou de personnage.':'';
  void present(next);
}
function selectHero(kind?:HeroKind):void {
  const heroes=visibleHeroes(observation.frame);
  const hero=kind?heroes.find(h=>h.kind===kind):heroes.find(h=>!h.selected);
  if(hero&&!hero.selected)act(6,{x:3+hero.x*3,y:3+hero.y*3});
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
