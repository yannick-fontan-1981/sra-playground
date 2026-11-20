import { DuoPuzzleSession } from '../../experiments/sinking-star-ss10/src/core.ts';
import { SS10_LEVELS } from '../../experiments/sinking-star-ss10/src/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

export function createSs10Backend(): GameBackend {
  let session: DuoPuzzleSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS10') throw new Error('Unknown native game.');
        const next = new DuoPuzzleSession(SS10_LEVELS);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS10 is not loaded.');
      switch (request.type) {
        case 'action':
          if (!Number.isInteger(request.actionId) || request.actionId < 1 || request.actionId > 6) throw new Error('Invalid SS10 action.');
          if (request.actionId === 6 && (!request.data || !Number.isInteger(request.data.x) || !Number.isInteger(request.data.y)
            || request.data.x < 0 || request.data.y < 0 || request.data.x > 63 || request.data.y > 63)) throw new Error('ACTION6 requires pixel coordinates in 0–63.');
          return session.action(request.actionId, request.data);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        default: throw new Error('Use ACTION6 to select a hero in SS10.');
      }
    },
  };
}
