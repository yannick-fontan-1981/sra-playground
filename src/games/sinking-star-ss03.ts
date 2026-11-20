import { PullPuzzleSession, type LevelSpec } from '../../experiments/sinking-star-ss03/src/core.ts';
import { SS03_LEVELS } from '../../experiments/sinking-star-ss03/src/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

export function createSs03Backend(levels: readonly LevelSpec[] = SS03_LEVELS): GameBackend {
  let session: PullPuzzleSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS03') throw new Error('Unknown native game.');
        const next = new PullPuzzleSession(levels);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS03 is not loaded.');
      switch (request.type) {
        case 'action': return session.action(request.actionId);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        default: throw new Error('SS03 only supports the four directional actions.');
      }
    },
  };
}
