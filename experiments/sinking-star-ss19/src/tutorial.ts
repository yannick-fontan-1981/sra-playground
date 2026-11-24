import type { HeroKind, Observation, Point } from './core.js';

type LessonObservation = Pick<Observation, 'level' | 'frame' | 'frames' | 'levelsCompleted'>;
export const TUTORIAL_LEVEL = 2;
export const lessonIds = ['select','move','warrior-push','train-push','monster-still','partner-push','mirror-motion','wizard-swap','wizard-partner','wizard-bend','relay-weight','bard-song','partner-song','selective-song','diagonal-song','wall-song','monster-song','release-by-swap','water-support','support-slide','support-anchor','cross-support','mirror','hero-reflection','crate-reflection','button','gate','press','monster-press','monster','goals'] as const;
export type GalleryLesson = typeof lessonIds[number];

type VisibleHero=Point & {kind:HeroKind;selected:boolean};
type VisiblePiece=Point & {kind:'stone'|'monster'|'support'|'mirror'};
export const sameCell=(a:Point|undefined,b:Point|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
/** All tutorial tracking and role selection are derived from the public image. */
export function visibleHeroes(frame:number[][]):VisibleHero[] {
  const heroes:VisibleHero[]=[];
  for(let y=0;y<20;y++)for(let x=0;x<20;x++){
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    if(center!==8&&center!==15&&center!==6)continue;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(arms.filter(c=>c===center).length>=3)heroes.push({x,y,kind:center===8?'warrior':center===15?'wizard':'bard',selected:arms.includes(0)});
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
/** The contiguous frontal train moves with the Warrior; no hidden state is inspected. */
function warriorPush(before:LessonObservation,after:LessonObservation,action:number):{partner:boolean;mirror:boolean;count:number}|null {
  const view=movementView(before,after,action);if(!view||view.hero.kind!=='warrior')return null;
  const front={x:view.hero.x+view.dx,y:view.hero.y+view.dy};
  const piece=visiblePieces(before.frame).find(p=>p.kind!=='support'&&sameCell(p,front));
  const partner=visibleHeroes(before.frame).find(h=>h.kind!=='warrior'&&sameCell(h,front));
  let count=0;for(let n=1;n<=20;n++){const at={x:view.hero.x+view.dx*n,y:view.hero.y+view.dy*n};if(!visiblePieces(before.frame).some(p=>p.kind!=='support'&&sameCell(p,at))&&!visibleHeroes(before.frame).some(h=>sameCell(h,at)))break;count++;}
  return piece||partner?{partner:!!partner,mirror:piece?.kind==='mirror',count}:null;
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
  if(before.level!==TUTORIAL_LEVEL||returnedRay(before,after,action))return;
  const final=actionFrame(before,after),initialHeroes=visibleHeroes(before.frame),currentHeroes=visibleHeroes(final);
  const selected=initialHeroes.find(h=>h.selected),newSelected=currentHeroes.find(h=>h.selected);
  if(action===6&&selected&&newSelected&&selected.kind!==newSelected.kind)learned.add('select');
  const swap=wizardSwap(before,after,action),view=movementView(before,after,action),song=songView(before,after,action);
  const initial=visiblePieces(before.frame),gates=gateCells(before.frame),early=sameLevelFrames(before,after)[2]??final;
  if(view&&!swap)learned.add('move');
  const pushed=warriorPush(before,after,action);
  if(pushed)learned.add('warrior-push');
  if(pushed&&pushed.count>1)learned.add('train-push');
  const initialMonsters=initial.filter(p=>p.kind==='monster');
  if(view&&!swap&&initialMonsters.length&&sameLevelFrames(before,after).every(frame=>{
    const pieces=visiblePieces(frame);
    return initialMonsters.every(p=>pieces.some(q=>q.kind==='monster'&&sameCell(p,q)));
  }))learned.add('monster-still');
  if(pushed?.partner)learned.add('partner-push');
  if(pushed?.mirror)learned.add('mirror-motion');
  if(view&&initial.some(p=>p.kind==='support'&&sameCell(p,view.later)))learned.add('cross-support');
  if(swap){
    learned.add('wizard-swap');
    if(swap.bent)learned.add('wizard-bend');
    const oldWizard=initialHeroes.find(h=>h.kind==='wizard'),newWizard=visibleHeroes(early).find(h=>h.kind==='wizard');
    if((oldWizard&&plateAt(before.frame,oldWizard))||(newWizard&&plateAt(before.frame,newWizard)))learned.add('relay-weight');
    if(swap.partner){
      learned.add('wizard-partner');
      const bard=initialHeroes.find(h=>h.kind==='bard'),later=visiblePieces(early);
      if(bard&&!sameCell(bard,visibleHeroes(early).find(h=>h.kind==='bard'))&&initial.some(p=>(p.kind==='stone'||p.kind==='monster')&&Math.max(Math.abs(p.x-bard.x),Math.abs(p.y-bard.y))<=2&&later.some(q=>samePiece(p,q))))learned.add('release-by-swap');
    }
  }
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
  "select": "Clique sur un héros, utilise Tab ou 1 / 2 / 3. Guerrier rouge, Magicien violet, Barde magenta : la sélection ne fait avancer ni le décor ni les monstres.",
  "move": "Le point blanc désigne le héros sélectionné. Une même flèche peut marcher, pousser une file, échanger deux places ou entraîner un groupe.",
  "warrior-push": "Le Guerrier pousse toute une file contiguë : caisses, monstres, miroirs et partenaires. Prépare la place à son extrémité ; un obstacle bloque toute la poussée.",
  "train-push": "Une seule flèche peut pousser plusieurs occupants alignés. Vérifie le dernier : si sa destination est bloquée, personne ne bouge. Une caisse envoyée dans l’eau devient un appui.",
  "monster-still": "Les monstres restent sur leur case pendant tes déplacements. Ils bougent uniquement lorsqu’un pouvoir, un reflet ou une presse les déplace : repère cette cause sur la grille.",
  "monster-song": "Le carré pointillé du Barde montre sa portée. Si un monstre est dedans, le chant peut le déplacer dans le sens du pas. Prépare sa case d’arrivée et garde tes partenaires à distance.",
  "monster-press": "La fermeture d’une presse sur la case du monstre le pousse dans la direction indiquée. Ouvrir une porte ne le fait pas avancer. Bouton de commande, presse et destination sont des cases distinctes.",
  "partner-push": "Pousser le Magicien ne lance pas son sort ; pousser le Barde ne déclenche pas son chant. Déplace un partenaire de cette façon pour le dégager sans emporter son groupe.",
  "mirror-motion": "Le Guerrier peut déplacer un miroir sans changer son orientation. Ses deux axes et les arrivées prévues se déplacent avec lui ; le Barde ne fait pas chanter les miroirs.",
  "wizard-swap": "Une flèche du Magicien échange sa place avec la première caisse, le premier monstre ou le premier partenaire rencontré. Les cibles plus loin attendent. Sans cible, il tente un pas.",
  "wizard-partner": "Le Magicien peut échanger sa place avec chacun des deux partenaires. Le personnage déplacé ne déclenche ni poussée ni chant : une relève reste un seul échange.",
  "wizard-bend": "La face blanche dévie le rayon à angle droit ; le dos noir le bloque. Plusieurs miroirs peuvent relayer une visée. Flèches : transposition. Espace : reflet global.",
  "relay-weight": "Un échange remplace un poids par un autre sur chacune des deux cases. Une commande peut ainsi rester appuyée pendant que son premier occupant repart.",
  "bard-song": "Chaque pas du Barde entraîne les caisses, monstres, appuis et partenaires de son carré de 5 × 5. La portée est calculée avant le pas ; les miroirs ne suivent jamais.",
  "partner-song": "Le Guerrier et le Magicien peuvent être entraînés ensemble, sans activer leurs capacités. Vérifie la case d’arrivée de chacun : les trois héros doivent rester en sécurité.",
  "selective-song": "Une pièce retenue par une butée reste en place pendant que les autres avancent. Utilise les murs et les occupants immobiles pour modifier les écarts du groupe.",
  "diagonal-song": "Les quatre coins du carré font partie du chant : une pièce à deux cases horizontalement et deux verticalement peut suivre le Barde.",
  "wall-song": "Les murs ne coupent pas la portée du chant. Une pièce derrière une cloison peut suivre le Barde si sa propre case d’arrivée est libre.",
  "release-by-swap": "Après avoir posé un poids, fais échanger le Barde par le Magicien. Ce départ forcé laisse son cortège en place même si les pièces étaient encore dans sa portée.",
  "water-support": "Une caisse envoyée dans l’eau sans soutien devient un appui marron au X cyan. Elle cesse d’être une cible du Magicien. Une caisse posée sur un soutien reste mobile.",
  "support-slide": "Le chant peut faire glisser un appui d’une case d’eau vers une autre. Il ne remonte pas sur le sol et ne voyage pas par transposition ou reflet.",
  "support-anchor": "Un appui sous un héros reste ancré pendant le pas. Celui où le Barde va poser le pied reste aussi en place : protège le passage à conserver avant de déplacer les autres.",
  "cross-support": "Un appui porte les héros. Le Guerrier ou le Magicien peut le traverser sans le déplacer ; son occupation permet aussi de le protéger d’un chant voisin.",
  "mirror": "Espace / X active tous les miroirs. Le candidat le plus proche passe ; à distance égale les deux échangent. Les marques gris clair montrent les arrivées.",
  "hero-reflection": "Un héros transporté par un reflet ne déclenche pas sa capacité. Les miroirs peuvent redistribuer plusieurs personnages en une seule action.",
  "crate-reflection": "Les contours gris clair montrent les arrivées des caisses. Prépare le matériel avant les derniers départs ; une caisse et un héros peuvent se disputer le même passage.",
  "button": "Le plus rose sur fond gris est un bouton. Son centre donne le circuit. Héros, caisse, monstre et miroir peuvent servir de poids ; tous les boutons d’un circuit doivent être occupés.",
  "gate": "Les marques colorées relient les commandes aux portes. Certaines portes se ferment à l’appui, d’autres au relâchement : observe leur centre noir ou gris.",
  "press": "Une porte qui se ferme pousse dans le sens de son repère. Elle peut déplacer une caisse, un miroir ou un héros. Z annule le déplacement et toute sa cascade.",
  "monster": "Un monstre reste dangereux même immobile : un contact par un côté tue un héros, y compris inactif. Deux monstres voisins s’éliminent simultanément. Transporte-les à distance sûre avec les pouvoirs et les dispositifs.",
  "goals": "Occupe les trois contours jaunes ensemble. Les premiers arrivés restent sélectionnables. Prépare les remplaçants des poids et évite de déplacer un héros arrivé avec un chant voisin."
};
export function lessonPrompt(learned: ReadonlySet<GalleryLesson>): string {
  const next = lessonIds.find(id => !learned.has(id));
  return next ? hints[next] : 'Les trente et une découvertes sont acquises. Prépare les transports des gardiens, conserve les poids utiles et organise les derniers départs.';
}

export function heroSelection(frame:number[][],kind?:HeroKind):Point|undefined {
  const all=visibleHeroes(frame),order:HeroKind[]=['warrior','wizard','bard'];
  const current=all.find(h=>h.selected)?.kind;
  const target=kind??order[(order.indexOf(current??'warrior')+1)%order.length];
  const hero=all.find(h=>h.kind===target);
  return hero&&!hero.selected?{x:3+hero.x*3,y:3+hero.y*3}:undefined;
}

export function actionFeedback(before: LessonObservation, next: LessonObservation & { state: string }, action: number): string {
  const selected=visibleHeroes(before.frame).find(h=>h.selected),final=visibleHeroes(actionFrame(before,next)).find(h=>h.kind===selected?.kind);
  const changed=selected&&!sameCell(selected,final),song=songView(before,next,action),swap=wizardSwap(before,next,action);
  const pushed=warriorPush(before,next,action);
  const monsterPress=pressedActor(before,next,'monster');
  return next.state==='GAME_OVER'?'Un personnage a été perdu. Z annule toute la séquence ; R recommence la salle.'
    :next.levelsCompleted>before.levelsCompleted?'Les trois destinations sont occupées. Salle terminée !'
    :action===6?'Personnage sélectionné. Le décor et les monstres n’avancent pas.'
    :reflected(before,next,action)?'Reflet effectué : priorité au plus proche, échange à distance égale. Aucun chant ni sort ne se déclenche.'
    :mirrorInterference(before,next,action)?'Reflet bloqué : les miroirs responsables clignotent en rouge. Vérifie leurs axes et les arrivées.'
    :action===5?'Reflet bloqué ou aucun occupant devant les faces blanches. Vérifie les arrivées et tous les miroirs.'
    :returnedRay(before,next,action)?'Le rayon revient sur le Magicien : il clignote sur place, sans déplacer le monde.'
    :monsterPress?'Commande actionnée : la presse a poussé le monstre dans le sens de son repère.'
    :pressedActor(before,next)?'Commande actionnée : une presse s’est refermée et a déplacé son occupant.'
    :swap?.bent?'Échange par un rayon dévié : le Magicien et sa première cible ont changé de place.'
    :swap?.partner?'Le Magicien échange sa place avec un partenaire, sans déclencher sa capacité.'
    :swap?'Transposition : le Magicien et la première cible échangent leurs places.'
    :pushed?.partner?'Le Guerrier déplace un partenaire sans déclencher sa capacité.'
    :pushed?.mirror?'Le miroir change de position ; son orientation reste la même.'
    :pushed?`File poussée : ${pushed.count} occupant(s), sans activer les pouvoirs des partenaires.`
    :song?.moved.some(p=>p.kind==='monster')?'Le chant déplace le monstre dans le sens du pas du Barde. Il reste ensuite sur sa case.'
    :song?.escorted?'Le chant entraîne aussi un partenaire, sans déclencher sa capacité.'
    :song?.moved.length?`Le chant entraîne ${song.moved.length} pièce(s). ${song.held.length?'Les pièces retenues restent en place.':''}`
    :!changed?selected?.kind==='warrior'?'La poussée est bloquée. Il faut une place à l’extrémité de toute la file.':selected?.kind==='bard'?'Le pas est refusé. Vérifie la prochaine case du Barde et les appuis des héros et des miroirs.':'Aucun échange ni pas possible. Vérifie la première cible, les faces des miroirs et les arrivées.'
    :selected?.kind==='bard'?'Le Barde avance. Aucune pièce de sa portée n’a pu le suivre.':selected?.kind==='warrior'?'Le Guerrier avance sur une case libre.':'Le Magicien marche : aucune cible dans cet axe.';
}
