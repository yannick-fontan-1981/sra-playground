import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const lessonIds = ['move','select','merchant-push','warrior-push','platform','mirror','gate','goals'] as const;
export type DuoLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==8)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':'warrior',selected:arms.includes(0)});
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
export function actionFrame(before:LessonObservation,after:LessonObservation):number[][] {
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
export function reflected(before:LessonObservation,after:LessonObservation,action:number):boolean {
  if(action!==5||after.frames.length<3)return false;
  const final=actionFrame(before,after);
  return JSON.stringify(visibleHeroes(before.frame).map(h=>[h.kind,h.x,h.y]))!==JSON.stringify(visibleHeroes(final).map(h=>[h.kind,h.x,h.y]))
    || JSON.stringify(visiblePieces(before.frame))!==JSON.stringify(visiblePieces(final));
}
export function pushLength(before:LessonObservation,after:LessonObservation,action:number):number {
  if(action<1||action>4)return 0;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  const later=visibleHeroes(actionFrame(before,after)).find(h=>h.kind===hero?.kind);
  if(!hero||!later||Math.abs(later.x-hero.x)+Math.abs(later.y-hero.y)!==1)return 0;
  const [dx,dy]=({1:[0,-1],2:[0,1],3:[-1,0],4:[1,0]} as Record<number,[number,number]>)[action]!;
  if(later.x!==hero.x+dx||later.y!==hero.y+dy)return 0;
  const pieces=visiblePieces(before.frame).filter(p=>p.kind!=='support');
  const actors:Point[]=[...pieces,...visibleHeroes(before.frame).filter(h=>h.kind!==hero.kind)];
  let n=0,p:Point={x:hero.x+dx,y:hero.y+dy};
  while(actors.some(a=>sameCell(a,p))&&n<20){n++;p={x:p.x+dx,y:p.y+dy};}
  return n;
}
export function observeLesson(learned:Set<DuoLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==1)return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action>=1&&action<=4&&initialHeroes.some(h=>!sameCell(h,currentHeroes.find(q=>q.kind===h.kind))))learned.add('move');
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const pushed=pushLength(before,after,action);
  if(selected?.kind==='merchant'&&pushed>=1)learned.add('merchant-push');
  if(selected?.kind==='warrior'&&pushed>=2)learned.add('warrior-push');
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame);
  for(const frame of sameLevelFrames(before,after)){
    if(visiblePieces(frame).some(p=>p.kind==='support'&&!initial.some(q=>samePiece(p,q))
      &&[0,1,2].some(dy=>[0,1,2].some(dx=>before.frame[2+p.y*3+dy]![2+p.x*3+dx]===9))))learned.add('platform');
    for(const [cell,value] of gateCells(frame))if(gates.has(cell)&&gates.get(cell)!==value)learned.add('gate');
  }
  if(reflected(before,after,action))learned.add('mirror');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<DuoLesson,string>={
  move:'Déplace le personnage portant le point blanc avec les flèches. Les autres restent en place ; ils peuvent servir de poids ou attendre près d’un miroir.',
  select:'Clique sur l’autre personnage, utilise Tab dans la grille ou les boutons Marchand et Guerrier. La sélection ne fait pas avancer les mécanismes.',
  'merchant-push':'Le Marchand orange pousse un seul objet. Place-toi du bon côté d’une caisse ou d’un miroir, puis avance vers lui. Deux objets en file bloquent sa poussée.',
  'warrior-push':'Sélectionne le Guerrier rouge et pousse la file de caisses alignées : une seule flèche avance toute la file, si son extrémité est libre.',
  platform:'Pousse une caisse dans l’eau pour créer un appui marron marqué d’un X cyan. Utilise ce passage pour contourner une autre caisse et la pousser du bon côté.',
  mirror:'Place les occupants devant la face blanche d’un miroir. Le + gris clair montre l’arrivée d’un personnage, le carré celle d’une caisse. Espace active tous les miroirs ensemble.',
  gate:'Maintiens un + rose avec un personnage ou une caisse. Observe la porte liée : elle peut libérer le passage ou pousser sa file en se fermant. Le repère indique son sens.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Un personnage déjà arrivé reste sélectionnable : il peut encore aider son partenaire.',
};
export function lessonPrompt(learned: ReadonlySet<DuoLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les huit découvertes sont acquises. Les salles suivantes combinent ces règles : prépare l’arrivée des deux héros avant le dernier reflet.';
}

export function heroSelection(frame: number[][], kind?: HeroKind): Point | undefined {
  const hero = visibleHeroes(frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  return hero && !hero.selected ? { x: 3 + hero.x * 3, y: 3 + hero.y * 3 } : undefined;
}

export function actionFeedback(
  before: LessonObservation, after: LessonObservation & { state: string }, action: number,
): string {
  const heroes = visibleHeroes(before.frame);
  const solo = heroes.length === 1;
  if (after.state === 'GAME_OVER') return solo ? 'Le Guerrier a été perdu. Z annule la séquence, R recommence le niveau.'
    : 'Un personnage a été perdu. Z annule la séquence, R recommence le niveau.';
  if (after.levelsCompleted > before.levelsCompleted) return solo
    ? 'La destination est atteinte. Salle terminée !' : 'Les deux destinations sont occupées. Salle terminée !';
  const selected = heroes.find(hero => hero.selected);
  if (action === 6) {
    const selectedAfter = visibleHeroes(after.frame).find(hero => hero.selected);
    return selectedAfter && selectedAfter.kind !== selected?.kind
      ? 'Personnage sélectionné. Le décor et les monstres restent en place.' : '';
  }
  if (action === 5) return reflected(before, after, action)
    ? solo ? 'Reflet effectué. Vérifie les nouvelles positions.' : 'Reflet simultané. Vérifie la position des deux personnages.'
    : 'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et les miroirs.';
  const pushed = pushLength(before, after, action);
  if (pushed >= 2) return 'Le Guerrier pousse toute la file d’un seul pas.';
  if (pushed === 1) return 'Objet poussé d’une case.';
  const final = visibleHeroes(actionFrame(before, after)).find(hero => hero.kind === selected?.kind);
  if (selected && !sameCell(selected, final)) return '';
  return solo ? 'Ce déplacement est bloqué. Change de côté.' : 'Ce déplacement est bloqué. Change de côté ou de personnage.';
}
