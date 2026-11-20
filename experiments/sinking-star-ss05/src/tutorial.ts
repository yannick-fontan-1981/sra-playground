import type { Observation } from './core.js';

export type BardLesson = 'move' | 'song' | 'anchor' | 'platform' | 'mirror' | 'gate';
type TutorialObservation = Pick<Observation, 'level' | 'frame' | 'frames'>;

type VisiblePiece = 'stone' | 'monster' | 'support';
type VisibleCell = {x: number; y: number; kind: VisiblePiece};
/** Teaching and feedback use only the public 64×64 image, never hidden game state. */
export function heroCell(frame: number[][]): {x: number; y: number} | undefined {
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const px=2+x*3,py=2+y*3;
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if (frame[py+1]![px+1]===6 && arms.filter(c=>c===6).length>=3) return {x,y};
  }
  return undefined;
}
function visiblePieces(frame: number[][]): VisibleCell[] {
  const cells: VisibleCell[]=[];
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) {
    const px=2+x*3,py=2+y*3,center=frame[py+1]![px+1];
    const arms=[frame[py]![px+1],frame[py+1]![px],frame[py+1]![px+2],frame[py+2]![px+1]];
    if(center===5 && arms.every(c=>c===13)) cells.push({x,y,kind:'stone'});
    else if(center===8 && arms.every(c=>c===5)) cells.push({x,y,kind:'monster'});
    else if(center===10 && arms.every(c=>c===13)) cells.push({x,y,kind:'support'});
  }
  return cells;
}
export const sameCell=(a:{x:number;y:number}|undefined,b:{x:number;y:number}|undefined):boolean=>!!a&&!!b&&a.x===b.x&&a.y===b.y;
const hasPiece=(cells:VisibleCell[],p:VisibleCell):boolean=>cells.some(c=>c.kind===p.kind&&sameCell(c,p));
function sameLevelFrames(before: TutorialObservation, after: TutorialObservation): number[][][] {
  // The last image after a completed room can belong to the next room.
  return after.level !== before.level ? after.frames.slice(0,-1) : after.frames;
}
export function actionFrame(before: TutorialObservation, after: TutorialObservation): number[][] {
  return sameLevelFrames(before,after).at(-1) ?? after.frame;
}
function openGateCells(frame: number[][]): Set<number> {
  const open=new Set<number>();
  for (let y=0;y<20;y++) for (let x=0;x<20;x++) {
    const px=2+x*3,py=2+y*3;
    const corners=[frame[py]![px],frame[py]![px+2],frame[py+2]![px],frame[py+2]![px+2]];
    if (corners.every(c=>c===7 || c===11) && frame[py+1]![px+1]===3) open.add(y*20+x);
  }
  return open;
}
export function movedWithSong(before: TutorialObservation, after: TutorialObservation): boolean {
  const final=actionFrame(before,after),a=heroCell(before.frame),b=heroCell(final);
  if(!a||!b||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1)return false;
  const initial=visiblePieces(before.frame),current=visiblePieces(final),dx=b.x-a.x,dy=b.y-a.y;
  return initial.some(p=>Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y))<=2
    && !hasPiece(current,p) && current.some(q=>q.x===p.x+dx&&q.y===p.y+dy&&(q.kind===p.kind || p.kind==='stone'&&q.kind==='support')));
}
export function reflected(before: TutorialObservation, after: TutorialObservation, action: number): boolean {
  if(action!==5)return false;
  const final=actionFrame(before,after);
  return !sameCell(heroCell(before.frame),heroCell(final))
    || JSON.stringify(visiblePieces(before.frame))!==JSON.stringify(visiblePieces(final));
}
export function observeLesson(learned: Set<BardLesson>, before: TutorialObservation, after: TutorialObservation, action: number): void {
  if (before.level!==1) return;
  const final=actionFrame(before,after),a=heroCell(before.frame),b=heroCell(final);
  const initial=visiblePieces(before.frame),current=visiblePieces(final);
  if (a&&b&&!sameCell(a,b)) learned.add('move');
  if (action<=4 && movedWithSong(before,after)) learned.add('song');
  if (action<=4 && a&&b&&!sameCell(a,b) && initial.some(p=>Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y))<=2&&hasPiece(current,p))) learned.add('anchor');
  const previouslyOpen=openGateCells(before.frame);
  for (const frame of sameLevelFrames(before,after)) {
    const pieces=visiblePieces(frame);
    if (pieces.some(p=>p.kind==='support'&&!hasPiece(initial,p))) learned.add('platform');
    if ([...openGateCells(frame)].some(cell=>!previouslyOpen.has(cell))) learned.add('gate');
  }
  if (reflected(before,after,action)) learned.add('mirror');
}

export function lessonPrompt(learned: ReadonlySet<BardLesson>): string {
  return !learned.has('song')
    ? 'Avance avec une flèche : les caisses et monstres situés à deux cases de toi au maximum tentent de faire le même pas. Les diagonales sont comprises.'
    : !learned.has('anchor')
      ? 'Un objet bloqué reste sur place pendant que tu avances. Utilise un bord ou un mur pour modifier son écart avec toi ; le chant traverse les murs.'
      : !learned.has('platform')
        ? 'Amène une caisse dans l’eau : elle devient un appui marron marqué d’un X cyan. Ton chant peut ensuite déplacer cet appui vers une autre case d’eau.'
        : !learned.has('mirror')
          ? 'Espace active les miroirs. Le + gris clair indique l’arrivée du Barde ; le carré gris clair celle d’une caisse. X fonctionne aussi.'
          : !learned.has('gate')
            ? 'Place un poids sur un + rose. Observe les portes de même repère : certaines s’ouvrent, d’autres poussent quand elles se ferment.'
            : 'Combine le chant, les appuis et les reflets pour rejoindre le contour jaune. Un objet peut quitter son bouton si tu passes trop près : Z annule le dernier coup.';
}
