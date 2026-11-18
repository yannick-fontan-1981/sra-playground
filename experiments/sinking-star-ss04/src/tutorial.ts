import type { Observation } from './core.js';

export type WizardLesson = 'move' | 'swap' | 'platform' | 'mirror' | 'place' | 'gate';
type TutorialObservation = Pick<Observation, 'level' | 'frame' | 'frames'>;

/** Tutorial and feedback read only public pixels, never the internal game state. */
export function heroCell(frame: number[][]): number {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    const arms=[frame[y]![x+1],frame[y+1]![x],frame[y+1]![x+2],frame[y+2]![x+1]];
    if (frame[y + 1]![x + 1] === 15 && arms.filter(c=>c===15).length>=3) return y * 64 + x;
  }
  return -1;
}
function stoneAt(frame: number[][], x: number, y: number): boolean {
  return frame[y+1]?.[x+1] === 5 && frame[y]?.[x+1] === 13
    && frame[y+1]?.[x] === 13 && frame[y+1]?.[x+2] === 13 && frame[y+2]?.[x+1] === 13;
}
function monsterAt(frame: number[][], x: number, y: number): boolean {
  return frame[y+1]?.[x+1] === 8 && frame[y]?.[x+1] === 5
    && frame[y+1]?.[x] === 5 && frame[y+1]?.[x+2] === 5 && frame[y+2]?.[x+1] === 5;
}
function actorAt(frame: number[][], cell: number): boolean {
  if (cell < 0) return false;
  const x=cell%64,y=Math.floor(cell/64);
  return stoneAt(frame,x,y) || monsterAt(frame,x,y);
}
function sameLevelFrames(before: TutorialObservation, after: TutorialObservation): number[][][] {
  // A completed room may append the first image of the next room.
  return after.level !== before.level ? after.frames.slice(0,-1) : after.frames;
}
export function exchangedFrame(before: TutorialObservation, after: TutorialObservation): number[][] | undefined {
  const origin=heroCell(before.frame);
  return sameLevelFrames(before,after).find(frame=>{
    const target=heroCell(frame);
    return target>=0 && target!==origin && actorAt(before.frame,target) && actorAt(frame,origin);
  });
}
export function actionFrame(before: TutorialObservation, after: TutorialObservation): number[][] {
  return sameLevelFrames(before,after).at(-1) ?? after.frame;
}
function openGateCells(frame: number[][]): Set<number> {
  const open=new Set<number>();
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x] === 7 && frame[y]![x+2] === 7
      && frame[y+2]![x] === 7 && frame[y+2]![x+2] === 7
      && frame[y+1]![x+1] === 3) open.add(y*64+x);
  }
  return open;
}
function supportCount(frame: number[][]): number {
  let count=0;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x]===10 && frame[y]![x+2]===10 && frame[y+2]![x]===10 && frame[y+2]![x+2]===10) count++;
  }
  return count;
}
export function observeLesson(learned: Set<WizardLesson>, before: TutorialObservation, after: TutorialObservation): void {
  if (before.level!==1) return;
  const final=actionFrame(before,after), exchange=exchangedFrame(before,after);
  if (heroCell(before.frame)!==heroCell(final) && heroCell(final)>=0) learned.add('move');
  if (exchange) {
    learned.add('swap');
    const a=heroCell(before.frame),b=heroCell(exchange);
    if (a%64!==b%64 && Math.floor(a/64)!==Math.floor(b/64)) learned.add('mirror');
  }
  for (const frame of sameLevelFrames(before,after)) {
    for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
      if (frame[y]![x+2]===7 && frame[y+2]![x]===7 && frame[y+2]![x+2]===7
        && (stoneAt(frame,x,y)||monsterAt(frame,x,y))) learned.add('place');
    }
    if (supportCount(frame)>supportCount(before.frame)) learned.add('platform');
  }
  const previouslyOpen=openGateCells(before.frame);
  if ([...openGateCells(final)].some(cell=>!previouslyOpen.has(cell))) learned.add('gate');
}

export function lessonPrompt(learned: ReadonlySet<WizardLesson>): string {
  return !learned.has('swap') ? 'Une flèche lance ta visée dans cette direction. Si elle rencontre une caisse, vous échangez vos places ; sinon, tu marches d’une case.'
    : !learned.has('platform') ? 'Dépose une caisse sur la presse, puis occupe son bouton. La presse peut l’envoyer dans l’eau : elle devient un appui marron marqué d’un X cyan.'
    : !learned.has('mirror') ? 'Traverse le nouvel appui. Depuis le bouton de sortie, vise vers le haut : le côté blanc du miroir dévie ta visée vers la caisse de l’autre îlot.'
    : !learned.has('place') ? 'Tiens-toi sur un + rose, puis vise une caisse. Après l’échange, elle occupe ta place et maintient le bouton.'
    : 'Garde une caisse sur le bouton de sortie pour laisser le passage ouvert, puis rejoins le contour jaune. Z permet de revoir chaque coup.';
}
