import { TrioPuzzleSession } from '../../experiments/sinking-star-ss17/src/core.ts';
import { SS17_LEVELS } from '../../experiments/sinking-star-ss17/src/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

export function createSs17Backend(): GameBackend {
  let session: TrioPuzzleSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS17') throw new Error('Unknown native game.');
        const next = new TrioPuzzleSession(SS17_LEVELS);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS17 is not loaded.');
      switch (request.type) {
        case 'action':
          if (!Number.isInteger(request.actionId) || request.actionId < 1 || request.actionId > 6) throw new Error('Invalid SS17 action.');
          if (request.actionId === 6 && (!request.data || !Number.isInteger(request.data.x) || !Number.isInteger(request.data.y)
            || request.data.x < 0 || request.data.y < 0 || request.data.x > 63 || request.data.y > 63)) throw new Error('ACTION6 requires pixel coordinates in 0–63.');
          return session.action(request.actionId, request.data);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        default: throw new Error('Use ACTION6 to select a hero in SS17.');
      }
    },
  };
}
