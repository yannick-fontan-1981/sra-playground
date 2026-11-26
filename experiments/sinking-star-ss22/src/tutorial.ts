import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ['select','move','merchant-push','warrior-push','file-push','mixed-file','thief-pull','single-pull','partner-push','partner-pull','mirror-motion','relay-weight','release-by-pull','monster-still','bard-song','partner-song','selective-song','diagonal-song','wall-song','monster-song','water-support','support-slide','support-anchor','cross-support','mirror','hero-reflection','crate-reflection','button','gate','press','monster-press','monster','goals'] as const;
export type GalleryLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==8&&center!==14&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':center===8?'warrior':center===14?'thief':'bard',selected:arms.includes(0)});
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
/** Count the observed contiguous file only after the Warrior visibly advanced. */
function pushLength(before:LessonObservation,after:LessonObservation,action:number):number {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='warrior')return 0;
  const actors:Point[]=[...visiblePieces(before.frame).filter(p=>p.kind!=='support'),...visibleHeroes(before.frame).filter(h=>h.kind!=='warrior')];
  let count=0;
  while(actors.some(p=>p.x===view.hero.x+(count+1)*view.dx&&p.y===view.hero.y+(count+1)*view.dy))count++;
  return count;
}
/** One frontal occupant follows the Merchant; one rear occupant follows the Thief. */
function handling(before:LessonObservation,after:LessonObservation,action:number,kind:'merchant'|'thief'):{partner?:HeroKind;mirror:boolean;single:boolean;from:Point;view:NonNullable<ReturnType<typeof movementView>>}|null {
  const view=movementView(before,after,action);if(!view||view.hero.kind!==kind)return null;
  const sign=kind==='merchant'?1:-1,from={x:view.hero.x+sign*view.dx,y:view.hero.y+sign*view.dy};
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,from));
  const partner=visibleHeroes(before.frame).find(h=>h.kind!==kind&&sameCell(h,from));
  const to={x:from.x+view.dx,y:from.y+view.dy};
  if(!piece&&!partner)return null;
  const visibleArrival=partner?visibleHeroes(view.frame).some(h=>h.kind===partner.kind&&sameCell(h,to))
    :visiblePieces(view.frame).some(p=>(p.kind===piece!.kind||(piece!.kind==='stone'&&p.kind==='support'))&&sameCell(p,to));
  if(!visibleArrival)return null;
  const further={x:from.x+sign*view.dx,y:from.y+sign*view.dy};
  const second=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,further));
  const single=!!second&&visiblePieces(view.frame).some(p=>samePiece(second,p));
  return {...(partner?{partner:partner.kind}:{}),mirror:piece?.kind==='mirror',single,from,view};
}
function unoccupiedButtons(frame:number[][]):Point[] {
  const cells:Point[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3;
    if([frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]].every(c=>c===3)
      &&[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]].every(c=>c===7))cells.push({x,y});
  }
  return cells;
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
  const partners=visibleHeroes(before.frame).filter(h=>h.kind!=='bard'),laterHeroes=visibleHeroes(view.frame);
  const escorted=partners.some(companion=>{const other=laterHeroes.find(h=>h.kind===companion.kind);return !!other&&other.x===companion.x+view.dx&&other.y===companion.y+view.dy;});
  return {moved,held,slid:moved.some(p=>p.kind==='support'),escorted};
}
/** A press is inferred from a newly exposed closed gate at a displaced actor's
 * old cell, after the first displayed movement has ended. Combat disappearance,
 * hydraulic withdrawal and the initial voluntary movement are not a press. */
