import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['select','move','wizard-swap','wizard-partner','wizard-bend','relay-weight','bard-song','partner-song','selective-song','diagonal-song','wall-song','release-by-swap','platform','support-slide','support-anchor','mirror','gate','press','monster','goals'] as const;
export type HarmonyLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==15&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===15?'wizard':'bard',selected:arms.includes(0)});
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
    for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(before.frame[py+y]![px+x]===5&&frame[py+y]![px+x]===8)return true;
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
/** A reciprocal exchange is recognized from public sprites, including adjacent swaps. */
function wizardSwap(before:LessonObservation,after:LessonObservation,action:number):{bent:boolean;partner:boolean}|null {
  if(action<1||action>4||after.frames.length<3)return null;
  const hero=visibleHeroes(before.frame).find(h=>h.selected);
  if(hero?.kind!=='wizard')return null;
  const frame=sameLevelFrames(before,after)[2]??actionFrame(before,after);
  const later=visibleHeroes(frame).find(h=>h.kind==='wizard');
  if(!later||sameCell(hero,later))return null;
  const piece=visiblePieces(before.frame).find(p=>(p.kind==='stone'||p.kind==='monster')&&sameCell(p,later));
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='bard'&&sameCell(h,later));
  const exchanged=piece?visiblePieces(frame).some(p=>p.kind===piece.kind&&sameCell(p,hero))
    :!!companion&&visibleHeroes(frame).some(h=>h.kind==='bard'&&sameCell(h,hero));
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
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='wizard'),other=visibleHeroes(view.frame).find(h=>h.kind==='wizard');
  const escorted=!!companion&&!!other&&other.x===companion.x+view.dx&&other.y===companion.y+view.dy;
  return {moved,held,slid:moved.some(p=>p.kind==='support'),escorted};
}
/** A press is inferred from a newly exposed closed gate at a displaced actor's
 * old cell, after the first displayed movement has ended. Combat disappearance,
 * hydraulic withdrawal and the initial voluntary movement are not a press. */
