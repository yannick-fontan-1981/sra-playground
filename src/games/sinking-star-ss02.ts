import { PushPuzzleSession } from '../../experiments/sinking-star-ss02/src/core.ts';
import { SS02_LEVELS } from '../../experiments/sinking-star-ss02/src/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

export function createSs02Backend(): GameBackend {
  let session: PushPuzzleSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS02') throw new Error('Unknown native game.');
        const next = new PushPuzzleSession(SS02_LEVELS);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS02 is not loaded.');
      switch (request.type) {
        case 'action': return session.action(request.actionId);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        default: throw new Error('SS02 only supports the four directional actions.');
      }
    },
  };
}
