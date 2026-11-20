import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['move','select','warrior-push','chain','wizard-swap','wizard-partner','wizard-bend','mirror-motion','platform','mirror','gate','goals'] as const;
export type TranspositionLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==8&&center!==15)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===8?'warrior':'wizard',selected:arms.includes(0)});
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
    // Button corners may cover the diagonal ends; its white center and black back remain visible.
    else if(center===0&&arms.filter(c=>c===5).length>=2)pieces.push({x,y,kind:'mirror'});
  }
  return pieces;
}
const samePiece=(a:VisiblePiece,b:VisiblePiece):boolean=>a.kind===b.kind&&sameCell(a,b);
function sameLevelFrames(before:LessonObservation,after:LessonObservation):number[][][] {
  return after.level!==before.level?after.frames.slice(0,-1):after.frames;
}
function actionFrame(before:LessonObservation,after:LessonObservation):number[][] {
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
function reflected(before:LessonObservation,after:LessonObservation,action:number):boolean {
  if(action!==5||after.frames.length<3)return false;
  const final=actionFrame(before,after);
  return JSON.stringify(visibleHeroes(before.frame).map(h=>[h.kind,h.x,h.y]))!==JSON.stringify(visibleHeroes(final).map(h=>[h.kind,h.x,h.y]))
    || JSON.stringify(visiblePieces(before.frame))!==JSON.stringify(visiblePieces(final));
}
/** The third public frame ends the voluntary movement, before any forced cascade. */
function movementView(before:LessonObservation,after:LessonObservation,action:number):{hero:VisibleHero;later:VisibleHero;dx:number;dy:number;frame:number[][]}|null {
  if(action<1||action>4)return null;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  const frame=sameLevelFrames(before,after)[2]??actionFrame(before,after);
  const later=visibleHeroes(frame).find(h=>h.kind===hero?.kind);
  const [dx,dy]=({1:[0,-1],2:[0,1],3:[-1,0],4:[1,0]} as Record<number,[number,number]>)[action]!;
  return hero&&later&&later.x===hero.x+dx&&later.y===hero.y+dy?{hero,later,dx,dy,frame}:null;
}
function pushLength(before:LessonObservation,after:LessonObservation,action:number):number {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='warrior')return 0;
  const actors:Point[]=[...visiblePieces(before.frame).filter(p=>p.kind!=='support'),...visibleHeroes(before.frame).filter(h=>h.kind!==view.hero.kind)];
  let count=0;
  while(actors.some(p=>p.x===view.hero.x+(count+1)*view.dx&&p.y===view.hero.y+(count+1)*view.dy))count++;
  return count;
}
/** A reciprocal exchange is recognized from public sprites, including adjacent swaps. */
function wizardSwap(before:LessonObservation,after:LessonObservation,action:number):{bent:boolean;partner:boolean}|null {
  if(action<1||action>4||after.frames.length<3)return null;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  if(hero?.kind!=='wizard')return null;
  const frame=sameLevelFrames(before,after)[2]??actionFrame(before,after);
  const later=visibleHeroes(frame).find(h=>h.kind==='wizard');
  if(!later||sameCell(hero,later))return null;
  const piece=visiblePieces(before.frame).find(p=>(p.kind==='stone'||p.kind==='monster')&&sameCell(p,later));
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='warrior'&&sameCell(h,later));
  const exchanged=piece?visiblePieces(frame).some(p=>p.kind===piece.kind&&sameCell(p,hero))
    :!!companion&&visibleHeroes(frame).some(h=>h.kind==='warrior'&&sameCell(h,hero));
  const ray=sameLevelFrames(before,after)[0];
  const illuminatedMirror=visiblePieces(before.frame).some(p=>p.kind==='mirror'&&ray?.[3+p.y*3]?.[3+p.x*3]===15);
  return exchanged?{bent:illuminatedMirror||(hero.x!==later.x&&hero.y!==later.y),partner:!!companion}:null;
}
/** A returning ray is recognized only from the displayed path and same-cell blink. */
function returnedRay(before:LessonObservation,after:LessonObservation,action:number):boolean {
  const count=after.frames.length;
  if(action<1||action>4||count<5)return false;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  if(hero?.kind!=='wizard'||!sameCell(hero,visibleHeroes(after.frame).find(h=>h.kind==='wizard')))return false;
  const px=2+hero.x*3,py=2+hero.y*3;
  const whitePlus=(frame:number[][]):boolean=>[[1,0],[0,1],[1,1],[2,1],[1,2]].every(([x,y])=>frame[py+y!]![px+x!]===0);
  if(!whitePlus(after.frames[count-4]!)||!whitePlus(after.frames[count-2]!)||after.frames[count-3]![py+1]![px+1]!==15)return false;
  let visiblePath=false;
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    if(x>=px&&x<px+3&&y>=py&&y<py+3)continue;
    if(before.frame[y]![x]!==after.frame[y]![x])return false;
    if(after.frames[count-5]![y]![x]===15&&before.frame[y]![x]!==15)visiblePath=true;
  }
  return visiblePath;
}
export function observeLesson(learned:Set<TranspositionLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL||returnedRay(before,after,action))return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const pushed=pushLength(before,after,action);
  if(selected?.kind==='warrior'&&pushed>=1)learned.add('warrior-push');
  if(pushed>=2)learned.add('chain');
  const swapped=wizardSwap(before,after,action);
  if(swapped)learned.add('wizard-swap');
  if(swapped?.partner)learned.add('wizard-partner');
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

