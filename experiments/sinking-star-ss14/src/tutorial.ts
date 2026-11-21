import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['select','move','thief-pull','partner-pull','release','bard-song','partner-song','selective-song','platform','support-slide','support-anchor','mirror-motion','mirror','gate','press','monster','goals'] as const;
export type HarmonyLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==14&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===14?'thief':'bard',selected:arms.includes(0)});
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
function pulled(before:LessonObservation,after:LessonObservation,action:number):'hero'|'stone'|'mirror'|'monster'|null {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='thief')return null;
  const rear={x:view.hero.x-view.dx,y:view.hero.y-view.dy};
  const bard=visibleHeroes(before.frame).find(h=>h.kind==='bard');
  if(sameCell(bard,rear)&&sameCell(visibleHeroes(view.frame).find(h=>h.kind==='bard'),view.hero))return 'hero';
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,rear));
  return piece&&visiblePieces(view.frame).some(p=>p.kind===piece.kind&&sameCell(p,view.hero))?piece.kind as 'stone'|'mirror'|'monster':null;
}
function released(before:LessonObservation,after:LessonObservation,action:number):boolean {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='thief')return false;
  const px=2+view.hero.x*3,py=2+view.hero.y*3;
  const arms=[before.frame[py]![px+1],before.frame[py+1]![px],before.frame[py+1]![px+2],before.frame[py+2]![px+1]];
  const direction=([{x:0,y:-1},{x:-1,y:0},{x:1,y:0},{x:0,y:1}] as Point[])[arms.indexOf(0)];
  if(!direction||direction.x*view.dx+direction.y*view.dy!==0)return false;
  const rear={x:view.hero.x-direction.x,y:view.hero.y-direction.y};
  const initial=[...visiblePieces(before.frame).filter(p=>p.kind!=='support'),...visibleHeroes(before.frame).filter(h=>h.kind==='bard')];
  const actor=initial.find(p=>sameCell(p,rear));
  const later=[...visiblePieces(view.frame),...visibleHeroes(view.frame)];
  return !!actor&&later.some(p=>p.kind===actor.kind&&sameCell(p,rear));
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
  const companion=visibleHeroes(before.frame).find(h=>h.kind==='thief'),other=visibleHeroes(view.frame).find(h=>h.kind==='thief');
  const escorted=!!companion&&!!other&&other.x===companion.x+view.dx&&other.y===companion.y+view.dy;
  return {moved,held,slid:moved.some(p=>p.kind==='support'),escorted};
}
/** A press is inferred from a newly exposed closed gate at a displaced actor's
 * old cell, after the first displayed movement has ended. Combat disappearance,
 * hydraulic withdrawal and the voluntary pull itself are not a press. */
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
export function observeLesson(learned:Set<HarmonyLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL)return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const pull=pulled(before,after,action),view=movementView(before,after,action),song=songView(before,after,action);
  if(view)learned.add('move');
  if(pull)learned.add('thief-pull');
  if(pull==='hero')learned.add('partner-pull');
  if(learned.has('thief-pull')&&released(before,after,action))learned.add('release');
  if(song?.moved.length)learned.add('bard-song');
  if(song?.escorted)learned.add('partner-song');
  if(song?.moved.length&&song.held.length)learned.add('selective-song');
  if(song?.slid)learned.add('support-slide');
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame);
  if(view?.hero.kind==='bard'){
    const end=visiblePieces(view.frame);
    if(initial.some(p=>p.kind==='support'&&Math.max(Math.abs(p.x-view.hero.x),Math.abs(p.y-view.hero.y))<=2
      &&(initialHeroes.some(h=>sameCell(h,p))||sameCell(p,view.later))&&end.some(q=>samePiece(p,q))))learned.add('support-anchor');
  }
  if(view){const a=initial.filter(p=>p.kind==='mirror'),b=visiblePieces(view.frame).filter(p=>p.kind==='mirror');if(a.length===b.length&&a.some(p=>!b.some(q=>sameCell(p,q))))learned.add('mirror-motion');}
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
  select:'Clique sur un héros, utilise Tab ou 1 / 2. Le Voleur est vert, le Barde magenta. Changer de rôle ne fait avancer ni le décor ni les monstres.',
  move:'Le point blanc désigne le héros sélectionné. Une flèche fait un pas dans sa direction ; le Voleur doit avoir une case libre devant lui.',
  'thief-pull':'Recule en t’éloignant d’un occupant adjacent : il entre dans la case que tu quittes. Le Voleur tire une seule caisse, un seul miroir, monstre ou partenaire ; il ne pousse pas et ne tire pas toute une file.',
  'partner-pull':'Le Voleur peut tirer le Barde placé juste derrière lui. Ce déplacement forcé ne lance aucun chant : les objets voisins restent en place.',
  release:'Après une traction, pars sur le côté pour relâcher ta prise. L’occupant reste où tu l’as laissé ; tu peux alors changer de côté sans le retirer de sa commande.',
  'bard-song':'Chaque pas du Barde entraîne caisses, monstres, appuis et Voleur dans son carré de 5 × 5, dans la même direction. Les diagonales comptent ; les murs ne coupent pas la portée.',
  'partner-song':'Le chant peut déplacer le Voleur. Celui-ci ne tire rien pendant ce mouvement forcé : tu peux ainsi l’éloigner d’un poids sans déplacer ce poids.',
  'selective-song':'Une pièce retenue par un mur ou un autre occupant reste en place pendant que les autres avancent. Les butées permettent de changer leurs écarts et leurs alignements.',
  platform:'Envoie une caisse dans l’eau sans appui ni plateforme déployée : elle devient un appui marron marqué d’un X cyan. Les deux héros peuvent marcher dessus ; le Voleur ne peut plus la tirer. Une caisse posée sur un soutien déjà présent reste mobile.',
  'support-slide':'Le chant peut faire glisser un appui d’une case d’eau vers une autre. Il ne remonte pas sur le sol et n’est pas une cible des miroirs.',
  'support-anchor':'Un appui occupé par un héros reste ancré. Celui sur lequel le Barde va poser le pied reste également en place pendant ce pas : protège un appui pour déplacer les autres.',
  'mirror-motion':'Les miroirs ne suivent pas le chant. Tire-les avec le Voleur : leur orientation reste fixe, mais leurs axes et les arrivées se déplacent.',
  mirror:'Espace / X active les miroirs sans chant ni traction. Le candidat le plus proche a priorité ; à distance égale les deux échangent. Les marques gris clair annoncent les arrivées.',
  gate:'Les + roses sont des boutons. Héros, caisse, monstre ou miroir peuvent les maintenir, tout comme une porte fermée sur leur case. Tous les boutons d’un même circuit doivent être occupés ; observe les repères de couleur.',
  press:'Une porte qui se ferme pousse dans le sens de son repère. Elle peut déposer une caisse hors de portée d’une traction ou déplacer un héros sans déclencher son pouvoir.',
  monster:'Les monstres frappent leurs voisins orthogonaux après une action effective. Deux monstres voisins se tuent simultanément. Une diagonale est sûre ; un monstre dans l’eau sans appui ni plateforme déployée disparaît.',
  goals:'Occupe les deux contours jaunes en même temps. Le premier héros arrivé reste sélectionnable et peut encore aider son partenaire.',
};
export function lessonPrompt(learned: ReadonlySet<HarmonyLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les dix-sept découvertes sont acquises. Combine traction, chant, appuis protégés et reflets pour préparer le départ des deux héros.';
}

export function heroSelection(frame: number[][], kind?: HeroKind): Point | undefined {
  const hero = visibleHeroes(frame).find(candidate => kind ? candidate.kind === kind : !candidate.selected);
  return hero && !hero.selected ? { x: 3 + hero.x * 3, y: 3 + hero.y * 3 } : undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final),song=songView(before,next,action),pull=pulled(before,next,action);
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les deux destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Aucun chant ni traction ne se déclenche.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs en conflit clignotent en rouge. Déplace un miroir ou libère son axe.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :pull==='hero'?'Le Voleur entraîne le Barde sans déclencher son chant.'
    :pull?'Le Voleur recule : un seul occupant adjacent entre dans la case quittée.'
    :released(before,next,action)?'Le pas latéral laisse la prise en place.'
    :song?.escorted?'Le chant entraîne aussi le Voleur, sans déclencher sa traction.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :!changed?selected?.kind==='bard'?'Le pas est refusé. Vérifie la prochaine case du Barde et les appuis de son partenaire et des miroirs.':'Le Voleur ne peut pas avancer. Il ne pousse pas : change de côté ou de personnage.'
    :selected?.kind==='bard'?'Le Barde avance. Aucune pièce de son aura n’a pu le suivre.':'';
}
