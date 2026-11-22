import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['select','move','warrior-push','chain','thief-pull','single-pull','partner-pull','release','mirror-motion','water-support','cross-support','hydraulic','wizard-swap','wizard-partner','wizard-bend','wizard-walk','mirror','hero-reflection','crate-reflection','button','gate','press','monster','goals'] as const;
export type FortressLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==8&&center!==14&&center!==15)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===8?'warrior':center===14?'thief':'wizard',selected:arms.includes(0)});
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
function pulled(before:LessonObservation,after:LessonObservation,action:number):boolean {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='thief')return false;
  const from={x:view.hero.x-view.dx,y:view.hero.y-view.dy};
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,from));
  if(piece)return visiblePieces(view.frame).some(p=>p.kind===piece.kind&&sameCell(p,view.hero));
  const companion=visibleHeroes(before.frame).find(h=>h.kind!==view.hero.kind&&sameCell(h,from));
  return !!companion&&visibleHeroes(view.frame).some(h=>h.kind===companion.kind&&sameCell(h,view.hero));
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
  const companion=visibleHeroes(before.frame).find(h=>h.kind!=='wizard'&&sameCell(h,later));
  const exchanged=piece?visiblePieces(frame).some(p=>p.kind===piece.kind&&sameCell(p,hero))
    :!!companion&&visibleHeroes(frame).some(h=>h.kind===companion.kind&&sameCell(h,hero));
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
/** A remembered platform is still only an observation of its visible tile.
 * It is needed because a crate can hide the platform while it is deployed. */