function pressedActor(before:LessonObservation,after:LessonObservation,kind?:'monster'):boolean {
  const frames=sameLevelFrames(before,after),early=frames[2];
  if(!early||frames.length<6)return false;
  const oldActors=[...visibleHeroes(early),...visiblePieces(early).filter(p=>p.kind!=='support')];
  const oldGates=gateCells(early);
  for(const frame of frames.slice(3)){
    const closed=gateCells(frame),actors=[...visibleHeroes(frame),...visiblePieces(frame)];
    for(const from of oldActors){
      if(kind&&from.kind!==kind)continue;
      const cell=from.y*20+from.x;
      if(closed.get(cell)!==5||oldGates.get(cell)===5)continue;
      if(from.kind==='monster'&&frames.length===6){
        const px=2+from.x*3,py=2+from.y*3;
        const shifted=(frame:number[][],dx:number,dy:number,n:number):boolean=>[0,1,2].every(y=>[0,1,2].every(x=>frame[py+y+dy*n]?.[px+x+dx*n]===early[py+y]![px+x]));
        if([[0,-1],[0,1],[-1,0],[1,0]].some(([dx,dy])=>shifted(frames[3]!,dx!,dy!,1)&&shifted(frames[4]!,dx!,dy!,2)))return true;
      }
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
export function observeLesson(learned:Set<GalleryLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL)return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const view=movementView(before,after,action),song=songView(before,after,action);
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame),early=sameLevelFrames(before,after)[2]??final;
  if(view)learned.add('move');
  const pushed=handling(before,after,action,'merchant'),pulled=handling(before,after,action,'thief');
  if(pushed)learned.add('merchant-push');
  const file=pushLength(before,after,action);
  if(file)learned.add('warrior-push');
  if(file>1)learned.add('file-push');
  if(view&&file&&initialHeroes.some(h=>h.kind!=='warrior'
    &&(view.dx===0?h.x===view.hero.x:h.y===view.hero.y)
    &&(h.x-view.hero.x)*view.dx+(h.y-view.hero.y)*view.dy>0
    &&(h.x-view.hero.x)*view.dx+(h.y-view.hero.y)*view.dy<=file)){
    learned.add('partner-push');if(file>1)learned.add('mixed-file');
  }
  if(pulled)learned.add('thief-pull');
  if(pulled?.single)learned.add('single-pull');
  if(pulled?.partner)learned.add('partner-pull');
  if(pulled?.partner==='bard'&&initial.some(p=>(p.kind==='stone'||p.kind==='monster')&&Math.max(Math.abs(p.x-pulled.from.x),Math.abs(p.y-pulled.from.y))<=2&&visiblePieces(pulled.view.frame).some(q=>samePiece(p,q))))learned.add('release-by-pull');
  if((pushed?.partner&&plateAt(before.frame,pushed.from))||(pulled&&plateAt(before.frame,pulled.view.hero)))learned.add('relay-weight');
  const initialMonsters=initial.filter(p=>p.kind==='monster');
  if(view&&initialMonsters.length&&sameLevelFrames(before,after).every(frame=>{
    const pieces=visiblePieces(frame);
    return initialMonsters.every(p=>pieces.some(q=>q.kind==='monster'&&sameCell(p,q)));
  }))learned.add('monster-still');
  if(pushed?.partner)learned.add('partner-push');
  if(pushed?.mirror||pulled?.mirror)learned.add('mirror-motion');
  if(view&&initial.some(p=>p.kind==='support'&&sameCell(p,view.later)))learned.add('cross-support');
  if(song?.moved.length||song?.escorted)learned.add('bard-song');
  if(song?.moved.some(p=>p.kind==='monster'))learned.add('monster-song');
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
      &&[0,1,2].some(dy=>[0,1,2].some(dx=>before.frame[2+p.y*3+dy]![2+p.x*3+dx]===9))))learned.add('water-support');
    for(const [cell,value] of gateCells(frame))if((gates.has(cell)&&gates.get(cell)!==value)||(!gates.has(cell)&&value===5))learned.add('gate');
  }
  const later=visiblePieces(final);
  if(reflected(before,after,action)){
    learned.add('mirror');
    if(initialHeroes.some(h=>!sameCell(h,currentHeroes.find(q=>q.kind===h.kind))))learned.add('hero-reflection');
    if(initial.some(p=>p.kind==='stone'&&!later.some(q=>samePiece(p,q))))learned.add('crate-reflection');
  }
  if(unoccupiedButtons(before.frame).some(p=>[...later,...currentHeroes].some(q=>q.kind!=='support'&&sameCell(p,q))))learned.add('button');
  if(pressedActor(before,after)){learned.add('press');learned.add('gate');}
  if(pressedActor(before,after,'monster'))learned.add('monster-press');
  if(visiblePieces(final).filter(p=>p.kind==='monster').length<initial.filter(p=>p.kind==='monster').length)learned.add('monster');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<GalleryLesson,string>={
  "select": "Clique sur un héros, utilise Tab ou 1 / 2 / 3 / 4. Marchand orange, Guerrier rouge, Voleur vert et Barde magenta : changer la sélection ne déplace aucune pièce.",
  "move": "Le point blanc désigne le héros sélectionné. Une flèche fait avancer ce héros et peut déclencher sa capacité : pousser, tirer ou chanter.",
  "merchant-push": "Le Marchand pousse une seule pièce devant lui. Il faut une case libre derrière elle ; deux occupants alignés bloquent sa poussée. Le Guerrier peut pousser leur file ; le Voleur ou le Barde peut les séparer.",
  "warrior-push": "Le Guerrier rouge pousse caisses, miroirs, monstres et partenaires. Il reste vulnérable aux monstres ; prépare son accès au bon côté de la pièce.",
  "file-push": "Le Guerrier pousse toute la file contiguë d’une case. Une butée à son extrémité bloque l’ensemble ; une arrivée dans l’eau peut transformer la dernière caisse en appui.",
  "mixed-file": "Une file peut mêler caisses et partenaires. Le Barde poussé ne chante pas, le Voleur poussé ne tire rien : le déplacement imposé préserve leurs charges.",
  "thief-pull": "Le Voleur avance sur une case libre et tire la pièce juste derrière lui sur la case qu’il quitte. Prépare le côté de départ et le côté d’arrivée.",
  "single-pull": "Le Voleur ne tire que son voisin arrière. Une deuxième pièce alignée reste sur place : ce geste permet de séparer un petit groupe.",
  "partner-push": "Le Marchand peut pousser le Voleur ou le Barde. Le partenaire déplacé ne tire rien et ne chante pas.",
  "partner-pull": "Le Voleur peut tirer un partenaire. Une arrivée imposée ne déclenche pas sa capacité : tire le Barde pour laisser son cortège sur place.",
  "mirror-motion": "Marchand, Guerrier et Voleur déplacent les miroirs sans changer leur orientation. Leurs axes et les arrivées prévues suivent ce déplacement. Le chant laisse les miroirs immobiles.",
  "relay-weight": "Une poussée peut remplacer un partenaire sur son bouton ; une traction peut déposer une caisse sur le bouton que quitte le Voleur. Le circuit reste ainsi chargé pendant la relève.",
  "release-by-pull": "Après le chant, tire le Barde depuis le bon côté. Ses caisses et ses appuis restent en place pendant ce déplacement imposé.",
  "monster-still": "Un monstre reste sur sa case tant qu’une poussée, une traction, un chant, un reflet ou une presse ne le déplace pas. Observe la cause visible.",
  "bard-song": "Le pas du Barde entraîne les pièces et les partenaires dans son carré de 5 × 5. La portée se mesure avant le pas ; les miroirs ne suivent jamais.",
  "partner-song": "Le Marchand, le Guerrier et le Voleur peuvent suivre le chant. Ils ne poussent ni ne tirent pendant ce déplacement imposé.",
  "selective-song": "Une butée retient certaines pièces tandis que les autres avancent. Utilise ces différences pour changer les écarts du groupe.",
  "diagonal-song": "Les coins du carré pointillé comptent aussi : une pièce à deux cases horizontalement et deux verticalement peut suivre le chant.",
  "wall-song": "Le chant traverse les cloisons. Une pièce derrière un mur peut bouger si sa propre arrivée est libre.",
  "monster-song": "Un monstre dans le carré pointillé peut suivre le pas du Barde. Prépare son arrivée et protège les autres héros.",
  "water-support": "Une caisse envoyée dans l’eau nue devient un appui marqué d’un X cyan. Une caisse posée sur un soutien existant reste mobile.",
  "support-slide": "Le chant peut déplacer un appui d’eau en eau. Marchand et Voleur ne peuvent ni le pousser ni le tirer ; il ne se reflète pas.",
  "support-anchor": "Un héros sur un appui l’ancre pendant le pas. L’appui où va arriver le Barde est également protégé. Cela permet de conserver un passage et d’en déplacer un autre.",
  "cross-support": "Les appuis portent les quatre héros. Le Marchand et le Voleur peuvent les traverser sans les déplacer ; leur présence peut servir d’ancre au chant.",
  "mirror": "Espace / X active les miroirs ensemble. L’occupant le plus proche est prioritaire ; à distance égale, les deux occupants échangent leurs places.",
  "hero-reflection": "Un héros transporté par reflet ne déclenche ni poussée, ni traction, ni chant. Prépare son arrivée grâce à la marque gris clair.",
  "crate-reflection": "Le contour gris clair indique une arrivée de caisse. Les reflets peuvent préparer une charge avant le passage des héros.",
  "button": "Le plus rose sur fond gris est un bouton ; son centre indique le circuit. Héros, caisses, monstres et miroirs font poids, mais pas les appuis immergés.",
  "gate": "Tous les boutons du même circuit doivent être occupés ensemble. Observe si la porte se ferme à l’appui ou au relâchement : centre noir fermé, gris ouvert.",
  "press": "Une presse qui se ferme pousse l’occupant de sa propre case et la file éventuelle devant lui. Le sens est indiqué par le repère coloré.",
  "monster-press": "Fermer une presse sur un monstre le transporte. Une porte qui s’ouvre ne fait pas avancer un monstre voisin.",
  "monster": "Les contacts par un côté restent dangereux, même pour un héros inactif. Deux monstres voisins s’éliminent simultanément. Organise la rencontre à distance.",
  "goals": "Place les quatre héros sur les quatre contours jaunes ensemble. Prépare les poids qui doivent rester et les départs sans chant ni traction parasite."
};
export function lessonPrompt(learned: ReadonlySet<GalleryLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les trente-trois découvertes sont acquises. Coordonne poussées, tractions, chants et reflets pour organiser les derniers départs.';
}

