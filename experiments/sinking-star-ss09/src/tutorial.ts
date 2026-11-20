import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['select','move','merchant-push','bard-song','partner-song','selective-song','platform','support-slide','mirror-motion','mirror','gate','goals'] as const;
export type ChorusLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':'bard',selected:arms.includes(0)});
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
/** The refusal signal is read from visible mirror pixels, never private plans. */
function mirrorInterference(before:LessonObservation,after:LessonObservation,action:number):boolean {
  if(action!==5||after.frames.length<2)return false;
  const mirrors=visiblePieces(before.frame).filter(p=>p.kind==='mirror');
  return mirrors.some(p=>after.frames.some(frame=>{
    const px=2+p.x*3,py=2+p.y*3;
    for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(before.frame[py+y]![px+x]===0&&frame[py+y]![px+x]===8)return true;
    return false;
  }));
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
/** The first settled public frame isolates a voluntary song from later presses. */
function songView(before:LessonObservation,after:LessonObservation,action:number):{moved:VisiblePiece[];held:VisiblePiece[];slid:boolean;escorted:boolean}|null {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='bard')return null;
  const initial=visiblePieces(before.frame).filter(p=>p.kind!=='mirror'),later=visiblePieces(view.frame);
  const nearby=initial.filter(p=>Math.max(Math.abs(p.x-view.hero.x),Math.abs(p.y-view.hero.y))<=2);
  const follows=(p:VisiblePiece,depth=0):boolean=>{
    if(depth>20)return false;
    const to={x:p.x+view.dx,y:p.y+view.dy};
    const arrival=later.find(q=>sameCell(q,to)&&(q.kind===p.kind||(p.kind==='stone'&&q.kind==='support'&&!initial.some(r=>r.kind==='support'&&sameCell(r,to)))));
    if(!arrival)return false;
    const ahead=initial.find(q=>q.kind===p.kind&&sameCell(q,to));
    // A same-colour object already occupying the next cell is not proof of
    // movement: follow the whole row until its visible advancing end.
    return !ahead||!later.some(q=>samePiece(ahead,q))||follows(ahead,depth+1);
  };
  const moved=nearby.filter(p=>follows(p));
  const held=nearby.filter(p=>!moved.includes(p)&&later.some(q=>samePiece(p,q)));
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='merchant'),other=visibleHeroes(view.frame).find(h=>h.kind==='merchant');
  const escorted=!!companion&&!!other&&other.x===companion.x+view.dx&&other.y===companion.y+view.dy;
  return {moved,held,slid:moved.some(p=>p.kind==='support'),escorted};
}
export function observeLesson(learned:Set<ChorusLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL)return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  if(pushLength(before,after,action))learned.add('merchant-push');
  const view=movementView(before,after,action),song=songView(before,after,action);
  if(view)learned.add('move');
  if(song?.moved.length)learned.add('bard-song');
  if(song?.escorted)learned.add('partner-song');
  if(song?.moved.length&&song.held.length)learned.add('selective-song');
  if(song?.slid)learned.add('support-slide');
  if(view){const a=visiblePieces(before.frame).filter(p=>p.kind==='mirror'),b=visiblePieces(view.frame).filter(p=>p.kind==='mirror');if(a.length===b.length&&a.some(p=>!b.some(q=>sameCell(p,q))))learned.add('mirror-motion');}
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame);
  for(const frame of sameLevelFrames(before,after)){
    const pieces=visiblePieces(frame);
    if(pieces.filter(p=>p.kind==='support').length>initial.filter(p=>p.kind==='support').length
      &&pieces.some(p=>p.kind==='support'&&!initial.some(q=>samePiece(p,q))
      &&[0,1,2].some(dy=>[0,1,2].some(dx=>before.frame[2+p.y*3+dy]![2+p.x*3+dx]===9))))learned.add('platform');
    for(const [cell,value] of gateCells(frame))if((gates.has(cell)&&gates.get(cell)!==value)||(!gates.has(cell)&&value===5))learned.add('gate');
  }
  if(reflected(before,after,action))learned.add('mirror');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<ChorusLesson,string>={
  select:'Clique sur un personnage, appuie sur Tab ou utilise 1 / 2. Le point blanc indique celui qui agit. Le décor et les monstres n’avancent pas quand tu changes de rôle.',
  move:'Fais un pas avec le personnage sélectionné. Garde les deux héros à distance des monstres, même lorsque tu ne contrôles que l’un d’eux.',
  'merchant-push':'Le Marchand pousse une seule pièce. Place-le du bon côté d’une caisse ou d’un miroir. Il peut aussi pousser le Barde sans déclencher son chant.',
  'bard-song':'Sélectionne le Barde magenta. À chacun de ses pas, caisses, monstres, appuis et Marchand dans son carré de 5 × 5 tentent le même déplacement. Les diagonales comptent et les murs ne coupent pas sa portée.',
  'partner-song':'Approche le Barde du Marchand : son chant peut entraîner le partenaire d’une case. Le Marchand ainsi entraîné ne pousse pas une autre pièce devant lui.',
  'selective-song':'Le chant ne déplace pas forcément tout le groupe : une pièce retenue par un mur ou un autre occupant reste en place. Utilise cet arrêt pour séparer deux objets proches.',
  platform:'Envoie une caisse dans l’eau : elle devient un appui marron marqué d’un X cyan. Les deux héros peuvent marcher dessus.',
  'support-slide':'Le Barde peut faire glisser un appui d’une case d’eau vers une autre. Un appui occupé par un héros, ou celui sur lequel le Barde va marcher, reste ancré. Il ne remonte pas sur le sol.',
  'mirror-motion':'Le chant laisse les miroirs en place. Utilise le Marchand pour en pousser un ; son orientation reste fixe mais ses axes et les arrivées changent.',
  mirror:'Le + gris clair montre l’arrivée d’un héros ; le contour gris clair celle d’une caisse. Espace active tous les miroirs sans chant. Un miroir qui empêche le reflet clignote en rouge.',
  gate:'Le poids sur un bouton commande sa porte ou sa presse. Le repère indique le sens de poussée. Observe toute la cascade avant de déplacer le poids à nouveau.',
  goals:'Place les deux personnages sur les deux contours jaunes en même temps. Le premier arrivé reste sélectionnable et peut encore aider son partenaire.',
};
export function lessonPrompt(learned: ReadonlySet<ChorusLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les découvertes sont acquises. Combine la poussée, le chant, les appuis et les reflets pour faire arriver les deux héros.';
}

export function heroSelection(frame: number[][], kind?: HeroKind): Point | undefined {
  const hero = visibleHeroes(frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  return hero && !hero.selected ? { x: 3 + hero.x * 3, y: 3 + hero.y * 3 } : undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final);
  const song=songView(before,next,action);
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les deux destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Les deux héros peuvent le déclencher.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs en conflit clignotent en rouge. Déplace un miroir ou libère son axe.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :song?.escorted?'Le chant entraîne aussi le Marchand ; ce mouvement ne déclenche aucune poussée supplémentaire.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :pushLength(before,next,action)===1?'Une pièce poussée d’une case par le Marchand ; aucun chant n’est déclenché.'
    :!changed?selected?.kind==='bard'?'Le Barde ne peut pas avancer : le chant entier est annulé. Vérifie sa prochaine case et son appui.':'Ce déplacement est bloqué. Change de côté ou de personnage.'
    :selected?.kind==='bard'?'Le Barde avance. Aucune pièce de son aura n’a pu le suivre.':'';
}