function pressedActor(before:LessonObservation,after:LessonObservation):boolean {
  const frames=sameLevelFrames(before,after),early=frames[2];
  if(!early||frames.length<6)return false;
  const oldActors=[...visibleHeroes(early),...visiblePieces(early).filter(p=>p.kind!=='support')];
  const oldGates=gateCells(early);
  for(const frame of frames.slice(3)){
    const closed=gateCells(frame),actors=[...visibleHeroes(frame),...visiblePieces(frame)];
    for(const from of oldActors){
      const cell=from.y*20+from.x;
      if(closed.get(cell)!==5||oldGates.get(cell)===5)continue;
      if(actors.some(to=>(to.kind===from.kind||(from.kind==='stone'&&to.kind==='support'))
        &&Math.abs(to.x-from.x)+Math.abs(to.y-from.y)===1
        &&!oldActors.some(old=>old.kind===to.kind&&sameCell(old,to))))return true;
    }
  }
  return false;
}
/** Plate markings remain visible at the corners even under a hero or crate. */
function plateAt(frame:number[][],p:Point):boolean {
  const px=2+3*p.x,py=2+3*p.y;
  return [frame[py]?.[px+2],frame[py+2]?.[px],frame[py+2]?.[px+2]].every(c=>c===7);
}
export function observeLesson(learned:Set<HarmonyLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL||returnedRay(before,after,action))return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const swap=wizardSwap(before,after,action),view=movementView(before,after,action),song=songView(before,after,action);
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame),early=sameLevelFrames(before,after)[2]??final;
  if(view&&!swap)learned.add('move');
  if(swap){
    learned.add('wizard-swap');
    if(swap.bent)learned.add('wizard-bend');
    const oldWizard=initialHeroes.find(h=>h.kind==='wizard'),newWizard=visibleHeroes(early).find(h=>h.kind==='wizard');
    if((oldWizard&&plateAt(before.frame,oldWizard))||(newWizard&&plateAt(before.frame,newWizard)))learned.add('relay-weight');
    if(swap.partner){
      learned.add('wizard-partner');
      const bard=initialHeroes.find(h=>h.kind==='bard'),later=visiblePieces(early);
      if(bard&&initial.some(p=>(p.kind==='stone'||p.kind==='monster')&&Math.max(Math.abs(p.x-bard.x),Math.abs(p.y-bard.y))<=2&&later.some(q=>samePiece(p,q))))learned.add('release-by-swap');
    }
  }
  if(song?.moved.length)learned.add('bard-song');
  if(song?.escorted)learned.add('partner-song');
  if(song?.moved.length&&song.held.length)learned.add('selective-song');
  if(song?.slid)learned.add('support-slide');
  if(view?.hero.kind==='bard'){
    const end=visiblePieces(view.frame);
    if(initial.some(p=>p.kind==='support'&&Math.max(Math.abs(p.x-view.hero.x),Math.abs(p.y-view.hero.y))<=2
      &&(initialHeroes.some(h=>sameCell(h,p))||sameCell(p,view.later))&&end.some(q=>samePiece(p,q))))learned.add('support-anchor');
    if(song?.moved.some(p=>Math.abs(p.x-view.hero.x)===2&&Math.abs(p.y-view.hero.y)===2))learned.add('diagonal-song');
    if(song?.moved.some(p=>{
      const dx=p.x-view.hero.x,dy=p.y-view.hero.y;
      if((dx===0&&Math.abs(dy)===2)||(dy===0&&Math.abs(dx)===2))return before.frame[3+3*(view.hero.y+dy/2)]?.[3+3*(view.hero.x+dx/2)]===4;
      return false;
    }))learned.add('wall-song');
  }
  for(const frame of sameLevelFrames(before,after)){
    const pieces=visiblePieces(frame);
    if(pieces.filter(p=>p.kind==='support').length>initial.filter(p=>p.kind==='support').length
      &&pieces.some(p=>p.kind==='support'&&!initial.some(q=>samePiece(p,q))
      &&[0,1,2].some(dy=>[0,1,2].some(dx=>before.frame[2+p.y*3+dy]![2+p.x*3+dx]===9))))learned.add('platform');
    for(const [cell,value] of gateCells(frame))if((gates.has(cell)&&gates.get(cell)!==value)||(!gates.has(cell)&&value===5))learned.add('gate');
  }
  if(reflected(before,after,action))learned.add('mirror');
  if(pressedActor(before,after)){learned.add('press');learned.add('gate');}
  if(visiblePieces(final).filter(p=>p.kind==='monster').length<initial.filter(p=>p.kind==='monster').length)learned.add('monster');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<HarmonyLesson,string>={
  select:'Clique sur un héros, utilise Tab ou 1 / 2. Le Magicien est violet, le Barde magenta. La sélection ne fait avancer ni le décor ni les monstres.',
  move:'Le point blanc désigne le héros sélectionné. Sans cible sur son rayon, le Magicien tente un pas ; le Barde avance en faisant chanter les éléments proches.',
  'wizard-swap':'Une flèche du Magicien échange sa place avec la première caisse, le premier monstre ou le Barde rencontré. Les cibles plus loin attendent. Sans cible, il marche ; il ne pousse pas.',
  'wizard-partner':'Échange les deux héros. Le Barde arrive à la place du Magicien sans chanter : les objets autour de lui gardent leur position.',
  'wizard-bend':'La face blanche d’un miroir dévie le rayon à angle droit ; son dos noir le bloque. Plusieurs faces peuvent relayer une visée. Flèches : transposition. Espace : reflet.',
  'relay-weight':'Un échange remplace un poids par un autre sur chacune des deux cases. Une commande peut ainsi rester appuyée pendant que son premier occupant repart.',
  'bard-song':'Chaque pas du Barde entraîne caisses, monstres, appuis et Magicien situés dans son carré de 5 × 5. La portée est calculée avant le pas ; les miroirs ne suivent jamais.',
  'partner-song':'Le Magicien entraîné par le chant ne lance aucun sort. Déplace-le de cette façon pour préparer une nouvelle ligne de visée sans échanger sa place.',
  'selective-song':'Une pièce retenue par un mur ou un occupant immobile reste en place pendant que les autres avancent. Les butées permettent de corriger les écarts du groupe.',
  'diagonal-song':'Les quatre coins du carré font partie du chant : une pièce à deux cases horizontalement et deux verticalement peut suivre le Barde.',
  'wall-song':'Les murs ne coupent pas la portée du chant. Une pièce derrière une cloison peut suivre le Barde si sa propre case d’arrivée est libre.',
  'release-by-swap':'Après avoir posé un poids, fais échanger le Barde par le Magicien. Ce départ forcé laisse son cortège en place, même s’il se trouvait dans sa portée.',
  platform:'Une caisse envoyée dans l’eau sans soutien devient un appui marron avec un X cyan. Elle cesse d’être une cible du Magicien. Sur un soutien déjà présent, la caisse reste mobile.',
  'support-slide':'Le chant peut faire glisser un appui d’une case d’eau vers une autre. Il ne remonte pas sur le sol et ne se transpose pas.',
  'support-anchor':'Un appui sous un héros reste ancré pendant le pas. Celui où le Barde va poser le pied reste également en place : protège l’appui à conserver avant de déplacer les autres.',
  mirror:'Espace / X active tous les miroirs. Le candidat le plus proche passe ; à distance égale les deux échangent. Les marques gris clair montrent les arrivées. Aucun pouvoir de héros ne se déclenche.',
  gate:'Les plus roses sont des boutons, avec la couleur du circuit au centre. Héros, caisse, monstre ou miroir peuvent les maintenir. Tous les boutons d’un même circuit doivent être occupés.',
  press:'Une porte qui se ferme pousse dans le sens de son repère. Elle peut déplacer une caisse, un miroir ou un héros. Centre noir : fermée ; gris : ouverte. Z annule toute la cascade.',
  monster:'Les monstres frappent leurs voisins orthogonaux après une action effective. Deux monstres voisins se tuent simultanément. Une diagonale est sûre ; un monstre sans appui dans l’eau disparaît.',
  goals:'Occupe les deux contours jaunes ensemble. Les échanges redistribuent les places ; pour augmenter le nombre de ressources sur une rive, il faut aussi un véritable passage.',
};
export function lessonPrompt(learned: ReadonlySet<HarmonyLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les vingt découvertes sont acquises. Combine échanges, chant, appuis protégés et reflets pour préparer le départ des deux héros.';
}

