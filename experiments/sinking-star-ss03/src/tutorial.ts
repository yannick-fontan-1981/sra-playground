import type { Observation } from './core.js';

export type PullLesson = 'move' | 'pull' | 'release' | 'place' | 'gate';
type TutorialObservation = Pick<Observation, 'level' | 'frame' | 'frames'>;
const directions = [{x:0,y:-3},{x:0,y:3},{x:-3,y:0},{x:3,y:0}] as const;

/** Tutorial progress uses public pixels and the player's inputs. */
export function heroCell(frame: number[][]): number {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (frame[y + 1]![x + 1] === 14) return y * 64 + x;
  }
  return -1;
}

function stoneAt(frame: number[][], x: number, y: number): boolean {
  return x >= 2 && x < 62 && y >= 2 && y < 62 && frame[y+1]![x+1] === 5
    && frame[y]![x+1] === 13 && frame[y+1]![x] === 13
    && frame[y+1]![x+2] === 13 && frame[y+2]![x+1] === 13;
}

function actionFrame(before: TutorialObservation, after: TutorialObservation): number[][] {
  // A successful exit can append the next room after the last image of this room.
  return after.level !== before.level && after.frames.length > 1 ? after.frames.at(-2)! : after.frame;
}

export function pulled(before: TutorialObservation, after: TutorialObservation, action: number): boolean {
  const origin = heroCell(before.frame), direction = directions[action-1];
  if (origin < 0 || !direction) return false;
  const x = origin % 64, y = Math.floor(origin / 64), final = actionFrame(before,after);
  return heroCell(final) === (y+direction.y)*64+x+direction.x
    && stoneAt(before.frame,x-direction.x,y-direction.y) && stoneAt(final,x,y);
}

function pinkCorners(frame: number[][], x: number, y: number): boolean {
  return frame[y]![x] === 7 && frame[y]![x+2] === 7 && frame[y+2]![x] === 7 && frame[y+2]![x+2] === 7;
}

function visibleOpenGate(frame: number[][]): boolean {
  for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
    if (pinkCorners(frame,x,y) && frame[y+1]![x+1] === 3 && frame[y]![x+1] === 3) return true;
  }
  return false;
}

export class PullTutorial {
  readonly learned = new Set<PullLesson>();
  private lastPullAction = 0;

  observe(before: TutorialObservation, after: TutorialObservation, action: number): void {
    if (before.level !== 1) return;
    const final = actionFrame(before, after), moved = heroCell(before.frame) !== heroCell(final);
    if (moved) this.learned.add('move');
    if (pulled(before, after, action)) {
      this.learned.add('pull');
      this.lastPullAction = action;
    } else if (moved) {
      const previous = directions[this.lastPullAction-1], current = directions[action-1];
      if (previous && current && previous.x*current.x+previous.y*current.y === 0) this.learned.add('release');
      this.lastPullAction = 0;
    }
    for (let y = 2; y < 62; y += 3) for (let x = 2; x < 62; x += 3) {
      if (!pinkCorners(final,x,y)) continue;
      if (stoneAt(final,x,y)) this.learned.add('place');
      if (final[y+1]![x+1] === 3 && final[y]![x+1] === 3) this.learned.add('gate');
    }
  }

  reset(keepLessons = false): void {
    this.lastPullAction = 0;
    if (!keepLessons) this.learned.clear();
  }

  prompt(frame: number[][]): string {
    if (!this.learned.has('pull')) return 'Place-toi à côté d’une caisse, avec une case libre devant toi. Éloigne-toi d’elle avec une flèche : elle occupe la case que tu quittes.';
    if (!this.learned.has('release')) return 'Pour laisser la caisse en place, pars sur le côté après une traction. Contourne-la pour la tirer ensuite dans une autre direction.';
    if (!this.learned.has('place')) return 'Amène une caisse sur un + rose. Il faut pouvoir dépasser le bouton d’une case pour y tirer la caisse, puis partir sur le côté.';
    if (!visibleOpenGate(frame)) return 'Les trois + roses doivent être occupés ensemble. Garde de la place pour te repositionner autour des autres caisses.';
    return 'Le passage est ouvert. Rejoins le contour jaune en laissant les trois caisses sur leurs boutons.';
  }
}
