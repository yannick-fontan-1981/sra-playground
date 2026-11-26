import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 1;
export const lessonIds = ["select", "move", "merchant-push", "thief-pull", "single-pull", "partner-pull", "release-by-pull", "partner-push", "mirror-motion", "relay-weight", "monster-still", "wizard-swap", "wizard-first", "wizard-partner", "wizard-bend", "wizard-water", "wizard-walk", "bard-song", "partner-song", "selective-song", "diagonal-song", "wall-song", "monster-song", "release-by-swap", "water-support", "support-slide", "support-anchor", "cross-support", "mirror", "hero-reflection", "crate-reflection", "button", "gate", "press", "monster-press", "monster", "goals"] as const;
export type GalleryLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==12&&center!==14&&center!==15&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===12?'merchant':center===14?'thief':center===15?'wizard':'bard',selected:arms.includes(0)});
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
/** A reciprocal exchange is recognized from public sprites, including adjacent swaps. */
function wizardSwap(before:LessonObservation,after:LessonObservation,action:number):{bent:boolean;partner:boolean;partnerKind?:HeroKind;first:boolean;water:boolean}|null {
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
  const bent=illuminatedMirror||(hero.x!==later.x&&hero.y!==later.y);
  const dx=Math.sign(later.x-hero.x),dy=Math.sign(later.y-hero.y),distance=Math.abs(later.x-hero.x)+Math.abs(later.y-hero.y);
  const targets=[...visiblePieces(before.frame).filter(p=>p.kind==='stone'||p.kind==='monster'),...visibleHeroes(before.frame).filter(h=>h.kind!=='wizard')];
  const initialGates=gateCells(before.frame),mirrors=visiblePieces(before.frame).filter(p=>p.kind==='mirror');
  const first=!bent&&targets.some(p=>{
    const farther=(p.x-hero.x)*dx+(p.y-hero.y)*dy;
    if(!(dx===0?p.x===hero.x:p.y===hero.y)||farther<=distance)return false;
    for(let n=distance+1;n<farther;n++){
      const at={x:hero.x+dx*n,y:hero.y+dy*n};
      if(before.frame[3+3*at.y]?.[3+3*at.x]===4||initialGates.get(at.y*20+at.x)===5||mirrors.some(m=>sameCell(m,at)))return false;
    }
    return true;
  });
  const water=!bent&&Array.from({length:Math.max(0,distance-1)},(_,i)=>({x:hero.x+dx*(i+1),y:hero.y+dy*(i+1)})).some(p=>{
    const px=2+3*p.x,py=2+3*p.y;
    return [before.frame[py]?.[px],before.frame[py+1]?.[px+1],before.frame[py+2]?.[px+2]].every(c=>c===9);
  });
  return exchanged?{bent,partner:!!companion,...(companion?{partnerKind:companion.kind}:{}),first,water}:null;
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

export function observeLesson(learned:Set<GalleryLesson>,before:LessonObservation,after:LessonObservation,action:number):void {
  if(before.level!==TUTORIAL_LEVEL||returnedRay(before,after,action))return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const view=movementView(before,after,action),song=songView(before,after,action),swapped=wizardSwap(before,after,action);
  const initial=visiblePieces(before.frame),later=visiblePieces(final),gates=gateCells(before.frame);
  if(view&&!swapped)learned.add('move');
  if(swapped)learned.add('wizard-swap');
  if(swapped?.first)learned.add('wizard-first');
  if(swapped?.partner)learned.add('wizard-partner');
  if(swapped?.bent)learned.add('wizard-bend');
  if(swapped?.water)learned.add('wizard-water');
  if(view?.hero.kind==='wizard'&&!swapped)learned.add('wizard-walk');
  const pushed=handling(before,after,action,'merchant'),pulled=handling(before,after,action,'thief');
  if(pushed)learned.add('merchant-push');
  if(pulled)learned.add('thief-pull');
  if(pulled?.single)learned.add('single-pull');
  if(pulled?.partner)learned.add('partner-pull');
  if(pulled?.partner==='bard'&&initial.some(p=>(p.kind==='stone'||p.kind==='monster'||p.kind==='support')
    &&Math.max(Math.abs(p.x-pulled.from.x),Math.abs(p.y-pulled.from.y))<=2
    &&visiblePieces(pulled.view.frame).some(q=>samePiece(p,q))))learned.add('release-by-pull');
  if(pushed?.partner)learned.add('partner-push');
  if((pushed?.partner&&plateAt(before.frame,pushed.from))||(pulled&&plateAt(before.frame,pulled.view.hero))
    ||(swapped&&initialHeroes.some(h=>h.kind==='wizard'&&plateAt(before.frame,h))))learned.add('relay-weight');
  if(swapped?.partnerKind==='bard'){
    const bard=initialHeroes.find(h=>h.kind==='bard')!;
    const early=sameLevelFrames(before,after)[2]??final,end=visiblePieces(early);
    if(initial.some(p=>(p.kind==='stone'||p.kind==='monster'||p.kind==='support')
      &&Math.max(Math.abs(p.x-bard.x),Math.abs(p.y-bard.y))<=2&&end.some(q=>samePiece(p,q))))learned.add('release-by-swap');
  }
  const initialMonsters=initial.filter(p=>p.kind==='monster');
  if(view&&!swapped&&initialMonsters.length&&sameLevelFrames(before,after).every(frame=>initialMonsters.every(p=>visiblePieces(frame).some(q=>q.kind==='monster'&&sameCell(p,q)))))learned.add('monster-still');
  if(pushed?.mirror||pulled?.mirror)learned.add('mirror-motion');
  if(view&&!swapped&&initial.some(p=>p.kind==='support'&&sameCell(p,view.later)))learned.add('cross-support');
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
  if(reflected(before,after,action)){
    learned.add('mirror');
    if(initialHeroes.some(h=>!sameCell(h,currentHeroes.find(q=>q.kind===h.kind))))learned.add('hero-reflection');
    if(initial.some(p=>p.kind==='stone'&&!later.some(q=>samePiece(p,q))))learned.add('crate-reflection');
  }
  if(unoccupiedButtons(before.frame).some(p=>[...later,...currentHeroes].some(q=>q.kind!=='support'&&sameCell(p,q))))learned.add('button');
  if(pressedActor(before,after)){learned.add('press');learned.add('gate');}
  if(pressedActor(before,after,'monster'))learned.add('monster-press');
  if(later.filter(p=>p.kind==='monster').length<initial.filter(p=>p.kind==='monster').length)learned.add('monster');
  if(after.levelsCompleted>before.levelsCompleted)learned.add('goals');
}

const hints:Record<GalleryLesson,string>={
  "select": "Clique sur un héros, utilise Tab ou 1 / 2 / 3 / 4 : Marchand orange, Voleur vert, Magicien violet, Barde magenta. Changer la sélection ne fait pas avancer le monde.",
  "move": "Le point blanc désigne le héros actif. La même flèche peut faire marcher, pousser, échanger ou chanter : observe qui agit et ce qui reste en place.",
  "merchant-push": "Le Marchand pousse un seul occupant vers une case libre. Deux pièces contiguës bloquent sa poussée ; le Voleur peut en extraire une, le Magicien ou le Barde peut en changer la disposition.",
  "thief-pull": "Le Voleur avance sur une case libre et tire la pièce juste derrière lui sur la case qu’il quitte. Prépare le côté de départ et le côté d’arrivée.",
  "single-pull": "Le Voleur ne tire que son voisin arrière. Une deuxième pièce alignée reste sur place : ce geste permet de séparer un petit groupe.",
  "partner-pull": "Le Voleur peut tirer un partenaire. Une arrivée imposée ne déclenche pas sa capacité : tire le Barde pour laisser son cortège sur place.",
  "release-by-pull": "Après le chant, tire le Barde depuis le bon côté. Ses caisses et ses appuis restent en place pendant ce déplacement imposé.",
  "partner-push": "Pousser un partenaire permet de le replacer sans déclencher sa capacité. C’est une manière de déplacer le Magicien sans viser ni échanger.",
  "mirror-motion": "Le Marchand pousse les miroirs et le Voleur les tire sans tourner leur face. Leurs axes et leurs arrivées se déplacent avec eux. Le chant ne les entraîne pas.",
  "relay-weight": "Une poussée peut remplacer un partenaire sur un bouton. Un échange conserve un occupant à chacune de ses extrémités : les commandes peuvent rester maintenues pendant la relève.",
  "monster-still": "Un monstre reste sur sa case sans transport explicite. Les sélections ne font pas avancer les mécanismes ; un déplacement vient d’une cause visible.",
  "wizard-swap": "Une flèche du Magicien vise la première caisse, le premier monstre ou le premier partenaire dans sa ligne. Le Magicien et sa cible échangent leurs places ; les appuis immergés ne sont pas des cibles.",
  "wizard-first": "La première cible arrête le rayon. Une caisse proche masque ce qui se trouve derrière : prépare la visée avant de choisir ta direction.",
  "wizard-partner": "Un échange donne à un partenaire une nouvelle place de travail sans activer son pouvoir. Chaque extrémité reste occupée ; un échange seul ne peuple pas une île vide.",
  "wizard-bend": "La face blanche d’un miroir dévie le rayon à angle droit ; son dos noir l’arrête. Plusieurs miroirs peuvent le relayer. Un rayon qui revient au Magicien le fait clignoter sans déplacer la salle.",
  "wizard-water": "Le rayon traverse l’eau nue pour échanger des occupants sur des arrivées sûres. Cette traversée ne construit aucun passage pour les autres héros.",
  "wizard-walk": "Sans cible accessible dans la direction choisie, le Magicien tente un pas ordinaire. La présence d’une cible lointaine change donc l’effet de la même flèche.",
  "bard-song": "Un pas du Barde entraîne les occupants admissibles de son carré de 5 × 5, mesuré avant le pas. Les miroirs ne suivent pas ; un Barde bloqué annule le geste.",
  "partner-song": "Le chant peut entraîner les trois partenaires sans leur capacité : le Voleur ne tire pas son voisin arrière et le Magicien ne lance pas un nouvel échange.",
  "selective-song": "Une butée retient une partie du groupe pendant que le reste avance. Choisis le poste du Barde et le sens du pas pour changer la forme du chargement.",
  "diagonal-song": "Les coins du carré comptent : une pièce à deux cases horizontalement et deux verticalement peut suivre le chant.",
  "wall-song": "Le chant traverse les cloisons. Il ne traverse pas les obstacles pour les pièces : chacune doit encore disposer d’une arrivée possible.",
  "monster-song": "Un monstre dans la portée peut suivre le chant. Prépare sa destination et vérifie les voisins de tous les héros après le transport.",
  "release-by-swap": "Échange le Magicien avec le Barde pour extraire celui-ci sans chanter. Ses caisses et ses appuis restent en place pendant ce transport imposé.",
  "water-support": "Une caisse déposée dans l’eau nue devient un appui marqué d’un X cyan. Une caisse placée sur un appui existant reste mobile.",
  "support-slide": "Le Barde déplace un appui libre d’eau en eau. L’appui ne se pousse, ne se tire, ne se reflète et ne s’échange pas ; il ne transporte aucun passager.",
  "support-anchor": "Un héros sur un appui l’ancre pendant le chant. L’appui d’arrivée du Barde est également protégé. Échanger les occupants peut changer l’ancrage sans faire chanter le Barde.",
  "cross-support": "Les appuis portent les quatre héros. Un occupant qui les traverse ne les extrait pas de l’eau ; sa présence peut les protéger pendant un chant.",
  "mirror": "Espace / X active les miroirs ensemble. L’occupant le plus proche est prioritaire ; à distance égale, les deux occupants échangent leurs places.",
  "hero-reflection": "Un héros transporté par reflet n’active ni poussée, ni chant, ni sort. La marque gris clair permet de préparer son arrivée.",
  "crate-reflection": "Le contour gris clair indique une arrivée de caisse. Un reflet transporte la charge en conservant sa distance au miroir.",
  "button": "Le plus rose sur fond gris est une commande. Héros, caisses, monstres et miroirs font poids ; un appui immergé ne fait pas poids.",
  "gate": "Tous les boutons d’un circuit doivent être occupés ensemble. Observe si sa porte se ferme à l’appui ou au relâchement : centre noir fermé, gris ouvert.",
  "press": "Une presse qui se ferme pousse l’occupant de sa propre case et la file devant lui. Son repère indique le sens ; une file bloquée peut subir un écrasement.",
  "monster-press": "Une presse transporte le monstre présent sur sa case à sa fermeture. Ouvrir une porte ne fait pas avancer un monstre voisin.",
  "monster": "Les voisins orthogonaux sont dangereux, y compris pour les héros inactifs. Deux monstres voisins s’éliminent simultanément et attaquent encore pendant cette vague.",
  "goals": "Réunis les quatre héros vivants sur les quatre contours jaunes. Les découvertes guident l’apprentissage ; elles ne constituent pas une condition cachée de victoire."
};
export function lessonPrompt(learned:ReadonlySet<GalleryLesson>):string {
  const next=lessonIds.find(id=>!learned.has(id));
  return next?hints[next]:`Les ${lessonIds.length} découvertes sont acquises. Compose les échanges, les poussées, les tractions, les chants et les reflets pour réunir les quatre héros.`;
}

export function heroSelection(frame:number[][],kind?:HeroKind):Point|undefined {
  const all=visibleHeroes(frame),order:HeroKind[]=['merchant','thief','wizard','bard'];
  const current=all.find(h=>h.selected)?.kind;
  const target=kind??order[(order.indexOf(current??'merchant')+1)%order.length];
  const hero=all.find(h=>h.kind===target);
  return hero&&!hero.selected?{x:3+hero.x*3,y:3+hero.y*3}:undefined;
}

export function actionFeedback(before:LessonObservation,next:LessonObservation&{state:string},action:number):string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),end=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,end),song=songView(before,next,action),swap=wizardSwap(before,next,action);
  const pushed=handling(before,next,action,'merchant'),pulled=handling(before,next,action,'thief');
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les quatre destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Les mécanismes et les monstres restent en place.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Les capacités ne se déclenchent pas.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs responsables clignotent en rouge. Vérifie leurs axes et les arrivées.'
    :action===5?'Aucun reflet possible. Vérifie les faces blanches, les occupants et leurs arrivées.'
    :returnedRay(before,next,action)?'Le rayon revient au Magicien : il clignote et reste sur place. Aucun mécanisme ne progresse.'
    :pressedActor(before,next,'monster')?'La presse a poussé le monstre. Observe la destination et la fin de la cascade.'
    :pressedActor(before,next)?'Une presse s’est refermée et a déplacé son occupant.'
    :swap?.partnerKind==='bard'?'Le Magicien échange sa place avec le Barde ; les autres pièces ne suivent pas ce transport.'
    :swap?.bent?'Le rayon dévié atteint sa première cible : elle échange sa place avec le Magicien.'
    :swap?.partner?'Le Magicien et son partenaire échangent leurs places sans déclencher de capacité secondaire.'
    :swap?'Le Magicien échange sa place avec la première cible de son rayon.'
    :pulled?.partner==='bard'?'Le Voleur tire le Barde sans déclencher son chant.'
    :pulled?.partner?'Le Voleur tire son partenaire sans activer sa capacité.'
    :pulled?.mirror?'Le Voleur tire le miroir ; son orientation reste la même.'
    :pulled?'Une pièce tirée depuis l’arrière. Les autres restent en place.'
    :pushed?.partner?'Le Marchand pousse son partenaire sans activer sa capacité.'
    :pushed?.mirror?'Le Marchand déplace le miroir ; son orientation reste la même.'
    :pushed?'Le Marchand pousse une seule pièce.'
    :song?.moved.some(p=>p.kind==='monster')?'Le chant déplace le monstre ; il reste ensuite sur sa case.'
    :song?.escorted?'Le chant entraîne aussi un partenaire, sans déclencher son pouvoir.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :!changed?selected?.kind==='wizard'?'Aucune cible échangeable ni aucun pas possible. Vérifie les murs, les dos des miroirs et la première cible.':selected?.kind==='thief'?'Le Voleur doit avoir une case libre devant lui pour tirer depuis l’arrière.':selected?.kind==='merchant'?'Le Marchand pousse un seul occupant vers une case libre.':'Le pas est refusé. Vérifie l’arrivée du Barde et les soutiens de tous les partenaires.'
    :selected?.kind==='wizard'?'Sans cible dans cette direction, le Magicien avance d’une case.':selected?.kind==='bard'?'Le Barde avance ; aucune pièce de sa portée n’a pu suivre.':'Le héros avance sur une case libre.';
}