export function heroSelection(frame: number[][], kind?: HeroKind): Point | undefined {
  const hero = visibleHeroes(frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  return hero && !hero.selected ? { x: 3 + hero.x * 3, y: 3 + hero.y * 3 } : undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final),song=songView(before,next,action),swap=wizardSwap(before,next,action);
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les deux destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Aucun chant ni sort ne se déclenche.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs responsables clignotent en rouge. Vérifie leurs axes et les arrivées.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :returnedRay(before,next,action)?'Le rayon revient sur le Magicien : il clignote sur place, sans déplacer le monde.'
    :swap?.bent?'Échange par un rayon dévié : le Magicien et sa première cible ont changé de place.'
    :swap?.partner?'Les deux héros échangent leurs places. Le Barde déplacé ainsi ne chante pas.'
    :swap?'Transposition : le Magicien et la première cible échangent leurs places.'
    :song?.escorted?'Le chant entraîne aussi le Magicien, sans déclencher de sort.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :!changed?selected?.kind==='bard'?'Le pas est refusé. Vérifie la prochaine case du Barde et les appuis des héros et des miroirs.':'Aucun échange ni pas possible. Vérifie la première cible, les faces des miroirs et les arrivées.'
    :selected?.kind==='bard'?'Le Barde avance. Aucune pièce de sa portée n’a pu le suivre.':'Le Magicien marche : aucune cible dans cet axe.';
}
