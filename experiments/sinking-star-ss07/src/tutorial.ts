import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const lessonIds = ['move','select','merchant-push','thief-pull','mirror-motion','platform','mirror','gate','goals'] as const;
export type ThiefLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
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
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='merchant')return 0;
  const actors:Point[]=[...visiblePieces(before.frame).filter(p=>p.kind!=='support'),...visibleHeroes(before.frame).filter(h=>h.kind!==view.hero.kind)];
  return +actors.some(p=>p.x===view.hero.x+view.dx&&p.y===view.hero.y+view.dy);
}
function pulled(before:LessonObservation,after:LessonObservation,action:number):boolean {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='thief')return false;
  const from={x:view.hero.x-view.dx,y:view.hero.y-view.dy};
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,from));
  if(piece)return visiblePieces(view.frame).some(p=>p.kind===piece.kind&&sameCell(p,view.hero));
  const companion=visibleHeroes(before.frame).find(h=>h.kind!==view.hero.kind&&sameCell(h,from));
  return !!companion&&visibleHeroes(view.frame).some(h=>h.kind===companion.kind&&sameCell(h,view.hero));
}
export function observeLesson(learned:Set<ThiefLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
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

const hints:Record<ThiefLesson,string>={
  move:'Déplace le personnage portant le point blanc avec les flèches. Les autres restent en place : observe aussi leurs appuis et les monstres voisins.',
  select:'Clique sur l’autre personnage, utilise Tab dans la grille ou les boutons Marchand et Voleur. La sélection ne fait avancer ni les portes ni les monstres.',
  'merchant-push':'Le Marchand orange pousse une seule pièce devant lui. Cherche le côté d’où pousser une caisse ou un miroir ; une deuxième pièce en file bloque sa poussée.',
  'thief-pull':'Le Voleur vert tire la pièce juste derrière lui quand il avance vers une case libre. Il ne pousse jamais. Place-toi devant la caisse puis éloigne-toi ; un pas de côté permet de la lâcher.',
  'mirror-motion':'Pousse un miroir avec le Marchand ou tire-le avec le Voleur. Son orientation ne change pas, mais ses arrivées changent : observe les marques gris clair.',
  platform:'Une caisse envoyée dans l’eau devient un appui marron avec X cyan. Ce détour peut donner accès au côté nécessaire pour tirer ou pousser une autre pièce.',
  mirror:'Le plus proche du miroir traverse ; à la même distance, les deux occupants échangent leurs places. Le + gris clair annonce un héros, le contour carré une caisse. Espace active tous les miroirs sans déclencher la traction du Voleur.',
  gate:'Un + rose réagit au poids d’un héros ou d’un objet. Observe la porte liée : elle peut libérer le passage ou pousser en se fermant. Attention : tirer un objet hors du bouton peut relancer la presse.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Le premier arrivé reste sélectionnable et peut encore aider son partenaire.',
};
export function lessonPrompt(learned: ReadonlySet<ThiefLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les neuf découvertes sont acquises. Prépare les positions des deux héros et choisis entre marcher, tirer et partir par reflet.';
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
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Le Voleur ne tire rien pendant ce départ.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :pulled(before,next,action)?'Une pièce tirée dans la case quittée par le Voleur. Un pas de côté permet de la lâcher.'
    :pushLength(before,next,action)===1?'Une pièce poussée d’une case par le Marchand.'
    :!changed?selected?.kind==='thief'?'Le Voleur ne pousse pas. Libère sa case d’arrivée ou approche la pièce par l’autre côté.':'Ce déplacement est bloqué. Change de côté ou de personnage.':'';
}
