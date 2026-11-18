import type { Observation } from './core.js';

export type TutorialLesson = 'move' | 'chain' | 'bridge' | 'gate';
type TutorialObservation = Pick<Observation, 'level' | 'frame' | 'frames'>;

/** Tutorial progress uses only public frames. */
export function heroCell(frame: number[][]): number {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y + 1]![x + 1] === 8) return y * 64 + x;
  }
  return -1;
}

export function pushedCount(before: TutorialObservation, after: TutorialObservation, action: number): number {
  if (after.frames.length < 3) return 0;
  const origin = heroCell(before.frame);
  if (origin < 0) return 0;
  const direction = [{x:0,y:-3},{x:0,y:3},{x:-3,y:0},{x:3,y:0}][action-1];
  if (!direction) return 0;
  const frame = before.frame;
  let x = origin % 64 + direction.x, y = Math.floor(origin / 64) + direction.y;
  let count = 0;
  // Brown edges and a black center identify a movable stone, even on a button.
  while (x >= 2 && x < 62 && y >= 2 && y < 62 && frame[y+1]![x+1] === 5
    && frame[y]![x+1] === 13 && frame[y+1]![x] === 13
    && frame[y+1]![x+2] === 13 && frame[y+2]![x+1] === 13) {
    count++; x += direction.x; y += direction.y;
  }
  return count;
}

export function observeLesson(learned: Set<TutorialLesson>, before: TutorialObservation, after: TutorialObservation, action: number): void {
  if (before.level !== 1) return;
  if (action >= 1 && action <= 4 && heroCell(before.frame) !== heroCell(after.frame)) learned.add('move');
  const frame = after.frame;
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y]![x] === 10 && frame[y]![x+2] === 10 && frame[y+1]![x+1] === 10 && frame[y+2]![x] === 10 && frame[y+2]![x+2] === 10) learned.add('bridge');
    if (frame[y]![x] === 7 && frame[y]![x+2] === 7 && frame[y+2]![x] === 7 && frame[y+2]![x+2] === 7 && frame[y+1]![x+1] === 3 && frame[y]![x+1] === 3) learned.add('gate');
  }
  if (pushedCount(before, after, action) > 1) learned.add('chain');
}

export function lessonPrompt(learned: ReadonlySet<TutorialLesson>): string {
  if (!learned.has('chain')) return 'Approche-toi des deux pierres du passage. Appuie sur la flèche vers elles : toute la file avance d’une case si son extrémité est libre.';
  if (!learned.has('bridge')) return 'Une pierre poussée dans l’eau devient un pont. Préserve les deux autres pour les boutons.';
  if (!learned.has('gate')) return 'Place une pierre sur chacun des deux + roses. Le Guerrier peut aussi peser sur un bouton, mais pas le laisser libre en traversant.';
  return 'Les deux boutons doivent rester occupés. Dès que la porte est ouverte, rejoins le contour jaune.';
}