const hints:Record<TranspositionLesson,string>={
  move:'Déplace le personnage portant le point blanc avec les flèches. Les autres restent en place : observe aussi leurs appuis et les monstres voisins.',
  select:'Clique sur le Magicien violet, appuie sur Tab ou sur 2. Reviens au Guerrier rouge avec 1. Changer de personnage ne fait avancer ni les portes ni les monstres.',
  'warrior-push':'Place le Guerrier derrière une caisse ou un miroir, puis appuie sur la flèche dans le sens de la poussée. La pièce avance et le Guerrier prend sa place.',
  chain:'Le Guerrier peut pousser plusieurs occupants alignés d’un seul pas. Vérifie l’extrémité de la file : elle doit pouvoir avancer. Le Magicien poussé par son partenaire ne lance aucun échange.',
  'wizard-swap':'Avec le Magicien, vise une caisse avec une flèche : il échange sa place avec la première cible rencontrée. La caisse vient occuper son ancienne case. Sans cible, il marche.',
  'wizard-partner':'Le Guerrier est aussi une cible. Place les héros dans le même axe et vise le rouge avec le Magicien pour échanger leurs positions. C’est un moyen de placer le Guerrier derrière une caisse.',
  'wizard-bend':'Vise la face blanche d’un miroir avec le Magicien : son rayon tourne à angle droit et cherche une cible sur le nouvel axe. Le dos noir bloque. Une flèche déclenche l’échange ; Espace déclenche les reflets.',
  'mirror-motion':'Pousse un miroir avec le Guerrier. Son orientation reste fixe, mais son nouvel emplacement change la visée du Magicien et les arrivées des reflets.',
  platform:'Une caisse envoyée dans l’eau devient un appui marron avec X cyan. Tu peux marcher dessus, mais il ne peut plus servir de cible au Magicien.',
  mirror:'Espace ou X active tous les miroirs. Le plus proche traverse ; à distance égale, les deux occupants échangent leurs places. Le + gris clair annonce un héros et le contour carré gris clair une caisse.',
  gate:'Un + rose réagit au poids d’un héros ou d’un objet. Une porte qui se ferme pousse dans le sens de son repère. Un échange peut remplacer le poids sur un bouton ; quitter ce bouton peut relancer la presse.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Le premier arrivé reste sélectionnable et peut encore aider son partenaire.',
};
export function lessonPrompt(learned: ReadonlySet<TranspositionLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les douze découvertes sont acquises. Combine la poussée en chaîne, les échanges de places et les reflets pour guider les deux héros.';
}

export function heroSelection(frame: number[][], kind?: HeroKind): Point | undefined {
  const hero = visibleHeroes(frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  return hero && !hero.selected ? { x: 3 + hero.x * 3, y: 3 + hero.y * 3 } : undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final);
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les deux destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Les deux héros peuvent le déclencher.'
    :action===5?'Reflet bloqué ou aucune cible. Le dos d’un miroir responsable du blocage clignote en rouge ; sa diagonale reste blanche.'
    :returnedRay(before,next,action)?'Le rayon revient sur le Magicien : la téléportation le laisse sur place.'
    :wizardSwap(before,next,action)?.bent?'Échange par un rayon dévié : le Magicien et sa cible ont changé de place.'
    :wizardSwap(before,next,action)?.partner?'Le Magicien et le Guerrier ont échangé leurs places.'
    :wizardSwap(before,next,action)?'Transposition : le Magicien et la première cible ont échangé leurs places.'
    :pushLength(before,next,action)>1?'Toute la file avance d’une case sous la poussée du Guerrier.'
    :pushLength(before,next,action)===1?'Une pièce poussée d’une case par le Guerrier.'
    :!changed?selected?.kind==='wizard'?'Aucun échange possible dans cet axe. Vérifie la première cible, les faces des miroirs et la case d’arrivée.':'Ce déplacement est bloqué. Change de côté ou de personnage.':'';
}
