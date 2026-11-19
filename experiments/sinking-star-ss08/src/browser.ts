import { DuoPuzzleSession, PALETTE } from './core.js';
import type { Observation, Point } from './core.js';
import { SS08_LEVELS } from './levels.js';
import { LEVEL_INFO } from './level-info.js';

const session = new DuoPuzzleSession(SS08_LEVELS);
const TUTORIAL_LEVEL=4;
const levelInfo:readonly {label:string;url:string;puzzle?:string|number;piston:boolean;objective?:string}[]=LEVEL_INFO;
const $ = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
};
const canvas = $<HTMLCanvasElement>('board');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is unavailable.');
const select = $<HTMLSelectElement>('level');
SS08_LEVELS.forEach((level, i) => select.add(new Option(`${i + 1}. ${level.title}`, String(i + 1))));
$('tutorial-title').textContent = 'Niveau '+TUTORIAL_LEVEL+' · '+SS08_LEVELS[TUTORIAL_LEVEL-1]!.title;
let observation: Observation = session.observe();
let generation = 0;
let busy = false;
let moves = 0;
let learned = new Set<string>();
const lessonIds = ['select','wizard-swap','move','merchant-push','platform','gate','mirror-motion','wizard-bend','mirror','goals'] as const;

function paint(frame: number[][]): void {
  const image = ctx!.createImageData(64,64);
  for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
    const rgb=parseInt(PALETTE[frame[y]![x]!]!.slice(1),16),at=(y*64+x)*4;
    image.data[at]=rgb>>>16;image.data[at+1]=(rgb>>>8)&255;image.data[at+2]=rgb&255;image.data[at+3]=255;
  }
  ctx!.putImageData(image,0,0);
}