export function heroSelection(frame:number[][],kind?:HeroKind):Point|undefined {
  const all=visibleHeroes(frame),order:HeroKind[]=['merchant','warrior','thief','bard'];
  const current=all.find(h=>h.selected)?.kind;
  const target=kind??order[(order.indexOf(current??'merchant')+1)%order.length];
  const hero=all.find(h=>h.kind===target);
  return hero&&!hero.selected?{x:3+hero.x*3,y:3+hero.y*3}:undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final),song=songView(before,next,action);
  const pushed=handling(before,next,action,'merchant'),pulled=handling(before,next,action,'thief'),file=pushLength(before,next,action);
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les quatre destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres restent en place.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Les capacités ne se déclenchent pas.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs responsables clignotent en rouge. Vérifie leurs axes et les arrivées.'
    :action===5?'Aucun reflet possible. Vérifie les faces blanches, les occupants et leurs arrivées.'
    :pressedActor(before,next,'monster')?'La presse s’est refermée sur le monstre et l’a poussé dans le sens de son repère.'
    :pressedActor(before,next)?'Une presse s’est refermée et a déplacé son occupant.'
    :file>1?`Le Guerrier pousse la file de ${file} occupants, sans activer les capacités des partenaires.`
    :file?'Le Guerrier pousse un occupant d’une case.'
    :pulled?.partner==='bard'?'Le Voleur tire le Barde sans déclencher son chant.'
    :pulled?.partner?'Le Voleur tire son partenaire sans activer sa capacité.'
    :pulled?.mirror?'Le Voleur tire le miroir ; son orientation reste la même.'
    :pulled?'Une pièce tirée depuis l’arrière. Les autres restent en place.'
    :pushed?.partner?'Le Marchand pousse son partenaire sans activer sa capacité.'
    :pushed?.mirror?'Le Marchand déplace le miroir ; son orientation reste la même.'
    :pushed?'Le Marchand pousse une seule pièce.'
    :song?.moved.some(p=>p.kind==='monster')?'Le chant déplace le monstre ; il reste ensuite sur sa case.'
    :song?.escorted?'Le chant entraîne aussi un partenaire, sans déclencher sa capacité.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :!changed?selected?.kind==='warrior'?'Le pas est bloqué. Vérifie l’extrémité de la file et l’arrivée de chacun de ses occupants.':selected?.kind==='merchant'?'Le pas est bloqué. Le Marchand pousse une seule pièce vers une case libre.':selected?.kind==='thief'?'Le pas est bloqué. Le Voleur doit avoir une case libre devant lui pour tirer depuis l’arrière.':'Le pas est refusé. Vérifie l’arrivée du Barde et les appuis des héros et des miroirs.'
    :selected?.kind==='warrior'?'Le Guerrier avance sur une case libre.':selected?.kind==='bard'?'Le Barde avance ; aucune pièce de sa portée n’a pu suivre.':selected?.kind==='merchant'?'Le Marchand avance sur une case libre.':'Le Voleur avance sans pièce à tirer derrière lui.';
}
