import { SinkingStarSession } from './sinking-star/core.ts';
import { SS01_LEVELS } from './sinking-star/levels.ts';
import type { GameBackend, GameRequest } from '../runtime/native-game-dispatcher.ts';

/** The tested v5 engine is shared with the lab. No solver, semantic map or reference route is exported. */
export function createSinkingStarBackend(): GameBackend {
  let session: SinkingStarSession | null = null;
  return {
    dispatch(request: GameRequest) {
      if (request.type === 'load') {
        if (request.code !== 'SS01') throw new Error('Unknown native game.');
        const next = new SinkingStarSession(SS01_LEVELS);
        const observation = request.level === undefined ? next.observe() : next.selectLevel(request.level);
        session = next;
        return observation;
      }
      if (!session) throw new Error('SS01 is not loaded.');
      switch (request.type) {
        case 'action':
          if (!Number.isInteger(request.actionId) || request.actionId < 1 || request.actionId > 6) throw new Error('Invalid SS01 action.');
          if (request.actionId === 6 && (!request.data || !Number.isInteger(request.data.x) || !Number.isInteger(request.data.y)
            || request.data.x < 0 || request.data.y < 0 || request.data.x > 63 || request.data.y > 63)) throw new Error('ACTION6 requires pixel coordinates in 0–63.');
          return session.action(request.actionId, request.data);
        case 'undo': return session.undo();
        case 'reset': return session.reset();
        case 'restart': return session.restart();
        case 'selectLevel': return session.selectLevel(request.level);
        case 'nextMerchant': return session.nextMerchant(); // Manual C/button shortcut for an ordinary ACTION6.
        default: throw new Error('Unknown SS01 request.');
      }
    },
  };
}
