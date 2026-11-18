import { BardPuzzleSession } from '../../experiments/sinking-star-ss05/src/core.ts';
import { SS05_LEVELS } from '../../experiments/sinking-star-ss05/src/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

export function createSs05Backend(): GameBackend {
  let session: BardPuzzleSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS05') throw new Error('Unknown native game.');
        const next = new BardPuzzleSession(SS05_LEVELS);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS05 is not loaded.');
      switch (request.type) {
        case 'action': return session.action(request.actionId);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        default: throw new Error('SS05 does not support Merchant selection.');
      }
    },
  };
}