type HeroKind='merchant'|'wizard';
type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==15)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':'wizard',selected:arms.includes(0)});
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
    else if(center===10&&corners.every(c=>c===10)&&arms.every(c=>c===13))pieces.push({x,y,kind:'support'});
    else if(center===8&&arms.every(c=>c===5))pieces.push({x,y,kind:'monster'});
    // Button corners may cover the diagonal ends; its white center and black back remain visible.
    else if(center===0&&arms.filter(c=>c===5).length>=2)pieces.push({x,y,kind:'mirror'});
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
/** A reciprocal exchange is recognized from public sprites, including adjacent swaps. */
function wizardSwap(before:Observation,after:Observation,action:number):{bent:boolean}|null {
  if(action<1||action>4||after.frames.length<3)return null;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  if(hero?.kind!=='wizard')return null;
  const frame=sameLevelFrames(before,after)[2]??actionFrame(before,after);
  const later=visibleHeroes(frame).find(h=>h.kind==='wizard');
  if(!later||sameCell(hero,later))return null;
  const piece=visiblePieces(before.frame).find(p=>(p.kind==='stone'||p.kind==='monster')&&sameCell(p,later));
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='merchant'&&sameCell(h,later));
  const exchanged=piece?visiblePieces(frame).some(p=>p.kind===piece.kind&&sameCell(p,hero))
    :!!companion&&visibleHeroes(frame).some(h=>h.kind==='merchant'&&sameCell(h,hero));
  return exchanged?{bent:hero.x!==later.x&&hero.y!==later.y}:null;
}
/** The warning is recognized from its public cyan/red water marks only. */
function waterRefused(before:Observation,after:Observation,action:number):boolean {
  if(action<1||action>4||after.frames.length!==6)return false;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  if(hero?.kind!=='wizard')return false;
  const [dx,dy]=({1:[0,-1],2:[0,1],3:[-1,0],4:[1,0]} as Record<number,[number,number]>)[action]!;
  const x=hero.x+dx,y=hero.y+dy;
  if(x<0||x>=20||y<0||y>=20)return false;
  const px=2+x*3,py=2+y*3;
  const crossAt=(frame:number[][],color:number):boolean=>[[0,0],[2,0],[1,1],[0,2],[2,2]].every(([a,b])=>frame[py+b!]![px+a!]===color);
  const current=visibleHeroes(after.frame).find(h=>h.kind==='wizard');
  return sameCell(hero,current)&&crossAt(after.frames[0]!,10)&&crossAt(after.frames[2]!,8)&&crossAt(after.frames[4]!,8);
}
function observeLesson(before:Observation,after:Observation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL||waterRefused(before,after,action))return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const pushed=pushLength(before,after,action);
  if(selected?.kind==='merchant'&&pushed>=1)learned.add('merchant-push');
  const swapped=wizardSwap(before,after,action);
  if(swapped)learned.add('wizard-swap');
  if(swapped?.bent)learned.add('wizard-bend');
  const moveView=movementView(before,after,action);
  if(moveView&&!swapped)learned.add('move');
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
  select:'Commence par le Magicien violet : clique sur lui, appuie sur Tab ou sur 2. Changer de personnage ne fait avancer ni les portes ni les monstres.',
  'merchant-push':'Le Marchand orange pousse une seule pièce devant lui. Cherche le côté d’où pousser une caisse ou un miroir ; une deuxième pièce en file bloque sa poussée.',
  'wizard-swap':'Vise la caisse dans l’alcôve avec une flèche. Le Magicien échange sa place avec la première cible dans cette direction : la caisse arrive là où il était. Sans cible, il marche.',
  'wizard-bend':'Vise la face blanche d’un miroir avec le Magicien : son rayon tourne à angle droit et cherche une cible sur le nouvel axe. Le dos noir bloque. Une flèche déclenche l’échange ; Espace déclenche les reflets.',
  'mirror-motion':'Pousse un miroir avec le Marchand. Son orientation reste fixe, mais son nouvel emplacement change la visée du Magicien et les arrivées des reflets.',
  platform:'Une caisse envoyée dans l’eau devient un appui marron avec X cyan. Tu peux marcher dessus, mais il ne peut plus servir de cible au Magicien.',
  mirror:'Le Magicien maintient le bouton vert pour déployer la passerelle. Espace envoie d’abord la caisse proche dans l’eau et crée le troisième appui. Prépare ensuite le reflet du Marchand : le + gris clair indique son arrivée.',
  gate:'Le bouton rose commande la presse sous la caisse isolée. Appuie dessus pour envoyer cette caisse dans l’eau et ouvrir le second passage. Le repère d’une presse indique le sens de sa poussée.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Le premier arrivé reste sélectionnable et peut encore aider son partenaire.',
};
function updateUI():void {
  select.value=String(observation.level);
  $('level-title').textContent=SS08_LEVELS[observation.level-1]!.title;
  $('progress').textContent=`${observation.levelsCompleted} / ${SS08_LEVELS.length} terminés`;
  $('moves').textContent=`${moves} actions`;
  const terminal=observation.state!=='NOT_FINISHED';
  $('victory').hidden=observation.state!=='WIN'||busy;
  $('defeat').hidden=observation.state!=='GAME_OVER'||busy;
  const heroes=visibleHeroes(observation.frame),selected=heroes.find(h=>h.selected)?.kind;
  for(const b of document.querySelectorAll<HTMLButtonElement>('[data-action],[data-hero]')){
    b.disabled=busy||terminal;
    if(b.dataset.hero)b.setAttribute('aria-pressed',String(b.dataset.hero===selected));
  }
  $('selected-role').textContent=selected==='wizard'?'Magicien sélectionné · vise et échange avec une flèche':selected==='merchant'?'Marchand sélectionné · pousse une pièce':'Les deux personnages coopèrent';
  $<HTMLButtonElement>('undo').disabled=!observation.canUndo;
  $('tutorial').hidden=observation.level!==TUTORIAL_LEVEL;
  const info=levelInfo[observation.level-1]!;
  $('level-objective').textContent=info.objective??'Fais arriver le Marchand et le Magicien sur les deux contours jaunes.';
  $('source-label').textContent=info.label;
  const link=$<HTMLAnchorElement>('source-link');link.hidden=!info.url;link.href=info.url;
  link.textContent=info.puzzle?`Énigme ${info.puzzle} de référence ↗`:'Voir la source ↗';
  $('piston-help').hidden=!info.piston;
  const hasPlatforms=!!SS08_LEVELS[observation.level-1]!.platforms?.length;
  for(const id of ['platform-help','platform-legend-active','platform-legend-inactive'])$(id).hidden=!hasPlatforms;
  for(const item of document.querySelectorAll<HTMLElement>('[data-lesson]'))item.classList.toggle('done',learned.has(item.dataset.lesson!));
  $('lesson-progress').textContent=`${lessonIds.filter(id=>learned.has(id)).length} / ${lessonIds.length} découvertes`;
  const next=lessonIds.find(id=>!learned.has(id));
  $('lesson-next').textContent=next?hints[next]!:'Les dix découvertes sont acquises. Combine la poussée, la visée du Magicien et les reflets pour préparer l’arrivée des deux héros.';
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
    :waterRefused(before,next,action)?'Eau sans appui : le Magicien reste sur place. Crée un appui ou vise une cible pour échanger.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Les deux héros peuvent le déclencher.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :wizardSwap(before,next,action)?.bent?'Échange par un rayon dévié : le Magicien et sa cible ont changé de place.'
    :wizardSwap(before,next,action)?'Transposition : le Magicien et la première cible ont échangé leurs places.'
    :pushLength(before,next,action)===1?'Une pièce poussée d’une case par le Marchand.'
    :!changed?selected?.kind==='wizard'?'Aucun échange possible dans cet axe. Vérifie la première cible, les faces des miroirs et la case d’arrivée.':'Ce déplacement est bloqué. Change de côté ou de personnage.':'';
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
  if(key==='1'||key==='2'){event.preventDefault();selectHero(key==='1'?'merchant':'wizard');return;}
  const actions:Record<string,number>={ArrowUp:1,ArrowDown:2,ArrowLeft:3,ArrowRight:4,' ':5,x:5,X:5};
  if(actions[event.key]){event.preventDefault();act(actions[event.key]!);}
});
void present(observation);canvas.focus({preventScroll:true});