const hydraulicMemory=new WeakMap<Set<FortressLesson>,Set<string>>();
const key=(p:Point):string=>`${p.x},${p.y}`;
function exposedPlatforms(frame:number[][]):Point[]{
 const cells:Point[]=[];
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){
  const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
  const corners=[frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]];
  const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
  if(corners.every(c=>c===7)&&center!==3&&center!==5&&(arms.every(c=>c===7)||arms.every(c=>c===9)))cells.push({x,y});
 }
 return cells;
}
function unoccupiedButtons(frame:number[][]):Point[]{
 const cells:Point[]=[];
 for(let y=0;y<20;y++)for(let x=0;x<20;x++){
  const px=2+x*3,py=2+y*3;
  if([frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]].every(c=>c===3)
   &&[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]].every(c=>c===7))cells.push({x,y});
 }
 return cells;
}
export function observeLesson(learned:Set<FortressLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
 if(before.level!==TUTORIAL_LEVEL||returnedRay(before,after,action))return;
 const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
 const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
 const view=movementView(before,after,action),initial=visiblePieces(before.frame),later=visiblePieces(final);
 const moved=pushLength(before,after,action);
 if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
 const swapped=wizardSwap(before,after,action);
 if(view&&!swapped)learned.add('move');
 if(swapped)learned.add('wizard-swap');
 if(swapped?.partner)learned.add('wizard-partner');
 if(swapped?.bent)learned.add('wizard-bend');
 if(view?.hero.kind==='wizard'&&!swapped)learned.add('wizard-walk');
 if(moved&&selected?.kind==='warrior')learned.add('warrior-push');
 if(moved>1)learned.add('chain');
 if(pulled(before,after,action)){
  learned.add('thief-pull');
  if(view&&initialHeroes.some(h=>h.kind!=='thief'&&h.x===view.hero.x-view.dx&&h.y===view.hero.y-view.dy))learned.add('partner-pull');
 }
 if(view?.hero.kind==='thief'){
  const pieces=initial.filter(p=>p.kind!=='support'),end=visiblePieces(view.frame);
  const rear={x:view.hero.x-view.dx,y:view.hero.y-view.dy},further={x:rear.x-view.dx,y:rear.y-view.dy};
  if(pulled(before,after,action)&&pieces.some(p=>sameCell(p,further))&&end.some(p=>sameCell(p,further)))learned.add('single-pull');
  if(pieces.some(p=>Math.abs(p.x-view.hero.x)+Math.abs(p.y-view.hero.y)===1
    &&(p.x-view.hero.x)*view.dx+(p.y-view.hero.y)*view.dy===0&&end.some(q=>samePiece(p,q))))learned.add('release');
 }
 if(view){
  if(initial.some(p=>p.kind==='mirror'&&!visiblePieces(view.frame).some(q=>samePiece(p,q))))learned.add('mirror-motion');
  if(initial.some(p=>p.kind==='support'&&sameCell(p,view.later)))learned.add('cross-support');
 }
 let known=hydraulicMemory.get(learned);if(!known){known=new Set();hydraulicMemory.set(learned,known);}
 for(const frame of [before.frame,...sameLevelFrames(before,after)])for(const p of exposedPlatforms(frame))known.add(key(p));
 const created=later.filter(p=>p.kind==='support'&&!initial.some(q=>samePiece(p,q)));
 if(created.length)learned.add('water-support');
 if(created.some(p=>known.has(key(p))))learned.add('hydraulic');
 if(reflected(before,after,action)){
  learned.add('mirror');
  if(initialHeroes.some(h=>!sameCell(h,currentHeroes.find(q=>q.kind===h.kind))))learned.add('hero-reflection');
  if(initial.some(p=>p.kind==='stone'&&!later.some(q=>samePiece(p,q))))learned.add('crate-reflection');
 }
 if(unoccupiedButtons(before.frame).some(p=>[...later,...currentHeroes].some(q=>q.kind!=='support'&&sameCell(p,q))))learned.add('button');
 const gates=gateCells(before.frame);
 for(const frame of sameLevelFrames(before,after))for(const [cell,value]of gateCells(frame))if(gates.has(cell)&&gates.get(cell)!==value)learned.add('gate');
 if(pressedActor(before,after))learned.add('press');
 if(after.frames.length>1&&later.filter(p=>p.kind==='monster').length<initial.filter(p=>p.kind==='monster').length)learned.add('monster');
 if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<FortressLesson,string>={
 select:'Clique sur un héros, utilise 1 / 2 / 3 ou Tab dans la grille. Le point blanc indique le héros sélectionné. La sélection ne fait avancer ni les mécanismes ni les monstres.',
 move:'Déplace le héros sélectionné avec les flèches. Observe aussi les deux partenaires : ils restent dans la salle et sont exposés aux mêmes dangers.',
 'warrior-push':'Le Guerrier rouge pousse caisses, miroirs, monstres et partenaires. Prépare le côté depuis lequel il pourra agir : il ne tire pas.',
 chain:'Le Guerrier fait avancer toute la file consécutive d’une case. Vérifie son extrémité avant de pousser : le même geste peut immerger une caisse.',
 'thief-pull':'Le Voleur vert avance vers une case libre et tire la pièce juste derrière lui dans la case qu’il quitte. Il ne peut pas pousser ce qui est devant lui.',
 'single-pull':'Même devant une rangée, le Voleur ne tire qu’une seule pièce. Cette séparation permet de récupérer une caisse en laissant sa voisine au fond.',
 'partner-pull':'Un partenaire juste derrière le Voleur suit comme une caisse. Ni le Guerrier ni le Magicien n’utilise sa capacité pendant ce déplacement forcé.',
 release:'Après avoir tiré, pars de côté pour lâcher la charge. Un départ par reflet la laisse également en place, car ce déplacement forcé ne déclenche pas la traction.',
 'mirror-motion':'Pousser ou tirer un miroir déplace ses deux axes sans changer sa face. Un seul décalage peut ouvrir une arrivée jusque-là bloquée par un mur.',
 'water-support':'Une caisse envoyée dans l’eau sans soutien devient un appui marqué d’un X cyan. Cet investissement est définitif dans SS17 : la caisse n’est plus mobile.',
 'cross-support':'Un appui porte les trois héros et les pièces. Il reste fixe quand quelqu’un le traverse ; une caisse peut glisser dessus avant de combler la prochaine case d’eau.',
 hydraulic:'Une plateforme activée porte sa charge. Quand elle se retire, une caisse devient un appui permanent ; un héros tombe. Vérifie les trois positions avant de relâcher le bouton.',
 'wizard-swap':'Une flèche du Magicien violet vise la première caisse, le premier monstre ou le premier partenaire rencontré. Il échange sa place avec cette cible. L’eau laisse passer le rayon ; un appui immergé ne constitue plus une cible.',
 'wizard-partner':'Échange le Magicien avec un partenaire pour lui donner le bon côté d’une pièce ou relever un bouton sans le libérer. L’échange conserve un occupant à chaque extrémité : il ne remplit pas une île vide.',
 'wizard-bend':'La face blanche d’un miroir dévie la visée à angle droit ; le dos noir l’arrête. Plusieurs miroirs peuvent relayer le rayon. Si le rayon revient au Magicien, il clignote et reste sur place.',
 'wizard-walk':'Sans cible dans l’axe, le Magicien tente un pas ordinaire. Une pièce éloignée peut donc modifier le résultat de la même flèche. Regarde toute la ligne avant de marcher.',
 mirror:'Espace ou X active tous les miroirs. Chaque face blanche relie deux axes à angle droit et conserve la distance. Les dos noirs, murs et portes peuvent arrêter les trajets.',
 'hero-reflection':'Le candidat le plus proche du miroir passe en premier ; à distance égale, les occupants échangent leurs places. Un héros reflété n’active pas sa poussée ou sa traction.',
 'crate-reflection':'Le contour gris clair indique l’arrivée d’une caisse. Transporte le matériel utile avant de condamner son accès, et garde un espace pour recevoir le dernier héros.',
 button:'Le + rose est un bouton. Un héros, une caisse, un monstre ou un miroir peut le maintenir. Une ressource immobilisée sur un bouton ne peut pas servir ailleurs au même moment.',
 gate:'Le repère de couleur relie les commandes et leurs portes. Quand plusieurs boutons partagent un circuit, tous doivent être occupés ensemble. Prépare les remplaçants avant de faire partir les héros.',
 press:'Une porte-presse se ferme en poussant l’occupant de sa propre case dans la direction indiquée. Elle peut déposer une charge hors d’atteinte ; une file bloquée risque l’écrasement.',
 monster:'Les monstres frappent les voisins orthogonaux après une action effective. Deux monstres qui se rencontrent s’éliminent ensemble, mais attaquent encore pendant cette vague. Les diagonales restent sûres.',
 goals:'Les trois contours jaunes doivent être occupés simultanément. Le premier arrivé reste sélectionnable ; assure les poids et les passages avant de réunir le trio.',
};
export function lessonPrompt(learned:ReadonlySet<FortressLesson>):string{
 const next=lessonIds.find(id=>!learned.has(id));
 return next?hints[next]:'Les vingt-quatre découvertes sont acquises. Compte les caisses mobiles, préserve les visées et relève les boutons avant de réunir le trio.';
}
export function heroSelection(frame:number[][],kind?:HeroKind):Point|undefined{
 const all=visibleHeroes(frame),order:HeroKind[]=['warrior','thief','wizard'];
 const current=all.find(h=>h.selected)?.kind;
 const target=kind??order[(order.indexOf(current??'warrior')+1)%order.length];
 const hero=all.find(h=>h.kind===target);
 return hero&&!hero.selected?{x:3+hero.x*3,y:3+hero.y*3}:undefined;
}
export function actionFeedback(before:LessonObservation,next:LessonObservation&{state:string},action:number):string{
 const selected=visibleHeroes(before.frame).find(h=>h.selected),end=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
 const pushed=pushLength(before,next,action);
 return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
  :next.levelsCompleted>before.levelsCompleted?'Les trois destinations sont occupées. Salle terminée !'
  :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
  :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Aucune capacité ne se déclenche pendant ce transfert.'
  :action===5?'Reflet bloqué ou aucune cible accessible devant les faces blanches. Les miroirs impliqués dans un trajet bloqué clignotent en rouge.'
  :returnedRay(before,next,action)?'Le rayon revient sur le Magicien : il clignote et reste sur place. La salle n’avance pas.'
  :wizardSwap(before,next,action)?.bent?'Échange par un rayon dévié : le Magicien et sa première cible ont changé de place.'
  :wizardSwap(before,next,action)?.partner?'Relève instantanée : le Magicien et son partenaire ont échangé leurs places.'
  :wizardSwap(before,next,action)?'Transposition : le Magicien échange sa place avec la première cible rencontrée.'
  :pulled(before,next,action)?'Une pièce tirée dans la case quittée par le Voleur. Un pas de côté permet de la lâcher.'
  :pushed>1?'Toute la file avance d’une case sous la poussée du Guerrier.'
  :pushed===1?'Une pièce poussée par le Guerrier.'
  :selected&&sameCell(selected,end)?selected.kind==='thief'?'Le Voleur ne pousse pas. Libère sa case d’arrivée ou approche la pièce par l’autre côté.':selected.kind==='wizard'?'Aucune cible échangeable ni aucun pas possible dans cet axe. Vérifie les murs, les dos des miroirs et la première cible.':'Ce déplacement est bloqué. Vérifie la case au bout de la file.':'';
}
